"""Public (unauthenticated) agent access.

Security properties:
* only agents with is_public=True are reachable;
* private agents return 404 (not 403) so they are indistinguishable from missing;
* every public conversation is bound to an opaque visitor cookie; a visitor can
  only continue conversations they created;
* rate limited per IP + slug, and token/context budgets are capped.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import settings
from app.core.errors import NotFoundError, RateLimitError, UpstreamError, ValidationAppError
from app.core.rate_limit import RateLimiter
from app.models import Agent, Conversation
from app.models.conversation import ConversationChannel
from app.repositories.conversation_repository import create_conversation, list_messages
from app.schemas.agent import PublicAgentOut
from app.schemas.chat import ChatRequest, ChatResponse, ConversationOut, MessageOut, SourceOut
from app.services.agent_service import suggested_questions_for
from app.services.llm_service import LLMError
from app.services.rag_service import answer_question
from app.utils.message_mapper import to_message_out

router = APIRouter(prefix="/public", tags=["public"])

_public_limiter = RateLimiter(settings.public_rate_limit_per_minute, 60)
_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30


def _client_host(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def get_public_agent(db: Session, slug: str) -> Agent:
    agent = db.query(Agent).filter(Agent.slug == slug).first()
    if agent is None or not agent.is_public:
        raise NotFoundError("Agent not found")
    return agent


@router.get("/agents/{slug}", response_model=PublicAgentOut)
def get_public_agent_profile(slug: str, db: DbSession) -> PublicAgentOut:
    agent = get_public_agent(db, slug)
    return PublicAgentOut(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        avatar_url=agent.avatar_url,
        slug=agent.slug,
        suggested_questions=suggested_questions_for(agent),
    )


@router.post("/agents/{slug}/chat", response_model=ChatResponse)
def public_chat(
    slug: str,
    payload: ChatRequest,
    request: Request,
    response: Response,
    db: DbSession,
    visitor_cookie: Annotated[str | None, Cookie(alias="pai_visitor")] = None,
) -> ChatResponse:
    agent = get_public_agent(db, slug)

    allowed, retry_after = _public_limiter.check(f"public-chat:{_client_host(request)}:{slug}")
    if not allowed:
        raise RateLimitError(
            f"Too many messages. Please wait {retry_after}s before trying again.", code="rate_limited"
        )

    message = payload.message.strip()
    if not message:
        raise ValidationAppError("Message must not be empty.")
    if len(message) > settings.max_user_message_chars:
        raise ValidationAppError(f"Message is too long (max {settings.max_user_message_chars} characters).")

    visitor_id = (visitor_cookie or "").strip() or str(uuid.uuid4())
    if visitor_cookie != visitor_id:
        response.set_cookie(
            key=settings.visitor_cookie_name,
            value=visitor_id,
            httponly=True,
            samesite=settings.cookie_samesite,
            secure=settings.cookie_secure,
            max_age=_VISITOR_COOKIE_MAX_AGE,
            path="/",
        )

    conversation = _resolve_guest_conversation(db, agent, payload.conversation_id, visitor_id)
    if not conversation.title:
        conversation.title = message[:120]
        db.add(conversation)
        db.commit()

    try:
        result = answer_question(
            db,
            agent,
            message,
            conversation=conversation,
            user=None,
            top_k=payload.top_k,
            public=True,
        )
    except LLMError as exc:
        raise UpstreamError(str(exc), code="llm_error") from exc

    assistant_message = None
    for item in reversed(list_messages(db, conversation.id)):
        if item.role == "assistant":
            assistant_message = item
            break

    if assistant_message is None:
        message_out = MessageOut(
            id="transient",
            role="assistant",
            content=result.content,
            sources=[],
            created_at=datetime.now(timezone.utc),
        )
    else:
        message_out = to_message_out(assistant_message)

    return ChatResponse(
        conversation_id=conversation.id,
        message=message_out,
        sources=[SourceOut(**source) for source in result.sources],
        mode=result.mode,
        model=None if result.mode == "mock" else result.model,
        degraded=result.degraded,
        notice=result.notice,
    )


@router.get("/agents/{slug}/conversations/{conversation_id}", response_model=ConversationOut)
def get_guest_conversation(
    slug: str,
    conversation_id: str,
    db: DbSession,
    visitor_cookie: Annotated[str | None, Cookie(alias="pai_visitor")] = None,
) -> ConversationOut:
    agent = get_public_agent(db, slug)
    conversation = db.get(Conversation, conversation_id)
    if (
        conversation is None
        or conversation.agent_id != agent.id
        or conversation.channel != ConversationChannel.PUBLIC
        or not visitor_cookie
        or conversation.visitor_id != visitor_cookie
    ):
        raise NotFoundError("Conversation not found")
    messages = list_messages(db, conversation.id)
    return ConversationOut(
        id=conversation.id,
        agent_id=conversation.agent_id,
        channel=conversation.channel,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[to_message_out(message) for message in messages],
    )


def _resolve_guest_conversation(
    db: Session, agent: Agent, conversation_id: str | None, visitor_id: str
) -> Conversation:
    if conversation_id:
        conversation = db.get(Conversation, conversation_id)
        if (
            conversation is None
            or conversation.agent_id != agent.id
            or conversation.channel != ConversationChannel.PUBLIC
            or conversation.visitor_id != visitor_id
            or conversation.user_id is not None
        ):
            raise NotFoundError("Conversation not found")
        return conversation
    return create_conversation(
        db,
        agent.id,
        user_id=None,
        visitor_id=visitor_id,
        channel=ConversationChannel.PUBLIC,
    )
