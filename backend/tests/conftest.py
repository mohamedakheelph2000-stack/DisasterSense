"""
pytest configuration and shared fixtures for DisasterSense backend tests.

Fixtures defined here are available to every test file without explicit import.

Database isolation strategy
---------------------------
- `client`: Default TestClient against the FastAPI application.
- `db_client`: TestClient backed by an isolated in-memory/test database session
  for real DB CRUD integration testing.
- `db_unavailable_client`: TestClient configured to simulate database outages (OperationalError).
"""

import pytest
from collections.abc import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import OperationalError

from app.main import app
from app.core.database import Base, get_db, check_db_connection
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.api.deps import get_current_active_user, RequireRole


# ── Markers ───────────────────────────────────────────────────────────────────
def pytest_configure(config: pytest.Config) -> None:
    """Register custom markers so pytest does not warn about unknown marks."""
    config.addinivalue_line(
        "markers",
        "db: mark test as requiring a live PostgreSQL connection",
    )


_pg_available = check_db_connection()

requires_pg = pytest.mark.skipif(
    not _pg_available,
    reason="Live PostgreSQL is not reachable; skipping live PostgreSQL tests",
)


# ── Isolated Test Database Fixtures ───────────────────────────────────────────
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def test_engine():
    """Create a shared test engine with SQLite in-memory static pool."""
    engine = create_engine(
        TEST_SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Provide a transactional SQLAlchemy session for testing."""
    connection = test_engine.connect()
    transaction = connection.begin()
    SessionTest = sessionmaker(bind=connection, autocommit=False, autoflush=False)
    session = SessionTest()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Provide a reusable standard TestClient for the FastAPI application."""
    return TestClient(app)


@pytest.fixture(scope="function")
def db_client(db_session: Session) -> Generator[TestClient, None, None]:
    """
    Provide a TestClient where get_db yields the isolated test database session.

    This ensures real SQL database CRUD operations execute deterministically without
    polluting external databases.
    """
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def db_unavailable_client() -> Generator[TestClient, None, None]:
    """
    Provide a TestClient configured to simulate a database OperationalError.

    Used to test Phase 4 graceful database exception handling.
    """
    def override_get_db_error():
        raise OperationalError("connection failure", params={}, orig=Exception("DB connection refused"))
        yield  # type: ignore

    app.dependency_overrides[get_db] = override_get_db_error
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ── Auth Fixtures ────────────────────────────────────────────────────────────
@pytest.fixture(scope="function")
def test_user_citizen(db_session: Session) -> User:
    user = User(
        email="citizen@example.com",
        full_name="Citizen User",
        hashed_password=get_password_hash("password"),
        role=UserRole.CITIZEN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def test_user_responder(db_session: Session) -> User:
    user = User(
        email="responder@example.com",
        full_name="Responder User",
        hashed_password=get_password_hash("password"),
        role=UserRole.RESPONDER,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def test_user_admin(db_session: Session) -> User:
    user = User(
        email="admin@example.com",
        full_name="Admin User",
        hashed_password=get_password_hash("password"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def auth_client_citizen(db_client: TestClient, test_user_citizen: User) -> TestClient:
    def override_get_current_active_user():
        return test_user_citizen
        
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user
    yield db_client
    app.dependency_overrides.pop(get_current_active_user, None)


@pytest.fixture(scope="function")
def auth_client_responder(db_client: TestClient, test_user_responder: User) -> TestClient:
    def override_get_current_active_user():
        return test_user_responder
        
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user
    yield db_client
    app.dependency_overrides.pop(get_current_active_user, None)


@pytest.fixture(scope="function")
def auth_client_admin(db_client: TestClient, test_user_admin: User) -> TestClient:
    def override_get_current_active_user():
        return test_user_admin
        
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user
    yield db_client
    app.dependency_overrides.pop(get_current_active_user, None)

