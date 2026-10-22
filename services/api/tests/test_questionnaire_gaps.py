"""Regression tests for the confirmed questionnaire-update gaps.

Every test traces to a confirmed gap in docs/QUESTIONNAIRE_GAP_IMPLEMENTATION.md
(G1 SMP/smear alignment, G2 patient-code resolution + new-column persistence,
G3 planned-departure rule on /travel, G4 positive-result species requiredness,
reporter-status scoping, stale-hidden-field tolerance documentation).
Direct endpoint-function calls follow the precedent of test_workflows.py; one
HTTP-level test covers the true client path for travel.
"""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.main import (add_travel, assessments, create_assessment, create_membership,
                      create_sample, set_reported_status)
from app.models import ClinicalAssessment, User, WorkerSiteAssignment
from app.schemas import (AssessmentCreate, MembershipCreate, ReportedStatusIn,
                         SampleCreate, TravelEpisodeCreate)
from app import questionnaire as questionnaire_schema


def _db():
    return SessionLocal()


def _user(db, user_id):
    return db.get(User, user_id)


# ---------------- G3: /travel planned-departure rule ----------------

def test_travel_planned_departure_cannot_be_in_the_past():
    db = _db()
    clinician = _user(db, "clinician-1")
    past = (date.today() - timedelta(days=3)).isoformat()
    with pytest.raises(HTTPException) as exc:
        add_travel("patient-1", TravelEpisodeCreate(
            origin="Goa", destination="West Bengal",
            departure_date=past, planned=True), user=clinician, db=db)
    assert exc.value.status_code == 422
    assert "Planned departure" in exc.value.detail
    db.close()


def test_travel_planned_departure_today_is_allowed():
    db = _db()
    clinician = _user(db, "clinician-1")
    today = date.today().isoformat()
    result = add_travel("patient-1", TravelEpisodeCreate(
        origin="Goa", destination="West Bengal",
        departure_date=today, planned=True), user=clinician, db=db)
    assert result["id"]
    db.close()


def test_travel_historical_dates_stay_allowed_when_not_planned():
    db = _db()
    clinician = _user(db, "clinician-1")
    past = (date.today() - timedelta(days=30)).isoformat()
    result = add_travel("patient-1", TravelEpisodeCreate(
        origin="West Bengal", destination="Goa",
        departure_date=past, return_date=past, arrival_date=past, planned=False),
        user=clinician, db=db)
    assert result["id"]
    db.close()


def test_travel_return_before_departure_rejected():
    db = _db()
    clinician = _user(db, "clinician-1")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    today = date.today().isoformat()
    with pytest.raises(HTTPException) as exc:
        add_travel("patient-1", TravelEpisodeCreate(
            origin="Goa", destination="West Bengal",
            departure_date=tomorrow, return_date=today, planned=True),
            user=clinician, db=db)
    assert exc.value.status_code == 422
    assert "Return date" in exc.value.detail
    db.close()


def test_travel_planned_past_departure_rejected_over_http(client, tokens):
    past = (date.today() - timedelta(days=1)).isoformat()
    response = client.post(
        "/api/v1/workers/patient-1/travel",
        headers={"Authorization": f"Bearer {tokens['clinician']}"},
        json={"origin": "Goa", "destination": "West Bengal",
              "departure_date": past, "planned": True})
    assert response.status_code == 422
    assert "Planned departure" in response.json()["detail"]


# ---------------- G2: assessment patient-code resolution + columns ----------------

def _fresh_patient(db, code_suffix, memo):
    """Assessments flip `patients.screening_completed` (SCR-009), so tests here
    must use their own worker and never the shared patient-1 fixture."""
    from app.models import Patient, uid
    patient = Patient(id=uid(), patient_code=f"M3-GAP-{code_suffix}",
                      display_name=memo)
    db.add(patient)
    db.commit()
    return patient


def test_assessment_accepts_patient_code_and_uuid():
    db = _db()
    clinician = _user(db, "clinician-1")
    patient = _fresh_patient(db, "CODE", "Gap Code Lookup")
    by_code = create_assessment(AssessmentCreate(
        patient_id=patient.patient_code, medical_officer_name="Dr. Code Lookup",
        temperature_c=37.2),
        user=clinician, db=db)
    assert "id" in by_code
    by_uuid = create_assessment(AssessmentCreate(
        patient_id=patient.id, medical_officer_name="Dr. Uuid",
        temperature_c=37.5,
        # The first encounter marked the worker screened, so this one is an
        # authorized re-screen and carries a reason (SCR-009).
        re_screening_reason="follow-up visit"),
        user=clinician, db=db)
    assert "id" in by_uuid
    db.close()


def test_assessment_unknown_patient_404():
    db = _db()
    clinician = _user(db, "clinician-1")
    with pytest.raises(HTTPException) as exc:
        create_assessment(AssessmentCreate(patient_id="M3-NOPE", temperature_c=37.0),
                          user=clinician, db=db)
    assert exc.value.status_code == 404
    db.close()


def test_assessment_new_source_columns_persisted_and_serialized():
    db = _db()
    clinician = _user(db, "clinician-1")
    patient = _fresh_patient(db, "COLS", "Gap Source Columns")
    result = create_assessment(AssessmentCreate(
        patient_id=patient.id,
        medical_officer_name="Dr. Source Fields",
        symptoms=["chills_rigors", "other"],
        symptoms_other_note="Tingling in feet",
        admission_status="outpatient",
        treatment_given="yes",
        follow_up_assigned="yes",
    ), user=clinician, db=db)
    assessment_id = result["id"]
    row = db.get(ClinicalAssessment, assessment_id)
    assert row.symptoms_other_note == "Tingling in feet"
    assert row.treatment_given == "yes"
    assert row.follow_up_assigned == "yes"

    listing = assessments(patient_id=patient.id, user=clinician, db=db)
    item = next(i for i in listing["items"] if i["id"] == assessment_id)
    assert item["symptoms_other_note"] == "Tingling in feet"
    assert item["treatment_given"] == "yes"
    assert item["follow_up_assigned"] == "yes"
    db.close()


def test_assessment_admitted_other_species_note_persisted():
    db = _db()
    clinician = _user(db, "clinician-1")
    patient = _fresh_patient(db, "ADMIT", "Gap Admission Fields")
    result = create_assessment(AssessmentCreate(
        patient_id=patient.id,
        admission_status="admitted",
        admission_species="other",
        admission_species_other_note="P. knowlesi (labs pending)",
        admission_severity="mild",
        treatment_completed="no_still_on_treatment",
        treatment_incomplete_reason="Transferred to district GMC",
    ), user=clinician, db=db)
    row = db.get(ClinicalAssessment, result["id"])
    assert row.admission_species_other_note == "P. knowlesi (labs pending)"
    assert row.treatment_completed == "no_still_on_treatment"
    db.close()


# ---------------- G1/G4: sample method/smear + positive/species ----------------

def test_sample_smear_type_accepted_for_smp_and_microscopy():
    db = _db()
    pathologist = _user(db, "pathology-1")
    for method, smear in (("smp", "both"), ("smp", "thin"), ("microscopy", "thick")):
        result = create_sample(SampleCreate(
            patient_id="patient-1", facility_id="fac-1", method=method,
            result_status="negative", smear_type=smear), user=pathologist, db=db)
        assert result["status"] == "negative"
    db.close()


def test_sample_smear_type_still_rejected_for_rdt():
    db = _db()
    pathologist = _user(db, "pathology-1")
    with pytest.raises(HTTPException) as exc:
        create_sample(SampleCreate(
            patient_id="patient-1", method="rdt",
            result_status="negative", smear_type="thick"), user=pathologist, db=db)
    assert exc.value.status_code == 422
    db.close()


def test_sample_positive_requires_species():
    db = _db()
    pathologist = _user(db, "pathology-1")
    with pytest.raises(HTTPException) as exc:
        create_sample(SampleCreate(
            patient_id="patient-1", method="rdt", result_status="positive"),
            user=pathologist, db=db)
    assert exc.value.status_code == 422
    assert "Species is required" in exc.value.detail
    result = create_sample(SampleCreate(
        patient_id="patient-1", method="rdt", result_status="positive", species="pv"),
        user=pathologist, db=db)
    assert result["status"] == "positive"
    db.close()


# ---------------- Contractor: reported-status isolation ----------------

def test_reported_status_scoped_to_contractors_active_membership(client, tokens):
    """A dedicated worker is created so this test does not touch the shared
    patient-1 assignment used by other suites (one active assignment per worker)."""
    db = SessionLocal()
    try:
        from app.models import Patient, uid
        patient = Patient(id=uid(), patient_code="M3-GAP-STATUS", display_name="Gap Status Worker")
        db.add(patient)
        db.commit()
        patient_id = patient.id
        contractor_token = tokens["contractor"]  # scoped to site-a
        membership = client.post(
            f"/api/v1/workers/{patient_id}/membership",
            headers={"Authorization": f"Bearer {contractor_token}"},
            json={"site_id": "site-a"})
        assert membership.status_code == 201, membership.text

        status = client.put(
            f"/api/v1/workers/{patient_id}/reported-status",
            headers={"Authorization": f"Bearer {contractor_token}"},
            json={"malaria_status": "pv", "treatment_status": "treated"})
        assert status.status_code == 200, status.text
        assert status.json()["reported_malaria_status"] == "pv"

        # A contractor without an active assignment at an authorized site is rejected.
        response = client.put(
            f"/api/v1/workers/{patient_id}/reported-status",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
            json={"malaria_status": "pv", "treatment_status": "treated"})
        assert response.status_code in (403, 404)

        db.expire_all()
        assignment = db.query(WorkerSiteAssignment).filter_by(patient_id=patient_id).first()
        assert assignment.reported_malaria_status == "pv"
        # Reported values never masquerade as lab-confirmed results.
        assert not hasattr(assignment, "test_result")
        db.rollback()
    finally:
        # Mark the assignment inactive so the single-active-assignment index
        # stays free for other suites.
        try:
            sha = db.query(WorkerSiteAssignment).filter_by(patient_id=patient_id).first()
            if sha:
                sha.end_date = date.today().isoformat()
                db.commit()
        except Exception:
            db.rollback()
        db.close()


# ---------------- Worker form: tolerance documentation ----------------

def test_stale_hidden_fields_are_tolerated_not_validated():
    """The server deliberately does NOT validate fields whose gating answer no
    longer holds (e.g. stale answers on a hidden branch): old offline drafts
    must not become invalid. The client payload builder purges them instead."""
    data = {
        "past_history": {
            "diagnosed_malaria": "no",
            "times_malaria_2y": 7,
            "test_method": "rdt",
            "full_course_completed": "yes",
        },
        "planned_travel": {"planning": "no", "episodes": [
            {"departure_date": "2026-10-01", "return_date": "2026-10-05",
             "place_state": "West Bengal", "fever_malaria_during": "yes"}]},
    }
    errors = questionnaire_schema.validate(data)
    hidden_paths = [
        e["path"] for e in errors
        if e["path"].startswith("past_history.times_malaria_2y")
        or e["path"].startswith("past_history.test_method")
        or e["path"].startswith("past_history.full_course_completed")
        or e["path"].startswith("planned_travel.episodes")
    ]
    assert hidden_paths == []


# =============================================================================
# Remediation (independent review): G3 requiredness + HTTP-level coverage.
# These tests use the real ASGI app (client fixture) so they exercise routing,
# Pydantic schemas, and endpoint validation exactly as clients do.
# =============================================================================

_PAT_BASE = {"patient_id": "patient-1"}

# ---------------- G3: planned-travel requiredness ----------------

def test_travel_planned_requires_departure():
    db = _db()
    clinician = _user(db, "clinician-1")
    with pytest.raises(HTTPException) as exc:
        add_travel("patient-1", TravelEpisodeCreate(
            origin="Goa", destination="West Bengal", planned=True),
            user=clinician, db=db)
    assert exc.value.status_code == 422
    assert "Departure date is required" in exc.value.detail
    db.close()


def test_travel_planned_requires_destination():
    db = _db()
    clinician = _user(db, "clinician-1")
    with pytest.raises(HTTPException) as exc:
        add_travel("patient-1", TravelEpisodeCreate(
            origin="Goa", departure_date=date.today().isoformat(), planned=True),
            user=clinician, db=db)
    assert exc.value.status_code == 422
    assert "Destination is required" in exc.value.detail
    db.close()


def test_travel_planned_requiredness_and_history_over_http(client, tokens):
    hdr = {"Authorization": f"Bearer {tokens['clinician']}"}
    url = "/api/v1/workers/patient-1/travel"

    # Planned travel requires departure and destination.
    missing_departure = client.post(url, headers=hdr, json={
        "origin": "Goa", "destination": "West Bengal", "planned": True})
    assert missing_departure.status_code == 422
    assert "Departure date is required" in missing_departure.json()["detail"]

    missing_destination = client.post(url, headers=hdr, json={
        "origin": "Goa", "departure_date": (date.today() + timedelta(days=7)).isoformat(),
        "planned": True})
    assert missing_destination.status_code == 422
    assert "Destination is required" in missing_destination.json()["detail"]

    # A complete valid planned episode is accepted.
    valid = client.post(url, headers=hdr, json={
        "origin": "Goa", "destination": "West Bengal",
        "departure_date": (date.today() + timedelta(days=7)).isoformat(),
        "planned": True})
    assert valid.status_code == 201, valid.text

    # Historical travel (planned=False) stays unrestricted — no dates required.
    historical = client.post(url, headers=hdr, json={
        "origin": "West Bengal", "destination": "Goa", "planned": False})
    assert historical.status_code == 201, historical.text


# ---------------- G4/G1: HTTP-level sample validation ----------------

def test_samples_http_smear_rules_for_rdt_microscopy_smp(client, tokens):
    hdr = {"Authorization": f"Bearer {tokens['pathologist']}"}
    url = "/api/v1/samples"

    smp = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "smp",
        "smear_type": "both", "result_status": "negative"})
    assert smp.status_code == 201, smp.text
    microscopy = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "microscopy",
        "smear_type": "thick", "result_status": "negative"})
    assert microscopy.status_code == 201, microscopy.text

    rdt_with_smear = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "rdt",
        "smear_type": "thick", "result_status": "negative"})
    assert rdt_with_smear.status_code == 422
    assert "Smear type applies only" in rdt_with_smear.json()["detail"]

    bad_smear_value = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "microscopy",
        "smear_type": "bogus", "result_status": "negative"})
    assert bad_smear_value.status_code == 422
    assert "Unsupported smear type" in str(bad_smear_value.json()["detail"])


def test_samples_http_positive_species_rules(client, tokens):
    hdr = {"Authorization": f"Bearer {tokens['pathologist']}"}
    url = "/api/v1/samples"

    no_species = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "rdt",
        "result_status": "positive"})
    assert no_species.status_code == 422
    assert "Species is required" in no_species.json()["detail"]

    unsupported = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "rdt",
        "result_status": "positive", "species": "xyz"})
    assert unsupported.status_code == 422
    assert "Unsupported species" in str(unsupported.json()["detail"])

    valid_rdt = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "rdt",
        "result_status": "positive", "species": "pv"})
    assert valid_rdt.status_code == 201, valid_rdt.text

    valid_microscopy = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "microscopy",
        "result_status": "positive", "species": "pf", "smear_type": "both"})
    assert valid_microscopy.status_code == 201, valid_microscopy.text

    # Non-positive results intentionally need no species.
    negative = client.post(url, headers=hdr, json={**_PAT_BASE, "method": "rdt",
        "result_status": "negative"})
    assert negative.status_code == 201, negative.text


def test_slide_followup_due_date_format_over_http(client, tokens):
    hdr = {"Authorization": f"Bearer {tokens['pathologist']}"}
    sample = client.post("/api/v1/samples", headers=hdr, json={**_PAT_BASE,
        "method": "rdt", "result_status": "negative"})
    assert sample.status_code == 201, sample.text
    sample_id = sample.json()["id"]
    follow = f"/api/v1/samples/{sample_id}/slide-followup"

    bad_format = client.put(follow, headers=hdr, json={
        "received": "no", "not_received_reason": "patient_unavailable",
        "due_date": "01/11/2026"})
    assert bad_format.status_code == 422
    assert "due_date" in str(bad_format.json()["detail"])

    valid = client.put(follow, headers=hdr, json={
        "received": "no", "not_received_reason": "patient_unavailable",
        "due_date": (date.today() + timedelta(days=21)).isoformat()})
    assert valid.status_code == 200, valid.text
    assert valid.json()["received"] == "no"


# ---------------- G2: HTTP-level assessment identity paths ----------------

def test_assessment_http_identity_paths(client, tokens):
    db = _db()
    try:
        patient = _fresh_patient(db, "HTTP", "Gap HTTP Identity")
        hdr = {"Authorization": f"Bearer {tokens['clinician']}"}

        by_code = client.post("/api/v1/assessments", headers=hdr, json={
            "patient_id": patient.patient_code, "temperature_c": 37.1,
            "medical_officer_name": "Dr. HTTP Code"})
        assert by_code.status_code == 201, by_code.text

        # Same worker is now screened, so the UUID submission needs a reason.
        by_uuid = client.post("/api/v1/assessments", headers=hdr, json={
            "patient_id": patient.id, "temperature_c": 37.4,
            "re_screening_reason": "http regression follow-up"})
        assert by_uuid.status_code == 201, by_uuid.text

        unknown = client.post("/api/v1/assessments", headers=hdr, json={
            "patient_id": "M3-DOES-NOT-EXIST", "temperature_c": 37.0})
        assert unknown.status_code == 404

        unauthorized = client.post("/api/v1/assessments", headers={
            "Authorization": f"Bearer {tokens['worker']}"},
            json={"patient_id": patient.patient_code, "temperature_c": 37.0})
        assert unauthorized.status_code == 403
    finally:
        db.close()
