import React from 'react';
import { Home, Radio, TriangleAlert, FlaskConical, FileText, Settings } from 'lucide-react';

interface NavigationProps {
  activeTab: 'home' | 'live' | 'incidents' | 'chaos' | 'evidence' | 'settings';
  setActiveTab: (tab: 'home' | 'live' | 'incidents' | 'chaos' | 'evidence' | 'settings') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const items = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'live' as const, label: 'Live Session', icon: Radio },
    { id: 'incidents' as const, label: 'Incidents', icon: TriangleAlert },
    { id: 'chaos' as const, label: 'Chaos Lab', icon: FlaskConical },
    { id: 'evidence' as const, label: 'Evidence', icon: FileText },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-[#070b14] border-r border-white/[0.06] flex flex-col justify-between shrink-0 select-none z-10">
      {/* Navigation List */}
      <div className="p-4 space-y-1.5 pt-6">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-[#1b4396] text-white font-semibold shadow-[0_0_15px_rgba(27,67,150,0.4)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Brand Signature: Waveform + Voice First. Reliability Always. + Sine Wave */}
      <div className="p-5 pb-6 space-y-3 relative overflow-hidden">
        <div className="flex items-center gap-0.5 h-4">
          <span className="w-0.5 h-2 bg-purple-400 rounded-full" />
          <span className="w-0.5 h-3.5 bg-purple-400 rounded-full" />
          <span className="w-0.5 h-4 bg-indigo-400 rounded-full" />
          <span className="w-0.5 h-2.5 bg-blue-400 rounded-full" />
          <span className="w-0.5 h-1.5 bg-cyan-400 rounded-full" />
        </div>

        <div className="space-y-0.5">
          <div className="text-xs font-bold text-white tracking-tight">Voice First.</div>
          <div className="text-[11px] text-cyan-400/90 font-medium">Reliability Always.</div>
        </div>

        {/* Sleek subtle glowing sine wave line at bottom */}
        <div className="w-full pt-1 opacity-75">
          <svg viewBox="0 0 100 20" className="w-full h-4 text-cyan-500/40" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M0 10 Q 25 0, 50 10 T 100 10" />
          </svg>
        </div>
      </div>
    </aside>
  );
};
