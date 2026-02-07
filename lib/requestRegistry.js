"use strict";

/**
 * Step 6 — In-memory Request Registry (Deterministic Store)
 *
 * Rules:
 * - Registry is isolated: NO orchestration logic here.
 * - Stores request objects created by POST /api/orchestrate.
 * - Retrieves stored request objects for GET /api/requests/:id.
 * - Deterministic ID generation within runtime (monotonic counter).
 */

const _requests = new Map();
let _seq = 0;

function _nextId() {
  _seq += 1;
  return `req_${String(_seq).padStart(6, "0")}`;
}

function createRequest(input) {
  const id = _nextId();

  const record = {
    id,
    status: "accepted",
    createdAt: new Date().toISOString(),
    input: input ?? null,
  };

  _requests.set(id, record);
  return record;
}

function getRequest(id) {
  return _requests.get(id) ?? null;
}

module.exports = {
  createRequest,
  getRequest,
};
