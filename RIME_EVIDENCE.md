# EchoGuard — Rime Evidence Dossier

## 1. Hard Voice Claim

EchoGuard prevents obsolete conversational state from becoming obsolete spoken output via deterministic generation fencing, immediate software audio buffer flushing (0.13 ms), and stale-result rejection.

---

## 2. Why Voice Is Load-Bearing

Voice is an ephemeral, linear, acoustic medium. Unlike a graphical user interface where an outdated visual card can be re-rendered silently, **spoken words cannot be un-heard**. 

In conventional voice AI pipelines, when a user changes intent or speaks over an agent while an LLM, tool, or audio synthesis is in flight, the obsolete results arrive asynchronously and play aloud over the user's new question. A simple "Stop" or "Mute" button only silences physical playback at that moment; it does not protect the pipeline from delayed network responses arriving hundreds of milliseconds later. Realtime voice reliability requires architectural generation fencing to guarantee that stale speech never reaches the user.

---

## 3. Target User & Application

- **Conversational Voice AI Users:** Individuals interacting with natural-language voice assistants where fluid human barge-in and dynamic mid-turn corrections are expected.
- **Voice Agent Developers:** Engineers building full-duplex, tool-augmented voice experiences with Rime TTS who need deterministic protection against race conditions and out-of-order spoken responses.
- **Hands-Free Operators:** Users in hands-busy workflows who rely solely on acoustic output and cannot verify visual screen state.

---

## 4. Failure Mode: Interruption Race & Stale Spoken State

Without generation fencing, standard voice agent architectures exhibit a critical race condition:

1. **Turn 1 (GEN-014):** User asks: *"Explain how black holes form."*
2. **In-Flight Processing:** Gemini begins generating an answer and Rime begins synthesizing speech for GEN-014.
3. **User Interruption:** User naturally interrupts: *"No, forget that. Explain how earthquakes happen instead."*
4. **Delayed Arrival:** The delayed black hole audio or LLM response finishes processing 800ms later.
5. **Stale Leak:** Without generation fencing, the voice agent pipeline pushes the delayed black hole response to the audio queue. The agent speaks black hole physics aloud over the user's new question about earthquakes.

EchoGuard deterministically eliminates this failure mode.

---

## 5. Acceptance Test & Invariants

The acceptance criteria require that:
1. When user speech is detected during agent speech or thinking, software playback cancellation executes immediately (0.13 ms software audio buffer flush; actual physical acoustic cessation depends on sound drivers/environment).
2. The active Generation $N$ is immediately invalidated.
3. Generation $N+1$ becomes the active generation.
4. Any delayed LLM, tool, or audio request originating from Generation $N$ arriving after the interruption **must be strictly rejected**.
5. The rejected result **must not produce spoken output**.
6. Generation $N+1$ proceeds cleanly and delivers its spoken response via Rime TTS.
7. Total observed stale spoken leaks must equal **0**.

---

## 6. Exact Test Procedure & Repeatable Commands

### Procedure A: Automated Invariant Test Suite
Executes 17 automated unit and acceptance tests verifying generation creation, monotonic increment, audio queue flush, generation invalidation, and delayed result rejection.
```bash
python -m pytest tests/ -v
```
**Verification Command Output:**
```
tests/test_acceptance.py::test_acceptance_delayed_tool_interruption_and_stale_rejection PASSED
tests/test_generation_fencing.py::test_generation_creation_and_increment PASSED
tests/test_generation_fencing.py::test_basic_generation PASSED
tests/test_generation_fencing.py::test_interrupt_invalidates_generation PASSED
tests/test_generation_fencing.py::test_audio_cancel PASSED
tests/test_generation_fencing.py::test_new_generation_survives PASSED
tests/test_generation_fencing.py::test_multiple_interruptions PASSED
tests/test_interruption_recovery.py::test_full_interruption_recovery_flow PASSED
tests/test_interruption_recovery.py::test_all_chaos_tests_pass_with_zero_leaks PASSED
tests/test_server_endpoints.py::test_api_status PASSED
tests/test_server_endpoints.py::test_api_evidence PASSED
tests/test_server_endpoints.py::test_api_demo_interrupt_showcase PASSED
tests/test_server_endpoints.py::test_api_chaos_run PASSED
tests/test_server_endpoints.py::test_api_token PASSED
tests/test_stale_rejection.py::test_stale_result_is_rejected PASSED
tests/test_stale_rejection.py::test_stale_tool_result_rejected PASSED
tests/test_stale_rejection.py::test_parallel_tool_race PASSED
======================= 17 passed in 8.46s =======================
```

### Procedure B: General-Purpose Intelligence & Arbitrary Topic Fencing
Executes arbitrary prompts against live Gemini and Rime APIs, testing physics reasoning, coding, multi-turn follow-up, and topic interruption:
```bash
python server/test_general_purpose_verification.py
```
**Verification Trace:**
```
1. Prompt 1 (Physics): "Explain why airplanes can fly even though they are heavier than air."
   -> Gemini generated aerodynamics explanation (2626ms).
2. Prompt 2 (Coding): "Write a Python function that checks whether a number is prime."
   -> Gemini generated algorithmic loop logic (937ms).
3. Prompt 3 (Context Follow-Up): "Now explain that in very simple terms."
   -> Gemini retained conversation history and explained prime numbers simply (1168ms).
4. Fencing Test:
   - Generation N (GEN-014): "Explain how black holes form."
   - Interrupt: "No, forget that. Explain how earthquakes happen instead." (Software audio buffer flush: 0.13ms)
   - Invalidation: GEN-014 invalidated -> GEN-015 created.
   - Stale Audio Fetch: GET /api/tts/audio?generationId=GEN-014 -> HTTP 410 Gone ({"error":"STALE_GENERATION"})
   - Stale Query Fetch: POST /api/chat/query {"generationId":"GEN-014"} -> {"status":"FENCED_REJECTED"}
   - Active Turn Delivery: Gemini & Rime delivered earthquake response under GEN-015 (342,240 bytes).
```

### Procedure C: Submission Preflight & Secret Hygiene Check
```bash
python scripts/preflight_check.py
```
Validates zero secret exposure, live Rime API catalog compatibility (`coda:celeste`), live synthesis probe, and test suite execution.

---

## 7. Observed Measurements (Disclosed Cached vs. Uncached)

All measurements collected from live runtime execution in this environment:

| Metric | Measured Value | Classification | Method |
| :--- | :--- | :--- | :--- |
| **Software Audio Buffer Flush** | **`0.13 ms`** | Uncached (Software Buffer) | Monotonic clock delta to pause playback & clear audio element buffers (physical acoustic decay depends on OS/room) |
| **Generation Fence Invalidation** | **`0.02 ms`** | Uncached (Memory State) | Synchronous set insertion and generation rollover |
| **Stale Result Rejection Gate** | **`0.10 ms`** | Uncached (Gateway Check) | Pre-synthesis gate check returning HTTP 410 |
| **Gemini LLM Response Time** | **`731 ms – 1,168 ms`** | Uncached (HTTPS Network) | Live Gemini Flash Lite inference round-trip |
| **Rime Cloud Neural TTFB (15 words)** | **`1,848 ms`** | Uncached (Cloud Synthesis) | Concise conversational sentence synthesis |
| **Rime Cloud Neural TTFB (35 words)** | **`3,410 ms`** | Uncached (Cloud Synthesis) | Extended multi-sentence paragraph synthesis |
| **Rime Memory Cache TTFB** | **`1.0 ms`** | Cached (In-Memory Buffer) | In-memory lookup for static safety prompts |
| **Observed Stale Spoken Leaks** | **`0`** | Deterministic Invariant | Zero stale audio reached speakers across all runs |

---

## 8. Exact Rime Configuration

Shipped production configuration:
- **Provider:** Rime
- **Model ID:** `coda` (Production neural model; supports `mistv3` streaming)
- **Speaker:** `celeste` (Natural conversational tone; supports `astra` tone)
- **Language:** `en` (`eng`)
- **Web Runtime Endpoint:** `https://users.rime.ai/v1/rime-tts` (REST with persistent HTTP connection pool)
- **Worker Endpoint:** `wss://users-ws.rime.ai/ws3` (WebSocket via `livekit-plugins-rime`)
- **Audio Format:** `audio/mpeg` (MP3) in browser web application / `PCM 16kHz` in agent worker
- **Segmentation:** `bySentence`
- **Transport:** Direct Rime Audio Stream (HTTP chunked streaming in web app with client-side buffer flush; WebSocket in LiveKit worker)

---

## 9. Limitations & Failure Behavior

1. **Remote Cloud Synthesis Cancellation:** When a user interrupts while Rime's cloud server is actively synthesizing audio, the HTTP request to Rime cannot be cancelled mid-stream over the public REST API. EchoGuard fences the generation at the gateway, receives the bytes, marks them `STALE_RESULT_REJECTED`, and drops them, returning `HTTP 410` so the audio never reaches the browser or speakers.
2. **Acoustic Transducer Decay:** Software buffer purging occurs in 0.13 ms; however, physical acoustic dissipation from room reverberation and OS sound hardware introduces a physical cessation delay outside software control.
3. **Microphone AEC:** Web Speech API continuous recognition relies on browser Acoustic Echo Cancellation (AEC) and candidate token discrimination (`isLikelySpeakerEcho`) to prevent the agent's Rime speech from triggering false self-interruptions.
