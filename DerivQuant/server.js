/**
 * DerivAI Pro — Railway Server
 * Express static file server with health checks & WebSocket proxy support
 */
'use strict';

require('dotenv').config();
const express    = require('express');
const compression = require('compression');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const path       = require('path');
const http       = require('http');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/* ─── MIDDLEWARE ─── */
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(morgan('combined'));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
        styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        fontSrc:     ["'self'", "https://fonts.gstatic.com"],
        connectSrc:  ["'self'", "wss://ws.binaryws.com", "wss://green.binaryws.com", "https://api.deriv.com"],
        imgSrc:      ["'self'", "data:", "blob:"],
        workerSrc:   ["'self'", "blob:"],
        frameSrc:    ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

/* ─── STATIC FILES ─── */
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
    if (filePath.endsWith('manifest.json')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
  }
}));

/* ─── HEALTH CHECK ─── */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'DerivAI Pro',
    version: '3.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

/* ─── STATUS ─── */
app.get('/status', (req, res) => {
  res.json({
    name: 'DerivAI Pro Quantum Trading Terminal',
    running: true,
    node: process.version,
    platform: process.platform,
    uptime: process.uptime()
  });
});

/* ─── SPA FALLBACK ─── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ─── SERVER ─── */
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   DerivAI Pro — Quantum Terminal     ║
  ║   Version: 3.0.0                     ║
  ╠══════════════════════════════════════╣
  ║   Server: http://${HOST}:${PORT}
  ║   Mode: ${process.env.NODE_ENV || 'production'}
  ║   PID: ${process.pid}
  ╚══════════════════════════════════════╝
  `);
});

/* ─── GRACEFUL SHUTDOWN ─── */
function shutdown(signal) {
  console.log(`\n[DerivAI] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[DerivAI] Server closed.');
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException',  (err) => { console.error('[DerivAI] Uncaught Exception:', err); });
process.on('unhandledRejection', (reason) => { console.error('[DerivAI] Unhandled Rejection:', reason); });

module.exports = server;
