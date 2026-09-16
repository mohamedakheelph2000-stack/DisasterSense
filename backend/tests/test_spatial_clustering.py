import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app.models.disaster_event import DisasterEvent, SeverityLevel
from app.models.location import Location

def test_spatial_clustering_requires_auth(client: TestClient):
    response = client.get("/api/v1/spatial-risk/clusters?time_range=7d&record_type=predictive")
    assert response.status_code == 401

def test_spatial_clustering_hazard_separation(auth_client_admin: TestClient, db_session: Session):
    now = datetime.now(timezone.utc)
    
    loc1 = Location(latitude=10.0, longitude=10.0, name="Test")
    db_session.add(loc1)
    db_session.commit()

    # Create two events at the exact same location, but different hazards
    ev1 = DisasterEvent(
        hazard_type="flood",
        event_time=now,
        location_id=loc1.id,
        severity=SeverityLevel.CRITICAL,
        risk_score=90.0,
        record_type="PREDICTIVE",
        model_version="v1"
    )
    ev2 = DisasterEvent(
        hazard_type="landslide",
        event_time=now,
        location_id=loc1.id,
        severity=SeverityLevel.CRITICAL,
        risk_score=85.0,
        record_type="PREDICTIVE",
        model_version="v1"
    )
    db_session.add(ev1)
    db_session.add(ev2)
    db_session.commit()

    resp = auth_client_admin.get("/api/v1/spatial-risk/clusters?time_range=24h&record_type=predictive")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["clusters"]) == 2
    
    hazards = [c["hazard_type"] for c in data["clusters"]]
    assert "flood" in hazards
    assert "landslide" in hazards

def test_spatial_clustering_distance_threshold(auth_client_admin: TestClient, db_session: Session):
    now = datetime.now(timezone.utc)
    
    # Very close (should cluster if spatial threshold is 10km)
    loc1 = Location(latitude=10.0, longitude=10.0, name="A")
    loc2 = Location(latitude=10.01, longitude=10.01, name="B") # ~1.5km away
    
    # Far away (should not cluster)
    loc3 = Location(latitude=12.0, longitude=12.0, name="C") # > 200km away
    
    db_session.add_all([loc1, loc2, loc3])
    db_session.commit()

    ev1 = DisasterEvent(hazard_type="flood", event_time=now, location_id=loc1.id, severity=SeverityLevel.HIGH, risk_score=80.0, record_type="PREDICTIVE", model_version="v1")
    ev2 = DisasterEvent(hazard_type="flood", event_time=now, location_id=loc2.id, severity=SeverityLevel.HIGH, risk_score=75.0, record_type="PREDICTIVE", model_version="v1")
    ev3 = DisasterEvent(hazard_type="flood", event_time=now, location_id=loc3.id, severity=SeverityLevel.HIGH, risk_score=70.0, record_type="PREDICTIVE", model_version="v1")
    db_session.add_all([ev1, ev2, ev3])
    db_session.commit()

    resp = auth_client_admin.get("/api/v1/spatial-risk/clusters?time_range=24h&record_type=predictive")
    assert resp.status_code == 200
    data = resp.json()
    
    assert len(data["clusters"]) == 2
    
    cluster_sizes = sorted([c["member_count"] for c in data["clusters"]])
    assert cluster_sizes == [1, 2]

def test_escalate_cluster_requires_auth(client: TestClient):
    response = client.post("/api/v1/spatial-risk/clusters/cluster_abc/escalate", json={"member_ids": [1], "severity": "HIGH", "hazard_type": "flood", "record_type": "predictive"})
    assert response.status_code == 401

def test_escalate_cluster_citizen_forbidden(auth_client_citizen: TestClient):
    response = auth_client_citizen.post("/api/v1/spatial-risk/clusters/cluster_abc/escalate", json={"member_ids": [1], "severity": "HIGH", "hazard_type": "flood", "record_type": "predictive"})
    assert response.status_code == 403

def test_escalate_cluster_invalid_severity(auth_client_admin: TestClient):
    response = auth_client_admin.post("/api/v1/spatial-risk/clusters/cluster_abc/escalate", json={"member_ids": [1], "severity": "INVALID", "hazard_type": "flood", "record_type": "predictive"})
    assert response.status_code == 400

def test_escalate_cluster_demo_forbidden(auth_client_admin: TestClient):
    response = auth_client_admin.post("/api/v1/spatial-risk/clusters/cluster_abc/escalate", json={"member_ids": [1], "severity": "HIGH", "hazard_type": "flood", "record_type": "demo"})
    assert response.status_code == 400

def test_spatial_clustering_quality_indicators(auth_client_admin: TestClient, db_session: Session):
    now = datetime.now(timezone.utc)
    
    loc1 = Location(latitude=15.0, longitude=15.0, name="A")
    db_session.add(loc1)
    db_session.commit()

    # Create 11 events at same location to hit WELL_SUPPORTED
    events = []
    for _ in range(11):
        events.append(DisasterEvent(
            hazard_type="landslide",
            event_time=now,
            location_id=loc1.id,
            severity=SeverityLevel.MODERATE,
            risk_score=50.0,
            record_type="PREDICTIVE",
            model_version="v1"
        ))
    db_session.add_all(events)
    db_session.commit()

    resp = auth_client_admin.get("/api/v1/spatial-risk/clusters?time_range=24h&record_type=predictive&hazard_type=landslide")
    assert resp.status_code == 200
    data = resp.json()
    
    assert len(data["clusters"]) == 1
    assert data["clusters"][0]["quality_indicator"] == "WELL_SUPPORTED"
    assert data["clusters"][0]["member_count"] >= 11
