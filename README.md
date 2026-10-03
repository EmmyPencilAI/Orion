# ORION MT5 — INSTITUTIONAL FOREX & GOLD SIGNAL ENGINE
### Real-Time 5-Pair Multi-Timeframe Scanner + MT5 Lot Sizer Helper

**ORION MT5** is a production-quality, real-time Forex and Gold signal application built for **XAUUSD**, **USDJPY**, **EURUSD**, **GBPUSD**, and **USDCAD**.

It is styled in an institutional **Orange & White** terminal aesthetic featuring **Orbitron** typography, designed for Android and mobile browsers with an autonomous Python/FastAPI backend on Render.

---

## ⚡ What Makes It Real

1. **Real-Time Market Data Feeds (No Fake Prices)**:
   - Continuously scans live tick & candle data for 5 instruments:
     - **XAUUSD** (Spot Gold / USD)
     - **USDJPY** (US Dollar / Japanese Yen)
     - **EURUSD** (Euro / US Dollar)
     - **GBPUSD** (British Pound / US Dollar)
     - **USDCAD** (US Dollar / Canadian Dollar)
   - Multi-timeframe analysis across **H1** (macro trend), **M15** (structure confirmation), and **M5** (entry trigger).

2. **Deterministic Mathematical Signals**:
   - Zero LLM / Zero AI guesses. Pure Wilder-smoothed technical math:
     - EMA Ribbon: EMA 9, 21, 50, 200
     - Wilder RSI 14 & MACD (12, 26, 9)
     - ADX 14 (Trend conviction) & ATR 14 (True volatility)
     - Dynamic Stop Loss (based on structural swing highs/lows + ATR buffer)
     - Multi-tier Take Profits: TP1 (1:1.5 R:R), TP2 (1:2.5 R:R), TP3 (1:4.0 R:R)
   - Strict `WAIT` enforcement: Protects capital when market is in chop, conflicting timeframes, or overextended.

3. **MT5 Lot Size Helper with 0.01 Micro-Lot Sizing**:
   - Designed for small accounts ($50, $100, $250, $500, $1,000, $5,000 or custom balance).
   - Starts at **0.01** minimum micro-lot with interactive `+0.01` and `-0.01` incremental adjustments.
   - Dual modes:
     - **Auto Risk %**: Calculates the exact lot size so you never exceed your chosen risk (e.g. 1% or 2%).
     - **Manual Lot Control**: User selects 0.01, 0.02, 0.05, etc., and the app calculates the exact dollar risk on Stop Loss and dollar reward on TP1/TP2/TP3.
   - 1-tap **Copy MT5 Order Ticket** formatted with entry, SL, TP, and exact lot size.

4. **Institutional Orange & White Aesthetic**:
   - Palette: High-visibility orange (`#FF6B00`), pure white (`#FFFFFF`), deep matte carbon (`#07070A`, `#13131A`).
   - High-precision typography: **Orbitron** font for prices, lot sizes, timers, and confidence meters.

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Keep-alive check for external 5-min cron. Returns `{"status":"ok","scanner":"running"}`. |
| `GET` | `/signals` | Returns latest in-memory analysis for all 5 pairs. |
| `GET` | `/signals/XAUUSD` | Returns latest analysis for Gold. |
| `GET` | `/signals/USDJPY` | Returns latest analysis for USDJPY. |
| `GET` | `/signals/EURUSD` | Returns latest analysis for EURUSD. |
| `GET` | `/signals/GBPUSD` | Returns latest analysis for GBPUSD. |
| `GET` | `/signals/USDCAD` | Returns latest analysis for USDCAD. |

---

## 📱 Android Packaging via Capacitor

```bash
# 1. Build web bundle
npm run build

# 2. Add Android platform (first time)
npx cap add android

# 3. Sync web assets into Android project
npx cap sync

# 4. Open in Android Studio to build APK
npx cap open android
```

---

## ☁️ Render Deployment

1. Push files to GitHub (`main.py`, `scanner.py`, `indicators.py`, `data_provider.py`, `requirements.txt`, `render.yaml`, `Procfile`).
2. Deploy to Render with Start Command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
3. Set external cron on Cron-Job.org to ping `https://<your-render-app>.onrender.com/health` every 5 minutes (`*/5 * * * *`).
