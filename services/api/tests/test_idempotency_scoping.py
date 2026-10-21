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
