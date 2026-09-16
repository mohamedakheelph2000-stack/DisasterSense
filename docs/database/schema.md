# DisasterSense Database Architecture

## Status

Step 3 (Prompt #3) — Foundation schema implemented and migration ready.
The database user and database must be created before applying migrations.

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Database | PostgreSQL | 17.x |
| ORM | SQLAlchemy | 2.0 |
| Migration tool | Alembic | 1.x |
| Connection driver | psycopg2-binary | 2.9.x |

## Entity Relationship Overview

```
users
  (no FK dependencies — standalone table)

locations
  (no FK dependencies — root of event/alert graphs)
  ← disaster_events.location_id
  ← alerts.location_id

disaster_events
  → locations.id
  ← alerts.disaster_event_id

alerts
  → locations.id
  → disaster_events.id
```

## Table Definitions

### users

Stores platform operator accounts.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INTEGER | PK, indexed | Auto-increment |
| email | VARCHAR(320) | UNIQUE, NOT NULL, indexed | RFC 5321 max length |
| full_name | VARCHAR(200) | NOT NULL | |
| hashed_password | VARCHAR(200) | NOT NULL | bcrypt hash (auth step) |
| role | userrole ENUM | NOT NULL | admin \| analyst |
| is_active | BOOLEAN | NOT NULL | Soft-disable accounts |
| created_at | TIMESTAMPTZ | NOT NULL | server_default=now() |
| updated_at | TIMESTAMPTZ | NOT NULL | server_default=now() |

### locations

Named geographic reference points.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INTEGER | PK, indexed | Auto-increment |
| name | VARCHAR(200) | NOT NULL, indexed | e.g. "Wayanad District" |
| description | TEXT | nullable | |
| latitude | FLOAT | NOT NULL | Range: -90 to +90 |
| longitude | FLOAT | NOT NULL | Range: -180 to +180 |
| elevation_m | FLOAT | nullable | Metres above sea level |
| district | VARCHAR(100) | nullable | |
| state | VARCHAR(100) | nullable | |
| country | VARCHAR(100) | NOT NULL | Default: "India" |
| created_at | TIMESTAMPTZ | NOT NULL | server_default=now() |

**Indexes:** `ix_locations_lat_lon(latitude, longitude)` — bounding-box queries.

### disaster_events

AI-generated prediction records.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INTEGER | PK, indexed | Auto-increment |
| location_id | INTEGER | FK → locations.id CASCADE | |
| hazard_type | hazardtype ENUM | NOT NULL | flood \| landslide |
| severity | severitylevel ENUM | NOT NULL | low \| moderate \| high \| critical |
| risk_score | FLOAT | NOT NULL | [0.0, 1.0] |
| model_version | VARCHAR(50) | NOT NULL | e.g. "flood-v1.0.0" |
| feature_snapshot | TEXT | nullable | JSON string of model inputs |
| data_source | VARCHAR(100) | nullable | e.g. "open-meteo-api" |
| alert_triggered | BOOLEAN | NOT NULL | Whether an alert was raised |
| event_time | TIMESTAMPTZ | NOT NULL | Forecast horizon moment |
| created_at | TIMESTAMPTZ | NOT NULL | server_default=now() |
| notes | TEXT | nullable | Analyst annotations |

**Indexes:**
- `ix_disaster_events_location_hazard_time(location_id, hazard_type, event_time)` — dashboard range queries
- `ix_disaster_events_severity(severity)` — alert rule filtering

### alerts

In-app notifications with a lifecycle state machine.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | INTEGER | PK, indexed | Auto-increment |
| location_id | INTEGER | FK → locations.id CASCADE | |
| disaster_event_id | INTEGER | FK → disaster_events.id CASCADE | |
| title | VARCHAR(300) | NOT NULL | |
| message | TEXT | NOT NULL | |
| status | alertstatus ENUM | NOT NULL, indexed | active → acknowledged → resolved/dismissed |
| acknowledged_by | VARCHAR(200) | nullable | Will FK to users in auth step |
| acknowledged_at | TIMESTAMPTZ | nullable | |
| resolved_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL | server_default=now() |
| updated_at | TIMESTAMPTZ | NOT NULL | server_default=now() |

## Enum Types (PostgreSQL)

| Name | Values |
|---|---|
| userrole | admin, analyst |
| hazardtype | flood, landslide |
| severitylevel | low, moderate, high, critical |
| alertstatus | active, acknowledged, resolved, dismissed |

## Severity Scoring Convention

The ML pipeline derives `severity` from `risk_score`:

| Score Range | Severity |
|---|---|
| < 0.40 | low |
| 0.40 – 0.69 | moderate |
| 0.70 – 0.89 | high |
| ≥ 0.90 | critical |

## Setup Instructions

### 1. Create the database role and database

```bash
python scripts/setup_db.py
```

This interactive script prompts for the postgres superuser password and the new disastersense role password. It creates the role and database without storing credentials anywhere.

### 2. Configure the connection URL

In `backend/.env`:

```
DATABASE_URL=postgresql://disastersense:<your_password>@localhost:5432/disastersense
```

### 3. Apply migrations

```bash
cd backend
python -m alembic upgrade head
```

### 4. Verify

```bash
psql -U disastersense -d disastersense -c "\dt"
```

Expected output: four tables (users, locations, disaster_events, alerts).

## Future Schema Plans

- **Step 5 (Core API):** resource_allocations table, weather_snapshots table
- **Step 7 (Auth):** Add hashed_password handling; acknowledged_by → FK to users
- **PostGIS (Open Decision):** Replace latitude/longitude with Geography type if advanced spatial queries are needed
