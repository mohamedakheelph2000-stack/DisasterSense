"""
Landslide Risk Feature Schemas and Input Validation.

Defines Pydantic models for Landslide risk input features, validation limits, and default parameters.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class LandslideInputSchema(BaseModel):
    """
    Input environmental and geological parameters for Landslide Risk Prediction.

    Supports both Automatic Mode (from weather API) and Manual Demo Mode.
    """

    rainfall_mm_24h: float = Field(
        default=85.0,
        ge=0.0,
        le=2000.0,
        description="Accumulated 24-hour rainfall in millimeters.",
    )
    rainfall_intensity_mm_h: float = Field(
        default=25.0,
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
    temperature_c: Optional[float] = Field(
        default=None,
        ge=-50.0,
        le=60.0,
    )
    humidity_pct: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
    )
    slope_deg: float = Field(
        default=32.0,
        ge=0.0,
        le=90.0,
        description="Terrain slope angle in degrees (steeper slopes increase landslide risk).",
    )
    elevation_m: float = Field(
        default=850.0,
        ge=-100.0,
        le=9000.0,
        description="Ground elevation in meters above sea level.",
    )
    soil_type_code: float = Field(
        default=1.0,
        ge=1.0,
        le=5.0,
        description="Soil classification code (1=Clay, 2=Silt, 3=Sand, 4=Gravel, 5=Bedrock).",
    )
    soil_moisture_pct: float = Field(
        default=78.0,
        ge=0.0,
        le=100.0,
        description="Soil moisture level percentage.",
    )
    geological_stability_index: float = Field(
        default=3.5,
        ge=0.0,
        le=10.0,
        description="Geological terrain stability rating (0=extremely unstable, 10=highly stable).",
    )
    vegetation_cover_pct: float = Field(
        default=45.0,
        ge=0.0,
        le=100.0,
        description="Forest / vegetation cover percentage (root binding mitigates risk).",
    )
    historical_landslide_count: int = Field(
        default=3,
        ge=0,
        le=100,
        description="Recorded historical landslides at or near this location.",
    )
    road_cut_proximity_m: float = Field(
        default=120.0,
        ge=0.0,
        le=50000.0,
        description="Distance to nearest steep road cut or excavation in meters.",
    )

    def to_feature_vector(self) -> List[float]:
        """Convert input schema into ordered feature vector for ML model inference."""
        return [
            self.rainfall_mm_24h,
            self.rainfall_intensity_mm_h,
            self.slope_deg,
            self.elevation_m,
            self.soil_type_code,
            self.soil_moisture_pct,
            self.geological_stability_index,
            self.vegetation_cover_pct,
            float(self.historical_landslide_count),
            self.road_cut_proximity_m,
        ]

    @classmethod
    def feature_names(cls) -> List[str]:
        """Ordered list of feature names expected by the model."""
        return [
            "rainfall_mm_24h",
            "rainfall_intensity_mm_h",
            "slope_deg",
            "elevation_m",
            "soil_type_code",
            "soil_moisture_pct",
            "geological_stability_index",
            "vegetation_cover_pct",
            "historical_landslide_count",
            "road_cut_proximity_m",
        ]
