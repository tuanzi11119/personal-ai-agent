from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SourceOut(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    score: float
    excerpt: str = ""


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    top_k: int | None = Field(default=None, ge=1, le=12)


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: list[SourceOut] = []
    created_at: datetime


class ChatResponse(BaseModel):
    conversation_id: str
    message: MessageOut
    sources: list[SourceOut] = []
    mode: str = "mock"
    model: str | None = None
    degraded: bool = False
    notice: str | None = None


class ConversationOut(BaseModel):
    id: str
    agent_id: str
    channel: str
    messages: list[MessageOut]
    created_at: datetime
    updated_at: datetime


class ConversationListOut(BaseModel):
    items: list[ConversationOut]
    total: int
