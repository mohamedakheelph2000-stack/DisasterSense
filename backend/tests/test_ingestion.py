"""Tests for the 24/7 ingestion pipeline, warning board and nearby services."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.disaster_event import RecordType
from app.models.emergency_resource import EmergencyResource, ResourceType, VerificationStatus
from app.services.ingestion.analyzer import raise_level, score_to_warning_level
from app.services.ingestion.store import SourceItem, SourceStore


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=user.id)}"}


# ── auth ─────────────────────────────────────────────────────────────────────
def test_sources_requires_auth(client: TestClient):
    assert client.get("/api/v1/sources").status_code == 401


def test_warnings_requires_auth(client: TestClient):
    assert client.get("/api/v1/warnings").status_code == 401


def test_emergency_numbers_requires_auth(client: TestClient):
    assert client.get("/api/v1/resources/emergency-numbers").status_code == 401


# ── source monitor ───────────────────────────────────────────────────────────
def test_sources_lists_every_registered_source(db_client: TestClient, test_user_citizen):
    resp = db_client.get("/api/v1/sources", headers=_headers(test_user_citizen))
    assert resp.status_code == 200
    body = resp.json()
    keys = {s["key"] for s in body["sources"]}
    assert {
        "open_meteo",
        "usgs_earthquake",
        "emsc_earthquake",
        "nasa_eonet",
        "google_news_disaster",
        "the_hindu_national",
        "gdelt_global_news",
        "osm_emergency_facilities",
    } <= keys
    assert body["worker"]["tick_seconds"] >= 1
    for source in body["sources"]:
        assert source["cadence_seconds"] > 0
        assert source["label"]
        assert source["org"]
        assert source["trust"]


def test_source_items_unknown_key_returns_404(db_client: TestClient, test_user_citizen):
    resp = db_client.get("/api/v1/sources/not-a-source/items", headers=_headers(test_user_citizen))
    assert resp.status_code == 404


def test_ingest_status_reports_heartbeat(db_client: TestClient, test_user_citizen):
    resp = db_client.get("/api/v1/ingest/status", headers=_headers(test_user_citizen))
    assert resp.status_code == 200
    body = resp.json()
    assert body["tick_seconds"] >= 1
    assert body["sources_registered"] >= 8
    assert "total_ticks" in body
    assert "warnings" in body


def test_run_now_rejects_citizen(db_client: TestClient, test_user_citizen):
    resp = db_client.post("/api/v1/ingest/run-now", headers=_headers(test_user_citizen))
    assert resp.status_code == 403


def test_run_now_allowed_for_responder(db_client: TestClient, test_user_responder, monkeypatch):
    from app.services.ingestion import worker as worker_module

    monkeypatch.setattr(
        worker_module.ingestion_worker,
        "run_once",
        lambda: {"tick": 1, "fetched": 0, "failed": 0, "warnings": 0},
    )
    resp = db_client.post("/api/v1/ingest/run-now", headers=_headers(test_user_responder))
    assert resp.status_code == 200
    assert resp.json()["manual"] is True


# ── warning board ────────────────────────────────────────────────────────────
def test_warnings_endpoint_returns_board(db_client: TestClient, test_user_citizen):
    resp = db_client.get("/api/v1/warnings", headers=_headers(test_user_citizen))
    assert resp.status_code == 200
    body = resp.json()
    assert "counts" in body
    assert "warnings" in body
    assert "flood_areas" in body
    assert "landslide_areas" in body
    for warning in body["warnings"]:
        assert warning["warning_level"] in ("low", "medium", "high")
        assert warning["reasons"]


def test_warnings_refresh_returns_board(db_client: TestClient, test_user_citizen):
    resp = db_client.get("/api/v1/warnings?refresh=true", headers=_headers(test_user_citizen))
    assert resp.status_code == 200
    assert resp.json()["weather_available"] is False  # no weather fetched in tests


def test_warnings_summary(db_client: TestClient, test_user_citizen):
    resp = db_client.get("/api/v1/warnings/summary", headers=_headers(test_user_citizen))
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) >= {"counts", "total", "flood_areas", "landslide_areas"}


def test_score_to_warning_level_bands():
    assert score_to_warning_level(95.0) == "high"
    assert score_to_warning_level(60.0) == "high"
    assert score_to_warning_level(59.9) == "medium"
    assert score_to_warning_level(40.0) == "medium"
    assert score_to_warning_level(39.9) == "low"
    assert score_to_warning_level(0.0) == "low"


def test_raise_level_keeps_strongest():
    assert raise_level("low", "medium") == "medium"
    assert raise_level("high", "low") == "high"
    assert raise_level("medium", "high") == "high"


# ── snapshot store ───────────────────────────────────────────────────────────
def test_source_store_records_success_and_error(tmp_path):
    store = SourceStore(path=tmp_path / "snapshot.json")
    store.register(
        "demo",
        label="Demo",
        org="Org",
        trust="government",
        url="https://example.com",
        cadence_seconds=30,
        category="news",
    )
    started = store.record_attempt("demo")
    store.record_success(
        "demo",
        started,
        [SourceItem(id="a1", source_key="demo", title="Flood in Wayanad", hazard="flood")],
        {"records": 1},
    )
    state = store.states["demo"]
    assert state.healthy and state.records == 1 and state.last_success
    assert store.payload("demo") == {"records": 1}
    assert len(store.items_for("demo")) == 1

    started = store.record_attempt("demo")
    store.record_error("demo", "timeout", started)
    assert not store.states["demo"].healthy
    assert store.states["demo"].consecutive_errors == 1
    assert store.states["demo"].last_error == "timeout"

    reloaded = SourceStore(path=tmp_path / "snapshot.json")
    assert "a1" in reloaded.items


# ── emergency numbers ────────────────────────────────────────────────────────
def test_emergency_numbers_endpoint(db_client: TestClient, test_user_citizen):
    resp = db_client.get("/api/v1/resources/emergency-numbers", headers=_headers(test_user_citizen))
    assert resp.status_code == 200
    numbers = {n["number"] for n in resp.json()["numbers"]}
    assert {"112", "100", "101", "102", "108", "1077"} <= numbers


# ── nearby ───────────────────────────────────────────────────────────────────
def test_nearby_groups_services_with_distance(db_client: TestClient, db_session: Session, test_user_citizen):
    db_session.add(
        EmergencyResource(
            name="District Hospital",
            resource_type=ResourceType.HOSPITAL,
            latitude=10.0,
            longitude=76.0,
            source="OpenStreetMap contributors (ODbL)",
            verification_status=VerificationStatus.UNVERIFIED,
            record_type=RecordType.HISTORICAL,
            phone_number="+91 495 000 0001",
        )
    )
    db_session.add(
        EmergencyResource(
            name="Fire Station",
            resource_type=ResourceType.FIRE_STATION,
            latitude=10.02,
            longitude=76.02,
            source="OpenStreetMap contributors (ODbL)",
            verification_status=VerificationStatus.UNVERIFIED,
            record_type=RecordType.HISTORICAL,
        )
    )
    db_session.commit()

    resp = db_client.get(
        "/api/v1/resources/nearby?latitude=10.0&longitude=76.0&radius_km=20&limit_per_type=5",
        headers=_headers(test_user_citizen),
    )
    assert resp.status_code == 200
    body = resp.json()
    groups = {g["key"]: g for g in body["groups"]}
    assert set(groups) == {"hospital", "ambulance", "police_station", "fire_station"}
    assert groups["hospital"]["count"] == 1
    assert groups["hospital"]["items"][0]["distance_km"] == 0.0
    assert groups["hospital"]["items"][0]["phone_number"] == "+91 495 000 0001"
    assert groups["fire_station"]["count"] == 1
    assert groups["ambulance"]["count"] == 0
    assert body["totals"]["hospital"] == 1
    assert len(body["emergency_numbers"]) >= 6
    assert body["radius_km"] == 20.0


def test_nearby_rejects_unknown_type(db_client: TestClient, test_user_citizen):
    resp = db_client.get(
        "/api/v1/resources/nearby?latitude=10&longitude=76&types=spaceship",
        headers=_headers(test_user_citizen),
    )
    assert resp.status_code == 422


def test_nearby_accepts_custom_types(db_client: TestClient, db_session: Session, test_user_citizen):
    db_session.add(
        EmergencyResource(
            name="Relief Camp",
            resource_type=ResourceType.RELIEF_CENTER,
            latitude=10.0,
            longitude=76.0,
            source="District Collector",
            verification_status=VerificationStatus.VERIFIED,
            record_type=RecordType.HISTORICAL,
        )
    )
    db_session.commit()

    resp = db_client.get(
        "/api/v1/resources/nearby?latitude=10&longitude=76&radius_km=10&types=relief_center",
        headers=_headers(test_user_citizen),
    )
    assert resp.status_code == 200
    groups = resp.json()["groups"]
    assert len(groups) == 1
    assert groups[0]["key"] == "relief_center"
    assert groups[0]["count"] == 1
