// routes/api.js — Step 10.2 (Deterministic State Transitions; Routes Only)

"use strict";

const express = require("express");
const router = express.Router();

const requestRegistry = require("../lib/requestRegistry");

/**
 * Deterministic transition rules (canonical lifecycle)
 * accepted → pending → running → (succeeded | failed | cancelled)
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  accepted: Object.freeze(["pending", "cancelled"]),
  pending: Object.freeze(["running", "cancelled"]),
  running: Object.freeze(["succeeded", "failed", "cancelled"]),
  succeeded: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

function isoNow() {
  return new Date().toISOString();
}

/**
 * POST /api/orchestrate
 * Shape-only response; persists request deterministically.
 */
router.post("/orchestrate", (req, res) => {
  const stored = requestRegistry.createRequest(req.body);

  return res.status(202).json({
    ok: true,
    request: {
      id: stored.id,
      status: stored.status,
    },
  });
});

/**
 * GET /api/requests
 * Deterministic listing. (Runtime-scoped; depends on the in-memory store.)
 *
 * NOTE: We do not assume registry provides list(), so we keep the listing
 * based on IDs observed in this router runtime.
 */
const createdIds = []; // runtime-only index for listing (deterministic within process)

router.post("/orchestrate", (req, res) => {
  const stored = requestRegistry.createRequest(req.body);

  if (!createdIds.includes(stored.id)) {
    createdIds.push(stored.id);
  }

  return res.status(202).json({
    ok: true,
    request: {
      id: stored.id,
      status: stored.status,
    },
  });
});

/**
 * Step 9 — GET /api/requests
 */
router.get("/requests", (req, res) => {
  const summaries = [];

  for (const id of createdIds) {
    const r = requestRegistry.getRequest(id);
    if (!r) continue;

    summaries.push({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
    });
  }

  return res.status(200).json({
    ok: true,
    count: summaries.length,
    requests: summaries,
  });
});

/**
 * GET /api/requests/:id
 * Retrieves stored request record.
 */
router.get("/requests/:id", (req, res) => {
  const found = requestRegistry.getRequest(req.params.id);

  if (!found) {
    return res.status(404).json({
      ok: false,
      error: "not_found",
      id: req.params.id,
    });
  }

  return res.status(200).json({
    ok: true,
    request: found,
  });
});

/**
 * GET /api/requests/:id/history
 * Inspectable request history (timeline).
 */
router.get("/requests/:id/history", (req, res) => {
  const found = requestRegistry.getRequest(req.params.id);

  if (!found) {
    return res.status(404).json({
      ok: false,
      error: "not_found",
      id: req.params.id,
    });
  }

  return res.status(200).json({
    ok: true,
    id: found.id,
    history: Array.isArray(found.timeline) ? found.timeline : [],
  });
});

/**
 * Step 10.2 — POST /api/requests/:id/transition
 * Body: { "to": "pending" | "running" | "succeeded" | "failed" | "cancelled" }
 *
 * Deterministic:
 * - validates allowed transitions
 * - appends transition event to timeline
 */
router.post("/requests/:id/transition", (req, res) => {
  const found = requestRegistry.getRequest(req.params.id);

  if (!found) {
    return res.status(404).json({
      ok: false,
      error: "not_found",
      id: req.params.id,
    });
  }

  const to = req && req.body && req.body.to ? String(req.body.to) : "";
  if (!to) {
    return res.status(400).json({
      ok: false,
      error: "missing_to",
      hint: 'Provide JSON body: {"to":"pending"}',
    });
  }

  const from = String(found.status || "");
  const allowed = ALLOWED_TRANSITIONS[from] || [];

  if (!allowed.includes(to)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_transition",
      id: found.id,
      from,
      to,
      allowed,
    });
  }

  // Apply transition (in-memory), append timeline entry
  const at = isoNow();
  found.status = to;

  // Ensure timeline exists
  if (!Array.isArray(found.timeline)) {
    found.timeline = [];
  }

  found.timeline.push({
    from,
    to,
    at,
  });

  return res.status(200).json({
    ok: true,
    request: {
      id: found.id,
      status: found.status,
    },
  });
});

/**
 * GET /api/health aliases /health
 */
router.get("/health", (req, res) => {
  return res.redirect(302, "/health");
});

module.exports = router;
