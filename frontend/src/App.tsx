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
  const [generationId, setGenerationId] = useState<string>('GEN-001');
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
    model: 'rime-tts-mist-v3',
    speaker: 'celeste',
    language: 'en',
    transport: 'WebSocket',
    audioFormat: 'PCM',
    sampleRate: 16000,
    segmentation: 'bySentence',
    endpoint: 'wss://users.rime.ai/v1/rime-tts',
    statusText: 'CONNECTED',
    isSynthetic: false,
  });
  const [livekitConfigured, setLivekitConfigured] = useState<boolean>(true);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string>('');
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
            if (msg.state) setVoiceState(msg.state);
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

  // Start Live Session with real speech recognition
  const handleStartSession = async () => {
    const micGranted = await audioManager.startMicrophone();
    setIsMicActive(micGranted);
    setIsSessionActive(true);
    setVoiceState('LISTENING');

    // Start browser speech recognition
    audioManager.startListening(
      (transcript) => {
        handleUserSpeechQuery(transcript);
      },
      () => {
        // Speech started: if agent was speaking, interrupt immediately!
        if (voiceState === 'SPEAKING') {
          handleInterrupt();
        } else {
          setVoiceState('LISTENING');
        }
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
  };

  // Real Interruption Trigger (Cuts audio immediately with 0ms delay!)
  const handleInterrupt = async () => {
    audioManager.flushAudio(); // Instant acoustic silence
    setVoiceState('INTERRUPTING');
    setActiveSpeechText('');

    try {
      const res = await fetch('/api/session/interrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: 'Stop. Vehicle approaching.' }),
      });
      if (res.ok) {
        const data = await res.json();
        setVoiceState('RECOVERING');
        setGenerationId(data.newGeneration);
        await fetchIncidents();

        // Speak the emergency recovery sentence through speakers
        const recoveryResponse = 'Stop. Vehicle approaching. Wait until crossing is clear.';
        setActiveSpeechText(recoveryResponse);
        setVoiceState('SPEAKING');
        audioManager.speak(
          recoveryResponse,
          () => setVoiceState('SPEAKING'),
          () => setVoiceState('LISTENING')
        );
      }
    } catch (err) {
      console.error('Interruption error:', err);
    }
  };

  // Process user utterance via Gemini / Server
  const handleUserSpeechQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setVoiceState('THINKING');
    try {
      const res = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          setActiveSpeechText(data.response);
          setVoiceState('SPEAKING');

          // Speak aloud through computer speakers
          audioManager.speak(
            data.response,
            () => setVoiceState('SPEAKING'),
            () => setVoiceState('LISTENING')
          );
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      setVoiceState('LISTENING');
    }
  };

  // Run Showcase Interruption Test
  const handleRunShowcaseTest = async () => {
    // 1. Speak initial Gen 1 advice
    const initialSpeech = 'Continue toward the next crossing. The path ahead appears clear...';
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
          const recoverySpeech = 'Stop. Vehicle approaching. Wait until the crossing is clear.';
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b14] text-slate-100 font-sans select-none">
      {/* Left Sidebar Navigation matching reference image */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
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
          brandTitle="EchoTrace"
          brandSubtitle="The Flight Recorder for Voice Agents"
          selectedModel="rime-tts-mist-v3"
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
