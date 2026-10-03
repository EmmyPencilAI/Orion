import React from 'react';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type?: 'success' | 'info' | 'warning';
}

export function Toast({ message, type = 'success' }: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-150">
      <div className="px-4 py-2.5 rounded-2xl bg-[#13131A] border border-[#FF6B00] shadow-2xl shadow-black flex items-center gap-2.5 backdrop-blur text-xs font-orbitron font-semibold text-white glow-orange-sm">
        {type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#FF6B00]" />}
        {type === 'info' && <Info className="w-4 h-4 text-white" />}
        {type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
        <span>{message}</span>
      </div>
    </div>
  );
}
