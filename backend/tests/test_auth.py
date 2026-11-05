"""Module A: registration, login, logout, session auth."""

from __future__ import annotations

from app.core.database import SessionLocal
from app.models import User
from conftest import new_client, signup


def test_register_sets_cookie_and_returns_user(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "Zhang San", "email": "zhang@example.com", "password": "strong-password-1"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["email"] == "zhang@example.com"
    assert body["user"]["username"] == "Zhang San"
    assert body["access_token"]
    assert "password_hash" not in response.text
    assert "pai_token" in client.cookies

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "zhang@example.com"


def test_password_is_hashed_not_plaintext(client):
    signup(client, email="hash@example.com")
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == "hash@example.com").one()
        assert user.password_hash != "correct-horse-battery"
        assert user.password_hash.startswith("$2b$")


def test_duplicate_email_is_rejected(client):
    signup(client, email="dup@example.com")
    response = client.post(
        "/api/auth/register",
        json={"username": "Other", "email": "dup@example.com", "password": "strong-password-1"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


def test_login_rejects_bad_password_and_accepts_good_one(client):
    signup(client, email="login@example.com")
    client.post("/api/auth/logout")

    bad = client.post(
        "/api/auth/login", json={"email": "login@example.com", "password": "wrong-password"}
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"

    good = client.post(
        "/api/auth/login", json={"email": "login@example.com", "password": "correct-horse-battery"}
    )
    assert good.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_logout_clears_session(client):
    signup(client, email="logout@example.com")
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_me_requires_authentication(client):
    anonymous = new_client()
    response = anonymous.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_short_password_is_rejected(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "Short", "email": "short@example.com", "password": "abc"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
