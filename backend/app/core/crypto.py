"""Server-side encryption for user supplied API keys."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(f"pai-llm-key::{settings.secret_key}".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Stored API key cannot be decrypted (SECRET_KEY changed?)") from exc


def mask_secret(secret: str | None) -> str:
    """Return a display-safe hint, never the full key."""
    if not secret:
        return ""
    if len(secret) <= 8:
        return "****"
    return f"{secret[:3]}...{secret[-2:]}"
