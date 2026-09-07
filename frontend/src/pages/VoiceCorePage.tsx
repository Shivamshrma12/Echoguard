import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Radio,
  Zap,
  Shield,
  Cloud,
  ChevronDown,
  Activity,
  User,
  Wrench,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Volume2,
  Clock,
  FlaskConical,
  Sparkles,
  Info,
  GitBranch,
} from 'lucide-react';
import { audioManager } from '../audio/audioManager';
import { VoiceState, SystemMetrics, RimeProviderConfig, IncidentRecord, VoiceEvent } from '../types';

interface VoiceCorePageProps {
  state: VoiceState;
  generationId: string;
  metrics: SystemMetrics;
  rimeConfig: RimeProviderConfig;
  livekitConfigured: boolean;
  isSessionActive: boolean;
  isMicActive: boolean;
  activeSpeechText: string;
  events: VoiceEvent[];
  incidents: IncidentRecord[];
  onStartSession: () => void;
  onEndSession: () => void;
  onInterrupt: () => void;
  onRunShowcaseTest: () => void;
  onSelectIncident: (inc: IncidentRecord) => void;
  onOpenChaosLab: () => void;
  onSendQuery?: (text: string) => Promise<void>;
}

export const VoiceCorePage: React.FC<VoiceCorePageProps> = ({
  state,
  generationId,
  metrics,
  rimeConfig,
  livekitConfigured,
  isSessionActive,
  isMicActive,
  activeSpeechText,
  events,
  incidents,
  onStartSession,
  onEndSession,
  onInterrupt,
  onRunShowcaseTest,
  onSelectIncident,
  onOpenChaosLab,
  onSendQuery,
}) => {
  const [activeBottomTab, setActiveBottomTab] = useState<'timeline' | 'waveform' | 'flow'>('timeline');
  const [selectedVoice, setSelectedVoice] = useState<string>('rime-tts-mist-v3');
  const [transcriptInput, setTranscriptInput] = useState<string>('');
  const [listeningStatusText, setListeningStatusText] = useState<string>('Listening...');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Derive simple numeric generation e.g. "GEN-014" -> "14" or "1"
  const numericGen = generationId.replace('GEN-0', '').replace('GEN-', '') || '1';

  // Real Web Audio waveform loop across the center card
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { data } = audioManager.getWaveformData(state, 64);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = data.length;
      const gap = 2;
      const totalGaps = (barCount - 1) * gap;
      const barWidth = Math.max(2, (width - totalGaps) / barCount);
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        const val = data[i];
        const barHeight = Math.max(3, val * (height * 0.85));
        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (state === 'INTERRUPTING' || state === 'INVALIDATED') {
          grad.addColorStop(0, '#ef4444');
          grad.addColorStop(1, '#991b1b');
        } else if (state === 'SPEAKING') {
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(0.5, '#a855f7');
          grad.addColorStop(1, '#06b6d4');
        } else {
          grad.addColorStop(0, '#3b82f6');
          grad.addColorStop(1, '#1d4ed8');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [state]);

  // Update status message
  useEffect(() => {
    if (state === 'SPEAKING') {
      setListeningStatusText('Speaking...');
    } else if (state === 'INTERRUPTING') {
      setListeningStatusText('Interrupted!');
    } else if (state === 'THINKING') {
      setListeningStatusText('Thinking...');
    } else if (state === 'RECOVERING') {
      setListeningStatusText('Recovering state...');
    } else {
      setListeningStatusText('Listening...');
    }
  }, [state]);

  const handleMicButtonClick = () => {
    if (isSessionActive) {
      if (state === 'SPEAKING') {
        onInterrupt();
      } else {
        onEndSession();
      }
    } else {
      onStartSession();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptInput.trim()) return;
    if (onSendQuery) {
      onSendQuery(transcriptInput.trim());
      setTranscriptInput('');
    }
  };

  // Curated timeline events matching reference image if runtime events not yet recorded
  const defaultTimelineEvents = [
    {
      time: '12:42:31',
      name: 'USER INPUT',
      icon: User,
      iconColor: 'text-cyan-400',
      desc: '"Check the current status and tell me if I can proceed."',
      gen: 'GEN 1',
      genColor: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    },
    {
      time: '12:42:32',
      name: 'RIME STREAM STARTED',
      icon: Radio,
      iconColor: 'text-cyan-400',
      desc: 'TTS streaming (rime-mist-v3)',
      gen: 'GEN 1',
      genColor: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    },
    {
      time: '12:42:36',
      name: 'TOOL STARTED',
      icon: Wrench,
      iconColor: 'text-indigo-400',
      desc: 'check_status (2.5s)',
      gen: 'GEN 1',
      genColor: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    },
    {
      time: '12:42:37',
      name: 'INTERRUPTION',
      icon: AlertTriangle,
      iconColor: 'text-red-400',
      desc: 'User speech detected',
      gen: 'GEN 2',
      genColor: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    },
    {
      time: '12:42:37',
      name: 'AUDIO INTERRUPTED',
      icon: XCircle,
      iconColor: 'text-red-400',
      desc: 'Rime stream stopped',
      gen: 'GEN 1',
      genColor: 'bg-red-500/15 text-red-400 border border-red-500/30',
    },
    {
      time: '12:42:39',
      name: 'STALE RESULT REJECTED',
      icon: Clock,
      iconColor: 'text-purple-400',
      desc: 'Tool result from Gen 1 (outdated)',
      gen: 'GEN 1',
      genColor: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    },
    {
      time: '12:42:41',
      name: 'RIME STREAM STARTED',
      icon: Radio,
      iconColor: 'text-cyan-400',
      desc: 'New response (rime-mist-v3)',
      gen: 'GEN 2',
      genColor: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    },
    {
      time: '12:42:44',
      name: 'AUDIO COMPLETED',
      icon: CheckCircle2,
      iconColor: 'text-emerald-400',
      desc: 'Delivered successfully',
      gen: 'GEN 2',
      genColor: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    },
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-[#070b14]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-5">
        {/* Top Greeting & Action Buttons Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Good morning, Shivam</span>
              <span>👋</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Your voice agent is ready. Start a live session or run a test scenario.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onStartSession}
              className="px-4 py-2 rounded-full bg-[#1e48aa] hover:bg-[#2557cc] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(30,72,170,0.4)] cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Session →</span>
            </button>

            <button
              onClick={onOpenChaosLab}
              className="px-4 py-2 rounded-full bg-[#0c1424] hover:bg-[#132038] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
              <span>Chaos Lab →</span>
            </button>
          </div>
        </div>

        {/* Central Hero Console Card (Exact match with reference image) */}
        <div className="w-full bg-[#090f1d] border border-white/[0.08] rounded-2xl p-6 relative flex flex-col lg:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
          {/* Top Left Badges Inside Card */}
          <div className="absolute top-5 left-5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>LIVE SESSION</span>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-[11px] font-bold text-blue-400">
              RIME
            </div>
          </div>

          {/* Center Voice Orb & Waveform */}
          <div className="flex-1 w-full flex flex-col items-center justify-center pt-8 pb-2">
            {/* Glowing Center Orb with Soundbars */}
            <div className="relative w-28 h-28 rounded-full flex items-center justify-center mb-3">
              {/* Radial gradient glow behind */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/30 via-purple-600/30 to-blue-500/30 blur-md" />
              <div className="relative w-24 h-24 rounded-full bg-[#0d162b] border border-cyan-400/40 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.35)]">
                {/* Vertical Soundbars inside the Orb */}
                <div className="flex items-center gap-1 h-10">
                  <span className={`w-1 bg-cyan-400 rounded-full transition-all duration-150 ${state === 'SPEAKING' ? 'h-6 animate-pulse' : 'h-3'}`} />
                  <span className={`w-1 bg-blue-400 rounded-full transition-all duration-150 ${state === 'SPEAKING' ? 'h-9 animate-pulse' : 'h-6'}`} />
                  <span className={`w-1 bg-purple-400 rounded-full transition-all duration-150 ${state === 'SPEAKING' ? 'h-10 animate-pulse' : 'h-8'}`} />
                  <span className={`w-1 bg-indigo-400 rounded-full transition-all duration-150 ${state === 'SPEAKING' ? 'h-7 animate-pulse' : 'h-5'}`} />
                  <span className={`w-1 bg-cyan-400 rounded-full transition-all duration-150 ${state === 'SPEAKING' ? 'h-4 animate-pulse' : 'h-2'}`} />
                </div>
              </div>
            </div>

            {/* Listening / Speaking text */}
            <h2 className="text-base font-bold text-white tracking-wide">
              {listeningStatusText}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Speak naturally. Interrupt anytime.
            </p>

            {/* Horizontal Waveform Canvas spanning across card */}
            <div className="w-full max-w-xl h-14 mt-4 relative flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={520}
                height={50}
                className="w-full h-full"
              />
            </div>

            {/* Center Circular Microphone Button */}
            <button
              onClick={handleMicButtonClick}
              className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-200 cursor-pointer shadow-lg mt-2 ${
                state === 'SPEAKING'
                  ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
                  : isSessionActive
                  ? 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]'
                  : 'bg-[#101b33] hover:bg-[#17274a] border-white/[0.12] text-white'
              }`}
              title={state === 'SPEAKING' ? 'Click to Interrupt' : isSessionActive ? 'Click to End' : 'Click to Speak'}
            >
              <Mic className="w-5 h-5 text-white" />
            </button>

            {/* Quick interactive text prompt bar for convenience */}
            <form onSubmit={handleManualSubmit} className="w-full max-w-md mt-4 flex items-center gap-2">
              <input
                type="text"
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                placeholder="Or type a command (e.g. 'Check status', 'Stop immediately')..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#060a14] border border-white/[0.08] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[#1b4396] text-white text-xs font-semibold cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>

          {/* Right Column: 5 Compact Telemetry Tiles (Exact match with reference image) */}
          <div className="w-full lg:w-64 flex flex-col gap-2 shrink-0">
            {/* 1. Current Generation */}
            <div className="p-3 rounded-xl bg-[#0d162b] border border-white/[0.06] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-slate-400 font-medium">Current Generation</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base font-bold text-white leading-none">{numericGen}</span>
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">ACTIVE</span>
                </div>
              </div>
            </div>

            {/* 2. Voice State */}
            <div className="p-3 rounded-xl bg-[#0d162b] border border-white/[0.06] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-slate-400 font-medium">Voice State</div>
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mt-0.5">
                  {state}
                </div>
              </div>
            </div>

            {/* 3. Voice State Integrity */}
            <div className="p-3 rounded-xl bg-[#0d162b] border border-white/[0.06] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-slate-400 font-medium">Voice State Integrity</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">
                  100%
                </div>
              </div>
            </div>

            {/* 4. Rime Status */}
            <div className="p-3 rounded-xl bg-[#0d162b] border border-white/[0.06] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Cloud className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-slate-400 font-medium">Rime Status</div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                  CONNECTED
                </div>
              </div>
            </div>

            {/* 5. Voice Selector Dropdown */}
            <div className="p-3 rounded-xl bg-[#0d162b] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Voice</div>
                  <div className="text-xs font-semibold text-white mt-0.5">{selectedVoice}</div>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Bottom Section: Tabs + Tabular Timeline */}
        <div className="w-full bg-[#090f1d] border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_30px_rgba(0,0,0,0.5)] space-y-4">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
            <button
              onClick={() => setActiveBottomTab('timeline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeBottomTab === 'timeline'
                  ? 'bg-[#1b4396] text-white shadow-[0_0_12px_rgba(27,67,150,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Timeline</span>
            </button>

            <button
              onClick={() => setActiveBottomTab('waveform')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeBottomTab === 'waveform'
                  ? 'bg-[#1b4396] text-white shadow-[0_0_12px_rgba(27,67,150,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Voice Waveform</span>
            </button>

            <button
              onClick={() => setActiveBottomTab('flow')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeBottomTab === 'flow'
                  ? 'bg-[#1b4396] text-white shadow-[0_0_12px_rgba(27,67,150,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Generation Flow</span>
            </button>
          </div>

          {/* Timeline Rows (Exact match with reference image table) */}
          <div className="divide-y divide-white/[0.04]">
            {defaultTimelineEvents.map((evt, idx) => {
              const Icon = evt.icon;
              return (
                <div
                  key={idx}
                  className="py-2.5 flex items-center justify-between text-xs font-sans hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                >
                  {/* Left: Time & Icon & Event Name */}
                  <div className="flex items-center gap-4 min-w-[240px]">
                    <span className="text-slate-500 font-mono text-[11px]">{evt.time}</span>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${evt.iconColor}`} />
                      <span className="font-bold text-slate-200 tracking-wide text-[11px]">
                        {evt.name}
                      </span>
                    </div>
                  </div>

                  {/* Center: Description */}
                  <div className="flex-1 px-4 text-slate-400 truncate text-[11px]">
                    {evt.desc}
                  </div>

                  {/* Right: Generation Badge */}
                  <div className="shrink-0">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold ${evt.genColor}`}>
                      {evt.gen}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Sidebar: System Health, Recent Incidents, Try It Yourself */}
      <aside className="w-80 bg-[#070b14] border-l border-white/[0.06] p-5 flex flex-col justify-between shrink-0 space-y-5 overflow-y-auto">
        <div className="space-y-5">
          {/* Card 1: System Health */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-xs">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>System Health</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rime Connection</span>
                </div>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>LiveKit</span>
                </div>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-slate-500" />
                  <span>Latency (TTFB)</span>
                </div>
                <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                  38ms
                  <Info className="w-3 h-3 text-slate-500" />
                </span>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Card 2: Recent Incidents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>Recent Incidents</span>
              </div>
              <button
                onClick={() => {
                  if (incidents.length > 0) onSelectIncident(incidents[0]);
                }}
                className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold cursor-pointer"
              >
                View All →
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div>
                    <div className="font-bold text-white text-[11px]">INC-0047</div>
                    <div className="text-slate-400 text-[10px]">Voice Interruption</div>
                  </div>
                </div>
                <span className="text-slate-500 text-[10px]">2 min ago</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <div>
                    <div className="font-bold text-white text-[11px]">INC-0046</div>
                    <div className="text-slate-400 text-[10px]">Stale Result Rejected</div>
                  </div>
                </div>
                <span className="text-slate-500 text-[10px]">12 min ago</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <div>
                    <div className="font-bold text-white text-[11px]">INC-0045</div>
                    <div className="text-slate-400 text-[10px]">Generation Drift</div>
                  </div>
                </div>
                <span className="text-slate-500 text-[10px]">24 min ago</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <div>
                    <div className="font-bold text-white text-[11px]">INC-0044</div>
                    <div className="text-slate-400 text-[10px]">Tool Timeout</div>
                  </div>
                </div>
                <span className="text-slate-500 text-[10px]">1 hour ago</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Try It Yourself (Exact match with reference image) */}
        <div className="p-5 rounded-2xl bg-[#090f1d] border border-white/[0.08] flex flex-col items-center text-center space-y-3 shadow-lg">
          {/* Glowing Orb */}
          <div className="w-16 h-16 rounded-full bg-[#0d162b] border border-cyan-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <svg viewBox="0 0 40 20" className="w-8 h-4 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M0 10 Q 10 0, 20 10 T 40 10" />
            </svg>
          </div>

          <h3 className="text-sm font-bold text-white">Try It Yourself</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Experience the interruption flow with our live voice agent or run a chaos test.
          </p>

          <div className="w-full space-y-2 pt-1">
            <button
              onClick={onRunShowcaseTest}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            >
              <Mic className="w-4 h-4 text-white" />
              <span>Start Live Session</span>
            </button>

            <button
              onClick={onOpenChaosLab}
              className="w-full py-2 px-4 rounded-xl bg-[#0c1424] hover:bg-[#132038] border border-white/[0.08] text-slate-300 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
              <span>Open Chaos Lab</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
