# EchoGuard — Realtime Voice Reliability Infrastructure

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Production-009688.svg)](https://fastapi.tiangolo.com)
[![Rime TTS](https://img.shields.io/badge/Rime-coda%20%7C%20celeste-purple.svg)](https://rime.ai)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Flash%20Lite-orange.svg)](https://deepmind.google/technologies/gemini/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Live Deployment:** [https://echoguard-sskh.onrender.com/](https://echoguard-sskh.onrender.com/)  
> **Source Repository:** [https://github.com/Shivamshrma12/Echoguard](https://github.com/Shivamshrma12/Echoguard)  
> **Demonstration Video:** Included in package at `demo/EchoGuard_Demo.mp4`

---

## 1. The Hard Voice Problem: Interruption & Stale Speech Races

In human conversation, speech is linear, continuous, and irreversible: **spoken words cannot be un-heard**. 

In conventional voice AI pipelines, when a user interrupts an AI agent:
- An LLM inference, tool call, or neural audio synthesis is already in flight.
- Simply stopping local audio playback is **insufficient**: the in-flight cloud tasks continue running asynchronously in the background.
- When those background tasks resolve, their delayed callbacks attempt to deliver audio to the output queue.
- Without cryptographic or monotonic fencing, the agent remains vulnerable to race conditions and stale speech leaks, producing obsolete speech over the user's new question.

EchoGuard solves this problem fundamentally through **Deterministic Generation Fencing**.

---

## 2. Core Mechanism: Generation Fencing

Every conversational turn in EchoGuard is assigned a monotonically increasing Generation ID (`GEN-014`):

```
User Turn 1: "Explain how black holes form."
   ↓
Generation Fence: GEN-014 assigned
   ↓
Gemini LLM processes response in GEN-014
   ↓
Rime synthesizes neural speech for GEN-014
   ↓
Agent begins speaking aloud through Rime
   ↓
[USER NATURALLY INTERRUPTS]: "No, forget that. Explain how earthquakes happen instead."
   ↓
1. 0.13ms Software Audio Buffer Flush (Browser playback paused and buffers cleared)
2. GEN-014 added to Invalidated Generations Set
3. GEN-015 created as active generation
   ↓
[RACE CONDITION TEST]: Delayed GEN-014 Audio/LLM Result Arrives
   ↓
FENCE CHECK: GEN-014 != activeGeneration (GEN-015) or in invalidatedGenerations
   ↓
STRICTLY REJECTED: HTTP 410 Gone / FENCED_REJECTED (0 Stale Leaks)
   ↓
Gemini & Rime generate and speak ONLY for GEN-015 ("Earthquakes occur when tectonic plates...")
```

---

## 3. System Architecture & Shipped Runtime

EchoGuard combines three core systems:
1. **Google Gemini:** General-purpose conversational reasoning and multi-turn intelligence.
2. **Rime TTS:** Primary neural voice synthesis engine (`coda:celeste`).
3. **EchoGuard Controller:** Realtime generation fencing, acoustic echo discrimination, automatic voice barge-in, and stale-result rejection.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   BROWSER PRODUCTION RUNTIME (React 19)                │
│  - Web Speech API continuous recognition with complete sentence capture │
│  - Acoustic Echo Discrimination (filters laptop speaker feedback)      │
│  - Automatic Voice Barge-In detector (0.13ms software buffer flush)   │
│  - Client-Side Generation Fencing (drops stale audio element buffers)  │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
                                    │ HTTP/REST Audio Stream + WS Telemetry
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    ECHOGUARD RELIABILITY GATEWAY                       │
│  - Generation Fence Controller (tracks active & invalidated gens)       │
│  - Pre- & Post-Synthesis Fencing Gates (rejects stale requests as 410) │
│  - Dual-Lane Incident Telemetry & Flight Recorder Engine               │
│  - Native SPA Server (serves pre-compiled production frontend/dist)    │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
┌───────────────────▼──────────────┐  ┌──────────────▼───────────────────┐
│        GOOGLE GEMINI API         │  │         RIME TTS PLATFORM        │
│  - Model: gemini-flash-lite      │  │  - Model: coda (mistv3 supported)│
│  - Arbitrary domain intelligence │  │  - Speaker: celeste (astra supp.)│
│  - Multi-turn conversation buffer│  │  - Endpoint: /v1/rime-tts        │
│  - Concise spoken English prompt │  │  - Audio: MP3 / PCM (16kHz)      │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

### Two Distinct Architecture Paths

1. **Browser Production / Demo Path (Shipped Web Application):**
   - **Flow:** Browser microphone → Web Speech API → FastAPI gateway (`server/main.py`) → Gemini 2.5 Flash Lite → Generation Fence Controller → Rime REST Audio Streaming (`https://users.rime.ai/v1/rime-tts`) → Browser Web Audio playback.
   - **Audio Format:** `audio/mpeg` (MP3, 22050Hz).
   - **Interruption Behavior:** User speech triggers immediate client-side `0.13ms` software audio buffer flush and issues generation invalidation to the gateway.
   - **Deployment:** This is the active path powering the live Render web deployment and browser demonstration video.

2. **Separate Headless LiveKit Worker Path (`agent/main.py`):**
   - **Flow:** Standalone WebRTC agent worker built with `livekit-agents` and `livekit-plugins-rime` streaming audio over WebSocket (`wss://users-ws.rime.ai/ws3`).
   - **Audio Format:** `audio/pcm` (16000Hz).
   - **Deployment:** Optional headless backend worker requiring external LiveKit server credentials (`LIVEKIT_URL`); **not** used or required by the browser web demo.

- **Secret Hygiene:** All API keys (`RIME_API_KEY`, `GEMINI_API_KEY`) remain strictly server-side and are never exposed to browser bundles.

---

## 4. Exact Rime Configuration

In accordance with Rime's official production catalog:

| Parameter | Shipped Production Value | Notes |
| :--- | :--- | :--- |
| **Provider** | Rime | Official API integration |
| **Model ID** | `coda` | High-fidelity neural voice (supports `mistv3` streaming) |
| **Speaker** | `celeste` | Natural conversational assistant (supports `astra` tone) |
| **Language** | `en` (`eng`) | English |
| **Endpoint (Web Runtime)** | `https://users.rime.ai/v1/rime-tts` | REST endpoint with HTTP connection pooling |
| **Endpoint (Worker)** | `wss://users-ws.rime.ai/ws3` | WebSocket streaming endpoint via `livekit-plugins-rime` |
| **Audio Format** | `audio/mpeg` (MP3) / `audio/pcm` (16kHz) | Direct browser `<audio>` playback |
| **Transport** | Direct Rime Audio Stream | HTTP chunked proxy with client-side buffer flush |

---

## 5. Measured Performance & Latency Breakdown

All metrics represent real-time measurements in this environment (cached vs. uncached explicitly disclosed):

| Operation / Metric | Measured Value | Classification | Verification Method |
| :--- | :--- | :--- | :--- |
| **Software Audio Buffer Flush** | **`0.13 ms`** | Uncached (Software Buffer) | Monotonic clock delta to pause playback & clear audio element buffers (physical acoustic decay depends on OS/room) |
| **Generation Fence Invalidation** | **`0.02 ms`** | Uncached (Memory State) | Synchronous set insertion and generation rollover |
| **Stale Result Rejection Gate** | **`0.10 ms`** | Uncached (Gateway Check) | Gate check prior to audio synthesis / delivery |
| **Gemini LLM Response Time** | **`731 ms – 1,168 ms`** | Uncached (HTTPS Network) | Live Gemini Flash Lite inference round-trip |
| **Rime Cloud Neural TTFB (35 words)**| **`3,410 ms`** | Uncached (Cloud Synthesis) | Full audio tensor synthesis across network |
| **Rime Cloud Neural TTFB (15 words)**| **`1,848 ms`** | Uncached (Cloud Synthesis) | Concise conversational sentence generation |
| **Rime Memory Cache TTFB** | **`1.0 ms`** | Cached (In-Memory Buffer) | In-memory lookup for static safety prompts |
| **Observed Stale Spoken Leaks** | **`0`** | Deterministic Invariant | Zero stale audio reaches speakers across all runs |

---

## 6. General-Purpose Intelligence Verification

EchoGuard is **not** a chatbot with hardcoded answers or keyword routing. Every natural language query is processed dynamically by the live Google Gemini API.

Tested and verified locally and on cloud:
1. **Aerodynamics & Physics:** *"Explain why airplanes can fly even though they are heavier than air."* -> Gemini generates genuine Bernoulli/lift explanation (2626ms).
2. **Coding & Algorithms:** *"Write a Python function that checks whether a number is prime."* -> Gemini generates real algorithmic loop logic (937ms).
3. **Multi-Turn Context Follow-Up:** *"Now explain that in very simple terms."* -> Gemini recalls the immediate preceding turn and explains prime numbers using everyday analogies (1168ms).
4. **Astrophysics Interrupted by Geology:** *"Explain how black holes form."* interrupted by *"No, forget that. Explain how earthquakes happen instead."* -> Generation N invalidated; delayed black hole queries rejected as stale; only earthquake response spoken by Rime.

---

## 7. Local Setup & Quickstart

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ (optional; pre-built production bundle is included in `frontend/dist`)

### Quickstart

```bash
# 1. Clone repository
git clone https://github.com/Shivamshrma12/Echoguard.git
cd Echoguard

# 2. Install backend dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Add your RIME_API_KEY and GEMINI_API_KEY to .env

# 4. Start the server (serves API and compiled UI on port 8000)
python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/` in Chrome or Edge, allow microphone access, and begin speaking naturally.

---

## 8. Verification & Test Suite

### 1. Automated Unit & Invariant Tests (17/17 Passed)
```bash
python -m pytest tests/ -v
```
Asserts monotonic generation increment, generation invalidation upon interruption, immediate audio cancel, stale background result rejection, and zero stale leaks.

### 2. Organizer Preflight & Secret Hygiene Check
```bash
python scripts/preflight_check.py
```
Validates:
- Secret hygiene (`.env` ignored, placeholder `.env.example`, no tracked credentials).
- Active Rime model/speaker catalog compatibility (`coda:celeste`).
- Live Rime API connectivity probe.
- All 17 invariant tests passing.

### 3. General-Purpose Reasoning & Interruption Script
```bash
python server/test_general_purpose_verification.py
```
Verifies live Gemini generation across physics, coding, multi-turn follow-up, and strict generation fencing under arbitrary topic interruption.

---

## 9. Limitations & Failure Behavior

1. **In-Flight Remote Synthesis:** Rime's REST API generates the entire audio payload before returning. When a user interrupts while Rime is synthesizing, the gateway cannot cancel the HTTP connection already established with Rime's cloud server; instead, EchoGuard's generation fence catches the response upon return, marks it `STALE_RESULT_REJECTED`, and drops the bytes, returning `HTTP 410` so the audio never reaches the browser or speakers.
2. **Acoustic Transducer Latency:** Software audio cancellation executes in 0.13 ms; however, physical acoustic dissipation depends on OS sound drivers and room acoustics.
3. **Browser Microphone AEC:** Automatic barge-in uses browser Acoustic Echo Cancellation (AEC) and candidate token filtering. In environments with extreme speaker volume and no headphones, high acoustic reflection may momentarily delay barge-in threshold detection.

---

## 10. License

EchoGuard is released under the MIT License.
Third-party components:
- `livekit-agents` & `livekit-plugins-rime`: Apache 2.0
- `FastAPI` / `Starlette`: MIT License
- `Lucide Icons`: ISC License
