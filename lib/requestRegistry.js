// lib/requestRegistry.js
// PromptFactor Phase 3 Gate 1 — SQL-backed Request Store
// Scope: Requests ONLY (Runs/Artifacts/AuditLog are out of scope)

"use strict";

const path = require("path");
const Database = require("better-sqlite3");

// --- DB INITIALIZATION (BOOT-SAFE) ---

const DB_PATH = path.join(__dirname, "..", "data", "promptfactor.db");
const db = new Database(DB_PATH);

// Ensure table exists (schema already committed, this is defensive)
db.exec(`
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  persona_id TEXT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT NULL,
  error_json TEXT NULL,
  history_json TEXT NOT NULL,
  idempotency_key TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

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

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// --- CORE OPERATIONS ---

function createRequest({ input = null, idempotencyKey = null } = {}) {
  if (idempotencyKey) {
    const existing = db
      .prepare(`SELECT * FROM requests WHERE idempotency_key = ?`)
      .get(String(idempotencyKey));
    if (existing) {
      return hydrate(existing);
    }
  }

  const id = `req_${Date.now()}`;
  const t = nowIso();

  const req = {
    id,
    status: "accepted",
    persona_id: null,
    input,
    output: null,
    error: null,
    history: [{ from: "", to: "accepted", at: t }],
    idempotency_key: idempotencyKey ? String(idempotencyKey) : null,
    createdAt: t,
    updatedAt: t,
  };

  db.prepare(`
    INSERT INTO requests
    (id, status, persona_id, input_json, output_json, error_json, history_json, idempotency_key, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.id,
    req.status,
    req.persona_id,
    JSON.stringify(req.input),
    null,
    null,
    JSON.stringify(req.history),
    req.idempotency_key,
    req.createdAt,
    req.updatedAt
  );

  return clone(req);
}

function getRequest(id) {
  const row = db.prepare(`SELECT * FROM requests WHERE id = ?`).get(id);
  return row ? hydrate(row) : null;
}

function listRequests() {
  const rows = db
    .prepare(`SELECT * FROM requests ORDER BY created_at ASC, id ASC`)
    .all();
  return rows.map(hydrate);
}

function getHistory(id) {
  const row = db
    .prepare(`SELECT history_json FROM requests WHERE id = ?`)
    .get(id);
  return row ? JSON.parse(row.history_json) : null;
}

function transitionRequest(id, to) {
  const row = db.prepare(`SELECT * FROM requests WHERE id = ?`).get(id);
  if (!row) return { ok: false, error: "not_found", id };

  const from = row.status;
  const allowed = ALLOWED[from] || [];
  if (!allowed.includes(to)) {
    return { ok: false, error: "invalid_transition", id, from, to, allowed };
  }

  const history = JSON.parse(row.history_json);
  const t = nowIso();

  history.push({ from, to, at: t });

  db.prepare(`
    UPDATE requests
    SET status = ?, history_json = ?, updated_at = ?
    WHERE id = ?
  `).run(to, JSON.stringify(history), t, id);

  return { ok: true, request: getRequest(id) };
}

// --- UTILITIES ---

function hydrate(row) {
  return {
    id: row.id,
    status: row.status,
    persona_id: row.persona_id,
    input: JSON.parse(row.input_json),
    output: row.output_json ? JSON.parse(row.output_json) : null,
    error: row.error_json ? JSON.parse(row.error_json) : null,
    history: JSON.parse(row.history_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRequestIdByIdempotencyKey(key) {
  if (!key) return null;
  const row = db
    .prepare(`SELECT id FROM requests WHERE idempotency_key = ?`)
    .get(String(key));
  return row ? row.id : null;
}

module.exports = {
  createRequest,
  getRequest,
  listRequests,
  transitionRequest,
  getHistory,
  getRequestIdByIdempotencyKey,
};
