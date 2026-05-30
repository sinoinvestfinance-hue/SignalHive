# ⚡ DerivAI Pro — Quantum Trading Terminal v3.0

Institutional-grade AI-enhanced PWA trading terminal for **Deriv Synthetic Indices**.  
Connects live to the Deriv WebSocket API. Mobile-first dark quant UI. Railway-deployable.

---

## 📦 Included Files

| File | Purpose |
|------|---------|
| `index.html` | Full PWA trading terminal (single-file, all JS inline) |
| `sw.js` | Service Worker — offline shell, caching, push notifications |
| `manifest.json` | PWA manifest — installable on Android/iOS/Desktop |
| `server.js` | Express static server for Railway deployment |
| `package.json` | Node.js package with Railway build config |
| `railway.json` | Railway deployment schema |
| `setup.sh` | Automated setup script |

---

## ⚡ EvOd% Strategy (from XML)

Directly converted from your DBot XML (`EvOd_.xml`).

### 4 Strategy Modes

| Mode | Logic |
|------|-------|
| `GT_EVEN` | If Even% of last N digits **>** X% → trade EVEN; if Odd% > X% → trade ODD |
| `LT_EVEN` | If Even% of last N digits **<** X% → trade EVEN; if Odd% < X% → trade ODD |
| `GT_ODD` | If Even% of last N digits **>** X% → trade **ODD** (contrarian) |
| `LT_ODD` | If Even% of last N digits **<** X% → trade **ODD** (contrarian) |

### Default Config (from XML)
- **Market**: R_25 (Volatility 25)
- **Stake**: $0.50
- **Martingale multiplier**: ×2
- **Take Profit**: 8 wins
- **Digits to Check (N)**: 30
- **Threshold (X)**: 55%
- **Stop Loss**: $30
- **Use Martingale**: TRUE
- **Restart on Error**: TRUE

---

## ↕ Rise/Fall Reversal Strategy

- N consecutive FALL ticks → execute RISE contract  
- N consecutive RISE ticks → execute FALL contract  
- Configurable N: 3, 4, 5, 6, 7, or 8 ticks

---

## 🤖 AI Composite Engine

Multi-factor weighted confidence scoring (0–100%):

| Factor | Weight | Description |
|--------|--------|-------------|
| EvOd Signal Strength | 30pts | How far above/below threshold |
| RSI Alignment | 20pts | RSI confirms EvOd direction |
| EMA Trend | 20pts | EMA9/21 trend agreement |
| Streak Balance | 15pts | Penalizes extreme E/O streaks |
| Volatility Filter | 15pts | BB width in optimal range |

**AI Modes:**
- `CONSERVATIVE` — threshold 75%
- `BALANCED` — threshold 60%
- `AGGRESSIVE` — threshold 45%
- `HYPER` — threshold 30%

---

## 📊 App Sections

| Section | Content |
|---------|---------|
| **Dashboard** | Live price, AI signal, E/O meter, quick controls, session stats |
| **Digits** | Heatmap, frequency bars, E/O analysis, EvOd signal, sequence |
| **AI** | Confidence ring, factor breakdown, indicators, AI decision log |
| **Strategy** | EvOd% config, Rise/Fall config, toggles, Martingale, trade mode |
| **Trade** | Risk management, manual execution, recent trades |
| **Logs** | Analytics, system log, IndexedDB history, CSV export, resets |

---

## 🚀 Local Setup

```bash
# Clone / copy files, then:
bash setup.sh          # Install + configure
npm start              # Start server → http://localhost:3000
```

---

## 🚂 Railway Deployment

1. Push folder to a GitHub repo  
2. Connect repo at [railway.app](https://railway.app)  
3. Railway auto-detects Node.js from `package.json`  
4. Add environment variables (copy from `.env-examples/.env.example`)  
5. Deploy → get your live HTTPS URL  
6. Open on mobile → tap **Add to Home Screen** to install as PWA

---

## 🔌 Deriv API Connection

The app connects directly from the browser to:
```
wss://ws.binaryws.com/websockets/v3?app_id=YOUR_APP_ID
```

- **Demo App ID**: `1089` (works for market data without auth)
- **API Token**: Required only for real trade execution
- Get your App ID at: [app.deriv.com](https://app.deriv.com)
- Get your API token at: [app.deriv.com/account/api-token](https://app.deriv.com/account/api-token)

---

## 🛡️ Risk Management

- Stop Loss (default: $30 cumulative session loss)
- Take Profit (default: 8 wins per session = run count)
- Daily Loss Limit (default: $50)
- Max Consecutive Losses (default: 8)
- Martingale Max Depth (default: 6 levels)
- Auto-stop on any limit breach
- Emergency cooldown on consecutive loss breach

---

## 💾 Storage Architecture

| Layer | Used For |
|-------|---------|
| **IndexedDB** | Trade history, system logs (persistent, up to 5000 records) |
| **LocalStorage** | Settings (App ID, token, market, mode) |
| **Service Worker Cache** | Offline shell (HTML, manifest) |

---

## 📱 PWA Features

- Installable (Add to Home Screen)
- Offline shell (loads without internet)
- Service Worker with cache-first strategy
- Push notification support
- Background sync hooks
- Mobile-first responsive layout
- Safe area insets for iOS

---

## ⚠️ Disclaimer

This software is for educational and research purposes. Trading synthetic indices involves significant risk. Never trade with money you cannot afford to lose. Past performance of any strategy does not guarantee future results.
