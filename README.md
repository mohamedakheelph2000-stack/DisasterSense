# DisasterSense

DisasterSense is a final-year B.Tech Computer Science project: an AI-assisted disaster intelligence platform for flood and landslide risk assessment, emergency-resource planning, and live situational awareness.

## Current status

The repository foundation is complete. No frontend, backend, database, model, Docker service, or real prediction capability has been generated yet.

## Planned capabilities

- Flood prediction using validated weather and geographic features
- Landslide prediction using separately validated hazard features
- Automatic Open-Meteo data retrieval and manual demonstration input
- Risk score or calibrated confidence display, with input source and model version
- Interactive OpenStreetMap and Leaflet dashboard
- Emergency alerts and explainable resource-allocation recommendations
- Analytics, dark mode, responsive UI, JWT authentication, and role-based admin controls

## Architecture

The project will be a modular monolith:

- frontend/: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Leaflet, and Recharts
- backend/: FastAPI, SQLAlchemy, PostgreSQL, JWT security, and API use cases
- ml/: offline Scikit-learn and XGBoost training, evaluation, and model-version metadata

The frontend is the View, FastAPI controllers are the Controller, and domain rules plus persistence models form the Model. Clean Architecture keeps external integrations outside the business-rule layer.

## Safety statement

DisasterSense is an academic decision-support platform. It must not present a prediction as an official disaster warning or guarantee. Automated resource recommendations require authorized human review before action.

## Documentation

- docs/architecture/: architecture and data-flow records
- docs/decisions/: dated technical decisions
- docs/ml/: model, dataset, metric, and limitation documentation
- docs/viva/: demonstration and viva preparation material
- PROJECT_CONTEXT.md: current project state, decisions, open questions, and verification history

## Planned implementation order

1. Repository foundation and project conventions
2. Next.js frontend foundation
3. FastAPI backend foundation and PostgreSQL schema
4. Authentication and core API workflows
5. Flood and landslide model pipelines
6. Dashboard, maps, alerts, analytics, and allocation workflows
7. Automated testing, Docker support, deployment preparation, and viva documentation
