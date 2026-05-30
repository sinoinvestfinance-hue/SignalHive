#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  AXIOM DIGIT AI — Setup Script v2.0
#  Initializes folder structure, installs dependencies,
#  generates PWA icons, and configures Railway deployment.
# ═══════════════════════════════════════════════════════════════
set -e

CYAN='\033[0;36m'
GOLD='\033[0;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║      AXIOM DIGIT AI — SETUP v2.0      ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── Check Prerequisites ─────────────────────────────────────
echo -e "${CYAN}[1/8] Checking prerequisites...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required. Install from https://nodejs.org${NC}"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo -e "${RED}npm is required.${NC}"; exit 1; }
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${RED}Node.js 18+ required (found v$NODE_VER). Please upgrade.${NC}"; exit 1
fi
echo -e "${GREEN}  ✓ Node.js $(node -v) | npm $(npm -v)${NC}"

# ── Create Directory Structure ──────────────────────────────
echo -e "${CYAN}[2/8] Creating directory structure...${NC}"
mkdir -p icons screenshots logs database

# Create placeholder icons using base64 SVG → PNG fallback
# In production: replace with proper 512×512 PNG icons
create_svg_icon() {
  local SIZE=$1
  local FILE="icons/icon-${SIZE}.png"
  # Generate a minimal valid PNG placeholder (gold hexagon) if ImageMagick available
  if command -v convert >/dev/null 2>&1; then
    convert -size "${SIZE}x${SIZE}" xc:'#080c14' \
      -fill '#f59e0b' -draw "polygon $((SIZE/2)),$((SIZE/8)) $((SIZE*7/8)),$((SIZE*3/8)) $((SIZE*7/8)),$((SIZE*5/8)) $((SIZE/2)),$((SIZE*7/8)) $((SIZE/8)),$((SIZE*5/8)) $((SIZE/8)),$((SIZE*3/8))" \
      -fill 'white' -pointsize $((SIZE/5)) -gravity Center -annotate 0 'A' \
      "$FILE" 2>/dev/null && echo "    Created $FILE (ImageMagick)" || echo "    Skipped $FILE (no ImageMagick)"
  else
    # Minimal 1×1 black PNG as placeholder
    printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > "$FILE"
    echo "    Placeholder $FILE created (install ImageMagick for real icons)"
  fi
}

for SIZE in 72 96 128 144 152 192 384 512; do
  create_svg_icon $SIZE
done
echo -e "${GREEN}  ✓ Icons directory ready${NC}"

# ── Initialize Log Files ────────────────────────────────────
echo -e "${CYAN}[3/8] Initializing log files...${NC}"
echo "[]" > logs/trades.json
echo "[]" > logs/system.json
echo "[]" > logs/ai.json
echo "{}" > database/sessions.json
echo -e "${GREEN}  ✓ Log files initialized${NC}"

# ── Install Dependencies ────────────────────────────────────
echo -e "${CYAN}[4/8] Installing Node.js dependencies...${NC}"
npm install --production
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# ── Create .env File ────────────────────────────────────────
echo -e "${CYAN}[5/8] Creating .env file...${NC}"
if [ ! -f .env ]; then
cat > .env << 'ENVEOF'
# AXIOM DIGIT AI — Environment Variables
PORT=3000
NODE_ENV=production

# Deriv API Configuration
DERIV_APP_ID=1089
DERIV_WS_URL=wss://ws.binaryws.com/websockets/v3

# Railway Config
RAILWAY_HEALTHCHECK_PATH=/health

# Security
SESSION_SECRET=axiom_secret_change_in_production
ENVEOF
  echo -e "${GREEN}  ✓ .env created (update values before deploying)${NC}"
else
  echo -e "${GOLD}  ⚠ .env already exists — skipped${NC}"
fi

# ── Create .gitignore ────────────────────────────────────────
echo -e "${CYAN}[6/8] Creating .gitignore...${NC}"
cat > .gitignore << 'GITEOF'
node_modules/
.env
logs/*.json
database/*.json
screenshots/
*.log
.DS_Store
Thumbs.db
GITEOF
echo -e "${GREEN}  ✓ .gitignore created${NC}"

# ── Create Procfile for Railway ─────────────────────────────
echo -e "${CYAN}[7/8] Creating Procfile...${NC}"
echo "web: node server.js" > Procfile
echo -e "${GREEN}  ✓ Procfile created${NC}"

# ── Final Summary ────────────────────────────────────────────
echo -e "${CYAN}[8/8] Setup complete!${NC}"
echo ""
echo -e "${GOLD}  ╔════════════════════════════════════════════╗"
echo -e "  ║            AXIOM DIGIT AI READY            ║"
echo -e "  ╠════════════════════════════════════════════╣"
echo -e "  ║  Local dev:   ${GREEN}npm start${GOLD}                      ║"
echo -e "  ║  URL:         ${GREEN}http://localhost:3000${GOLD}           ║"
echo -e "  ╠════════════════════════════════════════════╣"
echo -e "  ║  Railway:     ${GREEN}railway up${GOLD}                     ║"
echo -e "  ╠════════════════════════════════════════════╣"
echo -e "  ║  Strategies:                               ║"
echo -e "  ║    • Ov4Un5 Reversal  (XML origin)         ║"
echo -e "  ║    • Rise/Fall Reversal                    ║"
echo -e "  ║    • AI Confluence                         ║"
echo -e "  ║    • Digit Hot/Cold                        ║"
echo -e "  ╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Get your Deriv API token at:${NC}"
echo -e "  ${GREEN}https://app.deriv.com/account/api-token${NC}"
echo ""
