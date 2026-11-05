from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ConversationChannel:
    PLAYGROUND = "playground"
    PUBLIC = "public"


class Conversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conversations"

    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    visitor_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    channel: Mapped[str] = mapped_column(String(20), default=ConversationChannel.PLAYGROUND, nullable=False)
    title: Mapped[str] = mapped_column(String(200), default="", nullable=False)

    agent = relationship("Agent", back_populates="conversations")
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan", passive_deletes=True
    )
