# Flytopay

**Current version:** `0.5.0`

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

The 2328 integrations use separate credentials:

- `CAAS_API_KEY` authenticates the 2328 CaaS card catalog, quotes, card issuance, card balance, funding, freezing, unfreezing, and closing operations.
- `PAY2328_API_KEY` and `PAY2328_PROJECT_UUID` authenticate the separate 2328 payment checkout adapter.

The CaaS key must remain server-side. Do not expose it through `NEXT_PUBLIC_*`, browser code, HTML, logs, or Git.

## Versioning

Flytopay follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- `MAJOR` changes are reserved for incompatible API, contract, or operational changes.
- `MINOR` changes add backwards-compatible functionality.
- `PATCH` changes fix backwards-compatible bugs, documentation, or internal maintenance.

Before `1.0.0`, the public API and UI may still evolve. A release is recorded in
`CHANGELOG.md`, the relevant package versions are updated, and a Git tag in the
form `vMAJOR.MINOR.PATCH` is created.

### Release checklist

1. Update `CHANGELOG.md` and move the released entries from `Unreleased` into the new version.
2. Update package versions, keeping all independently released packages explicit.
3. Run `npm run format:check`, `npm run typecheck`, and `npm run build` in `apps/web`.
4. Commit the release with the version in the commit message.
5. Create and push the matching annotated tag, for example `v0.1.0`.

See `CHANGELOG.md` for the release history.
