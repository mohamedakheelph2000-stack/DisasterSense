from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.services.weather_provider.schemas import ProviderStatus

class EnvironmentCurrentResponse(BaseModel):
    """
    Response schema for current environmental telemetry.
    """
    rainfall_24h: Optional[float] = Field(None, description="24-hour accumulated rainfall (mm)")
    rainfall_intensity: Optional[float] = Field(None, description="Max hourly rainfall intensity (mm/h)")
    antecedent_rainfall_7d: Optional[float] = Field(None, description="7-day antecedent rainfall (mm)")
    temperature: Optional[float] = Field(None, description="Current temperature (Celsius)")
    humidity: Optional[float] = Field(None, description="Current relative humidity (%)")
    elevation: Optional[float] = Field(None, description="Ground elevation (m)")
    reference_timestamp: datetime = Field(..., description="The time for which this data is valid")
    provider: str = Field("open-meteo", description="Name of the data provider")
    status: ProviderStatus = Field(..., description="Data retrieval status (LIVE, CACHED, ERROR)")
