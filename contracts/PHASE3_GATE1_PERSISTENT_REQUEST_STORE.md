# Phase 3 · Gate 1 — Persistent Request Store (Contract)

Status: AUTHORITATIVE CONTRACT (Phase 3 work cannot proceed without satisfying this)

Source of truth:
- PROMPTFACTOR — CANONICAL STATE (08 Feb 2026): Phase 3 Gate 1 requires SQL-backed persistence; requests/runs must survive restart/redeploy; nothing important may exist only in memory.
- PromptFactor Canonical Primer: contract-first, deterministic runtime identity, thin HTTP / thick core, no silent assumptions.


## 1) Purpose (What this Gate achieves)

This Gate introduces a durable, SQL-backed persistence layer for the **Request** entity such that:

- Requests survive server restarts and redeploys.
- Existing API semantics do not change (Phase 2 contracts remain stable).
- The Orchestrator Core no longer relies on in-memory storage for Requests.

This Gate is intentionally limited: it persists **Requests only**.


## 2) Non-Goals (Explicitly out of scope for Gate 1)

Forbidden in Gate 1 (Phase 3 will add later in separate gates):

- Runs persistence
- Artifacts persistence
- AuditLog persistence
- RBAC / workspace isolation enforcement
- Migrations framework hardening beyond minimum boot-safe needs
- Background workers / async orchestration

If any of the above is implemented during Gate 1, the change is INVALID for Phase-gated execution.


## 3) Definitions

### 3.1 Request
Atomic unit of work. Current system already supports:
- create (POST /api/orchestrate)
- list (GET /api/requests)
- get (GET /api/requests/:id)
- history (GET /api/requests/:id/history)
- transition (POST /api/requests/:id/transition)

This Gate does NOT introduce new endpoints.

### 3.2 Persistent Request Store
A storage implementation backed by SQL that is the source of truth for Request records.


## 4) Invariants (Non-negotiable)

1) No API semantic drift:
- Existing endpoint shapes and meanings are preserved.
- Determinism and idempotency behavior must remain stable across retries.

2) Boot-safe:
- App either boots and can serve /health, or fails loudly (no “silent fallback to memory”).

3) No “dual truth”:
- If SQL persistence is enabled, the authoritative read/write path for Requests is SQL.
- Memory may exist only as a cache, never as the source of truth.

4) No partial success:
- If a Request create/transition cannot be persisted, the API call must fail (no “saved in memory anyway”).

5) Contract-first storage boundary:
- Orchestrator logic must access persistence via a RequestStore interface, not raw SQL calls scattered through routes.


## 5) RequestStore Interface (Contract)

The system must define a storage boundary with the following behaviors.

### 5.1 Interface surface (language-agnostic)

- init(): establish connectivity, fail loudly if configured but unavailable.
- createRequest(request): persists a new request (atomic).
- getRequestById(id): returns request or null.
- listRequests({ limit, offset }): returns deterministic ordering (most-recent-first by createdAt unless existing behavior differs).
- updateRequest(id, patch): persists a state change and/or output/error fields (atomic).
- appendHistoryEvent(requestId, event): persists history OR (if history persistence is not implemented yet) stores a “historyBlob” inside Request as an interim, explicit contract.

IMPORTANT:
History persistence is allowed ONLY as an interim representation embedded in the Request record for Gate 1,
because AuditLog persistence is out of scope. This must be explicit—no hidden in-memory history.

### 5.2 Required idempotency behavior

If the system currently supports idempotencyKey (Phase 2 PASS):
- The RequestStore MUST persist and enforce idempotency keys such that:
  - Repeating the same create call with the same idempotencyKey returns the same request id.
  - This remains true across restart/redeploy.

If idempotencyKey exists today, persistence MUST include it in this Gate.


## 6) SQL Schema Contract (Minimum Viable)

SQL engine is intentionally UNSPECIFIED in this Gate, but schema must be explicit and portable.

### 6.1 Table: requests (minimum columns)

- id                TEXT PRIMARY KEY
- status            TEXT NOT NULL
- persona_id         TEXT NULL
- input_json         TEXT NOT NULL          -- serialized JSON (string)
- output_json        TEXT NULL              -- serialized JSON (string)
- error_json         TEXT NULL              -- serialized JSON (string)
- history_json       TEXT NOT NULL          -- serialized JSON array (string), interim until AuditLog gate
- idempotency_key    TEXT NULL              -- required if supported today
- created_at         TEXT NOT NULL          -- ISO string (or DB timestamp; representation must be deterministic)
- updated_at         TEXT NOT NULL

### 6.2 Constraints (minimum)

- status must be one of:
  accepted | pending | running | succeeded | failed | cancelled
- idempotency_key uniqueness:
  - If idempotency is supported today, enforce uniqueness at least per “workspace scope”.
  - Workspace scope is RESERVED/UNSPECIFIED in Gate 1; therefore uniqueness may be global for now,
    BUT must be implemented in a way that can later become (workspace_id, idempotency_key) unique.

### 6.3 RESERVED columns (allowed but not required in Gate 1)

These may be added only as NULLable, non-enforced placeholders:
- workspace_id TEXT NULL

Do NOT implement RBAC or isolation logic yet (later Phase 3 gates).


## 7) Deterministic History Representation (Gate 1 rule)

Because persistent AuditLog is out of scope, but Phase 2 already exposes /history:

Gate 1 must ensure /history survives restart by either:

A) Storing history events in `requests.history_json` (required if no separate table), OR
B) A separate history table *ONLY IF* it is strictly request-bound and not promoted as “AuditLog”.

Regardless, /api/requests/:id/history must return identical results before and after restart.


## 8) PASS/FAIL Criteria for Gate 1

Gate 1 PASSES iff all are true:

1) Create request, obtain id.
2) After a restart/redeploy, GET /api/requests/:id returns the same request (same id, same status, same input).
3) After a restart/redeploy, GET /api/requests/:id/history returns the same history entries (structurally).
4) Idempotency behavior (if present today) still returns the same request id across restart/redeploy.
5) No endpoint shape changes.

If any are false, Gate 1 FAILS and Phase 3 cannot proceed.


## 9) Verification Procedure (to be executed after implementation)

NOTE: This section is a checklist; implementation comes in the next gate steps.

### 9.1 Production verification (required)

A) Create:
- POST /api/orchestrate
- Save returned request id

B) Redeploy by committing a no-op (or restart service), then:

C) Verify:
- GET /api/requests/:id returns 200 and same persisted values.
- GET /api/requests/:id/history returns 200 and same persisted values.

D) Verify deployment validity rule remains true:
- GET /health commit matches GitHub SHA


## 10) Change Control

- This contract is immutable unless explicitly versioned/authorized.
- Any implementation that adds Runs/Artifacts/AuditLog persistence in Gate 1 violates Phase gating.
