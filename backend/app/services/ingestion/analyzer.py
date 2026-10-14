"""Warning analysis: turns raw ingest into low / medium / high area warnings.

Inputs
------
1. Live weather readings pulled by the ``open_meteo`` source (rainfall windows,
   humidity, temperature, elevation) — scored by the ML risk engine.
2. External signals already ingested by the pipeline (news wires, NASA EONET,
   USGS/EMSC seismology) — matched to places and used as corroboration.

Output
------
A warning board where every entry carries an explicit ``warning_level`` of
``low`` | ``medium`` | ``high`` plus the human-readable reasons behind it.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.ingestion.sources import KERALA_DISTRICTS, detect_hazard
from app.services.ingestion.store import SourceStore, SourceItem

logger = logging.getLogger("disastersense.ingestion.analyzer")

EXTERNAL_SIGNAL_HOURS = 8
LEVEL_ORDER = {"low": 0, "medium": 1, "high": 2}


def score_to_warning_level(score: float) -> str:
    """Map the 0-100 risk score onto the user-facing three-band scale."""
    if score >= 60:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def raise_level(current: str, candidate: str) -> str:
    return candidate if LEVEL_ORDER.get(candidate, 0) > LEVEL_ORDER.get(current, 0) else current


def _severity_hint_to_level(hint: Optional[str]) -> str:
    if hint == "high":
        return "high"
    if hint == "medium":
        return "medium"
    return "low"


def _score_location(row: Dict[str, Any]) -> Dict[str, Any]:
    """Run the real ML flood + landslide models over one weather reading."""
    from ml.src.inference.risk_engine import risk_engine
    from ml.src.flood.flood_features import FloodInputSchema
    from ml.src.landslide.landslide_features import LandslideInputSchema

    elevation = float(row.get("elevation_m") or 50.0)
    rainfall_24h = float(row.get("rainfall_24h_mm") or 0.0)
    intensity = float(row.get("rainfall_intensity_mm_h") or 0.0)
    antecedent = float(row.get("antecedent_rainfall_7d_mm") or 0.0)
    temperature = float(row.get("temperature_c") or 26.5)
    humidity = float(row.get("humidity_pct") or 80.0)

    flood = risk_engine.predict_flood(
        FloodInputSchema(
            rainfall_mm_24h=rainfall_24h,
            rainfall_intensity_mm_h=intensity,
            rainfall_duration_h=12.0,
            antecedent_rainfall_7d_mm=antecedent,
            temperature_c=temperature,
            humidity_pct=humidity,
            elevation_m=elevation,
            slope_deg=max(1.0, elevation / 40.0),
            drainage_capacity_score=5.0,
            soil_saturation_pct=min(100.0, max(15.0, antecedent * 1.8 + 20.0)),
            historical_flood_count=1,
            distance_to_river_m=600.0,
        ),
        mode="automatic",
    )
    landslide = risk_engine.predict_landslide(
        LandslideInputSchema(
            rainfall_mm_24h=rainfall_24h,
            rainfall_intensity_mm_h=intensity,
            antecedent_rainfall_7d_mm=antecedent,
            temperature_c=temperature,
            humidity_pct=humidity,
            slope_deg=max(5.0, elevation / 30.0),
            elevation_m=elevation,
            soil_type_code=2.0,
            soil_moisture_pct=min(100.0, max(20.0, antecedent * 2.0 + 25.0)),
            geological_stability_index=5.0,
            vegetation_cover_pct=55.0,
            historical_landslide_count=1,
            road_cut_proximity_m=300.0,
        ),
        mode="automatic",
    )

    hill_district = elevation > 300.0 or (row.get("district") or "") in ("Wayanad", "Idukki", "Palakkad")
    primary = landslide if hill_district else flood
    secondary = flood if hill_district else landslide

    return {
        "primary_hazard": primary.hazard_type,
        "primary_score": round(float(primary.risk_score), 1),
        "primary_level": primary.severity,
        "model_name": primary.model_name,
        "model_version": primary.model_version,
        "flood_score": round(float(flood.risk_score), 1),
        "landslide_score": round(float(landslide.risk_score), 1),
        "rainfall_24h_mm": rainfall_24h,
        "rainfall_intensity_mm_h": intensity,
        "antecedent_rainfall_7d_mm": antecedent,
        "temperature_c": temperature,
        "humidity_pct": humidity,
        "wind_speed_kmh": float(row.get("wind_speed_kmh") or 0.0),
        "secondary_hazard": secondary.hazard_type,
        "secondary_score": round(float(secondary.risk_score), 1),
    }


def _weather_reasons(scored: Dict[str, Any]) -> List[str]:
    reasons: List[str] = []
    rain24 = scored["rainfall_24h_mm"]
    intensity = scored["rainfall_intensity_mm_h"]
    antecedent = scored["antecedent_rainfall_7d_mm"]

    if rain24 >= 204.5:
        reasons.append(f"Extremely heavy rain — {rain24:.0f} mm in 24 h (IMD extremely-heavy band)")
    elif rain24 >= 115.5:
        reasons.append(f"Very heavy rain — {rain24:.0f} mm in 24 h")
    elif rain24 >= 64.5:
        reasons.append(f"Heavy rain — {rain24:.0f} mm in 24 h")
    elif rain24 >= 20.0:
        reasons.append(f"Moderate rain — {rain24:.0f} mm in 24 h")
    else:
        reasons.append(f"Light rain — {rain24:.0f} mm in 24 h")

    if intensity >= 30:
        reasons.append(f"Rain rate {intensity:.1f} mm/h — cloudburst-level intensity")
    elif intensity >= 10:
        reasons.append(f"Rain rate {intensity:.1f} mm/h")

    if antecedent >= 150:
        reasons.append(f"Soil already saturated by {antecedent:.0f} mm over the previous week")
    elif antecedent >= 60:
        reasons.append(f"{antecedent:.0f} mm antecedent rain in the last 7 days")

    if scored["humidity_pct"] >= 90:
        reasons.append(f"Relative humidity {scored['humidity_pct']:.0f}%")
    if scored["wind_speed_kmh"] >= 40:
        reasons.append(f"Wind {scored['wind_speed_kmh']:.0f} km/h")
    return reasons


def _matches_place(item: SourceItem, place: str) -> bool:
    if not place:
        return False
    if item.place and item.place.lower() == place.lower():
        return True
    return place.lower() in (item.title or "").lower() or place.lower() in (item.summary or "").lower()


def build_warnings(store: SourceStore) -> Dict[str, Any]:
    """Analyse everything the pipeline has fetched and emit the warning board."""
    now = datetime.now(timezone.utc).isoformat()
    weather = store.payload("open_meteo") or {}
    readings = weather.get("locations") or []
    external = store.recent(within_hours=EXTERNAL_SIGNAL_HOURS, limit=300)

    warnings: List[Dict[str, Any]] = []
    external_signals: List[Dict[str, Any]] = []
    weather_available = bool(readings)

    # ── 1. Model-driven warnings for every monitored location ────────────
    for row in readings:
        try:
            scored = _score_location(row)
        except Exception as exc:  # noqa: BLE001 - analysis must never crash the loop
            logger.warning("Scoring failed for %s: %s", row.get("name"), exc)
            continue

        district = row.get("district") or row.get("name") or "Unknown area"
        level = score_to_warning_level(scored["primary_score"])
        reasons = _weather_reasons(scored)
        sources = {"open_meteo"}
        matched: List[SourceItem] = []

        for item in external:
            if _matches_place(item, district):
                matched.append(item)
                sources.add(item.source_key)
                hint_level = _severity_hint_to_level(item.severity_hint)
                if hint_level != "low" or item.severity_hint is None:
                    level = raise_level(level, hint_level if item.severity_hint else "low")
                label = item.source_key.replace("_", " ")
                reasons.append(f"[{label}] {item.title[:120]}")
                if len(reasons) >= 8:
                    break

        warnings.append(
            {
                "area": district,
                "state": row.get("state") or "Kerala",
                "location_id": row.get("location_id"),
                "location_name": row.get("name"),
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "hazard": scored["primary_hazard"],
                "secondary_hazard": scored["secondary_hazard"],
                "risk_score": scored["primary_score"],
                "flood_score": scored["flood_score"],
                "landslide_score": scored["landslide_score"],
                "warning_level": level,
                "severity": "critical" if scored["primary_level"] == "critical" and level == "high" else scored["primary_level"],
                "reasons": reasons[:8],
                "sources": sorted(sources),
                "model_name": scored["model_name"],
                "model_version": scored["model_version"],
                "rainfall_24h_mm": scored["rainfall_24h_mm"],
                "updated_at": now,
            }
        )

    # ── 2. Signals from monitored sources that map to other areas ────────
    matched_districts = {w["area"].lower() for w in warnings}
    for item in external:
        place = item.place or detect_place_from_item(item)
        if not place:
            continue
        external_signals.append(
            {
                "area": place,
                "title": item.title,
                "link": item.link,
                "source_key": item.source_key,
                "hazard": item.hazard or detect_hazard(item.title),
                "warning_level": _severity_hint_to_level(item.severity_hint),
                "published_at": item.published_at,
                "summary": item.summary,
            }
        )
        if place.lower() in matched_districts:
            continue
        warnings.append(
            {
                "area": place,
                "state": "India",
                "location_id": None,
                "location_name": None,
                "latitude": item.latitude,
                "longitude": item.longitude,
                "hazard": item.hazard or detect_hazard(item.title),
                "secondary_hazard": None,
                "risk_score": None,
                "flood_score": None,
                "landslide_score": None,
                "warning_level": _severity_hint_to_level(item.severity_hint),
                "severity": "high" if item.severity_hint == "high" else "moderate",
                "reasons": [f"[{item.source_key.replace('_', ' ')}] {item.title[:140]}"],
                "sources": [item.source_key],
                "model_name": None,
                "model_version": None,
                "rainfall_24h_mm": None,
                "updated_at": now,
                "external": True,
            }
        )
        matched_districts.add(place.lower())

    counts = {"high": 0, "medium": 0, "low": 0}
    for warning in warnings:
        counts[warning["warning_level"]] = counts.get(warning["warning_level"], 0) + 1

    warnings.sort(
        key=lambda w: (LEVEL_ORDER.get(w["warning_level"], 0), w.get("risk_score") or 0),
        reverse=True,
    )

    return {
        "generated_at": now,
        "weather_source": weather.get("fetched_at"),
        "weather_available": weather_available,
        "monitored_locations": len(readings),
        "external_signals_considered": len(external),
        "counts": counts,
        "warnings": warnings,
        "flood_areas": [w for w in warnings if w["hazard"] == "flood"],
        "landslide_areas": [w for w in warnings if w["hazard"] == "landslide"],
        "external_signals": external_signals[:50],
    }


def detect_place_from_item(item: SourceItem) -> Optional[str]:
    if item.place:
        return item.place
    for district in KERALA_DISTRICTS:
        if district.lower() in (item.title or "").lower():
            return district
    return None
