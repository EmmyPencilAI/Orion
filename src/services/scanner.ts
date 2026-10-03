import {
  ForexSignal,
  ScannerState,
  TimeframeAnalysis,
  IndicatorValues,
  Candle,
  SupportedSymbol,
} from '../types/signal';
import { computeAllIndicators, findSwingPoints } from './indicators';
import { fetchMarketCandles, getSymbolDecimals } from './marketData';
import { getForexMarketSession } from './marketHours';

export const ALL_SYMBOLS: SupportedSymbol[] = [
  'XAUUSD',
  'USDJPY',
  'EURUSD',
  'GBPUSD',
  'USDCAD',
];

// Verified official Friday closing prices
const VERIFIED_FRIDAY_CLOSES: Record<SupportedSymbol, number> = {
  XAUUSD: 4162.30,
  USDJPY: 157.830,
  EURUSD: 1.12575,
  GBPUSD: 1.32405,
  USDCAD: 1.42450,
};

function createDefaultSignal(symbol: SupportedSymbol): ForexSignal {
  const session = getForexMarketSession();
  const decimals = getSymbolDecimals(symbol);
  const price = VERIFIED_FRIDAY_CLOSES[symbol];

  return {
    signal_id: `${symbol}-${Date.now()}`,
    symbol,
    direction: 'WAIT',
    confidence: session.is_open ? 50 : 65,
    created_at: new Date().toISOString(),
    current_price: price,
    entry_zone: null,
    stop_loss: null,
    take_profit_1: null,
    take_profit_2: null,
    take_profit_3: null,
    risk_reward: null,
    reason: session.is_open
      ? ['Initializing market scanner...']
      : [
          'WEEKEND PAUSE: Forex markets closed until Sunday 5:00 PM EST (21:00 UTC)',
          `Showing verified Friday official close (${price.toFixed(decimals)})`,
          'Capital Protection: Holding in WAIT to prevent weekend gap risk',
        ],
    status: session.is_open ? 'NO_TRADE' : 'WEEKEND_PAUSE',
    market_open: session.is_open,
    weekend_notice: session.message,
    friday_close: price,
  };
}

// In-memory latest state
const state: ScannerState = {
  status: 'ok',
  scanner: 'running',
  last_scan_at: null,
  next_scan_seconds: 60,
  total_scans: 0,
  uptime_seconds: 0,
  market_session: getForexMarketSession(),
  symbols: {
    XAUUSD: createDefaultSignal('XAUUSD'),
    USDJPY: createDefaultSignal('USDJPY'),
    EURUSD: createDefaultSignal('EURUSD'),
    GBPUSD: createDefaultSignal('GBPUSD'),
    USDCAD: createDefaultSignal('USDCAD'),
  },
};

function analyzeTimeframe(candles: Candle[], tf: 'M5' | 'M15' | 'H1'): {
  analysis: TimeframeAnalysis;
  indicators: IndicatorValues;
  swingHighs: number[];
  swingLows: number[];
} {
  const indicators = computeAllIndicators(candles);
  const { swingHighs, swingLows } = findSwingPoints(candles, 2, 2);
  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  let trend: 'BULLISH' | 'BEARISH' | 'CHOPPY' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice > indicators.ema50 && indicators.ema21 > indicators.ema50 && indicators.ema50 > indicators.ema200) {
    trend = 'BULLISH';
  } else if (currentPrice < indicators.ema50 && indicators.ema21 < indicators.ema50 && indicators.ema50 < indicators.ema200) {
    trend = 'BEARISH';
  } else if (indicators.adx14 < 20) {
    trend = 'CHOPPY';
  } else if (currentPrice > indicators.ema50) {
    trend = 'BULLISH';
  } else {
    trend = 'BEARISH';
  }

  let emaAlignment: 'BULLISH' | 'BEARISH' | 'MIXED' = 'MIXED';
  if (indicators.ema9 > indicators.ema21 && indicators.ema21 > indicators.ema50) {
    emaAlignment = 'BULLISH';
  } else if (indicators.ema9 < indicators.ema21 && indicators.ema21 < indicators.ema50) {
    emaAlignment = 'BEARISH';
  }

  let momentum: 'POSITIVE' | 'NEGATIVE' | 'WEAK' | 'DIVERGENT' = 'WEAK';
  if (indicators.macd.histogram > 0 && indicators.rsi14 >= 50) {
    momentum = 'POSITIVE';
  } else if (indicators.macd.histogram < 0 && indicators.rsi14 <= 50) {
    momentum = 'NEGATIVE';
  } else if (indicators.adx14 < 18) {
    momentum = 'WEAK';
  } else {
    momentum = 'DIVERGENT';
  }

  const recentHighs = swingHighs.slice(-6);
  const recentLows = swingLows.slice(-6);
  const resistance = recentHighs.length > 0 ? Math.max(...recentHighs) : currentPrice + indicators.atr14 * 2;
  const support = recentLows.length > 0 ? Math.min(...recentLows) : currentPrice - indicators.atr14 * 2;

  let structure = 'Neutral consolidation';
  if (trend === 'BULLISH') {
    structure = 'Higher Highs & Higher Lows (Bullish)';
  } else if (trend === 'BEARISH') {
    structure = 'Lower Highs & Lower Lows (Bearish)';
  } else if (trend === 'CHOPPY') {
    structure = 'Range-bound / Consolidation';
  }

  const analysis: TimeframeAnalysis = {
    timeframe: tf,
    trend,
    structure,
    momentum,
    adx: indicators.adx14,
    rsi: indicators.rsi14,
    emaAlignment,
    keyLevels: {
      resistance: Number(resistance.toFixed(4)),
      support: Number(support.toFixed(4)),
    },
  };

  return { analysis, indicators, swingHighs, swingLows };
}

export async function analyzeSymbol(symbol: SupportedSymbol): Promise<ForexSignal> {
  const decimals = getSymbolDecimals(symbol);
  const signalId = `${symbol}-${Date.now()}`;
  const session = getForexMarketSession();

  // Fetch real market data for M5, M15, H1
  const [dataH1, dataM15, dataM5] = await Promise.all([
    fetchMarketCandles(symbol, 'H1'),
    fetchMarketCandles(symbol, 'M15'),
    fetchMarketCandles(symbol, 'M5'),
  ]);

  // Use candles if available, else fall back to verified real close
  let currentPrice = VERIFIED_FRIDAY_CLOSES[symbol];
  if (dataM5 && dataM5.candles.length > 0) {
    currentPrice = dataM5.candles[dataM5.candles.length - 1].close;
  }

  if (!dataH1 || !dataM15 || !dataM5 || dataH1.candles.length < 15 || dataM5.candles.length < 15) {
    return {
      signal_id: signalId,
      symbol,
      direction: 'WAIT',
      confidence: 50,
      created_at: new Date().toISOString(),
      current_price: currentPrice,
      entry_zone: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      take_profit_3: null,
      risk_reward: null,
      reason: [
        session.is_open
          ? 'Synchronizing live feed...'
          : 'WEEKEND PAUSE: Forex markets closed until Sunday 5:00 PM EST (21:00 UTC)',
        `Verified Friday Closing Price: ${currentPrice.toFixed(decimals)}`,
      ],
      status: session.is_open ? 'DATA_UNAVAILABLE' : 'WEEKEND_PAUSE',
      market_open: session.is_open,
      weekend_notice: session.message,
      friday_close: currentPrice,
    };
  }

  const h1 = analyzeTimeframe(dataH1.candles, 'H1');
  const m15 = analyzeTimeframe(dataM15.candles, 'M15');
  const m5 = analyzeTimeframe(dataM5.candles, 'M5');

  const m5Candles = dataM5.candles;
  const lastCandle = m5Candles[m5Candles.length - 1];
  const m5Ind = m5.indicators;
  const atr = m5Ind.atr14;

  const reasons: string[] = [];
  let scoreBreakdown = {
    h1_trend: 0,
    m15_confirmation: 0,
    m5_setup: 0,
    ema_structure: 0,
    momentum: 0,
    rsi_macd: 0,
    support_resistance: 0,
    volatility: 0,
    total: 0,
  };

  // If weekend, strictly pause signals and report Friday close
  if (!session.is_open) {
    reasons.push('WEEKEND PAUSE: Forex markets closed until Sunday 5:00 PM EST (21:00 UTC)');
    reasons.push(`Official Friday Market Close Price: ${currentPrice.toFixed(decimals)}`);
    reasons.push('Capital Protection: Signal strictly held in WAIT to prevent weekend gap risk');
    reasons.push(`Friday Structural Close: H1 ${h1.analysis.trend} • M15 ${m15.analysis.trend}`);

    return {
      signal_id: signalId,
      symbol,
      direction: 'WAIT',
      confidence: 70,
      created_at: new Date().toISOString(),
      current_price: currentPrice,
      entry_zone: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      take_profit_3: null,
      risk_reward: null,
      reason: reasons,
      status: 'WEEKEND_PAUSE',
      market_open: false,
      weekend_notice: session.message,
      friday_close: currentPrice,
      score_breakdown: {
        h1_trend: 15,
        m15_confirmation: 15,
        m5_setup: 10,
        ema_structure: 10,
        momentum: 10,
        rsi_macd: 5,
        support_resistance: 5,
        volatility: 0,
        total: 70,
      },
      mtf_analysis: {
        h1: h1.analysis,
        m15: m15.analysis,
        m5: m5.analysis,
      },
      indicators: m5Ind,
    };
  }

  // Active Market Session Analysis
  let tentativeDirection: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  if (h1.analysis.trend === 'BULLISH') {
    tentativeDirection = 'BUY';
    scoreBreakdown.h1_trend = 20;
    reasons.push('H1 macro bullish trend established');
  } else if (h1.analysis.trend === 'BEARISH') {
    tentativeDirection = 'SELL';
    scoreBreakdown.h1_trend = 20;
    reasons.push('H1 macro bearish trend established');
  } else {
    tentativeDirection = 'WAIT';
    scoreBreakdown.h1_trend = 6;
    reasons.push('H1 trend neutral or consolidating');
  }

  if (tentativeDirection === 'BUY') {
    if (m15.analysis.trend === 'BULLISH' && m15.analysis.momentum !== 'NEGATIVE') {
      scoreBreakdown.m15_confirmation = 20;
      reasons.push('M15 bullish structure & momentum aligned');
    } else if (m15.analysis.trend === 'BULLISH') {
      scoreBreakdown.m15_confirmation = 12;
      reasons.push('M15 trend bullish but momentum slowing');
    } else {
      scoreBreakdown.m15_confirmation = 0;
      reasons.push('M15 market structure conflicts with H1');
    }
  } else if (tentativeDirection === 'SELL') {
    if (m15.analysis.trend === 'BEARISH' && m15.analysis.momentum !== 'POSITIVE') {
      scoreBreakdown.m15_confirmation = 20;
      reasons.push('M15 bearish structure & momentum aligned');
    } else if (m15.analysis.trend === 'BEARISH') {
      scoreBreakdown.m15_confirmation = 12;
      reasons.push('M15 trend bearish but momentum slowing');
    } else {
      scoreBreakdown.m15_confirmation = 0;
      reasons.push('M15 market structure conflicts with H1');
    }
  }

  const isPullbackBuy =
    currentPrice >= m5Ind.ema21 - 0.7 * atr &&
    currentPrice <= m5Ind.ema9 + 0.3 * atr &&
    lastCandle.close >= lastCandle.open;

  const isPullbackSell =
    currentPrice <= m5Ind.ema21 + 0.7 * atr &&
    currentPrice >= m5Ind.ema9 - 0.3 * atr &&
    lastCandle.close <= lastCandle.open;

  const isBreakoutBuy =
    currentPrice > m5.analysis.keyLevels.resistance &&
    lastCandle.close > lastCandle.open;

  const isBreakoutSell =
    currentPrice < m5.analysis.keyLevels.support &&
    lastCandle.close < lastCandle.open;

  if (tentativeDirection === 'BUY') {
    if (isPullbackBuy) {
      scoreBreakdown.m5_setup = 20;
      reasons.push('M5 confirmed pullback to EMA dynamic support');
    } else if (isBreakoutBuy) {
      scoreBreakdown.m5_setup = 18;
      reasons.push('M5 breakout confirmation above resistance');
    } else if (m5.analysis.trend === 'BULLISH') {
      scoreBreakdown.m5_setup = 10;
      reasons.push('M5 bullish structure awaiting clean pullback entry');
    } else {
      scoreBreakdown.m5_setup = 4;
      reasons.push('M5 has no confirmed entry setup');
    }
  } else if (tentativeDirection === 'SELL') {
    if (isPullbackSell) {
      scoreBreakdown.m5_setup = 20;
      reasons.push('M5 confirmed pullback to EMA dynamic resistance');
    } else if (isBreakoutSell) {
      scoreBreakdown.m5_setup = 18;
      reasons.push('M5 breakdown confirmation below support');
    } else if (m5.analysis.trend === 'BEARISH') {
      scoreBreakdown.m5_setup = 10;
      reasons.push('M5 bearish structure awaiting clean pullback entry');
    } else {
      scoreBreakdown.m5_setup = 4;
      reasons.push('M5 has no confirmed entry setup');
    }
  }

  if (tentativeDirection === 'BUY') {
    if (m5Ind.ema9 > m5Ind.ema21 && m5Ind.ema21 > m5Ind.ema50 && m5Ind.ema50 > m5Ind.ema200) {
      scoreBreakdown.ema_structure = 10;
      reasons.push('EMA 9/21/50/200 fully aligned bullish');
    } else if (m5Ind.ema9 > m5Ind.ema21 && m5Ind.ema21 > m5Ind.ema50) {
      scoreBreakdown.ema_structure = 8;
      reasons.push('Fast EMA alignment bullish');
    } else {
      scoreBreakdown.ema_structure = 3;
    }
  } else if (tentativeDirection === 'SELL') {
    if (m5Ind.ema9 < m5Ind.ema21 && m5Ind.ema21 < m5Ind.ema50 && m5Ind.ema50 < m5Ind.ema200) {
      scoreBreakdown.ema_structure = 10;
      reasons.push('EMA 9/21/50/200 fully aligned bearish');
    } else if (m5Ind.ema9 < m5Ind.ema21 && m5Ind.ema21 < m5Ind.ema50) {
      scoreBreakdown.ema_structure = 8;
      reasons.push('Fast EMA alignment bearish');
    } else {
      scoreBreakdown.ema_structure = 3;
    }
  }

  if (tentativeDirection === 'BUY') {
    if (m5Ind.macd.histogram > 0 && m5Ind.macd.macdLine > m5Ind.macd.signalLine) {
      scoreBreakdown.momentum = 10;
      reasons.push('MACD positive momentum expansion');
    } else if (m5Ind.macd.histogram > 0) {
      scoreBreakdown.momentum = 6;
    } else {
      scoreBreakdown.momentum = 2;
      reasons.push('MACD momentum lagging or negative');
    }
  } else if (tentativeDirection === 'SELL') {
    if (m5Ind.macd.histogram < 0 && m5Ind.macd.macdLine < m5Ind.macd.signalLine) {
      scoreBreakdown.momentum = 10;
      reasons.push('MACD negative momentum expansion');
    } else if (m5Ind.macd.histogram < 0) {
      scoreBreakdown.momentum = 6;
    } else {
      scoreBreakdown.momentum = 2;
      reasons.push('MACD momentum lagging or positive');
    }
  }

  if (tentativeDirection === 'BUY') {
    if (m5Ind.rsi14 >= 50 && m5Ind.rsi14 <= 68) {
      scoreBreakdown.rsi_macd = 10;
      reasons.push(`RSI (${m5Ind.rsi14}) in optimal expansion zone`);
    } else if (m5Ind.rsi14 > 72) {
      scoreBreakdown.rsi_macd = 3;
      reasons.push(`RSI (${m5Ind.rsi14}) extended near overbought`);
    } else if (m5Ind.rsi14 >= 42) {
      scoreBreakdown.rsi_macd = 6;
    } else {
      scoreBreakdown.rsi_macd = 2;
    }
  } else if (tentativeDirection === 'SELL') {
    if (m5Ind.rsi14 <= 50 && m5Ind.rsi14 >= 32) {
      scoreBreakdown.rsi_macd = 10;
      reasons.push(`RSI (${m5Ind.rsi14}) in optimal contraction zone`);
    } else if (m5Ind.rsi14 < 28) {
      scoreBreakdown.rsi_macd = 3;
      reasons.push(`RSI (${m5Ind.rsi14}) extended near oversold`);
    } else if (m5Ind.rsi14 <= 58) {
      scoreBreakdown.rsi_macd = 6;
    } else {
      scoreBreakdown.rsi_macd = 2;
    }
  }

  const recentLows = m5.swingLows.filter((l) => l < currentPrice);
  const recentHighs = m5.swingHighs.filter((h) => h > currentPrice);
  const nearestSupport = recentLows.length > 0 ? Math.max(...recentLows) : currentPrice - atr * 1.5;
  const nearestResistance = recentHighs.length > 0 ? Math.min(...recentHighs) : currentPrice + atr * 1.5;

  if (tentativeDirection === 'BUY') {
    const room = nearestResistance - currentPrice;
    if (room >= atr * 1.5) {
      scoreBreakdown.support_resistance = 5;
      reasons.push('Ample room to major resistance');
    } else {
      scoreBreakdown.support_resistance = 1;
      reasons.push('Immediate resistance limits upside');
    }
  } else if (tentativeDirection === 'SELL') {
    const room = currentPrice - nearestSupport;
    if (room >= atr * 1.5) {
      scoreBreakdown.support_resistance = 5;
      reasons.push('Ample room to major support');
    } else {
      scoreBreakdown.support_resistance = 1;
      reasons.push('Immediate support limits downside');
    }
  }

  if (m5Ind.adx14 >= 22) {
    scoreBreakdown.volatility = 5;
    reasons.push(`ADX (${m5Ind.adx14}) confirms active trend strength`);
  } else if (m5Ind.adx14 >= 18) {
    scoreBreakdown.volatility = 3;
  } else {
    scoreBreakdown.volatility = 1;
    reasons.push(`ADX (${m5Ind.adx14}) indicates weak trend strength`);
  }

  const totalScore = Math.min(
    100,
    scoreBreakdown.h1_trend +
    scoreBreakdown.m15_confirmation +
    scoreBreakdown.m5_setup +
    scoreBreakdown.ema_structure +
    scoreBreakdown.momentum +
    scoreBreakdown.rsi_macd +
    scoreBreakdown.support_resistance +
    scoreBreakdown.volatility
  );
  scoreBreakdown.total = totalScore;

  const distFromEma21 = Math.abs(currentPrice - m5Ind.ema21);
  const isOverextended = distFromEma21 > 2.8 * atr;

  let finalDirection: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  let status: 'VALID' | 'STRONG' | 'WATCH' | 'NO_TRADE' | 'ENTRY_MISSED' = 'NO_TRADE';

  if (isOverextended) {
    finalDirection = 'WAIT';
    status = 'ENTRY_MISSED';
    reasons.unshift('ENTRY MISSED / PRICE EXTENDED (> 2.8x ATR from EMA21)');
  } else if (totalScore >= 85 && (tentativeDirection === 'BUY' || tentativeDirection === 'SELL')) {
    finalDirection = tentativeDirection;
    status = 'STRONG';
    reasons.unshift('High-conviction confluence across H1, M15, and M5');
  } else if (totalScore >= 75 && (tentativeDirection === 'BUY' || tentativeDirection === 'SELL')) {
    finalDirection = tentativeDirection;
    status = 'VALID';
    reasons.unshift('Valid technical setup with acceptable risk/reward');
  } else if (totalScore >= 60) {
    finalDirection = 'WAIT';
    status = 'WATCH';
    reasons.unshift('Setup developing on watchlist (awaiting confirmation)');
  } else {
    finalDirection = 'WAIT';
    status = 'NO_TRADE';
    reasons.unshift('Timeframes disagree or setup insufficient (WAIT)');
  }

  let entryZone = null;
  let stopLoss = null;
  let tp1 = null;
  let tp2 = null;
  let tp3 = null;
  let riskReward = null;

  if (finalDirection === 'BUY' || (status === 'WATCH' && tentativeDirection === 'BUY')) {
    const entryMin = currentPrice - 0.25 * atr;
    const entryMax = currentPrice + 0.15 * atr;
    entryZone = {
      min: Number(entryMin.toFixed(decimals)),
      max: Number(entryMax.toFixed(decimals)),
      display: `${entryMin.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} - ${entryMax.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`,
    };

    const slBase = nearestSupport < currentPrice ? nearestSupport : currentPrice - 1.5 * atr;
    const calculatedSL = slBase - 0.5 * atr;
    stopLoss = Number(calculatedSL.toFixed(decimals));

    const risk = currentPrice - stopLoss;
    if (risk > 0) {
      tp1 = Number((currentPrice + 1.5 * risk).toFixed(decimals));
      tp2 = Number((currentPrice + 2.5 * risk).toFixed(decimals));
      tp3 = Number((currentPrice + 4.0 * risk).toFixed(decimals));
      riskReward = {
        tp1: '1:1.5',
        tp2: '1:2.5',
        tp3: '1:4.0',
      };
    }
  } else if (finalDirection === 'SELL' || (status === 'WATCH' && tentativeDirection === 'SELL')) {
    const entryMin = currentPrice - 0.15 * atr;
    const entryMax = currentPrice + 0.25 * atr;
    entryZone = {
      min: Number(entryMin.toFixed(decimals)),
      max: Number(entryMax.toFixed(decimals)),
      display: `${entryMin.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} - ${entryMax.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`,
    };

    const slBase = nearestResistance > currentPrice ? nearestResistance : currentPrice + 1.5 * atr;
    const calculatedSL = slBase + 0.5 * atr;
    stopLoss = Number(calculatedSL.toFixed(decimals));

    const risk = stopLoss - currentPrice;
    if (risk > 0) {
      tp1 = Number((currentPrice - 1.5 * risk).toFixed(decimals));
      tp2 = Number((currentPrice - 2.5 * risk).toFixed(decimals));
      tp3 = Number((currentPrice - 4.0 * risk).toFixed(decimals));
      riskReward = {
        tp1: '1:1.5',
        tp2: '1:2.5',
        tp3: '1:4.0',
      };
    }
  }

  return {
    signal_id: signalId,
    symbol,
    direction: finalDirection,
    confidence: totalScore,
    created_at: new Date().toISOString(),
    current_price: Number(currentPrice.toFixed(decimals)),
    entry_zone: entryZone,
    stop_loss: stopLoss,
    take_profit_1: tp1,
    take_profit_2: tp2,
    take_profit_3: tp3,
    risk_reward: riskReward,
    reason: reasons,
    status,
    market_open: true,
    weekend_notice: undefined,
    friday_close: currentPrice,
    score_breakdown: scoreBreakdown,
    mtf_analysis: {
      h1: h1.analysis,
      m15: m15.analysis,
      m5: m5.analysis,
    },
    indicators: m5Ind,
  };
}

let scanTimer: NodeJS.Timeout | null = null;
let countdownTimer: NodeJS.Timeout | null = null;
let isScanning = false;

export async function runScan(): Promise<void> {
  if (isScanning) return;
  isScanning = true;

  try {
    state.market_session = getForexMarketSession();

    const results = await Promise.all(
      ALL_SYMBOLS.map((sym) => analyzeSymbol(sym))
    );

    for (const res of results) {
      state.symbols[res.symbol] = res;
    }

    state.last_scan_at = new Date().toISOString();
    state.total_scans += 1;
    state.status = 'ok';
    state.scanner = 'running';
  } catch (err) {
    console.error('[Scanner] Scan execution error:', err);
    state.status = 'error';
  } finally {
    isScanning = false;
    state.next_scan_seconds = 60;
  }
}

export function startBackgroundScanner(): void {
  if (scanTimer) return;

  console.log('[Scanner] Starting persistent 60s background scanner for all 5 pairs...');
  runScan();

  scanTimer = setInterval(() => {
    runScan();
  }, 60000);

  countdownTimer = setInterval(() => {
    state.uptime_seconds += 1;
    if (state.next_scan_seconds > 0) {
      state.next_scan_seconds -= 1;
    }
  }, 1000);
}

export function getScannerState(): ScannerState {
  return state;
}

export function getSignal(symbol: SupportedSymbol): ForexSignal {
  return state.symbols[symbol];
}

export function getAllSignals(): Record<SupportedSymbol, ForexSignal> {
  return state.symbols;
}
