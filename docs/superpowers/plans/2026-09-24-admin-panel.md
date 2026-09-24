# Russian Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first production-ready Russian Flytopay admin panel with real dashboard metrics, searchable users, safe user management, and auditable actions.

**Architecture:** Extend the existing FastAPI admin router and `admin_security` RBAC/audit models with paginated read endpoints and narrowly scoped user mutations. Replace the single client-side admin screen with focused React components and local shadcn-style primitives built on existing CSS/Radix dependencies.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL, pytest, Next.js 15, React, TypeScript, lucide-react, Radix UI, existing Flytopay CSS.

**Spec:** `docs/superpowers/specs/2026-09-24-admin-panel-design.md`

## Global Constraints

- Keep `CAAS_API_KEY` server-side and never expose PAN, CVV, tokens, or webhook secrets.
- Preserve `/api/v1/admin/status`, `/overview`, `/users`, `/cards`, `/payments`, and `/issuances` compatibility.
- All mutating admin routes require permission checks, CSRF verification, an Idempotency-Key, and audit events.
- Bootstrap owners can read all admin data but cannot be blocked through the user-management UI.
- Keep the existing user change in `opencode.json` out of all commits.
- Run backend ruff/pytest and web format/typecheck/build before completion.

---

### Task 1: Add backend admin contracts and dashboard queries

**Files:**
- Modify: `apps/backend/src/flytopay/admin/routes.py`
- Create: `apps/backend/src/flytopay/admin/schemas.py`
- Modify: `apps/backend/tests/test_admin_security.py`
- Create: `apps/backend/tests/test_admin_routes.py`

**Interfaces:**
- Produce `GET /api/v1/admin/dashboard` with 30-day daily series and real aggregates.
- Produce paginated `GET /api/v1/admin/users` accepting `q`, `status`, `activity`, `page`, `limit`, `sort`, `order`.
- Produce `GET /api/v1/admin/users/{user_id}` with safe user details and related counts.
- Keep response envelope `{ "success": true, "data": ... }`.

- [ ] Add typed query/response schemas and centralize `admin.read` dependency.
- [ ] Write route tests for permission denial, UUID/Telegram/username search, stable pagination, status filter, and absence of sensitive fields.
- [ ] Implement SQLAlchemy queries with UTC date boundaries and bounded `limit` of 100.
- [ ] Add dashboard series grouped by date for users, successful payments, and rentals.
- [ ] Run `cd apps/backend && .venv/bin/pytest -q tests/test_admin_routes.py tests/test_admin_security.py`.

### Task 2: Implement user mutations with CSRF, idempotency, and audit

**Files:**
- Modify: `apps/backend/src/flytopay/admin/routes.py`
- Modify: `apps/backend/src/flytopay/auth/session.py`
- Create: `apps/backend/src/flytopay/admin/audit.py`
- Create: `apps/backend/tests/test_admin_user_actions.py`

**Interfaces:**
- `POST /api/v1/admin/users/{user_id}/block` body `{ "reason": string }`.
- `POST /api/v1/admin/users/{user_id}/unblock` body `{ "reason": string }`.
- `POST /api/v1/admin/users/{user_id}/revoke-sessions` body `{ "reason": string }`.

- [ ] Write failing tests for permission, CSRF dependency, missing/blank reason, idempotency replay, bootstrap-owner protection, status updates, session revocation, and audit rows.
- [ ] Add a small audit helper that stores actor, action, resource, resource ID, reason, and request metadata without secrets.
- [ ] Add `revoke_user_sessions(db, user_id)` that sets `Session.revoked_at` for active sessions and returns a count.
- [ ] Add routes using `require_admin_permission`, `verify_csrf`, and an `Idempotency-Key` header.
- [ ] Commit no external payment/card operations from these routes.
- [ ] Run focused tests, then `cd apps/backend && .venv/bin/ruff check src tests`.

### Task 3: Build reusable admin UI primitives and Russian shell

**Files:**
- Create: `apps/web/src/components/admin/ui/Button.tsx`
- Create: `apps/web/src/components/admin/ui/Card.tsx`
- Create: `apps/web/src/components/admin/ui/Badge.tsx`
- Create: `apps/web/src/components/admin/ui/Input.tsx`
- Create: `apps/web/src/components/admin/ui/Dialog.tsx`
- Create: `apps/web/src/components/admin/ui/Table.tsx`
- Create: `apps/web/src/components/admin/ui/Pagination.tsx`
- Create: `apps/web/src/components/admin/AdminLayout.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Primitives accept normal React props and className overrides.
- `AdminLayout` receives `activeSection`, `onSectionChange`, and children.

- [ ] Implement keyboard-focusable buttons, dialog escape handling, semantic tables, and responsive horizontal overflow.
- [ ] Translate all navigation and shell copy: Обзор, Пользователи, Карты, Платежи, Выпуск карт, Журнал действий, Настройки, Выйти.
- [ ] Use the current graphite/lime visual language while applying shadcn-style borders, badges, cards, dialogs, skeletons, and density.
- [ ] Add mobile sidebar/menu behavior without breaking the existing cabinet styles.
- [ ] Run `cd apps/web && npm run format:check && npm run typecheck`.

### Task 4: Replace admin page with dashboard and user management

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/admin/AdminDashboard.tsx`
- Create: `apps/web/src/components/admin/AdminUsers.tsx`
- Create: `apps/web/src/components/admin/AdminUserDetails.tsx`
- Create: `apps/web/src/components/admin/AdminActivity.tsx`

**Interfaces:**
- Add typed `AdminDashboard`, `AdminUserListItem`, `AdminUserDetails`, and `AdminPageResponse` API types.
- Add client functions for dashboard, paginated users, user details, block/unblock, revoke sessions, and activity.

- [ ] Write the dashboard cards for real totals and 30-day series with loading/error/empty states.
- [ ] Write user filters with debounced query, status select, activity select, server pagination, and sort controls.
- [ ] Show each user’s Telegram ID, username/name, status, registration, last activity, cards, rentals, and balance.
- [ ] Add user detail dialog/page with cards, payment/rental counts, safe profile fields, and mutation confirmation dialogs requiring a reason.
- [ ] Add optimistic-free mutation flow: submit, refresh detail/list, display Russian success/error toast.
- [ ] Ensure no English labels remain in the admin page.
- [ ] Run `cd apps/web && npm run format:check && npm run typecheck && npm run build`.

### Task 5: Add audit activity and integration verification

**Files:**
- Modify: `apps/backend/src/flytopay/admin/routes.py`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/admin/page.tsx`
- Create: `apps/backend/tests/test_admin_activity.py`

**Interfaces:**
- `GET /api/v1/admin/activity?page=&limit=` returns actor, action, resource, reason-safe details, and timestamp.

- [ ] Test audit pagination and that sensitive request headers/details are excluded.
- [ ] Render the activity table with Russian action names and readable dates.
- [ ] Verify all four admin sections work against the response envelope and 403 state.
- [ ] Run backend `cd apps/backend && .venv/bin/ruff check src tests && .venv/bin/python -m pytest -q`.
- [ ] Run web `cd apps/web && npm run format:check && npm run typecheck && npm run build`.
- [ ] Review `git diff`, stage only admin files/spec/plan, commit with `feat(admin): build russian admin panel`, and push `master` only after verification.
