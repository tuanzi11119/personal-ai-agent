from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

DEFAULT_SYSTEM_PROMPT = """You are the AI digital twin of a job candidate.

Help visitors understand the candidate's experience, skills and projects using
only the candidate's uploaded knowledge base.

Rules:
1. Prefer answers grounded in the knowledge base.
2. Never invent work experience, employers, dates or technical abilities.
3. If the knowledge base does not contain the answer, say so clearly.
4. You may summarise known material, but never present guesses as facts.
5. Keep answers natural, professional and concise.
6. Never reveal private data or other users' information.
7. Do not claim to be the candidate; state that you are their AI assistant."""


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    system_prompt: str = Field(default=DEFAULT_SYSTEM_PROMPT, max_length=8000)
    avatar_url: str = Field(default="", max_length=1024)
    is_public: bool = False

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Agent name must not be blank")
        return value

    @field_validator("avatar_url")
    @classmethod
    def _validate_avatar(cls, value: str) -> str:
        value = (value or "").strip()
        if value and not (value.startswith("http://") or value.startswith("https://") or value.startswith("/")):
            raise ValueError("Avatar URL must start with http://, https:// or /")
        return value


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    system_prompt: str | None = Field(default=None, max_length=8000)
    avatar_url: str | None = Field(default=None, max_length=1024)
    is_public: bool | None = None


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    description: str
    system_prompt: str
    avatar_url: str
    slug: str
    is_public: bool
    created_at: datetime
    updated_at: datetime
    document_count: int = 0
    public_path: str = ""


class PublicAgentOut(BaseModel):
    id: str
    name: str
    description: str
    avatar_url: str
    slug: str
    suggested_questions: list[str] = []
