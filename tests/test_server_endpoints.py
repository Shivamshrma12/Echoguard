import pytest
from fastapi.testclient import TestClient
from server.main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_api_status(client):
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert "service" in data
    assert "generationId" in data
    assert "state" in data
    assert "rime" in data
    assert "livekit" in data

def test_api_evidence(client):
    res = client.get("/api/evidence")
    assert res.status_code == 200
    data = res.json()
    assert data["product"] == "EchoGuard"
    assert "claim" in data
    assert "acceptanceTest" in data
    assert data["acceptanceTest"]["staleLeaks"] == 0

def test_api_demo_interrupt_showcase(client):
    res = client.post("/api/demo/interrupt-test")
    assert res.status_code == 200
    data = res.json()
    assert "testResult" in data
    assert data["testResult"]["passed"] is True
    assert data["testResult"]["staleLeaks"] == 0
    assert "incident" in data
    assert data["incident"]["resolution"] == "SUCCESS"

def test_api_chaos_run(client):
    res = client.post("/api/chaos/run", json={"testId": "02"})
    assert res.status_code == 200
    data = res.json()
    assert data["passed"] is True
    assert data["staleLeaks"] == 0

def test_api_token(client):
    res = client.get("/api/token")
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
