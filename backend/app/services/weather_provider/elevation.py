import requests
import logging
from typing import Optional

from .cache import elevation_cache

logger = logging.getLogger(__name__)

# Using Open-Elevation API (or standard fallback)
ELEVATION_API_URL = "https://api.open-elevation.com/api/v1/lookup"

def get_elevation(lat: float, lon: float) -> Optional[float]:
    """
    Fetch elevation for a given lat/lon.
    Uses aggressive caching since elevation doesn't change.
    """
    # Rounding coordinates slightly to improve cache hit rates
    # 4 decimal places is roughly 11 meters resolution, enough for caching
    cache_key = f"{round(lat, 4)},{round(lon, 4)}"
    
    cached_val = elevation_cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    try:
        resp = requests.get(
            ELEVATION_API_URL, 
            params={"locations": f"{lat},{lon}"},
            timeout=5.0
        )
        resp.raise_for_status()
        data = resp.json()
        
        if "results" in data and len(data["results"]) > 0:
            elevation = float(data["results"][0]["elevation"])
            elevation_cache.set(cache_key, elevation)
            return elevation
            
    except Exception as e:
        logger.warning(f"Failed to fetch elevation for {lat},{lon}: {e}")
        
    return None
