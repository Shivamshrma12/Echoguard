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

def test_basic_generation():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    assert fence.current_generation_id == "GEN-014"
    assert fence.state == VoiceState.IDLE
    next_gen = fence.create_generation(reason="test_turn")
    assert next_gen == "GEN-015"
    assert fence.current_generation_id == "GEN-015"

def test_interrupt_invalidates_generation():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    fence.begin_speech("Test speech in Gen 14", provider="Rime")
    prev_gen, new_gen = fence.trigger_interruption("User interrupt")
    assert prev_gen == "GEN-014"
    assert new_gen == "GEN-015"
    assert "GEN-014" in fence.invalidated_generations
    assert fence.state == VoiceState.RECOVERING

def test_audio_cancel():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=20)
    fence.begin_speech("Active audio stream", provider="Rime")
    assert fence._audio_queue_active is True
    fence.trigger_interruption("Interrupt")
    assert fence._audio_queue_active is False
    event_types = [e.type for e in recorder.events]
    assert EventType.AUDIO_CANCELLED in event_types
    assert EventType.AUDIO_QUEUE_FLUSHED in event_types

def test_new_generation_survives():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=30)
    fence.trigger_interruption("Interrupt 1")
    assert fence.current_generation_id == "GEN-031"
    # New speech in GEN-031
    fence.complete_recovery("New safe directive", provider="Rime")
    assert fence.state == VoiceState.SPEAKING
    assert fence._audio_queue_active is True
    assert "GEN-031" not in fence.invalidated_generations

def test_multiple_interruptions():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=1)
    for i in range(5):
        prev, new = fence.trigger_interruption(f"Burst interrupt {i}")
        assert prev in fence.invalidated_generations
        assert new == f"GEN-{i+2:03d}"
    assert len(fence.invalidated_generations) == 5
    assert fence.current_generation_id == "GEN-006"
