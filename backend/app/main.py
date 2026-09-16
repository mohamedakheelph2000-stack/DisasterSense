"""
DisasterSense — FastAPI application entry point.

Start locally with:
    uvicorn app.main:app --reload --port 8000

Interactive docs available at:
    http://localhost:8000/docs    (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

# ── Application factory ───────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-Assisted Disaster Intelligence API — flood and landslide risk scoring, "
        "emergency resource optimisation, and in-app alerting. "
        "Academic research platform; not an official disaster-warning authority."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS middleware ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# ── Exception Handlers ────────────────────────────────────────────────────────
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError


@app.exception_handler(OperationalError)
def handle_db_error(request, exc: OperationalError):
    """Return a JSON 500 when the database is unreachable."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Database connection unavailable. Please try again later."},
    )

# ── Root redirect ─────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def root() -> dict:
    """Minimal root response — redirects users to the docs."""
    return {
        "message": "DisasterSense API is running.",
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
    }
