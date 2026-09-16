import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Index
from sqlalchemy.sql import func
from app.core.database import Base

class ResourceType(str, enum.Enum):
    SHELTER = "shelter"
    HOSPITAL = "hospital"
    FIRE_STATION = "fire_station"
    POLICE_STATION = "police_station"
    RELIEF_CENTER = "relief_center"
    OTHER_EMERGENCY_RESOURCE = "other_emergency_resource"

class VerificationStatus(str, enum.Enum):
    VERIFIED = "verified"
    UNVERIFIED = "unverified"

from app.models.disaster_event import RecordType

class EmergencyResource(Base):
    __tablename__ = "emergency_resources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    resource_type = Column(Enum(ResourceType), nullable=False, index=True)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    address = Column(String(512), nullable=True)
    district = Column(String(100), nullable=True, index=True)
    
    source = Column(String(255), nullable=False)
    source_reference = Column(String(512), nullable=True)
    
    record_type = Column(Enum(RecordType), nullable=False, default=RecordType.DEMO)
    verification_status = Column(Enum(VerificationStatus), nullable=False, default=VerificationStatus.UNVERIFIED)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    
    capacity = Column(Integer, nullable=True)
    contact_info = Column(String(512), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_emergency_resources_lat_lon", "latitude", "longitude"),
    )

    def __repr__(self):
        return f"<EmergencyResource id={self.id} name={self.name} type={self.resource_type.value}>"
