// lib/requestRegistry.js
// PromptFactor Phase 3 Gate 1 — SQL-backed Request Store (BOOT-SAFE)
// Scope: Requests ONLY (Runs/Artifacts/AuditLog are out of scope)
//
// Requirements satisfied:
// - Requests persist across redeploy/restart (SQL-backed)
// - Idempotency persists (idempotency_key stored)
// - History persists (history_json stored)
// - Boot-safe: ensure DB directory exists BEFORE opening database
//
// NOTE: No changes to routes/API contracts in this step.

"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// ---------- Deterministic lifecycle transitions ----------
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

// ---------- Boot-safe DB initialization ----------
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "promptfactor.db");

// Ensure directory exists (prevents SQLITE_CANTOPEN on Railway)
fs.mkdirSync(DATA_DIR, { recursive: true });

// Open DB (synchronous, deterministic)
const db = new Database(DB_PATH);

// Ensure schema exists (defensive; canonical schema is in db/schema.sql)
db.exec(`
CREATE TABLE IF NOT EXISTS requests (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL,
  persona_id      TEXT NULL,
  input_json      TEXT NOT NULL,
  output_json     TEXT NULL,
  error_json      TEXT NULL,
  history_json    TEXT NOT NULL,
  idempotency_key TEXT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);

-- Deterministic sequence store (so IDs remain stable across restarts)
CREATE TABLE IF NOT EXISTS pf_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Prepared statements (deterministic)
const stmtGetById = db.prepare(`SELECT * FROM requests WHERE id = ?`);
const stmtGetByIdem = db.prepare(`SELECT * FROM requests WHERE idempotency_key = ?`);

const stmtInsert = db.prepare(`
  INSERT INTO requests
  (id, status, persona_id, input_json, output_json, error_json, history_json, idempotency_key, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const stmtUpdateStatusHistory = db.prepare(`
  UPDATE requests
  SET status = ?, history_json = ?, updated_at = ?
  WHERE id = ?
`);

const stmtList = db.prepare(`
  SELECT * FROM requests
  ORDER BY created_at ASC, id ASC
`);

const stmtGetMeta = db.prepare(`SELECT value FROM pf_meta WHERE key = ?`);
const stmtUpsertMeta = db.prepare(`
  INSERT INTO pf_meta (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

// Deterministic ID generator: req_000001, req_000002, ...
const nextIdTx = db.transaction(() => {
  const row = stmtGetMeta.get("request_seq");
  const current = row ? parseInt(row.value, 10) : 0;
  const next = current + 1;
  stmtUpsertMeta.run("request_seq", String(next));
  return `req_${String(next).padStart(6, "0")}`;
});

function hydrate(row) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    input: JSON.parse(row.input_json),
    history: JSON.parse(row.history_json),
  };
}

/**
 * Create a request, optionally idempotent.
 * If idempotencyKey already exists, returns the existing request (no mutation).
 */
function createRequest({ input = null, idempotencyKey = null } = {}) {
  if (idempotencyKey) {
    const existing = stmtGetByIdem.get(String(idempotencyKey));
    if (existing) return hydrate(existing);
  }

  const id = nextIdTx();
  const t = nowIso();

  const req = {
    id,
    status: "accepted",
    createdAt: t,
    updatedAt: t,
    input,
    history: [{ from: "", to: "accepted", at: t }],
  };

  stmtInsert.run(
    req.id,
    req.status,
    null, // persona_id reserved for later gates (routes store personaId inside input deterministically today)
    JSON.stringify(req.input),
    null,
    null,
    JSON.stringify(req.history),
    idempotencyKey ? String(idempotencyKey) : null,
    req.createdAt,
    req.updatedAt
  );

  return clone(req);
}

function getRequest(id) {
  const row = stmtGetById.get(id);
  return row ? clone(hydrate(row)) : null;
}

function listRequests() {
  const rows = stmtList.all();
  return rows.map((r) => clone(hydrate(r)));
}

function getHistory(id) {
  const row = db
    .prepare(`SELECT history_json FROM requests WHERE id = ?`)
    .get(id);
  return row ? JSON.parse(row.history_json) : null;
}

function transitionRequest(id, to) {
  const row = stmtGetById.get(id);
  if (!row) return { ok: false, error: "not_found", id };

  const from = row.status;
  const allowed = ALLOWED[from] || [];
  if (!allowed.includes(to)) {
    return { ok: false, error: "invalid_transition", id, from, to, allowed };
  }

  const history = JSON.parse(row.history_json);
  const t = nowIso();
  history.push({ from, to, at: t });

  stmtUpdateStatusHistory.run(to, JSON.stringify(history), t, id);

  return { ok: true, request: getRequest(id) };
}

/**
 * Resolve an idempotency key (if you want to expose/inspect it later).
 * Not required by endpoints, but useful internally.
 */
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
