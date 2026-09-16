import logging
from datetime import datetime, timezone
from typing import Optional

from .schemas import EnvironmentalData, ProviderStatus
from .cache import weather_cache
from .open_meteo import fetch_open_meteo_data

logger = logging.getLogger(__name__)

class EnvironmentalProvider:
    """
    Facade for external environmental data providers.
    Handles caching, routing, and fallback.
    """
    
    @staticmethod
    def get_data(lat: float, lon: float, reference_time: Optional[datetime] = None) -> EnvironmentalData:
        """
        Main entrypoint for fetching environmental features for RiskEngine.
        """
        if reference_time is None:
            # Drop microseconds for cleaner cache keys and API requests
            reference_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
            
        # 1. Check Cache (Cache key must be deterministic)
        cache_key = f"{round(lat, 4)},{round(lon, 4)}_{reference_time.isoformat()}"
        cached_data = weather_cache.get(cache_key)
        
        if cached_data is not None:
            logger.debug(f"Weather cache hit for {cache_key}")
            # Return a copy marked as CACHED
            cached_copy = cached_data.model_copy()
            cached_copy.status = ProviderStatus.CACHED
            cached_copy.retrieval_timestamp = datetime.utcnow()
            return cached_copy
            
        logger.info(f"Weather cache miss for {cache_key}. Fetching from Open-Meteo...")
        
        # 2. Fetch Live Data
        live_data = fetch_open_meteo_data(lat, lon, reference_time)
        
        # 3. Cache if Successful
        if live_data.status == ProviderStatus.LIVE and live_data.is_valid_for_real_model():
            weather_cache.set(cache_key, live_data)
            
        return live_data
