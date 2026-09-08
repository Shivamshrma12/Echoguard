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

EchoGuard provides two complementary runtime paths:
1. **Interactive Evaluation Center (Primary Hackathon Demonstration):** An interactive, forensic Web Control Center served by FastAPI. It pairs browser-side Web Audio capture and instant acoustic cutoff with a server-side Generation Fencing gateway that streams speech directly from the official Rime TTS engine (`https://users.rime.ai/v1/rime-tts`) and emits high-resolution telemetry over WebSockets.
2. **Headless LiveKit Agent Worker:** A headless WebRTC worker (`agent/main.py`) built on `livekit-agents` and the official `livekit-plugins-rime` WebSocket streaming plugin (`wss://users-ws.rime.ai/ws3`).

```
========================================================================================
PATH A: INTERACTIVE WEB EVALUATION CENTER (JUDGE DASHBOARD)
========================================================================================
┌────────────────────────────────────────────────────────┐
│                   BROWSER CLIENT                       │
│  - React 19 + TypeScript + Vite + Tailwind CSS         │
│  - Web Audio Analyser (Real Microphone Capture)        │
│  - HTML5 Dedicated Audio Element (Zero-Latency Stop)   │
│  - Realtime Telemetry WebSocket Client                 │
└───────────────────────────▲────────────────────────────┘
                            │ REST Audio Stream / WebSocket Telemetry
┌───────────────────────────▼────────────────────────────┐
│              FASTAPI RELIABILITY GATEWAY               │
│  - Audio Gateway (/api/tts/audio -> Rime REST Stream)  │
│  - Generation Fencing Dispatch & Invariant Checks      │
│  - Dual-Lane Forensic Incident Engine                  │
│  - Automated 6-Scenario Chaos Lab                      │
│  - Live Rime Catalog & Connectivity Probing            │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   RIME TTS PLATFORM                    │
│  - REST API: https://users.rime.ai/v1/rime-tts         │
│  - Models: coda (High-fidelity) / mistv3 (Low-latency) │
│  - Voices: celeste (Conversational) / astra (Dispatch) │
└────────────────────────────────────────────────────────┘

========================================================================================
PATH B: HEADLESS LIVEKIT WEBRTC WORKER (CLI AGENT)
========================================================================================
┌────────────────────────────────────────────────────────┐
│               ECHOGUARD LIVEKIT WORKER                 │
│                 (agent/main.py)                        │
│  - livekit-agents: WebRTC Room & Track Subscription    │
│  - livekit-plugins-rime: WebSocket Streaming Client    │
│  - GenerationFence: Invariant Enforcement              │
│  - Short-lived JWT Auth via /api/token                 │
└────────────────────────────────────────────────────────┘
```

---

## 7. Transport & Runtime Paths

To ensure strict engineering honesty (truth-in-advertising):
- **Web Evaluation Center Audio Transport:** Audio is delivered via an authenticated HTTP/REST chunked streaming gateway (`/api/tts/audio` forwarding to `https://users.rime.ai/v1/rime-tts`) directly to the browser's dedicated HTML5 Audio element. Telemetry and forensic events stream over WebSocket (`/api/ws/telemetry`). Interruption performs an immediate synchronous acoustic cutoff (`flushAudio()`), pauses the audio pipeline, clears the buffer, and issues `/api/session/interrupt` to invalidate the active generation.
- **Headless Worker Audio Transport:** `agent/main.py` runs a standalone LiveKit worker that connects to LiveKit WebRTC rooms (`livekit.agents.WorkerOptions`), subscribes to audio tracks, and streams synthesized speech using `livekit-plugins-rime` over WebSocket (`wss://users-ws.rime.ai/ws3`).
- **Authentication:** All client requests are authenticated server-side. LiveKit API keys and Rime API keys never touch the client bundle.

---

## 8. Rime Integration

- EchoGuard interfaces directly with official Rime TTS endpoints via both REST streaming and the official LiveKit Rime plugin (`livekit-plugins-rime`).
- Spoken output is verified against live Rime endpoints.
- Exact active configuration:
  - **Provider:** Rime
  - **Model:** `coda` (Ultra-high fidelity neural) / `mistv3` (Ultra-low latency streaming)
  - **Speaker:** `celeste` (Default conversational) / `astra` (Safety dispatch)
  - **Language:** `en` (`eng`)
  - **Transports:** `HTTP/REST Chunked Streaming` (Web Dashboard) & `WebSocket Streaming` (LiveKit Worker)
  - **Audio Format:** `MP3` / `PCM` (16000 Hz)
  - **Sample Rate:** `16000` Hz / `24000` Hz
  - **Segmentation:** `bySentence`
  - **REST Endpoint:** `https://users.rime.ai/v1/rime-tts`
  - **WebSocket Endpoint:** `wss://users-ws.rime.ai/ws3`

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

## 17. Preflight Verification & Hygiene Check

Run the comprehensive preflight check to verify secret safety, .gitignore hygiene, Rime live catalog configuration, live synthesis probe, and invariant tests in one command:

```bash
python scripts/preflight_check.py
```

---

## 18. Testing & Invariant Proofs

Run the automated test suite with pytest:

```bash
python -m pytest tests/ -v
```

All **17 unit, integration, and acceptance tests** execute and deterministically assert **0 stale leaks**.

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

## 19. Measured Performance & Latency Breakdown

To ensure full transparency (truth-in-advertising), measurements are categorized by cached vs uncached and runtime vs acoustic transducers:

| Operation / Metric | Measured Value | Measurement Type | Verification Method |
| :--- | :--- | :--- | :--- |
| **Interruption → Buffer Flush Latency** | `0.14 ms` | **Uncached (Runtime)** | High-resolution monotonic clock delta (`t_flush - t_interrupt`) |
| **Generation Fence Invalidation** | `0.02 ms` | **Uncached (Synchronous)** | Set membership & generation state transition |
| **Stale Result Rejection Gate** | `0.10 ms` | **Uncached (Runtime)** | Gate check before audio dispatch |
| **Chaos Lab Suite (6 Stress Scenarios)** | `~51 ms` | **Uncached (Live HTTP)** | Monotonic execution across full 6-scenario suite |
| **Rime Synthesize TTFB (WebSocket/REST)** | `38 ms - 150 ms` | **Uncached (Network RTT)** | Real round-trip API network latency |
| **Acoustic Transducer Latency** | *External Hardware* | **Transducer Output** | Local OS/Bluetooth sound card buffer drain (not simulated) |

---

## 20. Limitations

- EchoGuard is a prototype demonstrating deterministic stale-result fencing. It does **not** claim safety certification or guarantee zero accident risk in industrial deployments without hardware watchdog integration.
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
