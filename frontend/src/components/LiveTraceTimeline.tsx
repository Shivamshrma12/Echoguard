import React from 'react';
import { VoiceEvent } from '../types';
import { Radio, Activity, AlertOctagon, XCircle, RefreshCw, Volume2, Wrench, ShieldCheck } from 'lucide-react';

interface LiveTraceTimelineProps {
  events: VoiceEvent[];
  currentGeneration: string;
  invalidatedGenerations: string[];
}

export const LiveTraceTimeline: React.FC<LiveTraceTimelineProps> = ({
  events,
  currentGeneration,
  invalidatedGenerations,
}) => {
  // Filter relevant events for the trace
  const displayEvents = events.slice(-12);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'TTS_STARTED':
      case 'TTS_STREAMING':
        return <Volume2 className="w-3 h-3 text-cyan-400" />;
      case 'TOOL_STARTED':
      case 'TOOL_COMPLETED':
        return <Wrench className="w-3 h-3 text-amber-400" />;
      case 'TTS_INTERRUPTED':
      case 'AUDIO_QUEUE_FLUSHED':
      case 'GENERATION_INVALIDATED':
        return <AlertOctagon className="w-3 h-3 text-red-400" />;
      case 'STALE_RESULT_RECEIVED':
      case 'STALE_RESULT_REJECTED':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'RECOVERY_STARTED':
      case 'RECOVERY_COMPLETED':
        return <RefreshCw className="w-3 h-3 text-indigo-400" />;
      default:
        return <Activity className="w-3 h-3 text-slate-400" />;
    }
  };

  const getEventBadgeClass = (type: string, severity: string) => {
    if (type.includes('STALE') || type.includes('INVALIDATED') || type.includes('INTERRUPT')) {
      return 'border-red-500/40 bg-red-500/10 text-red-300';
    }
    if (type.includes('RECOVERY')) {
      return 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300';
    }
    if (type.includes('TTS')) {
      return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300';
    }
    if (type.includes('TOOL')) {
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    }
    return 'border-white/10 bg-white/5 text-slate-300';
  };

  return (
    <div className="w-full bg-[#080d19]/80 rounded-2xl border border-white/8 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">
            LIVE FORENSIC TRACE
          </span>
          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-white/4">
            Temporal Generation Fencing
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>GEN TERMINATION (╳)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>ACTIVE GENERATION (●)</span>
          </div>
        </div>
      </div>

      {/* Temporal Generation Lane Diagram */}
      <div className="p-4 rounded-xl bg-black/40 border border-white/6 mb-4 font-mono text-xs overflow-x-auto">
        <div className="min-w-[620px] flex flex-col gap-2">
          {/* Lane 1: Obsolete / Invalidated Generation */}
          <div className="flex items-center gap-3">
            <span className="w-20 text-[11px] text-slate-400 shrink-0 font-bold">
              {invalidatedGenerations.length > 0
                ? invalidatedGenerations[invalidatedGenerations.length - 1]
                : 'GEN-014'}
            </span>
            <div className="flex-1 flex items-center">
              <div className="h-0.5 flex-1 bg-gradient-to-r from-cyan-500/60 via-amber-500/60 to-red-500" />
              <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center text-red-400 font-bold text-xs shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                ✕
              </div>
            </div>
            <span className="w-36 text-[10px] text-red-400 uppercase tracking-wider font-semibold">
              INVALIDATED / FLUSHED
            </span>
          </div>

          {/* Lane Bridge: Interruption Barrier */}
          <div className="flex items-center gap-3 pl-20">
            <div className="w-full flex items-center justify-center py-1">
              <div className="px-3 py-1 rounded bg-red-950/60 border border-red-500/40 text-[10px] text-red-300 font-bold flex items-center gap-2">
                <span>INTERRUPTION DETECTED</span>
                <span className="text-slate-400">→</span>
                <span>FENCE ACTIVATED</span>
                <span className="text-slate-400">→</span>
                <span className="text-emerald-400 font-bold">STALE REJECTED</span>
              </div>
            </div>
          </div>

          {/* Lane 2: Active Recovered Generation */}
          <div className="flex items-center gap-3">
            <span className="w-20 text-[11px] text-cyan-300 shrink-0 font-bold">
              {currentGeneration}
            </span>
            <div className="flex-1 flex items-center">
              <div className="w-4 h-4 rounded-full bg-cyan-500/30 border border-cyan-400 flex items-center justify-center text-cyan-300 text-[10px] shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.8)]">
                ●
              </div>
              <div className="h-0.5 flex-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-indigo-500" />
            </div>
            <span className="w-36 text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
              RECOVERED / ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Event Trace Nodes */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {displayEvents.length === 0 ? (
          <div className="w-full py-6 text-center text-slate-500 font-mono text-xs">
            Awaiting events. Start session or run interrupt test to inspect live trace nodes.
          </div>
        ) : (
          displayEvents.map((evt, idx) => (
            <div
              key={evt.id || idx}
              className={`shrink-0 p-2.5 rounded-lg border flex flex-col gap-1 w-44 font-mono transition-all hover:scale-[1.02] ${getEventBadgeClass(
                evt.type,
                evt.severity
              )}`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold flex items-center gap-1">
                  {getEventIcon(evt.type)}
                  {evt.generationId}
                </span>
                <span className="text-slate-400 text-[9px]">{evt.iso_time || '00:00:00'}</span>
              </div>
              <div className="text-[11px] font-semibold truncate" title={evt.type}>
                {evt.type.replace(/_/g, ' ')}
              </div>
              <div className="text-[9px] text-slate-400 truncate">
                {evt.payload?.text
                  ? `"${evt.payload.text}"`
                  : evt.payload?.utterance
                  ? `"${evt.payload.utterance}"`
                  : evt.payload?.action || evt.source}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
