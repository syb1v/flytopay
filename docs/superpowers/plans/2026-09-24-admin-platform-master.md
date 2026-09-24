# Full Flytopay Admin Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a real Russian back-office platform covering operations, sales, pricing, cards, marketing, communications, integrations, and security.

**Architecture:** Extend the existing FastAPI/SQLAlchemy/Alembic backend by domain modules and use a versioned PostgreSQL schema. Build the Next.js admin as a route-level shell with reusable shadcn-style primitives, typed API clients, server-backed tables, dialogs, charts, and permission-aware navigation. Every mutation is transactional, idempotent, CSRF-protected, permission-checked, and audited.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL, Alembic, Redis/Celery, pytest, Next.js 15, React 19, TypeScript, Radix UI, lucide-react, clsx, tailwind-merge.

**Spec:** `docs/superpowers/specs/2026-09-24-admin-platform-master-design.md`

## Global Constraints

- Do not expose PAN, CVV, session tokens, provider API keys, webhook secrets, or full cardholder PII.
- Do not fabricate metrics or mark asynchronous CaaS/payment requests successful from HTTP 202.
- All mutations require granular permission, CSRF, Idempotency-Key, validation, reason where risky, and audit.
- Amounts use integer minor units with ISO currency and scale; never float for money.
- Never run live card or payment operations in automated tests.
- Keep existing `opencode.json` user changes out of commits.
- Each stage requires Alembic migration, backend tests, frontend typecheck/build, focused commit, and push.

---

### Task 1: Foundation schema, permissions, and admin shell

**Files:**
- Create: `apps/backend/migrations/versions/0016_admin_platform_foundation.py`
- Create: `apps/backend/src/flytopay/admin_platform/models.py`
- Create: `apps/backend/src/flytopay/admin_platform/permissions.py`
- Modify: `apps/backend/src/flytopay/admin_security/models.py`
- Modify: `apps/backend/src/flytopay/admin_security/bootstrap.py`
- Create: `apps/backend/tests/test_admin_platform_schema.py`
- Create: `apps/web/src/components/admin/AdminPlatformLayout.tsx`
- Create: `apps/web/src/components/admin/ui/{button,card,badge,input,select,dialog,table,pagination}.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`

**Interfaces:**
- Seed all permissions from the master spec idempotently.
- Expose a permission catalog endpoint and permission-aware navigation.
- Use typed `AdminSection`, `AdminPermission`, and shared UI primitive props.

- [ ] Add migration tables for `feature_flags`, `system_settings`, `admin_idempotency_keys`, `admin_jobs`, and `admin_error_events` with UUIDs, timestamps, indexes, and uniqueness constraints.
- [ ] Add SQLAlchemy models and import them in `migrations/env.py`.
- [ ] Add idempotent permission seeding and tests for bootstrap owner, allowlist roles, and missing permissions.
- [ ] Split the current admin page into a shell and domain sections while preserving `/admin/status` compatibility.
- [ ] Run migration SQL generation check, backend focused tests, `ruff`, and web format/typecheck/build.

### Task 2: Dashboard, sales analytics, and system/API control

**Files:**
- Create: `apps/backend/src/flytopay/admin_platform/analytics.py`
- Create: `apps/backend/src/flytopay/admin_platform/system.py`
- Create: `apps/backend/src/flytopay/admin_platform/routes_dashboard.py`
- Create: `apps/backend/tests/test_admin_platform_dashboard.py`
- Create: `apps/web/src/components/admin/dashboard/AdminOverview.tsx`
- Create: `apps/web/src/components/admin/dashboard/SalesAnalytics.tsx`
- Create: `apps/web/src/components/admin/dashboard/SystemHealth.tsx`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- `GET /api/v1/admin/dashboard/overview`
- `GET /api/v1/admin/sales?date_from=&date_to=&group_by=`
- `GET /api/v1/admin/system/health`
- `POST /api/v1/admin/system/jobs/{id}/retry` with `admin.system.write`

- [ ] Build real SQL aggregates for revenue, orders, average check, paid users, conversion, product sales, currencies, and daily points.
- [ ] Add payment/card/issuance/error health checks without returning secrets.
- [ ] Add job/error/webhook views backed by recorded events; never claim provider health without a request or stored check result.
- [ ] Add date range, period comparison, CSV-safe export endpoint, loading/error/empty UI, and responsive charts.
- [ ] Test UTC boundaries, failed/successful payment grouping, empty datasets, and health degradation.

### Task 3: Card products, prices, fee policies, issuance, and cards

**Files:**
- Create: `apps/backend/migrations/versions/0017_catalog_pricing.py`
- Create: `apps/backend/src/flytopay/catalog/models.py`
- Create: `apps/backend/src/flytopay/catalog/routes_admin.py`
- Create: `apps/backend/tests/test_admin_catalog.py`
- Create: `apps/web/src/components/admin/catalog/ProductList.tsx`
- Create: `apps/web/src/components/admin/catalog/ProductEditor.tsx`
- Create: `apps/web/src/components/admin/catalog/PriceHistory.tsx`
- Create: `apps/web/src/components/admin/cards/CardOperations.tsx`

**Interfaces:**
- CRUD `/api/v1/admin/products` and `/api/v1/admin/products/{id}`.
- CRUD `/api/v1/admin/products/{id}/prices` with effective version history.
- Read/action endpoints for issuance, cards, rentals, transactions; lifecycle actions reuse existing CaaS services.

- [ ] Add product price versions, fee policies, country/product availability, display order, and audit fields.
- [ ] Validate minor units, currency, term ranges, card limits, and no overlapping effective price versions.
- [ ] Add product preview and enabled/disabled controls.
- [ ] Add safe card/issuance tables and async operation status; reuse existing freeze/unfreeze/close/fund/unload service boundaries.
- [ ] Test price version conflicts, permissions, idempotency, and no live provider calls.

### Task 4: Payments, reconciliation, refunds, and finance reports

**Files:**
- Create: `apps/backend/migrations/versions/0018_finance_admin.py`
- Create: `apps/backend/src/flytopay/finance_admin/models.py`
- Create: `apps/backend/src/flytopay/finance_admin/routes.py`
- Create: `apps/backend/tests/test_finance_admin.py`
- Create: `apps/web/src/components/admin/finance/PaymentsTable.tsx`
- Create: `apps/web/src/components/admin/finance/PaymentDetails.tsx`
- Create: `apps/web/src/components/admin/finance/RefundDialog.tsx`
- Create: `apps/web/src/components/admin/finance/FinanceReports.tsx`

**Interfaces:**
- Paginated payments/reconciliation endpoints with provider/status/purpose/date filters.
- Refund request endpoint creates an auditable pending workflow; it never mutates ledger directly.
- CSV report endpoint with permission and bounded date range.

- [ ] Add refund requests, approval state, provider operation reference, reason, and audit linkage.
- [ ] Show commissions, gross/net revenue, margin, pending/failed/reconciled states.
- [ ] Add safe retry/reconciliation actions that route through existing services.
- [ ] Test duplicate refund prevention, asynchronous pending state, authorization, and report totals.

### Task 5: Users, segments, tags, notes, and bulk actions

**Files:**
- Create: `apps/backend/migrations/versions/0019_user_operations.py`
- Create: `apps/backend/src/flytopay/user_admin/models.py`
- Create: `apps/backend/src/flytopay/user_admin/routes.py`
- Create: `apps/backend/tests/test_user_admin_extended.py`
- Create: `apps/web/src/components/admin/users/UserDetail.tsx`
- Create: `apps/web/src/components/admin/users/UserSegments.tsx`
- Create: `apps/web/src/components/admin/users/BulkActions.tsx`

**Interfaces:**
- Extend user list/detail with notes, tags, attribution, referral and complete card/payment/rental timeline.
- Bulk endpoint accepts explicit UUID list and one safe operation, returning per-user results.

- [ ] Add tags, notes, segments, source attribution and indexed filters.
- [ ] Add soft delete/restore safeguards, demo issuance workflow, and session management.
- [ ] Require confirmation/reason for bulk actions and audit each affected resource.
- [ ] Test partial failures, idempotency, bootstrap protection, and permission boundaries.

### Task 6: Campaigns, promo codes/groups, and referrals

**Files:**
- Create: `apps/backend/migrations/versions/0020_marketing.py`
- Create: `apps/backend/src/flytopay/marketing/models.py`
- Create: `apps/backend/src/flytopay/marketing/routes.py`
- Create: `apps/backend/tests/test_marketing_admin.py`
- Create: `apps/web/src/components/admin/marketing/Campaigns.tsx`
- Create: `apps/web/src/components/admin/marketing/PromoCodes.tsx`
- Create: `apps/web/src/components/admin/marketing/Referrals.tsx`

**Interfaces:**
- CRUD campaigns, campaign event attribution, promo codes/groups/redemptions, referral settings/ledger/payout requests.
- Analytics endpoints return registrations, first payments, conversions, revenue, CAC, and ROI.

- [ ] Add start parameter/UTM attribution at signup and payment boundaries without changing Telegram auth security.
- [ ] Add discount/bonus rule validation and prevent stacking unless explicitly configured.
- [ ] Add referral commission ledger and payout workflow separate from user wallet ledger.
- [ ] Test attribution, redemption limits, expiry, campaign isolation, and referral calculations.

### Task 7: Communications and content management

**Files:**
- Create: `apps/backend/migrations/versions/0021_content_communications.py`
- Create: `apps/backend/src/flytopay/content/models.py`
- Create: `apps/backend/src/flytopay/content/routes.py`
- Create: `apps/backend/src/flytopay/communications/routes.py`
- Create: `apps/backend/tests/test_content_admin.py`
- Create: `apps/web/src/components/admin/content/ContentEditor.tsx`
- Create: `apps/web/src/components/admin/content/Broadcasts.tsx`
- Create: `apps/web/src/components/admin/content/Templates.tsx`

**Interfaces:**
- CRUD FAQ/news/legal/media/templates and broadcast draft/preview/schedule/send/status endpoints.

- [ ] Add localized content versions, draft/published states, categories/tags, media metadata, and sanitization.
- [ ] Add audience segments, rate limits, Telegram delivery records, retry state, and no-secret previews.
- [ ] Require `admin.broadcasts.send`, explicit audience summary, and confirmation for sends.
- [ ] Test XSS sanitization, locale fallback, idempotent send creation, and delivery accounting.

### Task 8: Admin management, integrations, settings, and final UI

**Files:**
- Create: `apps/backend/migrations/versions/0022_admin_operations.py`
- Create: `apps/backend/src/flytopay/admin_platform/operations.py`
- Create: `apps/backend/tests/test_admin_operations.py`
- Modify: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/components/admin/security/AdminsRoles.tsx`
- Create: `apps/web/src/components/admin/system/Integrations.tsx`
- Create: `apps/web/src/components/admin/system/Settings.tsx`
- Create: `apps/web/src/components/admin/system/AuditLog.tsx`

**Interfaces:**
- Admin CRUD for roles/permissions/allowlist and revoke admin sessions.
- System settings/feature flags API exposes only allowlisted business values.
- Integration health, webhook events, failed jobs, and audit filters/export.

- [ ] Add permission-aware navigation and route guards for every domain.
- [ ] Add masked integration status, Celery/Redis/Postgres checks, webhook replay controls, maintenance mode, and feature flags.
- [ ] Add immutable audit filters by actor/action/resource/date/correlation ID.
- [ ] Complete responsive, keyboard, focus, empty/error/loading and Russian localization pass.
- [ ] Run full backend and web suites, inspect migration upgrade/downgrade, review secrets, commit each working stage, and push only verified commits.
