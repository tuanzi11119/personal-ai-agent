"""Dialect-aware embedding column.

On PostgreSQL the column is a native pgvector `vector(n)`; on SQLite (local dev /
tests) it is stored as JSON text and similarity is computed in Python.

The embedding dimension is fixed by configuration so vectors of different models
can never be silently mixed: every stored vector is validated against
`settings.embedding_dimension` on write and on search.
"""

from __future__ import annotations

import json
from typing import Any, Sequence

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator


class EmbeddingDimensionError(RuntimeError):
    """Raised when a vector does not match the configured embedding dimension."""


class VectorType(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, dimension: int) -> None:
        super().__init__()
        self.dimension = dimension

    def load_dialect_impl(self, dialect):  # noqa: ANN001
        if dialect.name == "postgresql":
            try:
                from pgvector.sqlalchemy import Vector
            except ImportError as exc:  # pragma: no cover - depends on env
                raise RuntimeError(
                    "pgvector package is required for PostgreSQL vector columns. "
                    "Install it with: pip install pgvector"
                ) from exc
            return dialect.type_descriptor(Vector(self.dimension))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect):  # noqa: ANN001
        if value is None:
            return None
        vector = _coerce_vector(value, self.dimension)
        if dialect.name == "postgresql":
            return vector
        return json.dumps(vector)

    def process_result_value(self, value: Any, dialect):  # noqa: ANN001
        if value is None:
            return None
        if isinstance(value, (list, tuple)):
            return [float(item) for item in value]
        return [float(item) for item in json.loads(value)]


def _coerce_vector(value: Any, dimension: int) -> list[float]:
    if hasattr(value, "tolist"):
        value = value.tolist()
    vector: Sequence[float] = value
    vector = [float(item) for item in vector]
    if len(vector) != dimension:
        raise EmbeddingDimensionError(
            f"Embedding dimension mismatch: expected {dimension}, got {len(vector)}. "
            "Change EMBEDDING_DIMENSION and re-index the knowledge base before switching models."
        )
    return vector


def validate_embedding(vector: Sequence[float], dimension: int | None = None) -> list[float]:
    from app.core.config import settings

    return _coerce_vector(vector, dimension or settings.embedding_dimension)


def validate_embedding_batch(vectors: Sequence[Sequence[float]], dimension: int | None = None) -> list[list[float]]:
    return [validate_embedding(vector, dimension) for vector in vectors]
