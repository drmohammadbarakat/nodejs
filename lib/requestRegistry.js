// lib/requestRegistry.js
// Deterministic in-memory Request registry (NO orchestration logic)

let counter = 0;

// id -> request
const store = new Map();

// Deterministic request IDs: req_000001, req_000002, ...
function nextId() {
  counter += 1;
  return "req_" + String(counter).padStart(6, "0");
}

function createRequest(input) {
  const id = nextId();
  const now = new Date().toISOString();

  const request = {
    id,
    status: "accepted",
    createdAt: now,
    updatedAt: now,
    input: input ?? {},
    // Optional fields reserved for later steps (kept empty/deterministic)
    lifecycle: "",
    timeline: [],
    output: null,
    error: null,
    history: [{ from: "", to: "accepted", at: now }],
  };

  store.set(id, request);
  return request;
}

function getRequest(id) {
  return store.get(id) || null;
}

// Deterministic list: stable ordering by createdAt then id
function listRequests() {
  return Array.from(store.values()).sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    return a.id.localeCompare(b.id);
  });
}

function appendHistory(id, event) {
  const req = store.get(id);
  if (!req) return null;

  const at = new Date().toISOString();
  const safeEvent = {
    from: event?.from ?? "",
    to: event?.to ?? "",
    at: event?.at ?? at,
  };

  req.history = Array.isArray(req.history) ? req.history : [];
  req.history.push(safeEvent);
  req.updatedAt = at;

  store.set(id, req);
  return req;
}

function getHistory(id) {
  const req = store.get(id);
  if (!req) return null;
  return Array.isArray(req.history) ? req.history : [];
}

module.exports = {
  createRequest,
  getRequest,
  listRequests,
  appendHistory,
  getHistory,
};
