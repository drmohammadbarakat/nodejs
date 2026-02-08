// routes/api.js — Step 8 (Stable)

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
 * GET /api/health aliases /health
 */
router.get("/health", (req, res) => {
  return res.redirect(302, "/health");
});

module.exports = router;
