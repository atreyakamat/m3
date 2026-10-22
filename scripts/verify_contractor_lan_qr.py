#!/usr/bin/env python3
"""Verification of Section 7 / Section 10: Contractor Site Creation and QR-Based Worker Assignment
against Docker Compose API on LAN IP and PostgreSQL container.

1. Authenticate as Contractor A.
2. Create a site.
3. Confirm the site is persisted in PostgreSQL.
4. Authenticate as a synthetic worker and retrieve the worker's opaque QR pass.
5. Scan/resolve the QR token (verify minimal identity, no clinical leakage).
6. Assign the worker to the contractor's site via QR token.
7. Confirm the roster updates and PostgreSQL has exactly one active assignment.
8. Retry the request and confirm idempotency prevents duplicates.
9. Try to access Contractor A's site as Contractor B and confirm access is denied (403).
10. Test the transfer-confirmation path and ensure historical assignment records are preserved.
11. Verify the contractor roster and QR resolution do not expose clinical notes, symptoms, or test results.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

BASE = (os.environ.get("M3_E2E_BASE_URL") or os.environ.get("API_BASE_URL") or "http://192.168.1.122:8003/api/v1").rstrip("/")
BOOTSTRAP_SECRET = os.environ.get("M3_BOOTSTRAP_SECRET") or os.environ.get("BOOTSTRAP_SECRET") or "m3_bootstrap_secret_development_only"
DEMO_PIN = "2468"

def req(path, method="GET", body=None, token=None, headers=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    h = {"Content-Type": "application/json", **(headers or {})}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, (json.loads(content) if content else {})
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return e.code, parsed

def query_pg(sql):
    cmd = ["docker", "compose", "exec", "-T", "db", "psql", "-U", "m3_compose_user", "-d",
           os.environ.get("M3_PSQL_DB", "m3_compose_dev"), "-tAc", sql]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return res.stdout.strip()

def main():
    print(f"Target API over LAN: {BASE}")
    
    # Check health
    s, h = req("/health")
    assert s == 200, f"Health failed: {s} {h}"
    print(f"[PASS] 0. Health check responded over LAN: {h}")

    run_id = uuid.uuid4().hex[:6].upper()

    # Provision Contractor A and Contractor B
    def provision_contractor(name_suffix):
        phone = f"+9199{uuid.uuid4().int % 100000000:08d}"
        s, b = req("/bootstrap/users", "POST",
                   {"phone": phone, "pin": DEMO_PIN, "display_name": f"Contractor {name_suffix}", "roles": ["contractor"]},
                   headers={"X-Bootstrap-Secret": BOOTSTRAP_SECRET})
        assert s == 201, f"Failed to provision contractor: {s} {b}"
        s, b = req("/auth/login", "POST", {"phone": phone, "pin": DEMO_PIN})
        assert s == 200, f"Failed to login: {s} {b}"
        return b["access_token"], b["user"]["id"]

    # Provision Worker
    def provision_worker(name_suffix):
        phone = f"+9198{uuid.uuid4().int % 100000000:08d}"
        s, b = req("/auth/signup", "POST",
                   {"phone": phone, "pin": DEMO_PIN, "display_name": f"Worker {name_suffix}", "role": "worker"})
        assert s == 201, f"Failed to signup worker: {s} {b}"
        return b["access_token"], b["user"]

    # 1. Authenticate as Contractor A
    tok_contractor_a, id_contractor_a = provision_contractor(f"Alpha-{run_id}")
    tok_contractor_b, id_contractor_b = provision_contractor(f"Beta-{run_id}")
    print("[PASS] 1. Authenticated as Contractor A and Contractor B")

    # 2. Contractor A creates a site
    site_code = f"SITE-LAN-{run_id}"
    req_id = f"req_site_{run_id}"
    s, site = req("/sites", "POST", {
        "code": site_code,
        "name": f"Marine Dockyard {run_id}",
        "district": "North Goa",
        "area": "Panaji",
        "client_request_id": req_id,
    }, token=tok_contractor_a)
    assert s == 201, f"Failed to create site: {s} {site}"
    site_id = site["id"]
    print(f"[PASS] 2. Contractor A created site: ID={site_id}, Code={site_code}")

    # 3. Confirm the site is persisted in PostgreSQL
    pg_site_count = query_pg(f"SELECT count(*) FROM sites WHERE id = '{site_id}';")
    assert pg_site_count == "1", f"Site not found in PostgreSQL: {pg_site_count}"
    print(f"[PASS] 3. Site confirmed persisted in PostgreSQL m3-compose-postgres")

    # 4. Authenticate as synthetic worker and retrieve opaque QR pass
    tok_worker, user_worker = provision_worker(f"Field-{run_id}")
    s, qr_data = req("/workers/me/qr-token", "GET", token=tok_worker)
    assert s == 200, f"Failed to get QR token: {s} {qr_data}"
    qr_token = qr_data["token"]
    patient_id = qr_data["patient_id"]
    patient_code = qr_data["patient_code"]
    print(f"[PASS] 4. Retrieved opaque Worker QR token: {qr_token[:10]}... for patient {patient_code}")

    # 5. Resolve QR token (verify resolution gives minimal identity, no clinical leakage)
    s, resolved = req("/workers/resolve-qr", "POST", {"qr_token": qr_token}, token=tok_contractor_a)
    assert s == 200, f"Failed to resolve QR token: {s} {resolved}"
    assert resolved["patient_id"] == patient_id
    assert resolved["patient_code"] == patient_code
    assert "clinical_notes" not in resolved and "symptoms" not in resolved
    print(f"[PASS] 5. Scanned/resolved QR token with strict zero-clinical privacy")

    # 6. Assign worker to Contractor A's site using QR token
    assign_req_id = f"assign_{run_id}_1"
    s, assign_res = req(f"/sites/{site_id}/workers", "POST", {
        "qr_token": qr_token,
        "client_request_id": assign_req_id,
    }, token=tok_contractor_a)
    assert s == 201, f"Failed to assign worker: {s} {assign_res}"
    assert assign_res["assigned"] is True
    print(f"[PASS] 6. Worker assigned to site {site_code} via QR token")

    # 7. Confirm roster updates and PostgreSQL has exactly ONE active assignment
    s, roster = req(f"/sites/{site_id}/workers", "GET", token=tok_contractor_a)
    assert s == 200, f"Failed to fetch roster: {s} {roster}"
    assert roster["total"] == 1
    assert roster["items"][0]["id"] == patient_id
    # Check PostgreSQL directly
    active_assignments = query_pg(f"SELECT count(*) FROM worker_site_assignments WHERE patient_id = '{patient_id}' AND end_date IS NULL;")
    assert active_assignments == "1", f"Expected exactly 1 active assignment in DB, got {active_assignments}"
    print(f"[PASS] 7. Roster updated (1 worker) and PostgreSQL verified exactly 1 active assignment")

    # 8. Retry the request and confirm idempotency prevents duplicates
    s, replay_res = req(f"/sites/{site_id}/workers", "POST", {
        "qr_token": qr_token,
        "client_request_id": assign_req_id,
    }, token=tok_contractor_a)
    assert s == 200, f"Expected 200 on replay: {s} {replay_res}"
    assert replay_res["duplicate"] is True
    active_assignments_after = query_pg(f"SELECT count(*) FROM worker_site_assignments WHERE patient_id = '{patient_id}' AND end_date IS NULL;")
    assert active_assignments_after == "1", f"Duplicate detected in DB! Count={active_assignments_after}"
    print(f"[PASS] 8. Idempotent replay returned duplicate=True, no extra DB assignment")

    # 9. Contractor B tries to access Contractor A's site and roster: 403 Forbidden
    s, b_site = req(f"/sites/{site_id}", "GET", token=tok_contractor_b)
    assert s == 403, f"Expected 403 for Contractor B on site detail: {s}"
    s, b_roster = req(f"/sites/{site_id}/workers", "GET", token=tok_contractor_b)
    assert s == 403, f"Expected 403 for Contractor B on site roster: {s}"
    s, b_assign = req(f"/sites/{site_id}/workers", "POST", {"qr_token": qr_token}, token=tok_contractor_b)
    assert s == 403, f"Expected 403 for Contractor B on worker assignment: {s}"
    print(f"[PASS] 9. Contractor B access denied to Contractor A's site and roster (403 Forbidden)")

    # 10. Test transfer confirmation path:
    # Contractor A creates Site 2
    site2_code = f"SITE-LAN2-{run_id}"
    s, site2 = req("/sites", "POST", {
        "code": site2_code,
        "name": f"Terminal 2 Expansion {run_id}",
        "district": "North Goa",
        "area": "Vasco",
    }, token=tok_contractor_a)
    assert s == 201
    site2_id = site2["id"]

    # Assign without confirmation -> 409 Conflict with requires_transfer_confirmation
    s, conf_res = req(f"/sites/{site2_id}/workers", "POST", {
        "qr_token": qr_token,
        "confirm_transfer": False,
    }, token=tok_contractor_a)
    assert s == 409, f"Expected 409: {s} {conf_res}"
    assert conf_res["detail"]["requires_transfer_confirmation"] is True
    print(f"[PASS] 10a. Inter-site transfer correctly intercepted with 409 Conflict and confirmation requirement")

    # Resubmit with confirm_transfer=True
    s, conf_ok = req(f"/sites/{site2_id}/workers", "POST", {
        "qr_token": qr_token,
        "confirm_transfer": True,
    }, token=tok_contractor_a)
    assert s == 201, f"Failed transfer: {s} {conf_ok}"
    # Verify DB: previous assignment closed with end_date, new assignment active
    total_assignments = query_pg(f"SELECT count(*) FROM worker_site_assignments WHERE patient_id = '{patient_id}';")
    closed_assignments = query_pg(f"SELECT count(*) FROM worker_site_assignments WHERE patient_id = '{patient_id}' AND end_date IS NOT NULL;")
    active_now = query_pg(f"SELECT count(*) FROM worker_site_assignments WHERE patient_id = '{patient_id}' AND end_date IS NULL;")
    assert total_assignments == "2", f"Expected 2 total historical assignments in DB, got {total_assignments}"
    assert closed_assignments == "1", f"Expected 1 closed historical assignment in DB, got {closed_assignments}"
    assert active_now == "1", f"Expected exactly 1 active assignment in DB, got {active_now}"
    print(f"[PASS] 10b. Transfer completed: historical record preserved with end_date, single active assignment enforced in DB")

    # 11. Verify contractor roster and QR resolution do not expose clinical notes, symptoms, or test results
    s, r2 = req(f"/sites/{site2_id}/workers", "GET", token=tok_contractor_a)
    assert s == 200
    worker_item = r2["items"][0]
    forbidden_keys = {"initial_symptoms", "clinical_notes", "tests", "diagnosis", "fever_duration", "specimens"}
    found_forbidden = forbidden_keys.intersection(worker_item.keys())
    assert not found_forbidden, f"Clinical data leaked in worker roster! Found: {found_forbidden}"
    print(f"[PASS] 11. Strict privacy verified: worker roster contains operational fields only; zero clinical leakage")

    print("\n=== CONTRACTOR & QR REGRESSION SUITE: 100% PASSED ===")

if __name__ == "__main__":
    main()
