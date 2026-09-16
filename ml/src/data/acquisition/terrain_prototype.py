"""
Terrain Extraction Adapter (Prototype)

Simulates fetching elevation and calculating slope from the SRTM 30m DEM.
In production, this would use a local raster dataset or Google Earth Engine API.
For the prototype, we mock realistic elevation and slope values for the Western Ghats.
"""

from typing import Dict, Any
import numpy as np

class TerrainAdapter:
    """Adapter for retrieving SRTM DEM features for specific event coordinates."""
    
    def __init__(self, use_mock: bool = True):
        self.use_mock = use_mock
        
    def fetch_terrain_features(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Retrieves terrain features for a specific lat/lon coordinate.
        """
        if self.use_mock:
            return self._get_mock_terrain(latitude, longitude)
            
        return self._get_real_terrain(latitude, longitude)

    def _get_real_terrain(self, latitude: float, longitude: float) -> Dict[str, Any]:
        import requests
        
        # Open-Elevation API
        url = f"https://api.open-elevation.com/api/v1/lookup?locations={latitude},{longitude}"
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            elevation = data.get("results", [{}])[0].get("elevation", 0.0)
        except Exception as e:
            print(f"Warning: Failed to fetch elevation from API: {e}. Defaulting to 0.0")
            elevation = 0.0
            
        # Slope requires surrounding raster points; unavailable via this simple point API.
        return {
            "elevation_m": float(elevation),
            "slope_deg": 0.0  # UNAVAILABLE in point-query API
        }

    def _get_mock_terrain(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Return a mocked dictionary of terrain features.
        Simulates terrain in the Western Ghats (high elevation, steep slopes).
        """
        # We assume if latitude is > 9 and < 12, it's broadly Kerala/Western Ghats
        
        # High-elevation areas (Wayanad/Idukki approximate logic)
        is_highland = (76.0 < longitude < 77.2) and (9.5 < latitude < 12.0)
        
        if is_highland:
            elevation = float(np.random.uniform(500.0, 2000.0))
            slope = float(np.random.uniform(15.0, 45.0))  # steep
        else:
            elevation = float(np.random.uniform(5.0, 200.0))
            slope = float(np.random.uniform(0.0, 10.0))   # flat
            
        return {
            "elevation_m": round(elevation, 1),
            "slope_deg": round(slope, 1)
        }

if __name__ == "__main__":
    adapter = TerrainAdapter()
    
    highland = adapter.fetch_terrain_features(10.0892, 77.0597) # Idukki
    print(f"Idukki Terrain: {highland}")
    
    lowland = adapter.fetch_terrain_features(9.9312, 76.2673) # Kochi
    print(f"Kochi Terrain: {lowland}")
