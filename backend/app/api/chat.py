"""Owner playground chat endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.errors import NotFoundError, UpstreamError, ValidationAppError
from app.models import Agent, Conversation
from app.models.conversation import ConversationChannel
from app.repositories.conversation_repository import create_conversation, list_messages
from app.schemas.chat import ChatRequest, ChatResponse, MessageOut, SourceOut
from app.services.llm_service import LLMError
from app.services.rag_service import answer_question
from app.utils.message_mapper import to_message_out

router = APIRouter(prefix="/agents", tags=["chat"])


@router.post("/{agent_id}/chat", response_model=ChatResponse)
def chat(agent_id: str, payload: ChatRequest, user: CurrentUser, db: DbSession) -> ChatResponse:
    agent = db.get(Agent, agent_id)
    if agent is None or agent.user_id != user.id:
        raise NotFoundError("Agent not found")

    message = payload.message.strip()
    if not message:
        raise ValidationAppError("Message must not be empty.")
    if len(message) > settings.max_user_message_chars:
        raise ValidationAppError(f"Message is too long (max {settings.max_user_message_chars} characters).")

    conversation = _resolve_conversation(db, agent, payload.conversation_id, user.id)
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
            user=user,
            top_k=payload.top_k,
            public=False,
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
            id="transient", role="assistant", content=result.content, sources=[], created_at=conversation.updated_at
        )
    else:
        message_out = to_message_out(assistant_message)

    return ChatResponse(
        conversation_id=conversation.id,
        message=message_out,
        sources=[SourceOut(**source) for source in result.sources],
        mode=result.mode,
        model=result.model,
        degraded=result.degraded,
        notice=result.notice,
    )


def _resolve_conversation(
    db, agent: Agent, conversation_id: str | None, user_id: str
) -> Conversation:
    if conversation_id:
        conversation = db.get(Conversation, conversation_id)
        if (
            conversation is None
            or conversation.agent_id != agent.id
            or conversation.user_id != user_id
            or conversation.channel != ConversationChannel.PLAYGROUND
        ):
            raise NotFoundError("Conversation not found")
        return conversation
    return create_conversation(
        db,
        agent.id,
        user_id=user_id,
        visitor_id=None,
        channel=ConversationChannel.PLAYGROUND,
    )
