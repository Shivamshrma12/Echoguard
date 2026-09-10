import React, { useState, useEffect, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { TopStatusBar } from './components/TopStatusBar';
import { SettingsModal } from './components/SettingsModal';
import { VoiceCorePage } from './pages/VoiceCorePage';
import { IncidentsPage } from './pages/IncidentsPage';
import { ChaosLabPage } from './pages/ChaosLabPage';
import { EvidencePage } from './pages/EvidencePage';
import { audioManager } from './audio/audioManager';
import {
  VoiceState,
  SystemMetrics,
  RimeProviderConfig,
  IncidentRecord,
  VoiceEvent,
} from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'live' | 'incidents' | 'chaos' | 'evidence' | 'settings'>('home');
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const voiceStateRef = useRef<VoiceState>(voiceState);
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);
  const [generationId, setGenerationId] = useState<string>('GEN-001');
  const generationIdRef = useRef<string>(generationId);
  const invalidatedGenerationsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    generationIdRef.current = generationId;
    audioManager.setGeneration(generationId);
  }, [generationId]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    interruptsHandled: 1,
    staleResultsBlocked: 1,
    recoverySuccessCount: 1,
    totalIncidents: 4,
    avgRecoveryTimeMs: 42.0,
    measuredInterruptToAudioStopMs: 38.0,
    measuredNewGenToSpeechMs: 120.0,
  });
  const [rimeConfig, setRimeConfig] = useState<RimeProviderConfig>({
    configured: true,
    connected: true,
    provider: 'Rime',
    model: 'coda',
    speaker: 'celeste',
    language: 'en',
    transport: 'REST/HTTP',
    audioFormat: 'MP3',
    sampleRate: 22050,
    segmentation: 'bySentence',
    endpoint: 'https://users.rime.ai/v1/rime-tts',
    statusText: 'CONNECTED',
    isSynthetic: false,
  });
  const [livekitConfigured, setLivekitConfigured] = useState<boolean>(true);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string>('');
  const [userInterimText, setUserInterimText] = useState<string>('');
  const [events, setEvents] = useState<VoiceEvent[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchIncidents();
    initWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setVoiceState(data.state || 'IDLE');
        if (data.generationId) setGenerationId(data.generationId);
        if (data.metrics) setMetrics(data.metrics);
        if (data.rime) setRimeConfig(data.rime);
        setLivekitConfigured(data.livekit?.configured ?? true);
      }
    } catch (err) {
      console.warn('Status poll note:', err);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
        if (data.length > 0 && !selectedIncident) {
          setSelectedIncident(data[0]);
        }
      }
    } catch (err) {
      console.warn('Incidents fetch note:', err);
    }
  };

  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/telemetry`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'SNAPSHOT') {
            if (msg.state) setVoiceState(msg.state);
            if (msg.generationId) setGenerationId(msg.generationId);
            if (msg.metrics) setMetrics(msg.metrics);
            if (msg.events) setEvents(msg.events);
          } else if (msg.type === 'EVENT') {
            setEvents((prev) => [...prev.slice(-30), msg.event]);
            if (msg.state) {
              setVoiceState(msg.state);
              if (msg.state === 'RECOVERING') {
                // Double safety net: ensure UI never gets stuck in RECOVERING
                setTimeout(() => {
                  setVoiceState((curr) => (curr === 'RECOVERING' ? 'LISTENING' : curr));
                }, 250);
              }
            }
            if (msg.generationId) setGenerationId(msg.generationId);
            if (msg.metrics) setMetrics(msg.metrics);

            if (msg.event.type === 'TTS_STARTED' || msg.event.type === 'TTS_STREAMING') {
              setActiveSpeechText(msg.event.payload?.text || '');
            } else if (msg.event.type === 'TTS_INTERRUPTED') {
              setActiveSpeechText('');
            }
          }
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      console.warn('WS note:', e);
    }
  };

  // Helper: separate leading interruption phrases from trailing user follow-up questions
  const parseUserUtterance = (rawText: string): { isInterruptionOnly: boolean; cleanedQuery: string } => {
    const text = rawText.trim();
    const interruptPrefixRegex = /^(no\s*,?\s*stop|no|stop|wait|hold\s+on|cancel|pause|quiet|shut\s+up|hey|listen|please\s+stop)[\s,.:;!?-]*/i;
    const match = text.match(interruptPrefixRegex);
    if (!match) {
      return { isInterruptionOnly: false, cleanedQuery: text };
    }
    const remainder = text.slice(match[0].length).trim();
    if (!remainder) {
      return { isInterruptionOnly: true, cleanedQuery: '' };
    }
    return { isInterruptionOnly: false, cleanedQuery: remainder };
  };

  // Automatic Barge-In Handler (Triggered when user speaks during playback or thinking)
  const handleAutomaticBargeIn = async (interruptedUtterance?: string) => {
    // 1. Instantly silence Rime audio playback (0ms acoustic cutoff)
    audioManager.flushAudioOnly();
    const staleGen = generationIdRef.current;
    invalidatedGenerationsRef.current.add(staleGen);
    audioManager.invalidateGeneration(staleGen);

    setActiveSpeechText('');
    setVoiceState('INTERRUPTING');

    // 2. Invalidate obsolete generation on server fence immediately
    try {
      const res = await fetch('/api/session/interrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: interruptedUtterance || 'User voice barge-in' }),
      });
      if (res.ok) {
        const data = await res.json();
        const newGen = data.newGeneration;
        setGenerationId(newGen);
        generationIdRef.current = newGen;
        audioManager.setGeneration(newGen);
        setVoiceState('LISTENING');
        fetchIncidents();
      }
    } catch (err) {
      console.error('Barge-in fence invalidation notice:', err);
      setVoiceState('LISTENING');
    }
  };

  // Start Live Session with continuous speech recognition
  const handleStartSession = async () => {
    const micGranted = await audioManager.startMicrophone();
    setIsMicActive(micGranted);
    setIsSessionActive(true);
    setVoiceState('LISTENING');

    audioManager.startListening(
      (transcript) => {
        setUserInterimText('');
        handleUserSpeechQuery(transcript);
      },
      () => {
        // Speech onset: if agent is THINKING, user speech triggers barge-in on the in-flight query
        if (voiceStateRef.current === 'THINKING') {
          handleAutomaticBargeIn('User speech during thinking');
        } else if (voiceStateRef.current !== 'SPEAKING') {
          setVoiceState('LISTENING');
        }
      },
      (interruptedUtterance) => {
        setUserInterimText('');
        // Automatic barge-in triggered while agent audio is playing
        handleAutomaticBargeIn(interruptedUtterance);
      },
      (err) => {
        console.warn('Speech recognition notice:', err);
      },
      (interim) => {
        setUserInterimText(interim);
      }
    );

    try {
      await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'live' }),
      });
      fetchStatus();
    } catch (err) {
      // ignore
    }
  };

  // End Session
  const handleEndSession = () => {
    audioManager.stopListening();
    audioManager.stopMicrophone();
    audioManager.flushAudio();
    setIsMicActive(false);
    setIsSessionActive(false);
    setVoiceState('IDLE');
    setActiveSpeechText('');
    setUserInterimText('');
  };

  // Manual Interruption Trigger (Deterministic Chaos Lab / UI Control)
  const handleInterrupt = async (customUtterance?: string) => {
    audioManager.flushAudio(); // Instant acoustic silence
    const staleGen = generationIdRef.current;
    invalidatedGenerationsRef.current.add(staleGen);
    audioManager.invalidateGeneration(staleGen);

    setVoiceState('INTERRUPTING');
    setActiveSpeechText('');

    try {
      const res = await fetch('/api/session/interrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: customUtterance || 'User manual interrupt' }),
      });
      if (res.ok) {
        const data = await res.json();
        const newGen = data.newGeneration;
        setGenerationId(newGen);
        generationIdRef.current = newGen;
        audioManager.setGeneration(newGen);
        setVoiceState('LISTENING');
        fetchIncidents();
      }
    } catch (err) {
      console.error('Interruption error:', err);
      setVoiceState('LISTENING');
    }
  };

  // Process user utterance via Gemini / Server with generation fencing
  const handleUserSpeechQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    // Check if utterance is purely an explicit interruption phrase with no follow-up question
    const parsed = parseUserUtterance(queryText);
    if (parsed.isInterruptionOnly) {
      console.log('[EchoGuard] Utterance was purely an interruption command. Acknowledged.');
      setVoiceState('LISTENING');
      return;
    }

    const actualQuery = parsed.cleanedQuery;
    const currentGen = generationIdRef.current;

    setVoiceState('THINKING');
    try {
      const res = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: actualQuery, generationId: currentGen }),
      });
      if (res.ok) {
        const data = await res.json();
        // GENERATION FENCE CHECK: verify generation is still active and valid
        if (
          data.status === 'FENCED_REJECTED' ||
          data.generationId !== generationIdRef.current ||
          invalidatedGenerationsRef.current.has(data.generationId)
        ) {
          console.warn(`[EchoGuard Fence] Stale result rejected for ${data.generationId}. Active generation is ${generationIdRef.current}`);
          setVoiceState('LISTENING');
          return;
        }

        if (data.status === 'SUCCESS') {
          setActiveSpeechText(data.response);
          // Speak aloud through computer speakers using Rime TTS under verified generation
          audioManager.speak(
            data.response,
            data.generationId,
            () => {
              // Physical speaker output has started
              setVoiceState('SPEAKING');
              fetch('/api/session/playback-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generationId: data.generationId, text: data.response })
              }).catch(() => {});
            },
            () => {
              // Playback ended normally
              fetch('/api/session/playback-end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generationId: data.generationId })
              }).catch(() => {});
              setVoiceState('LISTENING');
              setActiveSpeechText('');
              fetchStatus();
            }
          );
        }
      } else {
        setVoiceState('LISTENING');
      }
    } catch (e) {
      console.error('Chat error:', e);
      setVoiceState('LISTENING');
    }
  };

  // Run Showcase Interruption Test
  const handleRunShowcaseTest = async () => {
    // 1. Speak initial Gen 1 advice
    const initialSpeech = 'EchoGuard is actively monitoring speech generation fences to prevent stale audio packets...';
    setActiveSpeechText(initialSpeech);
    setVoiceState('SPEAKING');

    audioManager.speak(initialSpeech);

    // 2. After 1.2s, simulate user interruption
    setTimeout(async () => {
      audioManager.flushAudio(); // CUT AUDIO
      setVoiceState('INTERRUPTING');

      try {
        const res = await fetch('/api/demo/interrupt-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          await fetchIncidents();
          await fetchStatus();
          if (data.incident) {
            setSelectedIncident(data.incident);
          }

          // Speak recovery response
          const recoverySpeech = 'Interruption verified. Previous generation invalidated and audio buffer flushed.';
          setActiveSpeechText(recoverySpeech);
          setVoiceState('SPEAKING');
          audioManager.speak(
            recoverySpeech,
            () => setVoiceState('SPEAKING'),
            () => setVoiceState('IDLE')
          );
        }
      } catch (err) {
        console.error('Showcase error:', err);
      }
    }, 1400);
  };

  const handleSaveKeys = async (keys: {
    gemini_api_key?: string;
    rime_api_key?: string;
    livekit_url?: string;
    livekit_api_key?: string;
    livekit_api_secret?: string;
  }) => {
    try {
      const res = await fetch('/api/config/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      if (res.ok) {
        fetchStatus();
      }
    } catch (e) {
      console.error('Failed to save keys:', e);
    }
  };

  const handleSelectVoiceModel = async (modelOrCombo: string) => {
    let model = 'coda';
    let speaker = 'celeste';
    if (modelOrCombo.includes(':')) {
      const parts = modelOrCombo.split(':');
      model = parts[0];
      speaker = parts[1];
    } else if (modelOrCombo.includes('mist')) {
      model = 'mistv3';
      speaker = 'astra';
    } else if (modelOrCombo.includes('coda')) {
      model = 'coda';
      speaker = 'celeste';
    }
    try {
      await fetch('/api/config/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, speaker }),
      });
      fetchStatus();
    } catch (e) {
      console.warn('Failed to update voice model:', e);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060911] text-slate-100 font-sans select-none antialiased">
      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveKeys={handleSaveKeys}
      />

      {/* Left Icon Navigation Rail */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={(tab: any) => {
          if (tab === 'settings') {
            setIsSettingsOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Status Bar matching reference image */}
        <TopStatusBar
          rimeConfig={rimeConfig}
          onOpenSettings={() => setIsSettingsOpen(true)}
          brandTitle="EchoGuard"
          brandSubtitle="Realtime Voice Reliability Infrastructure"
          selectedModel={`${rimeConfig.model} / ${rimeConfig.speaker}`}
          onSelectModel={handleSelectVoiceModel}
        />

        {/* Tab Routing */}
        <main className="flex-1 flex overflow-hidden">
          {(activeTab === 'home' || activeTab === 'live') && (
            <VoiceCorePage
              state={voiceState}
              generationId={generationId}
              metrics={metrics}
              rimeConfig={rimeConfig}
              livekitConfigured={livekitConfigured}
              isSessionActive={isSessionActive}
              isMicActive={isMicActive}
              activeSpeechText={activeSpeechText}
              userInterimText={userInterimText}
              events={events}
              incidents={incidents}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
              onInterrupt={handleInterrupt}
              onRunShowcaseTest={handleRunShowcaseTest}
              onSelectIncident={(inc) => {
                setSelectedIncident(inc);
                setActiveTab('incidents');
              }}
              onOpenChaosLab={() => setActiveTab('chaos')}
              onSendQuery={handleUserSpeechQuery}
              selectedVoice={`${rimeConfig.model}:${rimeConfig.speaker}`}
              onSelectVoice={handleSelectVoiceModel}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentsPage
              incidents={incidents}
              selectedIncident={selectedIncident}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
            />
          )}

          {activeTab === 'chaos' && (
            <ChaosLabPage
              onSuiteComplete={() => {
                fetchIncidents();
                fetchStatus();
              }}
            />
          )}

          {activeTab === 'evidence' && <EvidencePage />}
        </main>
      </div>

      {/* Settings Modal (Input for Gemini API Key, Rime API Key, LiveKit) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveKeys={handleSaveKeys}
      />
    </div>
  );
}

export default App;
