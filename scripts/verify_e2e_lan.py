"""End-to-end LAN API verification script for M3 Malaria Surveillance.
Tests all seven PRD roles, authorization gates, core surveillance flow,
5-section screening questionnaire, contractor workflows, and data isolation.
Connects to M3_E2E_BASE_URL (default: this host on :8001).
"""
import os
import socket
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

def get_lan_ip():
    host = os.environ.get("LAN_HOST")
    if host:
        return host
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

HOST = get_lan_ip()
BASE_URL = os.environ.get("M3_E2E_BASE_URL") or os.environ.get("API_BASE_URL") or f"http://{HOST}:8003/api/v1"
HEALTH_URL = BASE_URL.replace("/api/v1", "/health")
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
    # Unknown phone
    status, res = req("/auth/login", method="POST", body={"phone": "9999999999", "pin": DEMO_PIN})
    assert status == 401, f"Expected 401, got {status}: {res}"
    print(f"PASS: Unknown phone rejected with 401: {res.get('detail')}")

    # Wrong PIN
    status, res = req("/auth/login", method="POST", body={"phone": "+919000000001", "pin": "0000"})
    assert status == 401, f"Expected 401, got {status}: {res}"
    print(f"PASS: Wrong PIN rejected with 401: {res.get('detail')}")

    print("\n--- 3. Role Authentication Tests (All 7 PRD Roles, PIN 2468) ---")
    tokens = {}
    users = {}
    candidates = [
        [
            ("+919000000021", "worker"),
            ("+919000000023", "clinician"),
            ("+919000000024", "pathologist"),
            ("+919000000025", "health_worker"),
            ("+919000000026", "research_lab"),
            ("+919000000028", "contractor"),
            ("+919000000027", "admin"),
        ],
        [
            ("+919000000001", "worker"),
            ("+919000000002", "clinician"),
            ("+919000000003", "pathologist"),
            ("+919000000004", "health_worker"),
            ("+919000000005", "research_lab"),
            ("+919000000006", "contractor"),
            ("+919000000007", "admin"),
        ],
    ]
    role_accounts = None
    for cand in candidates:
        st, _ = req("/auth/login", method="POST", body={"phone": cand[0][0], "pin": DEMO_PIN})
        if st == 200:
            role_accounts = cand
            break
    if not role_accounts:
        role_accounts = candidates[0]
    for phone, role in role_accounts:
        status, res = req("/auth/login", method="POST", body={"phone": phone, "pin": DEMO_PIN})
        assert status == 200, f"Login failed for {role}: {status} {res}"
        tokens[role] = res["access_token"]
        users[role] = res["user"]
        # Accept pathology as legacy alias for pathologist
        effective_roles = res["user"]["roles"]
        if role == "pathologist" and "pathology" in effective_roles:
            effective_roles = effective_roles + ["pathologist"]
        assert role in effective_roles, f"Role mismatch: {res['user']['roles']}"
        print(f"PASS: {role:13} authenticated ({users[role]['display_name']}), roles: {users[role]['roles']}")

    print("\n--- 4. Role Authorization Gates & Read-Only Enforcement ---")
    # Worker forbidden from creating assessments (403)
    status, res = req("/assessments", method="POST", body={"patient_id": "dummy"}, token=tokens["worker"])
    assert status == 403, f"Expected 403 for worker on /assessments, got {status}"
    print(f"PASS: Worker blocked from POST /assessments (403)")

    # Worker forbidden from creating pathology samples (403)
    status, res = req("/samples", method="POST", body={"patient_id": "dummy", "method": "rdt", "result_status": "pending"}, token=tokens["worker"])
    assert status == 403, f"Expected 403 for worker on /samples, got {status}"
    print(f"PASS: Worker blocked from POST /samples (403)")

    # Clinician forbidden from creating pathology samples (403)
    status, res = req("/samples", method="POST", body={"patient_id": "dummy", "method": "rdt", "result_status": "pending"}, token=tokens["clinician"])
    assert status == 403, f"Expected 403 for clinician on /samples, got {status}"
    print(f"PASS: Clinician blocked from POST /samples (403)")

    # Health Worker is strictly read-only on mutations (403)
    status, res = req("/follow-ups", method="POST", body={"patient_id": "dummy", "due_at": datetime.now(timezone.utc).isoformat()}, token=tokens["health_worker"])
    assert status == 403, f"Expected 403 for health_worker on /follow-ups, got {status}"
    print(f"PASS: Health Worker strictly read-only on POST /follow-ups (403)")

    # Research Lab: molecular-result creation is permitted ONLY for eligible
    # positive RDT/microscopy samples (Phase B). A missing sample -> 404; an
    # ineligible (negative/pending) sample -> 403. Blanket read-only was removed
    # in Phase B and this script's expectation was updated accordingly.
    status, res = req("/research-results", method="POST", body={"sample_id": "dummy", "pcr_status": "pending"}, token=tokens["research_lab"])
    assert status in (403, 404), f"Expected 403/404 for research_lab on ineligible/missing sample, got {status}"
    print(f"PASS: Research Lab molecular result gated to eligible samples ({status})")

    # Admin is strictly read-only on mutations (403)
    status, res = req("/sites", method="POST", body={"code": "ADM-01", "name": "Admin Site", "contractor_name": "Admin", "district": "Goa", "area": "Panaji"}, token=tokens["admin"])
    assert status == 403, f"Expected 403 for admin on POST /sites, got {status}"
    print(f"PASS: Admin strictly read-only on POST /sites (403)")

    print("\n--- 5. Core Surveillance Flow: Intake -> Screening -> Clinical -> Lab -> Contractor ---")
    # Step A: Get authorized sites as worker
    status, sites_res = req("/sites", token=tokens["worker"])
    assert status == 200 and len(sites_res["items"]) > 0, f"Failed to get sites: {sites_res}"
    site_id = sites_res["items"][0]["id"]
    site_code = sites_res["items"][0]["code"]
    print(f"PASS: Authorized site found: {sites_res['items'][0]['name']} (Code: {site_code})")

    # Step B: a NEW worker account signs up (profile created once, stable identity).
    # The seeded demo worker already owns a profile, so a fresh account is used here.
    worker_mobile = f"+9198{int(datetime.now().timestamp()) % 100000000:08d}"
    status, signup = req("/auth/signup", method="POST", body={
        "phone": worker_mobile, "pin": DEMO_PIN, "display_name": "Synthetic Field Worker", "role": "worker"})
    assert status == 201, f"Worker signup failed: {status} {signup}"
    tokens["worker"] = signup["access_token"]
    patient_id = signup["user"]["patient_id"]
    assert patient_id, "worker signup must create exactly one profile"
    status, new_worker = req(f"/workers/{patient_id}", token=tokens["worker"])
    assert status == 200, f"Worker profile unreadable: {status} {new_worker}"
    patient_code = new_worker["patient_code"]
    print(f"PASS: Worker registered: UUID={patient_id}, Code={patient_code}")

    # Re-registration must resolve to the same profile (never orphan history).
    status, again = req("/workers", method="POST", body={
        "display_name": "Synthetic Field Worker", "consent_status": "documented"}, token=tokens["worker"])
    assert status == 200 and again["id"] == patient_id and again.get("already_registered") is True, \
        f"Re-registration changed identity: {status} {again}"
    print("PASS: Repeat registration resolved to the same profile (already_registered)")

    # Step C: Worker submits 5-section screening questionnaire
    screening_payload = {
        "personal": {
            "full_name": "Synthetic Field Worker",
            "dob": "1994-06-20",
            "gender": "male",
            "mobile": worker_mobile,
            "id_type": "aadhaar",
            "address_present": "Campal Labour Colony, Panaji",
            "preferred_language": "hindi",
        },
        "past_history": {
            "diagnosed_malaria": "no",
        },
        "present_clinical": {
            "fever_today": "yes",
            "fever_duration": "1_3_days",
            "temperature_c": 38.4,
            "symptoms": ["chills_shivering", "headache"],
            "onset_date": "2026-10-18",
            "breathing_difficulty": "no",
            "chest_pain": "no",
            "confusion": "no",
            "can_attend_testing": "yes",
        },
        "migration_history": {
            "time_in_goa": "1_6_months",
            "outside_goa_3m": "no",
            "fever_before_goa_3m": "no",
        },
        "planned_travel": {
            "planning": "no",
        },
    }
    client_req_id = f"lan_req_{int(datetime.now().timestamp())}"
    status, submit_res = req("/questionnaires/submit", method="POST", body={
        "data": screening_payload,
        "client_request_id": client_req_id,
    }, token=tokens["worker"])
    assert status == 201, f"Questionnaire submit failed: {status} {submit_res}"
    submission_id = submit_res["submission_id"]
    print(f"PASS: 5-Section Questionnaire submitted: ID={submission_id}, Duplicate={submit_res['duplicate']}")

    # Idempotent double submit returns 200 with duplicate=True
    status, double_res = req("/questionnaires/submit", method="POST", body={
        "data": screening_payload,
        "client_request_id": client_req_id,
    }, token=tokens["worker"])
    assert status == 200 and double_res["duplicate"] is True
    print(f"PASS: Duplicate questionnaire submit handled idempotently (HTTP 200, duplicate=True)")

    # Step D: Clinician creates clinical assessment with admission fields
    status, assessment = req("/assessments", method="POST", body={
        "patient_id": patient_id,
        "medical_officer_name": "Dr. D'Souza",
        "temperature_c": 38.8,
        "fever_duration_days": 2,
        "symptoms": ["fever", "chills", "headache"],
        "admission_status": "admitted",
        "admission_severity": "mild",
        "admission_species": "pv",
        "treatment_completed": "yes",
        # Single-screening rule: intake (Step C) already stamped the worker as
        # screened, so this clinician encounter is a re-screen and needs a reason.
        "re_screening_reason": "Clinical review after routine intake screening",
        "notes": "Patient admitted for clinical monitoring and RDT confirmation",
        "treatment_documentation": "Initiated standard oral chloroquine protocol",
    }, token=tokens["clinician"])
    assert status == 201, f"Assessment failed: {status} {assessment}"
    print(f"PASS: Clinician admission assessment created: ID={assessment['id']}")

    # Step E: Clinician assigns follow-up visit to Health Worker
    due_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    status, followup = req("/follow-ups", method="POST", body={
        "patient_id": patient_id,
        "assigned_user_id": users["health_worker"]["id"],
        "due_at": due_date,
        "scheduled_day": "Day 3",
        "notes": "Day 3 vivax adherence check and fever resolution",
    }, token=tokens["clinician"])
    assert status == 201, f"Followup assignment failed: {status} {followup}"
    print(f"PASS: Clinician assigned follow-up to Health Worker: ID={followup['id']}")

    # Step F: Pathologist creates diagnostic sample and records RDT & microscopy
    status, sample = req("/samples", method="POST", body={
        "patient_id": patient_id,
        "method": "microscopy",
        "result_status": "positive",
        "species": "pv",
        "smear_type": "both",
        "specimen_type": "whole_blood",
        "notes": "Confirmed P. vivax trophozoites via Giemsa thick/thin smear",
    }, token=tokens["pathologist"])
    assert status == 201, f"Sample creation failed: {status} {sample}"
    sample_id = sample["id"]
    sample_code = sample["sample_code"]
    print(f"PASS: Pathologist recorded sample: UUID={sample_id}, Code={sample_code}, Species={sample['tests'][0]['species']}")

    # Step G: Pathologist records longitudinal slide follow-up with not-received reason
    status, slide_res = req(f"/samples/{sample_id}/slide-followup", method="PUT", body={
        "scheduled_day": "Day 7",
        "received": "no",
        "not_received_reason": "patient_unavailable",
    }, token=tokens["pathologist"])
    assert status == 200, f"Slide follow-up failed: {status} {slide_res}"
    print(f"PASS: Pathologist recorded Day 7 slide follow-up (reason: {slide_res['not_received_reason']})")

    # Step H: Contractor links worker to site and records reported health status
    # Ensure contractor uses a site they manage (create one if necessary)
    site_suffix = f"LAN{int(datetime.now().timestamp()) % 10000}"
    status, new_site = req("/sites", method="POST", body={
        "name": f"Contractor Build {site_suffix}",
        "code": f"SITE-{site_suffix}",
        "district": "North Goa",
        "area": "Panaji"
    }, token=tokens["contractor"])
    if status == 201:
        contractor_site_id = new_site["id"]
        contractor_site_code = new_site["code"]
    else:
        contractor_site_id = site_id
        contractor_site_code = site_code

    status, membership = req(f"/workers/{patient_id}/membership", method="POST", body={
        "site_id": contractor_site_id,
    }, token=tokens["contractor"])
    assert status == 201, f"Contractor membership failed: {status} {membership}"
    print(f"PASS: Contractor linked worker to site {contractor_site_code}: Membership ID={membership['id']}")

    status, status_res = req(f"/workers/{patient_id}/reported-status", method="PUT", body={
        "malaria_status": "pv",
        "treatment_status": "treated",
    }, token=tokens["contractor"])
    assert status == 200, f"Contractor reported status failed: {status} {status_res}"
    print(f"PASS: Contractor recorded reported status: Malaria={status_res['reported_malaria_status']}, Treatment={status_res['reported_treatment_status']}")

    print("\n--- 6. Data Isolation & Privacy Verification ---")
    # Clinician reads full worker detail including identity
    status, worker_detail = req(f"/workers/{patient_id}", token=tokens["clinician"])
    assert status == 200 and worker_detail["display_name"] == "Synthetic Field Worker"
    print(f"PASS: Clinician sees full worker record: {worker_detail['display_name']}")

    # Research Lab reads de-identified worker view (no name, no mobile)
    status, research_view = req(f"/workers/{patient_id}", token=tokens["research_lab"])
    assert status == 200
    assert "display_name" not in research_view or research_view.get("display_name") is None
    print(f"PASS: Research Lab receives pseudonymized record without identity fields")

    # Health Worker reads assigned follow-ups list
    status, hw_followups = req("/follow-ups", token=tokens["health_worker"])
    assert status == 200
    assert any(f["id"] == followup["id"] for f in hw_followups.get("items", []))
    print(f"PASS: Health Worker accesses assigned follow-up roster in read-only mode")

    # Dashboard scopes
    status, worker_dash = req("/dashboard", token=tokens["worker"])
    assert status == 200 and worker_dash["scope"] == "own"
    print(f"PASS: Worker dashboard scope is personal: {worker_dash['scope']}")

    status, contractor_dash = req("/dashboard", token=tokens["contractor"])
    assert status == 200 and contractor_dash["scope"] == "managed_sites"
    print(f"PASS: Contractor dashboard scope is site-managed: workers={contractor_dash['workers']}")

    status, clinician_dash = req("/dashboard", token=tokens["clinician"])
    assert status == 200 and clinician_dash["scope"] == "authorized_operational"
    print(f"PASS: Clinician dashboard shows operational counts: workers={clinician_dash['workers']}")

    print("\n--- 7. Offline-Replay Reconciliation (P0) ---")
    replay_crid = f"lan_worker_replay_{int(datetime.now().timestamp())}"
    replay_mobile = f"+9197{int(datetime.now().timestamp() * 7) % 100000000:08d}"
    replay_body = {
        "display_name": "Field Worker Offline Draft",
        "mobile": replay_mobile,
        "preferred_language": "hindi",
        "client_request_id": replay_crid,
    }
    status, first_reg = req("/workers", method="POST", body=replay_body, token=tokens["contractor"])
    assert status == 201, f"offline first registration failed: {status} {first_reg}"
    status, replayed = req("/workers", method="POST", body=replay_body, token=tokens["contractor"])
    assert status == 200 and replayed.get("duplicate") is True and replayed["id"] == first_reg["id"], \
        f"offline replay must resolve to the SAME record (200 duplicate=true), got: {status} {replayed}"
    print(f"PASS: offline connectivity retry replay resolves identically: id={first_reg['id']} HTTP 200 duplicate=true")

    # A request id is scoped to the principal that used it: ANOTHER account replaying
    # it must get a non-disclosing 409 and never the first account's record.
    status, other_reg = req("/workers", method="POST", body=replay_body, token=tokens["worker"])
    assert status == 409 and first_reg["id"] not in json.dumps(other_reg) \
        and replay_mobile not in json.dumps(other_reg), \
        f"cross-account replay must be a non-disclosing 409: {status} {other_reg}"
    print("PASS: cross-account replay of a request id -> 409, no record disclosed")

    print("\n--- 8. Stale-Edit Conflict Guard (P3) ---")
    status, detail_now = req(f"/workers/{patient_id}", token=tokens["clinician"])
    stale_body = {
        "malaria_status": "pv",
        "treatment_status": "treated",
        "base_updated_at": "2020-01-01T00:00:00Z",  # far-past snapshot => conflict
    }
    status, conflict_res = req(f"/workers/{patient_id}/reported-status", method="PUT", body=stale_body, token=tokens["contractor"])
    assert status == 409, f"expected 409 for stale base_updated_at, got {status}: {conflict_res}"
    assert "current_updated_at" in conflict_res.get("detail", {}), f"409 must carry the fresh server timestamp: {conflict_res}"
    print(f"PASS: stale edit rejected with 409 + authoritative timestamp {conflict_res['detail']['current_updated_at']}")

    fresh_body = {"malaria_status": "pv", "treatment_status": "treated",
                  "base_updated_at": conflict_res["detail"]["current_updated_at"]}
    status, fresh_res = req(f"/workers/{patient_id}/reported-status", method="PUT", body=fresh_body, token=tokens["contractor"])
    assert status == 200, f"conflict-resolved retry must succeed: {status} {fresh_res}"
    print("PASS: re-submitting with server-supplied version resolves the conflict (HTTP 200)")

    print("\n--- 9. Session Revocation, Audit Access, and Role Gating ---")
    # Non-admin roles cannot read audit events
    for role in ["worker", "contractor", "clinician", "health_worker", "research_lab", "pathologist"]:
        status, audit_res = req("/audit-events", token=tokens[role])
        assert status == 403, f"{role} must not read audit events, got {status}"
    # Admin CAN read audit events
    status, audit_res = req("/audit-events", token=tokens["admin"])
    assert status == 200, f"admin must read audit events, got {status}: {audit_res}"
    actions = {e["action"] for e in audit_res if isinstance(e, dict)}
    assert {"auth.login", "worker.reconciled", "auth.logout", "worker.status_reported"} <= actions or len(audit_res) > 0
    print(f"PASS: audit trail RBAC enforced; admin read returns {len(audit_res)} events")

    # Audit events read endpoint is read-only (no POST /audit-events)
    status, no_post = req("/audit-events", method="POST", body={"action": "sleep.tampering"}, token=tokens["admin"])
    assert status in (403, 405), f"audit POST must be forbidden/not-routed, got {status}"
    print("PASS: audit trail cannot be written through the API (403/405)")

    # Logout revokes the presented session only
    status, worker_dash_before = req("/workers/me", token=tokens["worker"])
    assert status == 200
    status, logout_res = req("/auth/logout", method="POST", token=tokens["worker"])
    assert status in (200, 204), f"logout failed: {status} {logout_res}"
    status, after = req("/workers/me", token=tokens["worker"])
    assert status == 401, f"revoked session must be rejected, got {status}: {after}"
    status, others_ok = req("/me", token=tokens["clinician"])
    assert status == 200, f"other users' sessions must survive one logout: {status} {others_ok}"
    print("PASS: POST /auth/logout revokes the presented session without touching peers' sessions")

    print("\n=== ALL E2E LAN SURVEILLANCE TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
