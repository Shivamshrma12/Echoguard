import React from 'react';
import { RimeProviderConfig, SystemMetrics, VoiceState } from '../types';
import { ShieldCheck, X, CheckCircle2, AlertTriangle, Radio, Terminal, FileCode, Layers } from 'lucide-react';

interface JudgeModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  rimeConfig: RimeProviderConfig;
  currentGeneration: string;
  voiceState: VoiceState;
  metrics: SystemMetrics;
  isDemoMode: boolean;
}

export const JudgeModeModal: React.FC<JudgeModeModalProps> = ({
  isOpen,
  onClose,
  rimeConfig,
  currentGeneration,
  voiceState,
  metrics,
  isDemoMode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-[#090e1a] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] p-6 font-mono text-xs overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wider">
                JUDGE PROOF PANEL
              </h3>
              <p className="text-[10px] text-slate-400">
                EchoGuard Realtime Voice Reliability Infrastructure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1-Glance Proof Table */}
        <div className="my-5 space-y-3">
          {/* Core Claim */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/8 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">
              CORE INNOVATION CLAIM
            </div>
            <div className="text-xs font-sans text-cyan-200 font-medium leading-relaxed">
              When an interruption occurs, EchoGuard fences the obsolete conversational generation,
              flushes active audio immediately, and deterministically suppresses delayed tool results
              from becoming spoken output.
            </div>
          </div>

          {/* Key Facts Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/8">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Primary TTS Provider</div>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>RIME TTS</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {isDemoMode ? 'SIMULATED' : rimeConfig.connected ? 'LIVE' : rimeConfig.statusText}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/8">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Active Model & Voice</div>
              <div className="text-sm font-bold text-white mt-1">
                {rimeConfig.model} / {rimeConfig.speaker}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/8">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Audio Transport & Format</div>
              <div className="text-sm font-bold text-slate-200 mt-1">
                {rimeConfig.transport} • {rimeConfig.audioFormat} {rimeConfig.sampleRate}Hz
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/8">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Active Generation</div>
              <div className="text-sm font-bold text-cyan-300 mt-1">
                {currentGeneration}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/8">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Stale Results Blocked</div>
              <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{metrics.staleResultsBlocked} REJECTED</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/8">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">State Engine</div>
              <div className="text-sm font-bold text-purple-300 mt-1">
                {voiceState}
              </div>
            </div>
          </div>

          {/* Measured Latency Verification */}
          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between">
            <div className="text-slate-300">
              <div className="text-[10px] text-cyan-400 uppercase tracking-widest">Measured Audio Stop Latency</div>
              <div className="text-xs text-slate-400 mt-0.5 font-sans">
                Interruption trigger → Web Audio buffer cancellation
              </div>
            </div>
            <div className="text-base font-bold text-cyan-300 font-mono">
              {metrics.measuredInterruptToAudioStopMs != null
                ? `${metrics.measuredInterruptToAudioStopMs}ms`
                : 'MEASURED ON TEST'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Acceptance Invariant: 0 Stale Leaks</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
