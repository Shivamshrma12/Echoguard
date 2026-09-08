import pytest
from agent.events.event_recorder import EventRecorder
from agent.state.generation_fence import GenerationFence
from agent.state.models import EventType

def test_stale_result_is_rejected():
    """
    Core invariant test:
    Any tool result or operation tagged with an invalidated or non-active generation
    MUST be rejected, return False, and increment blocked metrics.
    It must NEVER produce active spoken output.
    """
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    
    op_id = "op_test_123"
    op_gen = fence.register_async_operation(op_id, "check_traffic")
    assert op_gen == "GEN-014"
    
    # User interrupts before tool finishes
    fence.trigger_interruption("Stop")
    assert fence.current_generation_id == "GEN-015"
    assert "GEN-014" in fence.invalidated_generations
    
    # Delayed result arrives from GEN-014
    is_valid = fence.validate_operation_result(
        op_id=op_id,
        op_generation_id=op_gen,
        result_payload={"traffic": "clear", "proceed": True}
    )
    
    # Core assertion: MUST be rejected
    assert is_valid is False, "Stale result from GEN-014 must be rejected!"
    assert fence.metrics.staleResultsBlocked == 1
    
    # Verify STALE_RESULT_REJECTED event was emitted
    rejections = [e for e in recorder.events if e.type == EventType.STALE_RESULT_REJECTED]
    assert len(rejections) == 1
    assert rejections[0].generationId == "GEN-014"

def test_stale_tool_result_rejected():
    """Exact test named per spec."""
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=41)
    op_id = "op_radar_41"
    op_gen = fence.register_async_operation(op_id, "radar_scan")
    fence.trigger_interruption("Stop")
    assert fence.current_generation_id == "GEN-042"
    is_valid = fence.validate_operation_result(op_id, op_gen, {"clear": True})
    assert is_valid is False
    assert fence.metrics.staleResultsBlocked == 1

def test_parallel_tool_race():
    """Tests multiple concurrent tools spawned under older generations."""
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=10)
    
    # Spawn 3 tools in GEN-010
    ops = [f"op_{i}" for i in range(3)]
    for op in ops:
        fence.register_async_operation(op, "sensor_read")
        
    # Interruption advances to GEN-011
    fence.trigger_interruption("Emergency stop")
    
    # Spawn 1 tool in GEN-011
    fence.register_async_operation("op_new", "emergency_brake")
    
    # Stale tools arrive
    for op in ops:
        assert fence.validate_operation_result(op, "GEN-010", {"ok": True}) is False
        
    # Fresh tool arrives
    assert fence.validate_operation_result("op_new", "GEN-011", {"brake": "engaged"}) is True
    assert fence.metrics.staleResultsBlocked == 3
