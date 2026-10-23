"""Release-validation gap harness — supplemental HTTP tests on the disposable stack.

Covers workflows not exercised by scripts/verify_e2e_lan.py:
case acknowledgement, audit-events paging, sample/species validation negatives,
follow-up validation negatives, CORS preflight, database_mode=none 503 honesty,
login lockout (LAST — it locks a disposable-seeded account on purpose).

Runs against disposable APIs only:
  api     -> GAP_API_URL      (default http://localhost:8004/api/v1,  mode=postgres)
  api-none-> GAP_NONE_API_URL (default http://localhost:8005/api/v1,  mode=none)

No tokens/credentials are printed. Synthetic data only.
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = os.environ.get("GAP_API_URL", "http://localhost:8004/api/v1")
NONE_BASE = os.environ.get("GAP_NONE_API_URL", "http://localhost:8005/api/v1")
PIN = os.environ.get("GAP_PIN", "2468")  # repo seed.py fixture PIN (disposable DB)

RESULTS = []
FAILURES = []

def check(name, ok, extra=""):
    RESULTS.append((name, ok))
    line = f"PASS: {name}" if ok else f"FAIL: {name}"
    if extra:
        line += f" ({extra})"
    print(line)
    if not ok:
        FAILURES.append(name)

def req(base, path, method="GET", body=None, token=None, headers=None):
    h = dict(headers or {})
    if token:
        h["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    if data:
        h.setdefault("Content-Type", "application/json")
    r = urllib.request.Request(base + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as resp:
            payload = resp.read()
            try:
                return resp.status, json.loads(payload) if payload else dict(resp.headers)
            except Exception:
                return resp.status, dict(resp.headers)
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload) if payload else {}
        except Exception:
            return e.code, {}

def login(phone):
    status, res = req(BASE, "/auth/login", "POST", {"phone": phone, "pin": PIN})
    if status != 200:
        return None, None
    return res["access_token"], res["user"]

def main():
    # ---- auth/session negatives -------------------------------------------
    s, _ = req(BASE, "/dashboard", token="not-a-real-token")
    check("garbage bearer token rejected with 401", s == 401, f"HTTP {s}")

    phone = "+919000000001"
    worker, _ = login(phone)
    check("worker login succeeds (disposable seed)", worker is not None)

    clinician_token, clinician_user = login("+919000000002")
    pathologist_token, _ = login("+919000000003")
    health_token, _ = login("+919000000004")
    lab_token, _ = login("+919000000005")
    contractor_token, _ = login("+919000000006")
    admin_token, _ = login("+919000000007")
    check("all 7 disposable-seed roles authenticate", all(
        t is not None for t in [worker, clinician_token, pathologist_token,
                                health_token, lab_token, contractor_token, admin_token]))

    # fresh synthetic worker (role account + profile) for negative-write tests
    gap_mobile = f"+9198{int(__import__('time').time()) % 100000000:08d}"
    s, signup = req(BASE, "/auth/signup", "POST",
                    {"phone": gap_mobile, "pin": PIN, "display_name": "Gap Coverage Synthetic",
                     "role": "worker"})
    check("fresh worker signup -> 201 with profile", s == 201 and bool(signup.get("user", {}).get("patient_id")),
          f"HTTP {s}")
    patient_id = (signup.get("user") or {}).get("patient_id")
    worker = signup.get("access_token")

    # ---- case acknowledgement (worker symptom report -> case -> ack) -------
    s, case_res = req(BASE, "/symptom-reports", "POST",
                      {"symptoms": ["fever"], "onset_category": "1_3_days",
                       "description": "synthetic gap harness report",
                       "client_request_id": f"gapcase_{int(__import__('time').time())}"},
                      token=worker)
    check("worker symptom report -> 201 creates case", s == 201, f"HTTP {s}")
    s, cases = req(BASE, "/cases?status=awaiting_clinical_review", token=clinician_token)
    awaiting = [c for c in (cases.get("items") or []) if c.get("status") == "awaiting_clinical_review"]
    check("case routed to clinician queue as awaiting_clinical_review", len(awaiting) >= 1,
          f"HTTP {s} total={cases.get('total')}")
    if awaiting:
        cid = awaiting[0]["id"]
        s, res = req(BASE, f"/cases/{cid}/acknowledge", "POST", token=clinician_token)
        check("clinician acknowledges case -> 200, status=assigned",
              s == 200 and res.get("status") == "assigned", f"HTTP {s}")
        s, res2 = req(BASE, f"/cases/{cid}/acknowledge", "POST", token=clinician_token)
        check("re-acknowledge of non-awaiting case rejected (409)", s == 409, f"HTTP {s}")
        s, _ = req(BASE, f"/cases/{cid}/acknowledge", "POST", token=worker)
        check("worker cannot acknowledge case (403)", s == 403, f"HTTP {s}")
        s, _ = req(BASE, f"/cases/{cid}/acknowledge", "POST", token=health_token)
        check("health_worker cannot acknowledge case (403)", s == 403, f"HTTP {s}")
        st_in, detail = req(BASE, f"/cases/{cid}", token=clinician_token)
        check("acknowledged case persists status=assigned (DB-backed read)",
              st_in == 200 and detail.get("status") == "assigned", f"HTTP {st_in}")
    s, _ = req(BASE, "/cases/nonexistent-id/acknowledge", "POST", token=clinician_token)
    check("acknowledge unknown case id -> 404", s == 404, f"HTTP {s}")

    # ---- assessment identity negatives ------------------------------------
    s, _ = req(BASE, "/assessments", "POST",
               {"patient_id": "nonexistent-uuid", "symptoms": ["fever"],
                "assessment": "test"}, token=clinician_token)
    check("assessment for unknown patient identity rejected", s in (404, 422), f"HTTP {s}")

    # ---- sample/species validation negatives (must not persist) ----------
    if patient_id:
        base_sample = {
            "patient_id": patient_id, "method": "rdt", "result_status": "negative",
            "test_date": "2026-10-23",
        }
        s, _ = req(BASE, "/samples", "POST",
                   {**base_sample, "result_status": "positive", "species": None},
                   token=pathologist_token)
        check("positive sample without species rejected (422)", s == 422, f"HTTP {s}")
        s, _ = req(BASE, "/samples", "POST",
                   {**base_sample, "result_status": "positive", "species": "other"},
                   token=pathologist_token)
        check("species=other without description rejected (422)", s == 422, f"HTTP {s}")
        s, _ = req(BASE, "/samples", "POST",
                   {**base_sample, "smear_type": "thick"},
                   token=pathologist_token)
        check("smear_type with method=rdt rejected (422)", s == 422, f"HTTP {s}")
        s, _ = req(BASE, "/samples", "POST",
                   {**base_sample}, token=pathologist_token)
        check("valid baseline sample accepted (201)", s == 201, f"HTTP {s}")
        s, samples = req(BASE, f"/samples?patient_id={patient_id}", token=pathologist_token)
        created = (samples.get("items") or samples.get("samples") or []) if isinstance(samples, dict) else []
        check("rejections created zero extras; exactly the 1 valid sample persisted",
              len(created) == 1, f"items={len(created)}")

        # follow-up validation negatives
        s, _ = req(BASE, "/follow-ups", "POST",
                   {"patient_id": patient_id, "due_date": "31-12-2026",
                    "assigned_user_id": clinician_user["id"]}, token=clinician_token)
        check("follow-up invalid due_date format rejected (422)", s == 422, f"HTTP {s}")
        s, _ = req(BASE, "/follow-ups", "POST",
                   {"patient_id": patient_id, "due_date": "2026-10-30"}, token=clinician_token)
        check("follow-up without assigned health worker rejected (422)", s == 422, f"HTTP {s}")
        s, fw = req(BASE, f"/follow-ups?patient_id={patient_id}", token=clinician_token)
        created_fw = (fw.get("items") or []) if isinstance(fw, dict) else []
        check("no follow-ups persisted after rejected writes", len(created_fw) == 0,
              f"items={len(created_fw)}")

    # ---- contractor data-boundary -----------------------------------------
    s, _ = req(BASE, f"/patients/{patient_id}" if patient_id else "/patients/x", token=contractor_token)
    check("contractor blocked from clinical detail view", s in (403, 404), f"HTTP {s}")

    # ---- audit-events RBAC + paging ----------------------------------------
    s, audit = req(BASE, "/audit-events?limit=5&offset=0", token=admin_token)
    ok = s == 200 and isinstance(audit.get("items"), list) and len(audit["items"]) <= 5 and "total" in audit
    check("admin audit-events paging (limit=5) works", ok, f"HTTP {s} total={audit.get('total')}")
    s2, audit2 = req(BASE, "/audit-events?limit=5&offset=5", token=admin_token)
    diff = audit["items"] and audit2["items"] and audit["items"][0]["id"] != audit2["items"][0]["id"]
    check("audit-events offset=5 returns a different page", bool(diff))
    s, _ = req(BASE, "/audit-events", token=clinician_token)
    check("clinician cannot read audit trail (403)", s == 403, f"HTTP {s}")
    s, _ = req(BASE, "/audit-events", "POST", {"action": "x"}, token=admin_token)
    check("audit trail has no write route (403/405)", s in (403, 405), f"HTTP {s}")

    # ---- CORS preflight on the isolated API --------------------------------
    s, hdr = req(BASE, "/auth/login", "OPTIONS", headers={
        "Origin": "http://localhost:5174",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"})
    check("CORS preflight from ISOLATED console origin 5174 allowed",
          s == 200 and hdr.get("access-control-allow-origin") == "http://localhost:5174"
          and hdr.get("access-control-allow-credentials") == "true",
          f"HTTP {s} origin={hdr.get('access-control-allow-origin')}")
    s, hdr = req(BASE, "/auth/login", "OPTIONS", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST"})
    check("CORS preflight from shared-console 5173 origin REJECTED",
          s == 400 and hdr.get("access-control-allow-origin") is None,
          f"HTTP {s} origin_hdr={hdr.get('access-control-allow-origin')}")

    # ---- database-disabled mode honesty (api-none on :8005) ---------------
    s, h = req(NONE_BASE, "/health")
    check("none-mode /health works with validation_only flag",
          s == 200 and h.get("validation_only") is True, f"HTTP {s} flag={h.get('validation_only')}")
    s, res = req(NONE_BASE, "/questionnaires/submit", "POST", {"personal": {}}, token=worker)
    db_ans = res.get("detail") in (503,) or s == 503
    check("none-mode questionnaire submit -> 503 database_disabled",
          s == 503 and "database" in json.dumps(res).lower(), f"HTTP {s}")
    s, _ = req(NONE_BASE, "/auth/login", "POST", {"phone": "+919000000001", "pin": PIN})
    check("none-mode login -> 503 (no fabricated session)", s == 503, f"HTTP {s}")
    s, _ = req(NONE_BASE, "/workers?limit=5", token=worker)
    check("none-mode authenticated read -> 503", s == 503, f"HTTP {s}")
    s, res = req(NONE_BASE, "/validate-questionnaire", "POST", {"personal": {"full_name": "None Mode Probe"}})
    check("none-mode db-free questionnaire validation works", s in (200, 422), f"HTTP {s}")

    # ---- login lockout (LAST: locks the disposable admin account) ---------
    lock_phone = "+919000000008"
    s2, st = req(BASE, "/auth/login", "POST", {"phone": lock_phone, "pin": PIN})
    if s2 not in (200,):
        lock_phone = "+919000000007"  # disposable seed admin if 008 absent
    for i in range(5):
        req(BASE, "/auth/login", "POST", {"phone": lock_phone, "pin": "0000"})
    s, res = req(BASE, "/auth/login", "POST", {"phone": lock_phone, "pin": PIN})
    check("correct PIN rejected while account locked (uniform 401)", s == 401, f"HTTP {s}")

    print()
    print(f"== {sum(1 for _, ok in RESULTS if ok)}/{len(RESULTS)} gap checks passed ==")
    if FAILURES:
        print("FAILED:", ", ".join(FAILURES))
        sys.exit(1)

if __name__ == "__main__":
    main()
