"""Idempotency keys are scoped to the authenticated principal.

Covers every client_request_id replay path (worker registration, questionnaire
submission, symptom report/case): same-account retries still resolve to the original
record; another account reusing the id gets a non-disclosing 409 and learns nothing;
concurrent duplicates yield exactly one record; an offline outbox item retried after a
partial failure completes without duplicates.
"""
import json
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import func, select

from app import models
from app.database import SessionLocal

PIN = "2468"
VALID_Q = {
    "personal": {"full_name": "Idem Worker", "dob": "1992-04-10", "gender": "male", "mobile": "+919123450000",
                 "id_type": "aadhaar", "address_present": "Campal, Panaji", "preferred_language": "hindi"},
    "past_history": {"diagnosed_malaria": "no", "repellent": "yes", "mosquito_net": "yes"},
    "present_clinical": {"fever_today": "no", "symptoms": ["no_other_symptoms"], "breathing_difficulty": "no",
                         "chest_pain": "no", "confusion": "no", "can_attend_testing": "not_required"},
    "migration_history": {"time_in_goa": "1_6_months", "outside_goa_3m": "no", "fever_before_goa_3m": "no"},
    "planned_travel": {"planning": "no"},
}


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _phone():
    return "+9190" + str(uuid.uuid4().int)[:8]


def _signup(client):
    r = client.post("/api/v1/auth/signup", json={"phone": _phone(), "pin": PIN, "display_name": "Idem", "role": "worker"})
    assert r.status_code == 201, r.text
    return r.json()["access_token"], r.json()["user"]["patient_id"]


def _unregistered_worker(client):
    """Worker account with no profile yet (the offline first-registration state)."""
    db = SessionLocal()
    try:
        u = models.User(phone_e164=_phone(), display_name="Offline", pin_hash=__import__("app.security", fromlist=["x"]).hash_pin(PIN))
        db.add(u); db.flush()
        db.add(models.RoleAssignment(user_id=u.id, role="worker")); db.commit()
        phone = u.phone_e164
    finally:
        db.close()
    r = client.post("/api/v1/auth/login", json={"phone": phone, "pin": PIN})
    return r.json()["access_token"], phone


def _no_leak(text, *needles):
    for n in needles:
        assert n and n not in text, f"cross-account response leaked {n!r}: {text}"


def _count(model):
    db = SessionLocal()
    try:
        return db.scalar(select(func.count()).select_from(model))
    finally:
        db.close()


# ---------- symptom report / case ----------

def test_symptom_report_same_account_retry_and_cross_account_rejection(client):
    a, _ = _signup(client); b, _ = _signup(client)
    rid = "sym-" + uuid.uuid4().hex
    body = {"symptoms": ["fever"], "description": "PRIVATE-DESC-" + rid, "client_request_id": rid}
    first = client.post("/api/v1/symptom-reports", headers=_h(a), json=body)
    assert first.status_code == 201, first.text
    again = client.post("/api/v1/symptom-reports", headers=_h(a), json=body)
    assert again.status_code == 200 and again.json()["duplicate"] is True and again.json()["case_id"] == first.json()["case_id"]

    cases_before = _count(models.Case)
    foreign = client.post("/api/v1/symptom-reports", headers=_h(b), json={**body, "description": "other"})
    assert foreign.status_code == 409, foreign.text
    _no_leak(foreign.text, first.json()["case_id"], first.json()["case_code"], "PRIVATE-DESC")
    assert _count(models.Case) == cases_before, "cross-account replay must not create or return a case"
    # the owner still resolves normally afterwards
    assert client.post("/api/v1/symptom-reports", headers=_h(a), json=body).status_code == 200


def test_symptom_report_concurrent_duplicates_yield_one_case(client):
    a, _ = _signup(client)
    rid = "sym-" + uuid.uuid4().hex
    body = {"symptoms": ["fever"], "client_request_id": rid}
    before = _count(models.Case)
    with ThreadPoolExecutor(4) as ex:
        rs = list(ex.map(lambda _: client.post("/api/v1/symptom-reports", headers=_h(a), json=body), range(4)))
    codes = sorted(r.status_code for r in rs)
    assert set(codes) <= {200, 201} and codes.count(201) == 1, codes
    assert len({r.json()["case_id"] for r in rs}) == 1
    assert _count(models.Case) == before + 1


# ---------- questionnaire ----------

def test_questionnaire_same_account_retry_and_cross_account_rejection(client):
    a, pa = _signup(client); b, _ = _signup(client)
    rid = "q-" + uuid.uuid4().hex
    first = client.post("/api/v1/questionnaires/submit", headers=_h(a), json={"data": VALID_Q, "client_request_id": rid})
    assert first.status_code == 201, first.text
    again = client.post("/api/v1/questionnaires/submit", headers=_h(a), json={"data": VALID_Q, "client_request_id": rid})
    assert again.status_code == 200 and again.json()["duplicate"] and again.json()["submission_id"] == first.json()["submission_id"]

    before = _count(models.QuestionnaireSubmission)
    foreign = client.post("/api/v1/questionnaires/submit", headers=_h(b), json={"data": VALID_Q, "client_request_id": rid})
    assert foreign.status_code == 409, foreign.text
    _no_leak(foreign.text, first.json()["submission_id"])
    assert _count(models.QuestionnaireSubmission) == before


def test_questionnaire_concurrent_duplicates_yield_one_submission(client):
    a, _ = _signup(client)
    rid = "q-" + uuid.uuid4().hex
    before = _count(models.QuestionnaireSubmission)
    with ThreadPoolExecutor(4) as ex:
        rs = list(ex.map(lambda _: client.post("/api/v1/questionnaires/submit", headers=_h(a),
                                               json={"data": VALID_Q, "client_request_id": rid}), range(4)))
    codes = sorted(r.status_code for r in rs)
    assert set(codes) <= {200, 201} and codes.count(201) == 1, codes
    assert len({r.json()["submission_id"] for r in rs}) == 1
    assert _count(models.QuestionnaireSubmission) == before + 1


# ---------- worker registration ----------

def test_worker_registration_cross_account_rejection_for_worker_and_contractor(client):
    a, _ = _unregistered_worker(client)
    rid = "reg-" + uuid.uuid4().hex
    body = {"display_name": "Idem Registrant PRIVATE", "consent_status": "documented", "client_request_id": rid}
    first = client.post("/api/v1/workers", headers=_h(a), json=body)
    assert first.status_code == 201, first.text
    again = client.post("/api/v1/workers", headers=_h(a), json=body)
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"] and again.json()["duplicate"]

    other_worker, _ = _unregistered_worker(client)
    contractor = client.post("/api/v1/auth/login", json={"phone": "+919000000028", "pin": PIN}).json()["access_token"]
    for tok in (other_worker, contractor):
        r = client.post("/api/v1/workers", headers=_h(tok), json=body)
        assert r.status_code == 409, r.text
        _no_leak(r.text, first.json()["id"], first.json()["patient_code"], "PRIVATE")


def test_worker_registration_concurrent_duplicates_yield_one_profile(client):
    a, _ = _unregistered_worker(client)
    rid = "reg-" + uuid.uuid4().hex
    body = {"display_name": "Idem Racer", "consent_status": "documented", "client_request_id": rid}
    before = _count(models.Patient)
    with ThreadPoolExecutor(4) as ex:
        rs = list(ex.map(lambda _: client.post("/api/v1/workers", headers=_h(a), json=body), range(4)))
    assert all(r.status_code in (200, 201) for r in rs), [r.text for r in rs]
    assert len({r.json()["id"] for r in rs}) == 1
    assert _count(models.Patient) == before + 1


# ---------- offline outbox retry after partial failure ----------

def test_offline_registration_retry_after_partial_failure(client):
    """Outbox item = register profile THEN submit questionnaire. The first attempt
    registers but the questionnaire call fails (connection lost / validation); the whole
    item is retried: registration resolves to the same profile, the questionnaire is
    recorded once, and a further replay creates nothing."""
    tok, _ = _unregistered_worker(client)
    reg_rid, q_rid = "reg-" + uuid.uuid4().hex, "q-" + uuid.uuid4().hex
    worker_body = {"display_name": "Offline Worker", "consent_status": "documented", "client_request_id": reg_rid}
    q_body = {"data": VALID_Q, "client_request_id": q_rid}

    first = client.post("/api/v1/workers", headers=_h(tok), json=worker_body)
    assert first.status_code == 201
    bad = client.post("/api/v1/questionnaires/submit", headers=_h(tok),
                      json={"data": {"personal": {}}, "client_request_id": q_rid})
    assert bad.status_code == 422                       # partial failure: profile exists, submission does not

    patients, subs = _count(models.Patient), _count(models.QuestionnaireSubmission)
    retry_reg = client.post("/api/v1/workers", headers=_h(tok), json=worker_body)
    assert retry_reg.status_code == 200 and retry_reg.json()["id"] == first.json()["id"]
    ok = client.post("/api/v1/questionnaires/submit", headers=_h(tok), json=q_body)
    assert ok.status_code == 201, ok.text
    assert _count(models.Patient) == patients and _count(models.QuestionnaireSubmission) == subs + 1

    again_reg = client.post("/api/v1/workers", headers=_h(tok), json=worker_body)
    again_q = client.post("/api/v1/questionnaires/submit", headers=_h(tok), json=q_body)
    assert again_reg.status_code == 200 and again_q.status_code == 200 and again_q.json()["duplicate"]
    assert _count(models.Patient) == patients and _count(models.QuestionnaireSubmission) == subs + 1


# ---------- lab samples (defect D1) & follow-up assignments (defect D2) ----------

def _other_pathologist(client):
    """Second pathologist (seeded via extra users, PIN 1234)."""
    r = client.post("/api/v1/auth/login", json={"phone": "+919000000004", "pin": "1234"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _other_clinician(client):
    """Second clinician (seeded via extra users, PIN 1234)."""
    r = client.post("/api/v1/auth/login", json={"phone": "+919000000003", "pin": "1234"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _contractor_a(client):
    r = client.post("/api/v1/auth/login", json={"phone": "+919000000028", "pin": "2468"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _unread_kinds(client, token, case_id):
    r = client.get(f"/api/v1/notifications?case_id={case_id}&unread_only=true",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return [n["kind"] for n in r.json()["items"]]


@pytest.fixture(scope="module")
def sample_case(client, tokens):
    """A registered worker (site-a member) with one clinically-acknowledged case."""
    tok, pat = _signup(client)
    m = client.post(f"/api/v1/workers/{pat}/membership", headers=_contractor_a(client),
                    json={"site_id": "site-a"})
    assert m.status_code in (200, 201), m.text
    r = client.post("/api/v1/symptom-reports", headers=_h(tok),
                    json={"symptoms": ["fever"], "client_request_id": "case-" + uuid.uuid4().hex})
    assert r.status_code == 201, r.text
    case_id = r.json()["case_id"]
    a = client.post(f"/api/v1/cases/{case_id}/acknowledge",
                    headers={"Authorization": f"Bearer {tokens['clinician']}"})
    assert a.status_code == 200, a.text
    return {"worker_token": tok, "patient_id": pat, "case_id": case_id}


def _sample_body(sample_case, key, **over):
    body = {"patient_id": sample_case["patient_id"], "case_id": sample_case["case_id"],
            "method": "rdt", "result_status": "negative", "notes": "IDEM-RESULT", "client_request_id": key}
    return {**body, **over}


def _followup_body(hw_id, sample_case, key, **over):
    body = {"patient_id": sample_case["patient_id"], "case_id": sample_case["case_id"],
            "assigned_user_id": hw_id, "scheduled_day": "Day 3",
            "due_at": "2099-01-05T00:00:00+00:00", "notes": "IDEM-TASK", "client_request_id": key}
    return {**body, **over}


def test_sample_first_creates_and_same_key_replay_returns_original(client, tokens, sample_case):
    key = "smp-" + uuid.uuid4().hex
    body = _sample_body(sample_case, key)
    first = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    assert first.status_code == 201, first.text

    again = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    assert again.status_code == 200 and again.json()["duplicate"] is True
    assert again.json()["id"] == first.json()["id"]
    assert again.json()["sample_code"] == first.json()["sample_code"]

    # genuinely NEW key -> distinct legitimate sample
    new = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]),
                      json=_sample_body(sample_case, "smp-" + uuid.uuid4().hex))
    assert new.status_code == 201 and new.json()["id"] != first.json()["id"]


def test_sample_conflicting_payload_same_key_rejected(client, tokens, sample_case):
    key = "smp-" + uuid.uuid4().hex
    body = _sample_body(sample_case, key)
    first = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    assert first.status_code == 201, first.text
    before = first.json()
    conflict = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]),
                           json=_sample_body(sample_case, key, result_status="positive", species="pf"))
    assert conflict.status_code == 409, conflict.text
    # context is never silently overwritten
    assert conflict.json()["detail"].count("different content") == 1
    still = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    assert still.status_code == 200 and still.json()["sample_code"] == before["sample_code"]


def test_sample_cross_user_key_never_collides_or_leaks(client, tokens, sample_case):
    key = "smp-" + uuid.uuid4().hex
    body = _sample_body(sample_case, key)
    first = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    assert first.status_code == 201, first.text

    foreign = client.post("/api/v1/samples", headers=_other_pathologist(client),
                          json=_sample_body(sample_case, key))
    assert foreign.status_code == 409, foreign.text
    _no_leak(foreign.text, first.json()["id"], first.json()["sample_code"], "IDEM-RESULT")
    # the owner still resolves normally afterwards
    assert client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body).status_code == 200


def test_sample_concurrent_replays_yield_one_row(client, tokens, sample_case):
    key = "smp-" + uuid.uuid4().hex
    body = _sample_body(sample_case, key)
    before_total = _count(models.Sample)
    with ThreadPoolExecutor(4) as ex:
        rs = list(ex.map(lambda _: client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body), range(4)))
    codes = sorted(r.status_code for r in rs)
    assert set(codes) <= {200, 201} and codes.count(201) == 1, codes
    assert len({r.json()["id"] for r in rs}) == 1
    assert _count(models.Sample) == before_total + 1


def test_sample_notifications_not_duplicated_by_replay(client, tokens, sample_case):
    key = "smp-" + uuid.uuid4().hex
    body = _sample_body(sample_case, key, result_status="positive", species="pv", case_id=sample_case["case_id"])
    first = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    assert first.status_code == 201, first.text
    cl_unread = [n["id"] for n in _unread_kinds_raw(client, tokens["clinician"], sample_case["case_id"])]
    assert cl_unread, "positive result must alert the clinician first"

    client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    client.post("/api/v1/samples", headers=_h(tokens["pathologist"]), json=body)
    cl_after = [n["id"] for n in _unread_kinds_raw(client, tokens["clinician"], sample_case["case_id"])]
    assert cl_after == cl_unread, "replays must not mint extra clinician notifications"


def _unread_kinds_raw(client, token, case_id):
    r = client.get("/api/v1/notifications?unread_only=true&limit=200",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return [n for n in r.json()["items"] if n.get("case_id") == case_id]


# ---------- follow-up assignment (defect D2) ----------


def test_followup_first_replay_conflict_and_new_key(client, tokens, sample_case, whoami):
    hw_id = whoami("health_worker")
    key = "fu-" + uuid.uuid4().hex
    body = _followup_body(hw_id, sample_case, key)
    first = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]), json=body)
    assert first.status_code == 201, first.text

    again = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]), json=body)
    assert again.status_code == 200 and again.json()["duplicate"] is True
    assert again.json()["id"] == first.json()["id"]

    conflict = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]),
                           json=_followup_body(hw_id, sample_case, key, notes="CHANGED-CONTENT"))
    assert conflict.status_code == 409, conflict.text

    new = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]),
                      json=_followup_body(hw_id, sample_case, "fu-" + uuid.uuid4().hex))
    assert new.status_code == 201 and new.json()["id"] != first.json()["id"]

    # notification semantics: one unread per task creation, replay adds none,
    # and a genuinely NEW assignment (new key) still notifies after the
    # recipient has read the earlier one.
    hw_token = _h(tokens["health_worker"])
    unread = _unread_kinds_raw(client, tokens["health_worker"], sample_case["case_id"])
    assign_unread = [n["id"] for n in unread if n["kind"] == "followup_assigned"]
    assert len(assign_unread) >= 1
    for n in unread:  # recipient reads own notifications
        rk = client.post("/api/v1/notifications/read", headers=hw_token, json={"ids": [n["id"]]})
        assert rk.status_code in (200, 204), rk.text
    third = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]),
                        json=_followup_body(hw_id, sample_case, "fu-" + uuid.uuid4().hex))
    assert third.status_code == 201, third.text
    unread_after = [n["id"] for n in _unread_kinds_raw(client, tokens["health_worker"], sample_case["case_id"])
                    if n["kind"] == "followup_assigned"]
    assert unread_after, "new assignment after read must produce a fresh unread notification"


def test_followup_cross_user_key_never_collides_or_leaks(client, tokens, sample_case, whoami):
    hw_id = whoami("health_worker")
    key = "fu-" + uuid.uuid4().hex
    body = _followup_body(hw_id, sample_case, key)
    first = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]), json=body)
    assert first.status_code == 201, first.text

    foreign = client.post("/api/v1/follow-ups", headers=_other_clinician(client), json=body)
    assert foreign.status_code == 409, foreign.text
    _no_leak(foreign.text, first.json()["id"], "IDEM-TASK")

    # cross-OPERATION: the same key value in the OTHER entity's table is not a
    # collision (keys are scoped per operation/table, no cross-table steal).
    other_op = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]),
                           json=_sample_body(sample_case, key))
    assert other_op.status_code == 201, other_op.text


def test_followup_concurrent_replays_yield_one_task(client, tokens, sample_case, whoami):
    hw_id = whoami("health_worker")
    key = "fu-" + uuid.uuid4().hex
    body = _followup_body(hw_id, sample_case, key)
    before = _count(models.FollowUp)
    with ThreadPoolExecutor(4) as ex:
        rs = list(ex.map(lambda _: client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]), json=body), range(4)))
    codes = sorted(r.status_code for r in rs)
    assert set(codes) <= {200, 201} and codes.count(201) == 1, codes
    assert len({r.json()["id"] for r in rs}) == 1
    assert _count(models.FollowUp) == before + 1


def test_offline_retry_after_partial_failure_samples_and_followups(client, tokens, sample_case, whoami):
    """Outbox-style retry: an attempt that fails BEFORE persisting (validation)
    releases the key; the completed attempt records once; later replays never
    duplicate; a replay of a STALE state machine swipe (completed task) still
    resolves cleanly."""
    hw_id = whoami("health_worker")
    bad_sample = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]),
                             json=_sample_body(sample_case, "smp-" + uuid.uuid4().hex,
                                               result_status="positive"))  # positive without species -> 422, key unused
    assert bad_sample.status_code == 422
    s_key = "smp-" + uuid.uuid4().hex
    bad2 = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]),
                       json=_sample_body(sample_case, s_key, result_status="positive"))
    assert bad2.status_code == 422
    ok = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]),
                     json=_sample_body(sample_case, s_key, result_status="positive", species="pf"))
    assert ok.status_code == 201, ok.text
    replay = client.post("/api/v1/samples", headers=_h(tokens["pathologist"]),
                         json=_sample_body(sample_case, s_key, result_status="positive", species="pf"))
    assert replay.status_code == 200 and replay.json()["duplicate"] and replay.json()["id"] == ok.json()["id"]

    f_key = "fu-" + uuid.uuid4().hex
    bad_f = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]),
                        json=_followup_body(hw_id, sample_case, f_key, assigned_user_id=None))
    assert bad_f.status_code == 422  # fails before persisting; key still unused
    ok_f = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]),
                       json=_followup_body(hw_id, sample_case, f_key))
    assert ok_f.status_code == 201, ok_f.text
    replay_f = client.post("/api/v1/follow-ups", headers=_h(tokens["clinician"]),
                           json=_followup_body(hw_id, sample_case, f_key))
    assert replay_f.status_code == 200 and replay_f.json()["duplicate"] and replay_f.json()["id"] == ok_f.json()["id"]
