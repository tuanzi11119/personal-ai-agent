from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class UserLLMConfig(UUIDMixin, TimestampMixin, Base):
    """Per-user OpenAI-compatible chat + embedding configuration.

    API keys are stored Fernet-encrypted and are never returned to clients.
    """

    __tablename__ = "user_llm_configs"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )

    base_url: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(Text, default="", nullable=False)
    model_name: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.3, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=800, nullable=False)

    embedding_base_url: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    embedding_api_key_encrypted: Mapped[str] = mapped_column(Text, default="", nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    embedding_dimension: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user = relationship("User", back_populates="llm_config")
