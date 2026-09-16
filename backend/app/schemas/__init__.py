"""
Pydantic schema registry.

Import all schema classes here for convenient access:
    from app.schemas import UserRead, LocationCreate, ...
"""

from app.schemas.alert import AlertAcknowledge, AlertCreate, AlertRead, AlertStatus, AlertUpdate
from app.schemas.disaster_event import (
    DisasterEventCreate,
    DisasterEventRead,
    DisasterEventUpdate,
    HazardType,
    SeverityLevel,
)
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.schemas.risk_assessment import (
    FloodAssessmentRequest,
    LandslideAssessmentRequest,
    RiskAssessmentResponse,
    AutomaticProviderStatus,
    PaginatedResponse,
)
from app.schemas.user import UserCreate, UserRead, UserRole, UserUpdate

__all__ = [
    "UserCreate",
    "UserRead",
    "UserUpdate",
    "UserRole",
    "LocationCreate",
    "LocationRead",
    "LocationUpdate",
    "DisasterEventCreate",
    "DisasterEventRead",
    "DisasterEventUpdate",
    "HazardType",
    "SeverityLevel",
    "AlertCreate",
    "AlertRead",
    "AlertAcknowledge",
    "AlertUpdate",
    "AlertStatus",
    "FloodAssessmentRequest",
    "LandslideAssessmentRequest",
    "RiskAssessmentResponse",
    "AutomaticProviderStatus",
    "PaginatedResponse",
]
