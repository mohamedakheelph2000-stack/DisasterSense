from fastapi.testclient import TestClient
from app.core.security import create_access_token
from app.core.config import settings
from unittest.mock import patch
from app.services.weather_provider.schemas import EnvironmentalData, ProviderStatus
from datetime import datetime, timezone

def test_environment_current_returns_data(db_client: TestClient, test_user_citizen):
    token = create_access_token(subject=test_user_citizen.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    # Mock the provider to avoid actual API calls during basic test
    mock_data = EnvironmentalData(
        latitude=11.6,
        longitude=76.0,
        provider_name="open-meteo",
        rainfall_mm_24h=120.5,
        rainfall_intensity_mm_h=15.0,
        antecedent_rainfall_7d_mm=450.0,
        temperature_c=25.5,
        humidity_pct=88.0,
        elevation_m=850.0,
        reference_timestamp=datetime.now(timezone.utc),
        status=ProviderStatus.LIVE
    )
    
    with patch("app.services.weather_provider.EnvironmentalProvider.get_data", return_value=mock_data):
        response = db_client.get("/api/v1/environment/current", headers=headers)
        
    assert response.status_code == 200
    data = response.json()
    assert data["rainfall_24h"] == 120.5
    assert data["temperature"] == 25.5
    assert data["provider"] == "open-meteo"
    assert data["status"] == "LIVE"

def test_environment_current_requires_auth(client: TestClient):
    response = client.get("/api/v1/environment/current")
    assert response.status_code == 401
