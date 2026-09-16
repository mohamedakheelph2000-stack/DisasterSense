"""
Database session factory (SQLAlchemy 2.x).

Usage
-----
Use `get_db` as a FastAPI dependency to obtain a short-lived session per request.

    from app.core.database import get_db
    from sqlalchemy.orm import Session

    def my_endpoint(db: Session = Depends(get_db)):
        ...
"""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    # Echo SQL statements in development for easier debugging.
    echo=settings.DEBUG,
    # Keep a reasonable pool size; tune for production later.
    pool_pre_ping=True,
)

# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ── Declarative base ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """
    All SQLAlchemy ORM models must inherit from this class.

    Example::

        from app.core.database import Base

        class MyModel(Base):
            __tablename__ = "my_table"
            ...
    """


# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    Yield a database session for the duration of a single HTTP request.

    The session is always closed in the finally block, even if the
    endpoint raises an exception.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection(session: Session | None = None) -> bool:
    """
    Return True if the database can be reached, False otherwise.

    If a session is provided, it is used to perform the check. This ensures
    test overrides (like in-memory SQLite databases) are respected.
    If no session is provided, it falls back to a fresh connection from the global engine.
    """
    try:
        if session is not None:
            session.execute(text("SELECT 1"))
        else:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

