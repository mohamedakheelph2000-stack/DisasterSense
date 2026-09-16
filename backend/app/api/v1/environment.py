from typing import Any
from fastapi import APIRouter, Depends, Query
from app.api.deps import get_current_user
from app.schemas.environment import EnvironmentCurrentResponse
from app.services.weather_provider import EnvironmentalProvider

router = APIRouter()
provider = EnvironmentalProvider()

@router.get("/current", response_model=EnvironmentCurrentResponse)
def get_current_environment(
    latitude: float = Query(11.605, ge=-90.0, le=90.0, description="Latitude (default: Wayanad, Kerala)"),
    longitude: float = Query(76.083, ge=-180.0, le=180.0, description="Longitude (default: Wayanad, Kerala)"),
    user: Any = Depends(get_current_user)
):
    """
    Get current environmental telemetry for the given coordinates.
    Defaults to Wayanad, Kerala if no coordinates are provided.
    
    This endpoint utilizes the same resilient cache layer and Open-Meteo
    integrations used by the automatic risk assessment.
    """
    env_data = provider.get_data(latitude, longitude)
    
    return EnvironmentCurrentResponse(
        rainfall_24h=env_data.rainfall_mm_24h,
        rainfall_intensity=env_data.rainfall_intensity_mm_h,
        antecedent_rainfall_7d=env_data.antecedent_rainfall_7d_mm,
        temperature=env_data.temperature_c,
        humidity=env_data.humidity_pct,
        elevation=env_data.elevation_m,
        reference_timestamp=env_data.reference_timestamp,
        provider="open-meteo",
        status=env_data.status
    )
