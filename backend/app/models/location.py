"""
Location model.

Represents a named geographic point used as a reference for
disaster event predictions and resource deployments.

Using latitude/longitude floats for now.  If PostGIS is adopted in a
later step (see open design decisions in system-overview.md), a
Geography or Geometry column can replace or augment these fields
without breaking existing data.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Location(Base):
    """
    Named geographic location for prediction and resource tracking.

    Indexed on (latitude, longitude) to support efficient spatial
    proximity queries even without PostGIS.
    """

    __tablename__ = "locations"

    __table_args__ = (
        # Composite index for bounding-box queries (lat/lon range scans).
        Index("ix_locations_lat_lon", "latitude", "longitude"),
    )

    # ── Primary key ────────────────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # ── Identity ────────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Geographic coordinates ──────────────────────────────────────────────────
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    # Optional elevation in metres — useful for landslide risk assessment.
    elevation_m: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Administrative context ──────────────────────────────────────────────────
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")

    # ── Timestamps ──────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # ── Relationships (declared here; back-populated from child models) ─────────
    disaster_events: Mapped[list["DisasterEvent"]] = relationship(  # noqa: F821
        "DisasterEvent",
        back_populates="location",
        cascade="all, delete-orphan",
    )
    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        "Alert",
        back_populates="location",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Location id={self.id} name={self.name!r} ({self.latitude}, {self.longitude})>"
