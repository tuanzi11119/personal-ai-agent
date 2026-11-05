"""Knowledge-base document endpoints."""

from __future__ import annotations

from fastapi import APIRouter, File, Response, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.errors import ValidationAppError
from app.models import Agent, Document
from app.schemas.document import DocumentListOut, DocumentOut
from app.services import document_service

router = APIRouter(prefix="/agents", tags=["documents"])


def _owned_agent(db, agent_id: str, user) -> Agent:  # noqa: ANN001
    agent = db.get(Agent, agent_id)
    if agent is None or agent.user_id != user.id:
        from app.core.errors import NotFoundError

        raise NotFoundError("Agent not found")
    return agent


@router.post(
    "/{agent_id}/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED
)
def upload_document(
    agent_id: str,
    user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> DocumentOut:
    agent = _owned_agent(db, agent_id, user)
    if not file.filename:
        raise ValidationAppError("A file name is required.")
    raw = file.file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(raw) > max_bytes:
        raise ValidationAppError(f"File is too large. Maximum size is {settings.max_upload_mb} MB.")
    document = document_service.create_document_from_upload(db, agent, file, raw, user=user)
    return DocumentOut.model_validate(document)


@router.get("/{agent_id}/documents", response_model=DocumentListOut)
def list_documents(agent_id: str, user: CurrentUser, db: DbSession) -> DocumentListOut:
    agent = _owned_agent(db, agent_id, user)
    documents = document_service.list_documents(db, agent)
    return DocumentListOut(
        items=[DocumentOut.model_validate(document) for document in documents],
        total=len(documents),
    )


@router.delete(
    "/{agent_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_document(agent_id: str, document_id: str, user: CurrentUser, db: DbSession):
    agent = _owned_agent(db, agent_id, user)
    document_service.delete_document(db, agent, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
