-- PromptFactor — Phase 3 Gate 1 (Persistent Request Store)
-- Scope: Requests ONLY (Runs/Artifacts/AuditLog are out of scope for Gate 1)

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

-- Optional index to support listing (most-recent-first)
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);

-- NOTE:
-- Workspace isolation / RBAC is Phase 3 later gates. Do NOT add workspace enforcement here yet.
-- If/when workspace_id is introduced later, idempotency uniqueness should become:
-- UNIQUE(workspace_id, idempotency_key)
