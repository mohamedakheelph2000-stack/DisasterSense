# ADR-0001: Use a Modular Monolith

Date: 2026-08-08

## Status

Accepted

## Context

DisasterSense requires a Next.js frontend, FastAPI backend, PostgreSQL persistence, ML inference, maps, alerts, analytics, and emergency-resource planning. The project must remain maintainable, beginner-friendly, testable, and clear enough to defend in a final-year viva.

## Decision

Build one repository with independently deployable frontend and backend applications plus an offline ML package. Keep all modules within a modular monolith and use Clean Architecture boundaries inside the backend.

## Alternatives considered

- Microservices for each hazard, alert, and resource module
- A single unstructured full-stack application
- Training models inside the backend request process

## Consequences

- The system is simpler to develop, test, run locally, and explain.
- Modules retain clear boundaries and can be separated later if scale genuinely requires it.
- Model training remains reproducible and separate from request-time inference.
- Cross-module changes remain transactional and easier to audit during the academic project phase.

