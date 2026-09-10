import time
import httpx

BASE_URL = "http://127.0.0.1:8000"

def test_acceptance_flow():
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Reset / Start session
        start_res = client.post("/api/session/start", json={"mode": "live"})
        assert start_res.status_code == 200, f"Start session failed: {start_res.text}"
        initial_data = start_res.json()
        gen_delhi = initial_data["generationId"]
        print(f"\n[Step A] Session active. Generation for Delhi query: {gen_delhi}")

        # 2. User says: "Tell me about the weather in Delhi."
        print(f"[Step A] Sending query: 'Tell me about the weather in Delhi.' with generationId={gen_delhi}")
        t0 = time.perf_counter()
        delhi_res = client.post("/api/chat/query", json={"query": "Tell me about the weather in Delhi.", "generationId": gen_delhi})
        t_delhi = (time.perf_counter() - t0) * 1000
        assert delhi_res.status_code == 200, f"Delhi query failed: {delhi_res.text}"
        delhi_data = delhi_res.json()
        print(f"[Step B] Agent generated Delhi response in {t_delhi:.1f}ms: \"{delhi_data['response']}\"")
        assert delhi_data["status"] == "SUCCESS"
        assert delhi_data["generationId"] == gen_delhi

        # 3. Verify Rime audio synthesized for Delhi
        print(f"[Step B] Fetching Rime audio for Delhi under {gen_delhi}...")
        t_rime0 = time.perf_counter()
        audio_delhi = client.get(delhi_data["audioUrl"])
        t_rime = (time.perf_counter() - t_rime0) * 1000
        assert audio_delhi.status_code == 200
        print(f"[Step B] Rime audio received: {len(audio_delhi.content)} bytes in {t_rime:.1f}ms")

        # 4. WHILE SPEAKING: User naturally interrupts: "No, stop. Tell me about Bangalore instead."
        print(f"\n[Step C] WHILE AGENT IS SPEAKING, user naturally interrupts: 'No, stop. Tell me about Bangalore instead.'")
        interrupt_res = client.post("/api/session/interrupt", json={"utterance": "No, stop. Tell me about Bangalore instead."})
        assert interrupt_res.status_code == 200
        interrupt_data = interrupt_res.json()
        gen_bangalore = interrupt_data["newGeneration"]
        print(f"[Step D & E] Interruption executed: previous {gen_delhi} invalidated, new active generation is {gen_bangalore}")
        assert interrupt_data["previousGeneration"] == gen_delhi
        assert interrupt_data["newGeneration"] == gen_bangalore

        # 5. Verify Stale Delhi generation is strictly REJECTED
        print(f"[Step G] Verifying delayed Delhi audio request with stale generationId={gen_delhi}...")
        stale_audio_res = client.get(f"/api/tts/audio?text=The%20weather%20in%20Delhi&generationId={gen_delhi}")
        print(f"[Step G] Stale Delhi audio request result: HTTP {stale_audio_res.status_code} ({stale_audio_res.text})")
        assert stale_audio_res.status_code == 410, f"Expected HTTP 410 for stale audio, got {stale_audio_res.status_code}"

        print(f"[Step G] Verifying delayed Delhi chat query with stale generationId={gen_delhi}...")
        stale_query_res = client.post("/api/chat/query", json={"query": "Tell me more about Delhi", "generationId": gen_delhi})
        assert stale_query_res.status_code == 200
        stale_data = stale_query_res.json()
        print(f"[Step G] Stale Delhi query result: {stale_data}")
        assert stale_data["status"] == "FENCED_REJECTED"
        assert stale_data["currentGeneration"] == gen_bangalore

        # 6. Bangalore becomes the new active request
        print(f"\n[Step F & H] Dispatching new user utterance 'Tell me about Bangalore instead.' with generationId={gen_bangalore}")
        t_bng0 = time.perf_counter()
        bangalore_res = client.post("/api/chat/query", json={"query": "Tell me about Bangalore instead.", "generationId": gen_bangalore})
        t_bng = (time.perf_counter() - t_bng0) * 1000
        assert bangalore_res.status_code == 200
        bangalore_data = bangalore_res.json()
        print(f"[Step F & H] Bangalore response generated in {t_bng:.1f}ms: \"{bangalore_data['response']}\"")
        assert bangalore_data["status"] == "SUCCESS"
        assert bangalore_data["generationId"] == gen_bangalore

        # 7. Verify Rime audio synthesized for Bangalore
        audio_bangalore = client.get(bangalore_data["audioUrl"])
        assert audio_bangalore.status_code == 200
        print(f"[Step H] Bangalore Rime audio ready: {len(audio_bangalore.content)} bytes under {gen_bangalore}")

        # 8. Check telemetry events & status
        status_res = client.get("/api/status")
        status_data = status_res.json()
        print(f"\n[System Verification] Current generation: {status_data['generationId']}")
        print(f"[System Verification] Invalidated generations: {status_data['invalidatedGenerations']}")
        assert gen_delhi in status_data["invalidatedGenerations"]
        assert status_data["generationId"] == gen_bangalore
        print("\n[SUCCESS] ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_acceptance_flow()
