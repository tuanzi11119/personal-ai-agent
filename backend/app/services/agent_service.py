"""Agent helpers: slug generation and public payloads."""

from __future__ import annotations

import re
import secrets

from sqlalchemy.orm import Session

from app.models import Agent

_CJK = re.compile(r"[^a-z0-9\u4e00-\u9fff]+")


def _base_slug(name: str) -> str:
    slug = _CJK.sub("-", (name or "").strip().lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:60] or "agent"


def generate_unique_slug(db: Session, name: str) -> str:
    base = _base_slug(name)
    for _ in range(20):
        candidate = f"{base}-{secrets.token_hex(3)}"
        exists = db.query(Agent.id).filter(Agent.slug == candidate).first()
        if not exists:
            return candidate
    return f"{base}-{secrets.token_urlsafe(8)}"


SUGGESTED_QUESTIONS = [
    "能介绍一下这位候选人的背景吗？",
    "这位候选人做过哪些项目？",
    "他最擅长的技术栈是什么？",
    "他在最近一个项目中承担了什么职责？",
]


def suggested_questions_for(agent: Agent) -> list[str]:
    return SUGGESTED_QUESTIONS
