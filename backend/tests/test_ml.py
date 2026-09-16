import pytest
from fastapi.testclient import TestClient

def test_ml_status_admin_allowed(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/ml/status")
    assert response.status_code == 200
    data = response.json()
    assert "flood" in data
    assert "landslide" in data
    assert data["flood"]["loaded"] is True
    assert data["landslide"]["loaded"] is True

def test_ml_status_citizen_denied(auth_client_citizen: TestClient):
    response = auth_client_citizen.get("/api/v1/ml/status")
    assert response.status_code == 403

def test_ml_evaluation_flood(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/ml/evaluation/flood")
    assert response.status_code == 200
    data = response.json()
    assert data["hazard"] == "flood"
    assert "metrics" in data
    assert "feature_importance" in data
    assert isinstance(data["feature_importance"], list)

def test_ml_evaluation_landslide(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/ml/evaluation/landslide")
    assert response.status_code == 200
    data = response.json()
    assert data["hazard"] == "landslide"
    assert "metrics" in data

def test_ml_evaluation_invalid_hazard(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/ml/evaluation/earthquake")
    assert response.status_code == 400

def test_ml_experiments_flood(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/ml/experiments/flood")
    assert response.status_code == 200
    data = response.json()
    assert data["hazard"] == "flood"
    assert "models" in data
    assert isinstance(data["models"], list)

def test_ml_no_path_leakage(auth_client_admin: TestClient):
    response = auth_client_admin.get("/api/v1/ml/evaluation/flood")
    data = response.json()
    str_data = str(data).lower()
    assert "d:\\" not in str_data
    assert "c:\\" not in str_data
    assert ".joblib" not in str_data

def test_ml_missing_evaluation_artifact(auth_client_admin: TestClient, monkeypatch):
    from app.api.v1 import ml
    monkeypatch.setattr(ml, "load_meta_file", lambda x: None)
    response = auth_client_admin.get("/api/v1/ml/evaluation/flood")
    assert response.status_code == 404
