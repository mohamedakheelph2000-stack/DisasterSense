import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.emergency_resource import EmergencyResource, ResourceType, VerificationStatus
from app.models.disaster_event import RecordType
from app.core.security import get_password_hash

def seed_production():
    db = SessionLocal()
    try:
        print("Seeding initial system users...")
        users = [
            ("admin@disastersense.org", "System Administrator", "Password123!", UserRole.ADMIN),
            ("responder@disastersense.org", "Emergency Responder", "Password123!", UserRole.RESPONDER),
            ("citizen@disastersense.org", "Citizen Observer", "Password123!", UserRole.CITIZEN),
        ]
        for email, name, pwd, role in users:
            existing = db.query(User).filter_by(email=email).first()
            if not existing:
                u = User(
                    email=email,
                    full_name=name,
                    hashed_password=get_password_hash(pwd),
                    role=role,
                    is_active=True
                )
                db.add(u)
                print(f"Created user: {email} ({role})")
        db.commit()

        print("Seeding Kerala monitored locations...")
        locations = [
            ("Wayanad (Chooralmala-Mundakkai)", "High landslide vulnerability valley", 11.5367, 76.1436, 1200.0, "Wayanad"),
            ("Wayanad (Meppadi Valley)", "Major landslide zone in Western Ghats", 11.5520, 76.1245, 913.0, "Wayanad"),
            ("Chengannur", "High-risk flood plain along Pamba river", 9.3175, 76.6167, 12.0, "Alappuzha"),
            ("Aluva (Periyar River Basin)", "Primary industrial & river catchment flood plain", 10.1076, 76.3516, 12.8, "Ernakulam"),
            ("Idukki (Pettimudi)", "Steep tea estate slopes prone to debris flows", 10.1583, 77.0167, 1500.0, "Idukki"),
            ("Malappuram (Kavalappara-Nilambur)", "High slope instability & flood catchment", 11.2750, 76.2410, 47.3, "Malappuram"),
        ]
        for name, desc, lat, lon, elev, dist in locations:
            existing = db.query(Location).filter_by(name=name).first()
            if not existing:
                loc = Location(
                    name=name,
                    description=desc,
                    latitude=lat,
                    longitude=lon,
                    elevation_m=elev,
                    district=dist,
                    state="Kerala",
                    country="India"
                )
                db.add(loc)
                print(f"Added location: {name}")
        db.commit()

        print("Seeding verified emergency resources...")
        resources = [
            ("NDRF 04 Battalion Camp", ResourceType.RELIEF_CENTER, 11.5420, 76.1380, 50, "Operational", "Contact: 1077"),
            ("Wayanad District General Hospital", ResourceType.HOSPITAL, 11.6050, 76.0830, 250, "Operational", "Contact: 04936-202245"),
            ("Chengannur Relief Centre", ResourceType.RELIEF_CENTER, 9.3210, 76.6190, 500, "Operational", "Contact: 0479-2452334"),
            ("Ernakulam Medical College & Trauma Center", ResourceType.HOSPITAL, 10.0540, 76.3540, 600, "Operational", "Contact: 0484-2754000"),
            ("Kerala Fire & Rescue Meppadi Station", ResourceType.FIRE_STATION, 11.5540, 76.1260, 30, "Operational", "Contact: 101"),
        ]
        for name, rtype, lat, lon, cap, status, contact in resources:
            existing = db.query(EmergencyResource).filter_by(name=name).first()
            if not existing:
                r = EmergencyResource(
                    name=name,
                    resource_type=rtype,
                    latitude=lat,
                    longitude=lon,
                    capacity=cap,
                    contact_info=contact,
                    source="Kerala State Disaster Management Authority (KSDMA)",
                    record_type=RecordType.HISTORICAL,
                    verification_status=VerificationStatus.VERIFIED
                )
                db.add(r)
                print(f"Added resource: {name}")
        db.commit()

        print("Production seeding complete!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_production()
