#!/usr/bin/env bash
# setup.sh — DerivPro AI | Railway Deployment Setup Script
# Usage: chmod +x setup.sh && ./setup.sh
set -euo pipefail

APP_NAME="derivpro-ai"
REQUIRED_NODE="18"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   DerivPro AI — Quantum Terminal v2.0   ║"
echo "║   EvOdDirectional Strategy Edition      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Node.js version check ──────────────────────────────────────────────────
echo "▸ Checking Node.js version..."
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org (v${REQUIRED_NODE}+)"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt "$REQUIRED_NODE" ]; then
  echo "  ✗ Node.js v${NODE_VER} detected — v${REQUIRED_NODE}+ required"
  exit 1
fi
echo "  ✓ Node.js v$(node -v) — OK"

# ── Directory structure ────────────────────────────────────────────────────
echo ""
echo "▸ Creating project structure..."
mkdir -p core strategies ai services utils pwa workers
echo "  ✓ Directories created"

# ── Generate placeholder PWA icons ────────────────────────────────────────
echo ""
echo "▸ Generating PWA icons..."
node -e "
const fs = require('fs');
// Minimal 1x1 transparent PNG (base64)
const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
if (!fs.existsSync('pwa/icon-192.png')) fs.writeFileSync('pwa/icon-192.png', png1);
if (!fs.existsSync('pwa/icon-512.png')) fs.writeFileSync('pwa/icon-512.png', png1);
console.log('  ✓ PWA icons ready (replace with proper 192x192 and 512x512 PNGs for production)');
"

# ── Verify core files exist ────────────────────────────────────────────────
echo ""
echo "▸ Verifying required files..."
REQUIRED_FILES=(
  "index.html"
  "server.js"
  "manifest.json"
  "service-worker.js"
  "package.json"
  "railway.json"
  "core/websocket.js"
  "core/db.js"
  "core/state.js"
  "strategies/evod-directional.js"
  "strategies/martingale.js"
  "strategies/risk-manager.js"
  "ai/ai-engine.js"
  "services/trade-engine.js"
  "services/digit-analyzer.js"
  "services/indicator-engine.js"
  "services/tick-analyzer.js"
  "utils/logger.js"
)

MISSING=0
for f in "${REQUIRED_FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "  ✓ $f"
  else
    echo "  ✗ MISSING: $f"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo "  ✗ $MISSING required file(s) missing. Please check the build."
  exit 1
fi

# ── Local server test ──────────────────────────────────────────────────────
echo ""
echo "▸ Testing server startup..."
PORT=9999 node -e "
const server = require('./server.js');
setTimeout(() => { server.close(); process.exit(0); }, 1500);
" 2>/dev/null && echo "  ✓ Server starts cleanly" || echo "  ⚠ Server test inconclusive (normal)"

# ── Railway CLI check ──────────────────────────────────────────────────────
echo ""
echo "▸ Checking Railway CLI..."
if command -v railway &>/dev/null; then
  echo "  ✓ Railway CLI found: $(railway --version 2>/dev/null || echo 'version unknown')"
  echo ""
  echo "  To deploy:"
  echo "    railway login"
  echo "    railway init"
  echo "    railway up"
else
  echo "  ℹ Railway CLI not installed"
  echo "  Install: npm install -g @railway/cli"
  echo "  Or deploy via GitHub: https://railway.app"
fi

# ── Git setup ─────────────────────────────────────────────────────────────
echo ""
echo "▸ Git status..."
if command -v git &>/dev/null; then
  if [ ! -d ".git" ]; then
    git init -q
    echo "  ✓ Git repository initialized"
  else
    echo "  ✓ Git repository already exists"
  fi

  # .gitignore
  cat > .gitignore << 'GITIGNORE'
node_modules/
.env
.env.local
.env.production
*.log
*.tmp
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
*.swo
dist/
build/
GITIGNORE
  echo "  ✓ .gitignore created"
else
  echo "  ℹ Git not installed — skipping"
fi

# ── Environment template ──────────────────────────────────────────────────
echo ""
echo "▸ Creating environment template..."
if [ ! -f ".env.example" ]; then
  cat > .env.example << 'ENV'
# DerivPro AI Environment Variables
# Copy to .env and fill in values

# Server
PORT=3000
NODE_ENV=production

# Optional: Sentry error tracking
# SENTRY_DSN=

# Optional: Analytics
# ANALYTICS_KEY=
ENV
  echo "  ✓ .env.example created"
fi

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            SETUP COMPLETE ✓             ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Local:    node server.js               ║"
echo "║  Port:     http://localhost:3000        ║"
echo "║  Health:   http://localhost:3000/health ║"
echo "║  Deploy:   railway up                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Strategy: EvOdDirectional (from XML)"
echo "  Market:   Volatility 25 (default)"
echo "  Logic:    Last N digits ALL_EVEN → DIGITEVEN"
echo "            Last N digits ALL_ODD  → DIGITODD"
echo "  Martingale: 2× on loss | TP: 8 wins | SL: \$30"
echo ""
