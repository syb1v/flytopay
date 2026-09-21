# CaaS Card Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an isolated, typed CaaS card lifecycle adapter, persistence-backed idempotency service, order polling primitives, and webhook normalization without changing public routes, frontend, payments, or `main.py`.

**Architecture:** Extend the existing `CaaSClient` with contract-shaped HTTP methods and explicit response metadata. Keep lifecycle DTOs and pure normalization in a separate module, persistence in a separate SQLAlchemy model/service, and Celery-compatible polling in a worker module. Tests use only `httpx.MockTransport` and pure payloads.

**Tech Stack:** Python 3.12, httpx, dataclasses/enums, SQLAlchemy async, Alembic, pytest/pytest-asyncio, Ruff.

**Spec:** Approved design in conversation; source contract `openapi.yaml` and `api-guide.md`.

## Global Constraints

- Do not modify `main.py`, existing `cards/routes.py`, frontend, or payment code.
- Do not perform real CaaS operations in tests.
- Preserve unknown provider statuses/events through explicit fallbacks.
- Treat HTTP 202 and `data.status=processing` as non-terminal.
- Do not commit changes.

---

### Task 1: Typed client adapter

**Files:** Modify `apps/backend/src/flytopay/integrations/caas2328/client.py`; add lifecycle DTO exports.

- [ ] Add typed response metadata and methods for all lifecycle paths, preserving the existing dictionary methods.
- [ ] Make `_request` retain HTTP status while validating the CaaS envelope and send idempotency headers where supported.
- [ ] Add MockTransport tests for paths, payloads, headers, 202 responses, and read methods.

### Task 2: Pure lifecycle normalization

**Files:** Create `apps/backend/src/flytopay/integrations/caas2328/lifecycle.py` and tests.

- [ ] Add known/unknown status enums and immutable normalized operation/order/webhook values.
- [ ] Normalize 202 processing, terminal statuses, unknown statuses, and test webhook markers.
- [ ] Test card lifecycle event names with an unknown-event fallback.

### Task 3: Persisted operation records

**Files:** Create model/service and Alembic revision `0011_caas_operation_records.py`.

- [ ] Store operation key, fingerprint, operation kind, provider order/card ids, status, and last response.
- [ ] Implement lookup-or-create semantics and deterministic key conflict errors.
- [ ] Keep this service opt-in and disconnected from existing routes/payment flows.

### Task 4: Worker primitives and exports

**Files:** Create lifecycle service/worker modules and package exports.

- [ ] Expose typed lifecycle service methods combining client calls and normalized values.
- [ ] Add one-poll operation function and a Celery task factory/entrypoint that does not register routes.
- [ ] Export public client, DTO, normalization, persistence, and worker symbols.

### Task 5: Verification

- [ ] Run focused tests, then full `ruff check` and `pytest` from `apps/backend`.
- [ ] Inspect status/diff and report only files introduced by this implementation plus pre-existing changes.
