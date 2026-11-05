"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    """All runtime settings. Values come from environment or backend/.env."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- application -------------------------------------------------------
    app_name: str = "Personal AI Agent Platform"
    app_env: str = "development"
    debug: bool = False
    api_prefix: str = "/api"

    # --- security ----------------------------------------------------------
    secret_key: str = Field(
        default="dev-insecure-secret-key-change-me-0123456789abcdef",
        description="Used to sign JWTs and to derive the API-key encryption key.",
    )
    access_token_expire_minutes: int = 60 * 24 * 7
    cookie_name: str = "pai_token"
    visitor_cookie_name: str = "pai_visitor"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # --- database ----------------------------------------------------------
    database_url: str = "sqlite:///./storage/app.db"

    # --- http --------------------------------------------------------------
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- storage / uploads -------------------------------------------------
    storage_dir: str = str(BACKEND_ROOT / "storage")
    max_upload_mb: int = 10
    allowed_extensions: str = ".pdf,.txt,.md,.markdown"
    chunk_size: int = 800
    chunk_overlap: int = 150

    # --- retrieval ---------------------------------------------------------
    default_top_k: int = 5
    max_top_k: int = 12
    # Cosine cut-off for real embedding models. Anything weaker is treated as "not in
    # the knowledge base" so the agent refuses instead of quoting unrelated passages.
    min_retrieval_score: float = 0.15
    # The offline mock embedder (hashed n-grams) produces systematically lower cosine
    # scores than a real model, so it uses its own cut-off.
    mock_min_retrieval_score: float = 0.08
    max_context_chars: int = 6000
    max_history_messages: int = 12
    # When no chunk clears the similarity cut-off, a small knowledge base is passed to
    # the model in full (best-effort ordering) so that a phrasing mismatch between the
    # question and the document (e.g. "毕业于哪里" vs "教育背景：XX大学") does not turn
    # into a false "the material does not cover it". Guarded by the chunk count so a
    # large library never gets dumped wholesale. 0 disables the fallback.
    fallback_context_max_chunks: int = 20

    # --- chat budgets ------------------------------------------------------
    max_user_message_chars: int = 4000
    max_answer_tokens: int = 800
    public_rate_limit_per_minute: int = 20
    auth_rate_limit_per_minute: int = 12

    # --- platform default LLM (OpenAI compatible) --------------------------
    llm_provider: str = "auto"  # auto | mock | openai_compatible
    platform_llm_base_url: str = "https://api.openai.com/v1"
    platform_llm_api_key: str = ""
    platform_llm_model: str = "gpt-4o-mini"
    platform_llm_temperature: float = 0.3
    platform_llm_max_tokens: int = 800
    llm_timeout_seconds: float = 60.0

    # --- platform default embedding ---------------------------------------
    embedding_provider: str = "auto"  # auto | mock | openai_compatible
    platform_embedding_base_url: str = "https://api.openai.com/v1"
    platform_embedding_api_key: str = ""
    platform_embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 384
    embedding_timeout_seconds: float = 60.0

    # --- misc --------------------------------------------------------------
    log_level: str = "INFO"
    mock_embedding_dimension: int = 384

    @field_validator("storage_dir")
    @classmethod
    def _expand_storage_dir(cls, value: str) -> str:
        return str(Path(value).expanduser())

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_extension_list(self) -> list[str]:
        return [ext.strip().lower() for ext in self.allowed_extensions.split(",") if ext.strip()]

    @property
    def storage_path(self) -> Path:
        return Path(self.storage_dir)

    @property
    def uploads_path(self) -> Path:
        return self.storage_path / "uploads"

    @property
    def resolved_database_url(self) -> str:
        """Make relative sqlite paths absolute so the app works from any cwd."""
        url = self.database_url
        prefix = "sqlite:///"
        if url.startswith(prefix):
            raw = url[len(prefix):]
            if raw and not raw.startswith(":memory:") and not Path(raw).is_absolute():
                path = (BACKEND_ROOT / raw).resolve()
                path.parent.mkdir(parents=True, exist_ok=True)
                return prefix + path.as_posix()
        return url

    @property
    def is_sqlite(self) -> bool:
        return self.resolved_database_url.startswith("sqlite")

    @property
    def effective_llm_provider(self) -> str:
        if self.llm_provider != "auto":
            return self.llm_provider
        return "openai_compatible" if self.platform_llm_api_key.strip() else "mock"

    @property
    def effective_embedding_provider(self) -> str:
        if self.embedding_provider != "auto":
            return self.embedding_provider
        return "openai_compatible" if self.platform_embedding_api_key.strip() else "mock"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
