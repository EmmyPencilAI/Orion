import React from 'react';
import { Compass, BarChart3, Zap, Sliders } from 'lucide-react';
import { triggerHaptic } from '../services/device';

export type TabType = 'home' | 'markets' | 'signals' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  signalsCount?: number;
}

export function BottomNav({ activeTab, onChangeTab, signalsCount = 0 }: BottomNavProps) {
  const tabs = [
    { id: 'home' as TabType, label: 'Overview', icon: Compass },
    { id: 'markets' as TabType, label: '5 Markets', icon: BarChart3 },
    { id: 'signals' as TabType, label: 'Signals', icon: Zap, badge: signalsCount > 0 ? signalsCount : undefined },
    { id: 'settings' as TabType, label: 'Config', icon: Sliders },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E0E14]/95 backdrop-blur border-t border-[rgba(255,107,0,0.2)] safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                onChangeTab(tab.id);
              }}
              className="pressable relative flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
                    isActive
                      ? 'text-[#FF6B00] scale-110 drop-shadow-[0_0_8px_rgba(255,107,0,0.6)]'
                      : 'text-[#726E82] hover:text-[#B6B4C2]'
                  }`}
                />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#FF6B00] text-black text-[10px] font-orbitron font-black flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`font-orbitron text-[10px] font-bold tracking-wider mt-1 transition-colors ${
                  isActive ? 'text-[#FF6B00]' : 'text-[#726E82]'
                }`}
              >
                {tab.label}
              </span>

              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] mt-0.5 shadow-sm shadow-[#FF6B00]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
