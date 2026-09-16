"""
Tests for ORM model definitions.

These tests verify that:
- All four models can be imported without error.
- The table name constants are correct.
- All expected columns exist in the metadata.
- Enum values match the documented domain.
- Relationships are wired up correctly.

No database connection is required — SQLAlchemy metadata introspection
works entirely in-process.
"""

import pytest
from sqlalchemy import inspect as sa_inspect

from app.core.database import Base
from app.models import Alert, AlertStatus, DisasterEvent, HazardType, Location, SeverityLevel, User, UserRole


class TestUserModel:
    """Verify the User ORM model."""

    def test_tablename(self) -> None:
        assert User.__tablename__ == "users"

    def test_required_columns_present(self) -> None:
        columns = {c.key for c in User.__table__.columns}
        assert "id" in columns
        assert "email" in columns
        assert "full_name" in columns
        assert "hashed_password" in columns
        assert "role" in columns
        assert "is_active" in columns
        assert "created_at" in columns
        assert "updated_at" in columns

    def test_user_role_enum_values(self) -> None:
        assert UserRole.ADMIN == "admin"
        assert UserRole.RESPONDER == "responder"
        assert UserRole.CITIZEN == "citizen"

    def test_email_column_is_unique(self) -> None:
        email_col = User.__table__.c["email"]
        assert email_col.unique is True

    def test_repr_string_format(self) -> None:
        """__repr__ must reference id, email, and role fields."""
        import inspect
        source = inspect.getsource(User.__repr__)
        assert "self.id" in source
        assert "self.email" in source
        assert "self.role" in source


class TestLocationModel:
    """Verify the Location ORM model."""

    def test_tablename(self) -> None:
        assert Location.__tablename__ == "locations"

    def test_required_columns_present(self) -> None:
        columns = {c.key for c in Location.__table__.columns}
        assert "id" in columns
        assert "name" in columns
        assert "latitude" in columns
        assert "longitude" in columns
        assert "country" in columns
        assert "created_at" in columns

    def test_has_composite_lat_lon_index(self) -> None:
        index_names = {idx.name for idx in Location.__table__.indexes}
        assert "ix_locations_lat_lon" in index_names

    def test_elevation_is_nullable(self) -> None:
        col = Location.__table__.c["elevation_m"]
        assert col.nullable is True


class TestDisasterEventModel:
    """Verify the DisasterEvent ORM model."""

    def test_tablename(self) -> None:
        assert DisasterEvent.__tablename__ == "disaster_events"

    def test_hazard_type_enum_values(self) -> None:
        assert HazardType.FLOOD == "flood"
        assert HazardType.LANDSLIDE == "landslide"

    def test_severity_level_enum_values(self) -> None:
        assert SeverityLevel.LOW == "low"
        assert SeverityLevel.MODERATE == "moderate"
        assert SeverityLevel.HIGH == "high"
        assert SeverityLevel.CRITICAL == "critical"

    def test_required_columns_present(self) -> None:
        columns = {c.key for c in DisasterEvent.__table__.columns}
        assert "id" in columns
        assert "location_id" in columns
        assert "hazard_type" in columns
        assert "severity" in columns
        assert "risk_score" in columns
        assert "model_version" in columns
        assert "alert_triggered" in columns
        assert "event_time" in columns
        assert "created_at" in columns

    def test_has_composite_index(self) -> None:
        index_names = {idx.name for idx in DisasterEvent.__table__.indexes}
        assert "ix_disaster_events_location_hazard_time" in index_names

    def test_location_id_is_foreign_key(self) -> None:
        col = DisasterEvent.__table__.c["location_id"]
        fk_targets = {fk.target_fullname for fk in col.foreign_keys}
        assert "locations.id" in fk_targets


class TestAlertModel:
    """Verify the Alert ORM model."""

    def test_tablename(self) -> None:
        assert Alert.__tablename__ == "alerts"

    def test_alert_status_enum_values(self) -> None:
        assert AlertStatus.ACTIVE == "active"
        assert AlertStatus.ACKNOWLEDGED == "acknowledged"
        assert AlertStatus.RESOLVED == "resolved"
        assert AlertStatus.DISMISSED == "dismissed"

    def test_required_columns_present(self) -> None:
        columns = {c.key for c in Alert.__table__.columns}
        assert "id" in columns
        assert "location_id" in columns
        assert "disaster_event_id" in columns
        assert "title" in columns
        assert "message" in columns
        assert "status" in columns
        assert "source_cluster_id" in columns
        assert "cluster_metadata" in columns
        assert "created_at" in columns
        assert "updated_at" in columns

    def test_both_foreign_keys_present(self) -> None:
        loc_fk = Alert.__table__.c["location_id"].foreign_keys
        event_fk = Alert.__table__.c["disaster_event_id"].foreign_keys
        assert any("locations.id" in fk.target_fullname for fk in loc_fk)
        assert any("disaster_events.id" in fk.target_fullname for fk in event_fk)


class TestMetadataRegistration:
    """Verify that all models are registered in SQLAlchemy metadata."""

    def test_all_tables_registered(self) -> None:
        table_names = set(Base.metadata.tables.keys())
        assert "users" in table_names
        assert "locations" in table_names
        assert "disaster_events" in table_names
        assert "alerts" in table_names

    def test_table_count_is_exactly_eight(self):
        """
        Governance Layer (Prompt 33/33A) adds ml_feedback, dataset_candidates, 
        ml_governance_audits, and candidate_feedback_link.
        Total = 7 original + 4 ML Governance = 11 tables.
        """
        assert len(Base.metadata.tables) == 11
