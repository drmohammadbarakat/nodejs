// routes/api.js — Step 12 FIX (Persona Registry + Persona-Scoped Requests + History)

"use strict";

const express = require("express");
const router = express.Router();

const requestRegistry = require("../lib/requestRegistry");

/**
 * Step 12 — Deterministic Persona Registry (runtime-scoped, no DB yet)
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

/**
 * Deterministic listing index (runtime-only).
 */
const createdIds = [];

/**
 * Step 12 — GET /api/personas
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
 * POST /api/orchestrate (persona-scoped + idempotency-safe)
 *
 * IMPORTANT:
 * requestRegistry.createRequest() (Step 11) expects { input, idempotencyKey }.
 * If we pass the raw body directly, input becomes null.
 */
router.post("/orchestrate", (req, res) => {
  const body = req && req.body ? req.body : {};

  const personaId = body.personaId ? String(body.personaId) : "pf_default";
  const persona = getPersonaById(personaId);

  if (!persona) {
    return res.status(400).json({
      ok: false,
      error: "invalid_persona",
      personaId,
      allowed: PERSONAS.map((p) => p.id),
    });
  }

  // Idempotency key (optional)
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : null;

  // Store personaId inside input deterministically (since registry returns clones).
  const input = { ...body, personaId };

  const stored = requestRegistry.createRequest({
    input,
    idempotencyKey,
  });

  if (!createdIds.includes(stored.id)) createdIds.push(stored.id);

  return res.status(202).json({
    ok: true,
    request: {
      id: stored.id,
      status: stored.status,
      personaId,
    },
  });
});

/**
 * GET /api/requests (summaries)
 */
router.get("/requests", (req, res) => {
  const summaries = [];

  for (const id of createdIds) {
    const r = requestRegistry.getRequest(id);
    if (!r) continue;

    const personaId =
      r.input && r.input.personaId ? String(r.input.personaId) : null;

    summaries.push({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      personaId,
    });
  }

  return res.status(200).json({
    ok: true,
    count: summaries.length,
    requests: summaries,
  });
});

/**
 * GET /api/requests/:id (full record)
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

  // Ensure personaId is inspectable (derived deterministically from stored input)
  const personaId =
    found.input && found.input.personaId ? String(found.input.personaId) : null;

  return res.status(200).json({
    ok: true,
    request: {
      ...found,
      personaId,
    },
  });
});

/**
 * GET /api/requests/:id/history
 *
 * Registry stores lifecycle history as "history".
 * Step 12 requires an inspectable "persona_bound" event.
 *
 * We return:
 * - the registry history events
 * - plus a deterministic persona_bound event if personaId exists
 *   (placed immediately after the accepted event)
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

  const base = requestRegistry.getHistory(found.id);
  if (base === null) {
    return res.status(404).json({
      ok: false,
      error: "not_found",
      id: found.id,
    });
  }

  const personaId =
    found.input && found.input.personaId ? String(found.input.personaId) : null;

  // Deterministic persona-bound event time: use createdAt
  const personaEvent = personaId
    ? {
        from: null,
        to: "persona_bound",
        at: found.createdAt,
        personaId,
      }
    : null;

  let history = Array.isArray(base) ? base.slice() : [];

  // Insert persona event once, right after the initial accepted event
  if (personaEvent) {
    const already = history.some((e) => e && e.to === "persona_bound");
    if (!already) {
      if (history.length >= 1) {
        history.splice(1, 0, personaEvent);
      } else {
        history.push(personaEvent);
      }
    }
  }

  return res.status(200).json({
    ok: true,
    id: found.id,
    history,
  });
});

/**
 * POST /api/requests/:id/transition
 * Use registry transition (persisted deterministically + adds to history).
 */
router.post("/requests/:id/transition", (req, res) => {
  const to = req && req.body && req.body.to ? String(req.body.to) : "";

  if (!to) {
    return res.status(400).json({
      ok: false,
      error: "missing_to",
      hint: 'Provide JSON body: {"to":"pending"}',
    });
  }

  const result = requestRegistry.transitionRequest(req.params.id, to);

  if (!result.ok && result.error === "not_found") {
    return res.status(404).json({
      ok: false,
      error: "not_found",
      id: req.params.id,
    });
  }

  if (!result.ok && result.error === "invalid_transition") {
    return res.status(400).json({
      ok: false,
      error: "invalid_transition",
      id: result.id,
      from: result.from,
      to: result.to,
      allowed: result.allowed,
    });
  }

  // Expose personaId deterministically
  const personaId =
    result.request.input && result.request.input.personaId
      ? String(result.request.input.personaId)
      : null;

  return res.status(200).json({
    ok: true,
    request: {
      id: result.request.id,
      status: result.request.status,
      personaId,
    },
  });
});

/**
 * GET /api/health aliases /health
 */
router.get("/health", (req, res) => {
  return res.redirect(302, "/health");
});

/**
 * STEP 13 — Request Dry-Run Validation (Pre-Execution Gate)
 * Contract: POST /api/requests/dry-run
 * - Validates request shape without creating/mutating a Request
 * - Deterministic response (valid/checks/warnings/errors)
 * - No side effects (no registry/history writes)
 */
router.post("/requests/dry-run", (req, res) => {
  const personaId = req && req.body && req.body.personaId ? String(req.body.personaId) : null;
  const hasInput = req && req.body && Object.prototype.hasOwnProperty.call(req.body, "input");

  const checks = [];
  const warnings = [];
  const errors = [];

  // Contract: personaId required
  if (!personaId) {
    checks.push({ check: "persona_id_present", status: "fail" });
    errors.push("persona_id_required");
  } else {
    checks.push({ check: "persona_id_present", status: "pass" });
  }

  // Contract: input required (opaque)
  if (!hasInput) {
    checks.push({ check: "input_present", status: "fail" });
    errors.push("input_required");
  } else {
    checks.push({ check: "input_present", status: "pass" });
  }

  // Contract: persona must exist — use the deterministic registry in THIS file
  if (personaId) {
    const persona = getPersonaById(personaId);
    const personaExists = Boolean(persona);

    checks.push({ check: "persona_exists", status: personaExists ? "pass" : "fail" });
    if (!personaExists) errors.push("persona_not_found");
  }

  const valid = errors.length === 0;

  return res.status(valid ? 200 : 400).json({
    ok: valid,
    valid,
    personaId,
    checks,
    warnings,
    errors,
  });
});

module.exports = router;
