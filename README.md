# Flytopay

Production-ready platform for virtual foreign cards with a public website,
authenticated cabinet, Telegram Mini App, payment integrations, and 2328 CaaS
card orchestration.

## Repository map

- `apps/web` — Next.js website, cabinet, Mini App, and admin UI.
- `apps/backend` — FastAPI application, workers, integrations, and migrations.
- `contracts` — normalized Flytopay and provider contracts.
- `infra` — deployment, proxy, backup, and operations files.
- `docs/superpowers/specs` — approved architecture specification.
- `docs/superpowers/plans` — implementation plan.
- `flytopay-design` — original visual prototype retained as reference.

## Local development

```bash
cp .env.example .env
docker compose up --build
```

The API health endpoint is available at `http://localhost:8000/health/live`.
The web application is available at `http://localhost:3000`.

Provider credentials are intentionally empty in the example environment.
Live payment or card operations must never run from automated tests.
