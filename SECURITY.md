# Security Policy

## Scope

DisasterSense is currently under active academic development. Security issues should be recorded privately with the project owner rather than placed in public issue trackers.

## Baseline requirements

- Store secrets only in local environment files or a deployment secret manager.
- Keep JWT signing keys, database credentials, and third-party credentials out of source control.
- Hash passwords; never store plaintext passwords.
- Enforce role-based authorization in FastAPI for every protected or administrative action.
- Validate all API input, coordinates, uploaded content, and external-provider responses.
- Log auditable administrative and resource-allocation changes without logging secrets.

## Safety boundaries

Weather-provider data and ML outputs are decision-support inputs, not official emergency alerts. Resource dispatches and escalation actions must require authorized human approval.

