// app.js (FULL CLEAN DETERMINISTIC COPY — replace the entire file with this)

const express = require("express");
const path = require("path");

const indexRouter = require("./routes/index");
const apiRouter = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

// Deterministic boot marker (log only; does not affect API responses)
console.log("DEPLOY_CHECK:", new Date().toISOString());

// --- Core middleware (required for POST /api/orchestrate to accept JSON deterministically)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static assets
app.use(express.static(path.join(__dirname, "public")));

// --- Step 5 — PromptFactor API Skeleton (Shape Only)
app.use("/api", apiRouter);

// Homepage contract: / → routes/index.js → views/index.html
app.use("/", indexRouter);

/*
 * Step 4 — Human-Readable Identity Endpoint
 * GET /version (HTML)
 */
app.get("/version", (req, res) => {
  const commit =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.DEPLOY_MARKER ||
    "no-sha";

  const time = new Date().toISOString();

  res.status(200).send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Service Version</title>
      </head>
      <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 16px;">
        <h1 style="margin: 0 0 12px 0;">orchestrator</h1>
        <div><strong>commit:</strong> ${commit}</div>
        <div><strong>time:</strong> ${time}</div>
      </body>
    </html>
  `);
});

/*
 * Step 3 — Machine-Readable Runtime Identity Endpoint
 * GET /health (JSON)
 */
app.get("/health", (req, res) => {
  const commit =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.DEPLOY_MARKER ||
    "no-sha";

  res.status(200).json({
    ok: true,
    commit,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
