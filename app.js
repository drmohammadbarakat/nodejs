const express = require('express');
const path = require('path');
const indexRouter = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;
console.log("DEPLOY_CHECK:", new Date().toISOString());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Use the router for handling routes
app.use('/', indexRouter);
app.get('/version', (req, res) => {
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA
              || process.env.GITHUB_SHA
              || 'no-sha';
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

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'orchestrator',
    commit: process.env.RAILWAY_GIT_COMMIT_SHA
            || process.env.GITHUB_SHA
            || 'no-sha',
    time: new Date().toISOString()
  });
});

// Catch-all route for handling 404 errors
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
  });

console.log("PORT_ENV =", process.env.PORT, "PORT_USED =", PORT);
console.log("DEPLOY_MARKER:", process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "no-sha");
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
