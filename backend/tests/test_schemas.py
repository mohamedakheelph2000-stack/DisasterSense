"""
Tests for Pydantic schemas.

Verifies that schema validation accepts valid inputs and rejects invalid ones.
No database required.
"""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AlertCreate,
    DisasterEventCreate,
    HazardType,
    LocationCreate,
    LocationRead,
    SeverityLevel,
    UserCreate,
    UserRead,
    UserRole,
)
from datetime import datetime, timezone


class TestUserSchemas:
    """Validate user schema rules."""

    def test_valid_user_create(self) -> None:
        user = UserCreate(
            email="citizen@disastersense.dev",
            full_name="Jane Citizen",
            plain_password="Secure!Pass1",
        )
        assert user.email == "citizen@disastersense.dev"
        assert user.role == UserRole.CITIZEN  # default

    def test_invalid_email_rejected(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                email="not-an-email",
                full_name="Bad User",
                plain_password="Secure!Pass1",
            )

    def test_short_password_rejected(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                email="user@example.com",
                full_name="Short Pass",
                plain_password="abc",
            )

    def test_trivial_password_rejected(self) -> None:
        with pytest.raises(ValidationError):
            UserCreate(
                email="user@example.com",
                full_name="Trivial Pass",
                plain_password="password",
            )

    def test_user_read_from_orm_attributes(self) -> None:
        now = datetime.now(timezone.utc)
        user = UserRead(
            id=1,
            email="admin@example.com",
            full_name="Admin User",
            role=UserRole.ADMIN,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        assert user.id == 1
        assert user.role == UserRole.ADMIN


class TestLocationSchemas:
    """Validate location schema coordinate ranges."""

    def test_valid_location_create(self) -> None:
        loc = LocationCreate(
            name="Wayanad District",
            latitude=11.6854,
            longitude=76.1320,
            district="Wayanad",
            state="Kerala",
        )
        assert loc.country == "India"  # default

    def test_latitude_out_of_range_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LocationCreate(name="Bad", latitude=95.0, longitude=76.0)

    def test_longitude_out_of_range_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LocationCreate(name="Bad", latitude=11.0, longitude=200.0)


class TestDisasterEventSchemas:
    """Validate disaster event schema rules."""

    def test_valid_event_create(self) -> None:
        event = DisasterEventCreate(
            location_id=1,
            hazard_type=HazardType.FLOOD,
            severity=SeverityLevel.HIGH,
            risk_score=0.78,
            model_version="flood-v1.0.0",
            event_time=datetime.now(timezone.utc),
        )
        assert event.hazard_type == HazardType.FLOOD
        assert event.alert_triggered is False  # default

    def test_risk_score_out_of_range_rejected(self) -> None:
        with pytest.raises(ValidationError):
            DisasterEventCreate(
                location_id=1,
                hazard_type=HazardType.LANDSLIDE,
                severity=SeverityLevel.CRITICAL,
                risk_score=1.5,  # > 1.0 — invalid
                model_version="v1",
                event_time=datetime.now(timezone.utc),
            )


class TestAlertSchemas:
    """Validate alert schema rules."""

    def test_valid_alert_create(self) -> None:
        alert = AlertCreate(
            location_id=1,
            disaster_event_id=5,
            title="Flood Warning — Wayanad",
            message="Risk score 0.85 detected. Immediate attention required.",
        )
        assert alert.title == "Flood Warning — Wayanad"

    def test_empty_title_rejected(self) -> None:
        with pytest.raises(ValidationError):
            AlertCreate(
                location_id=1,
                disaster_event_id=5,
                title="",
                message="Some message",
            )
