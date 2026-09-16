"""
DisasterEvent model.

Records a flood or landslide prediction event for a specific location.

Each event captures:
- the hazard type (flood / landslide)
- the AI risk score (0.0 – 1.0) produced by the ML pipeline
- the severity level derived from the score
- whether the event triggered an alert
- the weather feature snapshot used as model input
- timestamps for traceability and analytics

This model is intentionally read-friendly: the ML inference step will
INSERT records; the API will SELECT and filter them.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class HazardType(str, enum.Enum):
    """Disaster hazard category."""

    FLOOD = "flood"
    LANDSLIDE = "landslide"


class SeverityLevel(str, enum.Enum):
    """
    Risk severity band derived from the model confidence score.

    Bands:
        LOW:      score < 0.40
        MODERATE: 0.40 ≤ score < 0.70
        HIGH:     0.70 ≤ score < 0.90
        CRITICAL: score ≥ 0.90
    """

    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class RecordType(str, enum.Enum):
    """
    Categorizes the nature of the event record for filtering.
    """
    HISTORICAL = "historical"
    PREDICTIVE = "predictive"
    DEMO = "demo"


class DisasterEvent(Base):
    """
    AI-generated prediction record or historical disaster event.

    Traceability rule: every event must record the model version that
    produced the score (or "historical" if curated) so predictions can be audited.
    """

    __tablename__ = "disaster_events"

    __table_args__ = (
        # Efficient filtering by location + hazard type + time range (dashboard queries).
        Index("ix_disaster_events_location_hazard_time", "location_id", "hazard_type", "event_time"),
        # Efficient ordering by severity (alert rule queries).
        Index("ix_disaster_events_severity", "severity"),
        # Efficient filtering by record type (distinguishing real vs demo vs prediction)
        Index("ix_disaster_events_record_type", "record_type"),
    )

    # ── Primary key ────────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Foreign keys ────────────────────────────────────────────────────────────
    location_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Hazard classification ───────────────────────────────────────────────────
    hazard_type: Mapped[HazardType] = mapped_column(
        Enum(HazardType, name="hazardtype", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    severity: Mapped[SeverityLevel] = mapped_column(
        Enum(SeverityLevel, name="severitylevel", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )

    # ── Record Classification ───────────────────────────────────────────────────
    record_type: Mapped[RecordType] = mapped_column(
        Enum(RecordType, name="recordtype", values_callable=lambda obj: [e.name for e in obj]),
        nullable=False,
        default=RecordType.PREDICTIVE,
    )

    # ── Model output ────────────────────────────────────────────────────────────
    # Risk score in [0.0, 1.0] — calibrated probability or normalised score.
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    # Version tag of the serialised model that produced this score.
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)

    # ── Feature snapshot (JSON stored as Text for portability) ─────────────────
    # Captures the weather feature vector fed to the model.
    # Will be replaced with a JSONB column once PostgreSQL dialect is confirmed.
    feature_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Source traceability ─────────────────────────────────────────────────────
    # e.g. "open-meteo-api", "NASA COOLR", "manual-input"
    data_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # URL or reference string for historical provenance
    source_reference: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── State flags ─────────────────────────────────────────────────────────────
    alert_triggered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ── Timestamps ──────────────────────────────────────────────────────────────
    # When the event/prediction is valid for (the forecast horizon moment).
    event_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    # When this record was inserted.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # ── Notes ────────────────────────────────────────────────────────────────────
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────────
    location: Mapped["Location"] = relationship(  # noqa: F821
        "Location",
        back_populates="disaster_events",
    )
    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        "Alert",
        back_populates="disaster_event",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<DisasterEvent id={self.id} hazard={self.hazard_type} "
            f"severity={self.severity} score={self.risk_score:.3f}>"
        )
