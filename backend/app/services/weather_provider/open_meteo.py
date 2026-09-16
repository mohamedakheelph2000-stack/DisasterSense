import requests
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple

from .schemas import EnvironmentalData, ProviderStatus
from .elevation import get_elevation

logger = logging.getLogger(__name__)

# Base API for real-time and recent past
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_open_meteo_data(lat: float, lon: float, reference_time: datetime) -> EnvironmentalData:
    """
    Fetches real-time / recent historical environmental data from Open-Meteo.
    Calculates:
    - 24h accumulated rainfall
    - max hourly rainfall intensity in 24h
    - 7-day antecedent rainfall
    - temperature and humidity at the reference time
    """
    # Enforce bounding boxes for security / sanity
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        return _build_error_response(lat, lon, reference_time, "Invalid coordinates")
        
    try:
        # Calculate dates. Open-Meteo requires YYYY-MM-DD
        # We need 7 days strictly prior to the reference_time for antecedent rainfall
        end_date = reference_time.strftime('%Y-%m-%d')
        start_date = (reference_time - timedelta(days=8)).strftime('%Y-%m-%d')
        
        params = {
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "temperature_2m,relative_humidity_2m,precipitation",
            "timezone": "UTC"
        }
        
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        
        return _process_open_meteo_response(data, lat, lon, reference_time)
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Open-Meteo API Error: {e}")
        return _build_error_response(lat, lon, reference_time, f"API Error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error parsing Open-Meteo data: {e}")
        return _build_error_response(lat, lon, reference_time, "Internal Parsing Error")

def _process_open_meteo_response(data: dict, lat: float, lon: float, ref_time: datetime) -> EnvironmentalData:
    """Processes the raw Open-Meteo JSON into structured EnvironmentalData."""
    if "hourly" not in data or "time" not in data["hourly"]:
        return _build_error_response(lat, lon, ref_time, "Malformed API response (missing hourly data)")
        
    times = data["hourly"]["time"]
    precip = data["hourly"]["precipitation"]
    temps = data["hourly"]["temperature_2m"]
    humidities = data["hourly"]["relative_humidity_2m"]
    
    # We must find the index corresponding to the ref_time (rounded to nearest hour)
    ref_time_str = ref_time.strftime('%Y-%m-%dT%H:00')
    try:
        # Note: Open-Meteo returns times in ISO format without Z if timezone=UTC
        ref_idx = times.index(ref_time_str)
    except ValueError:
        # If the exact hour is not found (e.g. data not generated yet for future hours), 
        # default to the last available index if it's close, else error.
        logger.warning(f"Exact ref_time {ref_time_str} not found. Attempting nearest past hour.")
        try:
            # Simple fallback to last hour available
            ref_idx = len(times) - 1
            if ref_idx < 0:
                raise ValueError
        except ValueError:
            return _build_error_response(lat, lon, ref_time, f"Reference time {ref_time_str} out of bounds")

    # 1. 24-hour rainfall & intensity
    # The 24 hours strictly leading up to (and including) ref_idx
    start_24h_idx = max(0, ref_idx - 23)
    precip_24h_slice = precip[start_24h_idx:ref_idx + 1]
    
    # Filter out Nones
    precip_24h_clean = [p for p in precip_24h_slice if p is not None]
    if not precip_24h_clean:
        return _build_error_response(lat, lon, ref_time, "Missing precipitation data for 24h window")
        
    rainfall_mm_24h = sum(precip_24h_clean)
    rainfall_intensity_mm_h = max(precip_24h_clean)
    
    # 2. 7-day antecedent rainfall
    # The 168 hours (7 days) BEFORE the 24h window
    start_7d_idx = max(0, start_24h_idx - 168)
    precip_7d_slice = precip[start_7d_idx:start_24h_idx]
    
    precip_7d_clean = [p for p in precip_7d_slice if p is not None]
    antecedent_rainfall_7d_mm = sum(precip_7d_clean)
    
    # 3. Current Temp and Humidity
    temp = temps[ref_idx]
    hum = humidities[ref_idx]
    
    if temp is None or hum is None:
        return _build_error_response(lat, lon, ref_time, "Missing temperature or humidity data at reference time")
        
    # Sanity checks
    if rainfall_mm_24h < 0 or antecedent_rainfall_7d_mm < 0 or hum < 0 or hum > 100:
        return _build_error_response(lat, lon, ref_time, "Impossible environmental values retrieved")

    # Fetch elevation synchronously
    elevation = get_elevation(lat, lon)
    
    return EnvironmentalData(
        latitude=lat,
        longitude=lon,
        reference_timestamp=ref_time,
        status=ProviderStatus.LIVE,
        provider_name="open-meteo",
        rainfall_mm_24h=round(rainfall_mm_24h, 2),
        rainfall_intensity_mm_h=round(rainfall_intensity_mm_h, 2),
        antecedent_rainfall_7d_mm=round(antecedent_rainfall_7d_mm, 2),
        temperature_c=round(temp, 2),
        humidity_pct=round(hum, 1),
        elevation_m=elevation if elevation is not None else None
    )

def _build_error_response(lat: float, lon: float, ref_time: datetime, msg: str) -> EnvironmentalData:
    return EnvironmentalData(
        latitude=lat,
        longitude=lon,
        reference_timestamp=ref_time,
        status=ProviderStatus.ERROR,
        provider_name="open-meteo",
        error_message=msg
    )
