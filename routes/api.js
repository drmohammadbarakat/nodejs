// routes/api.js — Step 9 (Deterministic Request Listing)

"use strict";

const express = require("express");
const router = express.Router();

const requestRegistry = require("../lib/requestRegistry");

/**
 * Step 9 — Deterministic in-memory index for listing.
 * Stores IDs in creation order for the current runtime only.
 * (No database; resets on restart — consistent with in-memory scope.)
 */
const createdIds = [];

/**
 * POST /api/orchestrate
 * Shape-only response; persists request deterministically.
 */
router.post("/orchestrate", (req, res) => {
  const stored = requestRegistry.createRequest(req.body);

  // Record ID for deterministic listing (creation order).
  // Avoid duplicates defensively.
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
 * Deterministic listing of request summaries in creation order.
 */
router.get("/requests", (req, res) => {
  const summaries = [];

  for (const id of createdIds) {
    const r = requestRegistry.getRequest(id);
    if (!r) continue; // if missing (restart/eviction), skip deterministically

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
 * GET /api/health aliases /health
 */
router.get("/health", (req, res) => {
  return res.redirect(302, "/health");
});

module.exports = router;
