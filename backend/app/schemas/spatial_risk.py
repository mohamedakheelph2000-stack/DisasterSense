from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class SpatialCell(BaseModel):
    cell_id: str
    center_lat: float
    center_lon: float
    hazard_type: str
    record_type: str
    average_risk: float
    max_risk: float
    min_risk: float
    latest_risk: float
    latest_assessment_time: datetime
    assessment_count: int
    high_risk_count: int
    critical_risk_count: int
    risk_category: str
    provenance: List[str]

class AggregationMetadata(BaseModel):
    time_window: str
    hazard: Optional[str]
    record_type: str
    cell_size: float
    total_cells: int
    total_assessments: int

class SpatialAggregationResponse(BaseModel):
    aggregation_metadata: AggregationMetadata
    cells: List[SpatialCell]
