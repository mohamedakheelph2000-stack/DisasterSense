"""
ORM model registry.

Import every model here so that:
  1. SQLAlchemy's Base.metadata knows about all tables.
  2. Alembic's autogenerate can detect schema changes.
  3. Application code can do:  from app.models import User, Location, ...

Import order respects foreign-key dependencies:
    Location before DisasterEvent and Alert (both FK → locations)
    DisasterEvent before Alert (Alert FK → disaster_events)
"""

from app.models.user import User, UserRole
from app.models.location import Location
from app.models.disaster_event import DisasterEvent, HazardType, SeverityLevel, RecordType
from app.models.alert import Alert, AlertStatus
from app.models.notification import NotificationDelivery, DeliveryStatus, NotificationChannel
from app.models.emergency_resource import EmergencyResource, ResourceType, VerificationStatus
from app.models.ml_feedback import MLFeedback, FeedbackType, ReviewStatus
from app.models.dataset_candidate import DatasetCandidate, CandidateStatus
from app.models.ml_governance_audit import MLGovernanceAudit

__all__ = [
    "User",
    "UserRole",
    "Location",
    "DisasterEvent",
    "HazardType",
    "SeverityLevel",
    "RecordType",
    "Alert",
    "AlertStatus",
    "NotificationDelivery",
    "DeliveryStatus",
    "NotificationChannel",
    "EmergencyResource",
    "ResourceType",
    "VerificationStatus",
    "MLFeedback",
    "FeedbackType",
    "ReviewStatus",
    "DatasetCandidate",
    "CandidateStatus",
    "MLGovernanceAudit",
]
