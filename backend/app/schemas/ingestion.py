"""Schemas for the 24/7 ingestion, source-monitor and warning endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict

WarningLevel = str  # "low" | "medium" | "high"


class SourceStatus(BaseModel):
    model_config = ConfigDict(extra="allow")

    key: str
    label: str
    org: str
    trust: str
    url: str
    cadence_seconds: int
    category: str
    description: str = ""
    last_attempt: Optional[str] = None
    last_success: Optional[str] = None
    last_error: Optional[str] = None
    last_error_at: Optional[str] = None
    consecutive_errors: int = 0
    total_fetches: int = 0
    total_failures: int = 0
    records: int = 0
    last_latency_ms: Optional[int] = None
    avg_latency_ms: Optional[int] = None
    healthy: bool = True
    item_count: int = 0


class SourceItemResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    source_key: str
    title: str
    link: str = ""
    summary: str = ""
    published_at: Optional[str] = None
    fetched_at: Optional[str] = None
    category: str = "news"
    hazard: str = "other"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place: Optional[str] = None
    severity_hint: Optional[str] = None


class SourcesResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    sources: List[SourceStatus]
    worker: Dict[str, Any]
    total_records: int


class SourceItemsResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: SourceStatus
    items: List[SourceItemResponse]
    payload: Dict[str, Any]


class WarningItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    area: str
    state: str = "India"
    hazard: str
    warning_level: WarningLevel
    reasons: List[str] = []
    sources: List[str] = []
    updated_at: str
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    risk_score: Optional[float] = None
    flood_score: Optional[float] = None
    landslide_score: Optional[float] = None
    secondary_hazard: Optional[str] = None
    severity: Optional[str] = None
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    rainfall_24h_mm: Optional[float] = None
    external: bool = False


class WarningsResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    generated_at: Optional[str] = None
    weather_available: bool = False
    weather_source: Optional[str] = None
    monitored_locations: int = 0
    external_signals_considered: int = 0
    counts: Dict[str, int] = {}
    warnings: List[WarningItem] = []
    flood_areas: List[WarningItem] = []
    landslide_areas: List[WarningItem] = []
    external_signals: List[Dict[str, Any]] = []


class IngestStatus(BaseModel):
    model_config = ConfigDict(extra="allow")

    running: bool
    tick_seconds: int
    started_at: Optional[str] = None
    last_tick_at: Optional[str] = None
    next_tick_at: Optional[str] = None
    last_tick_duration_ms: Optional[int] = None
    total_ticks: int = 0
    total_fetches: int = 0
    total_failures: int = 0
    last_error: Optional[str] = None
    sources_registered: int = 0
    sources_healthy: int = 0
    sources_with_errors: List[str] = []
    records_held: int = 0
    warnings: Dict[str, Any] = {}
