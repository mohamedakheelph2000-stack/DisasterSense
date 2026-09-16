"""Update userrole enum

Revision ID: 002
Revises: 001
Create Date: 2026-09-11 15:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Update enum for postgresql
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'responder'")
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'citizen'")
    # sqlite doesn't strictly enforce enums, so we don't need to do anything


def downgrade() -> None:
    # Downgrading enum values in Postgres requires recreating the type,
    # which is complex and usually avoided. We'll leave it as a no-op here.
    pass
