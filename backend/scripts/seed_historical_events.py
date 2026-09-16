import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.core.database import SessionLocal
from app.models.location import Location
from app.models.disaster_event import DisasterEvent, HazardType, SeverityLevel, RecordType

HISTORICAL_EVENTS = [
    {
        "location": {
            "name": "Wayanad (Chooralmala-Mundakkai)",
            "description": "Massive catastrophic landslide complex triggered by extreme rainfall in the Western Ghats.",
            "latitude": 11.5367,
            "longitude": 76.1436,
            "elevation_m": 1200.0,
            "district": "Wayanad",
            "state": "Kerala",
            "country": "India"
        },
        "event": {
            "hazard_type": HazardType.LANDSLIDE,
            "severity": SeverityLevel.CRITICAL,
            "record_type": RecordType.HISTORICAL,
            "risk_score": 1.0,  # Observed catastrophic failure
            "model_version": "historical_observation",
            "data_source": "NASA COOLR (Global Landslide Catalog)",
            "source_reference": "https://gpm.nasa.gov/landslides/index.html",
            "event_time": datetime(2024, 7, 30, 2, 0, tzinfo=timezone.utc),
            "notes": "Devastating landslide sweeping away villages early morning.",
            "alert_triggered": True,
        }
    },
    {
        "location": {
            "name": "Chengannur",
            "description": "One of the worst affected areas during the 2018 Kerala Floods.",
            "latitude": 9.3175,
            "longitude": 76.6167,
            "elevation_m": 12.0,
            "district": "Alappuzha",
            "state": "Kerala",
            "country": "India"
        },
        "event": {
            "hazard_type": HazardType.FLOOD,
            "severity": SeverityLevel.CRITICAL,
            "record_type": RecordType.HISTORICAL,
            "risk_score": 1.0,
            "model_version": "historical_observation",
            "data_source": "Global Flood Database",
            "source_reference": "https://global-flood-database.cloudtostreet.ai/",
            "event_time": datetime(2018, 8, 16, 12, 0, tzinfo=timezone.utc),
            "notes": "Unprecedented flooding due to intense monsoon rainfall and dam releases.",
            "alert_triggered": True,
        }
    },
    {
        "location": {
            "name": "Idukki (Pettimudi)",
            "description": "Major debris flow and landslide in tea estate settlement.",
            "latitude": 10.1583,
            "longitude": 77.0167,
            "elevation_m": 1500.0,
            "district": "Idukki",
            "state": "Kerala",
            "country": "India"
        },
        "event": {
            "hazard_type": HazardType.LANDSLIDE,
            "severity": SeverityLevel.CRITICAL,
            "record_type": RecordType.HISTORICAL,
            "risk_score": 1.0,
            "model_version": "historical_observation",
            "data_source": "NASA COOLR (Global Landslide Catalog)",
            "source_reference": "https://gpm.nasa.gov/landslides/index.html",
            "event_time": datetime(2020, 8, 6, 22, 0, tzinfo=timezone.utc),
            "notes": "Severe landslide caused by continuous heavy rainfall.",
            "alert_triggered": True,
        }
    }
]


def seed_historical_events():
    """Seed real, curated historical events into the database."""
    db = SessionLocal()
    try:
        count = 0
        for item in HISTORICAL_EVENTS:
            # Check if location exists (by name and lat/lon)
            loc_data = item["location"]
            location = db.query(Location).filter_by(
                name=loc_data["name"],
                latitude=loc_data["latitude"],
                longitude=loc_data["longitude"]
            ).first()

            if not location:
                location = Location(**loc_data)
                db.add(location)
                db.commit()
                db.refresh(location)
            
            # Check if event exists
            event_data = item["event"]
            event = db.query(DisasterEvent).filter_by(
                location_id=location.id,
                hazard_type=event_data["hazard_type"],
                event_time=event_data["event_time"]
            ).first()

            if not event:
                event = DisasterEvent(location_id=location.id, **event_data)
                db.add(event)
                count += 1
        
        db.commit()
        print(f"Successfully seeded {count} new historical disaster events.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_historical_events()
