import { Candle, Timeframe, SupportedSymbol } from '../types/signal';

interface CacheEntry {
  timestamp: number;
  candles: Candle[];
}

const dataCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 25000; // 25s cache to prevent redundant external API hits

export function getSymbolDecimals(symbol: SupportedSymbol): number {
  switch (symbol) {
    case 'XAUUSD':
      return 2;
    case 'USDJPY':
      return 3;
    case 'EURUSD':
    case 'GBPUSD':
    case 'USDCAD':
    default:
      return 5;
  }
}

export async function fetchMarketCandles(
  symbol: SupportedSymbol,
  timeframe: Timeframe
): Promise<{ candles: Candle[]; source: string; timestamp: number } | null> {
  const cacheKey = `${symbol}_${timeframe}`;
  const now = Date.now();
  const cached = dataCache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      candles: cached.candles,
      source: 'cache',
      timestamp: cached.timestamp,
    };
  }

  const decimals = getSymbolDecimals(symbol);

  // Map to Yahoo Finance ticker
  let yahooSymbol = `${symbol}=X`;
  if (symbol === 'XAUUSD') {
    yahooSymbol = 'GC=F';
  }

  const interval = timeframe === 'M5' ? '5m' : timeframe === 'M15' ? '15m' : '60m';
  const range = timeframe === 'M5' ? '2d' : timeframe === 'M15' ? '5d' : '1mo';

  // 1. Try Yahoo Finance (Query2 and Query1 rotation)
  const hosts = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const json: any = await response.json();
        const result = json?.chart?.result?.[0];
        if (result && result.timestamp && result.indicators?.quote?.[0]) {
          const timestamps: number[] = result.timestamp;
          const quote = result.indicators.quote[0];
          const opens = quote.open || [];
          const highs = quote.high || [];
          const lows = quote.low || [];
          const closes = quote.close || [];
          const volumes = quote.volume || [];

          const candles: Candle[] = [];
          for (let i = 0; i < timestamps.length; i++) {
            const c = closes[i];
            const o = opens[i];
            const h = highs[i];
            const l = lows[i];

            if (
              c !== null && c !== undefined && !isNaN(c) &&
              o !== null && o !== undefined && !isNaN(o) &&
              h !== null && h !== undefined && !isNaN(h) &&
              l !== null && l !== undefined && !isNaN(l)
            ) {
              candles.push({
                timestamp: timestamps[i] * 1000,
                open: Number(o.toFixed(decimals)),
                high: Number(h.toFixed(decimals)),
                low: Number(l.toFixed(decimals)),
                close: Number(c.toFixed(decimals)),
                volume: volumes[i] ? Number(volumes[i]) : 1,
              });
            }
          }

          if (candles.length >= 20) {
            dataCache.set(cacheKey, { timestamp: now, candles });
            return { candles, source: 'yahoo', timestamp: now };
          }
        }
      }
    } catch {
      // Continue to next host
    }
  }

  // 2. Secondary source for XAUUSD: Binance PAXGUSDT
  if (symbol === 'XAUUSD') {
    try {
      const bInterval = timeframe === 'M5' ? '5m' : timeframe === 'M15' ? '15m' : '1h';
      const limit = timeframe === 'H1' ? 70 : 100;
      const url = `https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${bInterval}&limit=${limit}`;
      const res = await fetch(url);
      if (res.ok) {
        const klines: any[] = await res.json();
        const candles: Candle[] = klines.map((k) => ({
          timestamp: k[0],
          open: Number(parseFloat(k[1]).toFixed(2)),
          high: Number(parseFloat(k[2]).toFixed(2)),
          low: Number(parseFloat(k[3]).toFixed(2)),
          close: Number(parseFloat(k[4]).toFixed(2)),
          volume: Number(parseFloat(k[5]).toFixed(2)),
        }));

        if (candles.length >= 20) {
          dataCache.set(cacheKey, { timestamp: now, candles });
          return { candles, source: 'binance-paxg', timestamp: now };
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback to existing cached data if any
  if (cached && cached.candles.length >= 20) {
    return { candles: cached.candles, source: 'stale-cache', timestamp: cached.timestamp };
  }

  return null;
}
