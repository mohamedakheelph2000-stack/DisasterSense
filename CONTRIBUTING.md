# Contributing to DisasterSense

## Purpose

This repository is designed to remain beginner-friendly, modular, and suitable for a final-year project viva. Changes must be small, reviewable, and tied to an approved implementation step.

## Engineering rules

- Follow the approved Clean Architecture boundaries: presentation, application, domain, and infrastructure.
- Keep FastAPI controllers thin; place workflows in application use cases and business rules in domain modules.
- Do not let SQLAlchemy models, HTTP objects, or third-party SDK objects leak into domain rules.
- Use TypeScript strictly and validate API input on the backend with Pydantic.
- Add a concise docstring or TSDoc/comment for every function, including purpose, inputs/outputs, and meaningful side effects.
- Prefer clear names and small functions over clever abstractions.
- Do not create fake prediction outputs when a model, input, or provider response is unavailable.
- Treat manual input and provider-sourced input as distinct, traceable sources.

## Quality gate

Before a change is considered complete, run the relevant formatter, linter, type checker, and tests. Correct discovered errors immediately and record material decisions in PROJECT_CONTEXT.md or docs/decisions/.

## Security and data rules

- Never commit secrets, local environment files, production credentials, raw private data, or serialized model binaries.
- Keep dataset provenance, licenses, preprocessing, evaluation, and known limitations documented.
- Use role-based authorization on protected backend endpoints; frontend route checks are not sufficient security.

## Documentation rule

Update README.md when setup or project status changes. Update docs/viva/ when a feature needs a clearer explanation for demonstration or examination.

