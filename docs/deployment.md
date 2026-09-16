# DisasterSense Deployment Guide

This document outlines the deployment procedure for the completed DisasterSense application. The architecture consists of a Next.js frontend, a FastAPI backend, a PostgreSQL database, and local ML models.

## 1. Prerequisites
- **Frontend Hosting**: Vercel (Recommended)
- **Backend Hosting**: Render (Recommended)
- **Database**: Render PostgreSQL or any standard PostgreSQL instance
- **Environment**: Production (`NEXT_PUBLIC_DEMO_MODE=false`)

## 2. Environment Variables

### Backend (`.env` or Render Environment Variables)
- `DATABASE_URL`: Connection string to your PostgreSQL instance.
- `CORS_ORIGINS`: The exact URL of your deployed frontend (e.g., `https://disastersense.vercel.app`).
- `SECRET_KEY`: A highly secure 32-byte hex string for JWT encoding.
- `APP_ENV`: Set to `production`.
- `DEBUG`: Set to `False`.

### Frontend (`.env.local` or Vercel Environment Variables)
- `NEXT_PUBLIC_API_URL`: The exact URL of your deployed backend (e.g., `https://api.disastersense.onrender.com/api/v1`).
- `NEXT_PUBLIC_DEMO_MODE`: **Must** be `false` for real data operation.

## 3. Database & Migrations

Before the backend can serve requests, the database schema must be initialized via Alembic.

1. Ensure `DATABASE_URL` is configured in the environment.
2. Run the Alembic migration command:
   ```bash
   alembic upgrade head
   ```
   *(On Render, this can be configured as a pre-deploy script or run manually via the Render Shell)*

## 4. Backend Deployment (Render)

1. Connect your repository to Render as a "Web Service".
2. **Build Command**: 
   ```bash
   pip install -r backend/requirements.txt
   ```
3. **Start Command**: 
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
   ```
4. **Environment**: Ensure the Root Directory is set to `backend` or adjust paths accordingly so `ml/models` is accessible. The RiskEngine automatically resolves paths relative to the project root, so ensure the `ml` folder is included in your deployment artifact.
5. Add the environment variables detailed in Section 2.

## 5. Frontend Deployment (Vercel)

1. Connect your repository to Vercel.
2. Set the **Root Directory** to `frontend`.
3. **Framework Preset**: Next.js.
4. **Build Command**: `npm run build`
5. Add the environment variables detailed in Section 2.

## 6. Post-Deployment Verification

Once both services are live:
1. Verify the backend health endpoint: `GET https://<your-backend-url>/api/v1/health`. It should return `"status": "ok"` and `"db_reachable": true`.
2. Visit the frontend URL.
3. Attempt to register a new user or login.
4. Verify the Dashboard loads and the Map renders correctly.
5. (Admin) Visit `/system` to verify telemetry and model status.

## 7. Security Notes
- **Do not** commit actual credentials or secrets to version control.
- Ensure the `CORS_ORIGINS` strictly matches your frontend domain. Do not use `*` in production.
- Keep `NEXT_PUBLIC_DEMO_MODE=false`. Demo mode bypasses true ML inference and relies on hardcoded data loops.
