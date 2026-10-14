from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query

from app.services.weather_service import (
    get_realtime_weather_forecast,
    KERALA_WEATHER_STATIONS,
    weather_cache,
)

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/forecast", summary="Get Google-Style Realtime Weather Forecast & Predictions")
def get_weather_forecast(
    latitude: float = Query(11.605, ge=-90.0, le=90.0, description="Latitude (default: Wayanad, Kerala)"),
    longitude: float = Query(76.083, ge=-180.0, le=180.0, description="Longitude (default: Wayanad, Kerala)"),
    location_name: Optional[str] = Query(None, description="Location name"),
    district: Optional[str] = Query(None, description="District name"),
) -> Dict[str, Any]:
    """
    Returns real-time weather conditions, 24-hour hourly forecast, 7-day daily forecast,
    Google/phone style atmospheric vitals, and predictive disaster hazard ratings.
    """
    return get_realtime_weather_forecast(
        lat=latitude,
        lon=longitude,
        location_name=location_name,
        district=district
    )


@router.get("/stations", summary="List Curated Weather Monitoring Stations across Kerala")
def list_weather_stations() -> List[Dict[str, Any]]:
    """Returns curated Kerala district weather stations with pre-configured coordinates."""
    return KERALA_WEATHER_STATIONS


@router.post("/refresh", summary="Force Real-time Weather Refresh")
def refresh_weather(
    latitude: float = Query(11.605, ge=-90.0, le=90.0),
    longitude: float = Query(76.083, ge=-180.0, le=180.0),
) -> Dict[str, Any]:
    """Clears in-memory cache for coordinates and fetches immediate live weather."""
    key = f"{round(latitude, 2)}_{round(longitude, 2)}"
    with weather_cache._lock:
        if key in weather_cache._cache:
            del weather_cache._cache[key]
    return get_realtime_weather_forecast(latitude, longitude)
