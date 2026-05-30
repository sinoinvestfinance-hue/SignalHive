# AXIOM DIGIT AI v2.0
### Deriv Volatility Index — Autonomous AI Trading Terminal

A production-grade PWA trading platform for Deriv synthetic volatility indices, featuring the **Ov4Un5 Reversal** strategy (ported from `Ov4Un5Reversal.xml`) alongside three additional AI-enhanced strategies.

---

## Strategies Included

| Strategy | Origin | Logic | Contract |
|---|---|---|---|
| **Ov4Un5 Reversal** | `Ov4Un5Reversal.xml` | Last N digits all ≤4 → OVER 4 / all ≥5 → UNDER 5 | DIGITOVER / DIGITUNDER |
| **Rise/Fall Reversal** | Custom | N consecutive FALL → RISE / RISE → FALL | CALL / PUT |
| **AI Confluence** | AI Engine | Multi-indicator consensus above threshold | DIGITOVER / DIGITUNDER |
| **Digit Hot/Cold** | Statistical | Cold digit mean-reversion exploitation | DIGITOVER / DIGITUNDER |

---

## Quick Start

```bash
# 1. Run setup (creates folders, installs deps, generates icons)
chmod +x setup.sh && ./setup.sh

# 2. Start locally
npm start

# 3. Open in browser
open http://localhost:3000
```

---

## Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project and deploy
railway init
railway up

# View logs
railway logs
```

Set these environment variables in Railway dashboard:
- `PORT` — auto-set by Railway
- `NODE_ENV=production`
- `DERIV_APP_ID=1089`

---

## Architecture

```
axiom-digit-ai/
├── index.html          ← Complete PWA (single-file trading terminal)
├── service-worker.js   ← Offline cache + push notifications
├── manifest.json       ← PWA installable manifest
├── server.js           ← Express static server (Railway)
├── package.json        ← Node dependencies
├── railway.json        ← Railway deployment config
├── setup.sh            ← One-command bootstrap
├── icons/              ← PWA icon set (all sizes)
├── logs/               ← Persistent trade/system/AI logs
└── database/           ← Session state
```

---

## Ov4Un5 Reversal — XML Strategy Logic

The primary strategy is a direct port of `Ov4Un5Reversal.xml`:

```
INIT:
  Stake          = 0.50
  Martingale     = 2×
  Take Profit    = 4 wins
  Stop Loss      = $30
  Use Martingale = TRUE

BEFORE PURCHASE (configurable N = 3–8):
  IF last N digits ALL ≤ 4 → BUY DIGITOVER 4
  IF last N digits ALL ≥ 5 → BUY DIGITUNDER 5

AFTER PURCHASE:
  WIN  → Reset stake to initial | RunCount++
  LOSS → IF Martingale: stake × 2 | ELSE: reset

STOP CONDITIONS:
  RunCount ≥ Take Profit wins → Session complete
  Total P&L ≤ –Stop Loss     → Halt
```

---

## AI Engine

The onboard AI evaluates 15+ signals per tick:

- EMA 9/21/50 trend alignment
- RSI oversold/overbought zones
- MACD histogram direction
- Bollinger Band squeeze/breakout
- Stochastic oscillator
- ATR volatility filter
- ADX trend strength
- Digit low/high dominance (last 100 ticks)
- Consecutive low/high digit streaks

**AI Modes:** Conservative (72%) · Balanced (60%) · Aggressive (48%) · Hyper (35%)

---

## API Token

Get your Deriv API token with **Read + Trade** permissions:
**https://app.deriv.com/account/api-token**

---

## Risk Warning

Trading synthetic indices involves substantial risk. Past performance is not indicative of future results. Always test strategies in Paper/Virtual mode before using real funds. Set appropriate Stop Loss limits.
