# Flytopay Agent Instructions

## Project scope

Flytopay is a Telegram Mini App and web cabinet backed by FastAPI, PostgreSQL,
Redis and Celery. The application integrates with 2328 CaaS for virtual-card
issuing and card lifecycle operations.

## Repository layout

- `apps/backend` — FastAPI API, Telegram bot, Celery worker/beat and migrations.
- `apps/web` — Next.js cabinet, Mini App and admin UI.
- `infra` — production compose, Caddy, deployment, backup and Docker cleanup.
- `openapi.yaml` and `api-guide.md` — 2328 CaaS provider documentation.
- `CHANGELOG.md` — release history.

## Development checks

Backend:

```bash
cd apps/backend
.venv/bin/ruff check src tests
.venv/bin/python -m pytest -q
```

Web:

```bash
cd apps/web
npm run format:check
npm run typecheck
npm run build
```

Run both suites before a release. Never run live card or payment operations in
automated tests.

## Versioning and commits

- Follow Semantic Versioning.
- Update `CHANGELOG.md`, `README.md`, `apps/web/package.json`,
  `apps/backend/pyproject.toml`, and the FastAPI version when releasing.
- Create an annotated tag named `vMAJOR.MINOR.PATCH`.
- Keep commits focused and use a concise conventional-style message.
- Do not commit `.env`, API keys, webhook secrets, passwords, private keys,
  database dumps, or generated caches.

## CaaS integration rules

- CaaS base URL: `https://api.2328.io/caas/v1`.
- Use `CAAS_API_KEY` only on the backend. Never use it in `NEXT_PUBLIC_*` or
  browser code.
- Use the exact 2328 camelCase contract and the documented response envelope.
- Send a fresh `Idempotency-Key` for every new mutating operation.
- Treat fund, unload and issue as asynchronous operations; settle them through
  orders/webhooks and do not assume HTTP 202 means success.
- Verify CaaS `caas_v1` webhook signatures against the raw request body:
  `X-Caas-Signature: t=<unix>,v1=<hex>`, using the 2328 documented signing-key
  derivation and a five-minute replay window.
- Do not log PAN, CVV, full webhook secrets or cardholder PII.

## Production environment

Production VPS:

- IP: `81.90.25.240`
- Web: `https://flytopay.net`
- API: `https://api.flytopay.net`
- CaaS webhook: `https://api.flytopay.net/api/v1/webhooks/caas`
- SSH user: `root`
- Local SSH private key: `/home/sybiv/.ssh/flytopay_vps`
- SSH public key: `/home/sybiv/.ssh/flytopay_vps.pub`

The private key must remain outside Git and must keep restrictive permissions
(`0600`). Password SSH login is disabled on the VPS. CI deploys with the
separate `flytopay-deploy` account/key.

Example connection:

```bash
ssh -i /home/sybiv/.ssh/flytopay_vps root@81.90.25.240
```

Do not place the root password or any provider secret in this file. If a secret
has been exposed in chat, rotate it in the provider panel and update the server
environment instead of recording it here.

## Production deployment

Normal deployment is push-driven:

```bash
git push origin master
```

GitHub Actions builds the API/web images, uploads deployment files and runs
`/opt/flytopay/deploy.sh`. The deployed image tag is stored in
`/opt/flytopay/.release.env`.

For server diagnostics:

```bash
ssh -i /home/sybiv/.ssh/flytopay_vps root@81.90.25.240
cd /opt/flytopay
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail 100
docker compose -f docker-compose.prod.yml exec -T api python -c \
  'import urllib.request; print(urllib.request.urlopen("http://localhost:8000/health/live").status)'
```

Do not run `docker compose down -v` in production: named Postgres/Redis volumes
contain application data. Backups run daily and Docker cleanup runs weekly via
`/etc/cron.daily/flytopay-backup` and `/etc/cron.weekly/flytopay-docker-prune`.

## Existing local changes

Before editing or deleting files, inspect `git status` and treat unfamiliar
changes as user work. Stage only files belonging to the current task.
