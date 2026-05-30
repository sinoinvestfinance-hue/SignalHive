/**
 * AXIOM DIGIT AI — Railway Server
 * Lightweight Express static file server with health checks,
 * security headers, gzip compression, and persistent uptime loop.
 */

'use strict';

const express    = require('express');
const path       = require('path');
const compression = require('compression');
const helmet     = require('helmet');
const cors       = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & Performance Middleware ───────────────
app.use(compression());
app.use(cors({ origin: '*' }));

// Helmet with relaxed CSP to allow Tailwind CDN + Google Fonts + Deriv WS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com"],
      connectSrc:     ["'self'", "wss://ws.binaryws.com", "wss://ws.derivws.com", "https://api.deriv.com"],
      imgSrc:         ["'self'", "data:", "blob:"],
      workerSrc:      ["'self'", "blob:"],
      manifestSrc:    ["'self'"],
      mediaSrc:       ["'self'"],
      frameSrc:       ["'none'"],
    }
  },
  hsts:               { maxAge: 31536000, includeSubDomains: true },
  noSniff:            true,
  xssFilter:         true,
  referrerPolicy:    { policy: 'strict-origin-when-cross-origin' }
}));

// Cache headers for static assets
app.use((req, res, next) => {
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf)$/)) {
    res.set('Cache-Control', 'public, max-age=86400');
  } else if (req.path === '/service-worker.js') {
    res.set('Cache-Control', 'no-cache');
    res.set('Service-Worker-Allowed', '/');
  } else if (req.path === '/manifest.json') {
    res.set('Cache-Control', 'public, max-age=3600');
  } else {
    res.set('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});

// ── Static Files ─────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  etag: true,
  lastModified: true,
}));

// ── Health Check (Railway requirement) ───────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    app:     'axiom-digit-ai',
    version: '2.0.0',
    uptime:  Math.floor(process.uptime()),
    memory:  process.memoryUsage(),
    ts:      new Date().toISOString(),
  });
});

// ── Status endpoint ───────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    online:  true,
    server:  'Railway',
    env:     process.env.NODE_ENV || 'production',
    port:    PORT,
    node:    process.version,
    ts:      Date.now(),
  });
});

// ── SPA Fallback ─────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start Server ─────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║      AXIOM DIGIT AI — ONLINE             ║
  ║  Port : ${PORT}                              ║
  ║  Mode : ${process.env.NODE_ENV || 'production'}                      ║
  ║  Node : ${process.version}                           ║
  ╚══════════════════════════════════════════╝
  `);
});

// Keep-alive / Railway uptime ping
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 min
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`[KEEPALIVE] uptime=${Math.floor(process.uptime())}s mem=${Math.round(mem.rss/1024/1024)}MB`);
}, KEEP_ALIVE_INTERVAL);

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] ${signal} received — closing server...`);
  server.close(() => {
    console.log('[SHUTDOWN] Server closed. Exiting.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Crash guard
process.on('uncaughtException', err => {
  console.error('[CRASH GUARD] uncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH GUARD] unhandledRejection:', reason);
});
