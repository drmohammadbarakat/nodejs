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
      i
