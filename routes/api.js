// routes/api.js — Step 12 (Persona Registry + Persona-Scoped Requests)

"use strict";

const express = require("express");
const router = express.Router();

const requestRegistry = require("../lib/requestRegistry");

/**
 * Step 12 — Deterministic Persona Registry (runtime-scoped, no DB yet)
 * Minimal first-class persona definitions (extend later).
 */
const PERSONAS = Object.freeze([
  Object.freeze({
    id: "pf_default",
    name: "PromptFactor Default",
    version: "1.0.0",
    riskProfile: "standard",
    description: "Baseline governed persona (neutral).",
  }),
]);

function getPersonaById(id) {
  return PERSONAS.find((p) => p.id === id) || null;
}

function isoNow() {
  return new Date().toISOString();
}

/**
 * Runtime-only index to support deterministic listing without requiring registry.list().
 * (Resets on restart — consistent with in-memory scope.)
 */
const createdIds = [];

/**
 * Step 12 — GET /api/personas
 * Deterministic persona registry listing.
 */
router.get("/personas", (req, res) => {
  return res.status(200).json({
    ok: true,
    count: PERSONAS.length,
    personas: PERSONAS,
  });
});

/**
 * Step 12 — GET /api/personas/:id
 * Deterministic persona retrieval.
 */
router.get("/personas/:id", (req, res) => {
  const persona = getPersonaById(req.params.id);

  if (!persona) {
    return res.status(404).json({
      ok: false,
      error: "not_found",
      id: req.params.id,
    });
  }

  return res.status(200).json({
    ok: true,
    persona,
  });
});

/**
 * POST /api/orchestrate
 * Now persona-scoped deterministically:
 * - Accepts optional personaId in JSON body.
 * - Defaults to "pf_default" if omitted.
 * - Rejects unknown personaId deterministically (400).
 */
router.post("/orchestrate", (req, res) => {
  const body = req && req.body ? req.body : null;

  const personaId =
    body && body.personaId ? String(body.personaId) : "pf_default";

  const persona = getPersonaById(personaId);
  if (!persona) {
    return res.status(400).json({
      ok: false,
      error: "invalid_persona",
      personaId,
      allowed: PERSONAS.map((p) => p.id),
    });
  }

  const stored = requestRegistry.createRequest(body);

  // Persona-scoping: persist personaId inside the stored request object (inspectable).
  stored.personaId = personaId;

  // Emit an audit-style event in the request timeline (append-only).
  if (!Array.isArray(stored.timeline)) stored.timeline = [];
  stored.timeline.push({
    from: null,
    to: "persona_bound",
    at: isoNow(),
    personaId,
  });

  // Track for listing deterministically
  if (!createdIds.includes(stored.id)) createdIds.push(stored.id);

  return res.status(202).json({
    ok: true,
    request: {
      id: stored.id,
      status: stored.status,
      personaId: stored.personaId,
    },
  });
});

/**
 * GET /api/requests
 * Deterministic listing of summaries in creation order.
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
      personaId: r.personaId || null,
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
 * POST /api/requests/:id/transition
 * Deterministic lifecycle transitions (from Step 10.2).
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  accepted: Object.freeze(["pending", "cancelled"]),
  pending: Object.freeze(["running", "cancelled"]),
  running: Object.freeze(["succeeded", "failed", "cancelled"]),
  succeeded: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

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

  const at = isoNow();
  found.status = to;

  if (!Array.isArray(found.timeline)) found.timeline = [];
  found.timeline.push({ from, to, at });

  return res.status(200).json({
    ok: true,
    request: {
      id: found.id,
      status: found.status,
      personaId: found.personaId || null,
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
