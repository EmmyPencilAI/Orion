"""
Deterministic Technical Indicators for MT5 SIGNAL BOT.
Pure Python implementation designed for maximum speed and minimal memory on Render.
Calculates EMA 9/21/50/200, RSI 14, MACD, ATR 14, ADX 14, Bollinger Bands, VWAP,
and Swing Highs/Lows structure.
"""

from typing import List, Dict, Any, Tuple
import math


def calculate_ema(values: List[float], period: int) -> List[float]:
    """Calculates Exponential Moving Average (EMA)."""
    if not values:
        return []
    if len(values) < period:
        avg = sum(values) / len(values)
        return [avg] * len(values)

    k = 2.0 / (period + 1)
    ema_values = [0.0] * len(values)

    # Initial SMA
    sma = sum(values[:period]) / period
    ema_values[period - 1] = sma

    for i in range(period, len(values)):
        ema_values[i] = (values[i] * k) + (ema_values[i - 1] * (1.0 - k))

    # Fill beginning
    for i in range(period - 1):
        ema_values[i] = sma

    return ema_values


def calculate_rsi(closes: List[float], period: int = 14) -> float:
    """Calculates Wilder's Relative Strength Index (RSI)."""
    if len(closes) <= period:
        return 50.0

    gains = 0.0
    losses = 0.0

    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses += abs(diff)

    avg_gain = gains / period
    avg_loss = losses / period

    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            avg_gain = (avg_gain * (period - 1) + diff) / period
            avg_loss = (avg_loss * (period - 1)) / period
        else:
            avg_gain = (avg_gain * (period - 1)) / period
            avg_loss = (avg_loss * (period - 1) + abs(diff)) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def calculate_macd(
    closes: List[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> Dict[str, float]:
    """Calculates Moving Average Convergence Divergence (MACD)."""
    if len(closes) < slow_period + signal_period:
        return {"macd_line": 0.0, "signal_line": 0.0, "histogram": 0.0}

    fast_ema = calculate_ema(closes, fast_period)
    slow_ema = calculate_ema(closes, slow_period)

    macd_series = [fast - slow for fast, slow in zip(fast_ema, slow_ema)]
    signal_series = calculate_ema(macd_series[slow_period - 1:], signal_period)

    latest_macd = macd_series[-1]
    latest_signal = signal_series[-1] if signal_series else 0.0
    histogram = latest_macd - latest_signal

    return {
        "macd_line": round(latest_macd, 4),
        "signal_line": round(latest_signal, 4),
        "histogram": round(histogram, 4),
    }


def calculate_atr(candles: List[Dict[str, Any]], period: int = 14) -> float:
    """Calculates Average True Range (ATR) with Wilder's smoothing."""
    if len(candles) < 2:
        return 1.0

    true_ranges = []
    for i in range(1, len(candles)):
        curr = candles[i]
        prev = candles[i - 1]
        tr = max(
            curr["high"] - curr["low"],
            abs(curr["high"] - prev["close"]),
            abs(curr["low"] - prev["close"]),
        )
        true_ranges.append(tr)

    if len(true_ranges) <= period:
        return round(sum(true_ranges) / len(true_ranges), 4)

    atr = sum(true_ranges[:period]) / period
    for i in range(period, len(true_ranges)):
        atr = (atr * (period - 1) + true_ranges[i]) / period

    return round(atr, 4)


def calculate_adx(candles: List[Dict[str, Any]], period: int = 14) -> float:
    """Calculates Average Directional Index (ADX 14)."""
    if len(candles) < period * 2:
        return 25.0

    trs = []
    plus_dms = []
    minus_dms = []

    for i in range(1, len(candles)):
        curr = candles[i]
        prev = candles[i - 1]

        tr = max(
            curr["high"] - curr["low"],
            abs(curr["high"] - prev["close"]),
            abs(curr["low"] - prev["close"]),
        )
        trs.append(tr)

        up_move = curr["high"] - prev["high"]
        down_move = prev["low"] - curr["low"]

        if up_move > down_move and up_move > 0:
            plus_dms.append(up_move)
        else:
            plus_dms.append(0.0)

        if down_move > up_move and down_move > 0:
            minus_dms.append(down_move)
        else:
            minus_dms.append(0.0)

    smooth_tr = sum(trs[:period])
    smooth_plus = sum(plus_dms[:period])
    smooth_minus = sum(minus_dms[:period])

    dx_values = []
    for i in range(period, len(trs)):
        smooth_tr = smooth_tr - (smooth_tr / period) + trs[i]
        smooth_plus = smooth_plus - (smooth_plus / period) + plus_dms[i]
        smooth_minus = smooth_minus - (smooth_minus / period) + minus_dms[i]

        plus_di = (smooth_plus / smooth_tr * 100.0) if smooth_tr > 0 else 0.0
        minus_di = (smooth_minus / smooth_tr * 100.0) if smooth_tr > 0 else 0.0

        di_sum = plus_di + minus_di
        di_diff = abs(plus_di - minus_di)
        dx = (di_diff / di_sum * 100.0) if di_sum > 0 else 0.0
        dx_values.append(dx)

    if not dx_values:
        return 20.0
    if len(dx_values) < period:
        return round(sum(dx_values) / len(dx_values), 2)

    adx = sum(dx_values[:period]) / period
    for i in range(period, len(dx_values)):
        adx = (adx * (period - 1) + dx_values[i]) / period

    return round(adx, 2)


def calculate_bollinger_bands(
    closes: List[float], period: int = 20, num_std: float = 2.0
) -> Dict[str, float]:
    """Calculates Bollinger Bands (upper, middle, lower, bandwidth)."""
    if len(closes) < period:
        last = closes[-1] if closes else 1.0
        return {"upper": last * 1.01, "middle": last, "lower": last * 0.99, "bandwidth": 0.02}

    window = closes[-period:]
    mean = sum(window) / period
    variance = sum((x - mean) ** 2 for x in window) / period
    std_dev = math.sqrt(variance)

    upper = mean + (num_std * std_dev)
    lower = mean - (num_std * std_dev)
    bandwidth = (upper - lower) / mean if mean != 0 else 0.0

    return {
        "upper": round(upper, 4),
        "middle": round(mean, 4),
        "lower": round(lower, 4),
        "bandwidth": round(bandwidth, 4),
    }


def calculate_vwap(candles: List[Dict[str, Any]]) -> float:
    """Calculates intraday Volume Weighted Average Price."""
    if not candles:
        return 0.0

    recent = candles[-40:]
    total_pv = 0.0
    total_vol = 0.0

    for c in recent:
        typical_price = (c["high"] + c["low"] + c["close"]) / 3.0
        vol = c["volume"] if c.get("volume", 0) > 0 else 1.0
        total_pv += typical_price * vol
        total_vol += vol

    if total_vol > 0:
        return round(total_pv / total_vol, 4)
    return candles[-1]["close"]


def find_swing_points(
    candles: List[Dict[str, Any]], left_bars: int = 2, right_bars: int = 2
) -> Tuple[List[float], List[float]]:
    """Identifies swing highs and swing lows."""
    swing_highs = []
    swing_lows = []

    for i in range(left_bars, len(candles) - right_bars):
        curr = candles[i]
        is_high = True
        is_low = True

        for j in range(1, left_bars + 1):
            if candles[i - j]["high"] >= curr["high"]:
                is_high = False
            if candles[i - j]["low"] <= curr["low"]:
                is_low = False

        for j in range(1, right_bars + 1):
            if candles[i + j]["high"] > curr["high"]:
                is_high = False
            if candles[i + j]["low"] < curr["low"]:
                is_low = False

        if is_high:
            swing_highs.append(curr["high"])
        if is_low:
            swing_lows.append(curr["low"])

    return swing_highs, swing_lows


def compute_all_indicators(candles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Computes all required technical indicators in a single deterministic pass."""
    closes = [c["close"] for c in candles]

    ema9_series = calculate_ema(closes, 9)
    ema21_series = calculate_ema(closes, 21)
    ema50_series = calculate_ema(closes, 50)
    ema200_series = calculate_ema(closes, 200)

    return {
        "ema9": round(ema9_series[-1], 4),
        "ema21": round(ema21_series[-1], 4),
        "ema50": round(ema50_series[-1], 4),
        "ema200": round(ema200_series[-1], 4),
        "rsi14": calculate_rsi(closes, 14),
        "macd": calculate_macd(closes, 12, 26, 9),
        "atr14": calculate_atr(candles, 14),
        "adx14": calculate_adx(candles, 14),
        "bollinger": calculate_bollinger_bands(closes, 20, 2.0),
        "vwap": calculate_vwap(candles),
    }
