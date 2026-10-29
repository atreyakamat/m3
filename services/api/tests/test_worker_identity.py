"""Worker identity stability: one account <-> one worker profile, never silently re-pointed.

Defect reproduced here (synthetic data only): POST /workers by a worker account that
already owned a profile minted a SECOND Patient and overwrote users.patient_id, so
every Case/questionnaire/follow-up on the first profile vanished from the worker's
"My Cases" without any record being deleted (orphaned, still present in the DB).
"""
import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app import models
from app.database import SessionLocal

PIN = "2468"


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def _signup(client, phone, name="Identity Tester"):
    r = client.post("/api/v1/auth/signup", json={
        "phone": phone, "pin": PIN, "display_name": name, "role": "worker"})
    assert r.status_code == 201, r.text
    return r.json()


def _login(client, phone):
    r = client.post("/api/v1/auth/login", json={"phone": phone, "pin": PIN})
    assert r.status_code == 200, r.text
    return r.json()


def _register(client, token, **extra):
    body = {"display_name": "Identity Tester", "consent_status": "documented",
            "client_request_id": "reg-" + uuid.uuid4().hex, **extra}
    return client.post("/api/v1/workers", headers=_h(token), json=body)


def _report(client, token):
    return client.post("/api/v1/symptom-reports", headers=_h(token), json={
        "symptoms": ["fever"], "onset_category": "1_3_days", "attend_facility": "no",
        "contact_pref": "call", "client_request_id": "sym-" + uuid.uuid4().hex})


def _my_case_ids(client, token):
    r = client.get("/api/v1/cases", headers=_h(token))
    assert r.status_code == 200, r.text
    body = r.json()
    items = body["items"] if isinstance(body, dict) else body
    return {c["id"] for c in items}


@pytest.fixture()
def registered_worker(client):
    """Fresh signup (profile auto-created) + one case on that profile."""
    phone = "+9190" + str(uuid.uuid4().int)[:8]
    auth = _signup(client, phone)
    token = auth["access_token"]
    patient_id = auth["user"]["patient_id"]
    assert patient_id
    r = _report(client, token)
    assert r.status_code == 201, r.text
    return {"phone": phone, "token": token, "patient_id": patient_id, "case_id": r.json()["case_id"]}


def test_reregistration_does_not_orphan_cases(client, registered_worker):
    w = registered_worker
    assert w["case_id"] in _my_case_ids(client, w["token"])

    again = _register(client, w["token"])
    assert again.status_code == 200, again.text
    body = again.json()
    assert body["id"] == w["patient_id"], "re-registration must resolve to the existing profile"
    assert body.get("already_registered") is True

    me = client.get("/api/v1/me", headers=_h(w["token"])).json()
    assert me["patient_id"] == w["patient_id"]
    assert w["case_id"] in _my_case_ids(client, w["token"])


def test_repeat_login_after_reregistration_still_sees_history(client, registered_worker):
    w = registered_worker
    for _ in range(3):
        assert _register(client, w["token"]).status_code == 200
    fresh = _login(client, w["phone"])
    assert fresh["user"]["patient_id"] == w["patient_id"]
    assert w["case_id"] in _my_case_ids(client, fresh["access_token"])


def test_reregistration_creates_no_extra_patient_and_is_audited(client, registered_worker):
    w = registered_worker
    db = SessionLocal()
    try:
        before = db.scalar(text("SELECT COUNT(*) FROM patients"))
    finally:
        db.close()
    for _ in range(2):
        assert _register(client, w["token"]).status_code == 200
    db = SessionLocal()
    try:
        assert db.scalar(text("SELECT COUNT(*) FROM patients")) == before
        events = db.scalars(select(models.AuditEvent).where(
            models.AuditEvent.action == "worker.reregistration_blocked",
            models.AuditEvent.entity_id == w["patient_id"])).all()
        assert len(events) == 2
    finally:
        db.close()


def test_reregistration_with_different_phone_does_not_change_profile(client, registered_worker):
    w = registered_worker
    r = _register(client, w["token"], mobile="+919888777666", display_name="Someone Else")
    assert r.status_code == 200, r.text
    assert r.json()["id"] == w["patient_id"]
    detail = client.get("/api/v1/workers/me", headers=_h(w["token"])).json()
    assert detail["id"] == w["patient_id"]
    assert detail["display_name"] != "Someone Else", "re-registration must not overwrite the profile"


def test_database_rejects_two_accounts_on_one_profile(client, registered_worker):
    w = registered_worker
    db = SessionLocal()
    try:
        other = models.User(phone_e164="+9190" + str(uuid.uuid4().int)[:8], display_name="Dup",
                            pin_hash="x", patient_id=w["patient_id"])
        db.add(other)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()
    finally:
        db.close()


def test_signup_never_links_to_a_profile_already_claimed(client, registered_worker):
    """A claimed profile whose phone matches a new signup is NOT shared with the new account."""
    w = registered_worker
    db = SessionLocal()
    try:
        # Simulate a legacy profile sharing a phone with a later signup: the owner
        # of the profile is the first account, the new account must not steal it.
        patient = db.get(models.Patient, w["patient_id"])
        patient.phone_e164 = "+919777666555"
        db.commit()
    finally:
        db.close()
    r = client.post("/api/v1/auth/signup", json={
        "phone": "+919777666555", "pin": PIN, "display_name": "Second", "role": "worker"})
    assert r.status_code == 409, r.text
    db = SessionLocal()
    try:
        assert db.scalar(select(models.User).where(models.User.phone_e164 == "+919777666555")) is None
        assert db.get(models.User, db.scalar(
            select(models.User.id).where(models.User.patient_id == w["patient_id"]))).patient_id == w["patient_id"]
    finally:
        db.close()


def test_signup_links_unclaimed_contractor_profile_and_audits(client):
    phone = "+9190" + str(uuid.uuid4().int)[:8]
    db = SessionLocal()
    try:
        p = models.Patient(patient_code="M3-" + uuid.uuid4().hex[:8].upper(), display_name="Pre-registered",
                           phone_e164=phone, consent_status="documented")
        db.add(p); db.commit(); pid = p.id
    finally:
        db.close()
    auth = _signup(client, phone, "Pre-registered")
    assert auth["user"]["patient_id"] == pid
    db = SessionLocal()
    try:
        assert db.scalar(select(models.AuditEvent).where(
            models.AuditEvent.action == "worker.profile_linked_on_signup",
            models.AuditEvent.entity_id == pid)) is not None
    finally:
        db.close()


# ---- audited reconciliation tool (scripts/reconcile_worker_identity.py) ----

def _reconcile(*args):
    import os, pathlib, subprocess, sys
    script = None
    for p in pathlib.Path(__file__).resolve().parents:
        cand = p / "scripts" / "reconcile_worker_identity.py"
        if cand.exists():
            script = cand
            break
        cand_direct = p / "reconcile_worker_identity.py"
        if cand_direct.exists():
            script = cand_direct
            break
    if script is None:
        script = pathlib.Path(__file__).resolve().parents[-1] / "scripts" / "reconcile_worker_identity.py"
    return subprocess.run([sys.executable, str(script), *args], capture_output=True, text=True,
                          env={**os.environ})


def test_reconcile_relinks_orphan_with_audit_and_is_reversible(client, registered_worker):
    w = registered_worker
    db = SessionLocal()
    try:
        user = db.scalar(select(models.User).where(models.User.patient_id == w["patient_id"]))
        orphan = models.Patient(patient_code="M3-" + uuid.uuid4().hex[:8].upper(), display_name="Orphan",
                                created_by_user_id=user.id, consent_status="documented")
        db.add(orphan); db.commit(); uid, orphan_id = user.id, orphan.id
    finally:
        db.close()

    # Report mode is read-only and lists the candidate.
    rep = _reconcile()
    assert rep.returncode == 0, rep.stderr
    assert orphan_id in rep.stdout

    # Current profile holds a case: relinking would orphan it -> refused.
    refused = _reconcile("--user", uid, "--patient", orphan_id, "--reason", "t", "--apply")
    assert refused.returncode != 0 and "would orphan" in (refused.stderr + refused.stdout)

    # Dry run changes nothing even with the acknowledgement.
    dry = _reconcile("--user", uid, "--patient", orphan_id, "--reason", "t",
                     "--acknowledge-current-profile-orphaned")
    assert dry.returncode == 0 and "DRY RUN" in dry.stdout
    assert client.get("/api/v1/me", headers=_h(w["token"])).json()["patient_id"] == w["patient_id"]

    ok = _reconcile("--user", uid, "--patient", orphan_id, "--reason", "synthetic test",
                    "--acknowledge-current-profile-orphaned", "--apply")
    assert ok.returncode == 0, ok.stderr + ok.stdout
    assert client.get("/api/v1/me", headers=_h(w["token"])).json()["patient_id"] == orphan_id
    db = SessionLocal()
    try:
        ev = db.scalar(select(models.AuditEvent).where(
            models.AuditEvent.action == "worker.identity_reconciled", models.AuditEvent.entity_id == orphan_id))
        assert ev and ev.detail["previous_patient_id"] == w["patient_id"] and ev.detail["reason"] == "synthetic test"
        # Nothing was merged or deleted: the original profile and its case still exist.
        assert db.get(models.Patient, w["patient_id"]) is not None
        assert db.get(models.Case, w["case_id"]).patient_id == w["patient_id"]
    finally:
        db.close()

    # Reverse: the old profile is now unclaimed and was created by this account.
    back = _reconcile("--user", uid, "--patient", w["patient_id"], "--reason", "revert",
                      "--acknowledge-current-profile-orphaned", "--apply")
    assert back.returncode == 0, back.stderr + back.stdout
    assert w["case_id"] in _my_case_ids(client, w["token"])


def test_reconcile_refuses_profile_claimed_by_another_account(client, registered_worker):
    w = registered_worker
    other = _signup(client, "+9190" + str(uuid.uuid4().int)[:8])
    db = SessionLocal()
    try:
        uid = db.scalar(select(models.User.id).where(models.User.patient_id == w["patient_id"]))
    finally:
        db.close()
    r = _reconcile("--user", uid, "--patient", other["user"]["patient_id"], "--reason", "t",
                   "--allow-different-creator", "--acknowledge-current-profile-orphaned", "--apply")
    assert r.returncode != 0 and "already claimed" in (r.stderr + r.stdout)
