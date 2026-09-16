"""
DisasterEvent Pydantic schemas.

Read-optimised: the ML pipeline creates events via the service layer.
API clients only read and filter them.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.disaster_event import HazardType, SeverityLevel, RecordType


class DisasterEventRead(BaseModel):
    """
    Schema returned when fetching disaster event records.

    risk_score is in [0.0, 1.0]; feature_snapshot is a raw JSON string
    (opaque to the API consumer — used for audit/traceability).
    """

    id: int
    location_id: int
    hazard_type: HazardType
    severity: SeverityLevel
    record_type: RecordType
    risk_score: float = Field(..., ge=0.0, le=1.0)
    model_version: str
    data_source: str | None
    source_reference: str | None
    feature_snapshot: str | None
    alert_triggered: bool
    event_time: datetime
    created_at: datetime
    notes: str | None

    model_config = {
        "from_attributes": True,
        # model_version is a domain field; allow the model_ prefix here.
        "protected_namespaces": (),
    }


class DisasterEventCreate(BaseModel):
    """
    Schema used internally by the ML inference service to insert records.

    Not exposed directly as a public API endpoint in this step.
    """

    location_id: int
    hazard_type: HazardType
    severity: SeverityLevel
    record_type: RecordType = RecordType.PREDICTIVE
    risk_score: float = Field(..., ge=0.0, le=1.0)
    model_version: str = Field(..., min_length=1, max_length=50)
    data_source: str | None = Field(None, max_length=100)
    source_reference: str | None = Field(None, max_length=500)
    feature_snapshot: str | None = None
    alert_triggered: bool = False
    event_time: datetime
    notes: str | None = None

    model_config = {"protected_namespaces": ()}


class DisasterEventUpdate(BaseModel):
    """Fields allowed in a PUT/PATCH request for disaster events."""

    severity: SeverityLevel | None = None
    notes: str | None = None
    alert_triggered: bool | None = None

    model_config = {"protected_namespaces": ()}
