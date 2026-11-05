"""Per-user LLM / embedding configuration endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret, mask_secret
from app.core.errors import UpstreamError
from app.models import UserLLMConfig
from app.schemas.llm_settings import LLMSettingsIn, LLMSettingsOut, TestConnectionResult
from app.services.llm_service import LLMError, chat_completion, resolve_llm_config

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create(db, user_id: str) -> UserLLMConfig:  # noqa: ANN001
    config = db.query(UserLLMConfig).filter(UserLLMConfig.user_id == user_id).first()
    if config is None:
        config = UserLLMConfig(user_id=user_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _to_out(config: UserLLMConfig) -> LLMSettingsOut:
    api_key = ""
    embedding_key = ""
    try:
        api_key = decrypt_secret(config.api_key_encrypted)
        embedding_key = decrypt_secret(config.embedding_api_key_encrypted)
    except ValueError:
        pass
    return LLMSettingsOut(
        has_custom_config=bool(config.model_name and config.api_key_encrypted),
        base_url=config.base_url,
        model_name=config.model_name,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        api_key_hint=mask_secret(api_key),
        has_api_key=bool(config.api_key_encrypted),
        embedding_base_url=config.embedding_base_url,
        embedding_model=config.embedding_model,
        embedding_dimension=config.embedding_dimension,
        embedding_api_key_hint=mask_secret(embedding_key),
        has_embedding_api_key=bool(config.embedding_api_key_encrypted),
        updated_at=config.updated_at,
        platform_mode=settings.effective_llm_provider,
        platform_embedding_mode=settings.effective_embedding_provider,
        configured_dimension=settings.embedding_dimension,
    )


@router.get("/llm", response_model=LLMSettingsOut)
def get_llm_settings(user: CurrentUser, db: DbSession) -> LLMSettingsOut:
    config = _get_or_create(db, user.id)
    return _to_out(config)


@router.put("/llm", response_model=LLMSettingsOut)
def update_llm_settings(payload: LLMSettingsIn, user: CurrentUser, db: DbSession) -> LLMSettingsOut:
    config = _get_or_create(db, user.id)
    config.base_url = payload.base_url.strip()
    config.model_name = payload.model_name.strip()
    config.temperature = payload.temperature
    config.max_tokens = payload.max_tokens
    if payload.api_key is not None:
        config.api_key_encrypted = encrypt_secret(payload.api_key.strip()) if payload.api_key.strip() else ""

    config.embedding_base_url = payload.embedding_base_url.strip()
    config.embedding_model = payload.embedding_model.strip()
    if payload.embedding_dimension is not None:
        config.embedding_dimension = payload.embedding_dimension
    if payload.embedding_api_key is not None:
        config.embedding_api_key_encrypted = (
            encrypt_secret(payload.embedding_api_key.strip()) if payload.embedding_api_key.strip() else ""
        )
    db.add(config)
    db.commit()
    db.refresh(config)
    return _to_out(config)


@router.post("/llm/test", response_model=TestConnectionResult)
def test_llm_connection(user: CurrentUser, db: DbSession) -> TestConnectionResult:
    config = resolve_llm_config(db, user)
    if config.is_mock:
        return TestConnectionResult(
            ok=True,
            mode="mock",
            model=None,
            detail="Mock 模式已启用（未配置大模型 API Key），回答内容为知识库原文摘录。",
        )
    try:
        result = chat_completion(
            [
                {"role": "system", "content": "You are a connectivity probe. Reply with: ok"},
                {"role": "user", "content": "ping"},
            ],
            config,
        )
        return TestConnectionResult(
            ok=True, mode=result.mode, model=result.model, detail=f"连接成功：{result.content[:120]}"
        )
    except LLMError as exc:
        raise UpstreamError(str(exc), code="llm_error") from exc
