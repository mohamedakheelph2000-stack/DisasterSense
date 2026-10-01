# DisasterSense - Vercel Deployment Guide

This guide walks you through deploying **DisasterSense** on **Vercel**.

---

## 1. System Architecture on Vercel

DisasterSense is designed with a modern decoupled architecture:

| Component | Technology | Target Platform | Why? |
|---|---|---|---|
| **Frontend** | Next.js 14, React, Tailwind, Leaflet | **Vercel** | Vercel provides native Next.js optimization, edge caching, global CDN, and automatic preview branches. |
| **Backend & ML** | FastAPI, Python, Scikit-learn, XGBoost | **AWS EC2 / Render / Railway** | Persistent Python runtime needed for heavy ML model inference. |
| **Database** | PostgreSQL 15+ | **Supabase / Neon / Render / AWS RDS** | Vercel is serverless and does not host persistent database engines. |
| **Telemetry Worker** | Async background loop (60s poll) | **AWS EC2 / Render** | Serverless functions sleep after requests; background polling requires a continuous daemon. |

---

## 2. Choosing Your Deployment Mode

When deploying the frontend to Vercel, you have two deployment configurations:

### Option A: Connected Production Mode (Real-Time Live Backend)
Connects the Vercel frontend to your live FastAPI backend (running on AWS EC2, Render, or a VPS).

**Vercel Environment Variables:**
- `NEXT_PUBLIC_API_URL`: `https://<your-backend-domain-or-ip>/api/v1`
- `NEXT_PUBLIC_DEMO_MODE`: `false`

### Option B: Standalone Showcase / Demo Mode (Zero Backend Needed)
DisasterSense includes a complete in-browser simulation engine with realistic telemetry, GIS risk maps, alert feeds, and resource allocation. This allows the Vercel deployment to function 100% standalone without needing an active backend or database server.

**Vercel Environment Variables:**
- `NEXT_PUBLIC_API_URL`: `/api/v1`
- `NEXT_PUBLIC_DEMO_MODE`: `true`

---

## 3. How to Deploy

### Method 1: Via Vercel Web Dashboard (Recommended & 1-Click CI/CD)

1. **Push your code to GitHub**:
   Ensure your local commits are pushed:
   ```bash
   git push origin main
   ```
2. **Go to Vercel Dashboard**:
   - Visit [vercel.com/new](https://vercel.com/new) and log in with your GitHub account.
3. **Import Repository**:
   - Find `mohamedakheelph2000-stack/DisasterSense` and click **Import**.
4. **Configure Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click "Edit" and select `frontend` (⚠️ **Crucial step**).
   - **Build Command**: `npm run build` (Default)
   - **Output Directory**: `.next` (Default)
5. **Environment Variables**:
   Add the following under **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: URL of your backend or `/api/v1`
   - `NEXT_PUBLIC_DEMO_MODE`: `false` (if backend connected) or `true` (if standalone)
6. **Click Deploy**:
   Vercel will build the Next.js app in ~60 seconds and assign you a production URL (e.g., `https://disastersense-xxx.vercel.app`).

---

### Method 2: Via Vercel CLI (From Terminal)

You can deploy directly from your local terminal using the provided script or Vercel CLI:

1. **Run the Deployment Script**:
   In PowerShell:
   ```powershell
   .\scripts\deploy_vercel.ps1 -Prod
   ```
   Or in Windows Command Prompt:
   ```cmd
   scripts\deploy_vercel.bat
   ```

2. **Or run manually using Vercel CLI**:
   ```bash
   cd frontend
   npx vercel login
   npx vercel --prod
   ```

3. Follow the interactive prompts:
   - Set up and deploy? `Y`
   - Which scope? Select your personal/team account
   - Link to existing project? `N`
   - What's your project's name? `disastersense`
   - In which directory is your code located? `./`
   - Want to modify these settings? `N`

---

## 4. Post-Deployment Verification

After Vercel finishes deploying:
1. Open the generated Vercel URL in your browser.
2. Verify the **Landing Page** and click **Launch Console**.
3. Use the 1-click demo login buttons (**Admin** or **Analyst**) to sign in.
4. Navigate to:
   - **Overview Dashboard**: Verify KPI metrics, risk counters, and status badges.
   - **Live Map (GIS)**: Verify Google Satellite Hybrid, Terrain, and OSM map tiles load smoothly.
   - **Risk Assessment**: Test the ML prediction sliders.
   - **Alert Feed & Resource Center**: Verify status filters and table rendering.
