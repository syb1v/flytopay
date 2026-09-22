# Flytopay

**Current version:** `0.12.1`

Production-ready platform for virtual foreign cards with a public website,
authenticated cabinet, Telegram Mini App, payment integrations, and 2328 CaaS
card orchestration.

## Repository map

- `apps/web` — Next.js website, cabinet, Mini App, and admin UI.
- `apps/backend` — FastAPI application, Celery workers, integrations, and migrations.
- `infra` — deployment, proxy, backup, and operations files.
- `docs/superpowers/specs` — approved architecture specification.
- `docs/superpowers/plans` — implementation plans.
- `CHANGELOG.md` — release history (Keep a Changelog).

## Local development

```bash
cp .env.example .env
docker compose up --build
```

The API health endpoint is available at `http://localhost:8000/health/live`.
The web application is available at `http://localhost:3000`.

## Environment

The 2328 integrations use separate credentials:

- `CAAS_API_KEY` authenticates the CaaS card catalog, quotes, issuance, balance,
  funding, freezing, unfreezing, and closing operations.
- `PAY2328_API_KEY` and `PAY2328_PROJECT_UUID` authenticate the separate 2328
  payment checkout adapter.

Generate the remaining secrets locally:

```bash
openssl rand -hex 32   # SESSION_SECRET, CSRF_SECRET, ENCRYPTION_MASTER_KEY, CAAS_WEBHOOK_SECRET
```

The CaaS key must remain server-side. Do not expose it through `NEXT_PUBLIC_*`,
browser code, HTML, logs, or Git.

Provider credentials are intentionally empty in the example environment.
Live payment or card operations must never run from automated tests.

## API surface (v0.6.0)

| Endpoint | Description |
|---|---|
| `POST /api/v1/auth/telegram` | Telegram login; issues session + CSRF cookies |
| `GET /api/v1/wallet` | Wallet balance |
| `GET /api/v1/cards` | User cards with product codes |
| `GET /api/v1/cards/{id}/transactions` | Card transactions (CaaS proxy) |
| `POST /api/v1/cards/{id}/freeze\|unfreeze\|close\|fund\|unload` | Async card lifecycle via worker |
| `GET /api/v1/issuance/prices` | Live quote prices per product |
| `POST /api/v1/issuance/quote` | Idempotent issuance quote (KYC-validated) |
| `POST /api/v1/payments/checkout` | Payment checkout (rate-limited, return-url allowlist) |
| `POST /api/v1/webhooks/{provider}` | Platega / Pay2328 / Telegram Stars webhooks |
| `POST /api/v1/webhooks/caas/` | CaaS webhooks (HMAC-signed) |

All cookie-authenticated mutating endpoints require the `X-CSRF-Token` header
(double-submit cookie issued at login).

## Operations

- Mutating CaaS calls run in the Celery worker (`flytopay.caas.lifecycle`), not
  in the request path; the payment reconciliation task
  (`flytopay.payments.reconcile`) retries stale attempts every 5 minutes.
- Structured logging: JSON in production, console in development; every response
  carries an `X-Request-ID` correlation header.
- Production startup fails fast on weak secrets, default database URLs, or a
  missing CaaS key.
- The 2328 CaaS webhook endpoint URL for the provider panel:
  `https://api.flytopay.net/api/v1/webhooks/caas/` (trailing slash required).

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
4. Run `ruff check src tests` and `pytest` in `apps/backend`.
5. Commit the release with the version in the commit message.
6. Create and push the matching annotated tag, for example `v0.6.0`.

See `CHANGELOG.md` for the release history.
