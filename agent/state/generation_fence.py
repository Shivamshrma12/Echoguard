import time
import asyncio
from typing import Set, Dict, Any, Optional, List, Tuple
from agent.state.models import (
    VoiceState,
    EventType,
    EventSeverity,
    VoiceEvent,
    SystemMetrics,
    RimeProviderConfig,
)
from agent.events.event_recorder import EventRecorder

class GenerationFence:
    """
    EchoGuard Generation Fencing Engine.
    Enforces conversational consistency by binding all asynchronous operations,
    speech syntheses, and tool executions to monotonic generation fences.
    
    Any work initiated in Generation N that completes after Generation N is invalidated
    is deterministically blocked and rejected before reaching audio synthesis.
    """
    def __init__(self, recorder: EventRecorder, initial_gen: int = 14):
        self.recorder = recorder
        self._gen_counter = initial_gen
        self._current_gen_id = f"GEN-{self._gen_counter:03d}"
        self._state = VoiceState.IDLE
        self._invalidated_gens: Set[str] = set()
        self._metrics = SystemMetrics()
        
        # Real timing markers
        self._last_interrupt_ts: Optional[float] = None
        self._last_audio_stop_ts: Optional[float] = None
        self._last_new_gen_ts: Optional[float] = None
        self._last_new_speech_ts: Optional[float] = None
        
        # Pending async operations tracked by generation
        self._pending_ops: Dict[str, Dict[str, Any]] = {}
        
        # Active audio queue/streaming flag
        self._audio_queue_active: bool = False
        self._current_speech_text: str = ""

    @property
    def current_generation_id(self) -> str:
        return self._current_gen_id

    @property
    def state(self) -> VoiceState:
        return self._state

    @property
    def metrics(self) -> SystemMetrics:
        return self._metrics

    @property
    def invalidated_generations(self) -> Set[str]:
        return set(self._invalidated_gens)

    def set_state(self, new_state: VoiceState, source: str = "agent", payload: Optional[Dict[str, Any]] = None) -> VoiceState:
        old_state = self._state
        self._state = new_state
        self.recorder.record(
            event_type=EventType.STATE_CHANGED,
            generation_id=self._current_gen_id,
            source=source,
            severity=EventSeverity.INFO,
            payload={
                "previous_state": old_state.value,
                "new_state": new_state.value,
                **(payload or {})
            }
        )
        return self._state

    def start_session(self, source: str = "system") -> None:
        self._state = VoiceState.LISTENING
        self.recorder.record(
            event_type=EventType.SESSION_STARTED,
            generation_id=self._current_gen_id,
            source=source,
            severity=EventSeverity.INFO,
            payload={"initial_generation": self._current_gen_id}
        )

    def create_generation(self, reason: str = "new_turn") -> str:
        """Create next generation explicitly without an interruption trigger."""
        self._gen_counter += 1
        self._current_gen_id = f"GEN-{self._gen_counter:03d}"
        self.recorder.record(
            event_type=EventType.GENERATION_CREATED,
            generation_id=self._current_gen_id,
            source="generation_fence",
            severity=EventSeverity.INFO,
            payload={"reason": reason, "generation_counter": self._gen_counter}
        )
        return self._current_gen_id

    def begin_speech(self, text: str, provider: str = "Rime") -> bool:
        """Start speech generation bound to the current generation."""
        self._current_speech_text = text
        self._audio_queue_active = True
        self.set_state(VoiceState.SPEAKING, source=provider.lower())
        
        self.recorder.record(
            event_type=EventType.TTS_STARTED,
            generation_id=self._current_gen_id,
            source=provider,
            severity=EventSeverity.INFO,
            payload={"text": text, "provider": provider}
        )
        
        self.recorder.record(
            event_type=EventType.TTS_STREAMING,
            generation_id=self._current_gen_id,
            source=provider,
            severity=EventSeverity.INFO,
            payload={"text": text, "status": "streaming"}
        )
        return True

    def register_async_operation(self, op_id: str, op_name: str, payload: Optional[Dict[str, Any]] = None) -> str:
        """Registers a background operation tagged with the current active generation."""
        op_gen = self._current_gen_id
        self._pending_ops[op_id] = {
            "op_name": op_name,
            "generation_id": op_gen,
            "start_time": time.time(),
            "payload": payload or {}
        }
        self.recorder.record(
            event_type=EventType.TOOL_STARTED,
            generation_id=op_gen,
            source="tool",
            severity=EventSeverity.INFO,
            payload={"op_id": op_id, "op_name": op_name, **(payload or {})}
        )
        return op_gen

    def trigger_interruption(self, user_utterance: str = "Stop.") -> Tuple[str, str]:
        """
        Executes real interruption sequence:
        1. Record interrupt timestamp
        2. Set state INTERRUPTING
        3. Flush audio queue and record audio stop timestamp
        4. Invalidate previous generation
        5. Create new generation
        6. Set state RECOVERING
        Returns (previous_gen_id, new_gen_id).
        """
        now = time.time()
        self._last_interrupt_ts = now
        
        prev_gen_id = self._current_gen_id
        self._invalidated_gens.add(prev_gen_id)
        self._metrics.interruptsHandled += 1
        
        # User speech detected
        self.recorder.record(
            event_type=EventType.USER_SPEECH_STARTED,
            generation_id=prev_gen_id,
            source="user",
            severity=EventSeverity.WARNING,
            payload={"utterance": user_utterance}
        )
        
        # State -> INTERRUPTING
        self.set_state(VoiceState.INTERRUPTING, source="user", payload={"trigger": "user_speech"})
        
        # Audio queue flushed & cancelled
        self._audio_queue_active = False
        self._last_audio_stop_ts = time.time()
        audio_stop_latency = (self._last_audio_stop_ts - self._last_interrupt_ts) * 1000.0
        self._metrics.measuredInterruptToAudioStopMs = round(audio_stop_latency, 2)
        
        self.recorder.record(
            event_type=EventType.TTS_INTERRUPTED,
            generation_id=prev_gen_id,
            source="audio_engine",
            severity=EventSeverity.CRITICAL,
            payload={
                "invalidated_generation": prev_gen_id,
                "stopped_text": self._current_speech_text,
                "interrupt_to_stop_ms": self._metrics.measuredInterruptToAudioStopMs
            }
        )
        
        self.recorder.record(
            event_type=EventType.AUDIO_QUEUE_FLUSHED,
            generation_id=prev_gen_id,
            source="audio_engine",
            severity=EventSeverity.CRITICAL,
            payload={"flushed_generation": prev_gen_id}
        )
        
        # Invalidate generation
        self.recorder.record(
            event_type=EventType.GENERATION_INVALIDATED,
            generation_id=prev_gen_id,
            source="generation_fence",
            severity=EventSeverity.CRITICAL,
            payload={
                "invalidated_generation": prev_gen_id,
                "reason": "USER_INTERRUPTION"
            }
        )
        
        # Create new generation
        self._gen_counter += 1
        self._current_gen_id = f"GEN-{self._gen_counter:03d}"
        self._last_new_gen_ts = time.time()
        
        self.recorder.record(
            event_type=EventType.GENERATION_CREATED,
            generation_id=self._current_gen_id,
            source="generation_fence",
            severity=EventSeverity.INFO,
            payload={
                "previous_generation": prev_gen_id,
                "new_generation": self._current_gen_id,
                "reason": "interruption_recovery"
            }
        )
        
        # Transition state to RECOVERING
        self.set_state(VoiceState.RECOVERING, source="agent", payload={"active_generation": self._current_gen_id})
        self.recorder.record(
            event_type=EventType.RECOVERY_STARTED,
            generation_id=self._current_gen_id,
            source="generation_fence",
            severity=EventSeverity.INFO,
            payload={"recovering_generation": self._current_gen_id}
        )
        
        return prev_gen_id, self._current_gen_id

    def validate_operation_result(
        self,
        op_id: str,
        op_generation_id: str,
        result_payload: Dict[str, Any]
    ) -> bool:
        """
        Critical core validation check:
        Determines whether an asynchronous tool/model result is allowed to produce output.
        If op_generation_id != current_generation_id or op_generation_id in invalidated_gens:
        REJECTS STALE RESULT and blocks any downstream audio synthesis!
        """
        now = time.time()
        is_stale = (
            op_generation_id != self._current_gen_id or
            op_generation_id in self._invalidated_gens
        )
        
        if is_stale:
            # Stale result arrived
            self._metrics.staleResultsBlocked += 1
            
            self.recorder.record(
                event_type=EventType.STALE_RESULT_RECEIVED,
                generation_id=op_generation_id,
                source="tool",
                severity=EventSeverity.WARNING,
                payload={
                    "op_id": op_id,
                    "target_generation": op_generation_id,
                    "current_generation": self._current_gen_id,
                    "result": result_payload
                }
            )
            
            self.recorder.record(
                event_type=EventType.STALE_RESULT_REJECTED,
                generation_id=op_generation_id,
                source="generation_fence",
                severity=EventSeverity.CRITICAL,
                payload={
                    "op_id": op_id,
                    "rejected_generation": op_generation_id,
                    "active_generation": self._current_gen_id,
                    "action": "SPEECH_SUPPRESSED_DISCARDED",
                    "reason": "Obsolete conversational state fenced by EchoGuard"
                }
            )
            
            if op_id in self._pending_ops:
                del self._pending_ops[op_id]
                
            return False  # STALE: DO NOT SPEAK
            
        # Valid generation
        self.recorder.record(
            event_type=EventType.TOOL_COMPLETED,
            generation_id=op_generation_id,
            source="tool",
            severity=EventSeverity.INFO,
            payload={"op_id": op_id, "result": result_payload}
        )
        
        if op_id in self._pending_ops:
            del self._pending_ops[op_id]
            
        return True

    def complete_recovery(self, new_response_text: str, provider: str = "Rime") -> None:
        """
        Delivers the new generation response through Rime TTS and completes the recovery.
        """
        now = time.time()
        self._last_new_speech_ts = now
        
        if self._last_new_gen_ts:
            gen_to_speech_ms = (now - self._last_new_gen_ts) * 1000.0
            self._metrics.measuredNewGenToSpeechMs = round(gen_to_speech_ms, 2)
            
        self._metrics.recoverySuccessCount += 1
        
        # Calculate running average recovery time if interruption occurred
        if self._last_interrupt_ts:
            total_recovery_ms = (now - self._last_interrupt_ts) * 1000.0
            if self._metrics.avgRecoveryTimeMs == 0.0:
                self._metrics.avgRecoveryTimeMs = round(total_recovery_ms, 2)
            else:
                self._metrics.avgRecoveryTimeMs = round(
                    (self._metrics.avgRecoveryTimeMs + total_recovery_ms) / 2.0, 2
                )
                
        self.recorder.record(
            event_type=EventType.RECOVERY_COMPLETED,
            generation_id=self._current_gen_id,
            source="generation_fence",
            severity=EventSeverity.RECOVERY,
            payload={
                "active_generation": self._current_gen_id,
                "recovery_duration_ms": round((now - (self._last_interrupt_ts or now)) * 1000.0, 2),
                "resolution": "SUCCESS"
            }
        )
        
        # Speak the new response
        self.begin_speech(new_response_text, provider=provider)
