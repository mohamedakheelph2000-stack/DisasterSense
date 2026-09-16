# DisasterSense Backend

FastAPI application serving the DisasterSense API.

## Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI factory, CORS middleware
│   ├── core/
│   │   ├── config.py        # pydantic-settings — all values from env vars
│   │   └── database.py      # SQLAlchemy 2 engine, SessionLocal, Base, get_db
│   ├── api/
│   │   └── v1/
│   │       ├── router.py    # Aggregates all v1 sub-routers
│   │       └── health.py    # GET /api/v1/health
│   ├── models/
│   │   ├── __init__.py      # Model registry (all four models imported here)
│   │   ├── user.py          # User, UserRole
│   │   ├── location.py      # Location
│   │   ├── disaster_event.py # DisasterEvent, HazardType, SeverityLevel
│   │   └── alert.py         # Alert, AlertStatus
│   ├── schemas/
│   │   ├── __init__.py      # Schema registry
│   │   ├── user.py          # UserCreate, UserRead, UserUpdate
│   │   ├── location.py      # LocationCreate, LocationRead, LocationUpdate
│   │   ├── disaster_event.py # DisasterEventCreate, DisasterEventRead
│   │   └── alert.py         # AlertCreate, AlertRead, AlertAcknowledge
│   └── services/            # Application service layer (future)
├── migrations/
│   ├── env.py               # Alembic env — reads DATABASE_URL from env
│   └── versions/
│       └── 001_initial_schema.py  # Initial migration (4 tables, 4 enum types)
├── tests/
│   ├── conftest.py          # Fixtures, requires_db skip marker
│   ├── test_health.py       # 5 health/root endpoint tests
│   ├── test_models.py       # 21 ORM model tests (no DB required)
│   └── test_schemas.py      # 12 Pydantic schema validation tests
├── alembic.ini
├── .env.example
└── requirements.txt
```

## Quick Start

```bash
# From the backend/ directory:

# 1. Create virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create PostgreSQL role and database
python ..\scripts\setup_db.py

# 4. Configure environment
copy .env.example .env
# Edit .env with your disastersense role password

# 5. Apply database migrations
python -m alembic upgrade head

# 6. Start the API server
uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs

## Available Endpoints

| Method | Path              | Description                         |
|--------|-------------------|-------------------------------------|
| GET    | /                 | Root — links to docs                |
| GET    | /api/v1/health    | Health check + DB reachability      |

## Running Tests

```bash
# All tests (no DB required):
pytest tests/ -v

# With coverage (install pytest-cov first):
pytest tests/ -v --cov=app
```

Test count: **38 tests** — all pass without a live database.

## Database Migrations (Alembic)

```bash
# Apply all pending migrations:
python -m alembic upgrade head

# Check current migration state:
python -m alembic current

# Create a new migration after adding/changing models:
python -m alembic revision --autogenerate -m "describe your change"

# Roll back one step:
python -m alembic downgrade -1

# Roll back to initial state:
python -m alembic downgrade base
```

## Database Architecture

See [docs/database/schema.md](../docs/database/schema.md) for:
- Full ER diagram
- Column types and constraints
- Index rationale
- Setup instructions

## Security Notes

- Never commit `.env` — it is in `.gitignore`
- Passwords are never stored in source files
- Run `python scripts/setup_db.py` to create DB credentials securely
- `SECRET_KEY` must be regenerated per environment:
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
