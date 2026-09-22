# Changelog

All notable changes to Flytopay are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and project versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Changes for the next release will be collected here.

## [0.6.0] - 2026-09-22

### Added

- Card funding and transfer endpoints (`POST /cards/{id}/fund`, `POST /cards/{id}/unload`) with balance validation and rate limiting.
- Amount dialog in the cabinet for funding and transferring cards, with live balance refresh after submission.
- Services page with issue, history, top-up and exchange tiles.

### Changed

- All mutating CaaS lifecycle calls (freeze, unfreeze, close, fund, unload) now execute in the Celery worker instead of the request path; the API only records the idempotent operation and queues the task.
- Structured logging via structlog: JSON output in production, console rendering in development.
- `caas_operation_records` gained a `request_payload` column so queued workers can replay the original request.

## [0.5.0] - 2026-09-22

### Added

- Cardholder KYC validation: structured emails, supported-country allowlist, and 18+ age enforcement.
- Redis-backed sliding-window rate limiting for Telegram login, payment checkout, and issuance quotes (fails open on Redis outages).
- Request correlation middleware issuing and propagating `X-Request-ID` across all endpoints.

## [0.4.0] - 2026-09-22

### Added

- CSRF protection with signed double-submit cookies for all cookie-authenticated mutating endpoints.
- CSRF token issued on Telegram login and attached by the web client to every mutating request.
- Payment reconciliation worker retrying `reconcile_required` attempts every 5 minutes with dead-letter accounting.
- Issuance quote idempotency: repeated `Idempotency-Key` returns the stored quote instead of duplicating PII.
- Return URL allowlist for payment checkout restricted to Flytopay origins.
- Explicit 409 responses for idempotency key reuse with a different request.

### Changed

- Webhook finalization failures are now durably recorded with a failure counter instead of being silently swallowed.
- `caas_operation_records.updated_at` now refreshes on every state transition.
- Renamed migration file `0010_admin_security.py` to `0012_admin_security.py` to match its revision id.

## [0.3.0] - 2026-09-22

### Added

- CaaS webhook endpoint with HMAC signature verification, event deduplication, and durable ingestion.
- Platega webhook authentication via merchant secret header.
- Pay2328 webhook signature verification wired into the shared webhook route.
- Ledger transitions: capture, release, and refund with idempotency guards.
- Payment idempotency recovery: concurrent duplicate inserts now return the winning attempt instead of failing.
- Production startup guard rejecting weak secrets, default database URLs, and missing CaaS credentials.
- Tests for webhook rejection paths, ledger state machine, and startup validation.

## [0.2.0] - 2026-09-22

### Added

- Card lifecycle API: freeze, unfreeze, and close endpoints with CaaS idempotency records.
- Card transactions API proxying provider history per card.
- Issuance prices endpoint exposing live quotes per product.
- Product tier catalog on the issuance screen with live pricing.
- Fullscreen product details view with features, conditions, and purchase confirmation.
- Transactions history screen with date grouping, card/type filters, and decline reasons.
- Recent transactions preview on the home screen for the active card.
- Real API wiring for freeze/unfreeze/close buttons with pending and error states.
- Docker Compose health checks for postgres, redis, and api with ordered startup.
- Deploy script logs API output when the health check fails.
- CI now enforces Prettier formatting for the web app.

### Changed

- Card status changes now persist through the backend instead of local-only state.
- Removed the dead ProductPickerDialog component.

### Fixed

- Issuance screen no longer auto-selects the first product before user choice.

[Unreleased]: https://github.com/syb1v/flytopay/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/syb1v/flytopay/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/syb1v/flytopay/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/syb1v/flytopay/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/syb1v/flytopay/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/syb1v/flytopay/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/syb1v/flytopay/releases/tag/v0.1.0
