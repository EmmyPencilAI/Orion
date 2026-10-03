# ORION MT5 — INSTITUTIONAL FOREX & GOLD SIGNAL ENGINE
### Full-Stack Node.js Web Service + Real-Time Multi-Timeframe Scanner

**ORION MT5** is a production-quality, real-time Forex and Gold signal web application built for **XAUUSD**, **USDJPY**, **EURUSD**, **GBPUSD**, and **USDCAD**.

It features an institutional **Orange & White** terminal aesthetic with **Orbitron** typography, automated multi-timeframe candle scanning, and precision MT5 lot sizing down to 0.01 micro-lots.

---

## 🚀 Render Deployment (Node.js Web Service)

### Root Cause of the Previous ERESOLVE Build Failure
In the previous commit, `esbuild` was explicitly pinned to `"^0.25.0"` in `devDependencies`, which conflicted with `vite@8.3.2` requiring `esbuild@^0.27.0 || ^0.28.0`. This caused `npm install` to abort with error code `ERESOLVE`.

### The Resolution Applied:
1. Removed the conflicting explicit `esbuild` pin from `package.json` (Vite and TSX manage their required esbuild versions automatically).
2. Moved `tsx` to production `dependencies` so it remains available in production container builds.
3. Updated the build command in `render.yaml` to `npm install --legacy-peer-deps && npm run build`.

---

### Render Settings

In your **Render Dashboard** for `orion-ye9g`:

| Setting | Value |
|---|---|
| **Environment** | `Node` |
| **Build Command** | `npm install --legacy-peer-deps && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/health` |
| **Auto-Deploy** | `Yes` |

#### Environment Variables on Render:
- `NODE_VERSION`: `20`
- `NODE_ENV`: `production`

---

## ⚡ What Makes It Real

1. **Real-Time Market Data Feeds**:
   - Scans actual OHLC candle feeds for all 5 pairs:
     - **XAUUSD** (Spot Gold / USD) — 2 decimals
     - **USDJPY** (US Dollar / Japanese Yen) — 3 decimals
     - **EURUSD** (Euro / US Dollar) — 5 decimals
     - **GBPUSD** (British Pound / US Dollar) — 5 decimals
     - **USDCAD** (US Dollar / Canadian Dollar) — 5 decimals

2. **Top Confluence Setup Detection**:
   - Compares all 5 instruments across **H1**, **M15**, and **M5** timeframes.
   - Highlights the highest-conviction setup (e.g. `USDJPY BUY 91%`, `GBPUSD BUY 86%`, or `XAUUSD SELL 85%`).
   - Generates exact **Calculated Entry Range**, **Stop Loss**, and **Take Profit** levels (TP1 1:1.5, TP2 1:2.5, TP3 1:4.0).

3. **Forex Weekend Schedule Awareness**:
   - Global Forex markets close Friday at 21:00 UTC (5 PM EST) and reopen Sunday at 21:00 UTC (5 PM EST).
   - On weekends, the scanner performs **Pre-Market Prep Analysis** on the official Friday closing candles.
   - Computes prime actionable setups and entry/exit targets ready for the Sunday market open, while clearly notifying traders to prevent weekend gap risk.

4. **MT5 Lot Sizer with 0.01 Micro-Lot Support**:
   - Tailored for small accounts: `$50`, `$100`, `$250`, `$500`, `$1,000`, `$2,500` or custom equity.
   - Manual `+0.01` and `-0.01` step adjustments.
   - Real dollar calculation: shows exact dollar risk on Stop Loss (e.g. `-$3.75`) and dollar profit on TP1, TP2, and TP3.

---

## 📡 REST API Endpoints

- `GET /`: Serves the complete Orange & White React Web Application.
- `GET /health`: Keep-alive check for external cron. Returns `{"status":"ok","scanner":"running",...}`.
- `GET /market-status`: Forex session status and hours until Sunday open.
- `GET /signals`: Latest signals for all 5 instruments.
- `GET /signals/:symbol`: Analysis for specified symbol (`XAUUSD`, `USDJPY`, `EURUSD`, `GBPUSD`, `USDCAD`).
- `GET /api/best-setup`: The #1 highest-conviction setup across all pairs.
- `POST /api/scan-now`: Trigger instant re-scan.
