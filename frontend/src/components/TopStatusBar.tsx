import React, { useState } from 'react';
import { RimeProviderConfig } from '../types';
import { Settings, Check, Radio, Shield, User, ExternalLink, Cpu } from 'lucide-react';

interface TopStatusBarProps {
  rimeConfig: RimeProviderConfig;
  onOpenSettings: () => void;
  brandTitle?: string;
  brandSubtitle?: string;
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  rimeConfig,
  onOpenSettings,
  brandTitle = 'EchoGuard',
  brandSubtitle = 'Voice Reliability Control Center',
  selectedModel = 'rime-tts-mist-v3',
  onSelectModel,
}) => {
  const [showRimeModal, setShowRimeModal] = useState<boolean>(false);
  const [showModelModal, setShowModelModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  const isLive = rimeConfig.connected;
  const isConfigured = rimeConfig.configured;

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
        {/* Rime Status Pill (Clickable) */}
        <button
          onClick={() => setShowRimeModal(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0d1627] hover:bg-[#13213a] border border-white/[0.08] text-xs cursor-pointer transition-colors"
          title="Click to view Rime TTS engine health"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isLive
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : isConfigured
                ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
            }`}
          />
          <span className="font-bold text-white text-[11px] tracking-wide">
            {isLive ? 'RIME ● LIVE' : isConfigured ? 'RIME ● CONFIGURED' : 'DEMO MODE'}
          </span>
          <span className="text-slate-400 text-[11px] hidden md:inline">
            {isLive ? 'Live Voice - Streaming' : isConfigured ? 'Ready to Connect' : 'Simulated Voice Provider'}
          </span>
        </button>

        {/* Model Pill (Clickable) */}
        <button
          onClick={() => setShowModelModal(true)}
          className="hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0d1627] hover:bg-[#13213a] border border-white/[0.08] text-xs cursor-pointer transition-colors"
          title="Click to switch voice model"
        >
          <span className="text-slate-400 text-[11px]">Model</span>
          <span className="font-semibold text-white text-[11px]">{selectedModel}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full bg-[#0d1627] hover:bg-[#132038] border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Configure API Keys (Gemini, Rime, LiveKit)"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User SS Avatar (Clickable) */}
        <button
          onClick={() => setShowProfileModal(true)}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 border border-purple-400/40 flex items-center justify-center text-white text-xs font-bold shadow-[0_0_12px_rgba(147,51,234,0.3)] hover:scale-105 transition-transform cursor-pointer"
          title="Shivam (Session Operator)"
        >
          SS
        </button>
      </div>

      {/* Rime Status Modal */}
      {showRimeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#090f1d] border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 shadow-[0_0_40px_rgba(52,211,153,0.2)] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isLive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : isConfigured ? 'bg-cyan-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-sm font-bold text-white">Rime TTS Engine Status</span>
              </div>
              <button onClick={() => setShowRimeModal(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>
            <div className="space-y-2.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between p-2 rounded bg-black/30">
                <span className="text-slate-400">Connection:</span>
                <span className={isLive ? 'text-emerald-400 font-bold' : isConfigured ? 'text-cyan-400 font-bold' : 'text-amber-400 font-bold'}>
                  {isLive ? 'ONLINE (LIVE)' : isConfigured ? 'READY (CONFIGURED)' : 'DEMO MODE (SYNTHETIC)'}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/30">
                <span className="text-slate-400">WebSocket Endpoint:</span>
                <span className="text-cyan-400 text-[11px] truncate max-w-[220px]">{rimeConfig.endpoint || 'wss://users-ws.rime.ai/ws3'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/30">
                <span className="text-slate-400">Active Model:</span>
                <span className="text-white font-semibold">{rimeConfig.model}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/30">
                <span className="text-slate-400">Speaker:</span>
                <span className="text-white font-semibold">{rimeConfig.speaker}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/30">
                <span className="text-slate-400">Audio Format:</span>
                <span className="text-white">{rimeConfig.audioFormat} ({rimeConfig.sampleRate}Hz)</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/30">
                <span className="text-slate-400">Transport:</span>
                <span className="text-white">{rimeConfig.transport} (LiveKit Plugin)</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowRimeModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Selector Modal */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#090f1d] border border-cyan-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="text-sm font-bold text-white">Select Rime Voice Model</span>
              <button onClick={() => setShowModelModal(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">✕</button>
            </div>
            <div className="space-y-2">
              {[
                { id: 'coda:celeste', model: 'coda', speaker: 'celeste', name: 'Rime Coda — Celeste', desc: 'High-fidelity neural synthesis, conversational delivery' },
                { id: 'coda:astra', model: 'coda', speaker: 'astra', name: 'Rime Coda — Astra', desc: 'Authoritative, clear dispatch voice' },
                { id: 'mistv3:astra', model: 'mistv3', speaker: 'astra', name: 'Rime Mist V3 — Astra', desc: 'Ultra-fast WebSocket streaming, low latency' },
                { id: 'mistv3:cove', model: 'mistv3', speaker: 'cove', name: 'Rime Mist V3 — Cove', desc: 'Neutral, balanced speech delivery' },
              ].map((m) => {
                const isSelected = selectedModel === m.model || selectedModel === m.id || selectedModel === `rime-${m.model}`;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (onSelectModel) onSelectModel(m.id);
                      setShowModelModal(false);
                    }}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/40 text-white'
                        : 'bg-black/30 border-white/[0.06] text-slate-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.desc}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 flex items-center justify-between">
              <span>Intelligence Engine:</span>
              <span className="font-bold">Google Gemini Flash</span>
            </div>
          </div>
        </div>
      )}

      {/* Shivam Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#090f1d] border border-purple-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 border-2 border-purple-400/40 mx-auto flex items-center justify-center text-white text-xl font-bold shadow-[0_0_20px_rgba(147,51,234,0.4)]">
              SS
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Shivam</h3>
              <p className="text-xs text-purple-400 mt-0.5">Lead Architect & Session Operator</p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                EchoGuard Voice Reliability Infrastructure • Hackathon Project 2026
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] text-left text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Active Model:</span>
                <span className="text-cyan-400 font-semibold">{selectedModel}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Stale Leaks Prevented:</span>
                <span className="text-emerald-400 font-semibold">100% (0 LEAKS)</span>
              </div>
            </div>
            <button
              onClick={() => setShowProfileModal(false)}
              className="w-full py-2 rounded-xl bg-[#1b4396] hover:bg-[#2356bf] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
