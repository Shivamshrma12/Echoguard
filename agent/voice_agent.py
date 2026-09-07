import os
import asyncio
import logging
from typing import Optional
from agent.state.models import VoiceState, EventType, EventSeverity
from agent.state.generation_fence import GenerationFence
from agent.events.event_recorder import EventRecorder
from agent.incidents.incident_engine import IncidentEngine
from agent.rime_provider import RimeProviderService

logger = logging.getLogger("echoguard.agent")

class EchoGuardVoiceAgent:
    """
    EchoGuard LiveKit Voice Agent.
    Integrates LiveKit WebRTC, Rime TTS, and Generation Fencing.
    """
    def __init__(
        self,
        fence: GenerationFence,
        recorder: EventRecorder,
        incidents: IncidentEngine,
        rime_service: RimeProviderService
    ):
        self.fence = fence
        self.recorder = recorder
        self.incidents = incidents
        self.rime_service = rime_service
        self._is_running = False
        self._current_speech_handle = None

    async def start(self):
        """Starts the voice agent session."""
        self._is_running = True
        self.fence.start_session(source="livekit_agent")
        logger.info(f"EchoGuard Voice Agent started. Generation: {self.fence.current_generation_id}")

    async def handle_user_speech_start(self):
        """Called when user begins speaking / interrupting."""
        logger.info("User speech detected by LiveKit VAD.")
        if self.fence.state == VoiceState.SPEAKING:
            # User interrupted active speech!
            prev_gen, new_gen = self.fence.trigger_interruption("User interrupted spoken output")
            logger.warning(f"Voice interruption! {prev_gen} -> {new_gen}")
        else:
            self.fence.set_state(VoiceState.LISTENING, source="user")

    async def handle_user_speech_end(self, transcribed_text: str):
        """Called when user finishes speaking."""
        self.fence.set_state(VoiceState.THINKING, source="stt")
        self.recorder.record(
            event_type=EventType.USER_SPEECH_ENDED,
            generation_id=self.fence.current_generation_id,
            source="user",
            payload={"transcription": transcribed_text}
        )

    async def synthesize_and_speak(self, text: str, generation_id: Optional[str] = None):
        """
        Validates target generation before dispatching to Rime TTS.
        If target generation is invalidated or stale, suppresses speech.
        """
        target_gen = generation_id or self.fence.current_generation_id
        if target_gen != self.fence.current_generation_id or target_gen in self.fence.invalidated_generations:
            # Blocked!
            self.recorder.record(
                event_type=EventType.STALE_RESULT_REJECTED,
                generation_id=target_gen,
                source="generation_fence",
                severity=EventSeverity.CRITICAL,
                payload={"attempted_text": text, "status": "BLOCKED_BEFORE_TTS"}
            )
            return False

        self.fence.begin_speech(text, provider="Rime")
        return True
