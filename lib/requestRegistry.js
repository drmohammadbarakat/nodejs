// lib/requestRegistry.js
// PromptFactor governed in-memory registry (deterministic).
// Scope: request storage + lifecycle + history + idempotency mapping.
// NO orchestration logic. NO external calls. NO database.

"use strict";

let seq = 0;

// Primary store: requestId -> request
const requests = new Map();

// Idempotency map: idempotencyKey -> requestId
const idempotency = new Map();

// Allowed lifecycle transitions (deterministic finite state machine)
const ALLOWED = Object.freeze({
  accepted: ["pending", "cancelled"],
  pending: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
});

function nowIso() {
  return new Date().toISOString();
}

function nextId() {
  seq += 1;
  return `req_${String(seq).padStart(6, "0")}`;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function ensureRequestExists(id) {
  const r = requests.get(id);
  if (!r) return null;
  return r;
}

/**
 * Create a request, optionally idempotent.
 * If idempotencyKey already exists, returns the existing request (no mutation).
 */
function createRequest({ input = null, idempotencyKey = null } = {}) {
  if (idempotencyKey) {
    const existingId = idempotency.get(String(idempotencyKey));
    if (existingId) {
      const existing = requests.get(existingId);
      if (existing) return clone(existing);
      // If somehow missing, fall through and recreate deterministically.
    }
  }

  const id = nextId();
  const t = nowIso();

  const req = {
    id,
    status: "accepted",
    createdAt: t,
    updatedAt: t,
    input, // stored as-is (can be object/string/null)
    history: [
      {
        from: "",
        to: "accepted",
        at: t,
      },
    ],
  };

  requests.set(id, req);

  if (idempotencyKey) {
    idempotency.set(String(idempotencyKey), id);
  }

  return clone(req);
}

function getRequest(id) {
  const r = ensureRequestExists(id);
  return r ? clone(r) : null;
}

function listRequests() {
  const arr = Array.from(requests.values()).map(clone);
  // Stable deterministic ordering: createdAt asc, then id asc
  arr.sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return arr;
}

function getHistory(id) {
  const r = ensureRequestExists(id);
  if (!r) return null;
  return clone(r.history || []);
}

function transitionRequest(id, to) {
  const r = ensureRequestExists(id);
  if (!r) return { ok: false, error: "not_found", id };

  const from = r.status;
  const allowed = ALLOWED[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      error: "invalid_transition",
      id,
      from,
      to,
      allowed,
    };
  }

  const t = nowIso();
  r.status = to;
  r.updatedAt = t;
  r.history.push({ from, to, at: t });

  requests.set(id, r);

  return { ok: true, request: clone(r) };
}

/**
 * Resolve an idempotency key (if you want to expose/inspect it later).
 * Not required by endpoints, but useful internally.
 */
function getRequestIdByIdempotencyKey(key) {
  if (!key) return null;
  return idempotency.get(String(key)) || null;
}

module.exports = {
  // core
  createRequest,
  getRequest,
  listRequests,

  // lifecycle + audit trail
  transitionRequest,
  getHistory,

  // idempotency utility
  getRequestIdByIdempotencyKey,
};
