# EchoGuard — Realtime Voice Reliability Infrastructure

> **"WHEN THE WORLD CHANGES, THE VOICE CHANGES WITH IT."**

EchoGuard prevents obsolete conversational state from becoming obsolete spoken output.

---

## 🚀 Live Demo

**Try EchoGuard:** [https://echoguard-sskh.onrender.com/](https://echoguard-sskh.onrender.com/)

Judges can access the deployed live demo directly from this link.

---

## 1. Overview & Core Problem

In voice AI systems, speech is an ephemeral, linear, acoustic medium: **spoken words cannot be un-heard**. 

When a user interrupts or the physical environment changes, traditional voice agent pipelines often suffer from a fatal race condition: in-flight LLM calls, background tools, and queued audio buffers continue playing obsolete guidance over user speech. In safety-critical applications (e.g., industrial navigation, emergency dispatch, hands-free field operations), speaking stale information damages trust and introduces severe physical hazards.

**EchoGuard solves this with deterministic Generation Fencing:**

```
GEN-014 (Active)
    ↓
User Interrupts ("Stop. Vehicle approaching.")
    ↓
GEN-014 Invalidated & Audio Buffer Flushed (<0.2 ms)
    ↓
GEN-015 Created (Active)
    ↓
Delayed GEN-014 Tool Result Arrives ("Path clear")
    ↓
FENCE CHECK: GEN-014 != GEN-015 → STALE RESULT DISCARDED (0 LEAKS)
    ↓
GEN-015 Generates & Delivers Hazard Directive via Rime TTS
```

---

## 2. Architecture & Dual Runtime Paths

EchoGuard provides two production-grade runtime paths:

1. **Interactive Web Evaluation Center (Primary Demo Dashboard):**
   - **Frontend:** React 19, TypeScript, Tailwind CSS, Web Audio Analyser (live mic capture + dynamic oscilloscope), and dedicated HTML5 Audio element for zero-latency acoustic cutoff.
   - **FastAPI Reliability Gateway:** Manages generation fencing, dual-lane forensic telemetry over WebSockets (`/api/ws/telemetry`), and streaming audio proxying directly to Rime REST endpoints (`/api/tts/audio`).
2. **Headless LiveKit WebRTC Worker (`agent/main.py`):**
   - Standalone WebRTC agent built with `livekit-agents` and the official `livekit-plugins-rime` package.
   - Subscribes to live room audio tracks, streams synthesized audio over WebSockets (`wss://users-ws.rime.ai/ws3`), and enforces generation fencing across conversational turns.

```
┌────────────────────────────────────────────────────────┐
│                   BROWSER CLIENT                       │
│  - React 19 + TypeScript + Web Audio Mic Capture       │
│  - Realtime Telemetry WebSocket Client                 │
└───────────────────────────▲────────────────────────────┘
                            │ REST Audio Stream / WebSocket Telemetry
┌───────────────────────────▼────────────────────────────┐
│              FASTAPI RELIABILITY GATEWAY               │
│  - Audio Gateway (/api/tts/audio -> Rime REST Stream)  │
│  - Generation Fencing Dispatch & Invariant Checks      │
│  - Dual-Lane Forensic Incident Engine & Chaos Lab      │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   RIME TTS PLATFORM                    │
│  - REST API: https://users.rime.ai/v1/rime-tts         │
│  - WebSockets: wss://users-ws.rime.ai/ws3              │
│  - Models: coda (High-fidelity) / mistv3 (Low-latency) │
│  - Voices: celeste (Conversational) / astra (Dispatch) │
└────────────────────────────────────────────────────────┘
```

---

## 3. Official Rime TTS Integration

EchoGuard integrates with official Rime TTS endpoints across both REST and WebSocket transports:

- **Models Supported:** `coda` (ultra-high fidelity neural synthesis) and `mistv3` (ultra-low latency streaming).
- **Voices Configured:** `celeste` (natural conversational assistant) and `astra` (urgent safety/dispatch tone).
- **Transports:**
  - *Web Evaluation Center:* Authenticated HTTP chunked streaming proxy (`https://users.rime.ai/v1/rime-tts`).
  - *LiveKit Agent Worker:* Official `livekit-plugins-rime` WebSocket client (`wss://users-ws.rime.ai/ws3`).
- **Audio Output:** PCM (16 kHz / 24 kHz) and MP3 with sentence-level segmentation (`bySentence`).
- **Secret Protection:** Rime API keys remain strictly server-side and are never exposed to browser bundles.

---

## 4. Generation Fencing & Interruption Handling

Every interaction turn is tagged with a monotonically increasing generation ID (`GEN-014`). All asynchronous tasks register their originating generation:

```python
op_gen = fence.register_async_operation(op_id, "check_clearance")
```

When an interruption occurs:
1. **Immediate Cutoff:** Browser audio buffers flush synchronously (`0.14 ms`), audio playback halts immediately, and `/api/session/interrupt` is dispatched.
2. **Invalidation:** `GEN-014` is marked as invalidated in `fence.invalidated_generations`.
3. **Generation Rollover:** `GEN-015` becomes the active generation.
4. **Fence Gate Enforcement:** Any delayed result arriving from `GEN-014` is blocked at the fence:
   ```python
   if op_gen != fence.current_generation_id or op_gen in fence.invalidated_generations:
       # REJECT STALE RESULT - NEVER SEND TO RIME TTS
       return False
   ```
5. **Recovery:** Only current context is dispatched to Rime TTS under `GEN-015`.

---

## 5. Forensic Incident Recorder & Chaos Lab

- **Dual-Lane Incident Telemetry:** Logs structured events comparing `AGENT INTERNAL STATE` with what the `USER ACTUALLY HEARD`, answering 5 forensic questions for every interruption:
  1. What was the agent doing?
  2. What did the user interrupt?
  3. What changed in the environment?
  4. What delayed/stale work returned afterward?
  5. What did the user ultimately hear?
- **Automated Chaos Lab:** Built-in suite executing 6 real-time stress scenarios with verifiable assertions:
  1. *Interrupt During Speech* (Audio cancellation & fence cutoff)
  2. *Tool Result Race* (Delayed tool payload suppression)
  3. *Stale Result After State Change* (Sensor updates fencing previous queries)
  4. *Rapid Interruptions* (Monotonic generation rollover under stress)
  5. *Audio Queue Conflict* (Zero buffer residue between successive streams)
  6. *Full Interrupt + Recovery* (End-to-end incident generation)

---

## 6. Measured Performance

Deterministic performance metrics collected from real-time execution:

| Operation / Metric | Measured Value | Type | Method |
| :--- | :--- | :--- | :--- |
| **Interruption → Buffer Flush Latency** | `0.14 ms` | Uncached (Runtime) | High-resolution monotonic clock delta |
| **Generation Fence Invalidation** | `0.02 ms` | Synchronous | Set membership & generation rollover |
| **Stale Result Rejection Gate** | `0.10 ms` | Uncached (Runtime) | Gate check prior to audio dispatch |
| **Chaos Lab Suite (All 6 Scenarios)** | `~51 ms` | Live Execution | Monotonic pass through test suite |
| **Rime Synthesize TTFB** | `38 ms – 150 ms` | Network RTT | Live API round-trip |
| **Observed Stale Spoken Leaks** | **0** | Deterministic Invariant | Zero stale audio reaches speaker |

---

## 7. Cloud Deployment (Render.com)

EchoGuard is deployed as a live Web Service on Render:

- **Live URL:** [https://echoguard-sskh.onrender.com/](https://echoguard-sskh.onrender.com/)
- **Zero-Build SPA Serving:** Pre-built `frontend/dist` is packaged with the repository; FastAPI serves the SPA natively without requiring a separate Node.js build step on the server.
- **WebSocket & Audio Streaming:** Full support for persistent WebSockets (`/api/ws/telemetry`) and streaming chunked audio (`/api/tts/audio`).
- **Free SSL/TLS:** Ensures valid HTTPS/WSS origin for browser microphone permissions (`navigator.mediaDevices.getUserMedia`).
- **Included Deployment Configuration:**
  - `Procfile`: `web: uvicorn server.main:app --host 0.0.0.0 --port $PORT`
  - Dynamic port binding in `server/main.py`.

### Required Cloud Environment Variables

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `RIME_API_KEY` | **Yes** | Live speech synthesis via Rime TTS |
| `GEMINI_API_KEY` | Optional | Dynamic LLM reasoning via Google Gemini Flash |
| `LIVEKIT_URL` | Optional | LiveKit WebRTC endpoint |
| `LIVEKIT_API_KEY` | Optional | LiveKit server authentication |
| `LIVEKIT_API_SECRET` | Optional | LiveKit server secret |
| `RIME_MODEL` | Default (`coda`) | Rime model selection (`coda` / `mistv3`) |
| `RIME_SPEAKER` | Default (`celeste`) | Conversational voice persona |

---

## 8. Local Setup & Verification

### Prerequisites
- Python 3.10+
- Node.js 18+ (for frontend development only; compiled dist is pre-built)

### Quickstart

```bash
# 1. Clone the repository
git clone https://github.com/Shivamshrma12/Echoguard.git
cd Echoguard

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and supply your RIME_API_KEY

# 4. Start the server (serves both API and UI on port 8000)
python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/` in your browser.

### Automated Tests & Invariant Proofs

```bash
# Run preflight verification & secret hygiene check
python scripts/preflight_check.py

# Run test suite (asserts 0 stale leaks)
python -m pytest tests/ -v
```

---

## 9. Limitations & Third-Party Licenses

### Limitations
- EchoGuard is a hackathon prototype demonstrating deterministic stale-result fencing; it does not replace certified industrial hardware watchdogs.
- In environments without live microphone permissions, audio timeline events are transparently labelled as `EVENT RECONSTRUCTION`.
- Acoustic stop latency measurements reflect software buffer invalidation and dispatch; actual acoustic cessation depends on local OS sound card buffers.

### Third-Party Licenses
- **LiveKit Agents & Client:** Apache 2.0
- **LiveKit Rime Plugin:** Apache 2.0
- **FastAPI / Starlette:** MIT License
- **Lucide Icons:** ISC License
- **Tailwind CSS:** MIT License
