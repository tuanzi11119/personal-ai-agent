"""Upload validation, parsing, chunking and indexing."""

from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, ConflictError, NotFoundError, ValidationAppError
from app.core.logging import get_logger, redact_secrets
from app.models import Agent, Document, DocumentChunk
from app.models.document import DocumentStatus
from app.services.chunking import chunk_text
from app.services.embedding_service import EmbeddingConfig, embed_texts, resolve_embedding_config

logger = get_logger(__name__)

_SAFE_NAME = re.compile(r"[^\w.\-\u4e00-\u9fff]+")


class DocumentParseError(Exception):
    pass


def slugify_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    name = _SAFE_NAME.sub("_", name)[:180]
    return name or "document"


def _detect_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    mapping = {".pdf": "pdf", ".txt": "txt", ".md": "markdown", ".markdown": "markdown"}
    if suffix not in mapping:
        raise ValidationAppError(
            f"Unsupported file type '{suffix or 'unknown'}'. Allowed: {', '.join(settings.allowed_extension_list)}"
        )
    return mapping[suffix]


def validate_upload(filename: str, size: int) -> str:
    file_type = _detect_type(filename)
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if size <= 0:
        raise ValidationAppError("The uploaded file is empty.")
    if size > max_bytes:
        raise ValidationAppError(f"File is too large. Maximum size is {settings.max_upload_mb} MB.")
    return file_type


def store_upload(agent: Agent, upload: UploadFile, raw: bytes) -> Path:
    file_type = validate_upload(upload.filename or "", len(raw))
    safe_name = slugify_filename(upload.filename or "document")
    doc_id = str(uuid.uuid4())
    target_dir = settings.uploads_path / agent.id
    target_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(safe_name).suffix.lower() or (".pdf" if file_type == "pdf" else ".txt")
    target = target_dir / f"{doc_id}{suffix}"
    target.write_bytes(raw)
    return target


def parse_document(path: Path, file_type: str) -> str:
    if file_type == "pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:  # pragma: no cover
            raise DocumentParseError("PDF support is not installed (pypdf missing).") from exc
        try:
            reader = PdfReader(str(path))
            if reader.is_encrypted:
                raise DocumentParseError("The PDF is password protected and cannot be indexed.")
            pages = [page.extract_text() or "" for page in reader.pages]
        except DocumentParseError:
            raise
        except Exception as exc:  # noqa: BLE001 - third party parsers raise broadly
            raise DocumentParseError("The PDF could not be parsed. It may be corrupted or scanned.") from exc
        text = "\n\n".join(pages)
    else:
        text = _decode_text(path.read_bytes())

    if not text or not text.strip():
        raise DocumentParseError("No extractable text found. Scanned PDFs need OCR, which is not supported yet.")
    return text


def _decode_text(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def create_document_from_upload(
    db: Session, agent: Agent, upload: UploadFile, raw: bytes, user=None
) -> Document:
    if len(raw) > settings.max_upload_mb * 1024 * 1024 * 2:
        raise ValidationAppError("File is too large.")
    file_type = validate_upload(upload.filename or "", len(raw))
    content_hash = hashlib.sha256(raw).hexdigest()

    duplicate = (
        db.query(Document)
        .filter(Document.agent_id == agent.id, Document.content_hash == content_hash)
        .first()
    )
    if duplicate is not None:
        raise ConflictError(
            f"This file has already been uploaded as '{duplicate.filename}'.",
            code="duplicate_document",
        )

    path = store_upload(agent, upload, raw)
    document = Document(
        agent_id=agent.id,
        filename=slugify_filename(upload.filename or "document"),
        file_type=file_type,
        file_path=str(path),
        size_bytes=len(raw),
        content_hash=content_hash,
        status=DocumentStatus.PROCESSING,
        error_message="",
        chunk_count=0,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        text = parse_document(path, file_type)
        chunks = chunk_text(text, settings.chunk_size, settings.chunk_overlap)
        if not chunks:
            raise DocumentParseError("The document produced no indexable chunks.")
        embedding_config: EmbeddingConfig = resolve_embedding_config(db, user)
        vectors = embed_texts(chunks, embedding_config)
        for index, (content, vector) in enumerate(zip(chunks, vectors, strict=True)):
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    agent_id=agent.id,
                    content=content,
                    embedding=vector,
                    chunk_index=index,
                )
            )
        document.status = DocumentStatus.READY
        document.chunk_count = len(chunks)
        document.error_message = ""
        db.commit()
        db.refresh(document)
    except AppError:
        db.rollback()
        _mark_failed(db, document, "Indexing failed: embedding configuration error.")
        raise
    except Exception as exc:  # noqa: BLE001 - surface a safe message, keep the file for retry
        db.rollback()
        message = redact_secrets(str(exc))[:300] or type(exc).__name__
        logger.warning("document indexing failed for %s: %s", document.id, message)
        _mark_failed(db, document, message)
    return document


def _mark_failed(db: Session, document: Document, message: str) -> None:
    document.status = DocumentStatus.ERROR
    document.error_message = message
    document.chunk_count = 0
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
    db.add(document)
    db.commit()


def delete_document(db: Session, agent: Agent, document_id: str) -> None:
    document = db.get(Document, document_id)
    if document is None or document.agent_id != agent.id:
        raise NotFoundError("Document not found")
    # Vectors are removed explicitly so orphaned embeddings can never be retrieved.
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete(synchronize_session=False)
    file_path = Path(document.file_path) if document.file_path else None
    db.delete(document)
    db.commit()
    if file_path and file_path.exists():
        try:
            file_path.unlink()
        except OSError:  # pragma: no cover - best effort cleanup
            logger.warning("could not delete file %s", file_path)


def list_documents(db: Session, agent: Agent) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.agent_id == agent.id)
        .order_by(Document.created_at.desc())
        .all()
    )
