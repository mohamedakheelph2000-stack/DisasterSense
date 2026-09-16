from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class ClusterMetadata(BaseModel):
    cluster_id: str
    hazard_type: str
    record_type: str
    centroid_lat: float
    centroid_lon: float
    member_count: int
    first_timestamp: datetime
    latest_timestamp: datetime
    duration_hours: float
    average_risk: float
    max_risk: float
    high_risk_count: int
    critical_risk_count: int
    provenance: List[str]
    member_ids: List[int]
    quality_indicator: str  # e.g., LOW_DATA, MODERATE_DATA, WELL_SUPPORTED

class ClusterResponseMetadata(BaseModel):
    time_window: str
    hazard: Optional[str]
    record_type: str
    total_clusters: int
    total_assessments: int
    spatial_threshold_km: float
    temporal_threshold_hours: float

class ClusterResponse(BaseModel):
    metadata: ClusterResponseMetadata
    clusters: List[ClusterMetadata]

class EscalateClusterRequest(BaseModel):
    member_ids: List[int]
    severity: str
    operational_note: Optional[str] = None
    hazard_type: str
    record_type: str
    time_window: str = "7d"

class EscalateClusterResponse(BaseModel):
    alert_id: int
    cluster_id: str
    escalation_status: str
    notification_status: str
