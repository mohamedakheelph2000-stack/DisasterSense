"""
Risk Assessment service — bridges FastAPI endpoints to the ML RiskEngine.

Responsibilities:
- Accepts validated input from API routers.
- Calls the existing RiskEngine singleton for flood or landslide predictions.
- Optionally persists the assessment as a DisasterEvent record.
- Returns a structured RiskAssessmentResult.

Supports both Manual and Automatic input modes.
The automatic weather provider interface is stubbed with a clear unavailable state.
"""

import json
import sys
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.disaster_event import DisasterEvent, HazardType, SeverityLevel
from app.models.alert import Alert, AlertStatus
from app.services import alert_service
from fastapi import BackgroundTasks
from app.services.notifications.dispatcher import dispatch_alert_notifications
from app.schemas.alert import AlertCreate

# Add project root to path so ml package is importable from backend
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from ml.src.inference.risk_engine import RiskEngine, RiskAssessmentResult
from ml.src.flood.flood_features import FloodInputSchema
from ml.src.landslide.landslide_features import LandslideInputSchema


# Module-level singleton — lazy-initialized to avoid import-time model loading issues.
_engine: Optional[RiskEngine] = None


from app.schemas.risk_assessment import FloodAssessmentRequest, LandslideAssessmentRequest
from app.services import location_service
from app.services.weather_provider import EnvironmentalProvider, ProviderStatus

def _get_engine() -> RiskEngine:
    """Return the RiskEngine singleton, creating it on first use."""
    global _engine
    if _engine is None:
        models_dir = os.path.join(_project_root, "ml", "models")
        _engine = RiskEngine(models_dir=models_dir)
    return _engine


def _apply_environmental_data(ml_input, lat: float, lon: float):
    """Fetches real weather and updates the ML input schema."""
    env_data = EnvironmentalProvider.get_data(lat, lon)
    if env_data.status in (ProviderStatus.LIVE, ProviderStatus.CACHED):
        # Override the defaults with real data where available
        if env_data.rainfall_mm_24h is not None:
            ml_input.rainfall_mm_24h = env_data.rainfall_mm_24h
        if env_data.rainfall_intensity_mm_h is not None:
            ml_input.rainfall_intensity_mm_h = env_data.rainfall_intensity_mm_h
        if hasattr(ml_input, "antecedent_rainfall_7d_mm") and env_data.antecedent_rainfall_7d_mm is not None:
            ml_input.antecedent_rainfall_7d_mm = env_data.antecedent_rainfall_7d_mm
        if hasattr(ml_input, "temperature_c") and env_data.temperature_c is not None:
            ml_input.temperature_c = env_data.temperature_c
        if hasattr(ml_input, "humidity_pct") and env_data.humidity_pct is not None:
            ml_input.humidity_pct = env_data.humidity_pct
        if env_data.elevation_m is not None:
            ml_input.elevation_m = env_data.elevation_m


def process_flood_request(db: Session, request: FloodAssessmentRequest, mode: str) -> RiskAssessmentResult:
    lat, lon = request.latitude, request.longitude
    if request.location_id is not None:
        loc = location_service.get_location(db, request.location_id)
        if loc is None:
            raise ValueError(f"Location {request.location_id} not found.")
        lat, lon = loc.latitude, loc.longitude

    if mode == "automatic" and (lat is None or lon is None):
        raise ValueError("Latitude and longitude (or a valid location_id) are required for automatic mode.")

    ml_input = FloodInputSchema(
        rainfall_mm_24h=request.rainfall_mm_24h,
        rainfall_intensity_mm_h=request.rainfall_intensity_mm_h,
        rainfall_duration_h=request.rainfall_duration_h,
        temperature_c=request.temperature_c,
        humidity_pct=request.humidity_pct,
        elevation_m=request.elevation_m,
        slope_deg=request.slope_deg,
        drainage_capacity_score=request.drainage_capacity_score,
        soil_saturation_pct=request.soil_saturation_pct,
        historical_flood_count=request.historical_flood_count,
        distance_to_river_m=request.distance_to_river_m,
    )
    
    # We dynamically add antecedent_rainfall_7d_mm if it's absent from schema but required by real model
    # Wait, FloodInputSchema in `flood_features.py` must actually have `antecedent_rainfall_7d_mm` if the real model needs it.
    if mode == "automatic":
        _apply_environmental_data(ml_input, lat, lon)

    engine = _get_engine()
    return engine.predict_flood(input_data=ml_input, mode=mode)


def process_landslide_request(db: Session, request: LandslideAssessmentRequest, mode: str) -> RiskAssessmentResult:
    lat, lon = request.latitude, request.longitude
    if request.location_id is not None:
        loc = location_service.get_location(db, request.location_id)
        if loc is None:
            raise ValueError(f"Location {request.location_id} not found.")
        lat, lon = loc.latitude, loc.longitude

    if mode == "automatic" and (lat is None or lon is None):
        raise ValueError("Latitude and longitude (or a valid location_id) are required for automatic mode.")

    ml_input = LandslideInputSchema(
        rainfall_mm_24h=request.rainfall_mm_24h,
        rainfall_intensity_mm_h=request.rainfall_intensity_mm_h,
        slope_deg=request.slope_deg,
        elevation_m=request.elevation_m,
        soil_type_code=request.soil_type_code,
        soil_moisture_pct=request.soil_moisture_pct,
        geological_stability_index=request.geological_stability_index,
        vegetation_cover_pct=request.vegetation_cover_pct,
        historical_landslide_count=request.historical_landslide_count,
        road_cut_proximity_m=request.road_cut_proximity_m,
    )

    if mode == "automatic":
        _apply_environmental_data(ml_input, lat, lon)

    engine = _get_engine()
    return engine.predict_landslide(input_data=ml_input, mode=mode)


def persist_assessment(
    db: Session,
    result: RiskAssessmentResult,
    location_id: int,
    background_tasks: BackgroundTasks | None = None,
) -> DisasterEvent:
    """
    Save a RiskAssessmentResult to the database as a DisasterEvent record.

    This powers historical analytics and the disaster timeline.
    """
    # Map risk_engine severity string to SeverityLevel enum
    severity_map = {
        "low": SeverityLevel.LOW,
        "moderate": SeverityLevel.MODERATE,
        "high": SeverityLevel.HIGH,
        "critical": SeverityLevel.CRITICAL,
    }
    severity = severity_map.get(result.severity, SeverityLevel.LOW)

    # Map hazard_type string to HazardType enum
    hazard_map = {
        "flood": HazardType.FLOOD,
        "landslide": HazardType.LANDSLIDE,
    }
    hazard = hazard_map.get(result.hazard_type, HazardType.FLOOD)

    # Determine if alert should be triggered (High or Critical)
    alert_triggered = result.severity in ("high", "critical")

    # Determine data_source label
    data_source = f"{result.mode}-input"

    # Build a compact feature snapshot (features + explanation summary)
    feature_snapshot = json.dumps({
        "features": result.features_used,
        "explanation": [
            {
                "feature": exp.feature,
                "value": exp.value,
                "importance": exp.importance,
                "impact": exp.impact_level,
            }
            for exp in result.explanation[:5]  # top 5 features to keep compact
        ],
        "prediction_source": "ml_model" if "heuristic" not in result.model_version else "fallback_heuristic",
    }, default=str)

    event = DisasterEvent(
        location_id=location_id,
        hazard_type=hazard,
        severity=severity,
        risk_score=round(result.probability, 4),  # DB stores [0, 1] range
        model_version=result.model_version,
        data_source=data_source,
        feature_snapshot=feature_snapshot,
        alert_triggered=alert_triggered,
        event_time=datetime.now(timezone.utc),
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # ── Alert Generation ──
    if alert_triggered:
        # Check for existing active/ongoing alerts for this location and hazard type
        # We join on DisasterEvent to check the hazard type of the active alert
        existing_alert = (
            db.execute(
                select(Alert)
                .join(DisasterEvent, Alert.disaster_event_id == DisasterEvent.id)
                .where(
                    Alert.location_id == location_id,
                    Alert.status.in_([
                        AlertStatus.ACTIVE, 
                        AlertStatus.ACKNOWLEDGED, 
                        AlertStatus.RESPONSE_IN_PROGRESS
                    ]),
                    DisasterEvent.hazard_type == hazard,
                )
            )
            .scalars()
            .first()
        )

        if not existing_alert:
            # Generate a new alert
            alert_data = AlertCreate(
                location_id=location_id,
                disaster_event_id=event.id,
                title=f"{result.risk_level.value.upper()} {result.hazard_type.capitalize()} Risk Detected",
                message=(
                    f"A {result.risk_level.value.lower()} risk of {result.hazard_type} has been assessed "
                    f"with a probability of {result.probability:.1%}. "
                    f"Primary contributing factors: {', '.join(exp.feature for exp in result.explanation[:3])}."
                )
            )
            alert = alert_service.create_alert(db, alert_data)
            if background_tasks:
                background_tasks.add_task(dispatch_alert_notifications, alert.id)
        else:
            # Optionally, we could update the existing alert's updated_at or message here
            # For now, duplicate prevention just skips creating a new one.
            pass

    return event


class AutomaticWeatherProvider:
    """
    Interface for external weather/environmental data providers.
    Uses Open-Meteo and Open-Elevation to automatically populate risk assessment inputs.
    """

    @staticmethod
    def is_available() -> bool:
        """Check whether an external weather provider is configured."""
        return True

    @staticmethod
    def get_status() -> dict:
        """Return the current provider status."""
        return {
            "provider": "open-meteo + open-elevation",
            "available": True,
            "message": (
                "Automatic weather data providers are active. "
                "The system can automatically fetch real-time and historical "
                "weather/elevation data for automatic risk assessments."
            ),
        }

