import { Candle, IndicatorValues } from '../types/signal';

export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  if (values.length < period) {
    const sum = values.reduce((a, b) => a + b, 0);
    return new Array(values.length).fill(sum / values.length);
  }

  const k = 2 / (period + 1);
  const emaValues: number[] = new Array(values.length);

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  emaValues[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    emaValues[i] = values[i] * k + emaValues[i - 1] * (1 - k);
  }

  // Backfill early elements with SMA for consistency
  for (let i = 0; i < period - 1; i++) {
    emaValues[i] = emaValues[period - 1];
  }

  return emaValues;
}

export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: number; signalLine: number; histogram: number } {
  if (closes.length < slowPeriod + signalPeriod) {
    return { macdLine: 0, signalLine: 0, histogram: 0 };
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdSeries: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdSeries.push(fastEMA[i] - slowEMA[i]);
  }

  const signalSeries = calculateEMA(macdSeries.slice(slowPeriod - 1), signalPeriod);
  const latestMACD = macdSeries[macdSeries.length - 1];
  const latestSignal = signalSeries[signalSeries.length - 1] ?? 0;
  const histogram = latestMACD - latestSignal;

  return {
    macdLine: Number(latestMACD.toFixed(4)),
    signalLine: Number(latestSignal.toFixed(4)),
    histogram: Number(histogram.toFixed(4)),
  };
}

export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < 2) return 1;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length <= period) {
    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return Number(atr.toFixed(4));
}

export function calculateADX(candles: Candle[], period: number = 14): number {
  if (candles.length < period * 2) return 25;

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);

    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;

    if (upMove > downMove && upMove > 0) {
      plusDMs.push(upMove);
    } else {
      plusDMs.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDMs.push(downMove);
    } else {
      minusDMs.push(0);
    }
  }

  // Smooth TR, +DM, -DM
  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - (smoothTR / period) + trs[i];
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDMs[i];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDMs[i];

    const plusDI = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
    const minusDI = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;

    const diSum = plusDI + minusDI;
    const diDiff = Math.abs(plusDI - minusDI);
    const dx = diSum === 0 ? 0 : (diDiff / diSum) * 100;
    dxValues.push(dx);
  }

  if (dxValues.length === 0) return 20;
  if (dxValues.length < period) {
    return dxValues.reduce((a, b) => a + b, 0) / dxValues.length;
  }

  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return Number(adx.toFixed(2));
}

export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number; middle: number; lower: number; bandwidth: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 1;
    return { upper: last * 1.01, middle: last, lower: last * 0.99, bandwidth: 0.02 };
  }

  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = mean + stdDevMultiplier * stdDev;
  const lower = mean - stdDevMultiplier * stdDev;
  const bandwidth = mean !== 0 ? (upper - lower) / mean : 0;

  return {
    upper: Number(upper.toFixed(4)),
    middle: Number(mean.toFixed(4)),
    lower: Number(lower.toFixed(4)),
    bandwidth: Number(bandwidth.toFixed(4)),
  };
}

export function calculateVWAP(candles: Candle[]): number {
  if (candles.length === 0) return 0;
  let totalPV = 0;
  let totalVolume = 0;

  // Compute intraday VWAP for last 40 candles
  const window = candles.slice(-40);
  for (const c of window) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume > 0 ? c.volume : 1;
    totalPV += typicalPrice * vol;
    totalVolume += vol;
  }

  return totalVolume > 0 ? Number((totalPV / totalVolume).toFixed(4)) : candles[candles.length - 1].close;
}

export function findSwingPoints(
  candles: Candle[],
  leftBars: number = 2,
  rightBars: number = 2
): { swingHighs: number[]; swingLows: number[] } {
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= leftBars; j++) {
      if (candles[i - j].high >= current.high) isHigh = false;
      if (candles[i - j].low <= current.low) isLow = false;
    }
    for (let j = 1; j <= rightBars; j++) {
      if (candles[i + j].high > current.high) isHigh = false;
      if (candles[i + j].low < current.low) isLow = false;
    }

    if (isHigh) swingHighs.push(current.high);
    if (isLow) swingLows.push(current.low);
  }

  return { swingHighs, swingLows };
}

export function computeAllIndicators(candles: Candle[]): IndicatorValues {
  const closes = candles.map((c) => c.close);
  const ema9Arr = calculateEMA(closes, 9);
  const ema21Arr = calculateEMA(closes, 21);
  const ema50Arr = calculateEMA(closes, 50);
  const ema200Arr = calculateEMA(closes, 200);

  const lastIdx = closes.length - 1;
  const ema9 = ema9Arr[lastIdx] ?? closes[lastIdx];
  const ema21 = ema21Arr[lastIdx] ?? closes[lastIdx];
  const ema50 = ema50Arr[lastIdx] ?? closes[lastIdx];
  const ema200 = ema200Arr[lastIdx] ?? closes[lastIdx];

  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes, 12, 26, 9);
  const atr14 = calculateATR(candles, 14);
  const adx14 = calculateADX(candles, 14);
  const bollinger = calculateBollingerBands(closes, 20, 2);
  const vwap = calculateVWAP(candles);

  return {
    ema9: Number(ema9.toFixed(4)),
    ema21: Number(ema21.toFixed(4)),
    ema50: Number(ema50.toFixed(4)),
    ema200: Number(ema200.toFixed(4)),
    rsi14: Number(rsi14.toFixed(2)),
    macd,
    atr14: Number(atr14.toFixed(4)),
    adx14: Number(adx14.toFixed(2)),
    bollinger,
    vwap: Number(vwap.toFixed(4)),
  };
}
