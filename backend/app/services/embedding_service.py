"""Embedding providers (OpenAI-compatible + deterministic offline mock)."""

from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.http import new_client
from app.core.logging import get_logger, redact_secrets
from app.core.vector import EmbeddingDimensionError, validate_embedding_batch
from app.models import User, UserLLMConfig

logger = get_logger(__name__)

_LATIN_TOKEN = re.compile(r"[a-z0-9_+#.]+")
_CJK_CHAR = re.compile(r"[\u4e00-\u9fff]")
_CJK_UNIGRAM_WEIGHT = 0.3


class EmbeddingError(RuntimeError):
    """Raised when embeddings cannot be produced (never leaks the API key)."""


@dataclass
class EmbeddingConfig:
    provider: str
    base_url: str
    api_key: str
    model: str
    dimension: int

    @property
    def is_mock(self) -> bool:
        return self.provider == "mock"


def resolve_embedding_config(db: Session, user: User | None) -> EmbeddingConfig:
    """User config wins when complete, otherwise fall back to the platform default."""
    dimension = settings.embedding_dimension
    if user is not None:
        config: UserLLMConfig | None = db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user.id).first()
        if config is not None and config.embedding_model:
            user_dim = config.embedding_dimension or dimension
            if user_dim != dimension:
                raise EmbeddingDimensionError(
                    f"Your knowledge base is indexed with {dimension}-dimensional vectors, "
                    f"but the configured embedding dimension is {user_dim}. "
                    "Re-index the knowledge base before switching embedding models."
                )
            api_key = ""
            if config.embedding_api_key_encrypted:
                from app.core.crypto import decrypt_secret

                api_key = decrypt_secret(config.embedding_api_key_encrypted)
            base_url = config.embedding_base_url or settings.platform_embedding_base_url
            if api_key or settings.platform_embedding_api_key:
                return EmbeddingConfig(
                    provider="openai_compatible",
                    base_url=base_url.rstrip("/"),
                    api_key=api_key or settings.platform_embedding_api_key,
                    model=config.embedding_model,
                    dimension=dimension,
                )

    if settings.effective_embedding_provider == "openai_compatible":
        return EmbeddingConfig(
            provider="openai_compatible",
            base_url=settings.platform_embedding_base_url.rstrip("/"),
            api_key=settings.platform_embedding_api_key,
            model=settings.platform_embedding_model,
            dimension=dimension,
        )
    return EmbeddingConfig(provider="mock", base_url="", api_key="", model="mock-hash-ngram", dimension=dimension)


def tokenize(text: str) -> list[str]:
    """Whitespace/latin tokeniser plus CJK uni/bi-grams for lexical recall."""
    lowered = (text or "").lower()
    tokens = _LATIN_TOKEN.findall(lowered)
    cjk_chars = _CJK_CHAR.findall(lowered)
    tokens.extend(cjk_chars)
    tokens.extend("".join(cjk_chars[i : i + 2]) for i in range(len(cjk_chars) - 1))
    return tokens


def _weighted_tokens(text: str) -> list[tuple[str, float]]:
    """Tokens with relevance weights.

    Single CJK characters are very common (的/在/年...), so they are down-weighted
    relative to CJK bigrams and latin words. Without the weighting, unrelated Chinese
    questions collide on common characters and look "similar" to every chunk.
    """
    lowered = (text or "").lower()
    weighted: list[tuple[str, float]] = [(token, 1.0) for token in _LATIN_TOKEN.findall(lowered)]
    cjk_chars = _CJK_CHAR.findall(lowered)
    weighted.extend((char, _CJK_UNIGRAM_WEIGHT) for char in cjk_chars)
    weighted.extend(
        ("".join(cjk_chars[index : index + 2]), 1.0) for index in range(len(cjk_chars) - 1)
    )
    return weighted


def _hash_index(token: str, dimension: int) -> tuple[int, float]:
    digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
    value = int.from_bytes(digest, "big")
    index = value % dimension
    sign = 1.0 if (value >> 63) & 1 else -1.0
    return index, sign


def mock_embed(text: str, dimension: int) -> list[float]:
    """Deterministic hashed bag-of-ngrams vector.

    This is NOT a semantic model: it matches lexical overlap only. It exists so the
    whole RAG pipeline can be exercised offline without an API key.
    """
    vector = [0.0] * dimension
    tokens = _weighted_tokens(text)
    if not tokens:
        return vector
    for token, weight in tokens:
        index, sign = _hash_index(token, dimension)
        vector[index] += sign * weight
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _post_embeddings(config: EmbeddingConfig, texts: list[str]) -> list[list[float]]:
    url = f"{config.base_url}/embeddings"
    headers = {"Content-Type": "application/json"}
    if config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    try:
        with new_client(settings.embedding_timeout_seconds) as client:
            response = client.post(url, json={"model": config.model, "input": texts}, headers=headers)
    except httpx.HTTPError as exc:
        raise EmbeddingError(f"Embedding service unreachable: {type(exc).__name__}") from exc
    if response.status_code >= 400:
        detail = _extract_error_detail(response)
        raise EmbeddingError(f"Embedding API error ({response.status_code}): {detail}")
    try:
        payload = response.json()
        rows = sorted(payload["data"], key=lambda row: row.get("index", 0))
        return [[float(value) for value in row["embedding"]] for row in rows]
    except (KeyError, TypeError, ValueError) as exc:
        raise EmbeddingError("Embedding API returned an unexpected payload") from exc


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
        message = payload.get("error", {}).get("message") or payload.get("message") or ""
    except ValueError:
        message = response.text[:300]
    return redact_secrets(str(message))[:300]


def embed_texts(texts: list[str], config: EmbeddingConfig) -> list[list[float]]:
    if not texts:
        return []
    if config.is_mock:
        vectors = [mock_embed(text, config.dimension) for text in texts]
        return validate_embedding_batch(vectors, config.dimension)

    vectors: list[list[float]] = []
    batch_size = 32
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        vectors.extend(_post_embeddings(config, batch))
    if len(vectors) != len(texts):
        raise EmbeddingError("Embedding API returned a different number of vectors than inputs")
    return validate_embedding_batch(vectors, config.dimension)


def embed_query(text: str, config: EmbeddingConfig) -> list[float]:
    return embed_texts([text], config)[0]
