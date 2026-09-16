"""
Alert Pydantic schemas.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.alert import AlertStatus
from app.models.disaster_event import SeverityLevel


class AlertAuditRead(BaseModel):
    """Schema for a single audit log entry on an alert."""

    id: int
    alert_id: int
    actor: str
    action: str
    note: str | None
    timestamp: datetime

    model_config = {"from_attributes": True}


class AlertRead(BaseModel):
    """Schema returned when fetching alert records."""

    id: int
    location_id: int
    disaster_event_id: int
    source_cluster_id: str | None = None
    cluster_metadata: dict | None = None
    severity: SeverityLevel | None = None
    title: str
    message: str
    status: AlertStatus
    acknowledged_by: str | None
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    audit_logs: list[AlertAuditRead] = []

    model_config = {"from_attributes": True}


class AlertCreate(BaseModel):
    """Schema used to create an alert from a disaster event."""

    location_id: int
    disaster_event_id: int
    title: str = Field(..., min_length=1, max_length=300)
    message: str = Field(..., min_length=1)


class AlertAcknowledge(BaseModel):
    """Schema for acknowledging an alert."""

    acknowledged_by: str = Field(..., min_length=1, max_length=200)


class AlertUpdate(BaseModel):
    """Fields allowed in a PUT/PATCH request for alerts."""

    title: str | None = Field(None, min_length=1, max_length=300)
    message: str | None = Field(None, min_length=1)
    status: AlertStatus | None = None


class AlertRespond(BaseModel):
    """Schema for marking an alert as response_in_progress."""

    actor: str = Field(..., min_length=1, max_length=200)
    note: str | None = Field(None)


class AlertNoteCreate(BaseModel):
    """Schema for adding an audit note without changing state."""

    actor: str = Field(..., min_length=1, max_length=200)
    note: str = Field(..., min_length=1)
