"""
Flood Event Acquisition Adapter (Prototype)

Simulates acquiring positive flood labels from the Global Flood Database (DFO/Cloud to Street).
Because GFD is a massive GeoTIFF dataset (gs://gfd_v1_4), we use an adapter interface here 
to provide a representative tiny fixture of historical Kerala/Western Ghats flood events.

Output fields:
event_id, source, event_time, latitude, longitude, event_type, severity_if_available, affected_area_if_available, source_reference
"""

import pandas as pd
from typing import List, Dict, Any

class GlobalFloodDatabaseAdapter:
    """Adapter for retrieving Global Flood Database events."""
    
    def __init__(self, use_mock: bool = True):
        self.use_mock = use_mock
        # In a real implementation, this adapter would query Google Earth Engine 
        # or parse the localized GeoTIFFs to extract centroid points of inundation.
        
    def fetch_events(self) -> pd.DataFrame:
        """
        Retrieves a DataFrame of normalized flood events.
        """
        if self.use_mock:
            return self._get_mock_fixture()
        
        # Read the real subset (representing the actual extracted GFD data)
        import os
        csv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'raw', 'real_floods.csv')
        df = pd.read_csv(csv_path)
        df['event_time'] = pd.to_datetime(df['event_time'], utc=True)
        return df

    def _get_mock_fixture(self) -> pd.DataFrame:
        """Return a small representative subset of the 2018/2019 Kerala floods."""
        data: List[Dict[str, Any]] = [
            {
                "event_id": "GFD_IN_2018_01",
                "source": "global_flood_database",
                "event_time": "2018-08-15T00:00:00Z",
                "latitude": 10.8505,
                "longitude": 76.2711,
                "event_type": "flood",
                "severity_if_available": None, # GFD provides extent, not severity class directly
                "affected_area_if_available": 12.5, # sq km
                "source_reference": "MODIS_GFD_v1.4_4677"
            },
            {
                "event_id": "GFD_IN_2018_02",
                "source": "global_flood_database",
                "event_time": "2018-08-16T00:00:00Z",
                "latitude": 9.9312,
                "longitude": 76.2673,
                "event_type": "flood",
                "severity_if_available": None,
                "affected_area_if_available": 45.2,
                "source_reference": "MODIS_GFD_v1.4_4677"
            },
            {
                "event_id": "GFD_IN_2019_01",
                "source": "global_flood_database",
                "event_time": "2019-08-08T00:00:00Z",
                "latitude": 11.6050, # Wayanad area
                "longitude": 76.0830,
                "event_type": "flood",
                "severity_if_available": None,
                "affected_area_if_available": 8.1,
                "source_reference": "MODIS_GFD_v1.4_4892"
            }
        ]
        
        df = pd.DataFrame(data)
        # Ensure event_time is a proper datetime object (UTC)
        df['event_time'] = pd.to_datetime(df['event_time'], utc=True)
        return df

if __name__ == "__main__":
    adapter = GlobalFloodDatabaseAdapter()
    df = adapter.fetch_events()
    print("Flood Events Prototype:")
    print(df.head())
