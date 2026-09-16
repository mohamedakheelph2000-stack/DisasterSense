from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.emergency_resource import ResourceType, VerificationStatus
from app.models.disaster_event import RecordType

class EmergencyResourceBase(BaseModel):
    name: str
    resource_type: ResourceType
    latitude: float
    longitude: float
    address: Optional[str] = None
    district: Optional[str] = None
    source: str
    source_reference: Optional[str] = None
    record_type: RecordType = RecordType.DEMO
    verification_status: VerificationStatus = VerificationStatus.UNVERIFIED
    capacity: Optional[int] = None
    contact_info: Optional[str] = None

class EmergencyResourceCreate(EmergencyResourceBase):
    pass

class EmergencyResourceResponse(EmergencyResourceBase):
    id: int
    last_verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Distance in kilometers if this is returned from a proximity search
    distance_km: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class PaginatedResourceResponse(BaseModel):
    items: list[EmergencyResourceResponse]
    total: int
    page: int
    page_size: int
    pages: int
