"""Agent CRUD, always scoped to the authenticated owner."""

from __future__ import annotations

import json

from fastapi import APIRouter, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession, OwnedAgent
from app.core.errors import NotFoundError, ValidationAppError
from app.models import Agent, Conversation, Document, Message
from app.models.conversation import ConversationChannel
from app.repositories.conversation_repository import list_messages
from app.schemas.agent import AgentCreate, AgentOut, AgentUpdate
from app.schemas.chat import ConversationOut, ConversationListOut, MessageOut, SourceOut
from app.services.agent_service import generate_unique_slug

router = APIRouter(prefix="/agents", tags=["agents"])


def _document_count(db: Session, agent_id: str) -> int:
    return db.query(Document).filter(Document.agent_id == agent_id).count()


def _to_agent_out(db: Session, agent: Agent) -> AgentOut:
    payload = AgentOut.model_validate(agent)
    payload.document_count = _document_count(db, agent.id)
    payload.public_path = f"/a/{agent.slug}"
    return payload


def _validate_avatar(avatar_url: str) -> str:
    value = (avatar_url or "").strip()
    if value and not (value.startswith("http://") or value.startswith("https://") or value.startswith("/")):
        raise ValidationAppError("Avatar URL must start with http://, https:// or /")
    return value


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, user: CurrentUser, db: DbSession) -> AgentOut:
    agent = Agent(
        user_id=user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        system_prompt=payload.system_prompt.strip(),
        avatar_url=_validate_avatar(payload.avatar_url),
        slug=generate_unique_slug(db, payload.name),
        is_public=payload.is_public,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return _to_agent_out(db, agent)


@router.get("", response_model=list[AgentOut])
def list_agents(user: CurrentUser, db: DbSession) -> list[AgentOut]:
    agents = (
        db.query(Agent)
        .filter(Agent.user_id == user.id)
        .order_by(Agent.created_at.desc())
        .all()
    )
    return [_to_agent_out(db, agent) for agent in agents]


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(agent: OwnedAgent, db: DbSession) -> AgentOut:
    return _to_agent_out(db, agent)


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: str, payload: AgentUpdate, user: CurrentUser, db: DbSession) -> AgentOut:
    agent = db.get(Agent, agent_id)
    if agent is None or agent.user_id != user.id:
        raise NotFoundError("Agent not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise ValidationAppError("Agent name must not be blank")
        agent.name = name
    if "description" in data and data["description"] is not None:
        agent.description = data["description"].strip()
    if "system_prompt" in data and data["system_prompt"] is not None:
        agent.system_prompt = data["system_prompt"].strip()
    if "avatar_url" in data and data["avatar_url"] is not None:
        agent.avatar_url = _validate_avatar(data["avatar_url"])
    if "is_public" in data and data["is_public"] is not None:
        agent.is_public = bool(data["is_public"])

    db.add(agent)
    db.commit()
    db.refresh(agent)
    return _to_agent_out(db, agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_agent(agent_id: str, user: CurrentUser, db: DbSession):
    agent = db.get(Agent, agent_id)
    if agent is None or agent.user_id != user.id:
        raise NotFoundError("Agent not found")
    db.delete(agent)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{agent_id}/conversations", response_model=ConversationListOut)
def list_conversations(agent_id: str, user: CurrentUser, db: DbSession) -> ConversationListOut:
    agent = db.get(Agent, agent_id)
    if agent is None or agent.user_id != user.id:
        raise NotFoundError("Agent not found")
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.agent_id == agent.id,
            Conversation.user_id == user.id,
            Conversation.channel == ConversationChannel.PLAYGROUND,
        )
        .order_by(Conversation.updated_at.desc())
        .limit(30)
        .all()
    )
    items: list[ConversationOut] = []
    for conversation in conversations:
        messages = list_messages(db, conversation.id)
        items.append(
            ConversationOut(
                id=conversation.id,
                agent_id=conversation.agent_id,
                channel=conversation.channel,
                created_at=conversation.created_at,
                updated_at=conversation.updated_at,
                messages=[_to_message_out(message) for message in messages],
            )
        )
    return ConversationListOut(items=items, total=len(items))


@router.get("/{agent_id}/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    agent_id: str, conversation_id: str, user: CurrentUser, db: DbSession
) -> ConversationOut:
    agent = db.get(Agent, agent_id)
    if agent is None or agent.user_id != user.id:
        raise NotFoundError("Agent not found")
    conversation = db.get(Conversation, conversation_id)
    if (
        conversation is None
        or conversation.agent_id != agent.id
        or conversation.user_id != user.id
    ):
        raise NotFoundError("Conversation not found")
    messages = list_messages(db, conversation.id)
    return ConversationOut(
        id=conversation.id,
        agent_id=conversation.agent_id,
        channel=conversation.channel,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[_to_message_out(message) for message in messages],
    )


def _to_message_out(message: Message) -> MessageOut:
    try:
        raw_sources = json.loads(message.sources_json or "[]")
    except ValueError:
        raw_sources = []
    sources = [
        SourceOut(
            document_id=item.get("document_id", ""),
            filename=item.get("filename", ""),
            chunk_index=int(item.get("chunk_index", 0)),
            score=float(item.get("score", 0.0)),
            excerpt=item.get("excerpt", ""),
        )
        for item in raw_sources
        if isinstance(item, dict)
    ]
    return MessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        sources=sources,
        created_at=message.created_at,
    )
