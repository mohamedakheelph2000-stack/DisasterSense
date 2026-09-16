"""
Initial schema migration.

Creates four tables that form the DisasterSense database foundation:
    users            — platform operator accounts
    locations        — named geographic points for predictions
    disaster_events  — AI-generated flood/landslide prediction records
    alerts           — in-app notifications raised from high-risk events

Revision ID: 001
Created: 2026-08-09
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create all foundation tables and indexes."""

    # ── 1. Enum types (PostgreSQL-specific) ─────────────────────────────────
    # Create enums before tables that reference them.
    userrole = sa.Enum("admin", "analyst", name="userrole")
    hazardtype = sa.Enum("flood", "landslide", name="hazardtype")
    severitylevel = sa.Enum("low", "moderate", "high", "critical", name="severitylevel")
    alertstatus = sa.Enum("active", "acknowledged", "resolved", "dismissed", name="alertstatus")

    # userrole.create(op.get_bind(), checkfirst=True)
    # hazardtype.create(op.get_bind(), checkfirst=True)
    # severitylevel.create(op.get_bind(), checkfirst=True)
    # alertstatus.create(op.get_bind(), checkfirst=True)

    # ── 2. users ────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("hashed_password", sa.String(length=200), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "analyst", name="userrole"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── 3. locations ─────────────────────────────────────────────────────────
    op.create_table(
        "locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("elevation_m", sa.Float(), nullable=True),
        sa.Column("district", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_locations_id", "locations", ["id"], unique=False)
    op.create_index("ix_locations_name", "locations", ["name"], unique=False)
    op.create_index(
        "ix_locations_lat_lon", "locations", ["latitude", "longitude"], unique=False
    )

    # ── 4. disaster_events ───────────────────────────────────────────────────
    op.create_table(
        "disaster_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column(
            "hazard_type",
            sa.Enum("flood", "landslide", name="hazardtype"),
            nullable=False,
        ),
        sa.Column(
            "severity",
            sa.Enum(
                "low", "moderate", "high", "critical",
                name="severitylevel",
            ),
            nullable=False,
        ),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("feature_snapshot", sa.Text(), nullable=True),
        sa.Column("data_source", sa.String(length=100), nullable=True),
        sa.Column("alert_triggered", sa.Boolean(), nullable=False),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_disaster_events_id", "disaster_events", ["id"], unique=False)
    op.create_index(
        "ix_disaster_events_location_id", "disaster_events", ["location_id"], unique=False
    )
    op.create_index(
        "ix_disaster_events_severity", "disaster_events", ["severity"], unique=False
    )
    op.create_index(
        "ix_disaster_events_location_hazard_time",
        "disaster_events",
        ["location_id", "hazard_type", "event_time"],
        unique=False,
    )

    # ── 5. alerts ────────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("disaster_event_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "active", "acknowledged", "resolved", "dismissed",
                name="alertstatus",
            ),
            nullable=False,
        ),
        sa.Column("acknowledged_by", sa.String(length=200), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["disaster_event_id"], ["disaster_events.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alerts_id", "alerts", ["id"], unique=False)
    op.create_index("ix_alerts_location_id", "alerts", ["location_id"], unique=False)
    op.create_index(
        "ix_alerts_disaster_event_id", "alerts", ["disaster_event_id"], unique=False
    )
    op.create_index("ix_alerts_status", "alerts", ["status"], unique=False)


def downgrade() -> None:
    """Drop all foundation tables and enum types in reverse order."""
    # Drop tables in reverse FK dependency order.
    op.drop_table("alerts")
    op.drop_table("disaster_events")
    op.drop_table("locations")
    op.drop_table("users")

    # Drop enum types after tables that use them.
    sa.Enum(name="alertstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="severitylevel").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="hazardtype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="userrole").drop(op.get_bind(), checkfirst=True)
