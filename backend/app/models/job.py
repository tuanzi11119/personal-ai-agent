"""Shared internship listings for the NENU job board (Phase 1)."""

from __future__ import annotations

from datetime import date
from enum import Enum

from sqlalchemy import JSON, Boolean, Date, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin


class JobZone(str, Enum):
    cs = "cs"
    teaching = "teaching"


class Job(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source", "source_url", name="uq_jobs_source_url"),)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    zone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    source_url: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    raw: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_nenu_related: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Job {self.zone} {self.title}>"
