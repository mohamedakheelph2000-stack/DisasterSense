from fastapi.testclient import TestClient

def test_system_telemetry_admin_allowed(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/system/status")
    assert response.status_code == 200
    data = response.json()
    assert "core_api" in data
    assert "database" in data
    assert "ml_models" in data
    assert "notifications" in data
    assert "password" not in str(data).lower()
    assert "secret" not in str(data).lower()

def test_system_telemetry_citizen_denied(auth_client_citizen: TestClient):
    response = auth_client_citizen.get("/api/v1/system/status")
    assert response.status_code == 403

def test_system_telemetry_database_status(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/system/status")
    assert response.status_code == 200
    assert response.json()["database"] == "OPERATIONAL"

def test_system_telemetry_notification_metrics(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/system/status")
    assert response.status_code == 200
    data = response.json()["notifications"]
    assert "total_deliveries_24h" in data
    assert "successful_deliveries_24h" in data
    assert "failed_deliveries_24h" in data
    assert "email_deliveries_24h" in data
    assert "sms_deliveries_24h" in data

def test_system_telemetry_ml_status(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/system/status")
    assert response.status_code == 200
    data = response.json()["ml_models"]
    assert "flood" in data
    assert "landslide" in data
    assert "loaded" in data["flood"]

def test_system_telemetry_database_unavailable(auth_client_admin: TestClient, monkeypatch):
    # Mock check_db_connection to simulate query failure
    from app.api.v1 import system
    monkeypatch.setattr(system, "check_db_connection", lambda db: False)
    
    response = auth_client_admin.get("/api/v1/system/status")
    assert response.status_code == 200
    assert response.json()["database"] == "UNAVAILABLE"
