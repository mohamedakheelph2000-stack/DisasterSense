import pytest
from datetime import datetime, timezone, timedelta
from app.models.disaster_event import DisasterEvent, RecordType, HazardType, SeverityLevel
from app.models.location import Location

def test_spatial_aggregation_requires_auth(client):
    response = client.get("/api/v1/spatial-risk/aggregation")
    assert response.status_code == 401

def test_spatial_aggregation_grid_and_stats(auth_client_admin, db_session):
    now = datetime.now(timezone.utc)
    
    # Create location 1 at 12.11, 77.51 (Cell 12.125, 77.525 if CELL_SIZE=0.05)
    # Math: floor(12.11 / 0.05) * 0.05 = floor(242.2) * 0.05 = 242 * 0.05 = 12.10
    # Center = 12.10 + 0.025 = 12.125
    loc1 = Location(name="Test Loc 1", latitude=12.11, longitude=77.51, country="India")
    
    # Create location 2 at 12.14, 77.54 (Same cell)
    # floor(12.14 / 0.05) * 0.05 = floor(242.8) * 0.05 = 242 * 0.05 = 12.10. Center = 12.125
    loc2 = Location(name="Test Loc 2", latitude=12.14, longitude=77.54, country="India")
    
    # Create location 3 at 12.20, 77.60 (Different cell)
    # floor(12.20 / 0.05) = 244. Center = 12.20 + 0.025 = 12.225
    loc3 = Location(name="Test Loc 3", latitude=12.20, longitude=77.60, country="India")
    
    db_session.add_all([loc1, loc2, loc3])
    db_session.commit()
    
    # Create predictive events in loc1 and loc2
    e1 = DisasterEvent(
        location_id=loc1.id, hazard_type="flood", severity=SeverityLevel.MODERATE,
        record_type=RecordType.PREDICTIVE, risk_score=0.5, event_time=now,
        model_version="v1", data_source="source A"
    )
    e2 = DisasterEvent(
        location_id=loc2.id, hazard_type="flood", severity=SeverityLevel.HIGH,
        record_type=RecordType.PREDICTIVE, risk_score=0.8, event_time=now - timedelta(hours=1),
        model_version="v1", data_source="source B"
    )
    e3 = DisasterEvent(
        location_id=loc3.id, hazard_type="landslide", severity=SeverityLevel.MODERATE,
        record_type=RecordType.PREDICTIVE, risk_score=0.6, event_time=now,
        model_version="v1", data_source="source C"
    )
    # Demo event, should be excluded by default
    e4 = DisasterEvent(
        location_id=loc1.id, hazard_type="flood", severity=SeverityLevel.CRITICAL,
        record_type=RecordType.DEMO, risk_score=0.95, event_time=now,
        model_version="v1"
    )
    
    db_session.add_all([e1, e2, e3, e4])
    db_session.commit()

    # Query without filters (default 7d, predictive)
    resp = auth_client_admin.get("/api/v1/spatial-risk/aggregation")
    assert resp.status_code == 200
    data = resp.json()
    
    # We should have 2 cells: one for flood (loc1, loc2), one for landslide (loc3)
    cells = data["cells"]
    assert len(cells) == 2
    
    flood_cell = next(c for c in cells if c["hazard_type"] == "flood")
    landslide_cell = next(c for c in cells if c["hazard_type"] == "landslide")
    
    # Verify flood cell stats (e1 + e2)
    assert flood_cell["assessment_count"] == 2
    assert flood_cell["average_risk"] == 0.65
    assert flood_cell["max_risk"] == 0.8
    assert flood_cell["min_risk"] == 0.5
    assert flood_cell["latest_risk"] == 0.5  # e1 is newer
    assert flood_cell["high_risk_count"] == 1
    assert flood_cell["critical_risk_count"] == 0
    assert "source A" in flood_cell["provenance"]
    assert "source B" in flood_cell["provenance"]
    
    # Verify grid calculation
    assert flood_cell["center_lat"] == 12.125
    assert flood_cell["center_lon"] == 77.525
    assert landslide_cell["center_lat"] == 12.225

def test_spatial_aggregation_time_and_hazard_filters(auth_client_admin, db_session):
    now = datetime.now(timezone.utc)
    loc = Location(name="Test Loc", latitude=12.11, longitude=77.51, country="India")
    db_session.add(loc)
    db_session.commit()
    
    # Event 30 days ago
    e_old = DisasterEvent(
        location_id=loc.id, hazard_type="flood", severity=SeverityLevel.MODERATE,
        record_type=RecordType.PREDICTIVE, risk_score=0.5, event_time=now - timedelta(days=35),
        model_version="v1"
    )
    db_session.add(e_old)
    db_session.commit()
    
    # Query with 7d window (should be empty)
    resp1 = auth_client_admin.get("/api/v1/spatial-risk/aggregation?time_range=7d&hazard_type=flood")
    assert resp1.status_code == 200
    assert len(resp1.json()["cells"]) == 0
    
    # Query with all window (should have 1)
    resp2 = auth_client_admin.get("/api/v1/spatial-risk/aggregation?time_range=all&hazard_type=flood")
    assert resp2.status_code == 200
    assert len(resp2.json()["cells"]) == 1

def test_spatial_aggregation_coordinate_filters(auth_client_admin, db_session):
    now = datetime.now(timezone.utc)
    loc = Location(name="Test Loc", latitude=12.11, longitude=77.51, country="India")
    db_session.add(loc)
    db_session.commit()
    
    e1 = DisasterEvent(
        location_id=loc.id, hazard_type="flood", severity=SeverityLevel.MODERATE,
        record_type=RecordType.PREDICTIVE, risk_score=0.5, event_time=now,
        model_version="v1"
    )
    db_session.add(e1)
    db_session.commit()
    
    # Query outside bounding box
    resp1 = auth_client_admin.get("/api/v1/spatial-risk/aggregation?min_lat=13.0&max_lat=14.0")
    assert resp1.status_code == 200
    assert len(resp1.json()["cells"]) == 0
    
    # Query inside bounding box
    resp2 = auth_client_admin.get("/api/v1/spatial-risk/aggregation?min_lat=12.0&max_lat=13.0")
    assert resp2.status_code == 200
    assert len(resp2.json()["cells"]) >= 1
