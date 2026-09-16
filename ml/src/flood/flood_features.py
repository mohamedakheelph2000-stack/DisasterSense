"""
Flood Risk Feature Schemas and Input Validation.

Defines Pydantic models for Flood risk input features, validation limits, and default fallback parameters.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class FloodInputSchema(BaseModel):
    """
    Input environmental parameters for Flood Risk Prediction.

    Supports both Automatic Mode (from weather API) and Manual Demo Mode.
    """

    rainfall_mm_24h: float = Field(
        default=45.0,
        ge=0.0,
        le=2000.0,
        description="Accumulated 24-hour rainfall in millimeters.",
    )
    rainfall_intensity_mm_h: float = Field(
        default=12.5,
        ge=0.0,
        le=300.0,
        description="Peak rainfall intensity in millimeters per hour.",
    )
    antecedent_rainfall_7d_mm: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=5000.0,
        description="Accumulated 7-day rainfall in millimeters.",
    )
    rainfall_duration_h: float = Field(
        default=6.0,
        ge=0.0,
        le=168.0,
        description="Continuous rainfall duration in hours.",
    )
    temperature_c: float = Field(
        default=26.5,
        ge=-50.0,
        le=60.0,
        description="Ambient air temperature in Celsius.",
    )
    humidity_pct: float = Field(
        default=82.0,
        ge=0.0,
        le=100.0,
        description="Relative air humidity percentage.",
    )
    elevation_m: float = Field(
        default=35.0,
        ge=-100.0,
        le=9000.0,
        description="Ground elevation in meters above sea level.",
    )
    slope_deg: float = Field(
        default=4.5,
        ge=0.0,
        le=90.0,
        description="Terrain slope angle in degrees.",
    )
    drainage_capacity_score: float = Field(
        default=5.0,
        ge=0.0,
        le=10.0,
        description="Drainage infrastructure capacity score (0=worst, 10=excellent).",
    )
    soil_saturation_pct: float = Field(
        default=65.0,
        ge=0.0,
        le=100.0,
        description="Soil moisture / saturation level percentage.",
    )
    historical_flood_count: int = Field(
        default=2,
        ge=0,
        le=100,
        description="Number of recorded historical floods at this location.",
    )
    distance_to_river_m: float = Field(
        default=450.0,
        ge=0.0,
        le=100000.0,
        description="Proximity distance to nearest major river or waterbody in meters.",
    )

    def to_feature_vector(self) -> List[float]:
        """Convert input schema into ordered feature vector for ML model inference."""
        return [
            self.rainfall_mm_24h,
            self.rainfall_intensity_mm_h,
            self.rainfall_duration_h,
            self.temperature_c,
            self.humidity_pct,
            self.elevation_m,
            self.slope_deg,
            self.drainage_capacity_score,
            self.soil_saturation_pct,
            float(self.historical_flood_count),
            self.distance_to_river_m,
        ]

    @classmethod
    def feature_names(cls) -> List[str]:
        """Ordered list of feature names expected by the model."""
        return [
            "rainfall_mm_24h",
            "rainfall_intensity_mm_h",
            "rainfall_duration_h",
            "temperature_c",
            "humidity_pct",
            "elevation_m",
            "slope_deg",
            "drainage_capacity_score",
            "soil_saturation_pct",
            "historical_flood_count",
            "distance_to_river_m",
        ]
