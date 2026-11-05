from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    company: str
    location: str
    zone: str
    source: str
    source_url: str
    deadline: date | None
    description: str
    raw: dict = Field(default_factory=dict)
    is_nenu_related: bool
    created_at: datetime
    updated_at: datetime


class JobListOut(BaseModel):
    items: list[JobOut]
    total: int
