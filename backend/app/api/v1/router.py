"""
API v1 router aggregator.

Register all v1 sub-routers here.  The main application mounts this
router under the ``/api/v1`` prefix defined in ``Settings.API_V1_PREFIX``.
"""

from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    auth,
    disaster_events,
    environment,
    health,
    locations,
    risk_assessments,
    alerts,
    resources,
    system,
    users,
    ml,
    ml_governance,
    spatial_risk,
)

api_router = APIRouter()

# Health check
api_router.include_router(health.router)
api_router.include_router(system.router)

# Authentication
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# User management
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Core endpoints (prefixes are defined inside their respective router files)
api_router.include_router(locations.router)
api_router.include_router(disaster_events.router)
api_router.include_router(risk_assessments.router)
api_router.include_router(alerts.router)

# New dashboard endpoints
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(environment.router, prefix="/environment", tags=["environment"])
api_router.include_router(resources.router, prefix="/resources", tags=["resources"])
api_router.include_router(ml.router, prefix="/ml", tags=["ml"])
api_router.include_router(ml_governance.router)
api_router.include_router(spatial_risk.router)
