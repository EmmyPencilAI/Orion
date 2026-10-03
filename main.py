"""
ORION MT5 SIGNAL BOT - Render Python / FastAPI Application.

Pairs: XAUUSD, USDJPY, EURUSD, GBPUSD, USDCAD
Deployment Target: Render (Web Service)
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from contextlib import asynccontextmanager
import asyncio
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from scanner import (
    background_scanner_loop,
    LATEST_SIGNALS,
    SCANNER_METRICS,
    SUPPORTED_PAIRS,
    is_forex_market_open,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI Lifespan: Launches background scanner loop on boot."""
    scanner_task = asyncio.create_task(background_scanner_loop())
    yield
    scanner_task.cancel()
    try:
        await scanner_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="ORION MT5 SIGNAL BOT",
    description="Institutional Multi-Timeframe Forex & Gold Signal Engine for XAUUSD, USDJPY, EURUSD, GBPUSD, USDCAD",
    version="2.1.0",
    lifespan=lifespan,
)

# Enable CORS for cross-origin mobile and web requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    """Service status and API documentation."""
    is_open, msg, reopen = is_forex_market_open()
    return {
        "name": "ORION MT5 SIGNAL BOT",
        "description": "Institutional 5-Pair Forex & Gold Signal Engine",
        "service": "Render Web Service",
        "status": SCANNER_METRICS["status"],
        "scanner": SCANNER_METRICS["scanner"],
        "market_open": is_open,
        "market_status": "OPEN" if is_open else "WEEKEND_CLOSED",
        "market_message": msg,
        "next_reopen": reopen,
        "supported_pairs": SUPPORTED_PAIRS,
        "endpoints": {
            "health": "/health",
            "market_status": "/market-status",
            "signals": "/signals",
            "xauusd": "/signals/XAUUSD",
            "usdjpy": "/signals/USDJPY",
            "eurusd": "/signals/EURUSD",
            "gbpusd": "/signals/GBPUSD",
            "usdcad": "/signals/USDCAD",
        },
    }


@app.get("/health")
def health_check():
    """External keep-alive / health-check endpoint (called every 5 min by cron)."""
    is_open, msg, reopen = is_forex_market_open()
    return {
        "status": SCANNER_METRICS["status"],
        "scanner": SCANNER_METRICS["scanner"],
        "market_open": is_open,
        "market_status": "OPEN" if is_open else "WEEKEND_CLOSED",
        "message": msg,
        "reopen_time": reopen,
    }


@app.get("/market-status")
def get_market_status():
    """Detailed market hours info."""
    is_open, msg, reopen = is_forex_market_open()
    return {
        "is_open": is_open,
        "status": "OPEN" if is_open else "WEEKEND_CLOSED",
        "message": msg,
        "reopen_time": reopen,
    }


@app.get("/signals")
def get_all_signals():
    """Returns the latest bot-generated signals for all 5 instruments."""
    return LATEST_SIGNALS


@app.get("/signals/{symbol}")
def get_symbol_signal(symbol: str):
    """Returns the latest analysis for specified symbol."""
    sym = symbol.upper()
    if sym not in SUPPORTED_PAIRS:
        raise HTTPException(
            status_code=404,
            detail=f"Symbol '{sym}' not supported. Supported: {', '.join(SUPPORTED_PAIRS)}",
        )
    signal = LATEST_SIGNALS.get(sym)
    if not signal:
        raise HTTPException(status_code=503, detail="Analysis not ready yet")
    return signal


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
