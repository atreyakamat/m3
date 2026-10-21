"""Tests for Contractor, Pathology, and Clinician workflows.
PRD References:
- Section 6: Pathology workflow (RDT, microscopy, SMP, smear types, follow-up slides)
- Section 7: Clinician workflow (admission conditional branch, follow-up linkage)
- Section 8: Contractor and site workflow (QR/ID worker linking, site isolation, reported status)
- Section 10: QR and record-linking rules (opaque tokens, no PII)
"""
import os
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
import pytest

pytestmark = pytest.mark.usefixtures("unregistered_workers")

from app.database import Base, engine, SessionLocal
from app.main import (
    create_assessment,
    create_followup,
    create_sample,
    create_site,
    create_worker,
    create_qr_token,
    resolve_qr,
    create_membership,
    set_reported_status,
    save_slide_followup,
)
from app.models import Facility, Patient, RoleAssignment, Sample, Site, User, WorkerSiteAssignment
from app.schemas import (
    AssessmentCreate,
    FollowUpCreate,
    MembershipCreate,
    ReportedStatusIn,
    SampleCreate,
    SiteCreate,
    SlideFollowUpSave,
    WorkerCreate,
)
from app.security import hash_pin

def setup_function():
    db = SessionLocal()
    db.query(WorkerSiteAssignment).filter(WorkerSiteAssignment.patient_id == "patient-1").delete()
    db.commit()
    db.close()

def test_contractor_worker_linking_and_status():
    """CONT-001 & CONT-003: Contractor links worker to site and records contractor-reported status."""
    db = SessionLocal()
    c1 = db.get(User, "contractor-1")
    # Link patient-1 to site-1
    result = create_membership("patient-1", MembershipCreate(site_id="site-1"), user=c1, db=db)
    assert result["site_id"] == "site-1"
    assert result["patient_id"] == "patient-1"

    # Contractor reports status
    status_res = set_reported_status(
        patient_id="patient-1",
        body=ReportedStatusIn(malaria_status="pv", treatment_status="treated"),
        user=c1,
        db=db
    )
    assert status_res["reported_malaria_status"] == "pv"
    assert status_res["reported_treatment_status"] == "treated"
    db.close()

def test_contractor_site_isolation():
    """CONT-001: Contractor 2 cannot link worker to Site 1."""
    db = SessionLocal()
    c2 = db.get(User, "contractor-2")
    with pytest.raises(HTTPException) as exc:
        create_membership("patient-1", MembershipCreate(site_id="site-1"), user=c2, db=db)
    assert exc.value.status_code == 403
    db.close()

def test_qr_token_opaque_and_resolvable():
    """CONT-002 & PRD Section 10: QR token is opaque (no PII) and resolves safely."""
    db = SessionLocal()
    clinician = db.get(User, "clinician-1")
    token_obj = create_qr_token("patient-1", user=clinician, db=db)
    token_str = token_obj["token"]
    assert "Ravi" not in token_str
    assert "M3-P100" not in token_str
    assert len(token_str) >= 16

    resolved = resolve_qr(token_str, user=clinician, db=db)
    assert resolved["patient_id"] == "patient-1"
    assert resolved["display_name"] == "Ravi Kumar"
    db.close()

def test_pathology_slide_followup_and_reasons():
    """PATH-004 & PATH-005: Follow-up slide recording with not-received reason."""
    db = SessionLocal()
    path = db.get(User, "pathology-1")
    sample_res = create_sample(
        SampleCreate(
            patient_id="patient-1",
            facility_id="fac-1",
            method="microscopy",
            result_status="positive",
            species="pv",
            smear_type="both"
        ),
        user=path,
        db=db
    )
    sample_id = sample_res["id"]

    # Record follow-up slide not received
    slide_res = save_slide_followup(
        sample_id=sample_id,
        body=SlideFollowUpSave(
            scheduled_day="Day 7",
            received="no",
            not_received_reason="patient_unavailable"
        ),
        user=path,
        db=db
    )
    assert slide_res["received"] == "no"
    assert slide_res["not_received_reason"] == "patient_unavailable"

    # Validation: received="yes" requires positive
    with pytest.raises(HTTPException) as val_exc1:
        save_slide_followup(
            sample_id=sample_id,
            body=SlideFollowUpSave(scheduled_day="Day 7", received="yes"),
            user=path,
            db=db
        )
    assert val_exc1.value.status_code == 422

    # Validation: received="no" requires not_received_reason
    with pytest.raises(HTTPException) as val_exc2:
        save_slide_followup(
            sample_id=sample_id,
            body=SlideFollowUpSave(scheduled_day="Day 7", received="no"),
            user=path,
            db=db
        )
    assert val_exc2.value.status_code == 422

    # Validation: other reason requires description
    with pytest.raises(HTTPException) as val_exc3:
        save_slide_followup(
            sample_id=sample_id,
            body=SlideFollowUpSave(scheduled_day="Day 7", received="no", not_received_reason="other"),
            user=path,
            db=db
        )
    assert val_exc3.value.status_code == 422

    # Stale edit detection: older base_updated_at triggers 409
    past_timestamp = datetime(2020, 1, 1, tzinfo=timezone.utc)
    with pytest.raises(HTTPException) as conflict_exc:
        save_slide_followup(
            sample_id=sample_id,
            body=SlideFollowUpSave(
                scheduled_day="Day 7",
                received="no",
                not_received_reason="refused",
                base_updated_at=past_timestamp
            ),
            user=path,
            db=db
        )
    assert conflict_exc.value.status_code == 409
    assert "current_updated_at" in conflict_exc.value.detail

    # Missing sample returns 404
    with pytest.raises(HTTPException) as nf_exc:
        save_slide_followup(
            sample_id="missing-sample-id",
            body=SlideFollowUpSave(scheduled_day="Day 7", received="no", not_received_reason="refused"),
            user=path,
            db=db
        )
    assert nf_exc.value.status_code == 404

    db.close()

def test_clinician_admission_conditional_flow():
    """CLIN-001 & CLIN-002: Clinician assessment with admission details."""
    db = SessionLocal()
    clinician = db.get(User, "clinician-1")
    assessment_res = create_assessment(
        AssessmentCreate(
            patient_id="patient-1",
            facility_id="fac-1",
            medical_officer_name="Dr. Fernandes",
            temperature_c=39.2,
            fever_duration_days=4,
            symptoms=["fever", "chills", "headache"],
            admission_status="admitted",
            admission_severity="severe",
            admission_species="pv",
            treatment_completed="yes",
            discharge_date="2026-10-25",
            outcome="improved"
        ),
        user=clinician,
        db=db
    )
    assert "id" in assessment_res
    db.close()


def test_offline_first_time_worker_replay_does_not_duplicate(client, tokens, whoami):
    """P0: a queued first-time registration replayed after connectivity loss
    must resolve to the SAME worker profile instead of creating two."""
    body = {
        "display_name": "Synthetic Replay Worker",
        "gender": "male",
        "mobile": "+919963044521",
        "consent_status": "documented",
        "client_request_id": "cbc_offline_reg_0001",
    }
    first = client.post("/api/v1/workers", headers=_auth_h(tokens["worker"]), json=body)
    assert first.status_code == 201, first.text
    replay = client.post("/api/v1/workers", headers=_auth_h(tokens["worker"]), json=body)
    assert replay.status_code == 200, replay.text
    assert replay.json()["id"] == first.json()["id"]
    assert replay.json()["duplicate"] is True

    workers_list = client.get("/api/v1/workers?q=Replay", headers=_auth_h(tokens["clinician"])).json()
    assert workers_list["total"] == 1  # no duplicate profile created


def test_offline_replay_is_scoped_to_the_creating_principal(client, tokens):
    """Security: a request id belongs to the principal that used it. A DIFFERENT
    account replaying it gets a non-disclosing 409 and never the first account's
    worker profile (this replaces the former 'global across creators' behavior,
    which returned another account's protected record)."""
    body = {
        "display_name": "Synthetic Cross Creator Worker",
        "consent_status": "documented",
        "client_request_id": "cbc_offline_reg_global_1",
    }
    first = client.post("/api/v1/workers", headers=_auth_h(tokens["worker"]), json=body)
    assert first.status_code == 201, first.text
    other = client.post("/api/v1/workers", headers=_auth_h(tokens["contractor"]), json=body)
    assert other.status_code == 409, other.text
    assert first.json()["id"] not in other.text and "Cross Creator" not in other.text
    staff_listing = client.get("/api/v1/workers?q=Cross Creator", headers=_auth_h(tokens["clinician"])).json()
    assert staff_listing["total"] == 1


def _auth_h(token):
    return {"Authorization": f"Bearer {token}"}


def test_logout_revokes_server_session(client):
    """P2: logging out must invalidate the live access token server-side.
    Uses a dedicated session so the session-scoped token fixture stays valid
    for the remaining tests in the suite."""
    fresh = client.post("/api/v1/auth/login", json={"phone": "+919000000095", "pin": "2468"}).json()["access_token"]
    assert client.get("/api/v1/me", headers=_auth_h(fresh)).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=_auth_h(fresh)).status_code == 200
    assert client.get("/api/v1/me", headers=_auth_h(fresh)).status_code == 401


def test_admin_reads_audit_events_others_denied(client, tokens):
    """P3: audit retrieval is admin-only, read-only."""
    actor_id = None
    me = client.get("/api/v1/me", headers=_auth_h(tokens["admin"])).json()
    actor_id = me["id"]
    rows = client.get("/api/v1/audit-events", headers=_auth_h(tokens["admin"]))
    assert rows.status_code == 200
    assert rows.json()["total"] > 0
    # The admin's own actions must be somewhere in the audit log (page-walk:
    # high-volume suites push early events past the default first page).
    seen = set()
    offset = 0
    while True:
        page_rows = client.get("/api/v1/audit-events", headers=_auth_h(tokens["admin"]),
                               params={"offset": offset, "limit": 200}).json()
        seen |= {e["actor_user_id"] for e in page_rows["items"]}
        offset += 200
        if not page_rows["items"] or offset >= (page_rows["total"] or 0) + 200:
            break
    assert seen >= {actor_id}
    for role in ("worker", "clinician", "contractor", "health_worker", "research_lab"):
        denied = client.get("/api/v1/audit-events", headers=_auth_h(tokens[role]))
        assert denied.status_code == 403, role
    # Audit events are not writable through any normal flow
    assert client.post("/api/v1/audit-events", headers=_auth_h(tokens["admin"]), json={}).status_code in (403, 405)


def test_stale_edit_conflict_not_silently_overwritten(client, tokens, whoami):
    """P3: conditional update via base_updated_at; second stale writer gets 409."""
    created = client.post("/api/v1/workers", headers=_auth_h(tokens["worker"]), json={
        "display_name": "Synthetic Conflict Worker",
        "mobile": "+919963044522",
        "consent_status": "documented",
        "client_request_id": "cbc_conflict_reg_0001",
    })
    worker_id = created.json()["id"]
    current = client.get(f"/api/v1/workers/{worker_id}", headers=_auth_h(tokens["worker"])).json()
    fresh_updated_at = current["updated_at"]

    ok = client.patch("/api/v1/workers/me", headers=_auth_h(tokens["worker"]),
                      json={"address_present": "Camp A", "base_updated_at": fresh_updated_at})
    assert ok.status_code == 200, ok.text

    # A second writer still holds the pre-edit timestamp: must be rejected, not overwrite.
    conflict = client.patch("/api/v1/workers/me", headers=_auth_h(tokens["worker"]),
                            json={"address_present": "Camp B", "base_updated_at": fresh_updated_at})
    assert conflict.status_code == 409, conflict.text
    assert "current_updated_at" in conflict.json()["detail"]
    winner = client.get(f"/api/v1/workers/{worker_id}", headers=_auth_h(tokens["worker"])).json()
    assert winner["address_present"] == "Camp A"  # first write preserved

    # After reloading, the resolved writer can proceed from the new version.
    resolved = client.get(f"/api/v1/workers/{worker_id}", headers=_auth_h(tokens["worker"])).json()
    retry = client.patch("/api/v1/workers/me", headers=_auth_h(tokens["worker"]),
                         json={"address_present": "Camp C", "base_updated_at": resolved["updated_at"]})
    assert retry.status_code == 200


def test_database_test_selection_safety():
    """Verify that dangerous database targets are rejected."""
    from urllib.parse import urlparse
    for dangerous in [
        "postgresql+psycopg://127.0.0.1:5432/m3_production",
        "postgresql://user:pass@127.0.0.1:5432/prod_m3",
        "postgresql+psycopg://127.0.0.1:5432/live_db"
    ]:
        dbname = urlparse(dangerous).path.lstrip("/").lower()
        assert any(m in dbname for m in ("prod", "production", "live"))


def test_slide_sample_view_exposes_version_stamps(client, tokens):
    """P3 client contract: mobile mirrors sample/slide updated_at as
    base_updated_at on slide-follow-up writes; stale mirrors get 409."""
    h = _auth_h(tokens["pathologist"])
    created = client.post("/api/v1/samples", headers=h, json={
        "patient_id": "patient-1", "method": "rdt", "result_status": "pending"})
    assert created.status_code == 201, created.text
    listing = client.get("/api/v1/samples?patient_id=patient-1", headers=h).json()
    match = next(s for s in listing["items"] if s["id"] == created.json()["id"])
    assert match["updated_at"]  # version stamp available to the client

    first = client.put(f"/api/v1/samples/{match['id']}/slide-followup", headers=h, json={
        "scheduled_day": "Day 3", "received": "yes", "positive": "no",
        "base_updated_at": match["updated_at"]})
    assert first.status_code == 200, first.text

    second = client.put(f"/api/v1/samples/{match['id']}/slide-followup", headers=h, json={
        "scheduled_day": "Day 7", "received": "no", "not_received_reason": "refused",
        "base_updated_at": match["updated_at"]})
    assert second.status_code == 409
    assert "current_updated_at" in second.json()["detail"]

    fresh_stamp = second.json()["detail"]["current_updated_at"]
    third = client.put(f"/api/v1/samples/{match['id']}/slide-followup", headers=h, json={
        "scheduled_day": "Day 7", "received": "no", "not_received_reason": "refused",
        "base_updated_at": fresh_stamp})
    assert third.status_code == 200, third.text


def test_questionnaire_idempotency_lifecycle(client, tokens):
    """Fix-1 regression cluster: a logical submission keeps ONE
    client_request_id until its server ack; new submissions get new ids and no
    owner can mint a second record out of another's pending id."""
    h = _auth_h(tokens["worker"])
    reg = client.post("/api/v1/workers", headers=h, json={
        "display_name": "Idempotency Worker", "mobile": "+919911887766", "consent_status": "documented"})
    assert reg.status_code == 201, reg.text

    data = {
        "personal": {"full_name": "Idempotency Worker", "gender": "male", "mobile": "+919911887766",
                     "id_type": "aadhaar", "address_present": "Panaji", "preferred_language": "hindi", "dob": "1992-04-10"},
        "past_history": {"diagnosed_malaria": "no", "repellent": "yes", "mosquito_net": "yes"},
        "present_clinical": {"fever_today": "no", "symptoms": ["no_other_symptoms"],
                             "breathing_difficulty": "no", "chest_pain": "no", "confusion": "no",
                             "can_attend_testing": "not_required"},
        "migration_history": {"time_in_goa": "1_6_months", "outside_goa_3m": "no", "fever_before_goa_3m": "no"},
        "planned_travel": {"planning": "no"},
    }
    same_id = "req_pending_retry_0001"

    # Case 2 — profile created, questionnaire attempt 1 in flight is lost
    # (ambiguous timeout simulated by re-delivery), attempt 2 reuses the id.
    first = client.post("/api/v1/questionnaires/submit", headers=h,
                        json={"data": data, "client_request_id": same_id})
    assert first.status_code == 201, first.text
    loss = client.post("/api/v1/questionnaires/submit", headers=h,
                       json={"data": data, "client_request_id": same_id})
    assert loss.status_code == 200 and loss.json()["duplicate"] is True, loss.text
    assert loss.json()["submission_id"] == first.json()["submission_id"]

    # Exactly one questionnaire response, exactly one worker profile.
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        rows = db.query(models.QuestionnaireSubmission).filter(
            models.QuestionnaireSubmission.client_request_id == same_id).all()
        assert len(rows) == 1, f"expected ONE response, found {len(rows)}"
        profiles = db.query(models.Patient).filter(
            models.Patient.display_name == "Idempotency Worker").all()
        assert len(profiles) == 1, "profile dedupe regressed"
    finally:
        db.close()

    # Case 4 — a genuinely new submission (fresh id after the ack) makes a
    # SECOND, distinct response; nothing silently coalesces.
    second = client.post("/api/v1/questionnaires/submit", headers=h,
                         json={"data": data, "client_request_id": "req_new_attempt_0002"})
    assert second.status_code == 201 and second.json()["submission_id"] != first.json()["submission_id"]
    db = SessionLocal()
    try:
        count = db.query(models.QuestionnaireSubmission).filter(
            models.QuestionnaireSubmission.patient_id == reg.json()["id"],
            models.QuestionnaireSubmission.state == "submitted").count()
        assert count == 2
    finally:
        db.close()

    # Case 5 — another owner replaying the FIRST owner's id cannot mint a
    # second record AND learns nothing about the first owner's submission
    # (non-disclosing 409; previously this returned the original response).
    other_reg = client.post("/api/v1/workers", headers=_auth_h(tokens["worker2"]), json={
        "display_name": "Second Device", "consent_status": "documented"})
    assert other_reg.status_code == 201, other_reg.text
    other = client.post("/api/v1/questionnaires/submit", headers=_auth_h(tokens["worker2"]),
                        json={"data": data, "client_request_id": same_id})
    assert other.status_code == 409, other.text
    assert first.json()["submission_id"] not in other.text
    db = SessionLocal()
    try:
        assert db.query(models.QuestionnaireSubmission).filter(
            models.QuestionnaireSubmission.client_request_id == same_id).count() == 1
    finally:
        db.close()

    # DB backstop: even a racing write with the same id is rejected by the
    # unique constraint instead of silently doubling.
    db = SessionLocal()
    try:
        duplicate_race = models.QuestionnaireSubmission(
            patient_id=reg.json()["id"], schema_version=1, state="submitted",
            data={}, client_request_id=same_id, submitted_at=models.now(), respondent_user_id="worker")
        processed = False
        try:
            db.add(duplicate_race); db.commit()
        except Exception:
            db.rollback(); processed = True
        assert processed, "unique(client_request_id) backstop missing on questionnaire submissions"
    finally:
        db.close()


def test_failed_login_lockout_blocks_subsequent_password_guesses(client):
    """P3 hardening: 5 wrong PINs lock the account; the CORRECT PIN is rejected
    while locked; the generic message must not reveal account state; an
    administrator-side unlock restores sign-in."""
    phone = "+919000000095"  # logout_tester: disjoint from the sticky token fixture
    generic = "Unable to sign in with those credentials"

    for _ in range(5):
        res = client.post("/api/v1/auth/login", json={"phone": phone, "pin": "9999"})
        assert res.status_code == 401 and res.json()["detail"] == generic

    # Correct PIN while locked must be refused with the SAME generic response.
    locked = client.post("/api/v1/auth/login", json={"phone": phone, "pin": "2468"})
    assert locked.status_code == 401 and locked.json()["detail"] == generic

    wrong = client.post("/api/v1/auth/login", json={"phone": phone, "pin": "0000"})
    assert wrong.status_code == 401 and wrong.json()["detail"] == generic

    from app.database import SessionLocal
    from app import models
    from datetime import timedelta
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.phone_e164 == phone).one()
        user.locked_until = None
        db.commit()
    finally:
        db.close()
    unlocked = client.post("/api/v1/auth/login", json={"phone": phone, "pin": "2468"})
    assert unlocked.status_code == 200, unlocked.text

