diff --git a/lib/requestRegistry.js b/lib/requestRegistry.js
index 1111111..2222222 100644
--- a/lib/requestRegistry.js
+++ b/lib/requestRegistry.js
@@ -1,999 +1,999 @@
+// lib/requestRegistry.js
+// Deterministic in-memory Request Registry (no orchestration logic)
+
+let seq = 0;
+const store = new Map(); // id -> request object
+
+function nextId() {
+  seq += 1;
+  return `req_${String(seq).padStart(6, "0")}`;
+}
+
+function nowIso() {
+  return new Date().toISOString();
+}
+
+function clone(obj) {
+  return JSON.parse(JSON.stringify(obj));
+}
+
+// Canonical lifecycle:
+// accepted → pending → running → (succeeded | failed | cancelled)
+const ALLOWED_TRANSITIONS = Object.freeze({
+  accepted: ["pending", "cancelled"],
+  pending: ["running", "cancelled"],
+  running: ["succeeded", "failed", "cancelled"],
+  succeeded: [],
+  failed: [],
+  cancelled: [],
+});
+
+function createRequest(input) {
+  const id = nextId();
+  const createdAt = nowIso();
+
+  const req = {
+    id,
+    status: "accepted",
+    createdAt,
+    updatedAt: createdAt,
+    // NOTE: input is stored for determinism/inspectability (shape only; no intelligence)
+    input: input ?? null,
+    history: [
+      {
+        from: "",
+        to: "accepted",
+        at: createdAt,
+      },
+    ],
+  };
+
+  store.set(id, req);
+  return clone(req);
+}
+
+function getRequest(id) {
+  const req = store.get(id);
+  return req ? clone(req) : null;
+}
+
+function listRequests() {
+  // Deterministic ordering by createdAt asc (then id asc)
+  return Array.from(store.values())
+    .slice()
+    .sort((a, b) => {
+      if (a.createdAt < b.createdAt) return -1;
+      if (a.createdAt > b.createdAt) return 1;
+      return a.id.localeCompare(b.id);
+    })
+    .map(clone);
+}
+
+function getHistory(id) {
+  const req = store.get(id);
+  return req ? clone(req.history || []) : null;
+}
+
+function transitionStatus(id, toStatus) {
+  const req = store.get(id);
+  if (!req) return { ok: false, error: "not_found", id };
+
+  const fromStatus = req.status;
+  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
+
+  if (!allowed.includes(toStatus)) {
+    return {
+      ok: false,
+      error: "invalid_transition",
+      id,
+      from: fromStatus,
+      to: toStatus,
+      allowed,
+    };
+  }
+
+  const at = nowIso();
+  req.status = toStatus;
+  req.updatedAt = at;
+  req.history = req.history || [];
+  req.history.push({ from: fromStatus, to: toStatus, at });
+
+  store.set(id, req);
+  return { ok: true, request: clone(req) };
+}
+
+module.exports = {
+  createRequest,
+  getRequest,
+  listRequests,
+  getHistory,
+  transitionStatus,
+};
diff --git a/routes/api.js b/routes/api.js
index 3333333..4444444 100644
--- a/routes/api.js
+++ b/routes/api.js
@@ -1,999 +1,999 @@
 const express = require("express");
 const router = express.Router();
 
 const requestRegistry = require("../lib/requestRegistry");
 
 // Step 5/6/9: create request (shape only)
 router.post("/orchestrate", (req, res) => {
   const created = requestRegistry.createRequest(req.body || null);
 
   // Deterministic response shape
   return res.status(200).json({
     ok: true,
     request: {
       id: created.id,
       status: created.status,
       createdAt: created.createdAt,
       input: created.input,
     },
   });
 });
 
 // Step 6: retrieve request by id
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
     request: {
       id: found.id,
       status: found.status,
       createdAt: found.createdAt,
       updatedAt: found.updatedAt,
       input: found.input,
     },
   });
 });
 
 // Step 9: list requests
 router.get("/requests", (req, res) => {
   const all = requestRegistry.listRequests();
   return res.status(200).json({
     ok: true,
     count: all.length,
     requests: all.map((r) => ({
       id: r.id,
       status: r.status,
       createdAt: r.createdAt,
       updatedAt: r.updatedAt,
     })),
   });
 });
 
 // Step 9: request history
 router.get("/requests/:id/history", (req, res) => {
   const history = requestRegistry.getHistory(req.params.id);
   if (history === null) {
     return res.status(404).json({
       ok: false,
       error: "not_found",
       id: req.params.id,
     });
   }
 
   return res.status(200).json({
     ok: true,
     id: req.params.id,
     history,
   });
 });
 
+// Step 10: deterministic state transition endpoint
+// POST /api/requests/:id/transition  body: { "to": "pending" | "running" | "succeeded" | "failed" | "cancelled" }
+router.post("/requests/:id/transition", (req, res) => {
+  const to = (req.body && req.body.to) ? String(req.body.to) : "";
+  if (!to) {
+    return res.status(400).json({
+      ok: false,
+      error: "missing_to",
+      hint: 'Provide JSON body: {"to":"pending"}',
+    });
+  }
+
+  const result = requestRegistry.transitionStatus(req.params.id, to);
+
+  if (!result.ok && result.error === "not_found") {
+    return res.status(404).json({
+      ok: false,
+      error: "not_found",
+      id: req.params.id,
+    });
+  }
+
+  if (!result.ok && result.error === "invalid_transition") {
+    return res.status(400).json({
+      ok: false,
+      error: "invalid_transition",
+      id: result.id,
+      from: result.from,
+      to: result.to,
+      allowed: result.allowed,
+    });
+  }
+
+  return res.status(200).json({
+    ok: true,
+    request: {
+      id: result.request.id,
+      status: result.request.status,
+      createdAt: result.request.createdAt,
+      updatedAt: result.request.updatedAt,
+    },
+  });
+});
+
 // Alias /api/health -> /health (Step 5)
 router.get("/health", (req, res) => {
   return res.redirect(302, "/health");
 });
 
 module.exports = router;
