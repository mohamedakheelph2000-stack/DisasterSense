"""
Historical Weather Extraction Adapter (Prototype)

Simulates fetching ERA5 historical data (via Open-Meteo or similar API) for a given location and time.
Extracts:
- rainfall_mm_24h (precipitation on the day of the event)
- rainfall_intensity_mm_h (peak hourly precipitation)
- rainfall_duration_h (number of hours with > 0.1mm rain)
- antecedent_rainfall_7d_mm (cumulative rain in the 7 days prior)
- temperature_c (daily mean)
- humidity_pct (daily mean)

Features exact temporal aggregation rules.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any

class HistoricalWeatherAdapter:
    """Adapter for retrieving ERA5 meteorological features for specific event coordinates."""
    
    def __init__(self, use_mock: bool = True):
        self.use_mock = use_mock
        # Timezone handling: We assume event times are UTC, and we request UTC weather data.
        
    def fetch_weather_features(self, latitude: float, longitude: float, event_time_utc: pd.Timestamp) -> Dict[str, Any]:
        """
        Retrieves weather features for a specific lat/lon and datetime.
        """
        if self.use_mock:
            return self._get_mock_weather(latitude, longitude, event_time_utc)
            
        return self._get_real_weather(latitude, longitude, event_time_utc)

    def _get_real_weather(self, latitude: float, longitude: float, event_time_utc: pd.Timestamp) -> Dict[str, Any]:
        import requests
        
        # ERA5 via Open-Meteo Historical Archive
        end_date = event_time_utc.strftime("%Y-%m-%d")
        start_date = (event_time_utc - timedelta(days=7)).strftime("%Y-%m-%d")
        
        url = "https://archive-api.open-meteo.com/v1/era5"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "temperature_2m,relative_humidity_2m,precipitation",
            "timezone": "UTC"
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        hourly = data.get("hourly", {})
        precip = hourly.get("precipitation", [])
        temp = hourly.get("temperature_2m", [])
        humidity = hourly.get("relative_humidity_2m", [])
        
        # event day is the last 24 hours of the array
        event_day_precip = precip[-24:]
        antecedent_precip = precip[:-24]
        
        # Replace Nones with 0 for precipitation
        event_day_precip = [p if p is not None else 0 for p in event_day_precip]
        antecedent_precip = [p if p is not None else 0 for p in antecedent_precip]
        
        rainfall_24h = sum(event_day_precip)
        intensity = max(event_day_precip) if event_day_precip else 0.0
        duration = sum(1 for p in event_day_precip if p > 0.1)
        antecedent_7d = sum(antecedent_precip)
        
        # Mean temp/humidity over the last 24h
        valid_temp = [t for t in temp[-24:] if t is not None]
        mean_temp = sum(valid_temp) / len(valid_temp) if valid_temp else 25.0
        
        valid_hum = [h for h in humidity[-24:] if h is not None]
        mean_hum = sum(valid_hum) / len(valid_hum) if valid_hum else 80.0
        
        return {
            "rainfall_mm_24h": round(rainfall_24h, 2),
            "rainfall_intensity_mm_h": round(intensity, 2),
            "rainfall_duration_h": round(duration, 2),
            "antecedent_rainfall_7d_mm": round(antecedent_7d, 2),
            "temperature_c": round(mean_temp, 2),
            "humidity_pct": round(mean_hum, 2)
        }

    def _get_mock_weather(self, latitude: float, longitude: float, event_time_utc: pd.Timestamp) -> Dict[str, Any]:
        """
        Return a mocked dictionary of weather features.
        We inject semi-realistic values based on whether it's the monsoon season or not.
        """
        # Determine if it's monsoon (June - September) to simulate realistic mock values
        month = event_time_utc.month
        is_monsoon = 6 <= month <= 9
        
        # We simulate the exact aggregation fields requested.
        # In a real implementation, this function would download hourly ERA5 data for [event_time - 7 days, event_time],
        # then calculate these aggregations.
        
        if is_monsoon:
            # Simulate heavy rainfall event
            rainfall_24h = float(np.random.uniform(50.0, 300.0))
            intensity = float(np.random.uniform(10.0, 35.0))
            duration = float(np.random.uniform(12.0, 24.0))
            antecedent_7d = float(np.random.uniform(200.0, 600.0))
            temp = float(np.random.uniform(22.0, 26.0))
            humidity = float(np.random.uniform(85.0, 98.0))
        else:
            # Simulate dry / safe event
            rainfall_24h = float(np.random.uniform(0.0, 10.0))
            intensity = float(np.random.uniform(0.0, 5.0))
            duration = float(np.random.uniform(0.0, 4.0))
            antecedent_7d = float(np.random.uniform(0.0, 30.0))
            temp = float(np.random.uniform(26.0, 35.0))
            humidity = float(np.random.uniform(50.0, 75.0))
            
        return {
            "rainfall_mm_24h": round(rainfall_24h, 2),
            "rainfall_intensity_mm_h": round(intensity, 2),
            "rainfall_duration_h": round(duration, 2),
            "antecedent_rainfall_7d_mm": round(antecedent_7d, 2),
            "temperature_c": round(temp, 2),
            "humidity_pct": round(humidity, 2)
        }

if __name__ == "__main__":
    adapter = HistoricalWeatherAdapter()
    sample_time = pd.to_datetime("2018-08-15T00:00:00Z", utc=True)
    features = adapter.fetch_weather_features(10.85, 76.27, sample_time)
    print(f"Weather for 2018-08-15 (Monsoon): {features}")
    
    dry_time = pd.to_datetime("2018-02-15T00:00:00Z", utc=True)
    features_dry = adapter.fetch_weather_features(10.85, 76.27, dry_time)
    print(f"Weather for 2018-02-15 (Dry): {features_dry}")
