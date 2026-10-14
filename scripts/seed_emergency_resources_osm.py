"""Seed emergency facilities (hospitals, ambulance, police, fire) from OpenStreetMap.

Fetches live OSM data through the Overpass API for the Kerala bbox, maps OSM
tags onto DisasterSense resource types, extracts phone numbers where the
contributor supplied them, and upserts the result into ``emergency_resources``.

Usage:
    python scripts/seed_emergency_resources_osm.py            # incremental upsert
    python scripts/seed_emergency_resources_osm.py --replace  # wipe OSM rows first
    python scripts/seed_emergency_resources_osm.py --limit 6  # only first 6 tiles

Data is crowd-sourced (ODbL) — records are stored UNVERIFIED until reviewed,
which is why the UI labels them as OpenStreetMap sourced.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(ROOT, "backend")
for path in (ROOT, BACKEND_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

# Load backend/.env explicitly so the script works from any working directory.
_env_file = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(_env_file):
    try:
        from dotenv import load_dotenv

        load_dotenv(_env_file, override=False)
    except Exception:  # noqa: BLE001 - fall back to a tiny line parser
        with open(_env_file, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

from app.core.database import SessionLocal  # noqa: E402
from app.models.disaster_event import RecordType  # noqa: E402
from app.models.emergency_resource import (  # noqa: E402
    EmergencyResource,
    ResourceType,
    VerificationStatus,
)
from app.models.location import Location  # noqa: E402

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
USER_AGENT = "DisasterSense/1.0 (emergency facility seeding; contact admin@disastersense.local)"
SOURCE_NAME = "OpenStreetMap contributors (ODbL)"

# Kerala bounding box split into 12 tiles so no single query times out.
LAT_MIN, LAT_MAX = 8.0, 12.8
LON_MIN, LON_MAX = 74.8, 77.5
LAT_BANDS = 6
LON_BANDS = 2

AMENITY_FILTER = "hospital|clinic|doctors|fire_station|police|ambulance_station"
HEALTHCARE_FILTER = "hospital|clinic|doctor|centre|center|physician|ambulance"


def tiles() -> Iterable[Tuple[float, float, float, float]]:
    lat_step = (LAT_MAX - LAT_MIN) / LAT_BANDS
    lon_step = (LON_MAX - LON_MIN) / LON_BANDS
    for i in range(LAT_BANDS):
        for j in range(LON_BANDS):
            south = LAT_MIN + i * lat_step
            north = south + lat_step
            west = LON_MIN + j * lon_step
            east = west + lon_step
            yield (south, west, north, east)


def build_query(box: Tuple[float, float, float, float]) -> str:
    south, west, north, east = box
    area = f"({south:.4f},{west:.4f},{north:.4f},{east:.4f})"
    return (
        "[out:json][timeout:120];"
        "(node[\"amenity\"~\"" + AMENITY_FILTER + "\"]" + area + ";"
        "way[\"amenity\"~\"" + AMENITY_FILTER + "\"]" + area + ";"
        "node[\"healthcare\"~\"" + HEALTHCARE_FILTER + "\"]" + area + ";"
        "way[\"healthcare\"~\"" + HEALTHCARE_FILTER + "\"]" + area + ";"
        "node[\"office\"=\"fire_station\"]" + area + ";"
        ");"
        "out center 300;"
    )


def overpass(query: str, rounds: int = 3) -> Dict[str, Any]:
    """Query every mirror, round by round.

    Public Overpass instances go in and out of 504s, and a couple of mirrors
    only carry a single country (they answer 200 with zero rows).  So an empty
    response is only accepted once *every* mirror has had a chance to answer.
    """
    last_error: Optional[str] = None
    empty_doc: Optional[Dict[str, Any]] = None

    for round_index in range(rounds):
        if round_index:
            time.sleep(15 * round_index)
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = requests.post(
                    endpoint,
                    data={"data": query},
                    headers={"User-Agent": USER_AGENT},
                    timeout=150,
                )
            except Exception as exc:  # noqa: BLE001
                last_error = f"{endpoint}: {exc}"
                time.sleep(4)
                continue

            if response.status_code != 200:
                last_error = f"{endpoint}: HTTP {response.status_code}"
                time.sleep(4)
                continue

            try:
                doc = response.json()
            except ValueError:
                last_error = f"{endpoint}: non-JSON response"
                time.sleep(4)
                continue

            if doc.get("elements"):
                return doc
            empty_doc = empty_doc or doc
            time.sleep(2)

    if empty_doc is not None:
        return empty_doc
    raise RuntimeError(f"Overpass failed after {rounds} rounds: {last_error}")


def classify(tags: Dict[str, str]) -> Optional[ResourceType]:
    amenity = tags.get("amenity", "")
    healthcare = tags.get("healthcare", "")
    office = tags.get("office", "")
    emergency = tags.get("emergency", "")

    if amenity in ("hospital", "clinic", "doctors") or healthcare in (
        "hospital", "clinic", "doctor", "centre", "center", "physician",
    ):
        return ResourceType.HOSPITAL
    if amenity == "ambulance_station" or emergency == "ambulance_station" or healthcare == "ambulance":
        return ResourceType.AMBULANCE
    if amenity == "police":
        return ResourceType.POLICE_STATION
    if amenity == "fire_station" or office == "fire_station":
        return ResourceType.FIRE_STATION
    return None


def extract_phone(tags: Dict[str, str]) -> Optional[str]:
    for key in ("phone", "contact:phone", "emergency:phone", "contact:mobile", "operator:phone"):
        value = (tags.get(key) or "").strip()
        if value:
            return value[:64]
    return None


def extract_address(tags: Dict[str, str]) -> Optional[str]:
    if tags.get("addr:full"):
        return tags["addr:full"][:512]
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:suburb") or tags.get("addr:locality") or tags.get("addr:city"),
    ]
    address = ", ".join(p for p in parts if p)
    if address:
        return address[:512]
    return None


def nearest_district(db, latitude: float, longitude: float) -> Optional[str]:
    """Assign the district of the closest monitored location (within 45 km)."""
    best_district: Optional[str] = None
    best_distance = 45.0
    for loc in db.query(Location).all():
        dlat = (loc.latitude - latitude) * 111.0
        dlon = (loc.longitude - longitude) * 111.0 * max(0.15, abs(latitude) / 90.0)
        distance = (dlat * dlat + dlon * dlon) ** 0.5
        if distance < best_distance:
            best_distance = distance
            best_district = loc.district
    return best_district


def extract_nodes(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for element in doc.get("elements", []):
        tags = element.get("tags") or {}
        rtype = classify(tags)
        if rtype is None:
            continue
        name = (tags.get("name") or tags.get("name:en") or "").strip()
        if not name:
            continue
        if element.get("type") == "node":
            latitude, longitude = element.get("lat"), element.get("lon")
        else:
            center = element.get("center") or {}
            latitude, longitude = center.get("lat"), center.get("lon")
        if latitude is None or longitude is None:
            continue
        records.append(
            {
                "osm_type": element.get("type"),
                "osm_id": element.get("id"),
                "name": name[:255],
                "resource_type": rtype,
                "latitude": float(latitude),
                "longitude": float(longitude),
                "address": extract_address(tags),
                "district": (tags.get("addr:district") or tags.get("addr:city") or "").strip() or None,
                "phone_number": extract_phone(tags),
                "capacity": None,
                "contact_info": tags.get("phone") or tags.get("contact:phone") or None,
            }
        )
    return records


def seed(replace: bool = False, limit_tiles: Optional[int] = None) -> Dict[str, int]:
    db = SessionLocal()
    stats = {"fetched": 0, "inserted": 0, "updated": 0, "skipped": 0, "tiles": 0}
    try:
        if replace:
            removed = (
                db.query(EmergencyResource)
                .filter(EmergencyResource.source == SOURCE_NAME)
                .delete(synchronize_session=False)
            )
            db.commit()
            print(f"Removed {removed} existing OpenStreetMap records.")

        now = datetime.now(timezone.utc)
        for index, box in enumerate(tiles()):
            if limit_tiles is not None and index >= limit_tiles:
                break
            print(f"Tile {index + 1}: {box[0]:.2f},{box[1]:.2f} -> {box[2]:.2f},{box[3]:.2f} ...", flush=True)
            try:
                doc = overpass(build_query(box))
            except Exception as exc:  # noqa: BLE001
                print(f"  tile failed: {exc}")
                stats["tiles"] += 1
                continue
            stats["tiles"] += 1
            print(f"  {len(doc.get('elements', []))} elements returned", flush=True)

            for record in extract_nodes(doc):
                stats["fetched"] += 1
                reference = f"https://www.openstreetmap.org/{record['osm_type']}/{record['osm_id']}"
                existing = (
                    db.query(EmergencyResource)
                    .filter(EmergencyResource.source_reference == reference)
                    .first()
                )
                if existing:
                    changed = False
                    if record["phone_number"] and existing.phone_number != record["phone_number"]:
                        existing.phone_number = record["phone_number"]
                        changed = True
                    if record["address"] and existing.address != record["address"]:
                        existing.address = record["address"]
                        changed = True
                    existing.last_verified_at = now
                    if changed:
                        stats["updated"] += 1
                    else:
                        stats["skipped"] += 1
                    continue

                district = record["district"] or nearest_district(db, record["latitude"], record["longitude"])
                db.add(
                    EmergencyResource(
                        name=record["name"],
                        resource_type=record["resource_type"],
                        latitude=record["latitude"],
                        longitude=record["longitude"],
                        address=record["address"],
                        district=district,
                        source=SOURCE_NAME,
                        source_reference=reference,
                        record_type=RecordType.HISTORICAL,
                        verification_status=VerificationStatus.UNVERIFIED,
                        last_verified_at=now,
                        contact_info=record["contact_info"],
                        phone_number=record["phone_number"],
                    )
                )
                stats["inserted"] += 1
            db.commit()
            time.sleep(2)

        print(
            "Done: fetched={fetched} inserted={inserted} updated={updated} "
            "unchanged={skipped} tiles={tiles}".format(**stats)
        )
        return stats
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replace", action="store_true", help="Delete existing OSM rows first")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N tiles")
    args = parser.parse_args()
    seed(replace=args.replace, limit_tiles=args.limit)


if __name__ == "__main__":
    main()
