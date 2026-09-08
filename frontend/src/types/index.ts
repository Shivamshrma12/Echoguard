export type VoiceState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTING'
  | 'INVALIDATED'
  | 'RECOVERING'
  | 'ERROR';

export type EventType =
  | 'SESSION_STARTED'
  | 'USER_SPEECH_STARTED'
  | 'USER_SPEECH_START'
  | 'USER_SPEECH_ENDED'
  | 'USER_SPEECH_END'
  | 'STT_PARTIAL'
  | 'STT_FINAL'
  | 'AGENT_TURN_START'
  | 'LLM_FIRST_TOKEN'
  | 'LLM_TEXT_READY'
  | 'TTS_REQUEST_START'
  | 'RIME_STREAM_CONNECTED'
  | 'RIME_FIRST_AUDIO'
  | 'AUDIO_PLAYBACK_START'
  | 'AUDIO_PLAYBACK_END'
  | 'USER_INTERRUPTION'
  | 'GENERATION_CREATED'
  | 'NEW_GENERATION_CREATED'
  | 'STATE_CHANGED'
  | 'TOOL_STARTED'
  | 'TOOL_COMPLETED'
  | 'GENERATION_INVALIDATED'
  | 'AUDIO_CANCEL_REQUESTED'
  | 'AUDIO_CANCELLED'
  | 'TTS_STARTED'
  | 'TTS_STREAMING'
  | 'TTS_INTERRUPTED'
  | 'AUDIO_QUEUE_FLUSHED'
  | 'STALE_RESULT_RECEIVED'
  | 'STALE_RESULT_REJECTED'
  | 'RECOVERY_STARTED'
  | 'RECOVERY_COMPLETED'
  | 'INCIDENT_CREATED'
  | 'INCIDENT_RESOLVED';

export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'RECOVERY';

export interface VoiceEvent {
  id: string;
  timestamp: number;
  timestamp_ms?: number;
  iso_time: string;
  type: EventType;
  generationId: string;
  source: string;
  severity: EventSeverity;
  payload: Record<string, any>;
}

export interface IncidentRecord {
  incidentId: string;
  timestamp: number;
  trigger: string;
  initialGeneration: string;
  finalGeneration: string;
  durationMs: number;
  staleResultsCount: number;
  audioState: string;
  resolution: string;
  evidenceType: 'ACTUAL AUDIO' | 'EVENT RECONSTRUCTION';
  whatAgentThought: string;
  whatUserHeard: string;
  whatWasInvalidated: string;
  whatWasRejected: string;
  whatWasDelivered: string;
  events: VoiceEvent[];
}

export interface SystemMetrics {
  interruptsHandled: number;
  staleResultsBlocked: number;
  recoverySuccessCount: number;
  totalIncidents: number;
  avgRecoveryTimeMs: number;
  measuredInterruptToAudioStopMs: number | null;
  measuredNewGenToSpeechMs: number | null;
  sttLatencyMs?: number | null;
  llmFirstTokenLatencyMs?: number | null;
  rimeTtfbMs?: number | null;
  playbackStartLatencyMs?: number | null;
  endToAudibleResponseMs?: number | null;
  interruptionDetectionLatencyMs?: number | null;
  audioCancellationLatencyMs?: number | null;
  generationInvalidationLatencyMs?: number | null;
  staleRejectionLatencyMs?: number | null;
  recoveryLatencyMs?: number | null;
}

export interface RimeProviderConfig {
  configured: boolean;
  connected: boolean;
  provider: string;
  model: string;
  speaker: string;
  language: string;
  transport: string;
  audioFormat: string;
  sampleRate: number;
  segmentation: string;
  endpoint: string;
  statusText: 'NOT CONFIGURED' | 'CONNECTION FAILED' | 'LIVE' | 'CONFIGURED' | 'CONNECTED';
  isSynthetic: boolean;
}

export interface ChaosTestResult {
  testId: string;
  name: string;
  description: string;
  passed: boolean;
  staleLeaks: number;
  durationMs: number;
  assertions: string[];
  measuredMetrics: Record<string, any>;
  details: string;
}

export interface ChaosLabSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalStaleLeaks: number;
  durationMs: number;
  results: ChaosTestResult[];
}
