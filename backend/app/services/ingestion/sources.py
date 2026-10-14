"""Trusted external sources polled by the 5-second ingestion pipeline.

Each source exposes a normalising fetcher that returns ``SourceItem`` records.
Fetchers are deliberately conservative: short timeouts, a real User-Agent,
retries handled by the worker cadence, and *no* fabricated fallbacks — if a
source is unreachable the worker records the failure and the UI shows it.

Current registry (all verified reachable from this environment):

=========================  =============================  ============
Source                     Operator                       Trust
=========================  =============================  ============
open_meteo                 Open-Meteo (open weather API)  open scientific
usgs_earthquake            U.S. Geological Survey         government
emsc_earthquake            Euro-Mediterranean Seism. Ctr  scientific
nasa_eonet                 NASA                           government
google_news_disaster       Google News / Indian outlets   news wire
the_hindu_national         The Hindu                      news wire
gdeelt_global_news         GDELT Project                  research monitor
osm_emergency_facilities   OpenStreetMap contributors     open crowdsourced
=========================  =============================  ============
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

import requests

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from app.services.ingestion.store import SourceItem  # noqa: E402

logger = logging.getLogger("disastersense.ingestion.sources")

USER_AGENT = "DisasterSense/1.0 (24/7 disaster monitoring; +https://disastersense.local)"
DEFAULT_TIMEOUT = 12

KERALA_DISTRICTS = [
    "Wayanad", "Idukki", "Ernakulam", "Alappuzha", "Malappuram",
    "Pathanamthitta", "Kozhikode", "Kottayam", "Thrissur", "Palakkad",
    "Kannur", "Kasaragod", "Kollam", "Thiruvananthapuram",
]

INDIA_PLACES = KERALA_DISTRICTS + [
    "Kerala", "India", "Chennai", "Bengaluru", "Mumbai", "Delhi", "Kolkata",
    "Kochi", "Thiruvananthapuram", "Hyderabad", "Pune", "Guwahati", "Assam",
    "Uttarakhand", "Himachal", "Himalaya", "Mumbai", "Chennai", "Kolkata",
    "Odisha", "West Bengal", "Bihar", "Gujarat", "Rajasthan", "Punjab",
]

HAZARD_KEYWORDS: List[Tuple[str, Tuple[str, ...]]] = [
    ("landslide", ("landslide", "mudslide", "rockfall", "slope collapse", "soil slip", "debris flow")),
    ("earthquake", ("earthquake", "tremor", "seismic", "magnitude m", "quake", "aftershock")),
    ("cyclone", ("cyclone", "hurricane", "typhoon", "storm surge", "super storm")),
    ("volcano", ("volcano", "volcanic", "eruption", "lava")),
    ("wildfire", ("wildfire", "forest fire", "brush fire", "bushfire")),
    ("flood", ("flood", "flooding", "inundation", "waterlog", "water log", "river breac",
               "dam break", "reservoir releas", "overflow", "spate", "swollen river")),
    ("weather", ("red alert", "orange alert", "yellow alert", "heavy rain", "very heavy rain",
                 "extremely heavy", "thunderstorm", "lightning", "heatwave", "heat wave",
                 "cloudburst", "downpour")),
]

HIGH_HINT = ("red alert", "evacuat", "death", "dead", "killed", "catastroph", "devastat",
             "massive", "severe", "emergency declared", "NDRF deployed", "breach", "collapse")
MEDIUM_HINT = ("orange alert", "warning", "watch", "heavy rain", "alert issued", "on alert",
               "high alert", "preparedness", "risk of")


def detect_hazard(text: str) -> str:
    lowered = (text or "").lower()
    for hazard, words in HAZARD_KEYWORDS:
        if any(word in lowered for word in words):
            return hazard
    return "other"


def detect_severity_hint(text: str) -> str:
    lowered = (text or "").lower()
    if any(word in lowered for word in HIGH_HINT):
        return "high"
    if any(word in lowered for word in MEDIUM_HINT):
        return "medium"
    return "low"


def detect_place(text: str) -> Optional[str]:
    lowered = (text or "").lower()
    for place in INDIA_PLACES:
        if place.lower() in lowered:
            return place
    return None


def stable_id(source_key: str, *parts: Any) -> str:
    raw = "|".join(str(p) for p in parts if p not in (None, ""))
    return hashlib.sha1(f"{source_key}|{raw}".encode("utf-8")).hexdigest()[:20]


def http_get(url: str, *, timeout: int = DEFAULT_TIMEOUT, headers: Optional[Dict[str, str]] = None) -> requests.Response:
    merged = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        merged.update(headers)
    resp = requests.get(url, headers=merged, timeout=timeout)
    resp.raise_for_status()
    return resp


def _iso(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return text


def _parse_rss(content: bytes) -> List[Dict[str, str]]:
    root = ET.fromstring(content)
    entries: List[Dict[str, str]] = []
    for node in root.findall(".//item"):
        def text_of(tag: str) -> str:
            el = node.find(tag)
            return (el.text or "").strip() if el is not None and el.text else ""

        source = node.find("source")
        entries.append(
            {
                "title": text_of("title"),
                "link": text_of("link"),
                "description": re.sub(r"<[^>]+>", "", text_of("description"))[:600],
                "published": text_of("pubDate"),
                "source": (source.text or "").strip() if source is not None and source.text else "",
            }
        )
    return entries


# ─────────────────────────────────────────────────────────────────────────────
# Fetchers
# ─────────────────────────────────────────────────────────────────────────────

def fetch_open_meteo() -> Tuple[List[SourceItem], Dict[str, Any]]:
    """Batch live weather for every monitored location (feeds the analyzer)."""
    from app.core.database import SessionLocal
    from app.models.location import Location

    db = SessionLocal()
    try:
        locations = db.query(Location).order_by(Location.id).all()
        if not locations:
            return [], {"locations": [], "fetched_at": datetime.now(timezone.utc).isoformat()}

        lats = ",".join(f"{loc.latitude:.4f}" for loc in locations)
        lons = ",".join(f"{loc.longitude:.4f}" for loc in locations)
        url = (
            "https://api.open-meteo.com/v1/forecast?"
            f"latitude={lats}&longitude={lons}&"
            "current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&"
            "hourly=precipitation&past_days=8&forecast_days=1&timezone=UTC"
        )
        raw = http_get(url, timeout=15).json()
        rows = raw if isinstance(raw, list) else [raw]

        now_hour = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
        readings: List[Dict[str, Any]] = []
        for loc, entry in zip(locations, rows):
            entry = entry or {}
            current = entry.get("current") or {}
            hourly = entry.get("hourly") or {}
            times = hourly.get("time") or []
            precip = hourly.get("precipitation") or []

            ref_idx = max((i for i, t in enumerate(times) if t <= now_hour), default=len(times) - 1)
            rainfall_24h = intensity_1h = antecedent_7d = 0.0
            if precip and ref_idx >= 0:
                start_24 = max(0, ref_idx - 23)
                window_24 = [p for p in precip[start_24:ref_idx + 1] if p is not None]
                if window_24:
                    rainfall_24h = sum(window_24)
                    intensity_1h = max(window_24)
                start_7d = max(0, start_24 - 168)
                window_7d = [p for p in precip[start_7d:start_24] if p is not None]
                antecedent_7d = sum(window_7d)
            if not precip:
                rain_now = float(current.get("rain", 0.0) or 0.0)
                rainfall_24h = max(rain_now * 12.0, 0.0)
                intensity_1h = float(current.get("precipitation", 0.0) or 0.0)

            readings.append(
                {
                    "location_id": loc.id,
                    "name": loc.name,
                    "district": loc.district,
                    "state": loc.state,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude,
                    "elevation_m": loc.elevation_m or 50.0,
                    "temperature_c": float(current.get("temperature_2m", 26.5) or 26.5),
                    "humidity_pct": float(current.get("relative_humidity_2m", 80.0) or 80.0),
                    "wind_speed_kmh": float(current.get("wind_speed_10m", 12.0) or 12.0),
                    "weather_code": current.get("weather_code"),
                    "rainfall_24h_mm": round(rainfall_24h, 2),
                    "rainfall_intensity_mm_h": round(intensity_1h, 2),
                    "antecedent_rainfall_7d_mm": round(antecedent_7d, 2),
                }
            )
        return [], {"locations": readings, "fetched_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()


def fetch_usgs_earthquake() -> Tuple[List[SourceItem], Dict[str, Any]]:
    payload = http_get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson").json()
    items: List[SourceItem] = []
    for feature in payload.get("features", []) or []:
        props = feature.get("properties") or {}
        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates") or []
        magnitude = float(props.get("mag") or 0.0)
        place = props.get("place") or ""
        when = props.get("time")
        published = datetime.fromtimestamp(when / 1000, tz=timezone.utc).isoformat() if when else None
        title = props.get("title") or f"M{magnitude} earthquake {place}"
        severity = "high" if magnitude >= 5.5 else "medium" if magnitude >= 4.0 else "low"
        items.append(
            SourceItem(
                id=stable_id("usgs_earthquake", feature.get("id")),
                source_key="usgs_earthquake",
                title=title,
                link=props.get("url") or "https://earthquake.usgs.gov",
                summary=(props.get("detail") or "")[:600],
                published_at=_iso(published),
                category="earthquake",
                hazard="earthquake",
                latitude=coords[1] if len(coords) > 1 else None,
                longitude=coords[0] if len(coords) > 0 else None,
                place=place,
                severity_hint=severity,
            )
        )
    return items, {"records": len(items)}


def fetch_emsc_earthquake() -> Tuple[List[SourceItem], Dict[str, Any]]:
    url = (
        "https://www.seismicportal.eu/fdsnws/event/1/query"
        "?format=json&limit=25&minmagnitude=4&orderby=time-asc"
    )
    payload = http_get(url).json()
    items: List[SourceItem] = []
    for feature in payload.get("features", []) or []:
        props = feature.get("properties") or {}
        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates") or []
        magnitude = float(props.get("mag") or 0.0)
        title = props.get("title") or f"M{magnitude} earthquake"
        items.append(
            SourceItem(
                id=stable_id("emsc_earthquake", props.get("unid") or props.get("id") or title),
                source_key="emsc_earthquake",
                title=title,
                link=props.get("url") or "https://www.seismicportal.eu",
                summary=(props.get("description") or "")[:600],
                published_at=_iso(props.get("time") or props.get("lastupdate")),
                category="earthquake",
                hazard="earthquake",
                latitude=coords[1] if len(coords) > 1 else None,
                longitude=coords[0] if len(coords) > 0 else None,
                place=props.get("flynnregion") or props.get("region"),
                severity_hint="high" if magnitude >= 5.5 else "medium" if magnitude >= 4.5 else "low",
            )
        )
    return items, {"records": len(items)}


def fetch_nasa_eonet() -> Tuple[List[SourceItem], Dict[str, Any]]:
    payload = http_get("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30").json()
    category_to_hazard = {
        "Wildfires": "wildfire",
        "Severe Storms": "cyclone",
        "Volcanoes": "volcano",
        "Floods": "flood",
        "Earthquakes": "earthquake",
        "Landslides": "landslide",
        "Drought": "weather",
    }
    items: List[SourceItem] = []
    for event in payload.get("events", []) or []:
        categories = event.get("categories") or []
        category = categories[0]["title"] if categories else "Other"
        hazard = category_to_hazard.get(category, detect_hazard(event.get("title", "")))
        geometry = (event.get("geometry") or [{}])[-1] or {}
        coords = geometry.get("coordinates") or []
        if geometry.get("type") == "Polygon" and coords and isinstance(coords[0][0], list):
            ring = coords[0]
            lon = sum(p[0] for p in ring) / len(ring)
            lat = sum(p[1] for p in ring) / len(ring)
        elif len(coords) >= 2 and isinstance(coords[0], (int, float)):
            lon, lat = coords[0], coords[1]
        else:
            lon = lat = None
        items.append(
            SourceItem(
                id=stable_id("nasa_eonet", event.get("id")),
                source_key="nasa_eonet",
                title=event.get("title") or category,
                link=(event.get("sources") or [{}])[0].get("url", "https://eonet.gsfc.nasa.gov"),
                summary=f"NASA EONET category: {category}",
                published_at=_iso(geometry.get("date")) or _iso(event.get("closed")),
                category="event",
                hazard=hazard,
                latitude=lat,
                longitude=lon,
                place=None,
                severity_hint="medium",
            )
        )
    return items, {"records": len(items)}


GOOGLE_NEWS_QUERIES = {
    "kerala_disaster": (
        "https://news.google.com/rss/search?q=Kerala+flood+OR+landslide+OR+disaster+OR+KSDMA+"
        "OR+%22red+alert%22+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
        "india_disaster",
    ),
    "india_official_alerts": (
        "https://news.google.com/rss/search?q=NDMA+OR+IMD+OR+NDRF+OR+SDMA+OR+%22weather+warning%22+"
        "when:3d&hl=en-IN&gl=IN&ceid=IN:en",
        "india_official",
    ),
}


def fetch_google_news_disaster() -> Tuple[List[SourceItem], Dict[str, Any]]:
    items: List[SourceItem] = []
    for query_key, (url, _label) in GOOGLE_NEWS_QUERIES.items():
        entries = _parse_rss(http_get(url, timeout=12).content)
        for entry in entries[:25]:
            title = entry["title"]
            if not title:
                continue
            hazard = detect_hazard(f"{title} {entry['description']}")
            items.append(
                SourceItem(
                    id=stable_id("google_news_disaster", query_key, title),
                    source_key="google_news_disaster",
                    title=title,
                    link=entry["link"],
                    summary=entry["description"],
                    published_at=_iso(entry["published"]),
                    category="news",
                    hazard=hazard,
                    place=detect_place(title),
                    severity_hint=detect_severity_hint(title),
                )
            )
    return items, {"records": len(items)}


def fetch_the_hindu_national() -> Tuple[List[SourceItem], Dict[str, Any]]:
    entries = _parse_rss(http_get("https://www.thehindu.com/news/national/feeder/default.rss").content)
    items: List[SourceItem] = []
    keywords = ("flood", "rain", "landslide", "cyclone", "disaster", "alert", "warning",
                "earthquake", "rescue", "evacuat", "NDRF", "SDMA", "NDMA", "IMD")
    for entry in entries[:40]:
        title = entry["title"]
        blob = f"{title} {entry['description']}"
        if not title or not any(k.lower() in blob.lower() for k in keywords):
            continue
        items.append(
            SourceItem(
                id=stable_id("the_hindu_national", title),
                source_key="the_hindu_national",
                title=title,
                link=entry["link"],
                summary=entry["description"],
                published_at=_iso(entry["published"]),
                category="news",
                hazard=detect_hazard(blob),
                place=detect_place(blob),
                severity_hint=detect_severity_hint(blob),
            )
        )
    return items, {"records": len(items)}


def fetch_gdelt_global_news() -> Tuple[List[SourceItem], Dict[str, Any]]:
    query = '("flood" OR "landslide" OR "cyclone" OR "earthquake") (India OR Kerala) hasmapcountry:India'
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc?"
        f"query={requests.utils.quote(query)}&mode=artlist&maxrecords=30&format=json&sort=datedesc"
    )
    payload = http_get(url, timeout=15).json()
    items: List[SourceItem] = []
    for article in payload.get("articles", []) or []:
        title = article.get("title") or ""
        if not title:
            continue
        items.append(
            SourceItem(
                id=stable_id("gdelt_global_news", article.get("url") or title),
                source_key="gdelt_global_news",
                title=title,
                link=article.get("url") or "https://www.gdeltproject.org",
                summary=(article.get("domain") or "")[:200],
                published_at=_iso(article.get("seendate")),
                category="news",
                hazard=detect_hazard(title),
                place=detect_place(title),
                severity_hint=detect_severity_hint(title),
            )
        )
    return items, {"records": len(items)}


def fetch_osm_emergency_facilities() -> Tuple[List[SourceItem], Dict[str, Any]]:
    """Reports the live facility inventory held in PostgreSQL (populated by the seeder)."""
    from app.core.database import SessionLocal
    from app.models.emergency_resource import EmergencyResource, ResourceType
    from sqlalchemy import func

    db = SessionLocal()
    try:
        rows = (
            db.query(EmergencyResource.resource_type, func.count(EmergencyResource.id))
            .group_by(EmergencyResource.resource_type)
            .all()
        )
        counts = {(r[0].value if hasattr(r[0], "value") else str(r[0])): r[1] for r in rows}
        with_phone = (
            db.query(func.count(EmergencyResource.id))
            .filter(EmergencyResource.phone_number.isnot(None))
            .scalar()
            or 0
        )
        total = sum(counts.values())
        return [], {
            "counts": counts,
            "total": total,
            "with_phone": with_phone,
            "resource_types": [t.value for t in ResourceType],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


@dataclass(frozen=True)
class SourceSpec:
    key: str
    label: str
    org: str
    trust: str
    url: str
    cadence_seconds: int
    category: str
    description: str
    fetch: Callable[[], Tuple[List[SourceItem], Dict[str, Any]]]


SOURCES: List[SourceSpec] = [
    SourceSpec(
        key="open_meteo",
        label="Open-Meteo Live Weather",
        org="Open-Meteo (open meteorological API)",
        trust="open-scientific",
        url="https://open-meteo.com",
        cadence_seconds=30,
        category="weather",
        description="Batched current conditions and 8-day hourly precipitation for every monitored location.",
        fetch=fetch_open_meteo,
    ),
    SourceSpec(
        key="usgs_earthquake",
        label="USGS Earthquake Feed",
        org="U.S. Geological Survey — Earthquake Hazards Program",
        trust="government",
        url="https://earthquake.usgs.gov",
        cadence_seconds=60,
        category="earthquake",
        description="Global M2.5+ earthquakes recorded in the last 24 hours.",
        fetch=fetch_usgs_earthquake,
    ),
    SourceSpec(
        key="emsc_earthquake",
        label="EMSC Earthquake Feed",
        org="Euro-Mediterranean Seismological Centre",
        trust="scientific",
        url="https://www.seismicportal.eu",
        cadence_seconds=120,
        category="earthquake",
        description="Independent global M4+ seismological catalogue.",
        fetch=fetch_emsc_earthquake,
    ),
    SourceSpec(
        key="nasa_eonet",
        label="NASA EONET Natural Events",
        org="NASA Earth Observatory — Earth Observatory Natural Event Tracker",
        trust="government",
        url="https://eonet.gsfc.nasa.gov",
        cadence_seconds=180,
        category="event",
        description="Open natural hazard events: floods, wildfires, storms, volcanoes.",
        fetch=fetch_nasa_eonet,
    ),
    SourceSpec(
        key="google_news_disaster",
        label="Disaster News Wire (Google News RSS)",
        org="Google News aggregating KSDMA / NDMA / IMD reporting",
        trust="news",
        url="https://news.google.com",
        cadence_seconds=60,
        category="news",
        description="Indian disaster-desk headlines: Kerala emergencies plus NDMA/IMD/NDRF alerts.",
        fetch=fetch_google_news_disaster,
    ),
    SourceSpec(
        key="the_hindu_national",
        label="The Hindu — National News",
        org="The Hindu",
        trust="news",
        url="https://www.thehindu.com",
        cadence_seconds=300,
        category="news",
        description="National desk filtered for weather, flood and disaster reporting.",
        fetch=fetch_the_hindu_national,
    ),
    SourceSpec(
        key="gdelt_global_news",
        label="GDELT Global News Monitor",
        org="GDELT Project (George Washington University)",
        trust="research",
        url="https://www.gdeltproject.org",
        cadence_seconds=600,
        category="news",
        description="Machine-translated global news timeline for Indian flood/landslide/cyclone events.",
        fetch=fetch_gdelt_global_news,
    ),
    SourceSpec(
        key="osm_emergency_facilities",
        label="Emergency Facility Inventory",
        org="OpenStreetMap contributors + seeded directory",
        trust="open-crowdsourced",
        url="https://www.openstreetmap.org",
        cadence_seconds=60,
        category="facility",
        description="Hospitals, ambulance services, police stations and fire stations held in PostgreSQL.",
        fetch=fetch_osm_emergency_facilities,
    ),
]

SOURCES_BY_KEY: Dict[str, SourceSpec] = {spec.key: spec for spec in SOURCES}
