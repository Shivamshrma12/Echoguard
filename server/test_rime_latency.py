import os
import time
import httpx
from dotenv import load_dotenv

load_dotenv()
rime_key = os.environ.get("RIME_API_KEY")
print(f"RIME_KEY present: {bool(rime_key)}")

texts = [
    ("Short (6 words)", "The weather in Delhi is warm."),
    ("Medium (15 words)", "Delhi is currently around 28 degrees Celsius with clear skies and moderate humidity today."),
    ("Long (35 words)", "Delhi is experiencing a warm afternoon with temperatures near 28 degrees Celsius. Humidity is moderate at 45 percent, and winds are light from the northwest, making it a generally clear and pleasant day."),
]

url = "https://users.rime.ai/v1/rime-tts"
headers = {
    "Authorization": f"Bearer {rime_key}",
    "Accept": "audio/mp3",
    "Content-Type": "application/json"
}

with httpx.Client(timeout=15.0) as client:
    for label, text in texts:
        payload = {
            "speaker": "celeste",
            "text": text,
            "modelId": "coda"
        }
        t0 = time.perf_counter()
        resp = client.post(url, json=payload, headers=headers)
        t_elapsed = (time.perf_counter() - t0) * 1000
        print(f"[{label}] length={len(text)} chars | status={resp.status_code} | bytes={len(resp.content)} | latency={t_elapsed:.1f}ms")
