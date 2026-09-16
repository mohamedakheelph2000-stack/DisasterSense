from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.disaster_event import DisasterEvent, HazardType, SeverityLevel, RecordType
from app.models.location import Location
from app.core.security import create_access_token

def test_analytics_trends_returns_data(db_client: TestClient, db_session: Session, test_user_citizen):
    now = datetime.now(timezone.utc)
    
    event1 = DisasterEvent(
        location_id=1,
        hazard_type=HazardType.FLOOD,
        severity=SeverityLevel.HIGH,
        risk_score=0.85,
        model_version="flood_v1",
        event_time=now - timedelta(days=2),
        record_type=RecordType.PREDICTIVE
    )
    event2 = DisasterEvent(
        location_id=1,
        hazard_type=HazardType.LANDSLIDE,
        severity=SeverityLevel.CRITICAL,
        risk_score=0.95,
        model_version="landslide_v1",
        event_time=now - timedelta(days=2),
        record_type=RecordType.PREDICTIVE
    )
    
    db_session.add(event1)
    db_session.add(event2)
    db_session.commit()

    token = create_access_token(subject=test_user_citizen.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    response = db_client.get("/api/v1/analytics/trends?days=7", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 7
    
    target_date = (now - timedelta(days=2)).date().isoformat()
    found = False
    for item in data["items"]:
        if item["date"] == target_date:
            found = True
            assert item["flood_max_risk"] == 85.0
            assert item["landslide_max_risk"] == 95.0
            assert item["predictive_assessments"] >= 2
    assert found

def test_analytics_requires_auth(client: TestClient):
    endpoints = [
        "/api/v1/analytics/summary",
        "/api/v1/analytics/hazard-comparison",
        "/api/v1/analytics/severity-distribution",
        "/api/v1/analytics/geographic",
        "/api/v1/analytics/data-quality",
        "/api/v1/analytics/trends"
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 401

def test_analytics_time_ranges(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    for days in [7, 30, 90, 365]:
        resp = db_client.get(f"/api/v1/analytics/summary?days={days}", headers=headers)
        assert resp.status_code == 200
        
        resp = db_client.get(f"/api/v1/analytics/trends?days={days}", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == days

def test_get_analytics_summary(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    response = db_client.get("/api/v1/analytics/summary", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "total_historical_events" in data

def test_get_hazard_comparison(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    response = db_client.get("/api/v1/analytics/hazard-comparison", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "flood_events" in data

def test_get_severity_distribution(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    response = db_client.get("/api/v1/analytics/severity-distribution", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "historical" in data
    assert "predictive" in data

def test_get_geographic(db_client: TestClient, test_user_citizen, db_session: Session):
    # Ensure missing coords are handled gracefully by Data Quality
    loc = Location(name="Unknown", latitude=0.0, longitude=0.0)
    db_session.add(loc)
    db_session.commit()
    
    token = create_access_token(subject=test_user_citizen.id)
    
    response = db_client.get("/api/v1/analytics/geographic", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "locations" in data

    resp_dq = db_client.get("/api/v1/analytics/data-quality", headers={"Authorization": f"Bearer {token}"})
    assert resp_dq.status_code == 200
    dq_data = resp_dq.json()
    assert dq_data["records_missing_coordinates"] >= 1

def test_get_data_quality(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    response = db_client.get("/api/v1/analytics/data-quality", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "total_records" in data
