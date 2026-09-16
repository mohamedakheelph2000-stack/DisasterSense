import time
from typing import Dict, Any, Tuple
from threading import Lock


class SimpleTTLMemoryCache:
    """
    Thread-safe in-memory cache with TTL (Time To Live).
    Useful for caching expensive external API calls like weather/elevation.
    """
    def __init__(self, ttl_seconds: int = 3600):
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._ttl = ttl_seconds
        self._lock = Lock()

    def get(self, key: str) -> Any:
        with self._lock:
            if key in self._cache:
                timestamp, data = self._cache[key]
                if time.time() - timestamp < self._ttl:
                    return data
                else:
                    # Expired
                    del self._cache[key]
            return None

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._cache[key] = (time.time(), value)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


# Singletons for different caching concerns
weather_cache = SimpleTTLMemoryCache(ttl_seconds=3600)  # 1 hour
elevation_cache = SimpleTTLMemoryCache(ttl_seconds=86400 * 30)  # 30 days (elevation rarely changes)
