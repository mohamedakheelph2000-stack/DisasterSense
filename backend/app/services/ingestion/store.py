"""Snapshot store for the 24/7 ingestion pipeline.

Every source the pipeline polls writes its findings here.  The store keeps:

* a rolling window of de-duplicated ``SourceItem`` records per source,
* the per-source health state (last attempt / last success / last error),
* the last payload a source produced (for sources that return measurements
  rather than news items, e.g. weather readings).

The whole snapshot is periodically serialised to ``backend/var/`` so a restart
does not wipe the evidence trail.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

SNAPSHOT_PATH = Path(__file__).resolve().parents[3] / "var" / "ingestion_snapshot.json"
MAX_ITEMS_PER_SOURCE = 400
MAX_AGE_HOURS = 72


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


@dataclass
class SourceItem:
    """A single normalised record fetched from an external source."""

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

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SourceItem":
        known = {f: data.get(f) for f in cls.__dataclass_fields__}
        return cls(**known)


@dataclass
class SourceState:
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

    @property
    def healthy(self) -> bool:
        return self.consecutive_errors == 0

    def to_dict(self, item_count: int = 0) -> Dict[str, Any]:
        payload = asdict(self)
        payload["healthy"] = self.healthy
        payload["item_count"] = item_count
        return payload


class SourceStore:
    """Thread-safe rolling store shared by the worker threads and the API."""

    def __init__(self, path: Optional[Path] = None) -> None:
        self._lock = threading.RLock()
        self.path = path or SNAPSHOT_PATH
        self.items: Dict[str, SourceItem] = {}
        self.states: Dict[str, SourceState] = {}
        self.payloads: Dict[str, Dict[str, Any]] = {}
        self._latencies: Dict[str, List[int]] = {}
        self.load()

    # ── registration ──────────────────────────────────────────────────────
    def register(
        self,
        key: str,
        *,
        label: str,
        org: str,
        trust: str,
        url: str,
        cadence_seconds: int,
        category: str,
        description: str = "",
    ) -> SourceState:
        with self._lock:
            state = self.states.get(key)
            if state is None:
                state = SourceState(
                    key=key,
                    label=label,
                    org=org,
                    trust=trust,
                    url=url,
                    cadence_seconds=cadence_seconds,
                    category=category,
                    description=description,
                )
                self.states[key] = state
            else:
                # Metadata may change between deploys — refresh it.
                state.label = label
                state.org = org
                state.trust = trust
                state.url = url
                state.cadence_seconds = cadence_seconds
                state.category = category
                state.description = description
            return state

    # ── recording ─────────────────────────────────────────────────────────
    def record_attempt(self, key: str) -> float:
        """Mark a fetch attempt; returns the monotonic start time."""
        with self._lock:
            state = self.states.get(key)
            if state:
                state.last_attempt = utcnow_iso()
                state.total_fetches += 1
        return time.monotonic()

    def record_success(
        self,
        key: str,
        started: float,
        items: Iterable[SourceItem] = (),
        payload: Optional[Dict[str, Any]] = None,
    ) -> int:
        latency = int((time.monotonic() - started) * 1000)
        with self._lock:
            state = self.states.get(key)
            if state:
                state.last_success = utcnow_iso()
                state.last_error = None
                state.consecutive_errors = 0
                state.last_latency_ms = latency
                bucket = self._latencies.setdefault(key, [])
                bucket.append(latency)
                del bucket[:-50]
                state.avg_latency_ms = int(sum(bucket) / len(bucket))

            fresh: List[SourceItem] = []
            for item in items:
                existing = self.items.get(item.id)
                if existing is None:
                    item.fetched_at = item.fetched_at or utcnow_iso()
                    self.items[item.id] = item
                    fresh.append(item)
                else:
                    existing.fetched_at = utcnow_iso()
                    if item.summary and not existing.summary:
                        existing.summary = item.summary

            if payload is not None:
                self.payloads[key] = payload

            self._prune()
            if state:
                state.records = len(self._items_for(key))
            self.save()
            return state.records if state else 0

    def record_error(self, key: str, error: str, started: float) -> None:
        with self._lock:
            state = self.states.get(key)
            if state:
                state.last_error = str(error)[:500]
                state.last_error_at = utcnow_iso()
                state.consecutive_errors += 1
                state.total_failures += 1
                state.last_latency_ms = int((time.monotonic() - started) * 1000)

    # ── reads ─────────────────────────────────────────────────────────────
    def _items_for(self, key: str) -> List[SourceItem]:
        return [i for i in self.items.values() if i.source_key == key]

    def items_for(self, key: str) -> List[SourceItem]:
        with self._lock:
            return sorted(
                self._items_for(key),
                key=lambda i: (i.published_at or i.fetched_at or ""),
                reverse=True,
            )

    def recent(
        self,
        *,
        hazard: Optional[str] = None,
        source_key: Optional[str] = None,
        within_hours: int = MAX_AGE_HOURS,
        limit: int = 200,
    ) -> List[SourceItem]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=within_hours)
        with self._lock:
            out: List[SourceItem] = []
            for item in self.items.values():
                if hazard and item.hazard != hazard:
                    continue
                if source_key and item.source_key != source_key:
                    continue
                stamp = _parse_iso(item.published_at) or _parse_iso(item.fetched_at)
                if stamp is not None and stamp.tzinfo is None:
                    stamp = stamp.replace(tzinfo=timezone.utc)
                if stamp is not None and stamp < cutoff:
                    continue
                out.append(item)
            out.sort(key=lambda i: (i.published_at or i.fetched_at or ""), reverse=True)
            return out[:limit]

    def payload(self, key: str) -> Dict[str, Any]:
        with self._lock:
            return dict(self.payloads.get(key) or {})

    def status(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [
                state.to_dict(item_count=len(self._items_for(key)))
                for key, state in sorted(self.states.items())
            ]

    def counts(self) -> Dict[str, int]:
        with self._lock:
            counts: Dict[str, int] = {}
            for item in self.items.values():
                counts[item.source_key] = counts.get(item.source_key, 0) + 1
            return counts

    # ── persistence ───────────────────────────────────────────────────────
    def _prune(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        stale = [
            key
            for key, item in self.items.items()
            if (_parse_iso(item.published_at) or _parse_iso(item.fetched_at) or cutoff)
            < cutoff
        ]
        for key in stale:
            self.items.pop(key, None)
        for source_key in list(self.states):
            bucket = self._items_for(source_key)
            if len(bucket) <= MAX_ITEMS_PER_SOURCE:
                continue
            bucket.sort(key=lambda i: (i.published_at or i.fetched_at or ""))
            for item in bucket[: len(bucket) - MAX_ITEMS_PER_SOURCE]:
                self.items.pop(item.id, None)

    def save(self) -> None:
        if not self.path:
            return
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            doc = {
                "saved_at": utcnow_iso(),
                "items": [i.to_dict() for i in self.items.values()],
                "states": {k: asdict(v) for k, v in self.states.items()},
                "payloads": self.payloads,
            }
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(doc, default=str), encoding="utf-8")
            tmp.replace(self.path)
        except Exception:  # noqa: BLE001 - persistence must never break ingestion
            pass

    def load(self) -> None:
        if not self.path or not self.path.exists():
            return
        try:
            doc = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return
        try:
            for raw in doc.get("items", []):
                item = SourceItem.from_dict(raw)
                self.items[item.id] = item
            for key, raw in (doc.get("states") or {}).items():
                known = {f: raw.get(f) for f in SourceState.__dataclass_fields__}
                self.states[key] = SourceState(**known)
            self.payloads = dict(doc.get("payloads") or {})
        except Exception:  # noqa: BLE001
            return

    def clear(self) -> None:
        with self._lock:
            self.items.clear()
            self.payloads.clear()


source_store = SourceStore()
