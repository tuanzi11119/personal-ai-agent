"""Shared FastAPI dependencies: authentication and resource ownership."""

from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AuthError, NotFoundError
from app.core.security import decode_access_token
from app.models import Agent, Document, User

DbSession = Annotated[Session, Depends(get_db)]


def _extract_token(request: Request, authorization: str | None, cookie_token: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    if cookie_token:
        return cookie_token
    return request.cookies.get(settings.cookie_name)


def get_current_user(
    request: Request,
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
    cookie_token: Annotated[str | None, Cookie(alias="pai_token")] = None,
) -> User:
    token = _extract_token(request, authorization, cookie_token)
    if not token:
        raise AuthError("Not authenticated. Please sign in.")
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise AuthError("Session is invalid or expired. Please sign in again.")
    user = db.get(User, payload["sub"])
    if user is None:
        raise AuthError("Account no longer exists.")
    return user


def get_optional_user(
    request: Request,
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
    cookie_token: Annotated[str | None, Cookie(alias="pai_token")] = None,
) -> User | None:
    token = _extract_token(request, authorization, cookie_token)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None
    return db.get(User, payload["sub"])


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def get_owned_agent(agent_id: str, user: CurrentUser, db: DbSession) -> Agent:
    """Fetch an agent enforcing ownership. Never trust the client provided id alone."""
    agent = db.get(Agent, agent_id)
    if agent is None or agent.user_id != user.id:
        raise NotFoundError("Agent not found")
    return agent


def get_owned_document(document_id: str, agent: Agent, db: DbSession) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.agent_id != agent.id:
        raise NotFoundError("Document not found")
    return document


OwnedAgent = Annotated[Agent, Depends(get_owned_agent)]
