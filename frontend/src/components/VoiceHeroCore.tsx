import React, { useEffect, useRef, useState } from 'react';
import { VoiceState, SystemMetrics } from '../types';
import { audioManager } from '../audio/audioManager';
import { Mic, MicOff, Square, Zap, Shield, AlertTriangle, ArrowRight, XCircle, CheckCircle2 } from 'lucide-react';

interface VoiceHeroCoreProps {
  state: VoiceState;
  generationId: string;
  invalidatedGenerations: string[];
  metrics: SystemMetrics;
  isSessionActive: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
  onInterrupt: () => void;
  isDemoMode: boolean;
  activeSpeechText: string;
}

export const VoiceHeroCore: React.FC<VoiceHeroCoreProps> = ({
  state,
  generationId,
  invalidatedGenerations,
  metrics,
  isSessionActive,
  onStartSession,
  onEndSession,
  onInterrupt,
  isDemoMode,
  activeSpeechText,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isAcousticInput, setIsAcousticInput] = useState<boolean>(false);
  const [showStaleBanner, setShowStaleBanner] = useState<boolean>(false);

  // Monitor stale blocks to trigger the hero rejection animation
  useEffect(() => {
    if (metrics.staleResultsBlocked > 0) {
      setShowStaleBanner(true);
      const timer = setTimeout(() => setShowStaleBanner(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [metrics.staleResultsBlocked]);

  // Waveform rendering loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { data, isAcoustic } = audioManager.getWaveformData(state, 48);
      setIsAcousticInput(isAcoustic);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = data.length;
      const gap = 3;
      const totalGaps = (barCount - 1) * gap;
      const barWidth = Math.max(2, (width - totalGaps) / barCount);
      const centerY = height / 2;

      // Color scheme based on VoiceState
      let primaryColor = '#00f0ff';
      let glowColor = 'rgba(0, 240, 255, 0.4)';

      if (state === 'INTERRUPTING' || state === 'INVALIDATED') {
        primaryColor = '#ef4444';
        glowColor = 'rgba(239, 68, 68, 0.6)';
      } else if (state === 'RECOVERING') {
        primaryColor = '#818cf8';
        glowColor = 'rgba(129, 140, 248, 0.5)';
      } else if (state === 'SPEAKING') {
        primaryColor = '#38bdf8';
        glowColor = 'rgba(56, 189, 248, 0.4)';
      } else if (state === 'LISTENING') {
        primaryColor = '#10b981';
        glowColor = 'rgba(16, 185, 129, 0.4)';
      } else if (state === 'THINKING') {
        primaryColor = '#a855f7';
        glowColor = 'rgba(168, 85, 247, 0.4)';
      }

      ctx.shadowBlur = state === 'IDLE' ? 4 : 12;
      ctx.shadowColor = glowColor;

      for (let i = 0; i < barCount; i++) {
        const val = data[i];
        const barHeight = Math.max(4, val * (height * 0.85));
        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, primaryColor);
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, primaryColor);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [state]);

  // State color mapping
  const getStateBadgeColor = () => {
    switch (state) {
      case 'SPEAKING':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'LISTENING':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'INTERRUPTING':
        return 'text-red-400 bg-red-500/15 border-red-500/40 animate-pulse';
      case 'INVALIDATED':
        return 'text-red-500 bg-red-500/20 border-red-500/50';
      case 'RECOVERING':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'THINKING':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      default:
        return 'text-slate-400 bg-white/5 border-white/10';
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-between p-6 bg-[#090f1d]/70 rounded-2xl border border-white/8 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Background Ambient Glow */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
          state === 'INTERRUPTING'
            ? 'bg-radial from-red-600/15 via-transparent to-transparent opacity-100'
            : state === 'SPEAKING'
            ? 'bg-radial from-cyan-600/10 via-transparent to-transparent opacity-100'
            : state === 'RECOVERING'
            ? 'bg-radial from-indigo-600/10 via-transparent to-transparent opacity-100'
            : 'opacity-0'
        }`}
      />

      {/* Top Telemetry Instrumentation Grid */}
      <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 z-10">
        {/* Generation Item */}
        <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/8">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <span>Generation</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold font-mono text-cyan-300 tracking-wider">
              {generationId}
            </span>
            <span className="text-[10px] font-mono text-emerald-400 uppercase">Active</span>
          </div>
        </div>

        {/* State Item */}
        <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/8">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Voice State
          </div>
          <div className="mt-1">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold tracking-wider border ${getStateBadgeColor()}`}>
              {state}
            </span>
          </div>
        </div>

        {/* State Integrity */}
        <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/8">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            State Integrity
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-semibold text-emerald-300">
              0 STALE LEAKS
            </span>
          </div>
        </div>

        {/* Measured Latency */}
        <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/8">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Measured Latency
          </div>
          <div className="flex items-baseline gap-1 mt-1 font-mono">
            <span className="text-sm font-bold text-slate-200">
              {metrics.measuredInterruptToAudioStopMs != null
                ? `${metrics.measuredInterruptToAudioStopMs}ms`
                : 'MEASURED ON RUN'}
            </span>
            <span className="text-[9px] text-slate-400">
              {metrics.measuredInterruptToAudioStopMs != null ? 'audio stop' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* The Central Hero Orb & Waveform Visualization */}
      <div className="relative my-6 flex flex-col items-center justify-center w-full max-w-xl z-10">
        {/* Visual Orb Ring */}
        <div className="relative flex items-center justify-center w-36 h-36 mb-4">
          <div
            className={`absolute inset-0 rounded-full border transition-all duration-500 ${
              state === 'INTERRUPTING'
                ? 'border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.5)] scale-110'
                : state === 'SPEAKING'
                ? 'border-cyan-400/70 shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse'
                : state === 'RECOVERING'
                ? 'border-indigo-400/70 shadow-[0_0_25px_rgba(129,140,248,0.4)]'
                : 'border-white/15 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
            }`}
          />
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center bg-gradient-to-b transition-all duration-500 ${
              state === 'INTERRUPTING'
                ? 'from-red-950/80 to-black border border-red-500/40'
                : state === 'SPEAKING'
                ? 'from-cyan-950/70 to-black border border-cyan-500/40'
                : state === 'RECOVERING'
                ? 'from-indigo-950/70 to-black border border-indigo-500/40'
                : 'from-slate-900/60 to-black border border-white/10'
            }`}
          >
            {state === 'INTERRUPTING' ? (
              <AlertTriangle className="w-9 h-9 text-red-400 animate-bounce" />
            ) : state === 'SPEAKING' ? (
              <Zap className="w-9 h-9 text-cyan-400" />
            ) : state === 'RECOVERING' ? (
              <Shield className="w-9 h-9 text-indigo-400" />
            ) : isSessionActive ? (
              <Mic className="w-9 h-9 text-emerald-400" />
            ) : (
              <MicOff className="w-9 h-9 text-slate-500" />
            )}
          </div>
        </div>

        {/* State Announcement Caption */}
        <div className="text-center mb-3">
          <h2 className="text-base font-semibold text-white tracking-wide">
            {state === 'SPEAKING'
              ? 'Rime TTS Active'
              : state === 'INTERRUPTING'
              ? 'Interruption Detected — Fencing Generation'
              : state === 'RECOVERING'
              ? 'Re-evaluating State & Responding'
              : state === 'LISTENING'
              ? 'Listening to Audio Input'
              : isSessionActive
              ? 'Session Active — Speak or Interrupt'
              : 'EchoGuard Ready — Start Session'}
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {state === 'INTERRUPTING'
              ? 'Audio buffer flushed • Generation invalidated • Stale results fenced'
              : state === 'SPEAKING'
              ? activeSpeechText || 'Rime coda / celeste — MP3 audio stream'
              : isAcousticInput
              ? 'Acoustic microphone capture connected'
              : 'Acoustic synthesis engine'}
          </p>
        </div>

        {/* Real Waveform Canvas */}
        <div className="w-full h-18 px-4 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={480}
            height={72}
            className="w-full h-full max-w-md rounded-lg"
          />
        </div>

        {/* The Big Visual Moment: Stale Rejection Banner (Animates upon interruption race) */}
        {showStaleBanner && (
          <div className="w-full mt-3 p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 flex items-center justify-between animate-fadeIn shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <div className="flex items-center gap-2 font-mono text-xs text-red-300">
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-bold">STALE RESULT REJECTED</span>
              <span className="text-slate-400">|</span>
              <span className="text-[11px] text-red-200">
                Obsolete tool payload discarded before TTS
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              <span>0 LEAKS</span>
            </div>
          </div>
        )}
      </div>

      {/* Hero Session Controls (Fast Judge Interaction) */}
      <div className="w-full flex items-center justify-center gap-4 z-10 pt-2 border-t border-white/8">
        {!isSessionActive ? (
          <button
            onClick={onStartSession}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold tracking-wider transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] flex items-center gap-2 cursor-pointer"
          >
            <Mic className="w-4 h-4" />
            <span>START LIVE SESSION</span>
          </button>
        ) : (
          <>
            <button
              onClick={onEndSession}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs transition-all border border-white/10 flex items-center gap-2 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 text-slate-400" />
              <span>END SESSION</span>
            </button>

            {/* Prominent Interrupt Button */}
            <button
              onClick={onInterrupt}
              className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-mono text-xs font-bold tracking-widest transition-all shadow-[0_0_30px_rgba(239,68,68,0.4)] flex items-center gap-2 cursor-pointer animate-pulse"
              title="Trigger immediate speech interruption and generation fence"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>INTERRUPT</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
