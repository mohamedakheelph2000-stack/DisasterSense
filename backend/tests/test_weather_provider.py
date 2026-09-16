import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from app.services.weather_provider.schemas import ProviderStatus
from app.services.weather_provider.open_meteo import fetch_open_meteo_data
from app.services.weather_provider import EnvironmentalProvider
from app.services.weather_provider.cache import weather_cache, elevation_cache

# Mock Data for Open Meteo
MOCK_METEO_RESPONSE = {
    "hourly": {
        "time": [
            "2023-01-01T00:00", "2023-01-01T01:00", "2023-01-01T02:00",
            # ... pretend we have 168+24 hours here
        ],
        "temperature_2m": [25.0] * 200,
        "relative_humidity_2m": [80.0] * 200,
        "precipitation": [1.0] * 200
    }
}

@pytest.fixture(autouse=True)
def clear_caches():
    weather_cache.clear()
    elevation_cache.clear()
    yield

@patch("app.services.weather_provider.open_meteo.requests.get")
@patch("app.services.weather_provider.open_meteo.get_elevation")
def test_open_meteo_successful_fetch(mock_get_elevation, mock_requests_get):
    # Setup mock response
    mock_resp = MagicMock()
    mock_resp.json.return_value = MOCK_METEO_RESPONSE
    mock_requests_get.return_value = mock_resp
    
    mock_get_elevation.return_value = 150.0

    ref_time = datetime(2023, 1, 1, 1, 0, tzinfo=timezone.utc)
    
    # Needs to match the index in MOCK_METEO_RESPONSE
    MOCK_METEO_RESPONSE["hourly"]["time"] = [
        "2022-12-31T23:00", "2023-01-01T00:00", "2023-01-01T01:00"
    ]
    MOCK_METEO_RESPONSE["hourly"]["precipitation"] = [2.0, 3.0, 5.0]
    MOCK_METEO_RESPONSE["hourly"]["temperature_2m"] = [25.0, 26.0, 27.0]
    MOCK_METEO_RESPONSE["hourly"]["relative_humidity_2m"] = [80.0, 81.0, 82.0]
    
    data = fetch_open_meteo_data(10.0, 20.0, ref_time)
    
    assert data.status == ProviderStatus.LIVE
    assert data.rainfall_mm_24h == 10.0 # 2+3+5
    assert data.rainfall_intensity_mm_h == 5.0
    assert data.temperature_c == 27.0
    assert data.humidity_pct == 82.0
    assert data.elevation_m == 150.0
    assert data.antecedent_rainfall_7d_mm == 0.0 # No data before 24h window in mock

@patch("app.services.weather_provider.open_meteo.requests.get")
def test_open_meteo_timeout(mock_requests_get):
    import requests
    mock_requests_get.side_effect = requests.exceptions.Timeout("Timeout")
    
    data = fetch_open_meteo_data(10.0, 20.0, datetime.now(timezone.utc))
    assert data.status == ProviderStatus.ERROR
    assert "API Error" in data.error_message

def test_invalid_coordinates():
    data = fetch_open_meteo_data(100.0, 200.0, datetime.now(timezone.utc))
    assert data.status == ProviderStatus.ERROR
    assert "Invalid coordinates" in data.error_message

@patch("app.services.weather_provider.fetch_open_meteo_data")
def test_provider_caching(mock_fetch):
    mock_data = MagicMock()
    mock_data.status = ProviderStatus.LIVE
    mock_data.is_valid_for_real_model.return_value = True
    mock_data.model_copy.return_value = mock_data
    mock_fetch.return_value = mock_data
    
    # First call - cache miss
    res1 = EnvironmentalProvider.get_data(10.0, 20.0)
    assert mock_fetch.call_count == 1
    
    # Second call - cache hit
    res2 = EnvironmentalProvider.get_data(10.0, 20.0)
    assert mock_fetch.call_count == 1
    assert res2.status == ProviderStatus.CACHED
