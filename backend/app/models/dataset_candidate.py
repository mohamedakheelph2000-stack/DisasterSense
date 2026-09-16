"""
Dataset Candidate Model.

Records explicitly created offline dataset candidates from approved ground truth.
Ensures immutability of real-v1 while providing a structured pathway for real-v2.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CandidateStatus(str, enum.Enum):
    """Lifecycle status of a dataset candidate."""
    DRAFT = "draft"
    READY_FOR_OFFLINE_EVALUATION = "ready_for_offline_evaluation"
    ARCHIVED = "archived"


candidate_feedback_link = Table(
    "candidate_feedback_link",
    Base.metadata,
    Column("candidate_id", Integer, ForeignKey("dataset_candidates.id", ondelete="CASCADE"), primary_key=True),
    Column("feedback_id", Integer, ForeignKey("ml_feedback.id", ondelete="CASCADE"), primary_key=True),
)


class DatasetCandidate(Base):
    """
    An explicit, versioned dataset candidate intended for offline ML evaluation.
    """

    __tablename__ = "dataset_candidates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    version_name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hazard_type: Mapped[str] = mapped_column(String(50), nullable=False)

    status: Mapped[CandidateStatus] = mapped_column(
        Enum(CandidateStatus, name="candidatestatus", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=CandidateStatus.DRAFT,
    )

    feature_schema: Mapped[str] = mapped_column(Text, nullable=False)
    geographic_coverage: Mapped[str | None] = mapped_column(String(255), nullable=True)
    temporal_coverage: Mapped[str | None] = mapped_column(String(255), nullable=True)
    methodology: Mapped[str | None] = mapped_column(Text, nullable=True)
    exclusions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Generation Statistics
    included_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    excluded_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    leakage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unknown_provenance_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    records = relationship("MLFeedback", secondary=candidate_feedback_link)

    def __repr__(self) -> str:
        return f"<DatasetCandidate id={self.id} version={self.version_name}>"
