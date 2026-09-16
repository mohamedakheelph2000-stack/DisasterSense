import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.weather_provider.schemas import EnvironmentalData, ProviderStatus
from app.services.weather_provider.cache import weather_cache
from app.schemas.risk_assessment import FloodAssessmentRequest
from app.services import risk_assessment_service
from datetime import datetime, timezone

client = TestClient(app)

@pytest.fixture(autouse=True)
def clear_caches():
    weather_cache.clear()
    yield

def test_flood_automatic_mode_requires_lat_lon(db_session):
    request = FloodAssessmentRequest()
    with pytest.raises(ValueError, match="Latitude and longitude.*are required"):
        risk_assessment_service.process_flood_request(db_session, request, mode="automatic")

@patch("app.services.weather_provider.fetch_open_meteo_data")
def test_flood_automatic_mode_hydrates_real_features(mock_fetch, db_session):
    mock_env = EnvironmentalData(
        latitude=10.0,
        longitude=20.0,
        reference_timestamp=datetime.now(timezone.utc),
        status=ProviderStatus.LIVE,
        provider_name="open-meteo",
        rainfall_mm_24h=120.0,
        rainfall_intensity_mm_h=20.0,
        antecedent_rainfall_7d_mm=300.0,
        temperature_c=25.0,
        humidity_pct=85.0,
        elevation_m=50.0
    )
    mock_fetch.return_value = mock_env
    
    request = FloodAssessmentRequest(latitude=10.0, longitude=20.0)
    result = risk_assessment_service.process_flood_request(db_session, request, mode="automatic")
    
    assert result.mode == "automatic"
    # Because we mocked a valid environmental response with all real model features,
    # the RiskEngine should use the real model!
    assert result.inference_source == "real_model"
    
    # Check that features were overridden by the mock
    assert result.features_used["rainfall_mm_24h"] == 120.0
    assert result.features_used["elevation_m"] == 50.0

@patch("app.services.weather_provider.fetch_open_meteo_data")
def test_flood_automatic_mode_falls_back_on_error(mock_fetch, db_session):
    mock_env = EnvironmentalData(
        latitude=10.0,
        longitude=20.0,
        reference_timestamp=datetime.now(timezone.utc),
        status=ProviderStatus.ERROR,
        provider_name="open-meteo",
        error_message="Timeout"
    )
    mock_fetch.return_value = mock_env
    
    request = FloodAssessmentRequest(latitude=10.0, longitude=20.0)
    result = risk_assessment_service.process_flood_request(db_session, request, mode="automatic")
    
    assert result.mode == "automatic"
    # It should fallback because environmental data is missing required features
    assert result.inference_source in ["synthetic_model", "heuristic"]
