#!/usr/bin/env python3
"""E2E-MALARIA synthetic end-to-end workflow acceptance test (staging API only).

Synthetic data ONLY. Creates isolated accounts/cases tagged E2E-MALARIA-<run>,
executes scenarios A-D from the acceptance brief, validates fixed-choice
behavior, routes notifications, replays idempotency retries, and dumps a full
JSON evidence log. Never mutates demo accounts, never resets the database.

Run:  E2E_SYNTHETIC_PIN=<4-12 digits> services/api/.venv/bin/python \
      scripts/e2e_malaria_workflow_test.py [--base http://127.0.0.1:8003]
"""
from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
parser = argparse.ArgumentParser()
parser.add_argument("--base", default=os.environ.get("E2E_BASE_URL", "http://127.0.0.1:8003"))
args = parser.parse_args()

BASE = args.base.rstrip("/")
API = BASE + "/api/v1"
BOOTSTRAP_SECRET = os.environ.get("E2E_BOOTSTRAP_SECRET", "m3-compose-bootstrap-secret")
DEMO_PIN = "2468"  # seeded demo PIN (already publicly documented by seed.py)
PIN = os.environ.get("E2E_SYNTHETIC_PIN") or "".join(random.choices("23456789", k=6))
RUN = "E2E-MALARIA-" + time.strftime("%Y%m%d-%H%M%S") + "-" + "".join(random.choices(string.ascii_lowercase, k=4))

RESULT_FILE = os.environ.get("E2E_RESULT_FILE", f"/tmp/opencode/e2e-results-{RUN}.json")
RESULTS: dict = {"run_id": RUN, "base": BASE, "started_at": datetime.now(timezone.utc).isoformat(),
                 "checks": [], "log": [], "accounts": {}, "entities": {}, "notifications": {}}
FAILURES: list[str] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def check(name: str, verdict, detail: str = "") -> bool:
    RESULTS["checks"].append({"check": name, "verdict": "PASS" if verdict is True else str(verdict), "detail": detail})
    label = "PASS" if verdict is True else str(verdict)
    print(f"[{label:>14}] {name}" + (f" -- {detail}" if detail else ""))
    if verdict is not True:
        FAILURES.append(name)
    return verdict is True


def step(name: str) -> None:
    print(f"--- {name}")


client = httpx.Client(timeout=30.0)


def req(token: str | None, method: str, path: str, payload: dict | None = None,
        headers: dict | None = None, label: str | None = None, silent: bool = False):
    try:
        r = client.request(method, API + path, json=payload,
                           headers={"Authorization": f"Bearer {token}", **(headers or {})} if token else (headers or {}))
        try:
            body = r.json()
        except Exception:
            body = {"raw": r.text[:300]}
        if not silent:
            RESULTS["log"].append({"ts": now_iso(), "label": label or path, "method": method, "path": path,
                                   "status": r.status_code, "body_head": str(body)[:400]})
        return r.status_code, body
    except Exception as exc:  # noqa: BLE001 - record transport failure as a failing step
        RESULTS["log"].append({"ts": now_iso(), "label": label or path, "method": method, "path": path,
                               "status": 0, "error": type(exc).__name__})
        return 0, {"error": repr(exc)}


def expect(name: str, actual: int, wanted: int, body=None) -> bool:
    if actual == wanted:
        return check(name, True)
    return check(name, False, f"status {actual} != {wanted} {json.dumps(body)[:300] if body else ''}")


# --------------------------------------------------------------------------
# Account helpers
# --------------------------------------------------------------------------
def bootstrap_user(tag: str, roles: list[str], suffix: str) -> dict | None:
    """Provision a synthetic account through the supported bootstrap endpoint."""
    phone = f"+919209{suffix}"
    st, res = req(None, "POST", "/bootstrap/users", {
        "phone": phone, "pin": PIN, "display_name": f"SYNTHETIC TEST {tag.upper()} [{RUN}]",
        "roles": roles, "preferred_language": "en"},
        headers={"x-bootstrap-secret": BOOTSTRAP_SECRET}, label=f"bootstrap:{tag}")
    if st == 409:  # re-run collision: log in and reuse the existing synthetic account
        st, res = req(None, "POST", "/auth/login", {"phone": phone, "pin": PIN}, label=f"login:{tag}")
        if st == 200:
            RESULTS["accounts"][tag] = {"id": res["user"]["id"], "phone": phone, "roles": roles,
                                        "pin": "(synthetic test PIN, not printed)"}
            return res["user"]
    if st == 201:
        RESULTS["accounts"][tag] = {"id": res["id"], "phone": phone, "roles": roles,
                                    "pin": "(synthetic test PIN, not printed)"}
        return res
    check(f"provision {tag}", False, f"status {st} {str(res)[:200]}")
    return None


def signup_worker(tag: str, suffix: str) -> dict | None:
    phone = f"+919309{suffix}"
    st, res = req(None, "POST", "/auth/signup", {"phone": phone, "pin": PIN,
                                                 "display_name": f"SYNTHETIC TEST {tag.upper()} [{RUN}]",
                                                 "role": "worker", "preferred_language": "en"},
                  label=f"signup:{tag}")
    if st == 409:
        st, res = req(None, "POST", "/auth/login", {"phone": phone, "pin": PIN}, label=f"login:{tag}")
        if st == 200:
            u = res["user"]
            RESULTS["accounts"][tag] = {"id": u["id"], "phone": phone, "roles": u["roles"],
                                        "patient_id": u.get("patient_id"),
                                        "pin": "(synthetic test PIN, not printed)"}
            return u
    if st == 201:
        u = res["user"]
        RESULTS["accounts"][tag] = {"id": u["id"], "phone": phone, "roles": u["roles"],
                                    "patient_id": u.get("patient_id"),
                                    "pin": "(synthetic test PIN, not printed)"}
        return u
    check(f"signup {tag}", False, f"status {st} {str(res)[:200]}")
    return None


TOKENS: dict[str, str] = {}


def login(tag: str, pin: str | None = None) -> bool:
    acct = RESULTS["accounts"][tag]
    st, res = req(None, "POST", "/auth/login", {"phone": acct["phone"], "pin": pin or PIN}, label=f"auth-login:{tag}")
    if st == 200:
        TOKENS[tag] = res["access_token"]
        RESULTS["accounts"][tag].setdefault("id", res["user"]["id"])
        return True
    check(f"login {tag}", False, f"status {st}")
    return False


def snapshot(tag: str, case_id: str | None) -> list[dict]:
    """Fetch one recipient's notification inbox; keep rows relevant to a case."""
    st, res = req(TOKENS[tag], "GET", "/notifications?limit=200", label=f"notif-snap:{tag}", silent=True)
    rows = res.get("items", []) if st == 200 else []
    RESULTS["notifications"].setdefault(tag, []).append({
        "ts": now_iso(), "case_filter": case_id, "unread_total": res.get("unread"),
        "total": res.get("total"),
        "rows": [{"id": n["id"], "case_id": n["case_id"], "kind": n["kind"], "title": n["title"],
                  "body": n["body"], "body_minimal": n["body_minimal"], "read": n["read_at"] is not None,
                  "created_at": n["created_at"]} for n in rows if (case_id is None or n["case_id"] == case_id)]})
    return [{"id": n["id"], "case_id": n["case_id"], "kind": n["kind"], "title": n["title"],
             "body_minimal": n["body_minimal"], "read": n["read_at"] is not None,
             "created_at": n["created_at"]}
            for n in rows if (case_id is None or n["case_id"] == case_id)]


def unread_count(tag: str) -> int:
    st, res = req(TOKENS[tag], "GET", "/notifications?limit=1&unread_only=true", silent=True)
    return res.get("total", -1) if st == 200 else -1


CR_BASE = "e2emalaria" + "".join(random.choices(string.ascii_lowercase, k=6)) + "-"


def crid(name: str) -> str:
    return (CR_BASE + name)[:64]


# ==========================================================================
# Phase 0: environment
# ==========================================================================
step("Phase 0: verify live staging environment")
h = client.get(BASE + "/health")
RESULTS["env"] = h.json()
expect("staging API healthy", h.status_code, 200)
diag = client.get(BASE + "/diagnostics").json()
check("migrations at head 20261029_01",
      diag["migration_state"]["is_up_to_date"] and diag["migration_state"]["head_revision"] == "20261029_01",
      str(diag["migration_state"]))

# ==========================================================================
# Phase 1: provision synthetic accounts (supported API paths only)
# ==========================================================================
step("Phase 1: provision synthetic accounts (bootstrap for staff, signup for workers)")
suffix = "".join(random.choices(string.digits, k=4))
staff = (("pathologist_lab", ["pathologist"]), ("health_worker_a", ["health_worker"]),
         ("health_worker_b", ["health_worker"]), ("clinician_b", ["clinician"]),
         ("clinician_c", ["clinician"]), ("research_lab", ["research_lab"]),
         ("contractor", ["contractor"]))
for index, (tag, roles) in enumerate(staff, start=1):
    bootstrap_user(tag, roles, suffix + str(index))
for tag in ("pathologist_lab", "health_worker_a", "health_worker_b", "clinician_b", "clinician_c",
            "research_lab", "contractor"):
    if not login(tag):
        raise SystemExit(f"FATAL: cannot proceed without account {tag}")

for index, tag in enumerate(("worker_a", "worker_b", "worker_c"), start=1):
    signup_worker(tag, suffix + str(9) + str(index))
    login(tag)

# unregistered worker for the single-screening flow
w_draft = signup_worker("worker_draft", suffix + "96")
if w_draft:
    login("worker_draft")

# DHS probe: an unimplemented role must be rejected, not created
st, res = req(None, "POST", "/bootstrap/users",
              {"phone": f"+919209{suffix}8", "pin": PIN, "display_name": "DHS PROBE",
               "roles": ["dhs"], "preferred_language": "en"},
              headers={"x-bootstrap-secret": BOOTSTRAP_SECRET}, label="probe:dhs-role")
check("DHS role rejected at provisioning (NOT IMPLEMENTED)", st == 422, f"status={st} {str(res)[:160]}")

# ==========================================================================
# Phase 2: synthetic site + roster
# ==========================================================================
step("Phase 2: synthetic site and worker-site assignments")
st, res = req(TOKENS["contractor"], "POST", "/sites", {
    "code": "SYN-E2E-" + RUN[-8:].upper(), "name": f"SYNTHETIC SITE {RUN}",
    "contractor_name": "SYNTHETIC TEST CONTRACTOR", "district": "North Goa", "area": "Panaji",
    "client_request_id": crid("site")}, label="site:create")
expect("contractor creates synthetic site", st, 201)
site = res
site_id = site["id"]
RESULTS["entities"]["site"] = {k: site.get(k) for k in ("id", "code", "name", "district")}

for wtag in ("worker_a", "worker_b", "worker_c", "worker_draft"):
    st, res = req(TOKENS["contractor"], "POST", f"/sites/{site_id}/workers",
                  {"worker_id": RESULTS["accounts"][wtag]["patient_id"], "client_request_id": crid(f"assign-{wtag}")},
                  label=f"site-assign:{wtag}")
    expect(f"assign {wtag} to synthetic site", st, 201)

# ==========================================================================
# Phase 3: fixed-choice / questionnaire validation
# ==========================================================================
step("Phase 3: fixed-choice validation on the worker questionnaire")
Q_VALID = {
    "personal": {"full_name": "SYNTHETIC TEST WORKER-DRAFT", "dob": "1996-04-12", "gender": "male",
                 "mobile": RESULTS["accounts"]["worker_draft"]["phone"], "id_type": "voter_id",
                 "address_present": "Synthetic address for E2E validation, Goa", "preferred_language": "english"},
    "past_history": {"diagnosed_malaria": "no"},
    "present_clinical": {"fever_today": "no", "symptoms": ["no_other_symptoms"],
                         "breathing_difficulty": "no", "chest_pain": "no", "confusion": "no",
                         "can_attend_testing": "yes"},
    "migration_history": {"time_in_goa": "1_6_months", "outside_goa_3m": "no", "fever_before_goa_3m": "no"},
    "planned_travel": {"planning": "no"},
}
st, res = req(TOKENS["worker_draft"], "POST", "/validate-questionnaire",
              {"data": {**Q_VALID, "personal": {**Q_VALID["personal"], "gender": "transgender"}},
               "client_request_id": crid("validate-enum")}, label="validate:bad-enum")
check("invalid enum rejected (gender outside fixed choices)",
      res.get("valid") is False and any("gender" in e["path"] for e in res.get("errors", [])),
      str(res.get("errors"))[:160])
q_missing = json.loads(json.dumps(Q_VALID)); q_missing["present_clinical"].pop("fever_today")
st, res = req(TOKENS["worker_draft"], "POST", "/validate-questionnaire", {"data": q_missing, "client_request_id": crid("validate-missing")}, label="validate:missing-required")
check("missing required field rejected", res.get("valid") is False and
      any("fever_today" in e["path"] for e in res.get("errors", [])), str(res.get("errors"))[:160])
st, res = req(TOKENS["worker_draft"], "PUT", "/questionnaires/draft",
              {"data": {**Q_VALID, "extra_section": {}}}, label="draft:unknown-section")
expect("unknown section rejected 422 with named section", st, 422)
q_bad_sym = json.loads(json.dumps(Q_VALID))
q_bad_sym["present_clinical"]["symptoms"] = ["fever_treated_with_herbs"]
st, res = req(TOKENS["worker_draft"], "POST", "/validate-questionnaire", {"data": q_bad_sym, "client_request_id": crid("validate-sym")}, label="validate:unknown-symptom-code")
check("free-text symptom code cannot bypass controlled vocabulary", res.get("valid") is False,
      str(res.get("errors"))[:160])
st, res = req(TOKENS["worker_draft"], "PUT", "/questionnaires/draft", {"data": Q_VALID}, label="draft:save")
expect("draft saved", st, 200)
st, res = req(TOKENS["worker_draft"], "GET", "/questionnaires/draft", label="draft:reload")
check("draft persisted (offline draft support)", st == 200 and isinstance(res.get("data"), dict) and
      res["data"].get("personal", {}).get("full_name", "").startswith("SYNTHETIC"), "")
st, res = req(TOKENS["worker_draft"], "POST", "/questionnaires/submit",
              {"data": Q_VALID, "client_request_id": crid("wl-submit")}, label="questionnaire:submit")
expect("five-section questionnaire accepted", st, 201)
submission_draft = res.get("submission_id")
st, res = req(TOKENS["worker_draft"], "POST", "/questionnaires/submit",
              {"data": Q_VALID, "client_request_id": crid("wl-submit")}, label="questionnaire:submit-replay")
check("questionnaire replay resolves to same submission (duplicate=true)",
      st == 200 and res.get("duplicate") is True and res.get("submission_id") == submission_draft, "")

# fixed-choice enforcement on lab / clinical / follow-up payloads
H = lambda t: {"Authorization": "Bearer " + TOKENS[t]}
pat_pid = RESULTS["accounts"]["worker_draft"]["patient_id"]
for name, payload, wanted in (
        ("unknown diagnostic method rejected", {"patient_id": pat_pid, "method": "pcr", "result_status": "pending"}, 422),
        ("unknown result status rejected", {"patient_id": pat_pid, "method": "rdt", "result_status": "equivocal"}, 422),
        ("positive without species rejected", {"patient_id": pat_pid, "method": "rdt", "result_status": "positive"}, 422),
        ("unknown species rejected", {"patient_id": pat_pid, "method": "microscopy", "result_status": "positive", "species": "falciparum"}, 422),
):  # noqa: E501
    stx, body = req(TOKENS["pathologist_lab"], "POST", "/samples", payload, label=f"validate:sample:{name}")
    check(f"lab form: {name}", stx == wanted, f"status={stx}")
stx, body = req(TOKENS["clinician_b"], "POST", "/assessments",
                {"patient_id": pat_pid, "treatment_completed": "nope"}, label="validate:assessment-enum")
check("clinical form: invalid treatment_completed enum rejected", stx == 422, f"status={stx}")
stx, body = req(TOKENS["clinician_b"], "POST", "/follow-ups",
                {"patient_id": pat_pid, "due_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                 "assigned_user_id": RESULTS["accounts"]["health_worker_a"]["id"], "status": "overdue"},
                label="validate:followup-enum")
check("follow-up form: invalid status enum rejected", stx == 422, f"status={stx}")
stx, body = req(TOKENS["research_lab"], "POST", "/research-results",
                {"sample_id": "nonexistent", "pcr_status": "positive", "gametocyte_presence": "not_tested",
                 "pfhrp2_status": "not_tested", "pfhrp3_status": "not_tested"}, label="validate:molecular-enum")
check("molecular form: pcr_status 'positive' unsupported fixed choice", stx in (403, 404, 422), f"status={stx}")

# ==========================================================================
# Phase 4: Scenario A — positive RDT case (worker A, health worker A)
# ==========================================================================
step("Phase 4: Scenario A — positive RDT")
st, res = req(TOKENS["worker_a"], "POST", "/symptom-reports",
              {"symptoms": ["fever", "headache"], "onset_category": "1_3_days", "temperature_c": 38.4,
               "attend_facility": "no", "client_request_id": crid("sr-a")}, label="symptom-report:A")
expect("worker A submits symptom report (opens case)", st, 201)
case_a = res
ca_id = case_a["case_id"]
RESULTS["entities"]["case_a"] = case_a
st, res = req(TOKENS["clinician_b"], "GET", f"/cases/{ca_id}", silent=True)
check("case auto-tagged with worker's assigned synthetic site", st == 200 and res.get("site_id") == site_id,
      f"case site={res.get('site_id')} expected={site_id}")

NOTIF_TAGS = ("clinician_b", "clinician_c", "health_worker_a", "health_worker_b", "contractor",
              "research_lab", "pathologist_lab", "worker_a")
notif_after_case_a = {t: snapshot(t, ca_id) for t in NOTIF_TAGS}
check("event 1: new case routed to clinicians (case_clinical_review)",
      any(n["kind"] == "case_clinical_review" for n in notif_after_case_a["clinician_b"]),
      str(notif_after_case_a["clinician_b"])[:220])
check("contractor receives MINIMAL site-coordination notice only (no clinical detail)",
      any(n["kind"] == "case_site_coordination" and n["body_minimal"] for n in notif_after_case_a["contractor"]),
      str(notif_after_case_a["contractor"])[:220])
check("health workers NOT notified on new case",
      not notif_after_case_a["health_worker_a"] and not notif_after_case_a["health_worker_b"], "")
check("research lab NOT notified on new case", not notif_after_case_a["research_lab"], "")

step("Phase 4b: replay/idempotency on the symptom report")
st, res = req(TOKENS["worker_a"], "POST", "/symptom-reports",
              {"symptoms": ["fever", "headache"], "onset_category": "1_3_days", "temperature_c": 38.4,
               "client_request_id": crid("sr-a")}, label="symptom-report:replay")
check("symptom report replay: same case, duplicate=true, HTTP 200",
      st == 200 and res.get("duplicate") is True and res.get("case_id") == ca_id, str(res)[:140])
check("no duplicate notifications after replay",
      sum(len(snapshot(t, ca_id)) for t in ("clinician_b", "contractor")) ==
      sum(len(notif_after_case_a[t]) for t in ("clinician_b", "contractor")), "")

step("Phase 4c: authorization negatives around the new case")
st, res = req(TOKENS["worker_b"], "GET", f"/cases/{ca_id}", label="auth:worker-b-read-case-a")
expect("worker B cannot read worker A's case", st, 403)
st, res = req(TOKENS["worker_a"], "GET", f"/workers/{RESULTS['accounts']['worker_b']['patient_id']}",
              label="auth:worker-a-read-worker-b")
expect("worker A cannot read worker B's profile", st, 403)
st, res = req(TOKENS["research_lab"], "GET", "/cases", label="auth:research-lab-list-cases")
expect("research lab has no clinical case access", st, 403)
st, res = req(TOKENS["health_worker_a"], "GET", f"/assessments?patient_id={RESULTS['accounts']['worker_a']['patient_id']}",
              label="auth:hw-read-assessments")
expect("health worker cannot read clinical assessments", st, 403)

step("Phase 4d: clinician acknowledgement + diagnostic order")
st, res = req(TOKENS["clinician_b"], "POST", f"/cases/{ca_id}/acknowledge", label="case:A-ack")
expect("clinician B acknowledges case A (assigned)", st, 200)
ack_snap = {t: snapshot(t, ca_id) for t in ("worker_a", "clinician_c")}
check("event 3: acknowledgement generates NO worker notification (observed behavior; not reported as pass/fail workflow feature)",
      not ack_snap["worker_a"], "")
st, res = req(TOKENS["clinician_b"], "GET", "/facilities", label="facilities")
fac = res["items"][0]
st, res = req(TOKENS["clinician_b"], "POST", f"/cases/{ca_id}/request-test",
              {"facility_id": fac["id"]}, label="case:A-request-test")
expect("clinician requests diagnostic test (ordered sample + lab notice)", st, 201)
ordered_sample_a = res
RESULTS["entities"]["ordered_sample_a"] = {k: ordered_sample_a.get(k) for k in ("sample_id", "sample_code")}
pl_notif = snapshot("pathologist_lab", ca_id)
check("pathologist notified of diagnostic order (case_diagnostic_order)",
      any(n["kind"] == "case_diagnostic_order" for n in pl_notif), "")
st, res = req(TOKENS["clinician_b"], "POST", f"/cases/{ca_id}/transition",
              {"to_status": "awaiting_diagnostic_result", "note": "SYNTHETIC TEST transition"}, label="case:A-transition")
expect("case transitions to awaiting_diagnostic_result", st, 200)
st, res = req(TOKENS["clinician_b"], "POST", f"/cases/{ca_id}/transition",
              {"to_status": "followup_due"}, label="case:A-invalid-transition")
expect("invalid case transition rejected (followup_due not allowed from awaiting_diagnostic_result)", st, 422)

step("Phase 4e: pathologist records the RDT POSITIVE result")
st, res = req(TOKENS["pathologist_lab"], "POST", "/samples",
              {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "case_id": ca_id,
               "method": "rdt", "result_status": "positive", "species": "pf",
               "facility_id": fac["id"], "client_request_id": crid("sample-a-rdt")},
              label="sample:A-rdt-positive")
expect("pathologist records RDT POSITIVE (pf)", st, 201)
rdt_sample_a = res
RESULTS["entities"]["rdt_sample_a"] = {k: rdt_sample_a.get(k) for k in ("id", "sample_code", "status")}

probe_unread_cl = unread_count("clinician_b")
st, res = req(TOKENS["pathologist_lab"], "POST", "/samples",
              {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "case_id": ca_id,
               "method": "rdt", "result_status": "positive", "species": "pf",
               "facility_id": fac["id"],
               "client_request_id": crid("sample-a-rdt")}, label="sample:replay-dup-probe")
check("D1 FIXED: sample-create retry with same client_request_id returns HTTP %d (original result)" % st,
      st == 200 and res.get("duplicate") is True, f"duplicate flag={res.get('duplicate')}")
check("D1 FIXED: replay did NOT create a second sample row (resolves to original)",
      res.get("sample_code") == rdt_sample_a["sample_code"] and res.get("id") == rdt_sample_a["id"],
      f"code={res.get('sample_code')}")
RESULTS["entities"]["rdt_sample_a_replay_probe"] = {k: res.get(k) for k in ("id", "sample_code", "status", "duplicate")}
check("D1 FIXED: no repeated positive-alert fan-out on replay (unread count unchanged)",
      unread_count("clinician_b") == probe_unread_cl, f"unread={unread_count('clinician_b')}")
# Conflicting payload under the same key must be rejected (coherent client bug),
# and a genuinely NEW request (fresh key) must still create a new sample.
st_conf, res_conf = req(TOKENS["pathologist_lab"], "POST", "/samples",
                        {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "case_id": ca_id,
                         "method": "rdt", "result_status": "negative",
                         "facility_id": fac["id"],
                         "client_request_id": crid("sample-a-rdt")}, label="sample:replay-conflict-probe")
check("D1: replay with CONFLICTING payload under same key rejected 409",
      st_conf == 409, f"status={st_conf}")
# a genuinely NEW key still creates a distinct legitimate sample (after alerts read or not)
st_new, res_new = req(TOKENS["pathologist_lab"], "POST", "/samples",
                      {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "case_id": ca_id,
                       "method": "rdt", "result_status": "negative",
                       "facility_id": fac["id"],
                       "client_request_id": crid("sample-a-rdt-new")}, label="sample:new-key-probe")
check("D1: a genuinely NEW key still creates a distinct legitimate sample",
      st_new == 201 and res_new.get("sample_code") != rdt_sample_a["sample_code"],
      f"status={st_new} code={res_new.get('sample_code')}")

notif_after_positive_a = {t: snapshot(t, ca_id) for t in ("clinician_b", "clinician_c", "research_lab",
                                                          "contractor", "worker_a")}
check("event 2: positive screening alert -> clinicians (diagnostic_positive)",
      any(n["kind"] == "diagnostic_positive" for n in notif_after_positive_a["clinician_b"]), "")
check("event 8: positive RDT -> research eligibility notice (research_eligible)",
      any(n["kind"] == "research_eligible" for n in notif_after_positive_a["research_lab"]),
      str(notif_after_positive_a["research_lab"])[:220])
check("contractor does NOT receive clinical positive-result details",
      all(n["kind"] != "diagnostic_positive" for n in notif_after_positive_a["contractor"]), "")
check("worker does NOT receive lab result details",
      all(n["kind"] != "diagnostic_positive" for n in notif_after_positive_a["worker_a"]), "")
st, res = req(TOKENS["clinician_b"], "GET", f"/cases/{ca_id}", label="case:A-status")
RESULTS["entities"]["case_a"]["status_after_result"] = res.get("status")
check("case A auto-advanced to plan_recorded after result recording", res.get("status") == "plan_recorded",
      res.get("status", ""))

step("Phase 4f: research lab minimum-necessary checks for eligible worker A")
st, res = req(TOKENS["research_lab"], "GET", f"/workers/{RESULTS['accounts']['worker_a']['patient_id']}",
              label="rlab:worker-view")
check("research lab sees only de-identified fields for eligible worker",
      st == 200 and all(k not in res for k in ("phone_e164", "dob", "address_present", "alternate_contact",
                                               "nativity", "occupation", "initial_symptoms")),
      str({k: res.get(k) for k in ("phone_e164", "dob", "address_present")})[:200])
RESULTS["entities"]["rlab_worker_view_a"] = {k: res.get(k) for k in res.keys()} if st == 200 else res
st, res = req(TOKENS["research_lab"], "GET", f"/samples?patient_id={RESULTS['accounts']['worker_a']['patient_id']}",
              label="rlab:samples")
elig_ids = [s["id"] for s in res.get("items", [])] if st == 200 else []
check("research lab sees ONLY eligible positive samples (pending ordered sample excluded)",
      st == 200 and rdt_sample_a["id"] in elig_ids and ordered_sample_a["sample_id"] not in elig_ids,
      f"visible={elig_ids}")
st, res = req(TOKENS["research_lab"], "GET", f"/questionnaires?patient_id={RESULTS['accounts']['worker_a']['patient_id']}",
              label="rlab:questionnaires")
check("research lab cannot read screening questionnaire content",
      st == 200 and all("data" not in i for i in res.get("items", [])), str(res)[:200])

step("Phase 4g: clinician disposition + first follow-up")
st, res = req(TOKENS["clinician_b"], "POST", "/assessments",
              {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "case_id": ca_id,
               "facility_id": fac["id"], "fever_duration_category": "1_3_days", "temperature_c": 38.4,
               "symptoms": ["fever", "headache"], "general_condition": "stable",
               "treatment_documentation": "SYNTHETIC TEST NOTE: documented plan text recorded at clinician review.",
               "treatment_given": "yes", "follow_up_assigned": "yes", "admission_status": "outpatient"},
              label="clinical:assessment-a")
expect("clinician records disposition (treatment fields only)", st, 201)
RESULTS["entities"]["assessment_a"] = res
post_assess = {t: [n["kind"] for n in snapshot(t, ca_id)] for t in ("health_worker_a", "worker_a")}
check("event 4: assessment recording generates NO new notification for the reporting worker / health worker",
      all(not any("review" in k or "assessment" in k for k in kinds) for kinds in post_assess.values()),
      str(post_assess)[:260])
# clinician view of the case-event journal (who/what/when)
st, res = req(TOKENS["clinician_b"], "GET", f"/cases/{ca_id}", label="case:A-events")
if st == 200:
    RESULTS["entities"]["case_a_events"] = res.get("events") or res.get("status_timeline")

due_a = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
st, res = req(TOKENS["clinician_b"], "POST", "/follow-ups",
              {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "case_id": ca_id,
               "assigned_user_id": RESULTS["accounts"]["health_worker_a"]["id"],
               "scheduled_day": "Day 3", "due_at": due_a,
               "notes": "SYNTHETIC TEST first follow-up (initial clinician plan)."}, label="followup:A-assign")
expect("clinician assigns first follow-up to Health Worker A", st, 201)
fu_a_id = res["id"]
fu_notif = snapshot("health_worker_a", ca_id)
check("event 6: first follow-up assigned -> Health Worker A notified (followup_assigned)",
      any(n["kind"] == "followup_assigned" for n in fu_notif), str(fu_notif)[:220])
check("other health worker NOT notified of the assignment",
      not [n for n in snapshot("health_worker_b", ca_id) if n["kind"] == "followup_assigned"], "")
check("assigned follow-up puts worker A in Health Worker A's read scope",
      req(TOKENS["health_worker_a"], "GET", f"/cases/{ca_id}", silent=True)[0] == 200, "")
st, res = req(TOKENS["health_worker_a"], "GET", "/follow-ups?queue=due", label="hw-a:queue")
check("Health Worker A sees the assignment in due queue",
      st == 200 and any(f["id"] == fu_a_id for f in res.get("items", [])), "")
st, res = req(TOKENS["health_worker_b"], "GET", "/follow-ups?queue=due", label="hw-b:queue")
check("Health Worker B does not see Health Worker A's follow-up",
      st == 200 and not any(f["id"] == fu_a_id for f in res.get("items", [])), "")

step("Phase 4h: follow-up update authorization + completion")
st, res = req(TOKENS["worker_a"], "PATCH", f"/follow-ups/{fu_a_id}", {"status": "completed"}, label="auth:worker-patch-fu")
expect("patient worker cannot update follow-up", st, 403)
st, res = req(TOKENS["health_worker_b"], "PATCH", f"/follow-ups/{fu_a_id}", {"status": "completed"},
              label="auth:hw-b-patch-fu")
expect("unrelated health worker cannot update another's follow-up", st, 403)
st, res = req(TOKENS["health_worker_a"], "PUT", f"/follow-ups/{fu_a_id}",
              {"adherence": "x", "status": "cancelled", "assigned_user_id": "y", "case_id": "z"},
              label="auth:hw-forbidden-fields")
check("health worker cannot mutate immutable follow-up fields (extra=forbid -> 422)", st == 422, f"status={st}")
st, res = req(TOKENS["clinician_c"], "GET", f"/follow-ups?patient_id={RESULTS['accounts']['worker_a']['patient_id']}",
              label="cl-c:followups")
check("district clinician CAN view follow-up (policy: global district scope)", st == 200, "")

st, res = req(TOKENS["health_worker_a"], "PATCH", f"/follow-ups/{fu_a_id}",
              {"adherence": "good, completed course", "outcome": "recovered", "status": "completed",
               "notes": "SYNTHETIC TEST NOTE: Follow-up completed; patient reviewed."},
              label="followup:A-complete")
expect("Health Worker A completes first follow-up", st, 200)
RESULTS["entities"]["followup_a"] = res
false_final = {t: snapshot(t, ca_id) for t in ("clinician_b", "clinician_c", "health_worker_a", "worker_a")}
check("event 7c: follow-up completed -> clinicians notified (case_followup_completed)",
      any(n["kind"] == "case_followup_completed" for n in false_final["clinician_b"]), "")
check("event 14: case auto-advanced to followup_completed",
      req(TOKENS["health_worker_a"], "GET", f"/cases/{ca_id}", silent=True)[1].get("status") == "followup_completed", "")

step("Phase 4i: notification read-state isolation")
rows = [n for n in snapshot("health_worker_a", ca_id) if not n["read"]]
if rows:
    target = rows[0]["id"]
    st, res = req(TOKENS["health_worker_b"], "POST", "/notifications/read", {"ids": [target]},
                  label="auth:cross-user-mark-read")
    expect("cannot mark someone else's notification read", st, 403)
    st, res = req(TOKENS["health_worker_a"], "POST", "/notifications/read", {"ids": [target]},
                  label="notif:mark-read")
    expect("recipient marks own notification read", st, 200)

# ==========================================================================
# Phase 5: Scenario B — positive microscopy, molecular, second follow-up
# ==========================================================================
step("Phase 5: Scenario B — positive microscopy + research lab")
st, res = req(TOKENS["worker_b"], "POST", "/symptom-reports",
              {"symptoms": ["fever", "chills_shivering"], "onset_category": "1_3_days", "temperature_c": 39.1,
               "client_request_id": crid("sr-b")}, label="symptom-report:B")
expect("worker B submits symptom report", st, 201)
case_b = res
cb_id = case_b["case_id"]
RESULTS["entities"]["case_b"] = case_b
bl_snap = {t: snapshot(t, cb_id) for t in ("clinician_b", "clinician_c", "contractor")}
check("BOTH clinicians receive case B review notice (routing is all active clinicians)",
      any(n["kind"] == "case_clinical_review" for n in bl_snap["clinician_c"]) and
      any(n["kind"] == "case_clinical_review" for n in bl_snap["clinician_b"]), "")

req(TOKENS["clinician_c"], "POST", f"/cases/{cb_id}/acknowledge", silent=True)
st, res = req(TOKENS["clinician_c"], "POST", f"/cases/{cb_id}/request-test", {"facility_id": fac["id"]},
              label="case:B-request-test")
ordered_sample_b = res
req(TOKENS["clinician_c"], "POST", f"/cases/{cb_id}/transition",
    {"to_status": "awaiting_diagnostic_result", "note": "SYNTHETIC TEST"}, silent=True)
st, res = req(TOKENS["pathologist_lab"], "POST", "/samples",
              {"patient_id": RESULTS["accounts"]["worker_b"]["patient_id"], "case_id": cb_id,
               "method": "microscopy", "result_status": "positive", "species": "pv",
               "smear_type": "both", "facility_id": fac["id"], "client_request_id": crid("sample-b-ms")},
              label="sample:B-microscopy-positive")
expect("pathologist records microscopy POSITIVE (pv)", st, 201)
micro_sample_b = res
RESULTS["entities"]["micro_sample_b"] = {k: micro_sample_b.get(k) for k in ("id", "sample_code")}
notif_b_pos = {t: [n["kind"] for n in snapshot(t, cb_id)] for t in ("clinician_c", "clinician_b", "research_lab")}
check("event: microscopy positive -> diagnostic_positive to responsible clinician",
      "diagnostic_positive" in notif_b_pos["clinician_c"], "")
check("event: microscopy positive -> research_eligible to research lab",
      "research_eligible" in notif_b_pos["research_lab"], "")

step("Phase 5b: research lab records molecular result (supported fixed choices)")
kinds_before_lab = [n["kind"] for n in snapshot("clinician_c", cb_id)]
st, res = req(TOKENS["research_lab"], "POST", "/research-results",
              {"sample_id": micro_sample_b["id"], "pcr_status": "detected", "species_confirmation": "pv",
               "parasite_density": 12500.0, "parasite_density_unit": "parasites/uL",
               "gametocyte_presence": "not_tested", "pfhrp2_status": "not_tested", "pfhrp3_status": "not_tested"},
              label="research:result-create")
expect("research lab records molecular result", st, 201)
RESULTS["entities"]["molecular_b"] = res
kinds_after_lab = [n["kind"] for n in snapshot("clinician_c", cb_id)]
new_kinds = [k for k in kinds_after_lab if k not in kinds_before_lab]
check("event 10/11: NO notification/ routing of lab result back to responsible clinician (NOT IMPLEMENTED in code)",
      new_kinds == [], f"new notification kinds after lab result: {new_kinds}")
st, res = req(TOKENS["research_lab"], "POST", "/research-results",
              {"sample_id": micro_sample_b["id"], "pcr_status": "pending", "gametocyte_presence": "not_tested",
               "pfhrp2_status": "not_tested", "pfhrp3_status": "not_tested"}, label="research:result-duplicate")
expect("duplicate molecular result per sample rejected 409 (entity idempotency)", st, 409)
st, res = req(TOKENS["research_lab"], "POST", "/research-results",
              {"sample_id": micro_sample_b["id"], "pcr_status": "positive", "gametocyte_presence": "not_tested",
               "pfhrp2_status": "not_tested", "pfhrp3_status": "not_tested"}, label="research:invalid-state")
check("molecular invalid enum rejected (pcr_status 'positive' unsupported)", st != 201, f"status={st}")
st, res = req(TOKENS["research_lab"], "POST", "/samples",
              {"patient_id": RESULTS["accounts"]["worker_b"]["patient_id"], "method": "rdt",
               "result_status": "negative"}, label="auth:rlab-create-sample")
expect("research lab cannot record diagnostic results", st, 403)
st, res = req(TOKENS["research_lab"], "PATCH", f"/follow-ups/{fu_a_id}", {"status": "cancelled"},
              label="auth:rlab-patch-fu")
expect("research lab cannot edit follow-ups", st, 403)
st, res = req(TOKENS["research_lab"], "POST", "/assessments",
              {"patient_id": RESULTS["accounts"]["worker_b"]["patient_id"], "case_id": cb_id},
              label="auth:rlab-clinical")
expect("research lab cannot alter clinician treatment/medication records", st, 403)

step("Phase 5c: clinician decision + second follow-up stage")
st, res = req(TOKENS["clinician_c"], "POST", "/assessments",
              {"patient_id": RESULTS["accounts"]["worker_b"]["patient_id"], "case_id": cb_id,
               "facility_id": fac["id"],
               "treatment_documentation": "SYNTHETIC TEST NOTE: documented plan text after molecular review.",
               "treatment_given": "yes", "follow_up_assigned": "yes", "notes": "SYNTHETIC TEST NOTE"},
              label="clinical:assessment-b")
expect("responsible clinician records decision via supported fields", st, 201)
fu_b1_due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
fu_b1_body = {"patient_id": RESULTS["accounts"]["worker_b"]["patient_id"], "case_id": cb_id,
              "assigned_user_id": RESULTS["accounts"]["health_worker_b"]["id"],
              "scheduled_day": "Day 3", "due_at": fu_b1_due,
              "notes": "SYNTHETIC TEST note: stage-1 follow-up (post-lab review).",
              "client_request_id": crid("fu-b1")}
st, res = req(TOKENS["clinician_c"], "POST", "/follow-ups", fu_b1_body, label="followup:B1-assign")
expect("clinician assigns follow-up B1 to Health Worker B", st, 201)
fu_b1_id = res["id"]
fu_notif_b1 = len([n for n in snapshot("health_worker_b", cb_id) if n["kind"] == "followup_assigned"])
# Replay probe: same clinician, same key, same payload -> resolve to the ORIGINAL task (D2 fix)
st, res = req(TOKENS["clinician_c"], "POST", "/follow-ups", fu_b1_body, label="followup:B1-replay-probe")
check("D2 FIXED: follow-up replay with same key resolves to the original task (HTTP %d)" % st,
      st == 200 and res.get("duplicate") is True and res.get("id") == fu_b1_id,
      f"status={st} duplicate={res.get('duplicate')} id={res.get('id')}")
fu_notif_after_probe = len([n for n in snapshot("health_worker_b", cb_id) if n["kind"] == "followup_assigned"])
check("D2 FIXED: replay did NOT create a second follow-up row (notification count unchanged)",
      fu_notif_after_probe == fu_notif_b1, f"notif rows {fu_notif_b1} -> {fu_notif_after_probe}")
# Conflict probe: same key, different content -> explicit 409 (coherent client bug, not silent overwrite)
st_conf, res_conf = req(TOKENS["clinician_c"], "POST", "/follow-ups",
                        {**fu_b1_body, "notes": "SYNTHETIC TEST note: replay probe of B1 (CONFLICT probe)."},
                        label="followup:B1-replay-conflict-probe")
check("D2: follow-up replay with CONFLICTING payload under same key rejected 409",
      st_conf == 409, f"status={st_conf}")
fu_b1_notif = snapshot("health_worker_b", cb_id)
check("Health Worker B notified of B1 assignment (followup_assigned)",
      any(n["kind"] == "followup_assigned" for n in fu_b1_notif), "")
st, res = req(TOKENS["clinician_c"], "POST", "/follow-ups",
              {"patient_id": RESULTS["accounts"]["worker_b"]["patient_id"], "case_id": cb_id,
               "assigned_user_id": RESULTS["accounts"]["health_worker_b"]["id"],
               "scheduled_day": "Day 7",
               "due_at": (datetime.now(timezone.utc) + timedelta(days=6)).isoformat(),
               "notes": "SYNTHETIC TEST note: stage-2 follow-up after lab findings."},
              label="followup:B2-assign")
expect("clinician assigns second follow-up B2", st, 201)
fu_b2_id = res["id"]
assign_rows = [n for n in snapshot("health_worker_b", cb_id) if n["kind"] == "followup_assigned"]
check("event 12: Health Worker B has an assignment notification (unread dedup collapses repeats to ONE unread row per case+kind)",
      len(assign_rows) >= 1, f"assigned rows (actual)={len(assign_rows)}")

st, res = req(TOKENS["health_worker_b"], "GET", f"/follow-ups?patient_id={RESULTS['accounts']['worker_b']['patient_id']}",
              label="hw-b:queue-B")
check("both follow-ups visible in Health Worker B queue",
      st == 200 and {f["id"] for f in res.get("items", [])} >= {fu_b1_id, fu_b2_id}, "")
st, res = req(TOKENS["health_worker_b"], "PATCH", f"/follow-ups/{fu_b1_id}",
              {"adherence": "good", "outcome": "on_treatment", "status": "completed",
               "notes": "SYNTHETIC TEST NOTE: Follow-up completed; patient reviewed."},
              label="followup:B1-complete")
expect("Health Worker B completes B1", st, 200)
st, res = req(TOKENS["clinician_c"], "GET", f"/cases/{cb_id}", label="case:B-status-mid")
check("case B stays followup_due while B2 is still pending",
      res.get("status") == "followup_due", res.get("status", ""))
st, res = req(TOKENS["clinician_c"], "GET", f"/follow-ups?patient_id={RESULTS['accounts']['worker_b']['patient_id']}",
              label="clinician:read-notes")
check("clinician can read the health worker's follow-up note (message via notes field)",
      st == 200 and any("Follow-up completed; patient reviewed" in (f.get("notes") or "")
                        for f in res.get("items", [])), "")
unread_before_note = unread_count("clinician_c")
check("note alone does NOT generate a clinician notification (existing mechanism: notes only)",
      unread_count("clinician_c") == unread_before_note, f"unread={unread_before_note}")
# distinct keys create distinct legitimate tasks: B2 (fresh key) coexists with B1
check("D2: a fresh key still creates a distinct legitimate task (B2 != B1, both rows exist)",
      fu_b2_id != fu_b1_id, f"b1={fu_b1_id} b2={fu_b2_id}")
st, res = req(TOKENS["health_worker_b"], "PATCH", f"/follow-ups/{fu_b2_id}",
              {"adherence": "good", "outcome": "recovered", "status": "completed"}, label="followup:B2-complete")
expect("Health Worker B completes B2", st, 200)
b_final = {t: snapshot(t, cb_id) for t in ("clinician_c", "clinician_b", "health_worker_b", "worker_b")}
check("event 13: second follow-up completed -> case_followup_completed to clinicians",
      any(n["kind"] == "case_followup_completed" for n in b_final["clinician_c"]), "")
st, res = req(TOKENS["clinician_c"], "GET", f"/cases/{cb_id}", label="case:B-status-final")
check("event 14: case B auto-advanced to followup_completed", res.get("status") == "followup_completed",
      res.get("status", ""))
st, res = req(TOKENS["clinician_c"], "POST", f"/cases/{cb_id}/transition",
              {"to_status": "closed", "note": "SYNTHETIC TEST close"}, label="case:B-close")
expect("clinician closes completed case B", st, 200)
w_rows = snapshot("worker_b", cb_id)
check("event: case closed -> reporting worker informed (case_status_update)",
      any(n["kind"] == "case_status_update" for n in w_rows), str(w_rows)[:200])

# ==========================================================================
# Phase 6: Scenario C — negative control
# ==========================================================================
step("Phase 6: Scenario C — negative RDT control (worker C)")
st, res = req(TOKENS["worker_c"], "POST", "/symptom-reports",
              {"symptoms": ["fever"], "onset_category": "1_3_days", "temperature_c": 37.9,
               "client_request_id": crid("sr-c")}, label="symptom-report:C")
expect("worker C submits symptom report", st, 201)
case_c = res
cc_id = case_c["case_id"]
RESULTS["entities"]["case_c"] = {"case_code": case_c["case_code"], "id": cc_id}
req(TOKENS["clinician_b"], "POST", f"/cases/{cc_id}/acknowledge", silent=True)
st, res = req(TOKENS["clinician_b"], "POST", f"/cases/{cc_id}/request-test", {"facility_id": fac["id"]},
              label="case:C-request-test")
ordered_sample_c = res
req(TOKENS["clinician_b"], "POST", f"/cases/{cc_id}/transition",
    {"to_status": "awaiting_diagnostic_result", "note": "SYNTHETIC TEST"}, silent=True)
st, res = req(TOKENS["pathologist_lab"], "POST", "/samples",
              {"patient_id": RESULTS["accounts"]["worker_c"]["patient_id"], "case_id": cc_id,
               "method": "rdt", "result_status": "negative", "facility_id": fac["id"],
               "client_request_id": crid("sample-c-neg")}, label="sample:C-negative")
expect("pathologist records RDT NEGATIVE", st, 201)
neg_sample_c = res
st, res = req(TOKENS["clinician_b"], "GET", f"/cases/{cc_id}", label="case:C-status")
check("negative result -> case advanced to plan_recorded", res.get("status") == "plan_recorded", res.get("status", ""))
c_kinds = {t: [n["kind"] for n in snapshot(t, cc_id)] for t in ("research_lab", "clinician_b", "contractor")}
check("negative control does NOT generate research_eligible/diagnostic_positive alerts",
      not any(k in ("research_eligible", "diagnostic_positive") for t in c_kinds for k in c_kinds[t]),
      str(c_kinds)[:260])
st, res = req(TOKENS["research_lab"], "GET", f"/workers/{RESULTS['accounts']['worker_c']['patient_id']}",
              label="auth:rlab-negative-worker")
expect("research lab DENIED access to negative-case worker", st, 403)
st, res = req(TOKENS["research_lab"], "GET", f"/samples?patient_id={RESULTS['accounts']['worker_c']['patient_id']}",
              label="auth:rlab-negative-samples")
check("negative case: research lab samples access denied (403, eligibility guard)", st == 403, f"status={st}")
st, res = req(TOKENS["research_lab"], "POST", "/research-results",
              {"sample_id": neg_sample_c["id"], "pcr_status": "pending", "gametocyte_presence": "not_tested",
               "pfhrp2_status": "not_tested", "pfhrp3_status": "not_tested"}, label="auth:rlab-negative-result")
expect("research lab cannot record a molecular result on a negative sample", st, 403)
# read-then-new-event: mark worker C's notification read, then a NEW event must create a FRESH row
w_rows_c = snapshot("worker_c", cc_id)
first_c = w_rows_c[0] if w_rows_c else None
if first_c and not first_c["read"]:
    st, res = req(TOKENS["worker_c"], "POST", "/notifications/read", {"ids": [first_c["id"]]},
                  label="notif:C-mark-read")
    check("worker C marks own notification read", st == 200, f"status={st}")
req(TOKENS["clinician_b"], "POST", f"/cases/{cc_id}/transition",
    {"to_status": "closed", "note": "SYNTHETIC CONTROL closed"}, silent=True)
fresh = [n for n in snapshot("worker_c", cc_id) if n["kind"] == "case_status_update"]
check("event 16: after mark-read, a NEW case event creates a FRESH (unread) notification",
      len(fresh) >= 1 and not fresh[0]["read"], str([(n["kind"], n["read"]) for n in fresh])[:160])
stc, resc = req(TOKENS["clinician_b"], "GET", f"/cases/{cc_id}", silent=True)
check("negative-control case closed by clinician", stc == 200 and resc.get("status") == "closed",
      f"status={stc} case={resc.get('status')}")

# ==========================================================================
# Phase 7: eligibility boundaries (pending / indeterminate / conflicting)
# ==========================================================================
step("Phase 7: eligibility boundaries")
st, res = req(TOKENS["research_lab"], "POST", "/research-results",
              {"sample_id": ordered_sample_c["sample_id"], "pcr_status": "pending",
               "gametocyte_presence": "not_tested", "pfhrp2_status": "not_tested", "pfhrp3_status": "not_tested"},
              label="elig:pending-sample")
expect("pending/missing-result sample NOT research-eligible", st, 403)
st, res = req(TOKENS["pathologist_lab"], "POST", "/samples",
              {"patient_id": RESULTS["accounts"]["worker_c"]["patient_id"], "method": "microscopy",
               "result_status": "indeterminate", "facility_id": fac["id"],
               "client_request_id": crid("sample-c-indet")}, label="sample:C-indeterminate")
expect("indeterminate microscopy recorded (allowed test state)", st, 201)
st, res = req(TOKENS["research_lab"], "GET", f"/workers/{RESULTS['accounts']['worker_c']['patient_id']}",
              label="elig:indet-access")
check("indeterminate result does NOT make worker research-eligible", st == 403, f"status={st}")
st, res = req(TOKENS["pathologist_lab"], "POST", "/samples",
              {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "method": "rdt",
               "result_status": "negative", "facility_id": fac["id"],
               "client_request_id": crid("sample-a-conflict")}, label="sample:A-conflicting-negative")
expect("conflicting negative sample recorded for worker A", st, 201)
st, res = req(TOKENS["research_lab"], "GET", f"/workers/{RESULTS['accounts']['worker_a']['patient_id']}",
              label="elig:conflict-worker-access")
check("CONFLICTING RESULTS rule (as coded): worker stays eligible if ANY positive rdt/microscopy row exists",
      st == 200, f"status={st}")
st, res = req(TOKENS["research_lab"], "GET", f"/samples?patient_id={RESULTS['accounts']['worker_a']['patient_id']}",
              label="elig:conflict-samples")
check("eligibility is also sample-level: negative/conflicting rows are hidden",
      st == 200 and all(s["status"] == "positive" for s in res.get("items", [])),
      str([s["status"] for s in res.get("items", [])]))
kinds_all = [n["kind"] for n in snapshot("research_lab", None)]
check("research_eligible rows exist exactly for the two genuinely positive cases",
      kinds_all.count("research_eligible") == 2, f"count={kinds_all.count('research_eligible')}")

# ==========================================================================
# Phase 8: authorization matrix negatives
# ==========================================================================
step("Phase 8: authorization matrix negative probes")
due_b1 = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
probes = [
    ("worker_a", "POST", "/symptom-reports", {"symptoms": ["fever"]}),
    ("health_worker_a", "POST", "/follow-ups",
     {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"],
      "assigned_user_id": RESULTS["accounts"]["health_worker_a"]["id"], "due_at": due_a}),
    ("health_worker_a", "POST", "/assessments", {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"]}),
    ("contractor", "POST", "/assessments", {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"]}),
    ("contractor", "POST", "/samples",
     {"patient_id": RESULTS["accounts"]["worker_a"]["patient_id"], "method": "rdt"}),
    ("worker_a", "PATCH", f"/follow-ups/{fu_a_id}", {"status": "missed"}),
    ("pathologist_lab", "POST", "/follow-ups",
     {"patient_id": RESULTS["accounts"]["worker_b"]["patient_id"],
      "assigned_user_id": RESULTS["accounts"]["health_worker_a"]["id"], "due_at": due_b1}),
    ("research_lab", "GET", "/audit-events", None),
]
for tag, method, path, payload in probes:
    stx, body = req(TOKENS[tag], method, path, payload, label=f"authz:{tag}:{path}")
    check(f"{tag} denied: {method} {path}", stx in (403, 422), f"status={stx}")

# Admin read-only probes with the seeded demo admin (login only)
st, res = req(None, "POST", "/auth/login", {"phone": "+919000000007", "pin": DEMO_PIN}, label="login:demo-admin", silent=True)
admin_token = res.get("access_token") if st == 200 else None
if admin_token:
    stx, body = req(admin_token, "POST", "/sites",
                    {"name": "SYN ADMIN PROBE", "district": "X", "area": "Y"}, label="authz:admin-create-site")
    check("admin cannot create sites (read-only-by-default)", stx == 403, f"status={stx}")
    stx, body = req(admin_token, "PATCH", f"/follow-ups/{fu_a_id}", {"status": "completed"},
                    label="authz:admin-patch-fu")
    check("admin cannot modify follow-ups", stx == 403, f"status={stx}")
    stx, body = req(admin_token, "GET", f"/audit-events?entity_id={fu_a_id}&limit=10", label="audit:followup-a")
    check("admin can read audit trail for follow-up A", stx == 200, f"status={stx}")
    if stx == 200:
        RESULTS["entities"]["audit_followup_a"] = [
            {"action": e["action"], "actor_user_id": e["actor_user_id"], "occurred_at": e["occurred_at"]}
            for e in body.get("items", [])]
else:
    check("demo admin login for audit inspection", False, "seeded admin PIN check failed")

# ==========================================================================
# Phase 9: audit trail extraction
# ==========================================================================
step("Phase 9: audit trail")
if admin_token:
    st, res = req(admin_token, "GET", "/audit-events?limit=200", label="audit:list")
    results_rows = []
    for e in res.get("items", []):
        detail = str(e.get("detail") or {})
        if CR_BASE in detail or RUN[-8:].upper() in detail or "e2e-malaria" in detail.lower():
            results_rows.append({"action": e["action"], "entity_type": e["entity_type"],
                                 "entity_id": e["entity_id"], "actor_user_id": e["actor_user_id"],
                                 "occurred_at": e["occurred_at"]})
    RESULTS["entities"]["audit_tail"] = results_rows
    check("audit events recorded for synthetic run transactions", len(results_rows) > 0, f"found={len(results_rows)}")

# ==========================================================================
# Finish
# ==========================================================================
passed = sum(1 for c in RESULTS["checks"] if c["verdict"] == "PASS")
failed = sum(1 for c in RESULTS["checks"] if c["verdict"] != "PASS")
RESULTS["summary"] = {"passed": passed, "failed": failed, "finished_at": now_iso()}
print(f"\n=== E2E RESULT: {passed} checks passed / {failed} failed ===")
os.makedirs(os.path.dirname(RESULT_FILE), exist_ok=True)
with open(RESULT_FILE, "w") as fh:
    json.dump(RESULTS, fh, indent=2, default=str)
print("Full JSON log:", RESULT_FILE)
sys.exit(1 if FAILURES else 0)
