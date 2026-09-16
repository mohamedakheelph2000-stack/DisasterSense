"""
Landslide Event Acquisition Adapter (Prototype)

Simulates acquiring positive landslide labels from the NASA Global Landslide Catalog (COOLR).
For prototype purposes, we mock a few events from the 2018/2019 monsoon seasons in Kerala.

Output fields:
event_id, source, event_time, latitude, longitude, event_type, trigger_if_available, severity_if_available, source_reference
"""

import pandas as pd
from typing import List, Dict, Any

class NASALandslideCatalogAdapter:
    """Adapter for retrieving NASA GLC (COOLR) events."""
    
    def __init__(self, use_mock: bool = True):
        self.use_mock = use_mock
        
    def fetch_events(self) -> pd.DataFrame:
        """
        Retrieves a DataFrame of normalized landslide events.
        """
        if self.use_mock:
            return self._get_mock_fixture()
        
        # Read the real subset (representing the actual extracted NASA GLC data)
        import os
        csv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'raw', 'real_landslides.csv')
        df = pd.read_csv(csv_path)
        df['event_time'] = pd.to_datetime(df['event_time'], utc=True)
        return df

    def _get_mock_fixture(self) -> pd.DataFrame:
        """Return a small representative subset of Kerala landslides."""
        data: List[Dict[str, Any]] = [
            {
                "event_id": "GLC_IN_11200",
                "source": "nasa_glc",
                "event_time": "2018-08-15T12:00:00Z", # GLC dates sometimes have time, sometimes don't.
                "latitude": 10.0892,
                "longitude": 77.0597, # Idukki area
                "event_type": "landslide",
                "trigger_if_available": "downpour",
                "severity_if_available": "medium", 
                "source_reference": "https://gpm.nasa.gov/landslides/"
            },
            {
                "event_id": "GLC_IN_11201",
                "source": "nasa_glc",
                "event_time": "2018-08-16T08:30:00Z",
                "latitude": 11.5364,
                "longitude": 76.0825, # Wayanad area
                "event_type": "landslide",
                "trigger_if_available": "continuous_rain",
                "severity_if_available": "high",
                "source_reference": "https://gpm.nasa.gov/landslides/"
            },
            {
                "event_id": "GLC_IN_11500",
                "source": "nasa_glc",
                "event_time": "2019-08-08T15:00:00Z",
                "latitude": 11.4880,
                "longitude": 76.1360, # Puthumala area
                "event_type": "landslide",
                "trigger_if_available": "extreme_rainfall",
                "severity_if_available": "catastrophic",
                "source_reference": "https://gpm.nasa.gov/landslides/"
            }
        ]
        
        df = pd.DataFrame(data)
        # Ensure event_time is a proper datetime object (UTC)
        df['event_time'] = pd.to_datetime(df['event_time'], utc=True)
        return df

if __name__ == "__main__":
    adapter = NASALandslideCatalogAdapter()
    df = adapter.fetch_events()
    print("Landslide Events Prototype:")
    print(df.head())
