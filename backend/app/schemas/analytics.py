from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class TrendDataPoint(BaseModel):
    date: str = Field(..., description="Date string in YYYY-MM-DD format")
    historical_events: int = Field(0, description="Count of historical events on this date")
    predictive_assessments: int = Field(0, description="Count of predictive risk assessments on this date")
    active_alerts: int = Field(0, description="Count of active alerts on this date")
    flood_max_risk: float = Field(0.0, description="Max flood risk score on this date")
    landslide_max_risk: float = Field(0.0, description="Max landslide risk score on this date")

class TrendResponse(BaseModel):
    items: List[TrendDataPoint] = Field(..., description="Chronological list of daily trend data points")

class AnalyticsSummary(BaseModel):
    total_historical_events: int
    total_predictive_assessments: int
    active_alerts: int
    resolved_alerts: int
    total_locations: int

class HazardComparison(BaseModel):
    flood_events: int
    landslide_events: int
    flood_alerts: int
    landslide_alerts: int
    flood_avg_risk: Optional[float]
    landslide_avg_risk: Optional[float]

class SeverityCounts(BaseModel):
    VERY_LOW: int = 0
    LOW: int = 0
    MODERATE: int = 0
    HIGH: int = 0
    CRITICAL: int = 0

class SeverityDistribution(BaseModel):
    historical: SeverityCounts
    predictive: SeverityCounts

class LocationIncidentCount(BaseModel):
    location_id: int
    name: str
    latitude: float
    longitude: float
    historical_events: int
    predictive_alerts: int
    total_incidents: int

class GeographicConcentration(BaseModel):
    locations: List[LocationIncidentCount]

class DataQualityMetrics(BaseModel):
    total_records: int
    oldest_record_date: Optional[str]
    newest_record_date: Optional[str]
    records_missing_coordinates: int
    demo_records_count: int
