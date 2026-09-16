"""
ML Governance Audit Trail Model.

Provides an immutable history of all dataset candidate generations
and feedback review transitions.
"""

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MLGovernanceAudit(Base):
    """
    Immutable audit history log for the ML data governance pipeline.
    """

    __tablename__ = "ml_governance_audits"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    actor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    feedback_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ml_feedback.id", ondelete="SET NULL"), nullable=True
    )
    candidate_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("dataset_candidates.id", ondelete="SET NULL"), nullable=True
    )

    previous_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    decision: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    actor = relationship("User")

    def __repr__(self) -> str:
        return f"<MLGovernanceAudit id={self.id} action={self.action} timestamp={self.timestamp}>"
