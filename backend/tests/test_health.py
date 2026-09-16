"""
Smoke tests for root and health endpoints.

Run with:
    pytest tests/test_health.py -v

No database is required — the health endpoint gracefully handles a
missing PostgreSQL connection and reports db_reachable: false.
"""

from fastapi.testclient import TestClient

from app.main import app

# Module-level client (compatible with existing test structure).
client = TestClient(app)


def test_root_responds() -> None:
    """Root URL should return 200 and confirm the API is running."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data


def test_health_endpoint_returns_ok() -> None:
    """Health endpoint should return status 'ok' regardless of DB state."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "timestamp" in data
    # db_reachable field must exist (True or False depending on environment)
    assert "db_reachable" in data


def test_health_includes_app_name() -> None:
    """Health response must include the application name."""
    response = client.get("/api/v1/health")
    data = response.json()
    assert data["app"] == "DisasterSense API"


def test_health_includes_environment() -> None:
    """Health response must include an environment field."""
    response = client.get("/api/v1/health")
    data = response.json()
    assert "environment" in data


def test_openapi_schema_accessible() -> None:
    """OpenAPI schema must be accessible (confirms all routers loaded without error)."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "paths" in schema
