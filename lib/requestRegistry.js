/**
 * PromptFactor Step 7 — Request Status Lifecycle (Corrected: Process-Global Store)
 *
 * Fix: Ensure the in-memory registry is truly shared across the Node.js process,
 * even if the module is reloaded or imported in multiple places.
 *
 * This does NOT add a database and does NOT add orchestration logic.
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

const ALLOWED_NEXT = Object.freeze({
  [STATES.ACCEPTED]: Object.freeze([STATES.PENDING]),
  [STATES.PENDING]: Object.freeze([STATES.RUNNING, STATES.CANCELLED]),
  [STATES.RUNNING]: Object.freeze([STATES.SUCCEEDED, STATES.FAILED, STATES.CANCELLED]),
  [STATES.SUCCEEDED]: Object.freeze([]),
  [STATES.FAILED]: Object.freeze([]),
  [STATES.CANCELLED]: Object.freeze([]),
});

/**
 * Process-global backing store (single shared identity within a Node.js process).
 * This prevents "same module but different instance" drift.
 */
const GLOBAL_KEY = "__PROMPTFACTOR_REQUEST_REGISTRY__";

if (!globalThis[GLOBAL_KEY]) {
  globalThis[GLOBAL_KEY] = {
    requests: new Map(),
    seq: 0,
  };
}

const _store = globalThis[GLOBAL_KEY];

function _nextId() {
  _store.seq += 1;
  return `req_${String(_store.seq).padStart(6, "0")}`;
}

function _isoNow() {
  return new Date().toISOString();
}

function createRequest(input) {
  const id = _nextId();
  const createdAt = _isoNow();
  const initialStatus = STATES.ACCEPTED;

  const record = {
    id,
    status: initialStatus,
    createdAt,
    input: input ?? null,

    lifecycle: {
      states: Object.values(STATES),
      allowedNext: ALLOWED_NEXT[initialStatus],
    },

    timeline: [
      {
        from: null,
        to: initialStatus,
        at: createdAt,
      },
    ],
  };

  _store.requests.set(id, record);
  return record;
}

function getRequest(id) {
  return _store.requests.get(id) ?? null;
}

module.exports = {
  createRequest,
  getRequest,
  STATES,
  ALLOWED_NEXT,
};
