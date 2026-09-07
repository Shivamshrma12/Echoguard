import React from 'react';
import { IncidentRecord, RimeProviderConfig, VoiceState } from '../types';
import { ShieldAlert, Cpu, Radio, Mic, Bot, ChevronRight, PlayCircle, Sparkles, Activity } from 'lucide-react';

interface RightIntelPanelProps {
  rimeConfig: RimeProviderConfig;
  livekitConfigured: boolean;
  voiceState: VoiceState;
  isMicActive: boolean;
  incidents: IncidentRecord[];
  onSelectIncident: (inc: IncidentRecord) => void;
  onOpenChaosLab: () => void;
  onRunShowcaseTest: () => void;
  isDemoMode: boolean;
}

export const RightIntelPanel: React.FC<RightIntelPanelProps> = ({
  rimeConfig,
  livekitConfigured,
  voiceState,
  isMicActive,
  incidents,
  onSelectIncident,
  onOpenChaosLab,
  onRunShowcaseTest,
  isDemoMode,
}) => {
  return (
    <aside className="w-80 bg-[#080d19]/90 border-l border-white/8 p-5 flex flex-col justify-between shrink-0 space-y-6 backdrop-blur-md overflow-y-auto">
      <div className="space-y-6">
        {/* System Status Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              SYSTEM STATUS
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              OPERATIONAL
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {/* Rime Status */}
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-300 text-[11px]">Rime Provider</span>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  isDemoMode
                    ? 'text-amber-400 bg-amber-500/10'
                    : rimeConfig.connected
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-400 bg-white/5'
                }`}
              >
                {isDemoMode ? 'SIMULATED' : rimeConfig.statusText}
              </span>
            </div>

            {/* LiveKit Status */}
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-300 text-[11px]">LiveKit WebRTC</span>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  livekitConfigured
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-400 bg-white/5'
                }`}
              >
                {livekitConfigured ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>

            {/* Microphone Status */}
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 text-[11px]">Microphone</span>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  isMicActive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-400 bg-white/5'
                }`}
              >
                {isMicActive ? 'CAPTURING' : 'STANDBY'}
              </span>
            </div>

            {/* Agent Engine Status */}
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-300 text-[11px]">Voice Agent</span>
              </div>
              <span className="text-[10px] font-bold text-cyan-300 px-2 py-0.5 rounded bg-cyan-500/10">
                {voiceState}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Incidents Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              RECENT INCIDENTS
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {incidents.length} LOGGED
            </span>
          </div>

          <div className="space-y-2 font-mono">
            {incidents.slice(0, 4).map((inc) => (
              <button
                key={inc.incidentId}
                onClick={() => onSelectIncident(inc)}
                className="w-full text-left p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/6 hover:border-cyan-500/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    {inc.incidentId}
                  </span>
                  <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {inc.resolution}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {inc.trigger} • {inc.initialGeneration} → {inc.finalGeneration}
                </div>
                <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500">
                  <span>Stale Blocked: {inc.staleResultsCount}</span>
                  <span className="text-cyan-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                    Replay <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Try It Yourself Callout Box */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 via-[#0a1122] to-black border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            TRY IT YOURSELF
          </h4>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Experience the interruption race condition with deterministic stale result fencing.
        </p>
        <div className="space-y-2 pt-1 font-mono text-xs">
          <button
            onClick={onRunShowcaseTest}
            className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <PlayCircle className="w-4 h-4" />
            <span>RUN INTERRUPT TEST</span>
          </button>
          <button
            onClick={onOpenChaosLab}
            className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-all flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
          >
            <span>OPEN CHAOS LAB</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
