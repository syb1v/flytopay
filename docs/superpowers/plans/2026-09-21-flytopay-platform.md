# Flytopay Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved production-ready Flytopay website, Telegram Mini App, backend, payments, card orchestration, rentals, admin panel, and operations stack.

**Architecture:** A modular monolith is split into Next.js web, FastAPI API, Celery worker, and scheduler processes. PostgreSQL is the financial source of truth; Redis is auxiliary infrastructure. External provider calls are isolated behind adapters and all money-changing workflows use idempotency, reservations, immutable ledger entries, webhooks, polling, and reconciliation.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, httpx, aiogram 3, Celery, Redis, PostgreSQL, Next.js, TypeScript, Tailwind CSS, TanStack Query, Zustand, React Hook Form, Zod, i18next, Docker Compose, Caddy, GitHub Actions, pytest, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-21-flytopay-platform-design.md`

## Global Constraints

- Never commit production secrets or reuse credentials exposed in chat.
- Never expose provider keys or 2328 credentials to browser code.
- Store money only as integer minor units with explicit currency and scale.
- Do not directly assign financial balances; use immutable ledger entries.
- Every mutating external command has a persisted idempotency key.
- A provider `202` means processing, never completed.
- Unknown provider status/event values are persisted and routed to reconciliation.
- User language is RU/EN and display currency is independently USD/RUB.
- PAN/CVV are never logged; local credential storage is allowed only when returned and permitted, encrypted with AEAD, and must be replaceable by hosted reveal.
- Production integration tests must not create real cards or spend real funds automatically.

## Task 1: Repository and project skeleton

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `apps/backend/pyproject.toml`
- Create: `apps/backend/src/flytopay/__init__.py`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `docker-compose.yml`
- Create: `infra/Caddyfile`
- Create: `.github/workflows/ci.yml`
- Move/retain: `Flytopay-Brandbook.pdf`, `flytopay-design/`, `openapi.yaml`, `api-guide.md`

**Interfaces:** Produce runnable web and backend health skeletons, environment-variable names, Docker service names, and CI commands.

- [ ] Define the monorepo scripts for backend lint/test and frontend lint/typecheck/build.
- [ ] Add `.gitignore` entries for `.env*` except `.env.example`, build output, caches, credentials, database dumps, and local secrets.
- [ ] Add a Docker Compose network with web, api, worker, scheduler, postgres, redis, and proxy placeholders.
- [ ] Add a Caddy configuration routing `flytopay.net`, `api.flytopay.net`, `admin.flytopay.net`, and `webhooks.flytopay.net` through environment-configured upstreams.
- [ ] Add CI that runs backend formatting/lint/tests and frontend lint/typecheck/build without live provider calls.
- [ ] Verify `docker compose config`, backend import, and frontend build with placeholder environment values.

## Task 2: Database foundation and migrations

**Files:**
- Create: `apps/backend/src/flytopay/db/base.py`
- Create: `apps/backend/src/flytopay/db/session.py`
- Create: `apps/backend/alembic.ini`
- Create: `apps/backend/migrations/env.py`
- Create: `apps/backend/migrations/versions/0001_core.py`
- Create: `apps/backend/tests/test_db_bootstrap.py`

**Interfaces:** Produce async SQLAlchemy session factory, declarative base, Alembic migration entrypoint, and test database fixture.

- [ ] Define UTC-aware timestamp, UUID, JSONB, integer-minor-unit, and optimistic versioning conventions.
- [ ] Add initial tables for users, Telegram accounts, sessions, preferences, consents, outbox events, idempotency keys, audit events, and provider capabilities snapshots.
- [ ] Add unique constraints for Telegram account identity, idempotency scope/key, outbox event IDs, and provider event IDs.
- [ ] Run the migration against PostgreSQL and verify a clean upgrade from empty database.

## Task 3: Backend configuration, API envelope, and health

**Files:**
- Create: `apps/backend/src/flytopay/config.py`
- Create: `apps/backend/src/flytopay/api/errors.py`
- Create: `apps/backend/src/flytopay/api/request_context.py`
- Create: `apps/backend/src/flytopay/api/health.py`
- Create: `apps/backend/src/flytopay/main.py`
- Create: `apps/backend/tests/test_health.py`

**Interfaces:** Produce `create_app()`, `/health/live`, `/health/ready`, `/health/dependencies`, request ID middleware, and safe error envelopes.

- [ ] Load settings only from environment with explicit production validation.
- [ ] Ensure live health does not call dependencies and ready health reports dependency state without secrets.
- [ ] Add structured request IDs and safe exception mapping.
- [ ] Test health endpoints and redaction of authorization headers, cookies, Telegram init data, and provider secrets.

## Task 4: Auth, Telegram Mini App identity, and preferences

**Files:**
- Create: `apps/backend/src/flytopay/auth/telegram.py`
- Create: `apps/backend/src/flytopay/auth/service.py`
- Create: `apps/backend/src/flytopay/auth/routes.py`
- Create: `apps/backend/src/flytopay/preferences/models.py`
- Create: `apps/backend/src/flytopay/preferences/service.py`
- Create: `apps/backend/src/flytopay/preferences/routes.py`
- Create: `apps/backend/tests/test_telegram_auth.py`
- Create: `apps/backend/tests/test_preferences.py`

**Interfaces:** Produce `POST /api/v1/auth/telegram`, `POST /api/v1/auth/logout`, `GET/PATCH /api/v1/me/preferences`, and session dependency.

- [ ] Validate Telegram `initData` hash and freshness server-side using the bot token.
- [ ] Create opaque internal user IDs and HttpOnly secure sessions; never trust `initDataUnsafe`.
- [ ] Normalize languages to `ru`/`en` and currencies to `USD`/`RUB`.
- [ ] Implement backend preference persistence and tests for unsupported language/currency fallback.

## Task 5: Frontend design system and localization

**Files:**
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/i18n/config.ts`
- Create: `apps/web/src/locales/ru/*.json`
- Create: `apps/web/src/locales/en/*.json`
- Create: `apps/web/src/features/preferences/usePreferences.ts`
- Create: `apps/web/src/components/settings/PreferencesPanel.tsx`
- Create: `apps/web/src/components/ui/*`
- Create: `apps/web/tests/preferences.spec.tsx`

**Interfaces:** Produce shared Flytopay UI primitives, RU/EN lazy bundles, USD/RUB preference controls, and formatter utilities.

- [ ] Translate every user-facing string through i18next with Russian fallback.
- [ ] Recreate the RageNet segmented settings pattern without copying unrelated product styling.
- [ ] Add locale-aware date and money formatting that never performs financial settlement calculations.
- [ ] Add responsive tokens for the approved graphite/lime brand and accessible focus/contrast states.
- [ ] Test immediate language/currency switching and persistence across reload.

## Task 6: Frontend public site, cabinet, and Mini App shell

**Files:**
- Create: `apps/web/src/app/(marketing)/**`
- Create: `apps/web/src/app/cabinet/**`
- Create: `apps/web/src/app/mini-app/**`
- Create: `apps/web/src/platform/telegram.ts`
- Create: `apps/web/src/platform/web.ts`
- Create: `apps/web/src/features/auth/**`
- Create: `apps/web/e2e/navigation.spec.ts`

**Interfaces:** Produce shared navigation, public pages, authenticated shell, Mini App BackButton/MainButton integration, loading/empty/error states, and settings access.

- [ ] Implement marketing routes and cabinet route guards against the backend session.
- [ ] Add mobile bottom navigation and desktop sidebar without shrinking desktop layout into Mini App.
- [ ] Add Telegram safe-area, viewport, and optional haptic adapters.
- [ ] Verify site and Mini App route behavior with Playwright at desktop and mobile viewports.

## Task 7: Provider clients and contract test harness

**Files:**
- Create: `apps/backend/src/flytopay/integrations/caas2328/client.py`
- Create: `apps/backend/src/flytopay/integrations/caas2328/models.py`
- Create: `apps/backend/src/flytopay/integrations/pay2328/client.py`
- Create: `apps/backend/src/flytopay/integrations/platega/client.py`
- Create: `apps/backend/src/flytopay/integrations/telegram/stars.py`
- Create: `apps/backend/tests/providers/mock_caas.py`
- Create: `apps/backend/tests/providers/test_provider_contracts.py`

**Interfaces:** Produce typed provider clients with timeouts, redacted logs, status normalization, and no live calls in tests.

- [ ] Generate or hand-maintain typed DTOs from the supplied `openapi.yaml` and preserve unknown fields.
- [ ] Implement Bearer auth, rate-limit headers, bounded GET retries, and no blind POST retry after timeout.
- [ ] Keep Pay2328 payment client separate from CaaS card client.
- [ ] Implement Platega signature/status adapter and Telegram Stars update parser.
- [ ] Verify clients against sanitized fixtures and error-code mapping.

## Task 8: Ledger, wallet, pricing, and reservations

**Files:**
- Create: `apps/backend/src/flytopay/ledger/models.py`
- Create: `apps/backend/src/flytopay/ledger/service.py`
- Create: `apps/backend/src/flytopay/wallet/routes.py`
- Create: `apps/backend/src/flytopay/pricing/service.py`
- Create: `apps/backend/migrations/versions/0002_finance.py`
- Create: `apps/backend/tests/test_ledger_invariants.py`

**Interfaces:** Produce atomic credit/debit/reserve/release/settle operations, wallet endpoints, price snapshots, and display-rate DTOs.

- [ ] Implement immutable double-entry ledger records with integer minor units and currency/scale.
- [ ] Lock wallet and reservation rows during finalization; reject insufficient available funds.
- [ ] Store provider amount, ledger amount, conversion source, rate, timestamp, and markup separately.
- [ ] Add tests proving duplicate finalization and concurrent reservations cannot change funds twice.

## Task 9: Payment attempts, checkout, and webhooks

**Files:**
- Create: `apps/backend/src/flytopay/payments/models.py`
- Create: `apps/backend/src/flytopay/payments/service.py`
- Create: `apps/backend/src/flytopay/payments/routes.py`
- Create: `apps/backend/src/flytopay/payments/webhooks.py`
- Create: `apps/backend/src/flytopay/payments/reconciliation.py`
- Create: `apps/backend/migrations/versions/0003_payments.py`
- Create: `apps/backend/tests/test_payment_finalization.py`

**Interfaces:** Produce payment attempt lifecycle, direct checkout, wallet deposits, provider webhook ingestion, authoritative verification, refund states, and reconciliation cases.

- [ ] Persist payment attempt before provider create and reuse stable correlation/idempotency key.
- [ ] Verify provider ID, terminal state, exact amount/currency, payload correlation, owner, and unprocessed marker before ledger credit.
- [ ] Implement Platega and Pay2328 webhook routes and Telegram Stars pre-checkout/successful-payment handling.
- [ ] Persist deduplication keys with PostgreSQL uniqueness and queue processing through outbox.
- [ ] Test duplicate webhooks, mismatched amounts, timeout after create, late success, and refund-required paths.

## Task 10: Cardholders, cards, credentials, and CaaS orchestration

**Files:**
- Create: `apps/backend/src/flytopay/cards/models.py`
- Create: `apps/backend/src/flytopay/cards/service.py`
- Create: `apps/backend/src/flytopay/cards/routes.py`
- Create: `apps/backend/src/flytopay/cards/credentials.py`
- Create: `apps/backend/src/flytopay/cards/webhooks.py`
- Create: `apps/backend/src/flytopay/migrations/versions/0004_cards.py`
- Create: `apps/backend/tests/test_card_orders.py`

**Interfaces:** Produce card catalog, cardholder creation, issue/fund/unload/freeze/unfreeze/close commands, order polling, and credential reveal session endpoint.

- [ ] Read capabilities/account info and products with bounded cache; never hardcode limits.
- [ ] Persist every CaaS command and stable idempotency key before external request.
- [ ] Map 202 to processing and reconcile unknown POST outcomes.
- [ ] Encrypt returned credentials with AEAD only when storage is permitted; redact values from every log/error path.
- [ ] Add hosted reveal strategy selected by capabilities without changing frontend contracts.

## Task 11: Rentals and lifecycle workers

**Files:**
- Create: `apps/backend/src/flytopay/rentals/models.py`
- Create: `apps/backend/src/flytopay/rentals/service.py`
- Create: `apps/backend/src/flytopay/rentals/routes.py`
- Create: `apps/backend/src/flytopay/rentals/tasks.py`
- Create: `apps/backend/migrations/versions/0005_rentals.py`
- Create: `apps/backend/tests/test_rental_lifecycle.py`

**Interfaces:** Produce rental preview/create/renew/terminate endpoints and scheduled transitions for 30/90/180/365-day periods.

- [ ] Start rental term only after card is active and usable.
- [ ] Persist exact price and term snapshot; renew same card only while eligible and not closing.
- [ ] Implement T-7/T-3 notifications, expiry freeze, seven-day grace, unload, wallet credit, and close.
- [ ] Use row locks and distributed locks so renewal and termination cannot both win.
- [ ] Test restart recovery, provider delay, minimum unload amount, failed close, and non-returnable remainder handling.

## Task 12: Notifications, bot, support, and admin

**Files:**
- Create: `apps/backend/src/flytopay/notifications/service.py`
- Create: `apps/backend/src/flytopay/telegram/bot.py`
- Create: `apps/backend/src/flytopay/support/routes.py`
- Create: `apps/backend/src/flytopay/admin/routes.py`
- Create: `apps/web/src/app/admin/**`
- Create: `apps/web/src/features/admin/**`
- Create: `apps/backend/tests/test_notifications.py`

**Interfaces:** Produce localized Telegram notifications, support threads, RBAC admin API, reconciliation UI, audit UI, and emergency disable controls.

- [ ] Dispatch notifications only from committed outbox events and localize using stored user language.
- [ ] Implement roles `owner`, `finance`, `support`, `operations`, `viewer` with deny-by-default checks.
- [ ] Add reconciliation list/detail/actions with mandatory reason and audit record.
- [ ] Restrict credential access to explicit permission, re-authentication, TTL, and masked audit event.
- [ ] Test role boundaries and notification retry without duplicate financial effects.

## Task 13: Workers, observability, infrastructure, and deployment

**Files:**
- Create: `apps/backend/src/flytopay/worker.py`
- Create: `apps/backend/src/flytopay/scheduler.py`
- Create: `apps/backend/src/flytopay/observability.py`
- Create: `infra/backup.sh`
- Create: `infra/restore-drill.sh`
- Create: `docs/runbooks/deployment.md`
- Create: `docs/runbooks/disaster-recovery.md`
- Modify: `docker-compose.yml`, `.github/workflows/ci.yml`

**Interfaces:** Produce runnable API/worker/scheduler processes, metrics/logging, backup/restore scripts, health checks, and deploy runbook.

- [ ] Configure Celery queues for payments, cards, polling, rentals, notifications, and reconciliation.
- [ ] Add outbox dispatcher and worker heartbeat metrics.
- [ ] Add structured redacted JSON logs, provider latency/error metrics, backlog metrics, and Sentry/OpenTelemetry integration points.
- [ ] Add encrypted PostgreSQL backup with off-host destination variables and restore verification script.
- [ ] Add migration-before-start deployment job, smoke tests, rollback instructions, and emergency feature flags.

## Task 14: Verification and production readiness

**Files:**
- Create: `apps/backend/tests/integration/**`
- Create: `apps/web/e2e/critical-flows.spec.ts`
- Create: `docs/runbooks/live-provider-checklist.md`
- Create: `docs/architecture/production-readiness.md`

**Interfaces:** Produce a repeatable readiness report for site, Mini App, payments, cards, rentals, localization, currency display, recovery, and security.

- [ ] Run unit, integration, contract, frontend, E2E, migration, and build checks with live calls disabled.
- [ ] Run concurrency tests for duplicate webhook, duplicate checkout, reserve race, renewal/expiry race, and worker restart.
- [ ] Scan built assets and logs for secrets, PAN/CVV, Telegram init data, cookies, and auth headers.
- [ ] Perform controlled provider checks manually with explicit confirmation and small amounts only.
- [ ] Execute backup restoration and rollback drill, then record evidence in the readiness document.
