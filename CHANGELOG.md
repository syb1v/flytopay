# Changelog

All notable changes to Flytopay are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and project versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Changes for the next release will be collected here.

## [0.11.0] - 2026-09-22

### Added

- Demo card lifecycle now works locally for freeze, unfreeze, close, fund, and unload without sending fake provider IDs to CaaS.
- Demo fund/unload operations update wallet/card balances and create transaction history records.
- Telegram Stars checkout via Bot API invoice links and successful-payment wallet crediting.
- Wallet top-up modal with provider selection; Telegram Stars is available when the bot token is configured, other providers show their configuration state.

### Fixed

- Removed the last lifecycle stubs for seeded demo cards.

## [0.10.3] - 2026-09-22

### Fixed

- Card tiers are now resolved from the product code through a single shared mapper on every screen (home carousel, details dialog, issuance catalog), eliminating scheme and palette mismatches between views.
- The issuance catalog no longer assigns tiers by array index; raw provider products without a recognized type stay off the storefront.
- Demo products are enabled in the seed so the issuance showcase shows the premium, travel, and subscriptions cards with their real schemes.

## [0.10.2] - 2026-09-22

### Fixed

- Returning to the home page now restores the carousel scroll position to the previously selected card instead of resetting to the first (greyed-out) card.

## [0.10.1] - 2026-09-22

### Fixed

- Card scheme now renders from API data in the details dialog (both sides of the flip) — Mastercard cards no longer show VISA.
- Removed blue accents from the balance block: the top-up button and the visibility dot inherit brand colors.
- Restored the header title on History, Services, Profile, and Issuance pages; removed duplicated section titles and the empty space above them.
- Recent transactions on the home screen use the exact history row design including type icons.

## [0.10.0] - 2026-09-22

### Added

- Transaction modal: tapping a history row opens unified modal with amount, status, type, card binding, country, MCC, fee, decline reason, and timestamp.
- Unified animated loader (brand logo + spinner) for transactions history, recent activity, and product catalog.
- Telegram identity in the cabinet: header and profile show the Telegram name and numeric id avatar.

### Changed

- Card scheme is now delivered by the cards API and rendered consistently everywhere (dashboard carousel, details dialog, catalog) — no more hardcoded VISA over Mastercard designs.
- Recent transactions on the home screen now use the exact history page row design.
- Removed duplicated page titles on Services, Profile, and Issuance screens (the section title is the single source).
- Profile hero shows the Telegram user name instead of the generic "Your profile" label.

## [0.9.0] - 2026-09-22

### Added

- Card flip interaction: tap or horizontal swipe reveals the card back with CVV, magnetic stripe, and signature panel.
- Card details endpoint (`GET /cards/{id}/details`) exposing holder, expiry, CVV, and the billing address (CaaS for real cards, protected cardholder payload for demo cards).
- Card details dialog now renders real requisites and the billing address instead of placeholders.
- Weekly Docker cleanup script (`infra/docker-prune.sh`) installed as a server cron job to prevent image garbage accumulation.

### Changed

- Balance block restyled: removed blue accents from the secondary card to match the green brand palette.

## [0.8.0] - 2026-09-22

### Added

- Demo cards for admin users: premium, travel, and subscriptions variants per user with distinct balances.
- Local card transaction records with a demo-history fallback so demo cards show real grouped history without CaaS.
- Demo seed creates wallet balances and per-card transaction sets (purchases, declines, refunds, top-ups).
- Tier catalog cards now render a live `CardVisual` preview of each product.

### Changed

- Issuance screen flattened: removed the nested layout container that constrained tier cards.
- Removed the "Product capabilities" sidebar and its quote button; the exact quote now appears inline in the cardholder form.

## [0.7.0] - 2026-09-22

### Changed

- Unified card design: every card type (default, travel, subscriptions, premium) now shares the same layout — chip, cardholder, expiry, payment scheme mark, brand logo, and contactless icon — differing only in palette.
- The subscriptions card now uses the main green Flytopay styling.
- Mastercard cards render the dual-circle scheme mark instead of text.
- All popups and dialogs migrated to a single unified Radix modal (`Modal`): card details, amount entry, product details, and info messages.
- The product details view moved from a fullscreen page to the unified modal and now previews the real `CardVisual` component.
- Browser `alert()` calls replaced with unified modal windows.

## [0.6.0] - 2026-09-22

### Added

- Card funding and transfer endpoints (`POST /cards/{id}/fund`, `POST /cards/{id}/unload`) with balance validation and rate limiting.
- Amount dialog in the cabinet for funding and transferring cards, with live balance refresh after submission.
- Services page with issue, history, top-up and exchange tiles.

### Changed

- All mutating CaaS lifecycle calls (freeze, unfreeze, close, fund, unload) now execute in the Celery worker instead of the request path; the API only records the idempotent operation and queues the task.
- Structured logging via structlog: JSON output in production, console rendering in development.
- `caas_operation_records` gained a `request_payload` column so queued workers can replay the original request.
- Removed the legacy design prototype folder and brand book from the repository (superseded by the production UI and design tokens).

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

[Unreleased]: https://github.com/syb1v/flytopay/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/syb1v/flytopay/compare/v0.10.3...v0.11.0
[0.10.3]: https://github.com/syb1v/flytopay/compare/v0.10.2...v0.10.3
[0.10.2]: https://github.com/syb1v/flytopay/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/syb1v/flytopay/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/syb1v/flytopay/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/syb1v/flytopay/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/syb1v/flytopay/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/syb1v/flytopay/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/syb1v/flytopay/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/syb1v/flytopay/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/syb1v/flytopay/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/syb1v/flytopay/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/syb1v/flytopay/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/syb1v/flytopay/releases/tag/v0.1.0
