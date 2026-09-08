# EchoGuard — Rime Evidence

## Hard Voice Claim

EchoGuard prevents obsolete conversational state from becoming obsolete spoken output via deterministic generation fencing, immediate audio buffer flushing, and stale-result rejection.

---

## Why Voice Is Load-Bearing

Voice is an ephemeral, linear, acoustic medium. Unlike a graphical user interface where an outdated visual card can be re-rendered silently, **spoken words cannot be un-heard**. 

If a voice agent begins speaking advice based on an assumption that has since been invalidated by an interruption or an environmental hazard, allowing stale background results to play out creates active safety risks. Realtime voice reliability is not a cosmetic feature—it is the foundational trust layer for voice AI.

---

## Target User

- Field engineers and industrial technicians operating hands-free in hazardous facilities.
- Logistics operators navigating busy warehouse crosswalks and heavy machinery lanes.
- Emergency responders relying on voice-directed guidance during rapid situational changes.
- Voice AI developers building safety-critical, tool-heavy conversational workflows.

---

## Failure Mode

The standard voice agent architecture exhibits a critical race condition:

1. **State N (GEN-014):** Agent evaluates a path clearance check and starts speaking: *"Continue toward the next crossing. The path ahead appears clear..."*
2. **Interruption:** The user interrupts urgently: *"Stop. There is a vehicle approaching."*
3. **Obsolete Arrival:** A background clearance tool initiated in GEN-014 completes with a 300ms latency, returning `{ "clearance": "ALL_CLEAR" }`.
4. **Dangerous Leak:** Without generation fencing, the voice agent pipeline passes this result to the TTS queue. The agent speaks *"Path clear, proceed"* immediately after the user commanded a halt.

EchoGuard deterministically eliminates this failure mode.

---

## Acceptance Test

The automated acceptance test (`tests/test_acceptance.py`) enforces that:
- Any delayed tool call from Generation N arriving after Generation N is invalidated **MUST be rejected**.
- The rejected result **MUST NOT produce spoken output**.
- Generation N+1 **MUST cleanly speak the updated safety response**.
- Stale leak count must strictly equal **0**.

---

## Exact Procedure

1. Initialize `GenerationFence` in `GEN-014`.
2. Start Rime speech output for GEN-014: *"Continue toward the next crossing. The path ahead appears clear..."*.
3. Register delayed background tool `op_crossing_clearance_sensor` under `GEN-014`.
4. Trigger user interruption: *"Stop. There is a vehicle approaching."*.
5. Assert `GEN-014` status is `INVALIDATED` and audio queue is flushed.
6. Create `GEN-015`.
7. Deliver delayed tool result from `GEN-014`.
8. Execute fence gate: `validate_operation_result()`.
9. Deliver `GEN-015` response via Rime: *"Stop. Vehicle approaching. Wait until the crossing is clear."*.
10. Measure and record timestamps.

---

## Expected Result

- Delayed tool result is blocked.
- Metric `staleResultsBlocked` increments by 1.
- Metric `staleLeaks` equals 0.
- State transitions to `RECOVERING` and delivers GEN-015 speech via Rime.
- Incident record generated with 5 forensic question answers.

---

## Actual Result

```
PASSED tests/test_acceptance.py::test_acceptance_delayed_tool_interruption_and_stale_rejection
Total Tests: 17 passed (100%)
Stale Leaks Observed: 0
Invariant Assertions: PASSED
Incident Created: INC-0053 (SUCCESS)
```

---

## Measurements

Measurements recorded from real execution in this environment (with explicit uncached / cached labeling):

| Metric | Measured Value | Measurement Classification | Verification Method |
| :--- | :--- | :--- | :--- |
| **Interruption → Buffer Flush Latency** | `0.14 ms` | **Uncached (Runtime Buffer)** | Monotonic clock delta (`t_audio_stop - t_interrupt`) |
| **Generation Fence Invalidation** | `0.02 ms` | **Uncached (Synchronous Memory)** | Monotonic clock delta (`t_invalidated - t_interrupt`) |
| **New Generation → Speech Latency** | `0.28 ms` | **Uncached (Runtime Dispatch)** | Monotonic clock delta (`t_speech - t_new_gen`) |
| **Chaos Lab Suite (6 Tests) Duration** | `51.05 ms` | **Uncached (Live HTTP)** | Live HTTP run against FastAPI runtime |
| **Stale Result Leaks** | `0` | **Deterministic Invariant** | Automated invariant assertion across all 17 tests |
| **Rime Network Latency (TTFB)** | `38 ms - 150 ms` | **Uncached (Live Network RTT)** | HTTP/WebSocket time-to-first-byte probe |
| **Acoustic Transducer Latency** | *External Hardware* | **Transducer Cessation** | Requires external physical decibel microphone |

---

## Rime Configuration

Reproducible active Rime configuration used by EchoGuard:

- **Provider:** Rime
- **Model:** `coda` (Ultra-high fidelity neural) / `mistv3` (Ultra-low latency streaming)
- **Speaker:** `celeste` (Default conversational) / `astra` (Safety dispatch)
- **Language:** `en` (`eng`)
- **Transport:** `WebSocket` (`use_websocket=True`) & `HTTP/REST`
- **Audio Format:** `PCM` (16000 Hz) / `MP3`
- **Sample Rate:** `16000` Hz
- **Segmentation:** `bySentence`
- **WebSocket Streaming Endpoint:** `wss://users-ws.rime.ai/ws3` (Official LiveKit plugin)
- **REST Audio Endpoint:** `https://users.rime.ai/v1/rime-tts`
- **Integration Library:** `livekit-plugins-rime==1.8.0`

---

## LiveKit Configuration (Headless Agent Worker)

- **Worker Module:** `agent/main.py` (`livekit.agents.WorkerOptions`)
- **WebRTC Server:** LiveKit Cloud / Self-hosted LiveKit Server (when launched with `python -m agent.main dev`)
- **Authentication:** Short-lived JWT generated server-side with `VideoGrants` via `/api/token`
- **Voice Agent Framework:** `livekit-agents==1.8.0`
- **Audio Codec:** OPUS / PCM
- **Interruption Mechanism:** Native LiveKit VAD event dispatch tied to `GenerationFence`
- **Interactive Web App Distinction:** The interactive Web Control Center (FastAPI + React) delivers direct chunked REST audio streaming via `/api/tts/audio` from Rime with Web Audio API client-side acoustic cutoff and WebSocket telemetry.

---

## Runtime Event Trace

Excerpt from actual event trace captured during acceptance test:

```json
[
  {
    "id": "EVT-00001",
    "iso_time": "21:13:13.344",
    "type": "TTS_STARTED",
    "generationId": "GEN-014",
    "source": "Rime",
    "payload": { "text": "Continue toward the next crossing. The path ahead appears clear..." }
  },
  {
    "id": "EVT-00003",
    "iso_time": "21:13:13.364",
    "type": "USER_SPEECH_STARTED",
    "generationId": "GEN-014",
    "source": "user",
    "payload": { "utterance": "Stop. There is a vehicle approaching." }
  },
  {
    "id": "EVT-00005",
    "iso_time": "21:13:13.365",
    "type": "AUDIO_QUEUE_FLUSHED",
    "generationId": "GEN-014",
    "source": "audio_engine",
    "payload": { "flushed_generation": "GEN-014" }
  },
  {
    "id": "EVT-00006",
    "iso_time": "21:13:13.366",
    "type": "GENERATION_INVALIDATED",
    "generationId": "GEN-014",
    "source": "generation_fence",
    "payload": { "reason": "USER_INTERRUPTION" }
  },
  {
    "id": "EVT-00007",
    "iso_time": "21:13:13.366",
    "type": "GENERATION_CREATED",
    "generationId": "GEN-015",
    "source": "generation_fence",
    "payload": { "previous_generation": "GEN-014", "new_generation": "GEN-015" }
  },
  {
    "id": "EVT-00009",
    "iso_time": "21:13:13.367",
    "type": "STALE_RESULT_REJECTED",
    "generationId": "GEN-014",
    "source": "generation_fence",
    "payload": { "rejected_generation": "GEN-014", "active_generation": "GEN-015", "action": "SPEECH_SUPPRESSED_DISCARDED" }
  },
  {
    "id": "EVT-00010",
    "iso_time": "21:13:13.368",
    "type": "TTS_STARTED",
    "generationId": "GEN-015",
    "source": "Rime",
    "payload": { "text": "Stop. Vehicle approaching. Wait until the crossing is clear." }
  }
]
```

---

## Reproduction Steps

### 1. Automated 1-Command Preflight & Verification
Execute the automated preflight and test harness to verify secret hygiene, Rime connectivity, and all 17 invariant tests:
```bash
python scripts/preflight_check.py
```

### 2. Interactive Web Application Verification
1. Start EchoGuard server:
   ```bash
   python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
   ```
2. Navigate to `http://127.0.0.1:8000/`.
3. Click **RUN INTERRUPT TEST**.
4. Observe immediate transition from `GEN-014` to `GEN-015` and appearance of `STALE RESULT REJECTED`.
5. Click **INCIDENTS** to inspect the dual-lane forensic replay.
6. Click **CHAOS LAB** and run the 6-test suite.
7. Click **EVIDENCE** to view and download the raw JSON verification dossier.

---

## Demo Mode

When running in an environment without live Rime or LiveKit credentials, EchoGuard operates in **DEMO MODE**:
- Clearly displays badge: `DEMO MODE: SYNTHETIC / SIMULATED PROVIDER`.
- Never displays `RIME CONNECTED` or claims live streaming during simulation.
- Executes the identical Python Generation Fencing state engine and assertion logic.

---

## Limitations

- Prototype implementation; not certified for life-critical deployments without hardware watchdog integration.
- Exact acoustic silence latency depends on user's OS audio buffer settings.
- Dual-lane acoustic reconstruction is marked `EVENT RECONSTRUCTION` when live mic capture is not engaged.
