"""
Health-check endpoint.

GET /health
    Returns a lightweight JSON payload confirming the API is alive.
    Also reports the current database reachability so operators can
    see at a glance whether the persistence layer is connected.
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import settings
from app.core.database import check_db_connection

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check")
def health() -> dict:
    """
    Return API health status.

    This endpoint is intentionally dependency-free so it can respond even
    when the database is temporarily unreachable.  The ``db_reachable``
    field tells you whether PostgreSQL is connected.
    """
    db_ok = check_db_connection()

    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db_reachable": db_ok,
    }
