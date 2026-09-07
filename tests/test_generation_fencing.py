import pytest
from agent.events.event_recorder import EventRecorder
from agent.state.generation_fence import GenerationFence
from agent.state.models import VoiceState, EventType

def test_generation_creation_and_increment():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    
    assert fence.current_generation_id == "GEN-014"
    assert fence.state == VoiceState.IDLE
    
    next_gen = fence.create_generation(reason="test_turn")
    assert next_gen == "GEN-015"
    assert fence.current_generation_id == "GEN-015"
    
    events = recorder.events
    assert len(events) == 1
    assert events[0].type == EventType.GENERATION_CREATED
    assert events[0].generationId == "GEN-015"

def test_generation_invalidation_on_interrupt():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    
    fence.begin_speech("Test speech in Gen 14", provider="Rime")
    assert fence.state == VoiceState.SPEAKING
    assert fence._audio_queue_active is True
    
    prev_gen, new_gen = fence.trigger_interruption("User interrupt")
    assert prev_gen == "GEN-014"
    assert new_gen == "GEN-015"
    
    # Assert invalidation
    assert "GEN-014" in fence.invalidated_generations
    assert fence._audio_queue_active is False
    assert fence.state == VoiceState.RECOVERING
    
    # Assert events emitted
    event_types = [e.type for e in recorder.events]
    assert EventType.USER_SPEECH_STARTED in event_types
    assert EventType.TTS_INTERRUPTED in event_types
    assert EventType.AUDIO_QUEUE_FLUSHED in event_types
    assert EventType.GENERATION_INVALIDATED in event_types
    assert EventType.GENERATION_CREATED in event_types
