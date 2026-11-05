from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LLMSettingsIn(BaseModel):
    base_url: str = Field(default="", max_length=512)
    api_key: str | None = Field(default=None, description="Send null/omit to keep the stored key")
    model_name: str = Field(default="", max_length=160)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=800, ge=64, le=4096)
    embedding_base_url: str = Field(default="", max_length=512)
    embedding_api_key: str | None = None
    embedding_model: str = Field(default="", max_length=160)
    embedding_dimension: int | None = Field(default=None, ge=64, le=3072)


class LLMSettingsOut(BaseModel):
    has_custom_config: bool = False
    base_url: str = ""
    model_name: str = ""
    temperature: float = 0.3
    max_tokens: int = 800
    api_key_hint: str = ""
    has_api_key: bool = False
    embedding_base_url: str = ""
    embedding_model: str = ""
    embedding_dimension: int | None = None
    embedding_api_key_hint: str = ""
    has_embedding_api_key: bool = False
    updated_at: datetime | None = None
    platform_mode: str = "mock"
    platform_embedding_mode: str = "mock"
    configured_dimension: int = 384


class TestConnectionResult(BaseModel):
    ok: bool
    mode: str
    model: str | None = None
    detail: str = ""
