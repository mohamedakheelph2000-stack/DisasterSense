"""24/7 ingestion control, source monitoring and warning-board endpoints."""

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import RequireRole, get_current_user, get_db
from app.models.user import User, UserRole
from app.schemas.ingestion import (
    IngestStatus,
    SourceItemResponse,
    SourceItemsResponse,
    SourceStatus,
    SourcesResponse,
    WarningsResponse,
)
from app.services.ingestion import build_warnings, ingestion_worker, source_store
from app.services.ingestion.sources import SOURCES_BY_KEY

router = APIRouter(tags=["ingestion"])


@router.get("/sources", response_model=SourcesResponse, summary="Live data-source monitor")
def list_sources(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SourcesResponse:
    """Every trusted source the 24/7 pipeline polls, with cadence and health."""
    worker = ingestion_worker.get_status()
    statuses = [SourceStatus(**s) for s in source_store.status()]
    return SourcesResponse(
        sources=statuses,
        worker=worker,
        total_records=sum(s.get("item_count", 0) for s in source_store.status()),
    )


@router.get(
    "/sources/{source_key}/items",
    response_model=SourceItemsResponse,
    summary="Recent records fetched from one source",
)
def list_source_items(
    source_key: str,
    limit: int = 50,
    user: User = Depends(get_current_user),
) -> SourceItemsResponse:
    spec = SOURCES_BY_KEY.get(source_key)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Unknown source '{source_key}'")
    state = source_store.states.get(source_key)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Source '{source_key}' has not been registered")
    items = source_store.items_for(source_key)[: max(1, min(limit, 200))]
    return SourceItemsResponse(
        source=SourceStatus(**state.to_dict(item_count=len(items))),
        items=[SourceItemResponse(**i.to_dict()) for i in items],
        payload=source_store.payload(source_key),
    )


@router.get("/ingest/status", response_model=IngestStatus, summary="24/7 ingestion heartbeat")
def ingest_status(user: User = Depends(get_current_user)) -> IngestStatus:
    return IngestStatus(**ingestion_worker.get_status())


@router.post(
    "/ingest/run-now",
    summary="Force an immediate ingest + analysis cycle",
    response_model=dict,
)
async def ingest_run_now(
    current_user: User = Depends(RequireRole([UserRole.ADMIN, UserRole.RESPONDER])),
) -> Any:
    return await ingestion_worker.trigger_now()


@router.get("/warnings", response_model=WarningsResponse, summary="Area warning board")
def get_warnings(
    refresh: bool = False,
    user: User = Depends(get_current_user),
) -> WarningsResponse:
    """Low / medium / high warnings derived from live weather + external signals."""
    if refresh:
        try:
            payload = build_warnings(source_store)
            ingestion_worker.warnings = payload
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Warning analysis failed: {exc}")
    else:
        payload = ingestion_worker.get_warnings()
    return WarningsResponse(**payload)


@router.get("/warnings/summary", summary="Warning counts only", response_model=dict)
def warnings_summary(user: User = Depends(get_current_user)) -> dict:
    payload = ingestion_worker.get_warnings()
    return {
        "generated_at": payload.get("generated_at"),
        "counts": payload.get("counts", {}),
        "total": len(payload.get("warnings", [])),
        "flood_areas": len(payload.get("flood_areas", [])),
        "landslide_areas": len(payload.get("landslide_areas", [])),
    }


__all__ = ["router"]
