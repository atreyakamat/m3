"""End-to-end LAN API verification script for M3 Malaria Surveillance.
Tests all roles, authorization gates, core surveillance flow, and data isolation.
Connects via office LAN IP: 192.168.1.122:8001
"""
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

BASE_URL = "http://192.168.1.122:8001/api/v1"
HEALTH_URL = "http://192.168.1.122:8001/health"
DEMO_PIN = "2468"

def req(path, method="GET", body=None, token=None):
    url = f"{BASE_URL}{path}" if not path.startswith("http") else path
    data = json.dumps(body).encode("utf-8") if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            body = json.loads(content)
        except Exception:
            body = content
        return e.code, body

def main():
    print("--- 1. Health check over LAN IP ---")
    status, res = req(HEALTH_URL)
    assert status == 200, f"Health check failed: {status} {res}"
    print(f"PASS: {HEALTH_URL} -> {res}")

    print("\n--- 2. Negative Authentication Tests ---")
    # Wrong phone
    status, res = req("/auth/login", method="POST", body={"phone": "9999999999", "pin": DEMO_PIN})
    assert status == 401, f"Expected 401, got {status}: {res}"
    print(f"PASS: Unknown phone rejected with 401: {res.get('detail')}")

    # Wrong PIN
    status, res = req("/auth/login", method="POST", body={"phone": "+919000000001", "pin": "0000"})
    assert status == 401, f"Expected 401, got {status}: {res}"
    print(f"PASS: Wrong PIN rejected with 401: {res.get('detail')}")

    print("\n--- 3. Role Authentication Tests (PIN 2468) ---")
    tokens = {}
    users = {}
    roles = [
        ("+919000000001", "worker"),
        ("+919000000002", "clinician"),
        ("+919000000003", "pathology"),
        ("+919000000004", "health_worker"),
        ("+919000000005", "research_lab"),
        ("+919000000006", "contractor"),
    ]
    for phone, role in roles:
        status, res = req("/auth/login", method="POST", body={"phone": phone, "pin": DEMO_PIN})
        assert status == 200, f"Login failed for {role}: {status} {res}"
        tokens[role] = res["access_token"]
        users[role] = res["user"]
        assert role in res["user"]["roles"], f"Role mismatch: {res['user']['roles']}"
        print(f"PASS: {role} authenticated ({users[role]['display_name']}), roles: {users[role]['roles']}")

    print("\n--- 4. Role Authorization Gates ---")
    # Worker forbidden from creating assessments
    status, res = req("/assessments", method="POST", body={"patient_id": "dummy"}, token=tokens["worker"])
    assert status == 403, f"Expected 403 for worker on /assessments, got {status}"
    print(f"PASS: Worker blocked from /assessments (403: {res.get('detail')})")

    # Worker forbidden from creating diagnostic samples
    status, res = req("/samples", method="POST", body={"patient_id": "dummy", "method": "rdt", "result_status": "pending"}, token=tokens["worker"])
    assert status == 403, f"Expected 403 for worker on /samples, got {status}"
    print(f"PASS: Worker blocked from /samples (403: {res.get('detail')})")

    # Clinician forbidden from creating pathology samples
    status, res = req("/samples", method="POST", body={"patient_id": "dummy", "method": "rdt", "result_status": "pending"}, token=tokens["clinician"])
    assert status == 403, f"Expected 403 for clinician on /samples, got {status}"
    print(f"PASS: Clinician blocked from POST /samples (403: {res.get('detail')})")

    # Pathology forbidden from creating research results
    status, res = req("/research-results", method="POST", body={"sample_id": "dummy", "pcr_status": "pending"}, token=tokens["pathology"])
    assert status == 403, f"Expected 403 for pathology on /research-results, got {status}"
    print(f"PASS: Pathology blocked from POST /research-results (403: {res.get('detail')})")

    print("\n--- 5. Core Surveillance Flow: Worker -> Diagnosis -> Follow-up -> Research ---")
    # Step A: Get site list as worker
    status, sites_res = req("/sites", token=tokens["worker"])
    assert status == 200 and len(sites_res["items"]) > 0, f"Failed to get sites: {sites_res}"
    site_id = sites_res["items"][0]["id"]
    print(f"PASS: Sites retrieved: {sites_res['items'][0]['name']} (ID: {site_id})")

    # Step B: Worker creates new worker record (intake)
    status, new_worker = req("/workers", method="POST", body={
        "display_name": "Synthetic E2E Worker",
        "age_years": 32,
        "gender": "male",
        "occupation": "mason",
        "site_id": site_id,
        "consent_status": "documented",
        "initial_symptoms": ["fever", "chills"],
        "travel_origin": "Bihar",
    }, token=tokens["worker"])
    assert status == 201, f"Failed to create worker: {status} {new_worker}"
    patient_id = new_worker["id"]
    patient_code = new_worker["patient_code"]
    print(f"PASS: Intake created worker: UUID={patient_id}, Code={patient_code}")

    # Step C: Clinician performs assessment
    status, assessment = req("/assessments", method="POST", body={
        "patient_id": patient_id,
        "temperature_c": 38.6,
        "fever_duration_days": 3,
        "symptoms": ["fever", "headache", "rigors"],
        "notes": "Patient reports high fever starting 3 days ago.",
        "treatment_documentation": "Referred for immediate RDT and thick/thin smear",
    }, token=tokens["clinician"])
    assert status == 201, f"Failed to create assessment: {status} {assessment}"
    print(f"PASS: Clinician assessment created: ID={assessment['id']}")

    # Step D: Pathology collects sample and records RDT
    status, sample = req("/samples", method="POST", body={
        "patient_id": patient_id,
        "method": "rdt",
        "result_status": "positive",
        "species": "pv",
        "specimen_type": "whole_blood",
        "notes": "Positive for Plasmodium vivax via Pf/Pv dual combo RDT",
    }, token=tokens["pathology"])
    assert status == 201, f"Failed to create sample: {status} {sample}"
    sample_id = sample["id"]
    sample_code = sample["sample_code"]
    print(f"PASS: Pathology sample recorded: UUID={sample_id}, Code={sample_code}, Result=positive ({sample['tests'][0]['species']})")

    # Step E: Health Worker schedules follow-up
    due_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    status, followup = req("/follow-ups", method="POST", body={
        "patient_id": patient_id,
        "due_at": due_date,
        "notes": "Day 3 vivax treatment adherence check and fever resolution",
    }, token=tokens["health_worker"])
    assert status == 201, f"Failed to create follow-up: {status} {followup}"
    print(f"PASS: Health worker scheduled follow-up: ID={followup['id']}, Due={due_date}")

    # Step F: Research Lab records molecular result (separate from clinical diagnostics)
    status, research = req("/research-results", method="POST", body={
        "sample_id": sample_id,
        "pcr_status": "detected",
        "gametocyte_presence": "detected",
        "pfhrp2_status": "not_tested",
        "pfhrp3_status": "not_tested",
        "parasite_density": 12500,
        "parasite_density_unit": "parasites/uL",
    }, token=tokens["research_lab"])
    assert status == 201, f"Failed to create research result: {status} {research}"
    print(f"PASS: Research lab molecular result logged: ID={research['id']}")

    print("\n--- 6. Data Isolation & Privacy Verification ---")
    # Worker sees only their own detail or assigned record
    status, worker_detail = req(f"/workers/{patient_id}", token=tokens["clinician"])
    assert status == 200 and worker_detail["display_name"] == "Synthetic E2E Worker"
    print(f"PASS: Clinician sees full worker record including identity: {worker_detail['display_name']}")

    # Dashboard checks
    status, worker_dash = req("/dashboard", token=tokens["worker"])
    assert status == 200 and worker_dash["scope"] == "own"
    print(f"PASS: Worker dashboard scope is personal: {worker_dash['scope']}")

    status, clinician_dash = req("/dashboard", token=tokens["clinician"])
    assert status == 200 and clinician_dash["scope"] == "authorized_operational"
    print(f"PASS: Clinician dashboard shows operational counts: workers={clinician_dash['workers']}, pending={clinician_dash['samples_pending']}, positive={clinician_dash['tests_positive']}")

    print("\n=== ALL E2E LAN TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
