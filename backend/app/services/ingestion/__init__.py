"""24/7 multi-source ingestion package.

Public surface used by the API layer and application startup:

* ``ingestion_worker`` — the 5-second ingest/analyse loop,
* ``source_store``     — snapshot of every record fetched so far,
* ``build_warnings``   — low/medium/high area warning analysis.
"""

from app.services.ingestion.analyzer import build_warnings
from app.services.ingestion.store import source_store
from app.services.ingestion.worker import ingestion_worker

__all__ = ["build_warnings", "ingestion_worker", "source_store"]
