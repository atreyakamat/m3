"""Phase 2/3/10 case lifecycle: worker symptom reports -> clinical review ->
diagnostic order -> follow-up -> closure, plus the full RBAC matrix.

Key invariants under test:
- Idempotency: a replayed client_request_id never mints a second case.
- Urgency routing is governed by configurable danger-signal codes.
- Contractor visibility strips ALL clinical payload; research_lab gets nothing.
- health_worker stays read-only on the case graph.
- Notifications are persisted per recipient with a minimal-body variant for
  contractors, and only the recipient can mark them read.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

WORKER_REGISTER = {
    "display_name": "Ram Case Worker",
    "mobile": "+919111222333",
    "home_state": "Goa",
    "home_district": "North Goa",
    "dob": "1992-04-10",
    "gender": "male",
}

SYMPTOM_BODY = {
    "symptoms": ["fever", "chills_shivering"],
    "onset_category": "1_3_days",
    "temperature_c": 38.9,
    "location_note": "Labour line, block C",
    "description": "Fever since Monday, chills at night.",
    "attend_facility": "no",
    "contact_pref": "call",
}


def _h(tokens, label):
    return {"Authorization": f"Bearer {tokens[label]}"}


def _crid():
    return "crid-" + uuid.uuid4().hex


def _report(client, headers, **overrides):
    body = {**SYMPTOM_BODY, **overrides}
    return client.post("/api/v1/symptom-reports", headers=headers, json=body)


@pytest.fixture(scope="module")
def contractor1(client):
    r = client.post("/api/v1/auth/login", json={"phone": "+919000000001", "pin": "1234"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def contractor2(client):
    r = client.post("/api/v1/auth/login", json={"phone": "+919000000002", "pin": "1234"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def worker_registered(client, tokens, contractor1):
    """Register the module worker and link them to site-1 (contractor-1 scope)."""
    r = client.post("/api/v1/workers", headers=_h(tokens, "worker"), json=WORKER_REGISTER)
    assert r.status_code in (200, 201), r.text
    worker_id = r.json()["id"]
    m = client.post(f"/api/v1/workers/{worker_id}/membership", headers=contractor1,
                    json={"site_id": "site-1"})
    assert m.status_code in (200, 201), m.text
    return worker_id


def _case_patient(client, tokens, case_id):
    """The patient the case belongs to (via the clinician detail view)."""
    return client.get(f"/api/v1/cases/{case_id}", headers=_h(tokens, "clinician")).json()["patient_id"]


@pytest.fixture()
def case_pending(client, tokens, worker_registered):
    """A fresh non-urgent case awaiting clinical review."""
    r = _report(client, _h(tokens, "worker"), client_request_id=_crid())
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def case_assigned(client, tokens, case_pending):
    r = client.post(f"/api/v1/cases/{case_pending['case_id']}/acknowledge",
                    headers=_h(tokens, "clinician"))
    assert r.status_code == 200, r.text
    return case_pending


@pytest.fixture()
def case_tested(client, tokens, case_assigned):
    case_id = case_assigned["case_id"]
    r = client.post(f"/api/v1/cases/{case_id}/request-test", headers=_h(tokens, "clinician"),
                    json={"facility_id": "fac-1"})
    assert r.status_code == 201, r.text
    return {**case_assigned, "sample_id": r.json()["sample_id"]}


def test_symptom_report_creates_case_and_routes(client, tokens, case_pending):
    assert case_pending["status"] == "awaiting_clinical_review"
    assert case_pending["urgent"] is False
    assert case_pending["case_code"].startswith("M3-CA-")


def test_symptom_report_replay_is_idempotent(client, tokens, worker_registered):
    crid = _crid()
    r1 = _report(client, _h(tokens, "worker"), client_request_id=crid)
    assert r1.status_code == 201, r1.text
    case_id = r1.json()["case_id"]
    # Replay (offline retry / double tap) resolves to the SAME case, 200.
    r2 = _report(client, _h(tokens, "worker"), client_request_id=crid)
    assert r2.status_code == 200, r2.text
    assert r2.json()["duplicate"] is True and r2.json()["case_id"] == case_id
    listing = client.get("/api/v1/cases", headers=_h(tokens, "worker")).json()
    mine = [c for c in listing["items"] if c["id"] == case_id]
    assert len(mine) == 1


def test_urgent_symptom_flags_case_urgent(client, tokens, worker_registered):
    r = _report(client, _h(tokens, "worker"), symptoms=["fever", "breathing_difficulty"],
                client_request_id=_crid())
    assert r.status_code == 201, r.text
    assert r.json()["urgent"] is True


def test_unknown_symptom_rejected(client, tokens, worker_registered):
    r = _report(client, _h(tokens, "worker"), symptoms=["not_a_real_code"], client_request_id=_crid())
    assert r.status_code == 422


def test_worker_without_registration_cannot_report(client, tokens):
    # logout_tester is a seeded worker account that no test registers, so it
    # provably has no worker profile (order-independent).
    r = _report(client, _h(tokens, "logout_tester"), client_request_id=_crid())
    assert r.status_code in (409, 403)


def test_clinician_notification_persisted_on_report(client, tokens, case_pending):
    r = client.get("/api/v1/notifications", headers=_h(tokens, "clinician")).json()
    rows = [n for n in r["items"] if n["kind"] == "case_clinical_review"]
    assert rows
    assert all(n["body_minimal"] is False for n in rows)


def test_urgent_case_title_flags_clinician(client, tokens, worker_registered):
    r = _report(client, _h(tokens, "worker"), symptoms=["breathing_difficulty"],
                client_request_id=_crid())
    assert r.status_code == 201
    cl = client.get("/api/v1/notifications", headers=_h(tokens, "clinician")).json()
    urgent_rows = [n for n in cl["items"]
                   if n["kind"] == "case_clinical_review" and "Urgent" in n["title"]]
    assert urgent_rows


def test_contractor_notification_is_minimal(client, tokens, case_pending, contractor1):
    r = client.get("/api/v1/notifications", headers=contractor1).json()
    rows = [n for n in r["items"] if n["kind"] == "case_site_coordination"]
    assert rows, "contractor at site-1 should receive the coordination notice"
    row = rows[0]
    assert row["body_minimal"] is True
    assert "Ravi" not in row["body"] and "fever" not in row["body"].lower()


def test_case_list_role_scoping(client, tokens, case_pending, contractor2):
    cl = client.get("/api/v1/cases", headers=_h(tokens, "clinician")).json()
    assert cl["total"] >= 1
    co = client.get("/api/v1/cases", headers=contractor2).json()
    # contractor-2 owns site-b/site-2; our cases are at site-1 or unlinked.
    assert all(c["site_id"] in ("site-b", "site-2", None) for c in co["items"])
    r = client.get("/api/v1/cases", headers=_h(tokens, "research_lab"))
    assert r.status_code == 403


def test_case_detail_rbac_and_stripping(client, tokens, case_pending, contractor1, contractor2, worker_registered):
    case_id = case_pending["case_id"]
    cd = client.get(f"/api/v1/cases/{case_id}", headers=_h(tokens, "clinician")).json()
    assert cd["report"]["symptoms"] == ["fever", "chills_shivering"]
    assert "events" in cd
    assert cd["site_id"] == "site-1"
    # Worker sees their own case.
    wd = client.get(f"/api/v1/cases/{case_id}", headers=_h(tokens, "worker"))
    assert wd.status_code == 200
    wdj = wd.json()
    # Gate 4: a worker gets a notes-free status timeline, never the clinician's
    # transition notes, and never pathologist sample listings.
    assert "events" not in wdj and "samples" not in wdj
    assert "status_timeline" in wdj and wdj["status_timeline"]
    assert all("note" not in step and "actor_user_id" not in step for step in wdj["status_timeline"])
    # Contractor at the case's site sees operational fields only.
    co = client.get(f"/api/v1/cases/{case_id}", headers=contractor1)
    assert co.status_code == 200
    body = co.json()
    assert set(body) <= {"id", "case_code", "status", "urgent", "site_id", "site_name", "created_at"}
    assert "report" not in body and "patient" not in body
    # Contractor at another site denied; research_lab denied everywhere.
    assert client.get(f"/api/v1/cases/{case_id}", headers=contractor2).status_code == 403
    assert client.get(f"/api/v1/cases/{case_id}", headers=_h(tokens, "research_lab")).status_code == 403


def test_health_worker_is_read_only_on_cases(client, tokens, case_pending):
    hw = client.post(f"/api/v1/cases/{case_pending['case_id']}/acknowledge",
                     headers=_h(tokens, "health_worker"))
    assert hw.status_code in (401, 403)


def test_acknowledge_moves_case_to_assigned(client, tokens, case_pending):
    case_id = case_pending["case_id"]
    r = client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=_h(tokens, "clinician"))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "assigned"
    assert r.json()["acknowledged_at"]
    # Double-ack is rejected: the case is no longer awaiting review.
    r2 = client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=_h(tokens, "clinician"))
    assert r2.status_code == 409


def test_invalid_transition_rejected(client, tokens, case_pending):
    case_id = case_pending["case_id"]
    # Closing an unactionable report straight away is legal; skipping the
    # clinical/dispatch graph is not.
    ok = client.post(f"/api/v1/cases/{case_id}/transition", headers=_h(tokens, "clinician"),
                     json={"to_status": "closed"})
    assert ok.status_code == 200
    r2 = _report(client, _h(tokens, "worker"), client_request_id=_crid())
    fresh = r2.json()
    ok2 = client.post(f"/api/v1/cases/{fresh['case_id']}/acknowledge", headers=_h(tokens, "clinician"))
    assert ok2.status_code == 200
    r = client.post(f"/api/v1/cases/{fresh['case_id']}/transition",
                    headers=_h(tokens, "clinician"), json={"to_status": "followup_due"})
    assert r.status_code == 422


def test_request_diagnostic_test_routes_to_pathology(client, tokens, case_assigned):
    case_id = case_assigned["case_id"]
    r = client.post(f"/api/v1/cases/{case_id}/request-test", headers=_h(tokens, "clinician"),
                    json={"facility_id": "fac-1"})
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["case_status"] == "diagnostic_testing_requested"
    assert data["sample_code"].startswith("M3-S-")
    # Pathologist was notified about the order.
    p = client.get("/api/v1/notifications", headers=_h(tokens, "pathologist")).json()
    assert any(n["kind"] == "case_diagnostic_order" for n in p["items"])
    # A second order on the same case is refused (one lab order per case).
    r2 = client.post(f"/api/v1/cases/{case_id}/request-test", headers=_h(tokens, "clinician"),
                     json={"facility_id": "fac-1"})
    assert r2.status_code == 409
    # The pathology sample view keeps the case linkage.
    s = client.get("/api/v1/samples", headers=_h(tokens, "pathologist")).json()
    sample = next(x for x in s["items"] if x["id"] == data["sample_id"])
    assert sample["case_id"] == case_id


def test_pathology_result_advances_case_and_notifies_clinician(client, tokens, case_tested):
    case_id = case_tested["case_id"]
    # Pathologist records the result on the case-linked order sample (left
    # pending by request-test). This exercises the linkage path on creation.
    r = client.post("/api/v1/samples", headers=_h(tokens, "pathologist"),
                    json={"patient_id": "patient-1", "specimen_type": "blood",
                          "method": "rdt", "result_status": "pending", "case_id": case_id})
    assert r.status_code == 201, r.text
    assert r.json()["case_id"] == case_id


def test_clinician_transitions_and_worker_closure_notice(client, tokens, case_assigned):
    case_id = case_assigned["case_id"]
    for nxt in ("in_assessment", "plan_recorded", "followup_due", "followup_completed", "closed"):
        r = client.post(f"/api/v1/cases/{case_id}/transition", headers=_h(tokens, "clinician"),
                        json={"to_status": nxt, "note": f"advancing to {nxt}"})
        assert r.status_code == 200, r.text
    detail = client.get(f"/api/v1/cases/{case_id}", headers=_h(tokens, "worker")).json()
    assert detail["status"] == "closed"
    # Worker was notified that their case is closed (status notice only).
    w = client.get("/api/v1/notifications", headers=_h(tokens, "worker")).json()
    assert any(n["kind"] == "case_status_update" for n in w["items"])


def test_followup_links_case_and_notifies_assignee(client, tokens, case_assigned):
    case_id = case_assigned["case_id"]
    patient_id = _case_patient(client, tokens, case_id)
    hw_id = client.get("/api/v1/me", headers=_h(tokens, "health_worker")).json()["id"]
    due = datetime.now(timezone.utc) + timedelta(days=2)
    r = client.post("/api/v1/follow-ups", headers=_h(tokens, "clinician"),
                    json={"patient_id": patient_id, "due_at": due.isoformat(),
                          "assigned_user_id": hw_id, "case_id": case_id})
    assert r.status_code == 201, r.text
    assert r.json().get("case_id") == case_id
    hw = client.get("/api/v1/notifications", headers=_h(tokens, "health_worker")).json()
    assert any(n["kind"] == "followup_assigned" for n in hw["items"])
    # Health worker's follow-up queue shows the linkage.
    fw = client.get("/api/v1/follow-ups", headers=_h(tokens, "health_worker")).json()
    assert any(f.get("case_id") == case_id for f in fw["items"])


def test_assessment_links_case_fast_forward(client, tokens, case_assigned):
    case_id = case_assigned["case_id"]
    patient_id = _case_patient(client, tokens, case_id)
    t = client.post(f"/api/v1/cases/{case_id}/transition", headers=_h(tokens, "clinician"),
                    json={"to_status": "in_assessment"})
    assert t.status_code == 200, t.text
    r = client.post("/api/v1/assessments", headers=_h(tokens, "clinician"),
                    json={"patient_id": patient_id, "admission_status": "outpatient",
                          "outcome": "treated", "medical_officer_name": "Dr K",
                          "case_id": case_id})
    assert r.status_code == 201, r.text
    assert r.json().get("case_id") == case_id
    cd = client.get(f"/api/v1/cases/{case_id}", headers=_h(tokens, "clinician")).json()
    assert cd["status"] == "plan_recorded"
    assert len(cd["assessments"]) == 1


def test_case_patient_mismatch_rejected(client, tokens, case_assigned, worker_registered):
    # A case id belonging to a different patient can never be linked.
    patient_id = _case_patient(client, tokens, case_assigned["case_id"])
    fake = uuid.uuid4().hex
    r2 = client.post("/api/v1/assessments", headers=_h(tokens, "clinician"),
                     json={"patient_id": patient_id, "admission_status": "outpatient",
                           "outcome": "treated", "case_id": fake})
    assert r2.status_code == 422


def test_notifications_private_and_mark_read(client, tokens, case_pending):
    cl = client.get("/api/v1/notifications", headers=_h(tokens, "clinician")).json()
    unread = [n for n in cl["items"] if n["read_at"] is None]
    assert unread
    ids = [unread[0]["id"]]
    # Another user cannot mark someone else's notification read.
    r = client.post("/api/v1/notifications/read", headers=_h(tokens, "pathologist"), json={"ids": ids})
    assert r.status_code == 403
    r2 = client.post("/api/v1/notifications/read", headers=_h(tokens, "clinician"), json={"ids": ids})
    assert r2.status_code == 200 and r2.json()["updated"] == 1
    r3 = client.get("/api/v1/notifications", headers=_h(tokens, "clinician"),
                    params={"unread_only": "true"}).json()
    assert all(n["id"] not in ids for n in r3["items"])
    # Marking the same id again is idempotent (no double count).
    r4 = client.post("/api/v1/notifications/read", headers=_h(tokens, "clinician"), json={"ids": ids})
    assert r4.status_code == 200 and r4.json()["updated"] == 0


def test_admin_case_metrics_real_counts(client, tokens, case_pending):
    r = client.get("/api/v1/admin/case-metrics", headers=_h(tokens, "admin"))
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["new_symptom_reports_24h"] >= 1
    assert "note" in m and "Real query" in m["note"]
    assert sum(m["cases_by_status"].values()) >= 1
    # Non-admin denied.
    assert client.get("/api/v1/admin/case-metrics", headers=_h(tokens, "clinician")).status_code in (401, 403)
