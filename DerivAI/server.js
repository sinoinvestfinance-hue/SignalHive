/**
 * DerivAI Terminal — Express Server
 * Serves the PWA with proper headers for Railway deployment
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const compression = require('compression');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/* =================== MIDDLEWARE =================== */

// Compression (gzip)
app.use(compression());

// Security headers (relaxed for PWA + WebSocket)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'"],
        styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'wss://ws.binaryws.com', 'https://ws.binaryws.com'],
        imgSrc:     ["'self'", 'data:', 'blob:'],
        workerSrc:  ["'self'", 'blob:'],
        manifestSrc:["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS
app.use(cors({ origin: '*' }));

// Logging
app.use(morgan('combined'));

// Parse JSON
app.use(express.json());

/* =================== HEADERS FOR PWA =================== */
app.use((req, res, next) => {
  // Service worker scope
  res.setHeader('Service-Worker-Allowed', '/');

  // Cache static assets aggressively, HTML not at all
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (req.path.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
});

/* =================== STATIC FILES =================== */
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  etag: true,
  lastModified: true,
}));

/* =================== API ROUTES =================== */

// Health check — Railway uses this for liveness
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    app:     'DerivAI Terminal',
    version: '1.0.0',
    uptime:  Math.floor(process.uptime()),
    memory:  process.memoryUsage(),
    time:    new Date().toISOString(),
  });
});

// System info
app.get('/api/info', (req, res) => {
  res.json({
    name:        'DerivAI Terminal',
    version:     '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    port:        PORT,
    node:        process.version,
    platform:    process.platform,
  });
});

/* =================== SPA FALLBACK =================== */
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('DerivAI Terminal — index.html not found');
  }
});

/* =================== ERROR HANDLER =================== */
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* =================== START =================== */
const server = app.listen(PORT, HOST, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   DerivAI Terminal — Railway Server   ║
  ║   Running: http://${HOST}:${PORT}      ║
  ║   Health:  /health                    ║
  ╚═══════════════════════════════════════╝
  `);
});

/* =================== GRACEFUL SHUTDOWN =================== */
const shutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => { console.error('[Server] Force shutdown'); process.exit(1); }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
