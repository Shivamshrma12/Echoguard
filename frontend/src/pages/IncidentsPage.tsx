import React, { useState } from 'react';
import { IncidentRecord, VoiceEvent } from '../types';
import { ShieldAlert, CheckCircle2, ChevronRight, Volume2, Radio, Terminal, AlertTriangle, ArrowRight, ShieldCheck, XCircle } from 'lucide-react';

interface IncidentsPageProps {
  incidents: IncidentRecord[];
  selectedIncident: IncidentRecord | null;
  onSelectIncident: (inc: IncidentRecord) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
}) => {
  const activeInc = selectedIncident || (incidents.length > 0 ? incidents[0] : null);
  const [showRawEvents, setShowRawEvents] = useState<boolean>(false);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#060911]">
      {/* Left List of Incidents */}
      <div className="w-72 border-r border-white/8 bg-[#080d19]/80 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">INCIDENTS</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
            {incidents.length} TOTAL
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono">
          {incidents.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No incidents logged yet. Run the showcase interrupt test on Voice Core.
            </div>
          ) : (
            incidents.map((inc) => {
              const isSelected = activeInc?.incidentId === inc.incidentId;
              return (
                <button
                  key={inc.incidentId}
                  onClick={() => onSelectIncident(inc)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-white/[0.02] border-white/6 text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{inc.incidentId}</span>
                      {inc.evidenceType?.includes('FIXTURE') && (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          FIXTURE
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {inc.resolution}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1 font-sans text-slate-300 truncate">
                    {inc.trigger}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                    <span>{inc.initialGeneration} → {inc.finalGeneration}</span>
                    <span>{inc.durationMs}ms</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Forensic Replay Canvas */}
      <div className="flex-1 flex flex-col overflow-y-auto p-8 space-y-6">
        {!activeInc ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-sm space-y-2">
            <ShieldAlert className="w-10 h-10 text-slate-600 mb-2" />
            <div>Select or trigger an incident to inspect the cinematic forensic replay.</div>
          </div>
        ) : (
          <>
            {/* Incident Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/8">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold font-mono text-white tracking-wider m-0">
                    VOICE INCIDENT #{activeInc.incidentId.replace('INC-', '')}
                  </h1>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    RECOVERED
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-2">
                  <span>TRIGGER: <strong className="text-slate-200">{activeInc.trigger}</strong></span>
                  <span>•</span>
                  <span>FENCE TRANSITION: <strong className="text-cyan-300">{activeInc.initialGeneration} → {activeInc.finalGeneration}</strong></span>
                  <span>•</span>
                  <span>STALE WORK BLOCKED: <strong className="text-emerald-400">{activeInc.staleResultsCount}</strong></span>
                </div>
              </div>

              {/* Evidence Type Badge */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                  LABEL: <strong className="text-amber-400">{activeInc.evidenceType}</strong>
                </span>
              </div>
            </div>

            {/* Cinematic Temporal Visualization (Agent State vs User Heard) */}
            <div className="p-6 rounded-2xl bg-[#090f1d] border border-white/10 space-y-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-white/8">
                <div className="text-xs font-bold text-slate-300 tracking-wider uppercase">
                  TEMPORAL GENERATION DUAL-LANE RECONSTRUCTION
                </div>
                <div className="text-[10px] text-slate-400">
                  Total Recovery Duration: <strong className="text-white">{activeInc.durationMs}ms</strong>
                </div>
              </div>

              {/* Lane 1: AGENT STATE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="text-cyan-400 font-bold tracking-wider">LANE 1: AGENT COGNITIVE & TOOL STATE</span>
                  <span className="text-[10px]">Internal Execution Flow</span>
                </div>
                <div className="relative p-4 rounded-xl bg-black/50 border border-white/8 flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Phase 1 */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="text-[10px] text-slate-500">{activeInc.initialGeneration} RUNNING</div>
                    <div className="text-xs text-slate-200 font-semibold mt-0.5">Path & Clearances Active</div>
                  </div>

                  {/* Interruption node */}
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-8 bg-gradient-to-r from-cyan-500 to-red-500" />
                    <div className="px-3 py-1 rounded bg-red-900/60 border border-red-500 text-red-300 text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                      ✕ INTERRUPTED
                    </div>
                    <div className="h-0.5 w-8 bg-gradient-to-r from-red-500 to-cyan-500" />
                  </div>

                  {/* Phase 2 */}
                  <div className="flex-1 text-center md:text-right">
                    <div className="text-[10px] text-cyan-400">{activeInc.finalGeneration} FENCED & ACTIVE</div>
                    <div className="text-xs text-emerald-300 font-semibold mt-0.5">Hazard Evaluation Spoken</div>
                  </div>
                </div>
              </div>

              {/* Lane 2: USER HEARD */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="text-emerald-400 font-bold tracking-wider">LANE 2: USER HEARD (ACOUSTIC TRANSCRIPT)</span>
                  <span className="text-[10px] text-amber-400/90">{activeInc.evidenceType}</span>
                </div>
                <div className="relative p-4 rounded-xl bg-black/50 border border-white/8 space-y-2">
                  <div className="flex items-start gap-3">
                    <Volume2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-200 font-sans leading-relaxed">
                      {activeInc.whatUserHeard}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lane 3: FENCE INTERCEPTION */}
              <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-bold text-red-300">OLD TOOL RESULT ARRIVED</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-slate-300">Generation check: {activeInc.initialGeneration} != {activeInc.finalGeneration}</span>
                </div>
                <div className="px-3 py-1 rounded bg-red-500/20 border border-red-500/40 text-red-200 font-bold">
                  ✕ REJECTED AS STALE (NO LEAK)
                </div>
              </div>
            </div>

            {/* The 5 Forensic View Questions (Progressive Disclosure) */}
            <div className="space-y-3 font-mono">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                FORENSIC DEEP-DIVE: FIVE CORE RELIABILITY ANSWERS
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Q1 */}
                <div className="p-4 rounded-xl bg-[#090f1d] border border-white/8 space-y-1.5">
                  <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold">
                    1. WHAT WAS THE AGENT DOING?
                  </div>
                  <p className="text-xs font-sans text-slate-300 leading-relaxed">
                    {activeInc.whatAgentThought}
                  </p>
                </div>

                {/* Q2 */}
                <div className="p-4 rounded-xl bg-[#090f1d] border border-white/8 space-y-1.5">
                  <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold">
                    2. WHAT DID THE USER INTERRUPT?
                  </div>
                  <p className="text-xs font-sans text-slate-300 leading-relaxed">
                    Active speech transmission in {activeInc.initialGeneration}. The user interrupted with an immediate hazard trigger.
                  </p>
                </div>

                {/* Q3 */}
                <div className="p-4 rounded-xl bg-[#090f1d] border border-white/8 space-y-1.5">
                  <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold">
                    3. WHAT WAS INVALIDATED?
                  </div>
                  <p className="text-xs font-sans text-slate-300 leading-relaxed">
                    {activeInc.whatWasInvalidated}
                  </p>
                </div>

                {/* Q4 */}
                <div className="p-4 rounded-xl bg-[#090f1d] border border-white/8 space-y-1.5">
                  <div className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">
                    4. WHAT STALE WORK ARRIVED AFTERWARD?
                  </div>
                  <p className="text-xs font-sans text-slate-300 leading-relaxed">
                    {activeInc.whatWasRejected}
                  </p>
                </div>

                {/* Q5 */}
                <div className="p-4 rounded-xl bg-[#090f1d] border border-emerald-500/30 md:col-span-2 space-y-1.5 bg-emerald-950/10">
                  <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    5. WHAT DID THE USER FINALLY HEAR?
                  </div>
                  <p className="text-xs font-sans text-emerald-200 leading-relaxed">
                    {activeInc.whatWasDelivered}
                  </p>
                </div>
              </div>
            </div>

            {/* Raw Event Telemetry Drawer Toggle */}
            <div className="pt-2 font-mono">
              <button
                onClick={() => setShowRawEvents(!showRawEvents)}
                className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{showRawEvents ? 'Hide Detailed Event Log' : 'Inspect Chronological Event Log'}</span>
              </button>

              {showRawEvents && (
                <div className="mt-3 p-4 rounded-xl bg-black/60 border border-white/8 max-h-72 overflow-y-auto space-y-2 text-xs">
                  {activeInc.events.map((e, idx) => (
                    <div key={e.id || idx} className="flex items-start justify-between py-1 border-b border-white/4 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{e.iso_time || '00:00:00'}</span>
                        <span className="font-bold text-cyan-400">{e.generationId}</span>
                        <span className="text-slate-200">{e.type}</span>
                      </div>
                      <span className="text-slate-500 text-[10px] truncate max-w-xs">{JSON.stringify(e.payload)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
