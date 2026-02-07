// routes/api.js — Step 6 (Deterministic Request Persistence via Registry)

"use strict";

const express = require("express");
const router = express.Router();

const requestRegistry = require("../lib/requestRegistry");

/**
 * Step 5/6 — POST /api/orchestrate
 * Shape-only response, but now persists deterministically in a shared registry.
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
 * Step 5/6 — GET /api/requests/:id
 * Retrieves the stored request from the shared registry.
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
 * Step 5 — GET /api/health aliases /health
 */
router.get("/health", (req, res) => {
  // Redirect preserves existing Step 5 semantics without duplicating logic.
  return res.redirect(302, "/health");
});

module.exports = router;
