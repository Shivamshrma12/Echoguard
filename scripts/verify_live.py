import urllib.request
import json

def post(url, data=None):
    if data is None:
        data = {}
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

def get(url):
    return json.loads(urllib.request.urlopen(url).read().decode('utf-8'))

print("=== 1. STATUS ===")
st = get("http://127.0.0.1:8000/api/status")
print(f"Status: {st['service']} | Generation: {st['generationId']} | State: {st['state']}")

print("\n=== 2. RUN SHOWCASE INTERRUPT TEST ===")
sh = post("http://127.0.0.1:8000/api/demo/interrupt-test")
print(f"Passed: {sh['testResult']['passed']} | Stale Leaks: {sh['testResult']['staleLeaks']}")
print(f"Incident Created: {sh['incident']['incidentId']} | Duration: {sh['incident']['durationMs']} ms")
print(f"What user heard: {sh['incident']['whatUserHeard']}")

print("\n=== 3. RUN CHAOS SUITE ===")
ch = post("http://127.0.0.1:8000/api/chaos/run", {})
print(f"Tests: {ch['totalTests']} | Passed: {ch['passedTests']} | Stale Leaks: {ch['totalStaleLeaks']}")
for t in ch['results']:
    status = "PASS" if t['passed'] else "FAIL"
    print(f"  - Test {t['testId']}: {t['name']} -> {status} ({t['durationMs']}ms, Leaks: {t['staleLeaks']})")

print("\n=== 4. EVIDENCE DOSSIER ===")
ev = get("http://127.0.0.1:8000/api/evidence")
print(f"Claim: {ev['claim'][:60]}...")
print(f"Rime Model: {ev['rimeConfiguration']['model']} | Speaker: {ev['rimeConfiguration']['speaker']}")
print(f"Acceptance Test Status: {ev['acceptanceTest']['passed']} | Stale Leaks: {ev['acceptanceTest']['staleLeaks']}")
print(f"Measured Audio Stop: {ev['metrics']['measuredInterruptToAudioStopMs']}ms")
