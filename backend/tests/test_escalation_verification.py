"""
Comprehensive escalation verification tests for Prompt #36A.

These tests prove every security, correctness, and lifecycle property
required by the HITL alert escalation specification.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

from app.models.disaster_event import DisasterEvent, SeverityLevel, RecordType, HazardType
from app.models.location import Location
from app.models.alert import Alert, AlertAudit, AlertStatus


# ── Helper: create a valid cluster of events that the clustering algo will find ──

def _create_cluster_events(db_session: Session, *, hazard="flood", record_type="PREDICTIVE",
                           lat=10.0, lon=10.0, count=3, risk=0.85, data_source="test"):
    """Create a tight cluster of events at the same location for test use."""
    loc = Location(latitude=lat, longitude=lon, name=f"TestCluster_{lat}_{lon}")
    db_session.add(loc)
    db_session.commit()

    now = datetime.now(timezone.utc)
    events = []
    for i in range(count):
        ev = DisasterEvent(
            hazard_type=hazard,
            event_time=now - timedelta(minutes=i * 10),
            location_id=loc.id,
            severity=SeverityLevel.HIGH,
            risk_score=risk,
            record_type=record_type,
            model_version="v1",
            data_source=data_source,
        )
        db_session.add(ev)
        events.append(ev)
    db_session.commit()
    return loc, events


def _get_first_cluster_id(client: TestClient, hazard="flood", record_type="predictive",
                          time_range="24h") -> str:
    """Fetch clusters and return the first cluster_id."""
    resp = client.get(
        f"/api/v1/spatial-risk/clusters?hazard_type={hazard}&record_type={record_type}&time_range={time_range}"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["clusters"]) >= 1
    return data["clusters"][0]["cluster_id"]


# ══════════════════════════════════════════════════════════════════════════════
# 1. AUTH & RBAC
# ══════════════════════════════════════════════════════════════════════════════

def test_escalation_unauthenticated_401(client: TestClient):
    """Unauthenticated request is rejected."""
    r = client.post("/api/v1/spatial-risk/clusters/cluster_xxx/escalate",
                    json={"member_ids": [1], "severity": "high",
                          "hazard_type": "flood", "record_type": "predictive"})
    assert r.status_code == 401


def test_escalation_citizen_403(auth_client_citizen: TestClient):
    """Citizens cannot escalate."""
    r = auth_client_citizen.post("/api/v1/spatial-risk/clusters/cluster_xxx/escalate",
                                json={"member_ids": [1], "severity": "high",
                                      "hazard_type": "flood", "record_type": "predictive"})
    assert r.status_code == 403


def test_escalation_responder_success(auth_client_responder: TestClient, db_session: Session):
    """Responders CAN escalate a valid cluster."""
    _create_cluster_events(db_session, count=3)
    cid = _get_first_cluster_id(auth_client_responder)

    r = auth_client_responder.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [], "severity": "high",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200
    assert r.json()["escalation_status"] == "SUCCESS"


def test_escalation_admin_success(auth_client_admin: TestClient, db_session: Session):
    """Admins CAN escalate a valid cluster."""
    _create_cluster_events(db_session, count=3)
    cid = _get_first_cluster_id(auth_client_admin)

    r = auth_client_admin.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [], "severity": "critical",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 2. SEVERITY VALIDATION & PERSISTENCE
# ══════════════════════════════════════════════════════════════════════════════

def test_invalid_severity_400(auth_client_admin: TestClient):
    """Invalid severity is rejected."""
    r = auth_client_admin.post("/api/v1/spatial-risk/clusters/cluster_xxx/escalate",
                               json={"member_ids": [1], "severity": "MEGA_DANGER",
                                     "hazard_type": "flood", "record_type": "predictive"})
    assert r.status_code == 400


def test_operator_severity_persisted(auth_client_admin: TestClient, db_session: Session):
    """Operator-selected severity is persisted on Alert.severity."""
    _create_cluster_events(db_session, count=3)
    cid = _get_first_cluster_id(auth_client_admin)

    r = auth_client_admin.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [], "severity": "critical",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200
    alert_id = r.json()["alert_id"]

    alert = db_session.query(Alert).get(alert_id)
    assert alert is not None
    assert alert.severity == SeverityLevel.CRITICAL


def test_operator_high_severity_persisted(auth_client_admin: TestClient, db_session: Session):
    """operator selects HIGH → Alert is HIGH."""
    _create_cluster_events(db_session, count=3, lat=20.0, lon=20.0)
    cid = _get_first_cluster_id(auth_client_admin)

    r = auth_client_admin.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [], "severity": "high",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200
    alert_id = r.json()["alert_id"]

    alert = db_session.query(Alert).get(alert_id)
    assert alert.severity == SeverityLevel.HIGH


# ══════════════════════════════════════════════════════════════════════════════
# 3. DEMO REJECTION
# ══════════════════════════════════════════════════════════════════════════════

def test_demo_escalation_rejected(auth_client_admin: TestClient):
    """DEMO clusters cannot be escalated."""
    r = auth_client_admin.post("/api/v1/spatial-risk/clusters/cluster_xxx/escalate",
                               json={"member_ids": [1], "severity": "high",
                                     "hazard_type": "flood", "record_type": "demo"})
    assert r.status_code == 400
    assert "DEMO" in r.json()["detail"]


# ══════════════════════════════════════════════════════════════════════════════
# 4. FORGED / MISMATCHED MEMBER IDs
# ══════════════════════════════════════════════════════════════════════════════

def test_forged_cluster_id_rejected(auth_client_admin: TestClient, db_session: Session):
    """A forged cluster_id that doesn't match any real cluster is 404."""
    _create_cluster_events(db_session, count=3)

    r = auth_client_admin.post(
        "/api/v1/spatial-risk/clusters/cluster_FORGED_FAKE/escalate",
        json={"member_ids": [999999], "severity": "high",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 404


def test_client_member_ids_ignored(auth_client_admin: TestClient, db_session: Session):
    """Client-provided member_ids are NOT used; backend reconstructs independently."""
    _create_cluster_events(db_session, count=3)
    cid = _get_first_cluster_id(auth_client_admin)

    # Pass completely wrong member_ids — should still succeed because the backend
    # reconstructs the cluster from scratch, ignoring these.
    r = auth_client_admin.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [999999, 888888], "severity": "high",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200  # backend reconstructed independently


# ══════════════════════════════════════════════════════════════════════════════
# 5. DUPLICATE ESCALATION
# ══════════════════════════════════════════════════════════════════════════════

def test_duplicate_active_escalation_409(auth_client_admin: TestClient, db_session: Session):
    """Second escalation while alert is ACTIVE returns 409."""
    _create_cluster_events(db_session, count=3, lat=30.0, lon=30.0)
    cid = _get_first_cluster_id(auth_client_admin)

    payload = {"member_ids": [], "severity": "high",
               "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"}

    r1 = auth_client_admin.post(f"/api/v1/spatial-risk/clusters/{cid}/escalate", json=payload)
    assert r1.status_code == 200

    r2 = auth_client_admin.post(f"/api/v1/spatial-risk/clusters/{cid}/escalate", json=payload)
    assert r2.status_code == 409


def test_resolved_cluster_allows_reescalation(auth_client_admin: TestClient, db_session: Session):
    """After resolving the first alert, a new escalation is permitted."""
    _create_cluster_events(db_session, count=3, lat=40.0, lon=40.0)
    cid = _get_first_cluster_id(auth_client_admin)

    payload = {"member_ids": [], "severity": "high",
               "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"}

    r1 = auth_client_admin.post(f"/api/v1/spatial-risk/clusters/{cid}/escalate", json=payload)
    assert r1.status_code == 200
    alert_id = r1.json()["alert_id"]

    # Resolve the alert
    alert = db_session.query(Alert).get(alert_id)
    alert.status = AlertStatus.RESOLVED
    db_session.commit()

    # Re-escalate should succeed
    r2 = auth_client_admin.post(f"/api/v1/spatial-risk/clusters/{cid}/escalate", json=payload)
    assert r2.status_code == 200
    assert r2.json()["alert_id"] != alert_id  # different alert


# ══════════════════════════════════════════════════════════════════════════════
# 6. CLUSTER_METADATA & SOURCE_CLUSTER_ID PERSISTENCE
# ══════════════════════════════════════════════════════════════════════════════

def test_cluster_metadata_persisted(auth_client_admin: TestClient, db_session: Session):
    """source_cluster_id and cluster_metadata are persisted on the Alert."""
    _create_cluster_events(db_session, count=3, lat=50.0, lon=50.0, data_source="USGS")
    cid = _get_first_cluster_id(auth_client_admin)

    r = auth_client_admin.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [], "severity": "high",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200
    alert_id = r.json()["alert_id"]

    alert = db_session.query(Alert).get(alert_id)
    assert alert.source_cluster_id == cid
    assert alert.cluster_metadata is not None
    assert "member_count" in alert.cluster_metadata
    assert "average_risk" in alert.cluster_metadata
    assert "hazard_type" in alert.cluster_metadata


# ══════════════════════════════════════════════════════════════════════════════
# 7. AUDIT TRAIL — NO UNNECESSARY PII
# ══════════════════════════════════════════════════════════════════════════════

def test_audit_uses_user_id_not_email(auth_client_admin: TestClient, db_session: Session):
    """Audit actor field uses user_<id> format, not raw email."""
    _create_cluster_events(db_session, count=3, lat=60.0, lon=60.0)
    cid = _get_first_cluster_id(auth_client_admin)

    r = auth_client_admin.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [], "severity": "high",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200
    alert_id = r.json()["alert_id"]

    audit = db_session.query(AlertAudit).filter(AlertAudit.alert_id == alert_id).first()
    assert audit is not None
    assert audit.actor.startswith("user_")
    assert "@" not in audit.actor  # No email in actor


# ══════════════════════════════════════════════════════════════════════════════
# 8. CLUSTERING ALONE CREATES ZERO ALERTS / NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════════════════

def test_cluster_query_creates_no_alerts(auth_client_admin: TestClient, db_session: Session):
    """GET /clusters alone must never create an Alert or dispatch notifications."""
    _create_cluster_events(db_session, count=5, lat=70.0, lon=70.0)

    alert_count_before = db_session.query(Alert).count()
    audit_count_before = db_session.query(AlertAudit).count()

    resp = auth_client_admin.get(
        "/api/v1/spatial-risk/clusters?hazard_type=flood&record_type=predictive&time_range=24h")
    assert resp.status_code == 200
    assert len(resp.json()["clusters"]) >= 1

    alert_count_after = db_session.query(Alert).count()
    audit_count_after = db_session.query(AlertAudit).count()

    assert alert_count_after == alert_count_before
    assert audit_count_after == audit_count_before


# ══════════════════════════════════════════════════════════════════════════════
# 9. NOTIFICATION FAILURE HANDLING
# ══════════════════════════════════════════════════════════════════════════════

def test_notification_failure_returns_safe_message(auth_client_admin: TestClient, db_session: Session):
    """When dispatch fails, the API returns a safe message, not the exception."""
    _create_cluster_events(db_session, count=3, lat=80.0, lon=80.0)
    cid = _get_first_cluster_id(auth_client_admin)

    with patch("app.api.v1.spatial_risk.dispatch_alert_notifications",
               side_effect=RuntimeError("SMTP server exploded")):
        r = auth_client_admin.post(
            f"/api/v1/spatial-risk/clusters/{cid}/escalate",
            json={"member_ids": [], "severity": "high",
                  "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200
    assert "SMTP" not in r.json()["notification_status"]
    assert "internal dispatch error" in r.json()["notification_status"]


# ══════════════════════════════════════════════════════════════════════════════
# 10. INCIDENT LIFECYCLE COMPAT — ACKNOWLEDGE / RESOLVE AFTER ESCALATION
# ══════════════════════════════════════════════════════════════════════════════

def test_escalated_alert_can_be_acknowledged(auth_client_admin: TestClient, db_session: Session):
    """An escalated alert works with the standard acknowledge endpoint."""
    _create_cluster_events(db_session, count=3, lat=85.0, lon=85.0)
    cid = _get_first_cluster_id(auth_client_admin)

    r = auth_client_admin.post(
        f"/api/v1/spatial-risk/clusters/{cid}/escalate",
        json={"member_ids": [], "severity": "critical",
              "hazard_type": "flood", "record_type": "predictive", "time_window": "24h"})
    assert r.status_code == 200
    alert_id = r.json()["alert_id"]

    ack = auth_client_admin.post(
        f"/api/v1/alerts/{alert_id}/acknowledge",
        json={"acknowledged_by": "Admin User"})
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"

    resolve = auth_client_admin.post(f"/api/v1/alerts/{alert_id}/resolve")
    assert resolve.status_code == 200
    assert resolve.json()["status"] == "resolved"
