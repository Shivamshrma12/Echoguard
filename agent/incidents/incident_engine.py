import json
import os
import time
from typing import List, Optional, Dict, Any
from agent.state.models import IncidentRecord, VoiceEvent, EventType
from agent.events.event_recorder import EventRecorder

INCIDENTS_STORE_PATH = os.path.join(os.path.dirname(__file__), "incidents_store.json")

class IncidentEngine:
    """
    EchoGuard Incident Engine.
    Detects and structures voice interruption incidents, builds forensic timelines
    with 'Agent State' vs 'User Heard' dual lanes, answers the 5 core forensic questions,
    and persists incident records for replay and proof.
    """
    def __init__(self, recorder: EventRecorder, store_path: str = INCIDENTS_STORE_PATH):
        self.recorder = recorder
        self.store_path = store_path
        self._incidents: List[IncidentRecord] = []
        self._incident_counter: int = 44 # Start counter to produce INC-0045, INC-0046, INC-0047
        self._load_persisted()

    @property
    def incidents(self) -> List[IncidentRecord]:
        return list(self._incidents)

    def get_incident(self, incident_id: str) -> Optional[IncidentRecord]:
        for inc in self._incidents:
            if inc.incidentId == incident_id:
                return inc
        return None

    def create_incident(
        self,
        trigger: str,
        initial_gen: str,
        final_gen: str,
        duration_ms: float,
        stale_count: int,
        audio_state: str,
        resolution: str,
        what_agent_thought: str,
        what_user_heard: str,
        what_was_invalidated: str,
        what_was_rejected: str,
        what_was_delivered: str,
        evidence_type: str = "EVENT RECONSTRUCTION",
        events: Optional[List[VoiceEvent]] = None
    ) -> IncidentRecord:
        self._incident_counter += 1
        incident_id = f"INC-{self._incident_counter:04d}"
        
        # Pull recent events related to the generations if not provided
        if events is None:
            rel_events = [
                e for e in self.recorder.events 
                if e.generationId in (initial_gen, final_gen)
            ]
            events = rel_events[-30:] if rel_events else []

        incident = IncidentRecord(
            incidentId=incident_id,
            timestamp=time.time(),
            trigger=trigger,
            initialGeneration=initial_gen,
            finalGeneration=final_gen,
            durationMs=round(duration_ms, 2),
            staleResultsCount=stale_count,
            audioState=audio_state,
            resolution=resolution,
            evidenceType=evidence_type,
            whatAgentThought=what_agent_thought,
            whatUserHeard=what_user_heard,
            whatWasInvalidated=what_was_invalidated,
            whatWasRejected=what_was_rejected,
            whatWasDelivered=what_was_delivered,
            events=events
        )
        
        self._incidents.insert(0, incident)
        
        # Record incident created event
        self.recorder.record(
            event_type=EventType.INCIDENT_CREATED,
            generation_id=final_gen,
            source="incident_engine",
            payload={
                "incident_id": incident_id,
                "trigger": trigger,
                "initial_generation": initial_gen,
                "final_generation": final_gen,
                "stale_count": stale_count,
                "resolution": resolution
            }
        )
        
        self._persist()
        return incident

    def _persist(self) -> None:
        try:
            data = [inc.model_dump() for inc in self._incidents[:50]]
            with open(self.store_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass

    def _load_persisted(self) -> None:
        if os.path.exists(self.store_path):
            try:
                with open(self.store_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._incidents = [IncidentRecord(**item) for item in data]
                    if self._incidents:
                        # Extract max counter
                        for inc in self._incidents:
                            try:
                                num = int(inc.incidentId.split("-")[-1])
                                if num >= self._incident_counter:
                                    self._incident_counter = num
                            except Exception:
                                pass
            except Exception:
                self._incidents = []
