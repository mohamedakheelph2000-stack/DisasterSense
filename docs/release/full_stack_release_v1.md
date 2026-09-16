# Full-Stack Integration Release V1

This document describes the end-to-end integration of DisasterSense. The application has transitioned from a frontend mock prototype into a fully integrated stack featuring real ML inference, dynamic weather hydration, PostgreSQL persistence, and JWT Role-Based Access Control.

## 1. Local Setup and Startup

### PostgreSQL Requirement
The backend strictly requires a running PostgreSQL instance with the following credentials (default):
- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `disastersense`

### Backend Startup
1. Activate the python virtual environment (`.venv`).
2. Run database migrations: `alembic upgrade head`
3. Start the FastAPI server: `uvicorn app.main:app --reload`
   The backend will be available at: `http://localhost:8000/api/v1`

### Frontend Startup
1. Navigate to the `frontend` directory.
2. Install dependencies (if not already done): `npm install`
3. Start the Next.js application: `npm run dev`
   The frontend will be available at: `http://localhost:3000`

## 2. Environment Variables & Demo Mode

The behavior of the frontend is strictly controlled by `NEXT_PUBLIC_DEMO_MODE` in `frontend/.env.local`:

- `NEXT_PUBLIC_DEMO_MODE=false`: **REAL MODE**. All data is fetched dynamically from the FastAPI backend. Authentication is strictly enforced, and risk assessments trigger real-world machine learning models.
- `NEXT_PUBLIC_DEMO_MODE=true`: **DEMO MODE**. The frontend intercepts HTTP calls and responds with locally hardcoded, simulated mock data. No backend connection is required.

*For this release, `NEXT_PUBLIC_DEMO_MODE=false` has been set, disabling mock behavior.*

## 3. Real-World Integration Components

### Authentication (E2E)
Authentication is fully functional. `Register` and `Login` interact with the real database to issue JWT tokens. The frontend attaches the token in the `Authorization: Bearer <token>` header for all authenticated routes. RBAC (Citizen, Responder, Admin) is enforced securely on the backend.

### Automatic Risk Assessment
Real ML models (`flood_logisticregression_real_v1` and `landslide_randomforest_real_v1`) are integrated via the `RiskEngine`.
If `mode=automatic` is used and coordinates are provided, the backend independently reaches out to real-world APIs to fetch environmental data for the exact timestamp.

### Weather Provider
The `EnvironmentalProvider` connects to:
- **Open-Meteo**: For rainfall, temperature, and humidity.
- **Open-Elevation**: For altitude data.
Data is cached (1 hr TTL for weather, 30 days for elevation) to prevent rate limits.

### Alerts
Alerts are natively persisted to PostgreSQL. Creating a critical risk assessment dynamically generates a corresponding alert in the database, which is immediately visible on the frontend Dashboard Alert Center. Acknowledge and resolve flows mutate the real database.

## 4. Known Limitations

- **GIS Map**: The map currently relies on basic geographic rendering. Since the database is freshly initialized, the map may appear empty until sufficient historical disaster events and locations are added manually or via assessment runs.
- **Dashboard Endpoints**:
  - The *Analytics / Trends* chart (`/analytics/trends`) endpoint is currently **UNAVAILABLE** in the backend API.
  - The *Weather Status* panel relies on the weather provider, but a global `/environment/current` summary endpoint is **UNAVAILABLE** in the backend. 
  - These panels will gracefully display empty/loading states rather than fake data.
- **Micro-climates**: Open-Meteo has ~11km resolution. Ultra-local micro-climate topology may slightly deviate from real-world rain gauges.

## 5. Troubleshooting

- **401 Unauthorized**: JWT token may be expired. Clear `ds_token` from browser localStorage and log in again.
- **500 Internal Server Error (Database)**: Verify that PostgreSQL is running and credentials in `backend/.env` match the active server.
- **Missing NaN values in ML Inference**: Typically means the Weather Provider could not fetch data and gracefully fell back to synthetic or heuristic rules. Check network connection to `open-meteo.com`.
