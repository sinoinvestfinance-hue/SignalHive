# DerivPro AI — Quantum Terminal v2.0
### EvOdDirectional Strategy Edition

A production-grade AI trading PWA for Deriv synthetic volatility indices, built around the **EvOdDirectional** strategy converted from DBot XML.

---

## Architecture

```
derivpro/
├── index.html                     # PWA shell — all UI (8 panels, dark quant UI)
├── manifest.json                  # PWA manifest
├── service-worker.js              # Offline support + caching
├── server.js                      # Express static server (Railway-ready)
├── package.json
├── railway.json                   # Railway deployment config
├── nixpacks.toml                  # Railway Nixpacks config
├── setup.sh                       # Setup + verification script
│
├── core/
│   ├── websocket.js               # Deriv WebSocket engine (auto-reconnect, ping/pong)
│   ├── db.js                      # IndexedDB persistence (trades, logs, state)
│   └── state.js                   # Reactive app state manager
│
├── strategies/
│   ├── evod-directional.js        # EvOdDirectional strategy (from XML) ← CORE
│   ├── martingale.js              # Martingale engine (Kelly, Fibonacci, D'Alembert)
│   └── risk-manager.js           # Risk management (SL, cooldown, circuit breakers)
│
├── ai/
│   └── ai-engine.js               # 8-layer AI decision engine (self-learning weights)
│
├── services/
│   ├── trade-engine.js            # Trade execution (real + virtual)
│   ├── digit-analyzer.js          # Last digit stats (streak, freq, anomaly detection)
│   ├── indicator-engine.js        # 15+ indicators (EMA, MACD, RSI, BB, ATR, ADX...)
│   └── tick-analyzer.js           # Tick velocity, momentum, volatility
│
└── utils/
    └── logger.js                  # Categorized logging with IndexedDB persistence
```

---

## EvOdDirectional Strategy

**Origin:** `EvOdDirectional.xml` (Deriv DBot)

### Logic (from XML)

```
BEFORE PURCHASE:
  strategy_type = 2 (configurable: 2–10 digits)

  IF last N digits are ALL_EVEN → purchase DIGITEVEN
  IF last N digits are ALL_ODD  → purchase DIGITODD
  ELSE → wait for next tick

VARIABLES (XML initialization block):
  Stake        = 0.50       (initial_stake)
  Martangle    = 2          (multiplier)
  No. of Win   = 8          (take_profit runs)
  Stop_Loss    = 30         (USD)
  Use Martingale = TRUE
  Initial_Stake = Stake
  Run_Count     = 0

AFTER PURCHASE:
  Notify: "Run Count: {Run_Count}"

  IF WIN:
    Stake     = Initial_Stake   ← reset
    Run_Count = Run_Count + 1

  IF LOSS:
    IF Use_Martingale = TRUE:
      Stake = Stake × Martangle  ← double
    ELSE:
      Stake = Initial_Stake

  IF Run_Count >= No_of_Win:
    → "Successfully hit {n} winning runs. Total Profit: {p}"
    → STOP

  ELSE IF total_profit <= -Stop_Loss:
    → "Sorry!!! Stop Loss Hit"
    → STOP

  ELSE:
    → TRADE AGAIN
```

### Strategy Types (9 options)

| Type | Description |
|------|-------------|
| 2    | Last 2 digits Even/Odd (default) |
| 3    | Last 3 digits Even/Odd |
| 4    | Last 4 digits Even/Odd |
| 5    | Last 5 digits Even/Odd |
| 6    | Last 6 digits Even/Odd |
| 7    | Last 7 digits Even/Odd |
| 8    | Last 8 digits Even/Odd |
| 9    | Last 9 digits Even/Odd |
| 10   | Last 10 digits Even/Odd |

### Martingale Stake Progression (default: ×2)

| Level | Stake   | Cumulative Loss |
|-------|---------|-----------------|
| 0     | $0.50   | $0.00           |
| 1     | $1.00   | $0.50           |
| 2     | $2.00   | $1.50           |
| 3     | $4.00   | $3.50           |
| 4     | $8.00   | $7.50           |
| 5     | $16.00  | $15.50          |
| 6     | $32.00  | $31.50          |

---

## UI Panels (8 Tabs)

| Panel | Description |
|-------|-------------|
| **DASH**    | Live balance, P&L, AI signal, EvOd status, tick stream, E/O distribution |
| **DIGITS**  | Heatmap (2-10 digit history), freq bars, anomaly detection, streak analysis |
| **AI**      | 8-layer engine scores, mode selector, threshold slider, reasoning log |
| **VIRTUAL** | Simulation mode — manual + auto, no real funds |
| **TRADE**   | Auto trading (EvOdDirectional) + manual EVEN/ODD, active contracts, history |
| **STRAT**   | Full strategy config (N digits, stake, martingale, TP, SL) + risk manager |
| **LOGS**    | Filtered log stream (trades/AI/system), export CSV |
| **STATS**   | P&L chart, drawdown, profit factor, win rates by type |

---

## AI Engine (8 Layers)

| Layer | Weight | Signal Source |
|-------|--------|---------------|
| Streak Analysis   | 22% | Consecutive even/odd count |
| Frequency Bias    | 15% | Historical digit distribution |
| Momentum          | 15% | Short vs long window even/odd rate |
| Martingale Filter | 10% | Blocks trades at deep martingale levels |
| EMA Trend         | 13% | EMA9 vs EMA21 alignment |
| RSI               | 10% | Oversold/overbought condition |
| ATR Gate          | 8%  | Volatility-based trade filtering |
| Noise Filter      | 7%  | Alternation rate to detect ranging |

Weights update automatically via reinforcement learning (win/loss feedback).

---

## Technical Indicators

EMA(9), EMA(21), EMA(55), EMA(200), SMA(20), SMA(50), WMA(10), VWAP, RSI(14), RSI(7), Stochastic RSI, MACD(12/26/9), Bollinger Bands(20,2), ATR(14), ATR(7), ADX(14), CCI(20), Williams %R, Momentum, ROC, Supertrend, Donchian Channels

---

## Risk Management

| Control | Default |
|---------|---------|
| Max Daily Loss | $100 |
| Max Session Loss | $50 |
| Max Consecutive Losses | 8 |
| Max Martingale Depth | 6 |
| Max Trades / Session | 200 |
| Max Stake Exposure | $20 |
| Cooldown after 5 losses | 30s |
| Emergency Stop | Manual toggle |

---

## Deployment — Railway

### Quick Deploy (GitHub)
1. Push this repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select repo → Railway auto-detects `railway.json`
4. Add environment variable: `PORT=3000`
5. Deploy — get your URL

### Railway CLI Deploy
```bash
chmod +x setup.sh && ./setup.sh
npm install -g @railway/cli
railway login
railway init
railway up
```

### Local Development
```bash
node server.js
# → http://localhost:3000
```

### Health Check
```
GET /health
→ { status: "ok", app: "DerivPro AI", version: "2.0", uptime: ... }
```

---

## Getting Started

1. Open the app URL in your browser
2. Enter your Deriv API token (from app.deriv.com/account/api-token)
   - Required scopes: **Read**, **Trade**, **Payments**
3. Select market (default: Volatility 25)
4. Test on **VIRTUAL** tab first
5. Configure strategy on **STRAT** tab
6. Enable auto trading on **TRADE** tab

---

## Security Notes

- API token is stored in `localStorage` (base64, not encrypted) — **never share your token**
- All WebSocket traffic goes directly to Deriv — no intermediary servers
- This app does not transmit your token to any third-party server

---

## Disclaimer

Trading synthetic indices carries significant risk. Past performance is not indicative of future results. Always test on virtual/demo accounts before trading real funds. Use responsible position sizing and stop losses.

---

*DerivPro AI v2.0 — EvOdDirectional Edition*
*Strategy origin: EvOdDirectional.xml (Deriv DBot)*
