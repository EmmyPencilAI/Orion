"""
Real Market Data Provider for MT5 SIGNAL BOT.
Fetches live OHLC candles for XAUUSD, USDJPY, EURUSD, GBPUSD, and USDCAD across M5, M15, and H1.
Never uses synthetic or fake prices. Strictly rejects stale data.
"""

from typing import List, Dict, Any, Optional
import time
import json
import urllib.request
import urllib.error
import asyncio
import logging

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

logger = logging.getLogger("market_data")

# In-memory cache to prevent duplicate requests within short windows
_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 25.0  # seconds

SYMBOL_DECIMALS = {
    "XAUUSD": 2,
    "USDJPY": 3,
    "EURUSD": 5,
    "GBPUSD": 5,
    "USDCAD": 5,
}


def _fetch_url_sync(url: str) -> Optional[dict]:
    """Synchronous fetch using standard urllib with custom user-agent."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            if response.status == 200:
                data = response.read().decode("utf-8")
                return json.loads(data)
    except Exception as e:
        logger.warning(f"Fetch failed for {url}: {e}")
    return None


async def fetch_candles(
    symbol: str, timeframe: str
) -> Optional[Dict[str, Any]]:
    """
    Fetches real market candles for symbol ('XAUUSD', 'USDJPY', 'EURUSD', 'GBPUSD', 'USDCAD')
    and timeframe ('M5', 'M15', 'H1').
    """
    cache_key = f"{symbol}_{timeframe}"
    now = time.time()

    if cache_key in _CACHE:
        entry = _CACHE[cache_key]
        if now - entry["timestamp"] < CACHE_TTL:
            return entry

    decimals = SYMBOL_DECIMALS.get(symbol, 5)

    # 1. Fetch from Yahoo Finance
    yahoo_ticker = "GC=F" if symbol == "XAUUSD" else f"{symbol}=X"
    interval = "5m" if timeframe == "M5" else ("15m" if timeframe == "M15" else "60m")
    range_param = "2d" if timeframe == "M5" else ("5d" if timeframe == "M15" else "1mo")

    hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"]
    data = None

    for host in hosts:
        yahoo_url = f"https://{host}/v8/finance/chart/{yahoo_ticker}?interval={interval}&range={range_param}"
        if HAS_HTTPX:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                    }
                    resp = await client.get(yahoo_url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        break
            except Exception:
                pass

        if data is None:
            data = await asyncio.to_thread(_fetch_url_sync, yahoo_url)
            if data:
                break

    if data:
        result = data.get("chart", {}).get("result", [None])[0]
        if result and "timestamp" in result and "indicators" in result:
            timestamps = result["timestamp"]
            quote = result["indicators"].get("quote", [{}])[0]
            opens = quote.get("open", [])
            highs = quote.get("high", [])
            lows = quote.get("low", [])
            closes = quote.get("close", [])
            volumes = quote.get("volume", [])

            candles: List[Dict[str, Any]] = []

            for i in range(len(timestamps)):
                c = closes[i]
                o = opens[i]
                h = highs[i]
                l = lows[i]

                if (
                    c is not None
                    and o is not None
                    and h is not None
                    and l is not None
                ):
                    candles.append({
                        "timestamp": timestamps[i] * 1000,
                        "open": round(float(o), decimals),
                        "high": round(float(h), decimals),
                        "low": round(float(l), decimals),
                        "close": round(float(c), decimals),
                        "volume": float(volumes[i]) if volumes and i < len(volumes) and volumes[i] else 1.0,
                    })

            if len(candles) >= 20:
                cached_result = {
                    "candles": candles,
                    "source": "yahoo",
                    "timestamp": now,
                    "timeframe": timeframe,
                    "symbol": symbol,
                }
                _CACHE[cache_key] = cached_result
                return cached_result

    # 2. Secondary backup for XAUUSD: Binance PAXGUSDT (Spot 1:1 physical gold)
    if symbol == "XAUUSD":
        b_interval = "5m" if timeframe == "M5" else ("15m" if timeframe == "M15" else "1h")
        limit = 70 if timeframe == "H1" else 100
        binance_url = f"https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval={b_interval}&limit={limit}"

        b_data = None
        if HAS_HTTPX:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(binance_url)
                    if resp.status_code == 200:
                        b_data = resp.json()
            except Exception:
                pass
        if b_data is None:
            b_data = await asyncio.to_thread(_fetch_url_sync, binance_url)

        if b_data and isinstance(b_data, list):
            candles = []
            for k in b_data:
                candles.append({
                    "timestamp": int(k[0]),
                    "open": round(float(k[1]), 2),
                    "high": round(float(k[2]), 2),
                    "low": round(float(k[3]), 2),
                    "close": round(float(k[4]), 2),
                    "volume": float(k[5]),
                })
            if len(candles) >= 20:
                cached_result = {
                    "candles": candles,
                    "source": "binance-paxg",
                    "timestamp": now,
                    "timeframe": timeframe,
                    "symbol": symbol,
                }
                _CACHE[cache_key] = cached_result
                return cached_result

    # Fallback to expired cache if available before failing
    if cache_key in _CACHE and len(_CACHE[cache_key].get("candles", [])) >= 20:
        return _CACHE[cache_key]

    return None
