"""Unified OpenAI-compatible chat provider."""

from __future__ import annotations

from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.core.http import new_client
from app.core.logging import get_logger, redact_secrets
from app.models import User, UserLLMConfig

logger = get_logger(__name__)


class LLMError(RuntimeError):
    """Raised when the upstream model call fails. Message never contains secrets."""


@dataclass
class LLMConfig:
    provider: str  # mock | openai_compatible
    base_url: str
    api_key: str
    model: str
    temperature: float
    max_tokens: int
    max_context_tokens_hint: int = 8000

    @property
    def is_mock(self) -> bool:
        return self.provider == "mock"


@dataclass
class LLMResult:
    content: str
    model: str
    mode: str


def resolve_llm_config(db: Session, user: User | None) -> LLMConfig:
    if user is not None:
        stored: UserLLMConfig | None = (
            db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user.id).first()
        )
        if stored is not None and stored.model_name and stored.api_key_encrypted:
            api_key = decrypt_secret(stored.api_key_encrypted)
            return LLMConfig(
                provider="openai_compatible",
                base_url=(stored.base_url or settings.platform_llm_base_url).rstrip("/"),
                api_key=api_key,
                model=stored.model_name,
                temperature=stored.temperature,
                max_tokens=min(stored.max_tokens, settings.max_answer_tokens * 2),
            )
    if settings.effective_llm_provider == "openai_compatible":
        return LLMConfig(
            provider="openai_compatible",
            base_url=settings.platform_llm_base_url.rstrip("/"),
            api_key=settings.platform_llm_api_key,
            model=settings.platform_llm_model,
            temperature=settings.platform_llm_temperature,
            max_tokens=min(settings.platform_llm_max_tokens, settings.max_answer_tokens),
        )
    return LLMConfig(
        provider="mock",
        base_url="",
        api_key="",
        model="mock-echo",
        temperature=0.0,
        max_tokens=settings.max_answer_tokens,
    )


def chat_completion(messages: list[dict[str, str]], config: LLMConfig) -> LLMResult:
    if config.is_mock:
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        return LLMResult(
            content=f"[mock-llm] Echo: {last_user[:200]}",
            model=config.model,
            mode="mock",
        )

    url = f"{config.base_url}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    payload = {
        "model": config.model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    try:
        with new_client(settings.llm_timeout_seconds) as client:
            response = client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise LLMError("The model provider timed out. Please try again.") from exc
    except httpx.HTTPError as exc:
        raise LLMError(f"The model provider is unreachable ({type(exc).__name__}).") from exc

    if response.status_code >= 400:
        detail = _extract_error_detail(response)
        logger.warning("LLM provider error %s: %s", response.status_code, detail)
        raise LLMError(_friendly_status_message(response.status_code, detail, config))
    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise LLMError("The model provider returned an unexpected response format.") from exc
    if not isinstance(content, str) or not content.strip():
        raise LLMError("The model provider returned an empty answer.")
    return LLMResult(content=content.strip(), model=data.get("model", config.model), mode="live")


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
        message = payload.get("error", {}).get("message") if isinstance(payload, dict) else ""
        if not message and isinstance(payload, dict):
            message = payload.get("message", "")
    except ValueError:
        message = response.text[:200]
    return redact_secrets(str(message or ""))[:200]


def _friendly_status_message(status: int, detail: str, config: LLMConfig) -> str:
    if status in (401, 403):
        return (
            "The model provider rejected the API key (401/403). "
            "Check your key and base URL in Settings."
        )
    if status == 404:
        return f"The model '{config.model}' or endpoint was not found (404). Check the model name and base URL."
    if status == 429:
        return "The model provider rate limited this request (429). Please retry shortly."
    if status >= 500:
        return f"The model provider is failing ({status}). Please retry later."
    return f"The model provider rejected the request ({status}): {detail or 'no details'}"
