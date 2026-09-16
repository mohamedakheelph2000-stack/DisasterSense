"""add_alert_audit_and_status

Revision ID: 38ab9ca98b87
Revises: 98ef58a27a52
Create Date: 2026-09-15 19:13:04.083433+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '38ab9ca98b87'
down_revision: Union[str, Sequence[str], None] = '98ef58a27a52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Update the alertstatus ENUM in Postgres
    op.execute("ALTER TYPE alertstatus ADD VALUE IF NOT EXISTS 'response_in_progress'")
    
    # 2. Create the alert_audits table
    op.create_table(
        'alert_audits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=False),
        sa.Column('actor', sa.String(length=200), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_audits_alert_id'), 'alert_audits', ['alert_id'], unique=False)
    op.create_index(op.f('ix_alert_audits_id'), 'alert_audits', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_alert_audits_id'), table_name='alert_audits')
    op.drop_index(op.f('ix_alert_audits_alert_id'), table_name='alert_audits')
    op.drop_table('alert_audits')
    # Note: Removing a value from a Postgres enum is not directly supported via ALTER TYPE.
    # A full downgrade would involve creating a new type, swapping, and dropping the old type.
    # For safety in this prototype, we skip downgrading the enum value.
    pass
