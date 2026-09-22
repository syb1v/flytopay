# Changelog

All notable changes to Flytopay are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and project versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Changes for the next release will be collected here.

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

[Unreleased]: https://github.com/syb1v/flytopay/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/syb1v/flytopay/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/syb1v/flytopay/releases/tag/v0.1.0
