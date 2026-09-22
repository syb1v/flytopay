# Flytopay

**Current version:** `0.13.0`

Platform for virtual foreign cards: public website, authenticated cabinet,
Telegram Mini App, Telegram bot, wallet payments, and 2328 CaaS card issuing.

Production: `https://flytopay.net` (web + `/api/*`) and `https://api.flytopay.net` (API only).

## Repository map

- `apps/web` — Next.js website, cabinet, Mini App, and admin UI.
- `apps/backend` — FastAPI API, Telegram bot, Celery worker/scheduler, integrations, Alembic migrations.
- `infra` — Caddy config, deploy, backup, and host cleanup scripts.
- `openapi.yaml`, `api-guide.md` — the 2328 CaaS provider contract (not the Flytopay API).
- `docs/superpowers` — architecture spec and implementation plans.
- `CHANGELOG.md` — release history (Keep a Changelog).

## Local development

```bash
cp .env.example .env
docker compose up --build
```

- API: `http://localhost:8000/health/live`
- Web: `http://localhost:3000`

Checks before a commit:

```bash
cd apps/backend && ruff check src tests && pytest
cd apps/web && npm run format:check && npm run typecheck && npm run build
```

Live payment or card operations must never run from automated tests; the test
suite mocks every provider.

## Environment

| Variable | Purpose |
|---|---|
| `APP_ENV` | `production` enables the startup guard and secure cookies |
| `SESSION_SECRET`, `CSRF_SECRET` | Random ≥32 chars |
| `ENCRYPTION_MASTER_KEY` | Encrypts stored cardholder PII; never rotate without migrating data |
| `DATABASE_URL`, `REDIS_URL` | Postgres and Redis (Redis also backs rate limiting) |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | Production compose services |
| `WEB_ORIGIN`, `API_ORIGIN` | CORS/CSRF origin checks and checkout return-URL allowlist |
| `TELEGRAM_BOT_TOKEN` | Mini App login, bot, and Telegram Stars invoices |
| `TELEGRAM_WEBHOOK_SECRET` | Verifies Telegram bot webhooks |
| `TELEGRAM_ADMIN_IDS` | Comma-separated Telegram ids with admin access |
| `CAAS_API_KEY`, `CAAS_BASE_URL` | 2328 CaaS card API (server-side only) |
| `CAAS_WEBHOOK_SECRET` | `whsec_…` secret from the 2328 webhook config |
| `PLATEGA_*`, `PAY2328_*` | Wallet top-up providers (optional; Stars works without them) |
| `NEXT_PUBLIC_API_ORIGIN` | API origin used by the web app |

Generate secrets with `openssl rand -hex 32`. The CaaS key must never appear in
`NEXT_PUBLIC_*`, browser code, logs, or Git. In production the API refuses to start
with weak secrets, a default database URL, or a missing CaaS key.

## Features

- **Cabinet / Mini App:** card carousel with total balance, card actions with confirmation
  dialogs, flip card with masked-until-revealed requisites and copy-to-clipboard fields,
  transaction history (cached, date-sorted, paginated, filters), wallet top-up, issuance
  storefront, services and profile pages, admin entry for admins, animated splash and page transitions.
- **Card design:** one layout for every card; the palette comes from the product
  (`lib/cardTheme.ts`): Visa → premium, Mastercard → travel, USD Virtual → subscriptions.
- **Wallet:** ledger with reservations (reserve → capture/release), idempotent credits.
- **Payments:** Telegram Stars (invoice links, credited on `successful_payment`); Platega and
  Pay2328 checkout once configured; reconciliation of stuck payments every 5 minutes.
- **Admin:** web panel at `/admin` and `/admin` bot command, restricted to `TELEGRAM_ADMIN_IDS`.

## API

All cookie-authenticated mutating endpoints require `X-CSRF-Token` (double-submit cookie
issued at login). Every response carries `X-Request-ID`.

| Endpoint | Description |
|---|---|
| `POST /api/v1/auth/telegram`, `POST /api/v1/auth/logout` | Telegram login/logout |
| `GET, PATCH /api/v1/me/preferences` | Language, currency, notifications |
| `GET /api/v1/wallet` | Wallet balance |
| `GET /api/v1/catalog/products` | Card products (synced from 2328) |
| `GET /api/v1/cards` | User cards with product code, scheme, name |
| `GET /api/v1/cards/{id}/details` | Holder, expiry, CVV (demo), billing address |
| `GET /api/v1/cards/{id}/transactions` | Card history (2328 proxy; local for demo cards) |
| `POST /api/v1/cards/{id}/freeze\|unfreeze\|close` | Synchronous lifecycle against 2328 |
| `POST /api/v1/cards/{id}/fund\|unload` | Money operations (wallet reservation + 2328 order) |
| `GET /api/v1/issuance/prices` | Live issuance quotes per product |
| `POST /api/v1/issuance/quote` | KYC-validated, idempotent issuance quote |
| `POST /api/v1/issuance/{id}/issue` | Issue a real card paid from the wallet |
| `POST /api/v1/issuance/{id}/checkout` | Pay an issuance through a payment provider |
| `POST /api/v1/payments/checkout` | Wallet top-up checkout (rate-limited, return-URL allowlist) |
| `GET /api/v1/rentals` | Card rentals |
| `GET /api/v1/admin/status\|overview\|users\|cards\|payments\|issuances` | Admin data |
| `POST /api/v1/telegram/webhook` | Telegram bot updates |
| `POST /api/v1/webhooks/{provider}` | Platega / Pay2328 / Telegram Stars webhooks |
| `POST /api/v1/webhooks/caas` | 2328 CaaS webhooks |
| `GET /health/live`, `GET /health/ready` | Health probes (also under `/api/v1`) |

Rate limits (Redis, fail-open): Telegram login 30/min per IP, checkout 20/min, quote 15/min,
issue 5/min, card fund/unload 10/min per user.

## 2328 CaaS integration

- Base URL `https://api.2328.io/caas/v1`, `Authorization: Bearer ck_…`, single live environment.
- Every mutating call sends a fresh `Idempotency-Key`; provider errors surface as `CaaSError`
  with the stable `error.code`, HTTP status, and `Retry-After`.
- Account limits from `/account/info` (min issue $5, min fund/unload $1, max fund $7,500)
  are enforced before calling the provider.

### Card issuance

1. `POST /issuance/quote` validates holder data and stores it encrypted with the exact 2328 total.
2. `POST /issuance/{id}/issue` reserves the total in the wallet, creates/reuses the 2328
   cardholder (`externalRef = user-<uuid>`), and submits `POST /cards`; the card shows as "issuing".
3. The `card.created` / `card.failed` webhook or the 30-second order poller
   (`flytopay.caas.poll_issues`) settles it: success captures the reservation and pulls last4,
   masked number, and balance; failure releases the funds.

The 2328 USDT wallet (`GET /account/wallet`) must be funded, otherwise 2328 rejects orders
with `wallet_insufficient_balance` and the reservation is released.

### Card operations

- Freeze / unfreeze / close are synchronous in 2328 and applied immediately.
- Fund reserves the amount in the wallet and captures/releases it when the order settles;
  unload credits the wallet with the provider-confirmed amount. Balances are re-read from
  `GET /cards/{id}/balance`.
- Seeded demo cards (`is_demo`) never call 2328: lifecycle, balances, and history are local.
- Full PAN/CVV (`/cards/{id}/secure`) requires 2328 approval (PCI, IP allowlist, mTLS) and is
  not enabled; real cards show only the masked number.

### Webhooks

- Endpoint in the 2328 panel: `https://api.flytopay.net/api/v1/webhooks/caas` (with or without trailing slash).
- Signature `caas_v1`: `X-Caas-Signature: t=<unix>,v1=<hex>`, key = hex(SHA256(secret)),
  message = `t.rawBody`, 300-second replay window.
- Events are deduplicated by `eventId`; test deliveries (`X-Caas-Test: 1`) are acknowledged
  without side effects; card status and balance events update the local card.

## Operations

- **Deploy:** push to `master` → CI (ruff, pytest, format, typecheck, build) → GHCR images →
  `infra/deploy.sh` on the VPS (migrations, health-checked rollout). The running tag is in
  `/opt/flytopay/.release.env`.
- **Workers:** Celery worker + beat — `flytopay.caas.poll_issues` (30s),
  `flytopay.payments.reconcile` (5 min), `flytopay.caas.lifecycle` (queued money operations).
- **Proxy:** Caddy serves `flytopay.net` (web + `/api`) and `api.flytopay.net` with automatic TLS.
- **Backups:** daily `pg_dump` via `/etc/cron.daily/flytopay-backup`, 14-day retention in
  `/opt/flytopay/backups`.
- **Disk hygiene:** weekly `infra/docker-prune.sh` via `/etc/cron.weekly`, keeping the running
  and two previous images.
- **Logging:** structlog, JSON in production.
- **Demo data:** `python -m flytopay.scripts.seed_demo_cards` (idempotent) seeds demo cards,
  balances, and transactions for the admin accounts.

## Server access

Password SSH login is disabled (including root). Admin access uses the `flytopay_vps`
ed25519 key; CI deploys as `flytopay-deploy` with its own key.

## Versioning

Flytopay follows [Semantic Versioning](https://semver.org/). Before `1.0.0`, the API and
UI may still change.

### Release checklist

1. Move entries from `Unreleased` into a new version in `CHANGELOG.md`.
2. Bump versions in `apps/web/package.json`, `apps/backend/pyproject.toml`,
   `apps/backend/src/flytopay/main.py`, and this README.
3. Run the backend and web checks listed above.
4. Commit, then create and push an annotated tag `vX.Y.Z`.
