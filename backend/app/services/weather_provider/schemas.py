from enum import Enum
from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ProviderStatus(str, Enum):
    LIVE = "LIVE"
    CACHED = "CACHED"
    UNAVAILABLE = "UNAVAILABLE"
    ERROR = "ERROR"


class EnvironmentalData(BaseModel):
    """Normalized environmental data response from the provider."""
    latitude: float
    longitude: float
    reference_timestamp: datetime = Field(..., description="The time for which the weather is valid")
    retrieval_timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    status: ProviderStatus
    provider_name: str
    error_message: Optional[str] = None
    
    # Core Features
    rainfall_mm_24h: Optional[float] = None
    rainfall_intensity_mm_h: Optional[float] = None
    antecedent_rainfall_7d_mm: Optional[float] = None
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    elevation_m: Optional[float] = None

    def is_valid_for_real_model(self) -> bool:
        """Check if all required features for Real ML models are present."""
        return (
            self.rainfall_mm_24h is not None and
            self.rainfall_intensity_mm_h is not None and
            self.antecedent_rainfall_7d_mm is not None and
            self.temperature_c is not None and
            self.humidity_pct is not None and
            self.elevation_m is not None
        )
