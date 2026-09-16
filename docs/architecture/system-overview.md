# DisasterSense System Overview

## Status

This is an approved architecture record. It describes the intended system; no application runtime has been implemented yet.

## Purpose

DisasterSense is an academic AI-assisted disaster intelligence platform. It will assess flood and landslide risk, show traceable prediction information, support emergency-resource planning, and provide an interactive operational dashboard.

## Architectural style

The project uses a modular monolith:

- One Next.js frontend
- One FastAPI backend
- One PostgreSQL database
- One separately versioned offline ML package

This keeps deployment and viva explanation manageable while preserving clear boundaries for future scaling.

## MVC and Clean Architecture

- View: Next.js pages, components, maps, charts, and responsive user interface states
- Controller: FastAPI endpoints that validate requests, apply authorization, and call use cases
- Model: domain entities and rules, kept separate from SQLAlchemy persistence mappings

Backend dependency direction:

    API controller -> application use case -> domain rule or port
    infrastructure adapter -> implements the required port

The domain layer must not depend on FastAPI, SQLAlchemy, Open-Meteo, Leaflet, or XGBoost.

## Core modules

- Authentication and administration: JWT lifecycle, roles, auditability, users, resource and model controls
- Weather intelligence: automatic Open-Meteo retrieval, validation, caching, normalization, and manual input
- Flood prediction: flood-specific features, versioned model inference, risk classification, and history
- Landslide prediction: landslide-specific features, versioned model inference, risk classification, and history
- Resource allocation: explainable priority and distance recommendation with authorized approval
- Dashboard and maps: current predictions, incidents, alerts, resources, filters, charts, and data freshness
- Alerts and analytics: in-app alert lifecycle, trends, prediction history, and operational summaries

## Prediction data flow

    location or manual input
        -> weather retrieval and validation
        -> normalized feature snapshot with source and timestamp
        -> flood or landslide feature builder
        -> versioned model inference
        -> risk score or calibrated confidence and severity
        -> persistence, dashboard, map, analytics, and alert rules

Manual input and provider data use the same validation and prediction path. The source remains visible for traceability.

## Safety and scientific boundaries

- Separate flood and landslide datasets, feature definitions, model evaluations, and artifacts are required.
- A displayed confidence value must be calibrated or labelled as a risk score; it is not a disaster guarantee.
- The system must not claim to be an official warning authority.
- Missing required data or model artifacts must cause a visible error, never a fabricated result.
- Resource-allocation recommendations require human approval before action.

## Open design decisions

- Region, demonstration locations, and prediction horizon
- Dataset sources, permissions, and labels
- User roles beyond administrator
- Alert delivery channels beyond in-app alerts
- PostGIS adoption for advanced geographic queries
- Deployment target and public-access requirements

