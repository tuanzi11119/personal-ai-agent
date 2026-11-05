"""Map ORM messages to API schemas."""

from __future__ import annotations

import json

from app.models import Message
from app.schemas.chat import MessageOut, SourceOut


def to_message_out(message) -> MessageOut:  # noqa: ANN001
    try:
        raw_sources = json.loads(message.sources_json or "[]")
    except ValueError:
        raw_sources = []
    sources = [
        SourceOut(
            document_id=str(item.get("document_id", "")),
            filename=str(item.get("filename", "")),
            chunk_index=int(item.get("chunk_index", 0)),
            score=float(item.get("score", 0.0)),
            excerpt=str(item.get("excerpt", "")),
        )
        for item in raw_sources
        if isinstance(item, dict)
    ]
    return MessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        sources=sources,
        created_at=message.created_at,
    )
