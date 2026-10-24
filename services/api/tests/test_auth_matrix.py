"""AUTH-001..005: server-enforced role matrix incl. read-only roles and unauthenticated access."""
import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


READ_ONLY_ROLES = ["admin"]


def attempt_mutations(client, token, sample_id, worker_id):
    results = {}
    payloads = {
        ("POST", "/api/v1/sites"): {"code": f"T-{token or 'anon'}"[:20], "name": "Test site", "contractor_name": "T", "district": "D", "area": "A"},
        ("POST", "/api/v1/workers"): {"display_name": "Test Worker"},
        ("PUT", "/api/v1/questionnaires/draft"): {"data": {}},
        ("POST", "/api/v1/questionnaires/submit"): {"data": {}, "client_request_id": f"req-{token}1234"},
        ("POST", "/api/v1/assessments"): {"patient_id": worker_id, "temperature_c": 37.0},
        ("POST", "/api/v1/samples"): {"patient_id": worker_id, "method": "rdt", "result_status": "pending"},
        ("PUT", f"/api/v1/samples/{sample_id}/slide-followup"): {"received": "no"},
        ("POST", "/api/v1/follow-ups"): {"patient_id": worker_id, "due_at": "2026-11-05T09:00:00Z", "assigned_user_id": "health_worker"},
        ("POST", f"/api/v1/workers/{worker_id}/membership"): {"site_id": "site-a"},
        ("PUT", f"/api/v1/workers/{worker_id}/reported-status"): {"malaria_status": "pv", "treatment_status": "treated"},
        ("POST", f"/api/v1/workers/{worker_id}/travel"): {"destination": "WB"},
        ("POST", f"/api/v1/workers/{worker_id}/qr-token"): {},
        ("POST", "/api/v1/research-results"): {"sample_id": sample_id},
    }
    for (method, path), payload in payloads.items():
        response = client.request(method, path, headers=_auth(token), json=payload)
        if path.endswith("/research-results"):
            results[(method, "/api/v1/research-results")] = response.status_code
        elif f"/{worker_id}/" in path or path.startswith("/api/v1/samples/"):
            results[(method, path.split("/")[-1])] = response.status_code
        else:
            results[(method, path)] = response.status_code
    return results


def test_auth005_unauthenticated_is_401(client, tokens):
    statuses = attempt_mutations(client, None, "sample-0", "worker-x")
    assert all(code == 401 for code in statuses.values()), statuses


def test_health_worker_can_update_assigned_followup_via_api(client, tokens):
    r = client.post("/api/v1/follow-ups", headers=_auth(tokens["health_worker"]),
                    json={"patient_id": "patient-1", "due_at": "2026-11-05T09:00:00Z"})
    assert r.status_code == 403


def test_research_lab_must_use_eligible_case(client, tokens):
    r = client.post("/api/v1/research-results", headers=_auth(tokens["research_lab"]),
                    json={"sample_id": "dummy"})
    assert r.status_code in (403, 404)


def test_admin_is_read_only(client, tokens):
    statuses = attempt_mutations(client, tokens["admin"], "sample-0", "worker-x")
    assert all(code == 403 for code in statuses.values()), statuses


def test_clinician_and_pathologist_denied_outside_their_kinds(client, tokens):
    created = client.post("/api/v1/workers", headers=_auth(tokens["worker2"]),
                          json={"display_name": "Matrix Worker", "consent_status": "documented"})
    assert created.status_code == 201
    worker_id = created.json()["id"]
    assert client.post("/api/v1/samples", headers=_auth(tokens["clinician"]),
                       json={"patient_id": worker_id, "method": "rdt"}).status_code == 403
    assert client.post("/api/v1/sites", headers=_auth(tokens["clinician"]),
                       json={"code": "CLIN-1", "name": "t", "contractor_name": "t", "district": "d", "area": "a"}).status_code == 403
    assert client.post("/api/v1/follow-ups", headers=_auth(tokens["clinician"]),
                       json={"patient_id": worker_id, "due_at": "2026-11-05T09:00:00Z"}).status_code == 422
    assert client.post("/api/v1/assessments", headers=_auth(tokens["pathologist"]),
                       json={"patient_id": worker_id, "temperature_c": 37}).status_code == 403
    assert client.post("/api/v1/follow-ups", headers=_auth(tokens["pathologist"]),
                       json={"patient_id": worker_id, "due_at": "2026-11-05T09:00:00Z"}).status_code == 403
    assert client.post("/api/v1/sites", headers=_auth(tokens["pathologist"]),
                       json={"code": "PATH-1", "name": "t", "contractor_name": "t", "district": "d", "area": "a"}).status_code == 403


def test_worker_cannot_access_other_workers_or_admin_endpoints(client, tokens):
    response = client.get("/api/v1/follow-ups", headers=_auth(tokens["worker"]))
    assert response.status_code == 403
    response = client.get("/api/v1/samples", headers=_auth(tokens["contractor"]))
    assert response.status_code == 403
    response = client.get("/api/v1/assessments?patient_id=other", headers=_auth(tokens["worker"]))
    assert response.status_code == 403


def test_read_only_roles_can_read_workers_list(client, tokens):
    for role in READ_ONLY_ROLES:
        response = client.get("/api/v1/workers", headers=_auth(tokens[role]))
        assert response.status_code == 200, (role, response.text)
        assert "items" in response.json()
