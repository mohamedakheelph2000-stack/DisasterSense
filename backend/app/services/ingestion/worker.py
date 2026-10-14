"""24/7 ingestion worker — the heartbeat of DisasterSense.

The loop wakes every ``INGEST_TICK_SECONDS`` (default **5**) seconds and:

1. polls every source whose own cadence has elapsed (each upstream keeps a
   rate-limit-safe cadence — 30 s for weather, 60 s for news/seismology and so
   on) so the pipeline genuinely ingests on a 5-second tick without hammering
   any provider;
2. re-runs the warning analysis over everything held in the snapshot store;
3. publishes a status document served by ``GET /api/v1/sources`` and
   ``GET /api/v1/ingest/status``.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from app.services.ingestion.analyzer import build_warnings  # noqa: E402
from app.services.ingestion.sources import SOURCES, SourceSpec  # noqa: E402
from app.services.ingestion.store import source_store  # noqa: E402

logger = logging.getLogger("disastersense.ingestion.worker")

TICK_SECONDS = int(os.getenv("INGEST_TICK_SECONDS", "5"))
SAVE_EVERY_TICKS = 10


def _running_under_pytest() -> bool:
    if os.getenv("INGESTION_ENABLED", "1").lower() in ("0", "false", "no"):
        return True
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True
    return "pytest" in os.path.basename(sys.argv[0]).lower()


class IngestionWorker:
    """Owns the 5-second ingest → analyse → publish cycle."""

    def __init__(self, tick_seconds: int = TICK_SECONDS) -> None:
        self.tick_seconds = max(1, tick_seconds)
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.started_at: Optional[datetime] = None
        self.last_tick_at: Optional[datetime] = None
        self.last_tick_duration_ms: Optional[int] = None
        self.next_tick_at: Optional[datetime] = None
        self.total_ticks = 0
        self.total_fetches = 0
        self.total_failures = 0
        self.last_error: Optional[str] = None
        self.warnings: Dict[str, Any] = {"counts": {}, "warnings": [], "generated_at": None}
        self._fetch_specs()

    # ── lifecycle ─────────────────────────────────────────────────────────
    def _fetch_specs(self) -> None:
        for spec in SOURCES:
            source_store.register(
                spec.key,
                label=spec.label,
                org=spec.org,
                trust=spec.trust,
                url=spec.url,
                cadence_seconds=spec.cadence_seconds,
                category=spec.category,
                description=spec.description,
            )

    def start(self) -> None:
        if self._running:
            logger.info("IngestionWorker already running.")
            return
        if _running_under_pytest():
            logger.info("IngestionWorker disabled (tests or INGESTION_ENABLED=0).")
            return
        self._running = True
        self.started_at = datetime.now(timezone.utc)
        self._task = asyncio.create_task(self._run_loop())
        logger.info(
            "IngestionWorker started — %ss tick, %s sources.",
            self.tick_seconds,
            len(SOURCES),
        )

    def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        source_store.save()
        logger.info("IngestionWorker stopped.")

    async def _run_loop(self) -> None:
        await asyncio.sleep(2)
        while self._running:
            started = time.monotonic()
            try:
                await asyncio.to_thread(self.run_once)
                self.last_error = None
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001 - keep the heartbeat alive
                self.last_error = str(exc)
                logger.error("Ingestion tick failed: %s", exc, exc_info=True)
            self.last_tick_duration_ms = int((time.monotonic() - started) * 1000)
            self.next_tick_at = datetime.now(timezone.utc) + timedelta(seconds=self.tick_seconds)
            try:
                await asyncio.sleep(self.tick_seconds)
            except asyncio.CancelledError:
                break

    async def trigger_now(self) -> Dict[str, Any]:
        """Force an immediate ingest + analysis cycle (admin/responder action)."""
        result = await asyncio.to_thread(self.run_once)
        result["manual"] = True
        return result

    # ── the cycle ─────────────────────────────────────────────────────────
    def _due_sources(self, now: datetime) -> List[SourceSpec]:
        due: List[SourceSpec] = []
        for spec in SOURCES:
            state = source_store.states.get(spec.key)
            last = state.last_attempt if state else None
            if not last:
                due.append(spec)
                continue
            try:
                last_dt = datetime.fromisoformat(last)
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                due.append(spec)
                continue
            if (now - last_dt).total_seconds() >= spec.cadence_seconds:
                due.append(spec)
        return due

    def run_once(self) -> Dict[str, Any]:
        """Execute one ingest tick.  Safe to call from any thread."""
        cycle_started = time.monotonic()
        now = datetime.now(timezone.utc)
        due = self._due_sources(now)

        fetched = 0
        failed = 0
        errors: List[str] = []
        for spec in due:
            started = source_store.record_attempt(spec.key)
            try:
                items, payload = spec.fetch()
                source_store.record_success(spec.key, started, items, payload)
                fetched += 1
            except Exception as exc:  # noqa: BLE001 - a dead source must not kill the loop
                failed += 1
                errors.append(f"{spec.key}: {exc}")
                source_store.record_error(spec.key, str(exc), started)
                logger.warning("Source %s failed: %s", spec.key, exc)

        try:
            self.warnings = build_warnings(source_store)
        except Exception as exc:  # noqa: BLE001
            self.last_error = f"analysis: {exc}"
            logger.error("Warning analysis failed: %s", exc, exc_info=True)

        self.total_ticks += 1
        self.total_fetches += fetched
        self.total_failures += failed
        self.last_tick_at = datetime.now(timezone.utc)
        if self.total_ticks % SAVE_EVERY_TICKS == 0:
            source_store.save()

        return {
            "tick": self.total_ticks,
            "due": [s.key for s in due],
            "fetched": fetched,
            "failed": failed,
            "errors": errors,
            "warnings": len(self.warnings.get("warnings", [])),
            "duration_ms": int((time.monotonic() - cycle_started) * 1000),
        }

    # ── introspection ─────────────────────────────────────────────────────
    def get_status(self) -> Dict[str, Any]:
        sources = source_store.status()
        healthy = sum(1 for s in sources if s.get("healthy"))
        with_errors = [s["key"] for s in sources if not s.get("healthy")]
        return {
            "running": self._running,
            "tick_seconds": self.tick_seconds,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_tick_at": self.last_tick_at.isoformat() if self.last_tick_at else None,
            "next_tick_at": self.next_tick_at.isoformat() if self.next_tick_at else None,
            "last_tick_duration_ms": self.last_tick_duration_ms,
            "total_ticks": self.total_ticks,
            "total_fetches": self.total_fetches,
            "total_failures": self.total_failures,
            "last_error": self.last_error,
            "sources_registered": len(sources),
            "sources_healthy": healthy,
            "sources_with_errors": with_errors,
            "records_held": sum(s.get("item_count", 0) for s in sources),
            "warnings": {
                "total": len(self.warnings.get("warnings", [])),
                "counts": self.warnings.get("counts", {}),
                "generated_at": self.warnings.get("generated_at"),
            },
        }

    def get_warnings(self) -> Dict[str, Any]:
        if not self.warnings.get("generated_at"):
            self.warnings = build_warnings(source_store)
        return self.warnings


ingestion_worker = IngestionWorker()
