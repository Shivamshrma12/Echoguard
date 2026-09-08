import time
import asyncio
from datetime import datetime
from typing import List, Callable, Dict, Any, Optional
from agent.state.models import VoiceEvent, EventType, EventSeverity

class EventRecorder:
    """
    EchoGuard Event Recorder
    Maintains an append-only sequence of typed events tagged with generationId,
    monotonic timestamps, severity, and event payloads. Broadcasts events to real-time subscribers.
    """
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self._events: List[VoiceEvent] = []
        self._counter: int = 0
        self._subscribers: List[Callable[[VoiceEvent], None]] = []
        self._async_subscribers: List[asyncio.Queue] = []

    @property
    def events(self) -> List[VoiceEvent]:
        return list(self._events)

    def record(
        self,
        event_type: EventType,
        generation_id: str,
        source: str = "agent",
        severity: EventSeverity = EventSeverity.INFO,
        payload: Optional[Dict[str, Any]] = None
    ) -> VoiceEvent:
        self._counter += 1
        now = time.time()
        iso = datetime.fromtimestamp(now).strftime("%H:%M:%S.%f")[:-3]
        
        event = VoiceEvent(
            id=f"EVT-{self._counter:05d}",
            timestamp=now,
            timestamp_ms=round(now * 1000.0, 2),
            iso_time=iso,
            type=event_type,
            generationId=generation_id,
            source=source,
            severity=severity,
            payload=payload or {}
        )
        
        self._events.append(event)
        if len(self._events) > self.max_history:
            self._events.pop(0)

        # Notify sync subscribers
        for sub in list(self._subscribers):
            try:
                sub(event)
            except Exception:
                pass

        # Notify async queue subscribers
        for q in list(self._async_subscribers):
            try:
                q.put_nowait(event)
            except Exception:
                pass

        return event

    def subscribe(self, callback: Callable[[VoiceEvent], None]) -> None:
        self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[VoiceEvent], None]) -> None:
        if callback in self._subscribers:
            self._subscribers.remove(callback)

    def register_async_queue(self, queue: asyncio.Queue) -> None:
        self._async_subscribers.append(queue)

    def unregister_async_queue(self, queue: asyncio.Queue) -> None:
        if queue in self._async_subscribers:
            self._async_subscribers.remove(queue)

    def clear(self) -> None:
        self._events.clear()
        self._counter = 0

    def get_events_for_generation(self, generation_id: str) -> List[VoiceEvent]:
        return [e for e in self._events if e.generationId == generation_id]
