"""
Alert model.

Represents an in-app notification generated when a DisasterEvent's
risk score crosses a configured threshold.

Lifecycle:
    ACTIVE  → the alert has been raised but not yet acknowledged.
    ACKNOWLEDGED → an operator has reviewed the alert.
    RESOLVED → the underlying hazard has been cleared or expired.
    DISMISSED → the alert was closed without formal resolution.
"""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.disaster_event import SeverityLevel


class AlertStatus(str, enum.Enum):
    """Alert lifecycle state."""

    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESPONSE_IN_PROGRESS = "response_in_progress"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class Alert(Base):
    """
    In-app alert raised for a high-risk disaster event.

    An alert is always linked to:
    - the location it concerns
    - the specific DisasterEvent that triggered it

    Acknowledged_by is a free-text field for now; it will reference the
    users table after the authentication step is implemented.
    """

    __tablename__ = "alerts"

    # ── Primary key ────────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Foreign keys ────────────────────────────────────────────────────────────
    location_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    disaster_event_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("disaster_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Columns ────────────────────────────────────────────────────────────────
    source_cluster_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    cluster_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    severity: Mapped[SeverityLevel | None] = mapped_column(
        Enum(SeverityLevel),
        nullable=True,
        doc="Operator-assigned severity during escalation or override. Falls back to disaster_event.severity if null."
    )

    # ── Content ─────────────────────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # ── State ───────────────────────────────────────────────────────────────────
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, name="alertstatus"),
        nullable=False,
        default=AlertStatus.ACTIVE,
        index=True,
    )

    # ── Resolution metadata ─────────────────────────────────────────────────────
    # Will become a FK to users after auth step.
    acknowledged_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Timestamps ──────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ── Relationships ────────────────────────────────────────────────────────────
    location: Mapped["Location"] = relationship(  # noqa: F821
        "Location",
        back_populates="alerts",
    )
    disaster_event: Mapped["DisasterEvent"] = relationship(  # noqa: F821
        "DisasterEvent",
        back_populates="alerts",
    )
    audit_logs: Mapped[list["AlertAudit"]] = relationship(
        "AlertAudit",
        back_populates="alert",
        cascade="all, delete-orphan",
        order_by="asc(AlertAudit.timestamp)",
    )

    def __repr__(self) -> str:
        return f"<Alert id={self.id} status={self.status} title={self.title!r}>"


class AlertAudit(Base):
    """
    Audit trail for state transitions on an Alert.
    Tracks who did what, when, and any optional notes.
    """

    __tablename__ = "alert_audits"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    alert_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    actor: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    alert: Mapped["Alert"] = relationship("Alert", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AlertAudit alert_id={self.alert_id} action={self.action} actor={self.actor}>"
