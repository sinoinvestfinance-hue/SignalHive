// server.js — DerivPro AI | Railway Production Server
'use strict';

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const PORT    = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css':  'text/css',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
};

function serveFile(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback
        fs.readFile(path.join(__dirname, 'index.html'), (err2, fallback) => {
          if (err2) { res.writeHead(500); res.end('Server Error'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...securityHeaders() });
          res.end(fallback);
        });
      } else {
        res.writeHead(500); res.end('Server Error');
      }
      return;
    }

    const headers = {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-cache, no-store' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      ...securityHeaders(),
    };

    // CORS for API preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...headers, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
      res.end();
      return;
    }

    res.writeHead(200, headers);
    res.end(data);
  });
}

function securityHeaders() {
  return {
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

// Health check endpoint
function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    app: 'DerivPro AI',
    version: '2.0',
    strategy: 'EvOdDirectional',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production',
  }));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Health check routes (Railway health check)
  if (url === '/health' || url === '/ping') {
    handleHealth(req, res); return;
  }

  // Robots.txt
  if (url === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('User-agent: *\nDisallow: /\n'); return;
  }

  serveFile(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   DerivPro AI — Quantum Terminal v2.0   ║
  ║   Strategy: EvOdDirectional (XML)       ║
  ╠══════════════════════════════════════════╣
  ║   Server:   http://0.0.0.0:${PORT}         ║
  ║   Health:   http://0.0.0.0:${PORT}/health  ║
  ║   Env:      ${process.env.NODE_ENV || 'production'}                  ║
  ╚══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[DerivPro] SIGTERM received — shutting down gracefully');
  server.close(() => { console.log('[DerivPro] Server closed'); process.exit(0); });
  setTimeout(() => process.exit(0), 5000);
});

process.on('SIGINT', () => {
  console.log('\n[DerivPro] Interrupted — exiting');
  process.exit(0);
});

// Crash protection
process.on('uncaughtException',  (err) => console.error('[DerivPro] Uncaught exception:', err.message));
process.on('unhandledRejection', (err) => console.error('[DerivPro] Unhandled rejection:', err));

module.exports = server;
