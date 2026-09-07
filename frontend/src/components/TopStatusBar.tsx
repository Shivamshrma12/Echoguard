import React from 'react';
import { RimeProviderConfig } from '../types';
import { Settings, Radio } from 'lucide-react';

interface TopStatusBarProps {
  rimeConfig: RimeProviderConfig;
  onOpenSettings: () => void;
  brandTitle?: string;
  brandSubtitle?: string;
  selectedModel?: string;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  rimeConfig,
  onOpenSettings,
  brandTitle = 'EchoTrace',
  brandSubtitle = 'The Flight Recorder for Voice Agents',
  selectedModel = 'rime-tts-mist-v3',
}) => {
  return (
    <header className="h-16 bg-[#080d1a] border-b border-white/[0.06] px-6 flex items-center justify-between shrink-0 z-20">
      {/* Left: Waveform Logo + Brand Title + Subtitle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 h-6">
          <span className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse" />
          <span className="w-1 h-5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-6 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          <span className="w-1 h-4 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
          <span className="w-1 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-bold text-white tracking-tight">
            {brandTitle}
          </span>
          <span className="text-xs text-slate-400 font-normal hidden sm:inline">
            {brandSubtitle}
          </span>
        </div>
      </div>

      {/* Right: Rime Status Pill + Model Pill + Gear Icon + SS Avatar */}
      <div className="flex items-center gap-3">
        {/* Rime Status Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0d1627] border border-white/[0.08] text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-bold text-white text-[11px] tracking-wide">
            {rimeConfig.connected ? 'RIME CONNECTED' : 'RIME CONNECTED'}
          </span>
          <span className="text-slate-400 text-[11px] hidden md:inline">
            Live Voice - Streaming
          </span>
        </div>

        {/* Model Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0d1627] border border-white/[0.08] text-xs">
          <span className="text-slate-400 text-[11px]">Model</span>
          <span className="font-semibold text-white text-[11px]">{selectedModel}</span>
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full bg-[#0d1627] hover:bg-[#132038] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Configure API Keys (Gemini, Rime, LiveKit)"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User SS Avatar */}
        <div
          className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 border border-purple-400/40 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_12px_rgba(147,51,234,0.3)] cursor-pointer"
          title="Shivam (Session Operator)"
        >
          SS
        </div>
      </div>
    </header>
  );
};
