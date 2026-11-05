"""Vector search restricted to a single agent's knowledge base."""

from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_dialect_name
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float


def _cosine_scores(matrix: np.ndarray, query: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1)
    query_norm = np.linalg.norm(query)
    denom = norms * query_norm
    denom[denom == 0] = 1e-12
    return (matrix @ query) / denom


def count_agent_chunks(db: Session, agent_id: str) -> int:
    """Number of embedded chunks belonging to one agent (used to bound the fallback context)."""
    row = db.execute(
        text(
            """
            SELECT COUNT(*) AS total
            FROM document_chunks
            WHERE agent_id = :agent_id
              AND embedding IS NOT NULL
            """
        ),
        {"agent_id": agent_id},
    ).mappings().first()
    return int(row["total"]) if row else 0


def search_chunks(db: Session, agent_id: str, query_vector: list[float], top_k: int) -> list[RetrievedChunk]:
    """Return the top-k chunks for this agent only. Cross-agent leakage is impossible by construction."""
    if not query_vector:
        return []

    if get_dialect_name() == "postgresql":
        vector_literal = "[" + ",".join(f"{value:.8f}" for value in query_vector) + "]"
        stmt = text(
            """
            SELECT dc.id AS chunk_id,
                   dc.document_id AS document_id,
                   dc.content AS content,
                   dc.chunk_index AS chunk_index,
                   d.filename AS filename,
                   (dc.embedding <=> CAST(:query_vector AS vector)) AS distance
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.agent_id = :agent_id
              AND dc.embedding IS NOT NULL
            ORDER BY distance ASC
            LIMIT :limit
            """
        )
        rows = db.execute(
            stmt, {"agent_id": agent_id, "query_vector": vector_literal, "limit": top_k}
        ).mappings().all()
        return [
            RetrievedChunk(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                filename=row["filename"],
                chunk_index=row["chunk_index"],
                content=row["content"],
                score=float(1.0 - float(row["distance"])),
            )
            for row in rows
        ]

    # SQLite / other dialects: in-Python cosine similarity over this agent's chunks.
    rows = db.execute(
        text(
            """
            SELECT dc.id AS chunk_id,
                   dc.document_id AS document_id,
                   dc.content AS content,
                   dc.chunk_index AS chunk_index,
                   dc.embedding AS embedding,
                   d.filename AS filename
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.agent_id = :agent_id
              AND dc.embedding IS NOT NULL
            """
        ),
        {"agent_id": agent_id},
    ).mappings().all()
    if not rows:
        return []

    vectors: list[list[float]] = []
    valid_rows = []
    for row in rows:
        raw = row["embedding"]
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else list(raw)
        except (TypeError, ValueError):
            continue
        if len(parsed) != len(query_vector):
            logger.warning("skipping chunk %s with incompatible embedding dimension", row["chunk_id"])
            continue
        vectors.append([float(value) for value in parsed])
        valid_rows.append(row)
    if not vectors:
        return []

    matrix = np.asarray(vectors, dtype=np.float64)
    query = np.asarray(query_vector, dtype=np.float64)
    scores = _cosine_scores(matrix, query)
    order = np.argsort(-scores)[: max(1, top_k)]
    results: list[RetrievedChunk] = []
    for index in order:
        row = valid_rows[int(index)]
        results.append(
            RetrievedChunk(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                filename=row["filename"],
                chunk_index=row["chunk_index"],
                content=row["content"],
                score=float(scores[int(index)]),
            )
        )
    return results
