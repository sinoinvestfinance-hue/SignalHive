#!/usr/bin/env bash
# ============================================================
#  DerivAI Pro — Automated Setup Script v3.0
#  Handles: dependencies, folder structure, PWA init, Railway config
# ============================================================
set -e

# ─── COLORS ───
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()   { echo -e "${CYAN}[DerivAI]${NC} $1"; }
ok()    { echo -e "${GREEN}[  OK  ]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ WARN ]${NC} $1"; }
error() { echo -e "${RED}[ERROR ]${NC} $1"; exit 1; }

# ─── BANNER ───
echo -e "${BOLD}${CYAN}"
echo "  ██████╗ ███████╗██████╗ ██╗██╗   ██╗ █████╗ ██╗    ██████╗ ██████╗  ██████╗ "
echo "  ██╔══██╗██╔════╝██╔══██╗██║██║   ██║██╔══██╗██║    ██╔══██╗██╔══██╗██╔═══██╗"
echo "  ██║  ██║█████╗  ██████╔╝██║██║   ██║███████║██║    ██████╔╝██████╔╝██║   ██║"
echo "  ██║  ██║██╔══╝  ██╔══██╗██║╚██╗ ██╔╝██╔══██║██║    ██╔═══╝ ██╔══██╗██║   ██║"
echo "  ██████╔╝███████╗██║  ██║██║ ╚████╔╝ ██║  ██║██║    ██║     ██║  ██║╚██████╔╝"
echo "  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═╝  ╚═╝╚═╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝ "
echo ""
echo "                    QUANTUM TRADING TERMINAL  v3.0"
echo -e "${NC}"

# ─── NODE CHECK ───
log "Checking Node.js..."
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org (v18+)"
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  error "Node.js v18+ required. Found: $(node -v)"
fi
ok "Node.js $(node -v)"

# ─── NPM CHECK ───
if ! command -v npm &>/dev/null; then
  error "npm not found"
fi
ok "npm $(npm -v)"

# ─── FOLDER STRUCTURE ───
log "Creating folder structure..."
mkdir -p logs database backups .env-examples
ok "Folders created"

# ─── ENVIRONMENT FILE ───
log "Setting up environment..."
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
# DerivAI Pro — Environment Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Deriv API (optional — app uses browser-side WS)
DERIV_APP_ID=1089

# Logging
LOG_LEVEL=info

# Security
CORS_ORIGIN=*
ENVEOF
  ok ".env created"
else
  warn ".env already exists — skipping"
fi

# ─── .ENV EXAMPLE ───
cat > .env-examples/.env.example << 'EXEOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DERIV_APP_ID=1089
LOG_LEVEL=info
CORS_ORIGIN=*
EXEOF

# ─── .GITIGNORE ───
log "Creating .gitignore..."
cat > .gitignore << 'GITEOF'
node_modules/
.env
logs/
*.log
database/*.db
backups/
.DS_Store
Thumbs.db
*.local
dist/
.cache/
GITEOF
ok ".gitignore created"

# ─── PROCFILE (Railway / Heroku) ───
log "Creating Procfile..."
cat > Procfile << 'PROCEOF'
web: node server.js
PROCEOF
ok "Procfile created"

# ─── NIXPACKS CONFIG ───
log "Creating nixpacks.toml..."
cat > nixpacks.toml << 'NIXEOF'
[phases.build]
cmds = ["npm install --production"]

[phases.setup]
nixPkgs = ["nodejs-18_x"]

[start]
cmd = "node server.js"
NIXEOF
ok "nixpacks.toml created"

# ─── INSTALL DEPENDENCIES ───
log "Installing npm dependencies..."
npm install --production
ok "Dependencies installed"

# ─── LOG INIT ───
log "Initializing log system..."
touch logs/app.log logs/trades.log logs/errors.log
cat > logs/.gitkeep << 'EOF'
EOF
ok "Log files initialized"

# ─── HEALTH CHECK ───
log "Running pre-flight checks..."
node -e "
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
console.log('[CHECK] All dependencies loadable ✓');
"
ok "Dependency check passed"

# ─── DONE ───
echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  DerivAI Pro setup complete!${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Local dev:${NC}    npm start"
echo -e "  ${CYAN}Health:${NC}       http://localhost:3000/health"
echo -e "  ${CYAN}App:${NC}          http://localhost:3000"
echo ""
echo -e "  ${YELLOW}Railway deploy:${NC}"
echo -e "  1. Push to GitHub"
echo -e "  2. Connect repo in railway.app"
echo -e "  3. Add env vars from .env-examples/.env.example"
echo -e "  4. Deploy — Railway auto-detects Node.js"
echo ""
echo -e "  ${BOLD}Trading Strategies Included:${NC}"
echo -e "  ⚡ EvOd% Strategy     (from XML — all 4 modes)"
echo -e "  ↕  Rise/Fall Reversal (3–8 consecutive ticks)"
echo -e "  🤖 AI Composite       (multi-factor confidence)"
echo ""
log "Run: ${BOLD}npm start${NC}"
