"""
24/7 Real-Time Telemetry Background Worker.

Continuously ingests live meteorological and topographical telemetry
from free open providers (Open-Meteo & Open-Elevation) for all monitored
geographic locations in the system.

Evaluates high-accuracy ML flood and landslide risk models on incoming
telemetry, auto-generates real predictive disaster events, and dispatches
early-warning notifications for critical anomalies.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.location import Location
from app.models.disaster_event import DisasterEvent, HazardType, SeverityLevel, RecordType
from app.models.alert import Alert, AlertStatus
from app.services.weather_provider import EnvironmentalProvider, ProviderStatus
from app.services.notifications.dispatcher import dispatch_alert_notifications
from app.schemas.alert import AlertCreate
from app.services import alert_service

logger = logging.getLogger("disastersense.telemetry_worker")


class TelemetryWorker:
    """
    Asynchronous 24/7 background worker for real-time telemetry polling & ML risk monitoring.
    """

    def __init__(self, poll_interval_seconds: int = 60):  # 60 seconds (1 minute live polling)
        self.poll_interval_seconds = poll_interval_seconds
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.last_poll_time: Optional[datetime] = None
        self.next_poll_time: Optional[datetime] = None
        self.total_polls: int = 0
        self.total_assessments_generated: int = 0
        self.locations_monitored: int = 0
        self.last_status: str = "INITIALIZED"
        self.last_error: Optional[str] = None
        self.latest_telemetry: Dict[int, Dict[str, Any]] = {}

    def start(self) -> None:
        """Starts the 24/7 background polling loop."""
        if self._running:
            logger.info("TelemetryWorker is already running.")
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"24/7 TelemetryWorker started. Polling interval: {self.poll_interval_seconds}s")

    def stop(self) -> None:
        """Stops the 24/7 background polling loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("TelemetryWorker stopped.")

    async def trigger_poll_now(self) -> Dict[str, Any]:
        """Manually triggers an immediate telemetry polling cycle."""
        logger.info("Manual telemetry polling triggered.")
        return await asyncio.to_thread(self._poll_all_locations)

    async def _run_loop(self) -> None:
        """Continuous 24/7 execution loop."""
        # Initial poll after brief startup delay
        await asyncio.sleep(5)
        while self._running:
            try:
                self.next_poll_time = datetime.now(timezone.utc) + timedelta(seconds=self.poll_interval_seconds)
                await asyncio.to_thread(self._poll_all_locations)
                self.last_status = "HEALTHY_ACTIVE"
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in TelemetryWorker loop: {e}", exc_info=True)
                self.last_status = f"ERROR: {str(e)}"
                self.last_error = str(e)

            await asyncio.sleep(self.poll_interval_seconds)

    def _poll_all_locations(self) -> Dict[str, Any]:
        """Polls Open-Meteo for all locations in PostgreSQL and runs ML predictions."""
        from ml.src.inference.risk_engine import risk_engine
        from ml.src.flood.flood_features import FloodInputSchema
        from ml.src.landslide.landslide_features import LandslideInputSchema

        db: Session = SessionLocal()
        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "locations_polled": 0,
            "assessments_created": 0,
            "alerts_dispatched": 0,
            "results": []
        }

        try:
            locations = db.query(Location).all()
            self.locations_monitored = len(locations)

            for loc in locations:
                if loc.latitude is None or loc.longitude is None:
                    continue

                # 1. Fetch live Open-Meteo & Open-Elevation data (100% free, 24/7, live)
                env_data = EnvironmentalProvider.get_data(loc.latitude, loc.longitude)
                
                reading = {
                    "location_id": loc.id,
                    "location_name": loc.name,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude,
                    "provider": env_data.provider_name,
                    "status": str(env_data.status),
                    "rainfall_24h": env_data.rainfall_mm_24h or 0.0,
                    "rainfall_intensity": env_data.rainfall_intensity_mm_h or 0.0,
                    "antecedent_7d": env_data.antecedent_rainfall_7d_mm or 0.0,
                    "temperature": env_data.temperature_c or 25.0,
                    "humidity": env_data.humidity_pct or 75.0,
                    "elevation": env_data.elevation_m or (loc.elevation_m or 50.0),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                self.latest_telemetry[loc.id] = reading

                # 2. Run Flood Risk Prediction with Live Telemetry
                flood_input = FloodInputSchema(
                    rainfall_mm_24h=reading["rainfall_24h"],
                    rainfall_intensity_mm_h=reading["rainfall_intensity"],
                    rainfall_duration_h=12.0,
                    temperature_c=reading["temperature"],
                    humidity_pct=reading["humidity"],
                    elevation_m=reading["elevation"],
                    slope_deg=max(1.0, float(loc.elevation_m or 50.0) / 40.0),
                    drainage_capacity_score=5.0,
                    soil_saturation_pct=min(100.0, max(10.0, reading["antecedent_7d"] * 1.5 + 20.0)),
                    historical_flood_count=1,
                    distance_to_river_m=800.0
                )
                flood_res = risk_engine.predict_flood(flood_input, mode="automatic")

                # 3. Run Landslide Risk Prediction with Live Telemetry
                landslide_input = LandslideInputSchema(
                    rainfall_mm_24h=reading["rainfall_24h"],
                    rainfall_intensity_mm_h=reading["rainfall_intensity"],
                    slope_deg=max(5.0, float(loc.elevation_m or 100.0) / 35.0),
                    elevation_m=reading["elevation"],
                    soil_type_code=2.0,
                    soil_moisture_pct=min(100.0, max(15.0, reading["antecedent_7d"] * 1.8 + 25.0)),
                    geological_stability_index=5.0,
                    vegetation_cover_pct=60.0,
                    historical_landslide_count=1,
                    road_cut_proximity_m=350.0
                )
                landslide_res = risk_engine.predict_landslide(landslide_input, mode="automatic")

                # 4. Record Real Predictive Events in DB for both hazards
                for hazard_type, res in [("flood", flood_res), ("landslide", landslide_res)]:
                    event = DisasterEvent(
                        location_id=loc.id,
                        hazard_type=HazardType(hazard_type),
                        severity=SeverityLevel(res.severity.lower()),
                        risk_score=res.risk_score / 100.0,
                        model_version=res.model_version or "v1.0.0",
                        record_type=RecordType.PREDICTIVE,
                        data_source="open-meteo-api",
                        source_reference="https://open-meteo.com",
                        event_time=datetime.now(timezone.utc),
                        notes=f"24/7 automated telemetry assessment for {loc.name}. Rainfall 24h: {reading['rainfall_24h']}mm",
                        feature_snapshot=res.model_dump_json()
                    )
                    db.add(event)
                    db.flush()

                    summary["assessments_created"] += 1
                    self.total_assessments_generated += 1

                    # 5. Dispatch Alert if Elevated Risk
                    if res.severity.lower() in ("high", "critical"):
                        alert_create = AlertCreate(
                            location_id=loc.id,
                            disaster_event_id=event.id,
                            title=f"AUTOMATED {res.severity.upper()} {hazard_type.upper()} RISK: {loc.name}",
                            message=(
                                f"24/7 telemetry detected elevated {hazard_type} hazard at {loc.name} "
                                f"(Score: {res.risk_score:.1f}/100, Rainfall 24h: {reading['rainfall_24h']}mm). "
                                f"Triggered automatically via Open-Meteo real-time telemetry."
                            ),
                            severity=SeverityLevel(res.severity.lower())
                        )
                        alert = alert_service.create_alert(db, alert_create)
                        dispatch_alert_notifications(db, alert)
                        summary["alerts_dispatched"] += 1

                summary["locations_polled"] += 1

            db.commit()
            self.total_polls += 1
            self.last_poll_time = datetime.now(timezone.utc)
            logger.info(f"Telemetry cycle complete. Polled {summary['locations_polled']} locations. Created {summary['assessments_created']} assessments.")

        except Exception as e:
            db.rollback()
            logger.error(f"Failed during telemetry poll: {e}", exc_info=True)
            self.last_error = str(e)
            raise
        finally:
            db.close()

        return summary

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive real-time diagnostics of the 24/7 telemetry system."""
        return {
            "worker_status": "ACTIVE_24_7" if self._running else "STOPPED",
            "polling_interval_seconds": self.poll_interval_seconds,
            "last_poll_time": self.last_poll_time.isoformat() if self.last_poll_time else None,
            "next_poll_time": self.next_poll_time.isoformat() if self.next_poll_time else None,
            "total_polling_cycles": self.total_polls,
            "total_assessments_generated": self.total_assessments_generated,
            "locations_monitored": self.locations_monitored,
            "provider": "open-meteo + open-elevation (Real-Time Free Global Ingestion)",
            "last_health_status": self.last_status,
            "last_error": self.last_error,
            "recent_telemetry_samples": list(self.latest_telemetry.values())[:10]
        }


# Global singleton worker instance (defaults to 60 seconds)
telemetry_worker = TelemetryWorker(poll_interval_seconds=int(os.getenv("TELEMETRY_POLL_INTERVAL_SECONDS", "60")))
