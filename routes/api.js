// routes/api.js — Step 8 (Inspectable Request History Endpoint)

"use strict";

const express = require("express");
const router = express.Router();

const requestRegistry = require("../lib/requestRegistry");

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
 /*
 * Step 9 — Request Listing (Deterministic)
 * GET /api/requests
 */
router.get("/requests", (req, res) => {
  const requests = requestRegistry.listRequests();

  // Return summaries only (shape locked; avoids leaking full payload later)
  const summaries = requests.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  res.status(200).json({
    ok: true,
    count: summaries.length,
    requests: summaries,
  });
});

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
 * Step 8 — GET /api/requests/:id/history
 * Inspectable request history (append-only audit-style event list).
 *
 * Contract:
 * - 404 if request not found
 * - 200 with { ok: true, id, history: [...] }
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
 * GET /api/health aliases /health
 */
router.get("/health", (req, res) => {
  return res.redirect(302, "/health");
});

module.exports = router;
