import pytest
from app.models.ml_feedback import MLFeedback, ReviewStatus, FeedbackType
from app.models.dataset_candidate import DatasetCandidate

def test_submit_feedback_citizen(auth_client_citizen):
    # Submit as citizen
    response = auth_client_citizen.post(
        "/api/v1/ml/governance/feedback",
        json={
            "hazard_type": "flood",
            "feedback_type": "confirmed_event", # Should be forced to uncertain
            "observed_outcome": "I saw water"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["feedback_type"] == "uncertain"
    assert data["review_status"] == "submitted"


def test_submit_feedback_admin(auth_client_admin):
    # Submit as admin
    response = auth_client_admin.post(
        "/api/v1/ml/governance/feedback",
        json={
            "hazard_type": "landslide",
            "feedback_type": "confirmed_event",
            "observed_outcome": "Road blocked",
            "feature_snapshot": {"rainfall_mm_24h": 150}
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["feedback_type"] == "confirmed_event"
    assert data["feature_snapshot"]["rainfall_mm_24h"] == 150


def test_list_feedback_citizen_denied(auth_client_citizen):
    # Citizen denied
    resp_user = auth_client_citizen.get("/api/v1/ml/governance/feedback")
    assert resp_user.status_code == 403
    

def test_list_feedback_admin_allowed(auth_client_admin):
    # Admin allowed
    resp_admin = auth_client_admin.get("/api/v1/ml/governance/feedback")
    assert resp_admin.status_code == 200
    assert isinstance(resp_admin.json(), list)


def test_review_feedback_strict_state_machine(auth_client_admin, db_session):
    # Create feedback (starts in SUBMITTED)
    fb = auth_client_admin.post(
        "/api/v1/ml/governance/feedback",
        json={"hazard_type": "flood", "feedback_type": "uncertain"}
    ).json()
    fb_id = fb["id"]
    
    # Try invalid transition: SUBMITTED -> ACCEPTED
    resp1 = auth_client_admin.post(
        f"/api/v1/ml/governance/feedback/{fb_id}/review",
        json={"review_status": "accepted"}
    )
    assert resp1.status_code == 400
    
    # Valid transition: SUBMITTED -> UNDER_REVIEW
    resp2 = auth_client_admin.post(
        f"/api/v1/ml/governance/feedback/{fb_id}/review",
        json={"review_status": "under_review"}
    )
    assert resp2.status_code == 200
    assert resp2.json()["review_status"] == "under_review"

    # Valid transition: UNDER_REVIEW -> ACCEPTED
    resp3 = auth_client_admin.post(
        f"/api/v1/ml/governance/feedback/{fb_id}/review",
        json={"review_status": "accepted", "notes": "Valid"}
    )
    assert resp3.status_code == 200


def test_approve_ground_truth_prevents_self_approval(auth_client_admin, db_session):
    # Create feedback as this admin
    fb = auth_client_admin.post(
        "/api/v1/ml/governance/feedback",
        json={"hazard_type": "flood", "feedback_type": "confirmed_event"}
    ).json()
    fb_id = fb["id"]
    
    # Manually transition to ACCEPTED to bypass strict state machine for test
    from app.models.ml_feedback import MLFeedback
    f = db_session.query(MLFeedback).get(fb_id)
    f.review_status = ReviewStatus.ACCEPTED
    db_session.commit()
    
    # Try to approve it
    resp = auth_client_admin.post(
        f"/api/v1/ml/governance/feedback/{fb_id}/approve-ground-truth",
        json={"evidence_type": "test", "evidence_reference": "test"}
    )
    assert resp.status_code == 403
    assert "Self-approval prevention" in resp.json()["detail"]


def test_approve_ground_truth_requires_evidence_and_state(auth_client_admin, db_session):
    fb = auth_client_admin.post(
        "/api/v1/ml/governance/feedback",
        json={"hazard_type": "flood", "feedback_type": "uncertain"}
    ).json()
    fb_id = fb["id"]
    
    # Cannot approve directly from SUBMITTED
    resp1 = auth_client_admin.post(
        f"/api/v1/ml/governance/feedback/{fb_id}/approve-ground-truth",
        json={"evidence_type": "test", "evidence_reference": "test"}
    )
    assert resp1.status_code == 400

    # Needs to be tested by another admin in real life, but for now we verify the state check works.
    

def test_dataset_candidate_generation_and_export(auth_client_admin, db_session):
    # insert an approved record manually via db_session for a DIFFERENT user
    approved_fb = MLFeedback(
        hazard_type="flood",
        feedback_type=FeedbackType.CONFIRMED_EVENT,
        review_status=ReviewStatus.APPROVED_GROUND_TRUTH,
        submitted_by_id=2,  # different user
        reviewed_by_id=1,
        evidence_type="test",
        evidence_reference="test",
        provenance="test_provenance",
    )
    db_session.add(approved_fb)
    db_session.commit()
    
    # Generate candidate
    resp_gen = auth_client_admin.post("/api/v1/ml/governance/datasets/candidates?hazard_type=flood")
    assert resp_gen.status_code == 200
    candidate = resp_gen.json()
    assert candidate["hazard_type"] == "flood"
    assert candidate["record_count"] >= 1
    
    cand_id = candidate["id"]
    
    # Export candidate
    resp_exp = auth_client_admin.get(f"/api/v1/ml/governance/datasets/candidates/{cand_id}/export")
    assert resp_exp.status_code == 200
    records = resp_exp.json()
    assert isinstance(records, list)
    assert len(records) == candidate["record_count"]

def test_demo_record_blocked_from_ground_truth(auth_client_admin, db_session):
    from app.models.disaster_event import DisasterEvent, RecordType, SeverityLevel
    
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    # Create a DEMO event
    demo_event = DisasterEvent(hazard_type="flood", record_type=RecordType.DEMO, location_id=1, severity=SeverityLevel.MODERATE, risk_score=50.0, model_version="v1", event_time=now)
    db_session.add(demo_event)
    db_session.commit()
    
    # Create feedback for it
    fb = MLFeedback(
        event_id=demo_event.id,
        hazard_type="flood",
        feedback_type=FeedbackType.CONFIRMED_EVENT,
        review_status=ReviewStatus.ACCEPTED,
        submitted_by_id=2
    )
    db_session.add(fb)
    db_session.commit()

    resp = auth_client_admin.post(
        f"/api/v1/ml/governance/feedback/{fb.id}/approve-ground-truth",
        json={"evidence_type": "test", "evidence_reference": "test"}
    )
    assert resp.status_code == 400
    assert "DEMO" in resp.json()["detail"]

def test_temporal_leakage_exclusion(auth_client_admin, db_session):
    from app.models.disaster_event import DisasterEvent, SeverityLevel
    from datetime import datetime, timezone, timedelta
    import json
    
    now = datetime.now(timezone.utc)
    
    # Create an event in the past
    event = DisasterEvent(hazard_type="flood", event_time=now - timedelta(days=1), location_id=1, severity=SeverityLevel.MODERATE, risk_score=50.0, record_type="PREDICTIVE", model_version="v1")
    db_session.add(event)
    db_session.commit()
    
    # Create feedback with a prediction snapshot from AFTER the event (Temporal Leakage)
    fb = MLFeedback(
        event_id=event.id,
        hazard_type="flood",
        feedback_type=FeedbackType.CONFIRMED_EVENT,
        review_status=ReviewStatus.APPROVED_GROUND_TRUTH,
        submitted_by_id=2,
        feature_snapshot=json.dumps({"prediction_timestamp": now.isoformat()}),
        evidence_type="test",
        evidence_reference="test",
        provenance="test"
    )
    db_session.add(fb)
    db_session.commit()

    # Generate candidate
    resp = auth_client_admin.post("/api/v1/ml/governance/datasets/candidates?hazard_type=flood")
    if resp.status_code == 200:
        cand = resp.json()
        assert cand["leakage_count"] >= 1
    else:
        assert resp.status_code == 400
        assert "excluded" in resp.json()["detail"]
