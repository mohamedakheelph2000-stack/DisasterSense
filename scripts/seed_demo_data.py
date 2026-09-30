#!/usr/bin/env python
"""
seed_demo_data.py — DisasterSense Operational and Demo Data Seeder.

Populates PostgreSQL with high-fidelity, academically grounded real-world data:
1. Standard Demo Accounts (Admin, Responder, Citizen) with secure hashed passwords.
2. Core Geographic Locations across Kerala and the Western Ghats (Wayanad, Idukki, Ernakulam, Alappuzha, Malappuram).
3. Historical and Operational Disaster Events (2024 Wayanad Landslides, 2018 Great Kerala Floods, 2020 Pettimudi, etc.).
4. Verified Emergency Resources (Shelters, Hospitals, Fire Stations, Police Stations, Relief Camps with genuine coordinates).
5. Operational Alerts in various lifecycle states (ACTIVE, RESPONSE_IN_PROGRESS, RESOLVED) with full immutable audit trails.
6. ML Feedback records for human-in-the-loop ground truth evaluation.

Usage:
    python scripts/seed_demo_data.py
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend directory is in python path and backend/.env is loaded
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
load_dotenv(backend_dir / ".env")

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.disaster_event import DisasterEvent, HazardType, SeverityLevel, RecordType
from app.models.alert import Alert, AlertStatus, AlertAudit
from app.models.emergency_resource import EmergencyResource, ResourceType, VerificationStatus
from app.models.ml_feedback import MLFeedback, FeedbackType, ReviewStatus


def seed():
    session = SessionLocal()
    print("=" * 65)
    print("DisasterSense -- Seeding Operational & Demonstration Data")
    print("=" * 65)

    try:
        # 1. Standard User Accounts
        print("\n[1/6] Seeding standard user accounts...")
        standard_users = [
            {
                "email": "admin@disastersense.org",
                "full_name": "System Administrator",
                "role": UserRole.ADMIN,
                "password": "Password123!",
                "phone_number": "+919876543210"
            },
            {
                "email": "responder@disastersense.org",
                "full_name": "Emergency Incident Responder",
                "role": UserRole.RESPONDER,
                "password": "Password123!",
                "phone_number": "+919876543211"
            },
            {
                "email": "citizen@disastersense.org",
                "full_name": "Verified Citizen",
                "role": UserRole.CITIZEN,
                "password": "Password123!",
                "phone_number": "+919876543212"
            }
        ]

        for u_data in standard_users:
            existing = session.query(User).filter(User.email == u_data["email"]).first()
            if not existing:
                user = User(
                    email=u_data["email"],
                    full_name=u_data["full_name"],
                    role=u_data["role"],
                    hashed_password=get_password_hash(u_data["password"]),
                    phone_number=u_data["phone_number"],
                    is_active=True,
                    email_enabled=True,
                    sms_enabled=True
                )
                session.add(user)
                print(f"  [+] Created user: {u_data['email']} ({u_data['role'].value})")
            else:
                print(f"  [-] User already exists: {u_data['email']}")
        session.commit()

        # 2. Strategic Geographic Locations in Western Ghats & Kerala
        print("\n[2/6] Seeding geographic monitoring locations...")
        locations_data = [
            {
                "name": "Wayanad (Chooralmala-Mundakkai)",
                "description": "High-gradient tea plantation slope with high debris flow vulnerability",
                "latitude": 11.5367,
                "longitude": 76.1436,
                "elevation_m": 850.0,
                "district": "Wayanad",
                "state": "Kerala",
                "country": "India"
            },
            {
                "name": "Wayanad (Meppadi Valley)",
                "description": "Mid-elevation settlement below steeply inclined catchment",
                "latitude": 11.5520,
                "longitude": 76.1245,
                "elevation_m": 780.0,
                "district": "Wayanad",
                "state": "Kerala",
                "country": "India"
            },
            {
                "name": "Aluva (Periyar River Basin)",
                "description": "Low-lying floodplain adjacent to Periyar River downstream of Idamalayar/Idukki",
                "latitude": 10.1076,
                "longitude": 76.3516,
                "elevation_m": 12.0,
                "district": "Ernakulam",
                "state": "Kerala",
                "country": "India"
            },
            {
                "name": "Chengannur (Pamba River Catchment)",
                "description": "Vulnerable fluvial convergence zone prone to severe seasonal backwater inundation",
                "latitude": 9.3175,
                "longitude": 76.6167,
                "elevation_m": 15.0,
                "district": "Alappuzha",
                "state": "Kerala",
                "country": "India"
            },
            {
                "name": "Idukki (Pettimudi-Munnar Range)",
                "description": "Very high relief mountain slope near Anamudi with deep overburden",
                "latitude": 10.1583,
                "longitude": 77.0167,
                "elevation_m": 1520.0,
                "district": "Idukki",
                "state": "Kerala",
                "country": "India"
            },
            {
                "name": "Malappuram (Kavalappara-Nilambur)",
                "description": "Hilly terrain in Western Ghats foothills subject to intense cloudburst events",
                "latitude": 11.2750,
                "longitude": 76.2410,
                "elevation_m": 65.0,
                "district": "Malappuram",
                "state": "Kerala",
                "country": "India"
            }
        ]

        loc_objs = {}
        for l_data in locations_data:
            existing = session.query(Location).filter(Location.name == l_data["name"]).first()
            if not existing:
                loc = Location(**l_data)
                session.add(loc)
                session.flush()
                loc_objs[l_data["name"]] = loc
                print(f"  [+] Created location: {l_data['name']}")
            else:
                loc_objs[l_data["name"]] = existing
                print(f"  [-] Location already exists: {l_data['name']}")
        session.commit()

        # 3. Verified Emergency Resources
        print("\n[3/6] Seeding verified emergency facilities and relief resources...")
        resources_data = [
            {
                "name": "Wayanad District Hospital Mananthavady",
                "resource_type": ResourceType.HOSPITAL,
                "latitude": 11.8025,
                "longitude": 76.0034,
                "address": "Mananthavady, Wayanad District, Kerala 670645",
                "district": "Wayanad",
                "source": "Kerala Directorate of Health Services (DHS)",
                "source_reference": "https://dhs.kerala.gov.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 350,
                "contact_info": "+91 4935 240223"
            },
            {
                "name": "Taluk Hospital Vythiri",
                "resource_type": ResourceType.HOSPITAL,
                "latitude": 11.5512,
                "longitude": 76.0416,
                "address": "Vythiri, Wayanad District, Kerala 673576",
                "district": "Wayanad",
                "source": "Kerala Health Dept",
                "source_reference": "https://dhs.kerala.gov.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 150,
                "contact_info": "+91 4936 255224"
            },
            {
                "name": "Kozhikode Government Medical College",
                "resource_type": ResourceType.HOSPITAL,
                "latitude": 11.2721,
                "longitude": 75.8368,
                "address": "Medical College PO, Kozhikode, Kerala 673008",
                "district": "Kozhikode",
                "source": "Government of Kerala Health Services",
                "source_reference": "https://govtmedicalcollegekozhikode.ac.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 1200,
                "contact_info": "+91 495 2350216"
            },
            {
                "name": "General Hospital Ernakulam",
                "resource_type": ResourceType.HOSPITAL,
                "latitude": 9.9723,
                "longitude": 76.2842,
                "address": "Hospital Road, Marine Drive, Kochi, Kerala 682011",
                "district": "Ernakulam",
                "source": "Kerala Health Dept",
                "source_reference": "https://dhs.kerala.gov.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 750,
                "contact_info": "+91 484 2361251"
            },
            {
                "name": "Meppadi Community Relief Shelter",
                "resource_type": ResourceType.RELIEF_CENTER,
                "latitude": 11.5520,
                "longitude": 76.1245,
                "address": "Govt Higher Secondary School, Meppadi, Wayanad",
                "district": "Wayanad",
                "source": "Wayanad District Disaster Management Authority (DDMA)",
                "source_reference": "https://wayanad.nic.in/disaster-management",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 600,
                "contact_info": "+91 4936 282240"
            },
            {
                "name": "Kalpetta Civil Station Shelter Camp",
                "resource_type": ResourceType.SHELTER,
                "latitude": 11.6080,
                "longitude": 76.0825,
                "address": "Civil Station Auditorium, Kalpetta, Wayanad 673122",
                "district": "Wayanad",
                "source": "Wayanad DDMA",
                "source_reference": "https://wayanad.nic.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 500,
                "contact_info": "+91 4936 202251"
            },
            {
                "name": "Aluva Municipal Town Relief Camp",
                "resource_type": ResourceType.RELIEF_CENTER,
                "latitude": 10.1076,
                "longitude": 76.3516,
                "address": "St. Xavier's College Campus, Aluva, Ernakulam 683101",
                "district": "Ernakulam",
                "source": "Ernakulam DDMA",
                "source_reference": "https://ernakulam.nic.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 450,
                "contact_info": "+91 484 2624250"
            },
            {
                "name": "Fire & Rescue Station Kalpetta",
                "resource_type": ResourceType.FIRE_STATION,
                "latitude": 11.6050,
                "longitude": 76.0880,
                "address": "Bypass Road, Kalpetta, Wayanad 673121",
                "district": "Wayanad",
                "source": "Kerala Fire and Rescue Services",
                "source_reference": "https://fire.kerala.gov.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 45,
                "contact_info": "101 / +91 4936 202101"
            },
            {
                "name": "Fire & Rescue Station Aluva",
                "resource_type": ResourceType.FIRE_STATION,
                "latitude": 10.1110,
                "longitude": 76.3490,
                "address": "Near Railway Station, Aluva, Ernakulam 683101",
                "district": "Ernakulam",
                "source": "Kerala Fire and Rescue Services",
                "source_reference": "https://fire.kerala.gov.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 40,
                "contact_info": "101 / +91 484 2623101"
            },
            {
                "name": "Wayanad District Police Control Room",
                "resource_type": ResourceType.POLICE_STATION,
                "latitude": 11.6100,
                "longitude": 76.0850,
                "address": "SP Office Complex, Kalpetta, Wayanad 673121",
                "district": "Wayanad",
                "source": "Kerala State Police",
                "source_reference": "https://keralapolice.gov.in",
                "record_type": RecordType.HISTORICAL,
                "verification_status": VerificationStatus.VERIFIED,
                "capacity": 60,
                "contact_info": "112 / +91 4936 202525"
            }
        ]

        now_utc = datetime.now(timezone.utc)
        for r_data in resources_data:
            existing = session.query(EmergencyResource).filter(EmergencyResource.name == r_data["name"]).first()
            if not existing:
                res = EmergencyResource(
                    **r_data,
                    last_verified_at=now_utc
                )
                session.add(res)
                print(f"  [+] Added resource: {r_data['name']} ({r_data['resource_type'].value})")
            else:
                print(f"  [-] Resource already exists: {r_data['name']}")
        session.commit()

        # 4. Curated Historical and Live Predictive Disaster Events
        print("\n[4/6] Seeding historical and live disaster events...")
        events_data = [
            {
                "location_name": "Wayanad (Chooralmala-Mundakkai)",
                "hazard_type": HazardType.LANDSLIDE,
                "severity": SeverityLevel.CRITICAL,
                "record_type": RecordType.HISTORICAL,
                "risk_score": 0.96,
                "model_version": "real-v1-randomforest",
                "data_source": "Geological Survey of India (GSI) / NASA COOLR",
                "source_reference": "https://data.nasa.gov/earth-science/global-landslide-catalog",
                "alert_triggered": True,
                "event_time": datetime(2024, 7, 30, 2, 0, tzinfo=timezone.utc),
                "notes": "Severe debris flow triggered by 572mm 48-hour torrential monsoon precipitation."
            },
            {
                "location_name": "Aluva (Periyar River Basin)",
                "hazard_type": HazardType.FLOOD,
                "severity": SeverityLevel.CRITICAL,
                "record_type": RecordType.HISTORICAL,
                "risk_score": 0.94,
                "model_version": "real-v1-logisticregression",
                "data_source": "Central Water Commission (CWC) / Kerala SDMA",
                "source_reference": "https://sdma.kerala.gov.in/monsoon-reports",
                "alert_triggered": True,
                "event_time": datetime(2018, 8, 16, 12, 0, tzinfo=timezone.utc),
                "notes": "Bank overflow of Periyar River following unprecedented dam shutter releases."
            },
            {
                "location_name": "Idukki (Pettimudi-Munnar Range)",
                "hazard_type": HazardType.LANDSLIDE,
                "severity": SeverityLevel.CRITICAL,
                "record_type": RecordType.HISTORICAL,
                "risk_score": 0.93,
                "model_version": "real-v1-randomforest",
                "data_source": "IMD & State Disaster Management Authority",
                "source_reference": "https://sdma.kerala.gov.in",
                "alert_triggered": True,
                "event_time": datetime(2020, 8, 6, 22, 30, tzinfo=timezone.utc),
                "notes": "Catastrophic debris avalanche on steep tea-estate slope in Rajamala division."
            },
            {
                "location_name": "Chengannur (Pamba River Catchment)",
                "hazard_type": HazardType.FLOOD,
                "severity": SeverityLevel.HIGH,
                "record_type": RecordType.HISTORICAL,
                "risk_score": 0.88,
                "model_version": "real-v1-logisticregression",
                "data_source": "Global Flood Database / Dartmouth Flood Observatory",
                "source_reference": "https://global-flood-database.cloudtostreet.ai",
                "alert_triggered": True,
                "event_time": datetime(2018, 8, 17, 8, 0, tzinfo=timezone.utc),
                "notes": "Extensive backwater inundation isolating multiple taluk wards."
            },
            {
                "location_name": "Wayanad (Meppadi Valley)",
                "hazard_type": HazardType.LANDSLIDE,
                "severity": SeverityLevel.HIGH,
                "record_type": RecordType.PREDICTIVE,
                "risk_score": 0.78,
                "model_version": "real-v1-randomforest",
                "data_source": "Open-Meteo Weather API + Open-Elevation Hydration",
                "source_reference": "https://open-meteo.com/en/docs",
                "alert_triggered": True,
                "event_time": now_utc - timedelta(hours=3),
                "notes": "Automated pipeline assessment: 24h rainfall 148mm, high antecedent moisture, slope saturation."
            },
            {
                "location_name": "Aluva (Periyar River Basin)",
                "hazard_type": HazardType.FLOOD,
                "severity": SeverityLevel.HIGH,
                "record_type": RecordType.PREDICTIVE,
                "risk_score": 0.74,
                "model_version": "real-v1-logisticregression",
                "data_source": "Open-Meteo Hydrated Feature Vector",
                "source_reference": "https://open-meteo.com",
                "alert_triggered": True,
                "event_time": now_utc - timedelta(hours=6),
                "notes": "River gauge telemetry indicates water level nearing warning mark with continuous rainfall."
            },
            {
                "location_name": "Malappuram (Kavalappara-Nilambur)",
                "hazard_type": HazardType.LANDSLIDE,
                "severity": SeverityLevel.MODERATE,
                "record_type": RecordType.PREDICTIVE,
                "risk_score": 0.58,
                "model_version": "real-v1-randomforest",
                "data_source": "DisasterSense Automated Monitoring",
                "source_reference": "https://disastersense.org/models",
                "alert_triggered": False,
                "event_time": now_utc - timedelta(hours=12),
                "notes": "Moderate rain intensity; soil drainage capacity currently adequate."
            }
        ]

        created_events = []
        for e_data in events_data:
            loc = loc_objs.get(e_data["location_name"])
            if not loc:
                continue
            
            # Check if matching event already exists to prevent duplicate spam
            existing = session.query(DisasterEvent).filter(
                DisasterEvent.location_id == loc.id,
                DisasterEvent.hazard_type == e_data["hazard_type"],
                DisasterEvent.record_type == e_data["record_type"]
            ).first()
            
            if not existing:
                ev = DisasterEvent(
                    location_id=loc.id,
                    hazard_type=e_data["hazard_type"],
                    severity=e_data["severity"],
                    record_type=e_data["record_type"],
                    risk_score=e_data["risk_score"],
                    model_version=e_data["model_version"],
                    data_source=e_data["data_source"],
                    source_reference=e_data["source_reference"],
                    alert_triggered=e_data["alert_triggered"],
                    event_time=e_data["event_time"],
                    notes=e_data["notes"]
                )
                session.add(ev)
                session.flush()
                created_events.append(ev)
                print(f"  [+] Added event: {e_data['location_name']} - {e_data['hazard_type'].value} ({e_data['severity'].value})")
            else:
                created_events.append(existing)
                print(f"  [-] Event exists: {e_data['location_name']} - {e_data['hazard_type'].value}")
        session.commit()

        # 5. Multi-Lifecycle Operational Alerts & Immutable Audit Logs
        print("\n[5/6] Seeding operational alerts with full audit trails...")
        
        # Alert 1: ACTIVE High Landslide Alert in Meppadi
        ev_meppadi = next((e for e in created_events if "Meppadi" in e.location.name and e.hazard_type == HazardType.LANDSLIDE), None)
        if ev_meppadi:
            existing_alert = session.query(Alert).filter(Alert.disaster_event_id == ev_meppadi.id).first()
            if not existing_alert:
                alert1 = Alert(
                    location_id=ev_meppadi.location_id,
                    disaster_event_id=ev_meppadi.id,
                    severity=SeverityLevel.HIGH,
                    title="HIGH Landslide Warning: Meppadi Valley Slope Saturation",
                    message="ML Risk Engine detected 78/100 risk score due to sustained 24-hour rainfall of 148mm and high antecedent soil moisture. Vulnerable hillslopes require precautionary monitoring.",
                    status=AlertStatus.ACTIVE
                )
                session.add(alert1)
                session.flush()
                audit1 = AlertAudit(
                    alert_id=alert1.id,
                    actor="DisasterSense EarlyWarningEngine",
                    action="TRIGGERED",
                    note="Automated threshold breach (Score: 78/100). Notification broadcasted to district response cell."
                )
                session.add(audit1)
                print(f"  [+] Created ACTIVE alert: {alert1.title}")

        # Alert 2: RESPONSE_IN_PROGRESS Flood Alert in Aluva
        ev_aluva = next((e for e in created_events if "Aluva" in e.location.name and e.record_type == RecordType.PREDICTIVE), None)
        if ev_aluva:
            existing_alert = session.query(Alert).filter(Alert.disaster_event_id == ev_aluva.id).first()
            if not existing_alert:
                alert2 = Alert(
                    location_id=ev_aluva.location_id,
                    disaster_event_id=ev_aluva.id,
                    severity=SeverityLevel.HIGH,
                    title="HIGH Flood Alert: Periyar River Fluvial Inundation Threat",
                    message="Periyar River discharge upstream has elevated downstream river stage by 1.8 meters. Low-lying market zones and colonies placed on heightened watch.",
                    status=AlertStatus.RESPONSE_IN_PROGRESS,
                    acknowledged_by="responder@disastersense.org",
                    acknowledged_at=now_utc - timedelta(hours=4)
                )
                session.add(alert2)
                session.flush()
                session.add(AlertAudit(
                    alert_id=alert2.id,
                    actor="DisasterSense EarlyWarningEngine",
                    action="TRIGGERED",
                    note="Score 74/100 crossed high severity threshold (0.70)."
                ))
                session.add(AlertAudit(
                    alert_id=alert2.id,
                    actor="responder@disastersense.org",
                    action="ACKNOWLEDGED",
                    note="Reviewed hydrologic telemetry with Irrigation Dept. Upstream dam discharge confirmed."
                ))
                session.add(AlertAudit(
                    alert_id=alert2.id,
                    actor="responder@disastersense.org",
                    action="RESPONSE_STARTED",
                    note="State Disaster Response Force (SDRF) unit prepositioned at Aluva Town Relief Camp."
                ))
                print(f"  [+] Created RESPONSE_IN_PROGRESS alert: {alert2.title}")

        # Alert 3: RESOLVED Historical Flood Alert in Chengannur
        ev_chengan = next((e for e in created_events if "Chengannur" in e.location.name and e.hazard_type == HazardType.FLOOD), None)
        if ev_chengan:
            existing_alert = session.query(Alert).filter(Alert.disaster_event_id == ev_chengan.id).first()
            if not existing_alert:
                alert3 = Alert(
                    location_id=ev_chengan.location_id,
                    disaster_event_id=ev_chengan.id,
                    severity=SeverityLevel.HIGH,
                    title="RESOLVED: Pamba River Catchment Fluvial Inundation",
                    message="Pamba river floodwaters have receded back into natural banks. River level stable at 2.4 meters below danger threshold.",
                    status=AlertStatus.RESOLVED,
                    acknowledged_by="responder@disastersense.org",
                    acknowledged_at=now_utc - timedelta(days=2),
                    resolved_at=now_utc - timedelta(hours=10)
                )
                session.add(alert3)
                session.flush()
                session.add(AlertAudit(
                    alert_id=alert3.id,
                    actor="DisasterSense EarlyWarningEngine",
                    action="TRIGGERED",
                    note="Hydraulic backwater surge detected."
                ))
                session.add(AlertAudit(
                    alert_id=alert3.id,
                    actor="responder@disastersense.org",
                    action="ACKNOWLEDGED",
                    note="Civil defense deployed sandbagging along vulnerable bund."
                ))
                session.add(AlertAudit(
                    alert_id=alert3.id,
                    actor="responder@disastersense.org",
                    action="RESOLVED",
                    note="Gauge station readings verified normal. Inundation subsiding, all residents returned safely."
                ))
                print(f"  [+] Created RESOLVED alert: {alert3.title}")

        session.commit()

        # 6. ML Governance Feedback and Ground Truth
        print("\n[6/6] Seeding human-in-the-loop ML feedback records...")
        admin_user = session.query(User).filter(User.email == "admin@disastersense.org").first()
        admin_id = admin_user.id if admin_user else 1

        feedbacks_data = [
            {
                "hazard_type": "landslide",
                "feedback_type": FeedbackType.CONFIRMED_EVENT,
                "review_status": ReviewStatus.APPROVED_GROUND_TRUTH,
                "observed_outcome": "Catastrophic slope failure verified",
                "notes": "Geological Survey ground reconnaissance confirmed slope failure at 04:15 UTC. Model prediction (0.96) was highly accurate.",
                "feature_snapshot": '{"rainfall_24h": 280.0, "slope": 44.0, "antecedent_rainfall_7d": 410.0}',
                "provenance": "Field Reconnaissance Report - GSI Southern Region",
                "evidence_type": "GEOLOGICAL_SURVEY_REPORT",
                "evidence_reference": "GSI-KL-2024-WYND-01"
            },
            {
                "hazard_type": "flood",
                "feedback_type": FeedbackType.DATA_CORRECTION,
                "review_status": ReviewStatus.APPROVED_GROUND_TRUTH,
                "observed_outcome": "Gauge calibration discrepancy resolved",
                "notes": "Upstream gauge telemetry recalibration: local manual station recorded 165mm vs 142mm interpolated estimate.",
                "feature_snapshot": '{"rainfall_24h": 165.0, "river_stage_m": 4.8}',
                "provenance": "CWC Hydrological Observation Station",
                "evidence_type": "GAUGE_TELEMETRY",
                "evidence_reference": "CWC-PERIYAR-2026-09"
            },
            {
                "hazard_type": "landslide",
                "feedback_type": FeedbackType.FALSE_POSITIVE,
                "review_status": ReviewStatus.ACCEPTED,
                "observed_outcome": "No slope displacement observed",
                "notes": "Transient radar artifact overestimated precipitation during dry spell; local inspection verified hillslope stability.",
                "feature_snapshot": '{"rainfall_intensity": 1.2, "vegetation_cover": "dense"}',
                "provenance": "District Emergency Operations Center Verification",
                "evidence_type": "LOCAL_RESPONDER_INSPECTION",
                "evidence_reference": "DEOC-WYND-VERIF-42"
            }
        ]

        for fb in feedbacks_data:
            existing = session.query(MLFeedback).filter(MLFeedback.notes == fb["notes"]).first()
            if not existing:
                item = MLFeedback(
                    hazard_type=fb["hazard_type"],
                    feedback_type=fb["feedback_type"],
                    review_status=fb["review_status"],
                    observed_outcome=fb["observed_outcome"],
                    notes=fb["notes"],
                    feature_snapshot=fb["feature_snapshot"],
                    provenance=fb["provenance"],
                    evidence_type=fb["evidence_type"],
                    evidence_reference=fb["evidence_reference"],
                    reviewed_by_id=admin_id,
                    reviewed_at=now_utc
                )
                session.add(item)
                print(f"  [+] Added ML feedback: {fb['feedback_type'].value} ({fb['review_status'].value})")
            else:
                print(f"  [-] ML feedback already exists: {fb['feedback_type'].value}")
        session.commit()

        print("\n" + "=" * 65)
        print("[+] All operational and demonstration data successfully seeded!")
        print("=" * 65)

    except Exception as exc:
        session.rollback()
        print(f"\n[!] Error during seeding: {exc}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
