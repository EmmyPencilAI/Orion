export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = 'M5' | 'M15' | 'H1';

export type SignalDirection = 'BUY' | 'SELL' | 'WAIT';

export type SignalStatus =
  | 'VALID'
  | 'STRONG'
  | 'WATCH'
  | 'NO_TRADE'
  | 'DATA_UNAVAILABLE'
  | 'ENTRY_MISSED'
  | 'WEEKEND_PAUSE';

export type SupportedSymbol = 'XAUUSD' | 'USDJPY' | 'EURUSD' | 'GBPUSD' | 'USDCAD';

export interface EntryZone {
  min: number;
  max: number;
  display: string;
}

export interface RiskReward {
  tp1: string;
  tp2: string;
  tp3: string;
}

export interface IndicatorValues {
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  atr14: number;
  adx14: number;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
  vwap?: number;
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  trend: 'BULLISH' | 'BEARISH' | 'CHOPPY' | 'NEUTRAL';
  structure: string;
  momentum: 'POSITIVE' | 'NEGATIVE' | 'WEAK' | 'DIVERGENT';
  adx: number;
  rsi: number;
  emaAlignment: 'BULLISH' | 'BEARISH' | 'MIXED';
  keyLevels: {
    resistance: number;
    support: number;
  };
}

export interface ForexSignal {
  signal_id: string;
  symbol: SupportedSymbol;
  direction: SignalDirection;
  confidence: number;
  created_at: string;
  current_price: number;
  entry_zone: EntryZone | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  take_profit_3: number | null;
  risk_reward: RiskReward | null;
  reason: string[];
  status: SignalStatus;
  data_timestamp?: string;
  is_stale?: boolean;
  market_open?: boolean;
  weekend_notice?: string;
  friday_close?: number;
  score_breakdown?: {
    h1_trend: number;
    m15_confirmation: number;
    m5_setup: number;
    ema_structure: number;
    momentum: number;
    rsi_macd: number;
    support_resistance: number;
    volatility: number;
    total: number;
  };
  mtf_analysis?: {
    h1: TimeframeAnalysis;
    m15: TimeframeAnalysis;
    m5: TimeframeAnalysis;
  };
  indicators?: IndicatorValues;
}

export interface MarketSessionInfo {
  is_open: boolean;
  status: 'OPEN' | 'WEEKEND_CLOSED';
  message: string;
  reopen_time: string;
  hours_to_open?: number;
}

export interface ScannerState {
  status: 'ok' | 'initializing' | 'error';
  scanner: 'running' | 'idle' | 'stopped';
  last_scan_at: string | null;
  next_scan_seconds: number;
  total_scans: number;
  uptime_seconds: number;
  market_session: MarketSessionInfo;
  symbols: Record<SupportedSymbol, ForexSignal>;
}
