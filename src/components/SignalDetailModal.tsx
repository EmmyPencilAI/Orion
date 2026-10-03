import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  Info,
  Layers,
  Minus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ForexSignal, SupportedSymbol } from '../types/signal';
import { triggerHaptic } from '../services/device';

interface SignalDetailModalProps {
  signal: ForexSignal;
  onClose: () => void;
  onCopyToast: (message: string) => void;
}

export function SignalDetailModal({
  signal,
  onClose,
  onCopyToast,
}: SignalDetailModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [accountBalance, setAccountBalance] = useState<number>(250);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [manualLot, setManualLot] = useState<number>(0.01);
  const [lotMode, setLotMode] = useState<'auto' | 'manual'>('auto');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isGold = signal.symbol === 'XAUUSD';
  const isJpy = signal.symbol === 'USDJPY';
  const decimals = isGold ? 2 : isJpy ? 3 : 5;

  const handleCopy = (text: string, label: string, key: string) => {
    triggerHaptic('light');
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onCopyToast(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Precise pip/point calculations
  const calculateMetrics = () => {
    if (!signal.stop_loss || !signal.current_price) {
      return {
        pips: 0,
        lotSize: '0.01',
        effectiveLot: 0.01,
        riskDollar: 0,
        tp1Dollar: 0,
        tp2Dollar: 0,
        tp3Dollar: 0,
        pipValue: 0.1,
      };
    }

    const priceDiff = Math.abs(signal.current_price - signal.stop_loss);
    let pipsOrPoints = 0;
    let pipValuePer001 = 0.1; // default for EURUSD/GBPUSD: 0.01 lot = $0.10/pip

    if (isGold) {
      // 1 gold point = $0.01. $1 gold move = 100 points.
      // 0.01 lot of gold (1 oz) moves $1.00 per $1 price change.
      pipsOrPoints = Number(priceDiff.toFixed(2));
      pipValuePer001 = 1.0; // $1 per $1 gold change on 0.01 lot
    } else if (isJpy) {
      // 1 pip = 0.01 JPY. 0.01 lot moves ~$0.065 per pip.
      pipsOrPoints = Number((priceDiff * 100).toFixed(1));
      pipValuePer001 = 0.065;
    } else {
      // EURUSD, GBPUSD, USDCAD: 1 pip = 0.0001
      pipsOrPoints = Number((priceDiff * 10000).toFixed(1));
      pipValuePer001 = signal.symbol === 'USDCAD' ? 0.075 : 0.10;
    }

    const maxRiskDollars = (accountBalance * riskPercent) / 100;

    let computedLot = 0.01;
    if (lotMode === 'auto') {
      if (isGold) {
        // gold change in $ * 100 = total dollar move per full lot
        const riskPer001 = priceDiff * 1.0;
        if (riskPer001 > 0) {
          const lots = (maxRiskDollars / riskPer001) * 0.01;
          computedLot = Math.max(0.01, Number(lots.toFixed(2)));
        }
      } else {
        const riskPer001 = pipsOrPoints * pipValuePer001;
        if (riskPer001 > 0) {
          const lots = (maxRiskDollars / riskPer001) * 0.01;
          computedLot = Math.max(0.01, Number(lots.toFixed(2)));
        }
      }
    } else {
      computedLot = manualLot;
    }

    const effectiveLot = Number(computedLot.toFixed(2));
    const lotMultiplier = effectiveLot / 0.01;

    let riskDollar = 0;
    let tp1Dollar = 0;
    let tp2Dollar = 0;
    let tp3Dollar = 0;

    if (isGold) {
      riskDollar = priceDiff * 100 * (effectiveLot / 1.0);
      if (signal.take_profit_1) {
        tp1Dollar = Math.abs(signal.take_profit_1 - signal.current_price) * 100 * (effectiveLot / 1.0);
      }
      if (signal.take_profit_2) {
        tp2Dollar = Math.abs(signal.take_profit_2 - signal.current_price) * 100 * (effectiveLot / 1.0);
      }
      if (signal.take_profit_3) {
        tp3Dollar = Math.abs(signal.take_profit_3 - signal.current_price) * 100 * (effectiveLot / 1.0);
      }
    } else {
      riskDollar = pipsOrPoints * pipValuePer001 * lotMultiplier;
      if (signal.take_profit_1) {
        const tp1Diff = Math.abs(signal.take_profit_1 - signal.current_price) * (isJpy ? 100 : 10000);
        tp1Dollar = tp1Diff * pipValuePer001 * lotMultiplier;
      }
      if (signal.take_profit_2) {
        const tp2Diff = Math.abs(signal.take_profit_2 - signal.current_price) * (isJpy ? 100 : 10000);
        tp2Dollar = tp2Diff * pipValuePer001 * lotMultiplier;
      }
      if (signal.take_profit_3) {
        const tp3Diff = Math.abs(signal.take_profit_3 - signal.current_price) * (isJpy ? 100 : 10000);
        tp3Dollar = tp3Diff * pipValuePer001 * lotMultiplier;
      }
    }

    return {
      pips: pipsOrPoints,
      lotSize: effectiveLot.toFixed(2),
      effectiveLot,
      riskDollar: Number(riskDollar.toFixed(2)),
      tp1Dollar: Number(tp1Dollar.toFixed(2)),
      tp2Dollar: Number(tp2Dollar.toFixed(2)),
      tp3Dollar: Number(tp3Dollar.toFixed(2)),
      pipValue: Number((pipValuePer001 * lotMultiplier).toFixed(2)),
    };
  };

  const metrics = calculateMetrics();

  const copyFullOrder = () => {
    triggerHaptic('medium');
    const text = [
      `⚡ ORION MT5 ORDER TICKET ⚡`,
      `Instrument: ${signal.symbol}`,
      `Action: ${signal.direction}`,
      `Current Price: ${signal.current_price.toFixed(decimals)}`,
      `Lot Size: ${metrics.lotSize} Lots`,
      `Entry Zone: ${signal.entry_zone ? signal.entry_zone.display : 'Market Execution'}`,
      `Stop Loss: ${signal.stop_loss ?? 'None'} (SL Risk: ~$${metrics.riskDollar})`,
      `Take Profit 1: ${signal.take_profit_1 ?? 'None'} (+$${metrics.tp1Dollar})`,
      `Take Profit 2: ${signal.take_profit_2 ?? 'None'} (+$${metrics.tp2Dollar})`,
      `Take Profit 3: ${signal.take_profit_3 ?? 'None'} (+$${metrics.tp3Dollar})`,
      `Confidence: ${signal.confidence}% • Status: ${signal.status}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    onCopyToast('Copied full MT5 order parameters!');
  };

  const isBuy = signal.direction === 'BUY';
  const isSell = signal.direction === 'SELL';
  const isWait = signal.direction === 'WAIT';

  return (
    <div className="fixed inset-0 z-50 bg-[#07070A] flex flex-col overflow-y-auto no-scrollbar animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-[#07070A]/95 backdrop-blur border-b border-[rgba(255,107,0,0.25)] px-4 py-3 safe-top flex items-center justify-between">
        <button
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          className="pressable w-9 h-9 rounded-xl bg-[#13131A] border border-[rgba(255,255,255,0.12)] flex items-center justify-center text-white hover:border-[#FF6B00]"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="text-center">
          <div className="font-orbitron text-[10px] uppercase tracking-widest text-[#FF6B00] font-bold">
            SIGNAL INSPECTOR
          </div>
          <div className="font-orbitron text-base font-black text-white flex items-center justify-center gap-1.5">
            <span>{signal.symbol}</span>
          </div>
        </div>

        <button
          onClick={copyFullOrder}
          className="pressable px-3 py-1.5 rounded-xl bg-[#FF6B00] text-black font-orbitron font-bold text-xs flex items-center gap-1 glow-orange-sm"
        >
          <Copy className="w-3.5 h-3.5 text-black" />
          <span>MT5</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4 pb-28 font-tech">
        {/* Direction & Status Hero Card */}
        <div className="bg-[#13131A] border border-[rgba(255,107,0,0.3)] rounded-2xl p-5 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between">
            <div>
              <span className="font-orbitron text-[11px] text-[#B6B4C2] uppercase tracking-wider block mb-1">
                Direction Bias
              </span>
              <div className="flex items-center gap-2">
                <div
                  className={`px-3.5 py-1 rounded-xl font-orbitron text-lg font-black tracking-wider flex items-center gap-1.5 ${
                    isBuy
                      ? 'bg-[rgba(16,185,129,0.18)] text-[#10B981] border border-[rgba(16,185,129,0.4)]'
                      : isSell
                      ? 'bg-[rgba(239,68,68,0.18)] text-[#EF4444] border border-[rgba(239,68,68,0.4)]'
                      : 'bg-[#1C1C28] text-[#FF9500] border border-[rgba(255,149,0,0.3)]'
                  }`}
                >
                  {isBuy && <TrendingUp className="w-5 h-5 text-[#10B981]" />}
                  {isSell && <TrendingDown className="w-5 h-5 text-[#EF4444]" />}
                  {isWait && <Clock className="w-5 h-5 text-[#FF9500]" />}
                  <span>{signal.direction}</span>
                </div>
                <span className="text-[11px] font-orbitron px-2.5 py-1 rounded-lg bg-[#1C1C28] text-white border border-[rgba(255,255,255,0.12)]">
                  {signal.status}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-orbitron text-[10px] text-[#B6B4C2] uppercase tracking-wider mb-0.5">
                Confidence
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-orbitron text-3xl font-black text-[#FF6B00] tracking-tight">
                  {signal.confidence}%
                </span>
              </div>
              <span className="text-[10px] text-[#726E82]">
                {signal.confidence >= 85
                  ? 'Strong Confluence'
                  : signal.confidence >= 75
                  ? 'Verified Setup'
                  : 'Watchlist / Wait'}
              </span>
            </div>
          </div>

          {/* Current Live Price Banner */}
          <div className="mt-4 pt-3.5 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
            <div>
              <span className="text-xs text-[#B6B4C2] block">Current Market Price</span>
              <span className="font-orbitron text-2xl font-black tracking-wider text-white">
                {signal.current_price > 0
                  ? signal.current_price.toLocaleString(undefined, {
                      minimumFractionDigits: decimals,
                      maximumFractionDigits: decimals,
                    })
                  : 'Scanning...'}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#726E82] block">Timeframe Status</span>
              <span className="font-orbitron text-xs text-white">H1 + M15 + M5</span>
            </div>
          </div>
        </div>

        {/* Suggested Entry Card */}
        <div className="bg-[#13131A] border border-[rgba(255,255,255,0.1)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#FF6B00]" />
              <span className="font-orbitron text-xs font-bold uppercase tracking-wider text-white">
                Calculated Entry Zone
              </span>
            </div>
            {signal.entry_zone && (
              <button
                onClick={() => handleCopy(signal.entry_zone!.display, 'Entry Zone', 'entry')}
                className="pressable p-1.5 rounded-lg bg-[#1C1C28] text-white hover:bg-[#252536]"
              >
                {copiedKey === 'entry' ? (
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            )}
          </div>

          <div className="p-3 rounded-xl bg-[#0E0E14] border border-[rgba(255,107,0,0.2)]">
            <div className="font-orbitron text-base font-bold text-white tracking-wider">
              {signal.entry_zone ? signal.entry_zone.display : 'WAIT: Awaiting confirmed entry setup'}
            </div>
            <p className="text-xs text-[#B6B4C2] mt-1">
              {isBuy
                ? 'Wait for confirmed pullback toward EMA support before opening manual order.'
                : isSell
                ? 'Wait for confirmed pullback toward EMA resistance before opening manual order.'
                : 'Market in chop or extension. Wait for clean structure alignment.'}
            </p>
          </div>
        </div>

        {/* Stop Loss & Target TP1 Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Stop Loss */}
          <div className="bg-[#13131A] border border-[rgba(239,68,68,0.25)] rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-orbitron text-[11px] font-bold uppercase text-[#EF4444] flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Stop Loss
              </span>
              {signal.stop_loss && (
                <button
                  onClick={() => handleCopy(signal.stop_loss!.toString(), 'Stop Loss', 'sl')}
                  className="pressable p-1 rounded bg-[#1C1C28] text-white"
                >
                  {copiedKey === 'sl' ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
            <div className="font-orbitron text-base font-black text-[#EF4444]">
              {signal.stop_loss ? signal.stop_loss.toLocaleString(undefined, { minimumFractionDigits: decimals }) : 'N/A'}
            </div>
            <span className="text-[11px] text-[#B6B4C2]">
              Risk: ~{metrics.pips} {isGold ? 'pts' : 'pips'} (${metrics.riskDollar})
            </span>
          </div>

          {/* TP1 */}
          <div className="bg-[#13131A] border border-[rgba(16,185,129,0.25)] rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-orbitron text-[11px] font-bold uppercase text-[#10B981] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Target TP1
              </span>
              {signal.take_profit_1 && (
                <button
                  onClick={() => handleCopy(signal.take_profit_1!.toString(), 'TP1', 'tp1')}
                  className="pressable p-1 rounded bg-[#1C1C28] text-white"
                >
                  {copiedKey === 'tp1' ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
            <div className="font-orbitron text-base font-black text-[#10B981]">
              {signal.take_profit_1 ? signal.take_profit_1.toLocaleString(undefined, { minimumFractionDigits: decimals }) : 'N/A'}
            </div>
            <span className="text-[11px] text-[#B6B4C2]">
              R:R 1:1.5 (+${metrics.tp1Dollar})
            </span>
          </div>
        </div>

        {/* TP2 & TP3 Extensions */}
        {signal.take_profit_2 && signal.take_profit_3 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#13131A] border border-[rgba(255,255,255,0.08)] rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="font-orbitron text-[10px] text-[#B6B4C2] uppercase">TP2 (1:2.5)</span>
                <div className="font-orbitron text-sm font-bold text-white">{signal.take_profit_2}</div>
                <span className="text-[10px] text-[#10B981]">Profit: +${metrics.tp2Dollar}</span>
              </div>
              <button
                onClick={() => handleCopy(signal.take_profit_2!.toString(), 'TP2', 'tp2')}
                className="pressable p-1.5 rounded-lg bg-[#1C1C28] text-white"
              >
                {copiedKey === 'tp2' ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3 text-white" />}
              </button>
            </div>

            <div className="bg-[#13131A] border border-[rgba(255,255,255,0.08)] rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="font-orbitron text-[10px] text-[#B6B4C2] uppercase">TP3 (1:4.0)</span>
                <div className="font-orbitron text-sm font-bold text-white">{signal.take_profit_3}</div>
                <span className="text-[10px] text-[#10B981]">Profit: +${metrics.tp3Dollar}</span>
              </div>
              <button
                onClick={() => handleCopy(signal.take_profit_3!.toString(), 'TP3', 'tp3')}
                className="pressable p-1.5 rounded-lg bg-[#1C1C28] text-white"
              >
                {copiedKey === 'tp3' ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3 text-white" />}
              </button>
            </div>
          </div>
        )}

        {/* MT5 LOT SIZE HELPER (Small Account & Micro Lot 0.01 Support) */}
        <div className="bg-[#13131A] border border-[rgba(255,107,0,0.35)] rounded-2xl p-4 space-y-3.5 glow-orange-sm">
          <div className="flex items-center justify-between">
            <span className="font-orbitron text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#FF6B00]" />
              MT5 Lot Sizer Helper
            </span>

            {/* Mode Switcher */}
            <div className="flex bg-[#0E0E14] p-0.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[10px]">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setLotMode('auto');
                }}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  lotMode === 'auto'
                    ? 'bg-[#FF6B00] text-black'
                    : 'text-[#B6B4C2]'
                }`}
              >
                Auto Risk %
              </button>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setLotMode('manual');
                }}
                className={`px-2 py-0.5 rounded-md font-bold transition ${
                  lotMode === 'manual'
                    ? 'bg-[#FF6B00] text-black'
                    : 'text-[#B6B4C2]'
                }`}
              >
                Manual Lots
              </button>
            </div>
          </div>

          {/* Account Balance Selectors (Small accounts supported: $50, $100, $250, $500, $1000) */}
          <div>
            <span className="text-xs text-[#B6B4C2] block mb-1">
              Account Equity ($USD)
            </span>
            <div className="grid grid-cols-5 gap-1 text-center">
              {[50, 100, 250, 500, 1000].map((bal) => (
                <button
                  key={bal}
                  onClick={() => {
                    triggerHaptic('light');
                    setAccountBalance(bal);
                  }}
                  className={`py-1 rounded-lg font-orbitron text-[11px] font-bold border transition ${
                    accountBalance === bal
                      ? 'bg-[#FF6B00] text-black border-[#FF6B00]'
                      : 'bg-[#0E0E14] border-[rgba(255,255,255,0.08)] text-white'
                  }`}
                >
                  ${bal}
                </button>
              ))}
            </div>

            {/* Custom Balance Input */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[11px] text-[#726E82]">Custom $</span>
              <input
                type="number"
                value={accountBalance}
                onChange={(e) => setAccountBalance(Math.max(1, Number(e.target.value)))}
                className="w-28 px-2 py-1 rounded-lg bg-[#0E0E14] border border-[rgba(255,255,255,0.1)] text-xs font-orbitron text-white text-center"
              />
            </div>
          </div>

          {/* Interactive Lot Controls */}
          <div className="p-3 rounded-xl bg-[#0E0E14] border border-[rgba(255,255,255,0.08)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[#B6B4C2] block">Recommended MT5 Volume</span>
                <span className="font-orbitron text-2xl font-black text-[#FF6B00]">
                  {metrics.lotSize} Lots
                </span>
              </div>

              {/* Incremental +/- 0.01 Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setLotMode('manual');
                    setManualLot(Math.max(0.01, Number((metrics.effectiveLot - 0.01).toFixed(2))));
                  }}
                  className="pressable w-8 h-8 rounded-lg bg-[#1C1C28] border border-[rgba(255,255,255,0.15)] flex items-center justify-center text-white"
                  title="Minus 0.01 Lot"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setLotMode('manual');
                    setManualLot(0.01);
                  }}
                  className="pressable px-2 py-1 rounded-lg bg-[#1C1C28] border border-[rgba(255,255,255,0.15)] font-orbitron text-[10px] text-white font-bold"
                  title="Reset to Micro Lot 0.01"
                >
                  0.01 MIN
                </button>

                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setLotMode('manual');
                    setManualLot(Number((metrics.effectiveLot + 0.01).toFixed(2)));
                  }}
                  className="pressable w-8 h-8 rounded-lg bg-[#1C1C28] border border-[rgba(255,255,255,0.15)] flex items-center justify-center text-white"
                  title="Plus 0.01 Lot"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Real Dollar Risk & Profit Calculation */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)] text-center text-xs">
              <div className="p-1.5 rounded-lg bg-[#13131A]">
                <span className="text-[10px] text-[#726E82] block">Max Risk ($)</span>
                <span className="font-orbitron font-bold text-[#EF4444]">
                  -${metrics.riskDollar}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#13131A]">
                <span className="text-[10px] text-[#726E82] block">TP1 Profit ($)</span>
                <span className="font-orbitron font-bold text-[#10B981]">
                  +${metrics.tp1Dollar}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#13131A]">
                <span className="text-[10px] text-[#726E82] block">TP2 Profit ($)</span>
                <span className="font-orbitron font-bold text-[#10B981]">
                  +${metrics.tp2Dollar}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Rationale Checklist */}
        <div className="bg-[#13131A] border border-[rgba(255,255,255,0.1)] rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-orbitron text-xs font-bold uppercase tracking-wider text-white">
              Confluence Factors
            </span>
            <span className="text-[10px] text-[#FF6B00] font-orbitron">Deterministic Rules</span>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            {signal.reason.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[#B6B4C2]">
                {r.toLowerCase().includes('bullish') || r.toLowerCase().includes('confluence') || r.toLowerCase().includes('positive') ? (
                  <ArrowUpRight className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                ) : r.toLowerCase().includes('bearish') || r.toLowerCase().includes('negative') ? (
                  <ArrowDownRight className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Indicators Accordion */}
        <div className="bg-[#13131A] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
          <button
            onClick={() => {
              triggerHaptic('light');
              setShowAdvanced(!showAdvanced);
            }}
            className="w-full p-4 flex items-center justify-between text-left pressable"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FF6B00]" />
              <span className="font-orbitron text-xs font-bold uppercase tracking-wider text-white">
                Detailed Indicator Values
              </span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white" />
            )}
          </button>

          {showAdvanced && signal.indicators && (
            <div className="p-4 pt-0 border-t border-[rgba(255,255,255,0.06)] grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-[#0E0E14]">
                <span className="text-[10px] text-[#726E82] block">EMA 9 / 21</span>
                <span className="font-orbitron text-white text-[11px]">
                  {signal.indicators.ema9} / {signal.indicators.ema21}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#0E0E14]">
                <span className="text-[10px] text-[#726E82] block">EMA 50 / 200</span>
                <span className="font-orbitron text-white text-[11px]">
                  {signal.indicators.ema50} / {signal.indicators.ema200}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#0E0E14]">
                <span className="text-[10px] text-[#726E82] block">RSI (14)</span>
                <span className="font-orbitron text-white text-[11px]">
                  {signal.indicators.rsi14}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#0E0E14]">
                <span className="text-[10px] text-[#726E82] block">ADX (14)</span>
                <span className="font-orbitron text-white text-[11px]">
                  {signal.indicators.adx14}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#07070A]/95 backdrop-blur border-t border-[rgba(255,107,0,0.3)] safe-bottom max-w-lg mx-auto">
        <button
          onClick={copyFullOrder}
          className="pressable w-full py-3.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-black font-orbitron font-black text-sm flex items-center justify-center gap-2 glow-orange"
        >
          <Copy className="w-4 h-4 text-black" />
          <span>COPY MT5 TICKET ({metrics.lotSize} LOTS)</span>
        </button>
      </div>
    </div>
  );
}
