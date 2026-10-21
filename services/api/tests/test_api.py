"""Regression pins for pre-existing behavior + endpoint/service authorization checks."""
import pytest


def test_unknown_phone_and_wrong_pin_use_same_generic_response(client):
    messages = []
    for phone, pin in [("9000000099", "2468"), ("9000000021", "9999")]:
        response = client.post("/api/v1/auth/login", json={"phone": phone, "pin": pin})
        messages.append((response.status_code, response.json().get("detail")))
    assert messages == [(401, "Unable to sign in with those credentials")] * 2


def test_role_gate_denies_wrong_role_for_sample_creation(client, tokens):
    response = client.post("/api/v1/samples", headers={"Authorization": f"Bearer {tokens['worker']}"},
                           json={"patient_id": "missing", "method": "rdt", "result_status": "pending"})
    assert response.status_code == 403


def test_requires_authentication_without_token(client):
    response = client.get("/api/v1/workers")
    assert response.status_code == 401
    assert "workers" not in response.json().get("detail", "").lower() or response.json()["detail"] == "Authentication required"


def test_pathology_pending_sample_has_no_species(client, tokens, unregistered_workers):
    # Create a worker first (worker snapshot), then a pending sample by the pathologist.
    created = client.post("/api/v1/workers", headers={"Authorization": f"Bearer {tokens['worker']}"},
                          json={"display_name": "Regression Worker", "consent_status": "documented"})
    assert created.status_code == 201, created.text
    sample = client.post("/api/v1/samples", headers={"Authorization": f"Bearer {tokens['pathologist']}"},
                         json={"patient_id": created.json()["id"], "method": "rdt", "result_status": "pending"})
    assert sample.status_code == 201, sample.text
    test_entry = sample.json()["tests"][0]
    assert test_entry["result_status"] == "pending"
    assert test_entry["species"] is None
    assert test_entry["method"] == "rdt"


def test_auth_signup_flow(client):
    # 1. Successful worker signup
    res = client.post("/api/v1/auth/signup", json={
        "phone": "+919123456780",
        "pin": "5678",
        "display_name": "New Test Worker",
        "role": "worker",
        "preferred_language": "en"
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert "access_token" in data
    user = data["user"]
    assert user["display_name"] == "New Test Worker"
    assert "worker" in user["roles"]
    assert user["patient_id"] is not None

    token = data["access_token"]

    # 2. Duplicate phone signup rejected with 409
    dup = client.post("/api/v1/auth/signup", json={
        "phone": "9123456780",
        "pin": "5678",
        "display_name": "Duplicate Worker",
        "role": "worker"
    })
    assert dup.status_code == 409

    # 3. Invalid phone format rejected with 422
    bad_phone = client.post("/api/v1/auth/signup", json={
        "phone": "123",
        "pin": "5678",
        "display_name": "Bad Phone",
        "role": "worker"
    })
    assert bad_phone.status_code == 422

    # 4. Login with newly registered credentials succeeds
    login_res = client.post("/api/v1/auth/login", json={
        "phone": "+919123456780",
        "pin": "5678"
    })
    assert login_res.status_code == 200
    assert login_res.json()["user"]["patient_id"] == user["patient_id"]

    # 5. Worker can access /api/v1/workers/me
    me_res = client.get("/api/v1/workers/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["id"] == user["patient_id"]


def test_health_and_ready_probes(client):
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"
    assert res_health.json()["service"] == "m3-api"

    res_v1_health = client.get("/api/v1/health")
    assert res_v1_health.status_code == 200
    assert res_v1_health.json()["status"] == "ok"

    res_ready = client.get("/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ready"
    assert res_ready.json()["database"] == "connected"

    res_v1_ready = client.get("/api/v1/ready")
    assert res_v1_ready.status_code == 200
    assert res_v1_ready.json()["status"] == "ready"
    assert res_v1_ready.json()["database"] == "connected"


def test_request_correlation_id_middleware(client):
    # Case 1: Auto-generated request ID
    res = client.get("/health")
    assert "x-request-id" in res.headers
    auto_id = res.headers["x-request-id"]
    assert auto_id.startswith("req_")

    # Case 2: Custom request ID echoed
    custom_id = "trace-client-uuid-98765"
    res_custom = client.get("/health", headers={"X-Request-ID": custom_id})
    assert res_custom.headers.get("x-request-id") == custom_id

    # Case 3: Error response still attaches request ID
    res_404 = client.get("/api/v1/non-existent-route", headers={"X-Request-ID": custom_id})
    assert res_404.headers.get("x-request-id") == custom_id


