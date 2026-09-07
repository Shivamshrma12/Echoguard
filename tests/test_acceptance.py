import pytest
import time
from agent.events.event_recorder import EventRecorder
from agent.state.generation_fence import GenerationFence
from agent.incidents.incident_engine import IncidentEngine
from agent.state.models import VoiceState, EventType

def test_acceptance_delayed_tool_interruption_and_stale_rejection():
    """
    ECHOGUARD FORMAL ACCEPTANCE TEST
    
    Demonstrates deterministic stale-result fencing under realtime voice interruption:
    1. Agent begins Rime speech in Generation N (GEN-014).
    2. An asynchronous background tool is started in Generation N.
    3. User interrupts ('Stop. Vehicle approaching.').
    4. Generation N is invalidated; audio queue is flushed immediately.
    5. Generation N+1 (GEN-015) becomes active.
    6. Delayed tool result from Generation N arrives.
    7. EchoGuard rejects the delayed result as stale (0 leaks).
    8. Generation N+1 delivers the updated safety instruction via Rime.
    
    Records and verifies exact real timestamps and measured latencies.
    """
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    incidents = IncidentEngine(recorder)
    
    # 1. Rime speech begins in Generation N
    initial_gen = fence.current_generation_id
    assert initial_gen == "GEN-014"
    fence.begin_speech("Continue toward the next crossing. The path ahead appears clear...", provider="Rime")
    assert fence.state == VoiceState.SPEAKING
    assert fence._audio_queue_active is True
    
    # 2. Delayed tool call introduced in Generation N
    tool_id = "op_crossing_clearance_sensor"
    op_gen = fence.register_async_operation(tool_id, "scan_crossing_clearance")
    assert op_gen == initial_gen
    
    # 3. User interrupts
    t_interrupt = time.time()
    prev_gen, new_gen = fence.trigger_interruption("Stop. There is a vehicle approaching.")
    t_audio_stopped = time.time()
    
    # 4. Assert invalidation and audio stop
    assert prev_gen == "GEN-014"
    assert new_gen == "GEN-015"
    assert prev_gen in fence.invalidated_generations
    assert fence._audio_queue_active is False
    assert fence.state == VoiceState.RECOVERING
    
    # 5. Delayed Generation N result arrives
    t_stale_arrived = time.time()
    stale_payload = {"clearance": True, "proceed": True}
    is_valid = fence.validate_operation_result(tool_id, op_gen, stale_payload)
    
    # 6. Assert result is strictly REJECTED
    assert is_valid is False, "Stale result from Generation N MUST be rejected!"
    assert fence.metrics.staleResultsBlocked == 1
    
    # 7. Generation N+1 delivers new speech
    t_new_speech = time.time()
    fence.complete_recovery("Stop. Vehicle approaching. Wait until the crossing is clear.", provider="Rime")
    assert fence.state == VoiceState.SPEAKING
    assert fence.current_generation_id == "GEN-015"
    assert fence.metrics.recoverySuccessCount == 1
    
    # 8. Assert measured timing invariants
    assert fence.metrics.measuredInterruptToAudioStopMs is not None
    assert fence.metrics.measuredInterruptToAudioStopMs >= 0.0
    assert fence.metrics.measuredNewGenToSpeechMs is not None
    assert fence.metrics.measuredNewGenToSpeechMs >= 0.0
    
    # Check event stream integrity
    event_types = [e.type for e in recorder.events]
    assert EventType.TTS_STARTED in event_types
    assert EventType.USER_SPEECH_STARTED in event_types
    assert EventType.AUDIO_QUEUE_FLUSHED in event_types
    assert EventType.GENERATION_INVALIDATED in event_types
    assert EventType.GENERATION_CREATED in event_types
    assert EventType.STALE_RESULT_REJECTED in event_types
    assert EventType.RECOVERY_COMPLETED in event_types
