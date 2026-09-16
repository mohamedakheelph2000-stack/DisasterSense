"""
Risk Assessment Pydantic schemas.

Request and response shapes for the Risk Assessment API endpoints.
Separate from the ML layer's internal schemas — these define the HTTP contract.
"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class FeatureImpactResponse(BaseModel):
    """Single feature impact explanation in API response."""
    feature: str
    value: float
    importance: float
    impact_level: str


class FloodAssessmentRequest(BaseModel):
    """
    Request body for POST /api/v1/risk-assessments/flood.

    All fields have sensible defaults so the API can be called with
    partial input for quick demonstrations.
    """
    model_config = {"protected_namespaces": ()}

    location_id: Optional[int] = Field(None, description="Optional location ID to associate and persist the assessment.")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Optional latitude for automatic mode.")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Optional longitude for automatic mode.")
    rainfall_mm_24h: float = Field(default=45.0, ge=0.0, le=2000.0)
    rainfall_intensity_mm_h: float = Field(default=12.5, ge=0.0, le=300.0)
    rainfall_duration_h: float = Field(default=6.0, ge=0.0, le=168.0)
    temperature_c: float = Field(default=26.5, ge=-50.0, le=60.0)
    humidity_pct: float = Field(default=82.0, ge=0.0, le=100.0)
    elevation_m: float = Field(default=35.0, ge=-100.0, le=9000.0)
    slope_deg: float = Field(default=4.5, ge=0.0, le=90.0)
    drainage_capacity_score: float = Field(default=5.0, ge=0.0, le=10.0)
    soil_saturation_pct: float = Field(default=65.0, ge=0.0, le=100.0)
    historical_flood_count: int = Field(default=2, ge=0, le=100)
    distance_to_river_m: float = Field(default=450.0, ge=0.0, le=100000.0)


class LandslideAssessmentRequest(BaseModel):
    """
    Request body for POST /api/v1/risk-assessments/landslide.
    """
    model_config = {"protected_namespaces": ()}

    location_id: Optional[int] = Field(None, description="Optional location ID to associate and persist the assessment.")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Optional latitude for automatic mode.")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Optional longitude for automatic mode.")
    rainfall_mm_24h: float = Field(default=85.0, ge=0.0, le=2000.0)
    rainfall_intensity_mm_h: float = Field(default=25.0, ge=0.0, le=300.0)
    slope_deg: float = Field(default=32.0, ge=0.0, le=90.0)
    elevation_m: float = Field(default=850.0, ge=-100.0, le=9000.0)
    soil_type_code: float = Field(default=1.0, ge=1.0, le=5.0)
    soil_moisture_pct: float = Field(default=78.0, ge=0.0, le=100.0)
    geological_stability_index: float = Field(default=3.5, ge=0.0, le=10.0)
    vegetation_cover_pct: float = Field(default=45.0, ge=0.0, le=100.0)
    historical_landslide_count: int = Field(default=3, ge=0, le=100)
    road_cut_proximity_m: float = Field(default=120.0, ge=0.0, le=50000.0)


class RiskAssessmentResponse(BaseModel):
    """
    Standardized response for risk assessment endpoints.

    Returned by both flood and landslide prediction APIs.
    """
    model_config = {"protected_namespaces": ()}

    hazard_type: str = Field(..., description="'flood' or 'landslide'")
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Normalized risk score 0–100")
    risk_level: str = Field(..., description="Categorical level: Very Low, Low, Moderate, High, Critical")
    severity: str = Field(..., description="DB severity: low, moderate, high, critical")
    probability: float = Field(..., ge=0.0, le=1.0, description="Risk probability 0–1")
    model_name: str = Field(..., description="Model identifier")
    model_version: str = Field(..., description="Model version tag")
    prediction_source: str = Field(..., description="'ml_model' or 'fallback_heuristic'")
    inference_source: Optional[str] = Field(None, description="The layer of the engine that performed the inference (real_model, synthetic_model, heuristic)")
    dataset_version: Optional[str] = Field(None, description="The dataset version the model was trained on")
    input_mode: str = Field(..., description="'manual' or 'automatic'")
    location_id: Optional[int] = Field(None, description="Associated location ID if persisted")
    event_id: Optional[int] = Field(None, description="Persisted DisasterEvent ID if saved to DB")
    features_used: Dict[str, float] = Field(..., description="Input features evaluated")
    feature_impacts: List[FeatureImpactResponse] = Field(..., description="Ranked feature explanations")
    assessed_at: datetime = Field(..., description="Assessment timestamp")


class AutomaticProviderStatus(BaseModel):
    """Response schema for automatic weather provider status check."""
    provider: str
    available: bool
    message: str


class PaginatedResponse(BaseModel):
    """Generic pagination wrapper used by collection endpoints."""
    items: list
    total: int
    page: int
    page_size: int
    pages: int
