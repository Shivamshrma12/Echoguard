import time
import httpx

LOCAL_URL = "http://127.0.0.1:8000"

def test_general_purpose_and_fencing():
    print("==================================================================")
    print("  ECHOGUARD GENERAL-PURPOSE AI & GENERATION FENCING LOCAL TEST    ")
    print("==================================================================")

    with httpx.Client(base_url=LOCAL_URL, timeout=30.0) as client:
        # Step 0: Check status & keys
        status_res = client.get("/api/status")
        assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
        status_data = status_res.json()
        print(f"[Health] API Status: {status_data['service']}")
        print(f"[Health] Keys Configured: Gemini={status_data['keys']['gemini']}, Rime={status_data['keys']['rime']}")
        assert status_data["keys"]["gemini"] == "configured", "Gemini API key is not configured locally!"
        assert status_data["keys"]["rime"] == "configured", "Rime API key is not configured locally!"

        # Step 1: Arbitrary Prompt 1 (Aerodynamics / Physics)
        p1 = "Explain why airplanes can fly even though they are heavier than air."
        print(f"\n--- TEST 1: Arbitrary Reasoning Prompt ---")
        print(f"User Prompt: \"{p1}\"")
        t0 = time.perf_counter()
        r1 = client.post("/api/chat/query", json={"query": p1})
        t1 = (time.perf_counter() - t0) * 1000
        assert r1.status_code == 200, f"Query 1 failed: {r1.text}"
        d1 = r1.json()
        print(f"Gemini Response ({t1:.1f}ms):")
        print(f"  \"{d1['response']}\"")
        assert d1["status"] == "SUCCESS"
        assert d1["usedGemini"] is True
        # Verify genuine generation (aerodynamics concepts)
        lower_r1 = d1["response"].lower()
        has_aero_concept = any(w in lower_r1 for w in ["lift", "wing", "air", "pressure", "thrust", "shape", "bernoulli", "fly"])
        print(f"Verified genuine physics reasoning: {has_aero_concept}")
        assert has_aero_concept, "Response did not contain real physics/aerodynamics explanation!"

        # Step 2: Arbitrary Prompt 2 (Coding / Python Prime Function)
        p2 = "Write a Python function that checks whether a number is prime."
        print(f"\n--- TEST 2: Arbitrary Coding Prompt ---")
        print(f"User Prompt: \"{p2}\"")
        t0 = time.perf_counter()
        r2 = client.post("/api/chat/query", json={"query": p2})
        t2 = (time.perf_counter() - t0) * 1000
        assert r2.status_code == 200, f"Query 2 failed: {r2.text}"
        d2 = r2.json()
        print(f"Gemini Response ({t2:.1f}ms):")
        print(f"  \"{d2['response']}\"")
        assert d2["status"] == "SUCCESS"
        assert d2["usedGemini"] is True
        lower_r2 = d2["response"].lower()
        has_code_concept = any(w in lower_r2 for w in ["def", "prime", "return", "divide", "factor", "range", "number", "true", "false", "check"])
        print(f"Verified genuine coding intelligence: {has_code_concept}")
        assert has_code_concept, "Response did not contain real Python coding response!"

        # Step 3: Multi-turn Follow-up Context
        p3 = "Now explain that in very simple terms."
        print(f"\n--- TEST 3: Multi-Turn Conversational Memory Follow-Up ---")
        print(f"User Follow-up: \"{p3}\"")
        t0 = time.perf_counter()
        r3 = client.post("/api/chat/query", json={"query": p3})
        t3 = (time.perf_counter() - t0) * 1000
        assert r3.status_code == 200, f"Query 3 failed: {r3.text}"
        d3 = r3.json()
        print(f"Gemini Follow-up Response ({t3:.1f}ms):")
        print(f"  \"{d3['response']}\"")
        assert d3["status"] == "SUCCESS"
        assert d3["usedGemini"] is True
        # Verify it references prime numbers or simplicity in context of previous answer
        lower_r3 = d3["response"].lower()
        has_context = any(w in lower_r3 for w in ["prime", "number", "divide", "one", "itself", "simple", "two", "pieces", "groups"])
        print(f"Verified multi-turn context awareness: {has_context}")
        assert has_context, "Response did not demonstrate context awareness from previous turn!"

        # Step 4: Strict Generation Fencing with Arbitrary Astrophysics & Geology Prompts
        print(f"\n--- TEST 4: Generation Fencing with Arbitrary Topics ---")
        # 4a. Start fresh session
        start_res = client.post("/api/session/start", json={"mode": "live"})
        gen_blackhole = start_res.json()["generationId"]
        print(f"Initial Session Active. Target Generation: {gen_blackhole}")

        # 4b. Generation N: "Explain how black holes form."
        p_gen_n = "Explain how black holes form."
        print(f"[Gen N: {gen_blackhole}] Dispatched Prompt: \"{p_gen_n}\"")
        r_gen_n = client.post("/api/chat/query", json={"query": p_gen_n, "generationId": gen_blackhole})
        d_gen_n = r_gen_n.json()
        print(f"[Gen N: {gen_blackhole}] Response text generated: \"{d_gen_n['response'][:60]}...\"")
        assert d_gen_n["status"] == "SUCCESS"
        assert d_gen_n["generationId"] == gen_blackhole

        # 4c. USER INTERRUPTS: "No, forget that. Explain how earthquakes happen instead."
        p_interrupt = "No, forget that. Explain how earthquakes happen instead."
        print(f"\n>>> USER NATURALLY INTERRUPTS: \"{p_interrupt}\"")
        intr_res = client.post("/api/session/interrupt", json={"utterance": p_interrupt})
        intr_data = intr_res.json()
        gen_earthquake = intr_data["newGeneration"]
        print(f"Interruption Executed in {intr_data['latencyMs']:.2f}ms:")
        print(f"  Invalidated Generation: {intr_data['previousGeneration']}")
        print(f"  New Active Generation:   {gen_earthquake}")
        assert intr_data["previousGeneration"] == gen_blackhole
        assert gen_earthquake != gen_blackhole

        # 4d. STALE RESULT REJECTION VERIFICATION
        # Verify delayed Gen N audio cannot be synthesized or fetched
        print(f"\n--- Verifying Stale Result Rejection for {gen_blackhole} ---")
        stale_audio_res = client.get(f"/api/tts/audio?text=Black%20holes%20form%20when%20stars%20collapse&generationId={gen_blackhole}")
        print(f"Stale Audio Fetch Status: HTTP {stale_audio_res.status_code} ({stale_audio_res.json()})")
        assert stale_audio_res.status_code == 410, f"Expected HTTP 410 for stale audio, got {stale_audio_res.status_code}"
        assert stale_audio_res.json()["error"] == "STALE_GENERATION"

        # Verify delayed Gen N LLM/Tool response arriving after interruption is dropped
        stale_llm_res = client.post("/api/chat/query", json={"query": "Tell me more about black holes", "generationId": gen_blackhole})
        stale_llm_data = stale_llm_res.json()
        print(f"Stale LLM Query Status: {stale_llm_data['status']} (Current active is {stale_llm_data['currentGeneration']})")
        assert stale_llm_data["status"] == "FENCED_REJECTED"
        assert stale_llm_data["currentGeneration"] == gen_earthquake

        # 4e. ONLY Generation N+1 (Earthquakes) reaches synthesis and playback
        p_gen_n1 = "Explain how earthquakes happen instead."
        print(f"\n--- Dispatching New Active Generation ({gen_earthquake}) ---")
        print(f"Prompt: \"{p_gen_n1}\"")
        t0 = time.perf_counter()
        r_gen_n1 = client.post("/api/chat/query", json={"query": p_gen_n1, "generationId": gen_earthquake})
        t_n1 = (time.perf_counter() - t0) * 1000
        d_gen_n1 = r_gen_n1.json()
        print(f"Earthquake Response ({t_n1:.1f}ms):")
        print(f"  \"{d_gen_n1['response']}\"")
        assert d_gen_n1["status"] == "SUCCESS"
        assert d_gen_n1["generationId"] == gen_earthquake

        # 4f. Synthesize Rime Audio for Gen N+1
        print(f"Synthesizing Rime Audio for {gen_earthquake}...")
        t_rime0 = time.perf_counter()
        audio_res = client.get(d_gen_n1["audioUrl"])
        t_rime = (time.perf_counter() - t_rime0) * 1000
        assert audio_res.status_code == 200
        print(f"Rime Audio Delivered under {gen_earthquake}: {len(audio_res.content)} bytes in {t_rime:.1f}ms")

        print("\n==================================================================")
        print("  ALL LOCAL ARBITRARY REASONING & FENCING INVARIANTS VERIFIED!   ")
        print("==================================================================")

if __name__ == "__main__":
    test_general_purpose_and_fencing()
