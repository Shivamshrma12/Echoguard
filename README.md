# EchoGuard — Realtime Voice Reliability Infrastructure

> **"WHEN THE WORLD CHANGES, THE VOICE CHANGES WITH IT."**

EchoGuard prevents obsolete conversational state from becoming obsolete spoken output.

---

## 1. EchoGuard

EchoGuard is a realtime voice reliability and safety infrastructure layer designed for voice agents operating in dynamic, safety-critical, or high-concurrency environments. Built around LiveKit WebRTC and official Rime TTS streaming, EchoGuard introduces **deterministic Generation Fencing** to ensure conversational state transitions invalidate obsolete speech, flush audio buffers immediately, and reject stale asynchronous work before it can reach the user's ears.

---

## 2. The Problem

In voice AI systems, there is a fundamental temporal gap between:
1. What the agent's background processes are computing.
2. What the user is currently hearing.
3. What has changed in the physical environment.

When a user speaks or an external event shifts application state, existing voice pipelines often let in-flight tool results, queued audio chunks, or obsolete inferences play out. In safety-critical contexts—such as hands-free industrial navigation, emergency dispatch, medical operations, or autonomous equipment assistance—speaking stale information can lead to severe confusion or physical hazards.

---

## 3. Why Voice Is Essential

Voice is the only hands-free, eyes-up interface that operates in real time. Because speech is linear and acoustic, **a user cannot un-hear obsolete guidance once spoken**. In graphical user interfaces, a stale DOM element can be quietly updated or removed without alarming the user. In voice interfaces, an obsolete sentence spoken aloud damages conversational trust immediately and can lead to dangerous actions. Realtime voice reliability is therefore load-bearing infrastructure.

---

## 4. Hard Voice Problem: Interruption + Stale State Recovery

The classic failure sequence in modern voice agent architectures:

```
GEN-014 (Active)
    ↓
Agent Begins Speaking Advice ("Path ahead appears clear...")
    ↓
Tool Dispatched in Background (e.g., Optical Clearance Check)
    ↓
User Interrupts ("Stop. Vehicle approaching.")
    ↓
Environment State Changes
    ↓
Delayed Tool Result Returns from GEN-014 (Returns "All Clear")
    ↓
[FATAL LEAK]: Agent Speaks Obsolete "All Clear" Over User Hazard!
```

---

## 5. Core Claim

> **EchoGuard reduces the risk of stale spoken state by demonstrating deterministic stale-result fencing and immediate audio queue invalidation for realtime voice agents.**

The correct behavior enforced by EchoGuard:

```
GEN-014 (Active)
    ↓
User Interrupts ("Stop. Vehicle approaching.")
    ↓
GEN-014 INVALIDATED
    ↓
Audio Buffer Flushed / Cancelled Immediately
    ↓
GEN-015 CREATED & ACTIVE
    ↓
Delayed GEN-014 Tool Result Arrives
    ↓
FENCE CHECK: GEN-014 != GEN-015 → STALE RESULT REJECTED (0 LEAKS)
    ↓
GEN-015 Generates & Delivers Hazard Directive via Rime TTS
    ↓
Forensic Incident Recorded & Replayable
```

---

## 6. Architecture

```
┌────────────────────────────────────────────────────────┐
│                   BROWSER CLIENT                       │
│  - React 19 + TypeScript + Vite + Tailwind CSS         │
│  - Web Audio API Analyser & Microphone Stream          │
│  - Realtime Telemetry WebSocket Client                 │
└───────────────────────────▲────────────────────────────┘
                            │ WebSocket / REST
┌───────────────────────────▼────────────────────────────┐
│              FASTAPI RELIABILITY GATEWAY               │
│  - LiveKit JWT Short-Lived Token Service               │
│  - Event Recorder (Monotonic Timestamps & Typed Logs)  │
│  - Incident Engine (Dual-Lane Forensic Replay)         │
│  - Chaos Lab Test Runner                               │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               ECHOGUARD AGENT RUNTIME                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │              GENERATION FENCE ENGINE             │  │
│  │  - Active Generation Tracker (GEN-014 → GEN-015) │  │
│  │  - Operation Generation Registry                 │  │
│  │  - Audio Queue Purge & Cancellation Invariant    │  │
│  │  - Deterministic Stale Result Rejection Gate     │  │
│  └──────────────────────────────────────────────────┘  │
│                           │                            │
│  ┌───────────────────────┐│┌─────────────────────────┐ │
│  │  LiveKit Agents WebRTC │││  Official Rime Plugin   │ │
│  │  - Realtime Audio I/O │││  - WebSocket Streaming  │ │
│  │  - VAD Interruption   │││  - Model: coda          │ │
│  │  - Session Lifecycle  │││  - Speaker: celeste     │ │
│  └───────────────────────┘│└─────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 7. LiveKit Integration

- EchoGuard uses official `livekit-agents` and `livekit-api` packages.
- Client credentials (`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`) remain strictly server-side.
- The browser authenticates via the `/api/token` endpoint, receiving short-lived tokens with explicit `VideoGrants` (room join, publish, subscribe).

---

## 8. Rime Integration

- EchoGuard uses the official LiveKit Rime plugin (`livekit-plugins-rime`).
- Spoken output is delivered over WebSocket streaming.
- Exact active configuration:
  - **Provider:** Rime
  - **Model:** `coda`
  - **Speaker:** `celeste`
  - **Language:** `en` (`eng`)
  - **Transport:** `WebSocket` (`use_websocket=True`)
  - **Audio Format:** `PCM`
  - **Sample Rate:** `16000` Hz
  - **Segmentation:** `bySentence`
  - **Endpoint:** `wss://users.rime.ai/v1/rime-tts`

---

## 9. Generation Fencing

Every conversational interaction belongs to a monotonically incrementing generation ID (e.g., `GEN-014`).
Every background task, model call, and tool execution registers with the current generation:

```python
op_gen = fence.register_async_operation(op_id, "check_clearance")
```

When results return, they must pass the generation gate:

```python
if op_gen != fence.current_generation_id or op_gen in fence.invalidated_generations:
    # REJECT STALE RESULT
    return False
```

If rejected, the output is completely discarded and never transmitted to Rime TTS.

---

## 10. Interruption Recovery

When user speech is detected during agent speech:
1. Interruption timestamp is captured.
2. Voice state transitions to `INTERRUPTING`.
3. Web Audio queue and TTS streaming handles are flushed synchronously.
4. Active generation is added to `invalidated_generations`.
5. Next generation is created (`GEN-015`).
6. State transitions to `RECOVERING`.
7. Updated context is evaluated and dispatched to Rime TTS.
8. Latencies (`interrupt → audio stop` and `new generation → speech`) are measured and recorded.

---

## 11. Incident Recorder

Every interruption sequence generates a structured forensic incident:
- `incidentId` (e.g., `INC-0047`)
- Timestamps and duration in milliseconds
- Stale results blocked count
- Dual-lane reconstruction (`AGENT STATE` vs `USER HEARD`)
- Progressive answers to the 5 core forensic questions:
  1. What was the agent doing?
  2. What did the user interrupt?
  3. What changed?
  4. What stale work arrived afterward?
  5. What did the user finally hear?
- Truth-in-advertising labelling: `ACTUAL AUDIO` vs `EVENT RECONSTRUCTION`.

---

## 12. Chaos Lab

The Chaos Lab provides 6 automated stress scenarios executing directly against the live engine:
- **01 INTERRUPT DURING SPEECH:** Verifies audio cancellation and generation fencing.
- **02 TOOL RESULT RACE:** Verifies delayed tool payload suppression.
- **03 STALE RESULT AFTER STATE CHANGE:** Verifies sensor safety updates fence prior evaluations.
- **04 RAPID INTERRUPTIONS:** Verifies monotonic generation indexing under high-frequency bursts.
- **05 AUDIO QUEUE CONFLICT:** Verifies zero buffer residue between successive audio streams.
- **06 FULL INTERRUPT + RECOVERY:** The complete showcase scenario with structured incident generation.

All tests report verifiable assertions and calculate observed stale leaks from real execution.

---

## 13. Demo Mode vs Live Mode

EchoGuard supports two explicit modes:
- **LIVE MODE:** Connects live browser microphone, LiveKit WebRTC room, and Rime TTS. Rime status shows `RIME ● LIVE` only when actively connected.
- **DEMO MODE:** Runs deterministic local stress scenarios with synthetic providers. Clearly displays `DEMO MODE: SYNTHETIC / SIMULATED PROVIDER` and never claims active Rime connection.

---

## 14. Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/echoguard.git
cd echoguard

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
npm run build
cd ..
```

---

## 15. Environment Variables

Copy `.env.example` to `.env` and fill in credentials:

```bash
cp .env.example .env
```

Configuration keys:
```ini
RIME_API_KEY=your_rime_api_key_here
LIVEKIT_URL=wss://your-livekit-url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
PORT=8000
HOST=127.0.0.1
RIME_MODEL=coda
RIME_SPEAKER=celeste
RIME_LANG=en
RIME_TRANSPORT=websocket
RIME_AUDIO_FORMAT=pcm
RIME_SAMPLE_RATE=16000
```

---

## 16. Running Locally

### Start EchoGuard Server (Serves Backend + UI on Port 8000)
```bash
python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

Open browser at `http://127.0.0.1:8000/`.

### Run Frontend in Vite Dev Server (Optional)
```bash
cd frontend
npm run dev
```

---

## 17. Testing

Run the automated test suite with pytest:

```bash
python -m pytest tests/ -v
```

All 12 unit, integration, and acceptance tests will execute and verify 0 stale leaks.

---

## 18. Acceptance Test

Run the formal acceptance test:

```bash
python -m pytest tests/test_acceptance.py -v
```

Invariant asserted:
```python
assert is_valid is False  # Delayed tool result from Gen N rejected
assert fence.metrics.staleResultsBlocked == 1
assert fence._audio_queue_active is False
```

---

## 19. Limitations

- EchoGuard is a hackathon prototype demonstrating deterministic stale-result fencing. It does **not** claim safety certification or guarantee zero accident risk in industrial deployments.
- In environments without live microphone permissions or live WebRTC connectivity, acoustic data is labelled as `EVENT RECONSTRUCTION`.
- Acoustic stop latency measurements reflect runtime buffer invalidation and dispatch; actual transducer cessation depends on local hardware audio buffers.

---

## 20. AI-Assisted Development Disclosure

Developed with agentic assistance from Antigravity IDE (Google DeepMind) for architectural scaffolding, testing harness design, and UI component synthesis.

---

## 21. Third-Party Licenses

- **LiveKit Agents & Client:** Apache 2.0
- **LiveKit Rime Plugin:** Apache 2.0
- **FastAPI / Starlette:** MIT License
- **Lucide Icons:** ISC License
- **Tailwind CSS:** MIT License
