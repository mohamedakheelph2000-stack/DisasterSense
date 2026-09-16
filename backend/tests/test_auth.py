"""
Authentication and security tests.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User


def test_register_user(db_client: TestClient, db_session: Session):
    response = db_client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "full_name": "New User",
            "plain_password": "supersecurepassword123",
            "role": "citizen"
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["role"] == "citizen"
    assert "hashed_password" not in data

    # Verify in DB
    user = db_session.query(User).filter_by(email="newuser@example.com").first()
    assert user is not None
    assert verify_password("supersecurepassword123", user.hashed_password)


def test_login_user(db_client: TestClient, test_user_citizen: User):
    # test_user_citizen has password "password"
    response = db_client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user_citizen.email,
            "password": "password"
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_user_incorrect_password(db_client: TestClient, test_user_citizen: User):
    response = db_client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user_citizen.email,
            "password": "wrongpassword"
        },
    )
    assert response.status_code == 400


def test_get_me(auth_client_citizen: TestClient, test_user_citizen: User):
    response = auth_client_citizen.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == test_user_citizen.email


def test_rbac_citizen_access_denied_to_admin_route(auth_client_citizen: TestClient):
    # Citizen trying to access users (Admin only)
    response = auth_client_citizen.get("/api/v1/users")
    assert response.status_code == 403


def test_rbac_admin_access_allowed_to_admin_route(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/users")
    assert response.status_code == 200
