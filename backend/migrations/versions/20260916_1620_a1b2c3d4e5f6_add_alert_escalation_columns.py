"""Add source_cluster_id, cluster_metadata, severity to alerts

Adds three columns to the alerts table for HITL escalation support:
- source_cluster_id: deterministic hash linking an alert to its originating cluster
- cluster_metadata: JSON snapshot of cluster metrics at escalation time
- severity: operator-assigned severity level (reuses existing severitylevel enum)

Revision ID: a1b2c3d4e5f6
Revises: 0527ccc846f9
Create Date: 2026-09-16 16:20:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '0527ccc846f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add escalation columns to alerts table."""
    # source_cluster_id — deterministic cluster hash, indexed for duplicate checks
    op.add_column('alerts', sa.Column(
        'source_cluster_id', sa.String(length=50), nullable=True
    ))
    op.create_index(
        'ix_alerts_source_cluster_id', 'alerts', ['source_cluster_id'], unique=False
    )

    # cluster_metadata — JSON snapshot of cluster state at escalation time
    op.add_column('alerts', sa.Column(
        'cluster_metadata', sa.JSON(), nullable=True
    ))

    # severity — operator-assigned severity, reuses the existing severitylevel enum
    # The 'severitylevel' PostgreSQL enum was created in 001_initial_schema.
    op.add_column('alerts', sa.Column(
        'severity',
        sa.Enum('low', 'moderate', 'high', 'critical', name='severitylevel', create_type=False),
        nullable=True
    ))


def downgrade() -> None:
    """Remove escalation columns from alerts table."""
    op.drop_column('alerts', 'severity')
    op.drop_column('alerts', 'cluster_metadata')
    op.drop_index('ix_alerts_source_cluster_id', table_name='alerts')
    op.drop_column('alerts', 'source_cluster_id')
