// lib/requestRegistry.js — BOOT-STABLE RECOVERY VERSION
// In-memory deterministic request store (no DB, no orchestration logic)

"use strict";

// Process-global store so it survives multiple imports within a single runtime
const GLOBAL_KEY = "__PROMPTFACTOR_REGISTRY__";

if (!globalThis[GLOBAL_KEY]) {
  globalThis[GLOBAL_KEY] = {
    seq: 0,
    requests: new Map(), // id -> request
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

/**
 * createRequest(input)
 * Contract: returns a request object with id, status, createdAt, input, timeline
 */
function createRequest(input) {
  const id = _nextId();
  const createdAt = _isoNow();

  const record = {
    id,
    status: "accepted",
    createdAt,
    input: input ?? null,

    // Step 7/8 compatible: timeline exists for /history endpoint
    timeline: [
      {
        from: null,
        to: "accepted",
        at: createdAt,
      },
    ],
  };

  _store.requests.set(id, record);
  return record;
}

/**
 * getRequest(id)
 * Contract: returns stored request or null
 */
function getRequest(id) {
  return _store.requests.get(id) ?? null;
}

module.exports = {
  createRequest,
  getRequest,
};
