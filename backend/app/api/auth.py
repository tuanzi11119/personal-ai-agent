"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.errors import AuthError, ConflictError, RateLimitError, ValidationAppError
from app.core.rate_limit import RateLimiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

_auth_limiter = RateLimiter(settings.auth_rate_limit_per_minute, 60)


def _client_key(request: Request, bucket: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{bucket}:{host}"


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        samesite=settings.cookie_samesite,
        secure=settings.cookie_secure,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: DbSession,
) -> AuthResponse:
    allowed, retry_after = _auth_limiter.check(_client_key(request, "register"))
    if not allowed:
        raise RateLimitError(f"Too many sign-up attempts. Retry in {retry_after}s.")

    email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise ConflictError("An account with this email already exists.", code="email_taken")

    user = User(
        email=email,
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: DbSession) -> AuthResponse:
    allowed, retry_after = _auth_limiter.check(_client_key(request, "login"))
    if not allowed:
        raise RateLimitError(f"Too many sign-in attempts. Retry in {retry_after}s.")

    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AuthError("Invalid email or password.", code="invalid_credentials")

    token = create_access_token(user.id)
    _set_auth_cookie(response, token)
    return AuthResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=204, response_class=Response)
def logout(response: Response):
    response.delete_cookie(settings.cookie_name, path="/")
    response.status_code = 204
    return response


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
