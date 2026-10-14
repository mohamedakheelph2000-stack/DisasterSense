"""Add ambulance resource type and emergency contact phone column.

Revision ID: b7c1d2e3f4a5
Revises: a1b2c3d4e5f6
Create Date: 2026-10-09
"""

from alembic import op
import sqlalchemy as sa

revision = "b7c1d2e3f4a5"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

RESOURCE_TYPE_ENUM = sa.Enum(
    "shelter",
    "hospital",
    "ambulance",
    "fire_station",
    "police_station",
    "relief_center",
    "other_emergency_resource",
    name="resourcetype",
)


def _backend_dialect() -> str:
    return op.get_bind().dialect.name


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        # The enum already exists in PG; append the new value when missing.
        bind.execute(
            sa.text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e "
                "ON t.oid = e.enumtypid WHERE t.typname = 'resourcetype' "
                "AND e.enumlabel = 'ambulance') THEN "
                "ALTER TYPE resourcetype ADD VALUE 'ambulance'; "
                "END IF; END $$;"
            )
        )
    else:
        # SQLite (test harness) recreates tables via metadata.create_all, but keep
        # the op idempotent for any other non-PG database.
        op.execute("SELECT 1")

    op.add_column(
        "emergency_resources",
        sa.Column("phone_number", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_emergency_resources_phone_number",
        "emergency_resources",
        ["phone_number"],
    )


def downgrade() -> None:
    op.drop_index("ix_emergency_resources_phone_number", table_name="emergency_resources")
    op.drop_column("emergency_resources", "phone_number")
    # PostgreSQL does not support ALTER TYPE ... DROP VALUE, so the 'ambulance'
    # enum label is intentionally left in place (it is harmless and unused).
