/**
 * PromptFactor Step 7 — Request Status Lifecycle (Minimum Viable State Machine)
 *
 * Primer contract:
 * accepted → pending → running → (succeeded | failed | cancelled)
 * - state transitions are explicit (enumerated, finite)
 * - state is not inferred from UI
 *
 * Note: This step does NOT introduce transition endpoints yet.
 * It only upgrades the stored request record to carry explicit lifecycle truth.
 */

"use strict";

// --- Canonical lifecycle (finite, enumerated)
const STATES = Object.freeze({
  ACCEPTED: "accepted",
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

// Allowed next states from each state (explicit, finite)
const ALLOWED_NEXT = Object.freeze({
  [STATES.ACCEPTED]: Object.freeze([STATES.PENDING]),
  [STATES.PENDING]: Object.freeze([STATES.RUNNING, STATES.CANCELLED]),
  [STATES.RUNNING]: Object.freeze([STATES.SUCCEEDED, STATES.FAILED, STATES.CANCELLED]),
  [STATES.SUCCEEDED]: Object.freeze([]),
  [STATES.FAILED]: Object.freeze([]),
  [STATES.CANCELLED]: Object.freeze([]),
});

// Module-private state (shared across imports within the same Node.js runtime).
const _requests = new Map();
let _seq = 0;

function _nextId() {
  _seq += 1;
  return `req_${String(_seq).padStart(6, "0")}`;
}

function _isoNow() {
  return new Date().toISOString();
}

/**
 * Create and store a request record.
 * No orchestration logic; just deterministic shape + persistence.
 */
function createRequest(input) {
  const id = _nextId();
  const createdAt = _isoNow();

  const initialStatus = STATES.ACCEPTED;

  const record = {
    id,
    status: initialStatus,
    createdAt,

    // Raw input exactly as received (can be null if body was empty)
    input: input ?? null,

    // Step 7: explicit lifecycle truth carried by the request record
    lifecycle: {
      states: Object.values(STATES),              // enumerated set
      allowedNext: ALLOWED_NEXT[initialStatus],   // deterministic next states
    },

    // Step 7: seed timeline with explicit initial transition (null → accepted)
    timeline: [
      {
        from: null,
        to: initialStatus,
        at: createdAt,
      },
    ],
  };

  _requests.set(id, record);
  return record;
}

/**
 * Retrieve a stored request record by id.
 */
function getRequest(id) {
  return _requests.get(id) ?? null;
}

module.exports = {
  createRequest,
  getRequest,
  STATES,
  ALLOWED_NEXT,
};
