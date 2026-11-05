"""Conversation and message persistence."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.models import Conversation, Message
from app.models.message import MessageRole


def create_conversation(
    db: Session,
    agent_id: str,
    *,
    user_id: str | None,
    visitor_id: str | None,
    channel: str,
    title: str = "",
) -> Conversation:
    conversation = Conversation(
        agent_id=agent_id,
        user_id=user_id,
        visitor_id=visitor_id,
        channel=channel,
        title=title[:200],
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get_conversation(db: Session, conversation_id: str) -> Conversation | None:
    return db.get(Conversation, conversation_id)


def list_messages(db: Session, conversation_id: str) -> list[Message]:
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )


def add_message(
    db: Session,
    conversation_id: str,
    role: str,
    content: str,
    sources: list[dict] | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        sources_json=json.dumps(sources or [], ensure_ascii=False),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def recent_history(db: Session, conversation_id: str, limit: int) -> list[dict[str, str]]:
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()
    return [{"role": m.role, "content": m.content} for m in messages if m.role in (MessageRole.USER, MessageRole.ASSISTANT)]
