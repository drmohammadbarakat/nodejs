/**
 * PromptFactor API Skeleton (Shape Only, No Intelligence Yet)
 *
 * Required endpoints:
 *   POST /api/orchestrate
 *   GET  /api/requests/:id
 *   GET  /api/health   (alias wrapper)
 *
 * Deterministic placeholders only.
 */

const express = require("express");
const router = express.Router();

/**
 * In-memory deterministic placeholder store.
 * Not durable. No intelligence. No execution.
 */
const requestsById = new Map();
let nextRequestId = 1;

/**
 * POST /api/orchestrate
 *
 * Deterministic placeholder:
 * - Accepts any JSON body
 * - Creates a request record
 * - Returns status=accepted only
 */
router.post("/orchestrate", (req, res) => {
  const id = String(nextRequestId++);

  const record = {
    id,
    status: "accepted",
    input: req.body || null,
    output: null,
    error: null,
    runs: [],
    artifacts: [],
  };

  requestsById.set(id, record);

  return res.status(202).json({
    ok: true,
    request: record,
  });
});

/**
 * GET /api/requests/:id
 *
 * Deterministic placeholder:
 * - Returns stored request record if present
 * - Returns 404 if missing
 */
router.get("/requests/:id", (req, res) => {
  const id = String(req.params.id);

  if (!requestsById.has(id)) {
    return res.status(404).json({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Request not found",
        requestId: id,
      },
    });
  }

  return res.status(200).json({
    ok: true,
    request: requestsById.get(id),
  });
});

/**
 * GET /api/health
 *
 * Alias wrapper:
 * - Forwards directly to the existing /health endpoint
 * - Does not redefine semantics
 */
router.get("/health", (req, res) => {
  req.url = "/health";
  req.app.handle(req, res);
});

module.exports = router;

