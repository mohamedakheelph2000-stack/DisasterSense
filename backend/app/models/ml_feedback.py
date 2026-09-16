"""
ML Feedback and Dataset Governance Model.

Allows users to submit operational feedback on ML predictions.
Administrators can review and approve these into 'ground truth' for future
dataset candidate generations without contaminating real-v1 models.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FeedbackType(str, enum.Enum):
    """Categorization of the operational feedback."""
    CONFIRMED_EVENT = "confirmed_event"
    FALSE_POSITIVE = "false_positive"
    FALSE_NEGATIVE = "false_negative"
    UNCERTAIN = "uncertain"
    DATA_CORRECTION = "data_correction"


class ReviewStatus(str, enum.Enum):
    """Workflow state of the feedback."""
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    APPROVED_GROUND_TRUTH = "approved_ground_truth"


class MLFeedback(Base):
    """
    User feedback or verified ground truth regarding an ML prediction.
    """

    __tablename__ = "ml_feedback"

    # ── Primary key ────────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Context ────────────────────────────────────────────────────────────────
    # Optional link to the original DisasterEvent
    event_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("disaster_events.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    hazard_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # ── Feedback Details ───────────────────────────────────────────────────────
    feedback_type: Mapped[FeedbackType] = mapped_column(
        Enum(FeedbackType, name="feedbacktype", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="reviewstatus", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=ReviewStatus.SUBMITTED,
    )
    
    observed_outcome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Store the exact weather/geology snapshot frozen at the time of prediction
    feature_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Source of truth for auditing
    provenance: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Evidence for Ground Truth ──────────────────────────────────────────────
    evidence_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    evidence_reference: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # ── Candidate Exclusion ────────────────────────────────────────────────────
    exclusion_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Audit Trail ────────────────────────────────────────────────────────────
    submitted_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    
    reviewed_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    event = relationship("DisasterEvent", backref="feedback")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

    def __repr__(self) -> str:
        return (
            f"<MLFeedback id={self.id} type={self.feedback_type} status={self.review_status}>"
        )
