# DisasterSense Project Context

Last updated: 2026-09-11

## Current Phase

Step 15: Real-World Dataset Research & ML Data Strategy — complete.
Created `docs/ml/real_world_dataset_strategy.md`.

## Confirmed Direction

- Project name: DisasterSense
- Goal: AI-assisted disaster intelligence for flood and landslide risk, emergency-resource planning, alerts, maps, and analytics
- Architecture: Modular monolith with Clean Architecture and MVC responsibilities
- Frontend: Next.js 14, TypeScript, Tailwind CSS, Leaflet, Recharts
- Backend: FastAPI, Python, SQLAlchemy 2, PostgreSQL, Alembic, JWT (Step 7)
- ML: Scikit-learn, XGBoost, Pandas, NumPy, Joblib (Step 4 Complete)
- Deployment target: Docker support after application services exist (Docker CLI not yet available on this machine)

## Locked Engineering Rules

- Build one approved step at a time.
- Explain folders before creating them.
- Keep code modular, beginner-friendly, and documented.
- Add concise comments or docstrings for every function.
- Verify changes and correct errors immediately.
- Do not claim that the platform is an official disaster-warning authority.
- Never hard-code credentials, secrets, API keys, or passwords.

## Open Decisions

- Target country: defaulting to India with Kerala/Wayanad as demonstration area (based on Location schema default)
- Flood and landslide dataset sources and licenses
- Prediction horizon and geographic resolution
- User roles beyond admin/analyst (currently two roles defined)
- Alert delivery scope beyond in-app alerts
- Whether PostGIS is needed for advanced geographic queries
- Deployment platform and public-access requirements

---

## Step 1 — Repository Foundation (Completed 2026-08-08)

### What Was Completed

- Git repository initialised
- Root folder structure: frontend/, backend/, ml/, infra/, docs/, scripts/, .github/
- Root .gitignore, .editorconfig, .gitattributes
- README.md, CONTRIBUTING.md, SECURITY.md
- Architecture documentation: docs/architecture/system-overview.md, docs/decisions/ADR-0001-modular-monolith.md
- Tool versions confirmed: Git 2.51.0, Node 22.20.0, npm 10.9.3, Python 3.10.6, pip 26.0.1
- Docker CLI confirmed NOT available

---

## Step 2 — Foundation (Completed 2026-08-09)

### What Was Completed

- Next.js 14.2.5 frontend verified and passing (lint + build)
- FastAPI backend structure: app/, core/, api/v1/, models/, schemas/, services/
- Health endpoint GET /api/v1/health with DB reachability reporting
- SQLAlchemy 2 engine, SessionLocal, Base, get_db
- Alembic configured (env.py reads DATABASE_URL from env)
- All env.example files created (root, backend, frontend)
- ML directory structure scaffolded (data/, models/, notebooks/, src/, tests/)
- 2/2 backend tests passing

### Verification (Step 2)

| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 errors |
| `npm run build` | ✅ 5 static pages generated |
| Python imports | ✅ All OK |
| `pytest tests/ -v` | ✅ 2/2 PASSED |

---

## Step 3 — Database & Core Backend (Completed 2026-08-09)

### Infrastructure Availability

| Tool | Status |
|---|---|
| PostgreSQL 17.9 | ✅ Installed — running on localhost:5432 |
| Docker CLI | ❌ Not available on this machine |
| disastersense DB user | ❌ Not yet created — run `python scripts/setup_db.py` |
| disastersense DB | ❌ Not yet created — run `python scripts/setup_db.py` |

### What Was Completed

#### ORM Models (backend/app/models/)

Four SQLAlchemy 2.x models created, all inheriting from `Base`:

| Model | Table | Key Features |
|---|---|---|
| User | users | email (unique), role enum (admin/analyst), is_active, timestamps |
| Location | locations | lat/lon/elevation, composite index ix_locations_lat_lon |
| DisasterEvent | disaster_events | hazard_type enum, severity enum, risk_score [0,1], model_version, feature_snapshot, composite index |
| Alert | alerts | status enum (active/acknowledged/resolved/dismissed), FK→locations, FK→disaster_events |

All models use `Mapped` / `mapped_column` (SQLAlchemy 2 style) and have relationships wired up.

#### Pydantic Schemas (backend/app/schemas/)

| File | Classes |
|---|---|
| user.py | UserBase, UserCreate (password validation), UserRead, UserUpdate |
| location.py | LocationBase, LocationCreate, LocationRead, LocationUpdate |
| disaster_event.py | DisasterEventCreate, DisasterEventRead |
| alert.py | AlertCreate, AlertRead, AlertAcknowledge |

#### Alembic Migration (backend/migrations/versions/)

- `001_initial_schema.py` — hand-written migration (required because the `disastersense` DB user does not exist yet)
- Creates 4 tables, 4 PostgreSQL enum types, all indexes, and all FK constraints
- Has both `upgrade()` and `downgrade()` functions
- Syntax verified: `python -c "import ast; ast.parse(...)"`

#### Tests (backend/tests/)

- conftest.py: `requires_db` skip marker, session-scoped TestClient fixture
- test_health.py: 5 tests (root, health status, app name, environment, OpenAPI schema)
- test_models.py: 21 tests (table names, columns, unique constraints, indexes, FKs, enum values, metadata registration)
- test_schemas.py: 12 tests (valid inputs, email validation, coordinate ranges, risk score bounds, trivial password rejection)

#### Scripts

- scripts/setup_db.py — interactive local DB setup (prompts for passwords, no hard-coded credentials)

#### Documentation

- docs/database/schema.md — complete ER overview, all table/column definitions, setup instructions

### Verification (Step 3)

| Check | Command | Result |
|---|---|---|
| All backend imports | `python -c "import app.models, app.schemas, ..."` | ✅ OK |
| Full test suite | `python -m pytest tests/ -v` | ✅ **38/38 PASSED** |
| Migration syntax | `python -c "import ast; ast.parse(...)"` | ✅ Valid Python |
| Frontend unaffected | `npm run lint && npm run build` | ✅ (from Step 2, unchanged) |
| DB connectivity | health endpoint `db_reachable` | ⚠️ false — disastersense user not created yet |
| Alembic --autogenerate | `python -m alembic revision --autogenerate` | ⚠️ BLOCKED — disastersense user doesn't exist yet |

### Known Limitations / Blockers

1. **PostgreSQL user not created yet.** Run `python scripts/setup_db.py` to create the `disastersense` role and database. Then run `python -m alembic upgrade head`.
2. **Docker not available.** Infrastructure step will be unlocked in a later prompt.
3. **Authentication not implemented.** `hashed_password` column exists in the `users` table but bcrypt hashing belongs to Step 7.
4. **`acknowledged_by` in alerts is a VARCHAR.** It will become a proper FK → users after authentication is implemented.
5. Upstream starlette `PendingDeprecationWarning` about `python_multipart` appears in test output — this is a third-party issue, not a project bug.

---

## Remaining Steps (Not Yet Started)

- Step 4: ML pipeline — dataset acquisition, feature engineering, model training (or skip to Step 5 per approval)
- Step 5: Core API — disaster risk endpoints, alert CRUD, resource endpoints
- Step 6: Frontend features — map view, charts, alerts dashboard
- Step 7: Authentication — bcrypt hashing, JWT, user roles, route protection
- Step 8: Integration — end-to-end wiring of ML → API → frontend
- Step 9: Production — Docker, deployment, final polish
