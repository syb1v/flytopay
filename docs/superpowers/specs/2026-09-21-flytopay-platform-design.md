# Flytopay Platform Design

**Status:** Approved for implementation  
**Date:** 2026-09-21

## Goal

Build a production-ready Flytopay platform for virtual foreign cards, available through a public website, authenticated cabinet, and Telegram Mini App, with Platega, Pay2328, Telegram Stars, and 2328 CaaS integrations.

## Product scope

- Card purchase and fixed-term rental for 30, 90, 180, and 365 days.
- Rental renewal on the same card while the card remains eligible.
- Two funding modes: internal Flytopay wallet and direct checkout for a specific operation.
- Rental expiry lifecycle: notifications at T-7/T-3, freeze at expiry, seven-day grace period, then unload, wallet credit, and close.
- Russian and English interface languages.
- Independent display currency switch: USD/RUB.
- Public website, cabinet, Telegram Mini App, Telegram bot notifications, and role-based admin panel.
- Provider capabilities and limits are read from 2328 and are never hardcoded as operational truth.

## Architecture

Use a modular monolith with separately deployable API, worker, scheduler, and Next.js web processes. PostgreSQL is the source of truth for users, money, orders, cards, rentals, events, and audit records. Redis is used for queues, locks, rate limits, and cache; it is never the only copy of financial state.

```text
Browser / Telegram Mini App
        -> Flytopay API
        -> PostgreSQL + transactional outbox
        -> Redis queues and locks
        -> Platega / Pay2328 / Telegram Bot API / Telegram Stars / 2328 CaaS
```

The browser never receives provider credentials and never calls 2328 or payment providers directly.

## Technology

- Backend: Python 3.12+, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic, httpx, aiogram 3.
- Workers: Celery with Redis broker/result transport, PostgreSQL outbox/inbox records.
- Frontend: Next.js, TypeScript, Tailwind CSS, accessible UI primitives, TanStack Query, Zustand, React Hook Form, Zod.
- Localization: i18next/react-i18next with lazy RU/EN bundles and server-safe request isolation.
- Infrastructure: Docker Compose, Caddy, GitHub Actions, GHCR.
- Verification: pytest, Vitest, Playwright, PostgreSQL integration tests, provider contract mocks generated from the supplied OpenAPI contract.

## Frontend

One web application serves marketing pages, cabinet, admin, and Mini App-specific navigation. Shared design tokens preserve the approved graphite/lime Flytopay brand while reducing decorative density. The settings screen follows the approved RageNet VPN pattern: segmented RU/EN and USD/RUB controls, immediate application, local persistence, and backend synchronization.

Key screens:

- Marketing: home, how it works, catalog, rental, purchase, fees, FAQ, support, terms, privacy, launch app.
- Cabinet: dashboard, cards, rentals, buy card, wallet top-up, payments, history, profile, security, support.
- Mini App: mobile bottom navigation, Telegram BackButton, safe-area handling, MainButton for primary action, haptics as optional enhancement.
- Admin: dashboard, users, payments, wallets, cards, rentals, reconciliation, catalog, tariffs, notifications, audit, system.

All async operations expose loading, processing, success, failure, refund-pending, reconciliation, empty, and error states. A 202 provider response is never rendered as completed.

## Localization and display currency

User preferences are stored in `user_preferences` and mirrored in local storage for fast startup. Language resolution is: backend preference, local preference, Telegram/browser language, then Russian fallback. Currency is independent from language.

Financial truth remains in operation currency and integer minor units. Display conversion is server-provided and marked with rate and timestamp. Checkout uses a locked server-side price snapshot; changing USD/RUB never changes an existing checkout, ledger entry, or provider amount.

## Domain model

Core entities:

- Users, Telegram accounts, sessions, preferences, consents, support threads.
- Payment attempts, provider events, wallets, ledger accounts, immutable ledger entries, reservations, refunds, reconciliation cases.
- Cardholders, cards, card orders, card transactions, encrypted credentials, rentals, rental extensions, rental events.
- Outbox events, idempotency keys, audit events, capabilities snapshots, pricing snapshots.

Payment attempt states: `creating`, `pending`, `awaiting_confirmation`, `paid`, `failed`, `expired`, `refund_pending`, `refunded`, `reconcile_required`.

Card states: `issuing`, `active`, `frozen`, `suspended`, `closing`, `closed`, `expired`, `failed`.

Rental states: `draft`, `awaiting_payment`, `provisioning`, `active`, `expiring`, `frozen_grace`, `closing`, `completed`, `cancelled`, `failed`.

## Money and ledger invariants

- Store every amount as an integer minor unit with explicit currency and scale.
- Keep user-facing provider payment amount separate from ledger credit amount and conversion snapshot.
- Never change a balance by direct assignment; every change is an immutable ledger entry.
- Reserve before an external card command and release or settle the reservation exactly once.
- Finalize payments only after authoritative provider verification of ID, terminal status, exact amount, currency, correlation, ownership, and non-duplication.

## 2328 integration

Keep the CaaS Cards API client separate from the Pay2328 payment client. The CaaS adapter includes account capabilities, pricing, cardholders, cards, orders, webhooks, and credential access.

All mutating requests use a persisted stable `Idempotency-Key`. Async operations are tracked through webhooks and polling with bounded exponential backoff. Unknown provider statuses are persisted and sent to reconciliation without granting value.

Credential access has two providers:

1. Temporary encrypted-storage provider, only when the provider actually returns credentials and storage is permitted by the program rules.
2. Hosted/provider-controlled reveal provider when `secureReveal` or equivalent is enabled.

PAN/CVV never enter logs, analytics, error reports, webhook archives, or normal audit payloads. Access requires explicit capability, re-authentication, TTL, rate limits, masking, and an audit event containing no credential value. CVV storage remains disabled unless explicitly permitted by the issuing program and confirmed in the provider terms.

## Payment integrations

Implement Platega, Pay2328, and Telegram Stars behind a common payment-provider interface. Each provider has its own client, signature verification, status mapping, payment attempt persistence, webhook ingestion, reconciliation adapter, and tests.

Webhook flow:

```text
raw request -> authenticate -> persist dedup key -> return 2xx
            -> queue -> authoritative GET -> atomic finalization -> notification
```

Telegram Stars are processed through Telegram Bot API updates, including `pre_checkout_query` and `successful_payment`, with exact XTR amount, payload, Telegram user, charge IDs, and duplicate checks.

## API boundary

Application endpoints are versioned under `/api/v1` and expose normalized Flytopay DTOs. Mutating endpoints require `Idempotency-Key`.

```text
/auth /me /catalog /wallet /payments /checkout /cards /rentals
/orders /notifications /support /admin /webhooks
```

Provider keys and raw provider payloads remain backend-only. Public errors contain a stable public code, safe localized message, and request ID, never stack traces or secrets.

## Reliability

Queues include payments, card commands, card polling, rental lifecycle, notifications, and reconciliation. PostgreSQL unique constraints provide financial event deduplication; Redis is auxiliary.

Timeout after a mutating provider request goes to reconciliation rather than an unsafe blind retry. GETs and documented idempotent operations may retry on 429/5xx with `Retry-After` and exponential backoff. Workers use distributed locks and row locks for rental transitions and wallet finalization.

## Infrastructure and security

Docker Compose services: web, api, worker, scheduler, PostgreSQL, Redis, Caddy, backup job, and monitoring. Only ports 80/443 and restricted SSH are public. TLS, HSTS, CSP, secure headers, strict CORS, rate limits, and admin deny-by-default are mandatory.

Production secrets are external to Git and logs. Previously exposed credentials are considered compromised and must be rotated before deployment. Backups are encrypted, stored off-host, tested by restoration, and retained daily/weekly/monthly. Target operational objectives are RPO up to one hour and RTO up to four hours, subject to restoration testing.

## Completion criteria

- Site, cabinet, Mini App, bot, and admin use the same production API and state.
- RU/EN and USD/RUB work across all user screens and synchronize across surfaces.
- Repeated requests, webhooks, retries, and restarts do not duplicate financial effects.
- Rental expiry and renewal safely handle concurrent commands.
- Provider outages create visible processing/reconciliation states rather than false success.
- Backups restore successfully and deployment/rollback are documented and repeatable.
- No provider credentials, PAN/CVV, Telegram init data, cookies, or authorization headers appear in logs or built frontend assets.
