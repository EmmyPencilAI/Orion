import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Info,
  Layers,
  Moon,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ForexSignal, ScannerState, SupportedSymbol } from './types/signal';
import { SignalDetailModal } from './components/SignalDetailModal';
import { BottomNav, TabType } from './components/BottomNav';
import { Toast } from './components/Toast';
import {
  triggerHaptic,
  requestNotificationPermission,
  sendLocalNotification,
  loadPreferences,
  savePreferences,
  AppPreferences,
} from './services/device';
import { ALL_SYMBOLS } from './services/scanner';

const SYMBOL_LABELS: Record<SupportedSymbol, { name: string; tag: string; icon: string }> = {
  XAUUSD: { name: 'Spot Gold / USD', tag: 'GOLD', icon: 'AU' },
  USDJPY: { name: 'US Dollar / Yen', tag: 'FOREX', icon: '¥' },
  EURUSD: { name: 'Euro / US Dollar', tag: 'FOREX', icon: '€' },
  GBPUSD: { name: 'British Pound / USD', tag: 'FOREX', icon: '£' },
  USDCAD: { name: 'US Dollar / Canadian', tag: 'FOREX', icon: 'C$' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [scannerState, setScannerState] = useState<ScannerState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<ForexSignal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>(loadPreferences());
  const [signalFilter, setSignalFilter] = useState<'all' | 'actionable' | 'wait'>('all');
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [customUrlInput, setCustomUrlInput] = useState(preferences.customBackendUrl);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  }, []);

  const getApiBase = useCallback(() => {
    return preferences.customBackendUrl.trim() || '';
  }, [preferences.customBackendUrl]);

  // Fetch signals
  const fetchSignals = useCallback(async () => {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/status`);
      if (res.ok) {
        const data: ScannerState = await res.json();
        setScannerState(data);
        setBackendStatus('online');

        if (preferences.notificationsEnabled && data?.symbols && data.market_session.is_open) {
          for (const sym of ALL_SYMBOLS) {
            const sig = data.symbols[sym];
            if (sig && sig.direction !== 'WAIT' && sig.confidence >= preferences.minConfidence) {
              sendLocalNotification(
                `⚡ ${sym} ${sig.direction} Signal (${sig.confidence}%)`,
                `Entry: ${sig.entry_zone?.display || sig.current_price} • SL: ${sig.stop_loss} • TP1: ${sig.take_profit_1}`,
                `signal-${sym}-${sig.signal_id}`
              );
            }
          }
        }
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  }, [getApiBase, preferences]);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 4000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  const handleManualRefresh = async () => {
    triggerHaptic('medium');
    setIsRefreshing(true);
    try {
      const base = getApiBase();
      await fetch(`${base}/api/scan-now`, { method: 'POST' });
      await fetchSignals();
      showToast('Market quotes refreshed');
    } catch {
      showToast('Could not reach backend');
    } finally {
      setIsRefreshing(false);
    }
  };

  const updatePreferences = (newPrefs: Partial<AppPreferences>) => {
    triggerHaptic('light');
    const updated = { ...preferences, ...newPrefs };
    setPreferences(updated);
    savePreferences(updated);
  };

  const handleToggleNotifications = async () => {
    triggerHaptic('medium');
    if (!preferences.notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        updatePreferences({ notificationsEnabled: true });
        showToast('Notifications enabled');
      } else {
        showToast('Permission denied');
      }
    } else {
      updatePreferences({ notificationsEnabled: false });
      showToast('Notifications disabled');
    }
  };

  const allSignalsList: ForexSignal[] = useMemo(() => {
    if (!scannerState?.symbols) return [];
    return ALL_SYMBOLS.map((sym) => scannerState.symbols[sym]).filter(Boolean);
  }, [scannerState]);

  const isMarketOpen = scannerState?.market_session?.is_open ?? false;

  const actionableCount = useMemo(() => {
    if (!isMarketOpen) return 0;
    return allSignalsList.filter((s) => s.direction !== 'WAIT' && s.confidence >= 75).length;
  }, [allSignalsList, isMarketOpen]);

  const filteredSignals = useMemo(() => {
    if (signalFilter === 'actionable') {
      return allSignalsList.filter((s) => s.direction !== 'WAIT');
    }
    if (signalFilter === 'wait') {
      return allSignalsList.filter((s) => s.direction === 'WAIT');
    }
    return allSignalsList;
  }, [allSignalsList, signalFilter]);

  const getRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Waiting for scan';
    const diffSeconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSeconds < 15) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    return `${diffMinutes}m ago`;
  };

  return (
    <div className="min-h-screen bg-[#07070A] text-white flex flex-col font-tech selection:bg-[#FF6B00]/40 pb-20">
      <Toast message={toastMessage} />

      {/* Top App Bar with Institutional Orange & White Header */}
      <header className="sticky top-0 z-30 bg-[#07070A]/95 backdrop-blur border-b border-[rgba(255,107,0,0.25)] px-4 py-3 safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {/* Logo & Product Identity */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6B00] to-white p-[1px] flex items-center justify-center glow-orange-sm">
              <div className="w-full h-full bg-[#0E0E14] rounded-[11px] flex items-center justify-center">
                <span className="font-orbitron text-xs font-black text-[#FF6B00]">O</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-orbitron text-sm font-black tracking-wider text-white">ORION</span>
                <span className="font-orbitron text-[9px] px-1.5 py-0.2 rounded bg-[#FF6B00] text-black font-black">
                  MT5
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#B6B4C2]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    !isMarketOpen
                      ? 'bg-[#FF9500]'
                      : backendStatus === 'online'
                      ? 'bg-[#10B981] animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="font-mono">
                  {!isMarketOpen
                    ? 'WEEKEND PAUSE • REAL FRIDAY CLOSE'
                    : backendStatus === 'online'
                    ? 'REAL-TIME 60s ENGINE'
                    : 'RECONNECTING...'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="pressable w-8 h-8 rounded-xl bg-[#13131A] border border-[rgba(255,255,255,0.12)] flex items-center justify-center text-white hover:border-[#FF6B00]"
              title="Refresh Quotes Now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF6B00]' : 'text-white'}`} />
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('settings');
              }}
              className="pressable relative w-8 h-8 rounded-xl bg-[#13131A] border border-[rgba(255,255,255,0.12)] flex items-center justify-center text-white hover:border-[#FF6B00]"
            >
              <Bell className="w-3.5 h-3.5" />
              {preferences.notificationsEnabled && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Views */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-4">
        {/* ========================================================= */}
        {/* REAL MARKET SESSION BANNER (WEEKEND PAUSE NOTIFICATION) */}
        {/* ========================================================= */}
        {!isMarketOpen && (
          <div className="bg-[#13131A] border border-[rgba(255,149,0,0.4)] rounded-2xl p-3.5 space-y-2 glow-orange-sm">
            <div className="flex items-center justify-between">
              <span className="font-orbitron text-xs font-bold text-[#FF9500] flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-[#FF9500]" />
                WEEKEND MARKET PAUSE (FOREX CLOSED)
              </span>
              <span className="font-orbitron text-[10px] text-white bg-[#0E0E14] px-2 py-0.5 rounded border border-[rgba(255,255,255,0.1)]">
                VERIFIED REAL PRICES
              </span>
            </div>

            <p className="text-xs text-[#B6B4C2] leading-relaxed">
              Global Forex & Gold markets are closed on weekends. Prices shown are the{' '}
              <strong className="text-white font-mono">official Friday market close quotes</strong>.
              Signals are strictly held at <strong className="text-[#FF9500]">WAIT</strong> to protect trading capital against market open gaps.
            </p>

            <div className="pt-2 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs font-orbitron">
              <span className="text-[#726E82]">Next Session Open:</span>
              <span className="text-white font-bold">
                {scannerState?.market_session?.reopen_time || 'Sunday 21:00 UTC (5 PM EST)'}
              </span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 1: OVERVIEW & 5 PAIRS GRID */}
        {/* ========================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header Status Bar */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <h1 className="font-orbitron text-lg font-black tracking-wider text-white">
                  5-PAIR REAL-TIME RADAR
                </h1>
                <p className="text-xs text-[#B6B4C2]">
                  {isMarketOpen ? 'Live Market Feed Active' : 'Official Friday Closing Quotes'}
                </p>
              </div>

              <div className="text-right">
                <span className="font-orbitron text-[9px] uppercase tracking-wider text-[#726E82] block">
                  Next Scan
                </span>
                <span className="font-orbitron text-xs font-bold text-[#FF6B00]">
                  {scannerState ? `${scannerState.next_scan_seconds}s` : '—'}
                </span>
              </div>
            </div>

            {/* List of All 5 Instruments */}
            <div className="space-y-2.5">
              {allSignalsList.map((sig) => {
                const info = SYMBOL_LABELS[sig.symbol];
                const dec = sig.symbol === 'XAUUSD' ? 2 : sig.symbol === 'USDJPY' ? 3 : 5;
                const isBuy = sig.direction === 'BUY';
                const isSell = sig.direction === 'SELL';

                return (
                  <div
                    key={sig.symbol}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedSignal(sig);
                    }}
                    className="pressable bg-[#13131A] hover:bg-[#181824] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,107,0,0.4)] rounded-2xl p-3.5 cursor-pointer shadow-lg shadow-black/40 relative overflow-hidden transition-all"
                  >
                    <div className="flex items-center justify-between">
                      {/* Left: Icon & Symbol */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0E0E14] border border-[rgba(255,107,0,0.3)] flex items-center justify-center font-orbitron font-bold text-white text-xs glow-orange-sm">
                          {info.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-orbitron font-black text-sm text-white tracking-wider">
                              {sig.symbol}
                            </span>
                            <span className="text-[10px] text-[#726E82] font-mono">
                              {info.tag}
                            </span>
                          </div>
                          <div className="font-orbitron text-base font-black tracking-wider text-white mt-0.5">
                            {sig.current_price > 0
                              ? sig.current_price.toLocaleString(undefined, {
                                  minimumFractionDigits: dec,
                                  maximumFractionDigits: dec,
                                })
                              : 'Scanning...'}
                          </div>
                        </div>
                      </div>

                      {/* Right: Signal Badge & Conviction */}
                      <div className="flex flex-col items-end gap-1">
                        <div
                          className={`px-3 py-1 rounded-xl font-orbitron text-xs font-black tracking-wider flex items-center gap-1 ${
                            isBuy
                              ? 'bg-[rgba(16,185,129,0.18)] text-[#10B981] border border-[rgba(16,185,129,0.35)]'
                              : isSell
                              ? 'bg-[rgba(239,68,68,0.18)] text-[#EF4444] border border-[rgba(239,68,68,0.35)]'
                              : 'bg-[#1C1C28] text-[#FF9500] border border-[rgba(255,149,0,0.25)]'
                          }`}
                        >
                          {isBuy && <TrendingUp className="w-3.5 h-3.5" />}
                          {isSell && <TrendingDown className="w-3.5 h-3.5" />}
                          {sig.direction === 'WAIT' && <Clock className="w-3.5 h-3.5" />}
                          <span>{sig.direction}</span>
                        </div>

                        <span className="font-orbitron text-[10px] text-[#B6B4C2]">
                          {!isMarketOpen ? 'FRIDAY CLOSE' : `${sig.confidence}% Conviction`}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Technical Snippet */}
                    <div className="mt-2.5 pt-2 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs text-[#B6B4C2]">
                      <span className="truncate max-w-[240px]">
                        {!isMarketOpen
                          ? `Official Friday close: ${sig.current_price.toFixed(dec)}`
                          : sig.reason[0] || 'Technical structure synchronized'}
                      </span>
                      <span className="text-[#FF6B00] font-orbitron font-bold text-[10px] flex items-center gap-0.5 shrink-0">
                        <span>INSPECT</span>
                        <ArrowRight className="w-3 h-3 text-[#FF6B00]" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: 5 MARKETS EXPANDED ANALYSIS */}
        {/* ========================================================= */}
        {activeTab === 'markets' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h1 className="font-orbitron text-lg font-black tracking-wider text-white">
                5-MARKET STRUCTURE
              </h1>
              <p className="text-xs text-[#B6B4C2]">
                Verified real prices from the actual market close
              </p>
            </div>

            <div className="space-y-3">
              {allSignalsList.map((sig) => {
                const dec = sig.symbol === 'XAUUSD' ? 2 : sig.symbol === 'USDJPY' ? 3 : 5;

                return (
                  <div
                    key={sig.symbol}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedSignal(sig);
                    }}
                    className="pressable bg-[#13131A] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,107,0,0.4)] rounded-2xl p-4 cursor-pointer space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#0E0E14] border border-[rgba(255,107,0,0.3)] flex items-center justify-center font-orbitron font-bold text-xs text-white">
                          {SYMBOL_LABELS[sig.symbol].icon}
                        </div>
                        <div>
                          <div className="font-orbitron text-sm font-bold text-white">
                            {sig.symbol}
                          </div>
                          <span className="text-[11px] text-[#B6B4C2]">
                            {SYMBOL_LABELS[sig.symbol].name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-orbitron text-base font-bold text-white">
                          {sig.current_price.toLocaleString(undefined, {
                            minimumFractionDigits: dec,
                            maximumFractionDigits: dec,
                          })}
                        </div>
                        <span className="font-orbitron text-[10px] text-[#FF6B00]">
                          {!isMarketOpen ? 'FRIDAY CLOSE' : `${sig.direction} • ${sig.confidence}%`}
                        </span>
                      </div>
                    </div>

                    {/* MTF Matrix */}
                    {sig.mtf_analysis && (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-[#0E0E14] p-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
                          <span className="text-[10px] text-[#726E82] block">H1 Structure</span>
                          <span className="font-orbitron text-xs font-bold text-white">
                            {sig.mtf_analysis.h1.trend}
                          </span>
                        </div>
                        <div className="bg-[#0E0E14] p-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
                          <span className="text-[10px] text-[#726E82] block">M15 Momentum</span>
                          <span className="font-orbitron text-xs font-bold text-white">
                            {sig.mtf_analysis.m15.momentum}
                          </span>
                        </div>
                        <div className="bg-[#0E0E14] p-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
                          <span className="text-[10px] text-[#726E82] block">ADX Volatility</span>
                          <span className="font-orbitron text-xs font-bold text-white">
                            {sig.mtf_analysis.m5.adx}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SIGNALS FEED */}
        {/* ========================================================= */}
        {activeTab === 'signals' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-orbitron text-lg font-black tracking-wider text-white">
                  SIGNALS FEED
                </h1>
                <p className="text-xs text-[#B6B4C2]">
                  {isMarketOpen ? 'Live Market Recommendations' : 'Weekend Capital Protection Active'}
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-1 bg-[#13131A] p-1 rounded-xl border border-[rgba(255,255,255,0.08)] text-[10px]">
                {(['all', 'actionable', 'wait'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      triggerHaptic('light');
                      setSignalFilter(filter);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-orbitron font-bold capitalize transition-all ${
                      signalFilter === filter
                        ? 'bg-[#FF6B00] text-black'
                        : 'text-[#B6B4C2]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredSignals.map((sig) => {
                const isBuy = sig.direction === 'BUY';
                const isSell = sig.direction === 'SELL';

                return (
                  <div
                    key={sig.symbol}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedSignal(sig);
                    }}
                    className="pressable bg-[#13131A] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,107,0,0.4)] rounded-2xl p-4 cursor-pointer space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-orbitron text-sm font-bold text-white tracking-wider">
                            {sig.symbol}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-orbitron text-[10px] font-black ${
                              isBuy
                                ? 'bg-[rgba(16,185,129,0.18)] text-[#10B981]'
                                : isSell
                                ? 'bg-[rgba(239,68,68,0.18)] text-[#EF4444]'
                                : 'bg-[#1C1C28] text-[#FF9500]'
                            }`}
                          >
                            {sig.direction}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#726E82]">
                          {!isMarketOpen ? 'Session: Weekend Pause' : `Generated ${getRelativeTime(sig.created_at)}`}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-orbitron text-xs font-bold text-[#FF6B00]">
                          {!isMarketOpen ? 'FRIDAY CLOSE' : `${sig.confidence}%`}
                        </span>
                        <span className="font-orbitron text-[9px] text-[#726E82] block">{sig.status}</span>
                      </div>
                    </div>

                    {/* Entry & Targets Strip */}
                    <div className="p-2.5 rounded-xl bg-[#0E0E14] border border-[rgba(255,255,255,0.06)] grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#726E82] block">Verified Price</span>
                        <span className="font-orbitron text-white font-semibold truncate block">
                          {sig.current_price}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#726E82] block">Status</span>
                        <span className="font-orbitron text-[#FF9500] font-semibold truncate block">
                          {sig.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#726E82] block">Action</span>
                        <span className="font-orbitron text-white font-semibold truncate block">
                          {sig.direction}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#B6B4C2] flex items-center justify-between">
                      <span className="truncate max-w-[240px]">{sig.reason[0]}</span>
                      <span className="text-[#FF6B00] font-orbitron font-bold text-[10px]">
                        INSPECT &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: CONFIGURATION & RENDER DEPLOYMENT AS WEB SERVICE */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h1 className="font-orbitron text-lg font-black tracking-wider text-white">
                RENDER WEB SERVICE CONFIG
              </h1>
              <p className="text-xs text-[#B6B4C2]">
                Zero-cost 24/7 autonomous deployment instructions
              </p>
            </div>

            {/* Render Deployment Ready Card */}
            <div className="bg-[#13131A] border border-[rgba(255,107,0,0.35)] rounded-2xl p-4 space-y-3 glow-orange-sm">
              <span className="font-orbitron text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Server className="w-4 h-4 text-[#FF6B00]" />
                Deploy to Render as a Web Service
              </span>

              <div className="space-y-2 text-xs text-[#B6B4C2]">
                <p>
                  This repo contains all verified Python files for Render:
                </p>
                <div className="p-2.5 rounded-xl bg-[#0E0E14] font-mono text-white text-[11px] space-y-1">
                  <div><strong>Build Command:</strong> <span className="text-[#FF6B00]">pip install -r requirements.txt</span></div>
                  <div><strong>Start Command:</strong> <span className="text-[#FF6B00]">uvicorn main:app --host 0.0.0.0 --port $PORT</span></div>
                  <div><strong>Health Check:</strong> <span className="text-[#FF6B00]">/health</span></div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0E0E14] border border-[rgba(255,255,255,0.06)] text-[11px] space-y-1">
                  <span className="text-white font-bold block">5-Minute External Keep-Alive Cron:</span>
                  <p>
                    Set a free monitor on <strong>Cron-Job.org</strong> to ping:
                  </p>
                  <code className="text-[#FF6B00] block text-[10px]">
                    https://&lt;your-render-app&gt;.onrender.com/health
                  </code>
                </div>
              </div>
            </div>

            {/* Custom Backend URL input */}
            <div className="bg-[#13131A] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 space-y-2.5">
              <span className="font-orbitron text-xs font-bold uppercase tracking-wider text-white">
                Render Service Endpoint
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://your-bot.onrender.com"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#0E0E14] border border-[rgba(255,255,255,0.08)] text-xs text-white placeholder-[#726E82] focus:outline-none focus:border-[#FF6B00]"
                />
                <button
                  onClick={() => {
                    updatePreferences({ customBackendUrl: customUrlInput });
                    fetchSignals();
                    showToast('Saved custom backend');
                  }}
                  className="pressable px-3 py-2 rounded-xl bg-[#FF6B00] text-black font-orbitron font-bold text-xs"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-[#13131A] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 space-y-3">
              <span className="font-orbitron text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#FF6B00]" />
                Signal Alerts
              </span>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0E0E14] text-xs">
                <div>
                  <span className="font-bold text-white block">Signal Alerts</span>
                  <span className="text-[10px] text-[#726E82]">Notify on verified BUY/SELL setups</span>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  className={`pressable w-11 h-6 rounded-full transition-colors relative ${
                    preferences.notificationsEnabled ? 'bg-[#FF6B00]' : 'bg-[#1C1C28]'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Dedicated Signal Detail Modal */}
      {selectedSignal && (
        <SignalDetailModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
          onCopyToast={showToast}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        signalsCount={actionableCount}
      />
    </div>
  );
}
