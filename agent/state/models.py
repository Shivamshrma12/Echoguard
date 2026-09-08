from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import time

class VoiceState(str, Enum):
    IDLE = "IDLE"
    CONNECTING = "CONNECTING"
    LISTENING = "LISTENING"
    THINKING = "THINKING"
    SPEAKING = "SPEAKING"
    INTERRUPTING = "INTERRUPTING"
    INVALIDATED = "INVALIDATED"
    RECOVERING = "RECOVERING"
    ERROR = "ERROR"

class EventType(str, Enum):
    SESSION_STARTED = "SESSION_STARTED"
    USER_SPEECH_STARTED = "USER_SPEECH_STARTED"
    USER_SPEECH_START = "USER_SPEECH_START"
    USER_SPEECH_ENDED = "USER_SPEECH_ENDED"
    USER_SPEECH_END = "USER_SPEECH_END"
    STT_PARTIAL = "STT_PARTIAL"
    STT_FINAL = "STT_FINAL"
    AGENT_TURN_START = "AGENT_TURN_START"
    LLM_FIRST_TOKEN = "LLM_FIRST_TOKEN"
    LLM_TEXT_READY = "LLM_TEXT_READY"
    TTS_REQUEST_START = "TTS_REQUEST_START"
    RIME_STREAM_CONNECTED = "RIME_STREAM_CONNECTED"
    RIME_FIRST_AUDIO = "RIME_FIRST_AUDIO"
    AUDIO_PLAYBACK_START = "AUDIO_PLAYBACK_START"
    AUDIO_PLAYBACK_END = "AUDIO_PLAYBACK_END"
    USER_INTERRUPTION = "USER_INTERRUPTION"
    GENERATION_CREATED = "GENERATION_CREATED"
    NEW_GENERATION_CREATED = "NEW_GENERATION_CREATED"
    STATE_CHANGED = "STATE_CHANGED"
    TOOL_STARTED = "TOOL_STARTED"
    TOOL_COMPLETED = "TOOL_COMPLETED"
    GENERATION_INVALIDATED = "GENERATION_INVALIDATED"
    AUDIO_CANCEL_REQUESTED = "AUDIO_CANCEL_REQUESTED"
    AUDIO_CANCELLED = "AUDIO_CANCELLED"
    TTS_STARTED = "TTS_STARTED"
    TTS_STREAMING = "TTS_STREAMING"
    TTS_INTERRUPTED = "TTS_INTERRUPTED"
    AUDIO_QUEUE_FLUSHED = "AUDIO_QUEUE_FLUSHED"
    STALE_RESULT_RECEIVED = "STALE_RESULT_RECEIVED"
    STALE_RESULT_REJECTED = "STALE_RESULT_REJECTED"
    RECOVERY_STARTED = "RECOVERY_STARTED"
    RECOVERY_COMPLETED = "RECOVERY_COMPLETED"
    INCIDENT_CREATED = "INCIDENT_CREATED"
    INCIDENT_RESOLVED = "INCIDENT_RESOLVED"

class EventSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    RECOVERY = "RECOVERY"

class VoiceEvent(BaseModel):
    id: str
    timestamp: float = Field(default_factory=time.time)
    timestamp_ms: float = 0.0
    iso_time: str = ""
    type: EventType
    generationId: str
    source: str = "agent" # "user", "agent", "rime", "livekit", "chaos_lab"
    severity: EventSeverity = EventSeverity.INFO
    payload: Dict[str, Any] = Field(default_factory=dict)

class IncidentRecord(BaseModel):
    incidentId: str
    timestamp: float = Field(default_factory=time.time)
    trigger: str = "VOICE INTERRUPTION"
    initialGeneration: str
    finalGeneration: str
    durationMs: float = 0.0
    staleResultsCount: int = 0
    audioState: str = "FLUSHED"
    resolution: str = "SUCCESS"
    evidenceType: str = "EVENT RECONSTRUCTION" # "ACTUAL AUDIO" or "EVENT RECONSTRUCTION"
    
    # Five forensic view questions
    whatAgentThought: str = ""
    whatUserHeard: str = ""
    whatWasInvalidated: str = ""
    whatWasRejected: str = ""
    whatWasDelivered: str = ""
    
    events: List[VoiceEvent] = Field(default_factory=list)

class SystemMetrics(BaseModel):
    interruptsHandled: int = 0
    staleResultsBlocked: int = 0
    recoverySuccessCount: int = 0
    totalIncidents: int = 0
    avgRecoveryTimeMs: float = 0.0
    measuredInterruptToAudioStopMs: Optional[float] = None
    measuredNewGenToSpeechMs: Optional[float] = None
    sttLatencyMs: Optional[float] = None
    llmFirstTokenLatencyMs: Optional[float] = None
    rimeTtfbMs: Optional[float] = None
    playbackStartLatencyMs: Optional[float] = None
    endToAudibleResponseMs: Optional[float] = None
    interruptionDetectionLatencyMs: Optional[float] = None
    audioCancellationLatencyMs: Optional[float] = None
    generationInvalidationLatencyMs: Optional[float] = None
    staleRejectionLatencyMs: Optional[float] = None
    recoveryLatencyMs: Optional[float] = None

class RimeProviderConfig(BaseModel):
    configured: bool = False
    connected: bool = False
    provider: str = "Rime"
    model: str = "coda"
    speaker: str = "celeste"
    language: str = "en"
    transport: str = "WebSocket"
    audioFormat: str = "PCM"
    sampleRate: int = 16000
    segmentation: str = "bySentence"
    endpoint: str = "wss://users.rime.ai/v1/rime-tts"
    statusText: str = "NOT CONFIGURED" # "NOT CONFIGURED", "CONNECTION FAILED", "LIVE"
    isSynthetic: bool = False
