from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.security import create_access_token
from app.models.emergency_resource import EmergencyResource, ResourceType, VerificationStatus
from app.models.disaster_event import RecordType

def test_resources_requires_auth(client: TestClient):
    resp = client.get("/api/v1/resources")
    assert resp.status_code == 401

def test_get_resources_empty(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    resp = db_client.get("/api/v1/resources", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0

def test_get_resources_with_data(db_client: TestClient, db_session: Session, test_user_citizen):
    resource = EmergencyResource(
        name="Central Hospital",
        resource_type=ResourceType.HOSPITAL,
        latitude=10.0,
        longitude=76.0,
        source="Official",
        verification_status=VerificationStatus.VERIFIED,
        record_type=RecordType.HISTORICAL
    )
    db_session.add(resource)
    db_session.commit()
    
    token = create_access_token(subject=test_user_citizen.id)
    resp = db_client.get("/api/v1/resources", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(r["name"] == "Central Hospital" for r in data["items"])

def test_get_resources_proximity(db_client: TestClient, db_session: Session, test_user_citizen):
    resource = EmergencyResource(
        name="Nearby Shelter",
        resource_type=ResourceType.SHELTER,
        latitude=10.0,
        longitude=76.0,
        source="Official",
        verification_status=VerificationStatus.VERIFIED,
        record_type=RecordType.HISTORICAL
    )
    db_session.add(resource)
    db_session.commit()

    token = create_access_token(subject=test_user_citizen.id)
    resp = db_client.get("/api/v1/resources?latitude=10.01&longitude=76.01&radius_km=10", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    # Math: Haversine for ~0.01 degree difference is ~1-2km, so it should be well within 10km.
    assert len(data["items"]) >= 1
    item = [x for x in data["items"] if x["name"] == "Nearby Shelter"][0]
    assert "distance_km" in item
    assert item["distance_km"] <= 10.0

def test_get_resource_by_id(db_client: TestClient, db_session: Session, test_user_citizen):
    resource = EmergencyResource(
        name="Police HQ",
        resource_type=ResourceType.POLICE_STATION,
        latitude=10.0,
        longitude=76.0,
        source="Official",
        verification_status=VerificationStatus.VERIFIED,
        record_type=RecordType.HISTORICAL
    )
    db_session.add(resource)
    db_session.commit()

    token = create_access_token(subject=test_user_citizen.id)
    resp = db_client.get(f"/api/v1/resources/{resource.id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Police HQ"

def test_get_resource_not_found(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    resp = db_client.get("/api/v1/resources/99999", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
