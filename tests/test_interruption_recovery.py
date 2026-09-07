import pytest
import asyncio
from agent.events.event_recorder import EventRecorder
from agent.state.generation_fence import GenerationFence
from agent.incidents.incident_engine import IncidentEngine
from agent.chaos_lab import ChaosLab
from agent.state.models import VoiceState, EventType

@pytest.mark.asyncio
async def test_full_interruption_recovery_flow():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    incidents = IncidentEngine(recorder)
    chaos = ChaosLab(fence, recorder, incidents)
    
    result = await chaos.run_test_06_full_interrupt_and_recovery()
    
    assert result.passed is True
    assert result.staleLeaks == 0
    assert len(result.assertions) >= 5
    assert len(incidents.incidents) >= 1
    
    inc = incidents.incidents[0]
    assert inc.initialGeneration == "GEN-014"
    assert inc.finalGeneration == "GEN-015"
    assert inc.staleResultsCount == 1
    assert inc.resolution == "SUCCESS"
    assert "vehicle warning" in inc.whatWasDelivered.lower()
    assert "Stop. Vehicle approaching." in inc.whatUserHeard
    assert "clearance" in inc.whatWasInvalidated.lower() or "active rime" in inc.whatWasInvalidated.lower()

@pytest.mark.asyncio
async def test_all_chaos_tests_pass_with_zero_leaks():
    recorder = EventRecorder()
    fence = GenerationFence(recorder, initial_gen=14)
    incidents = IncidentEngine(recorder)
    chaos = ChaosLab(fence, recorder, incidents)
    
    suite = await chaos.run_all()
    assert suite.totalTests == 6
    assert suite.passedTests == 6
    assert suite.failedTests == 0
    assert suite.totalStaleLeaks == 0
