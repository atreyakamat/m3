"""Deterministic synthetic test data for the ISOLATED M3 PostgreSQL test database.

Safety contract:
  * Requires --db-url pointing at an explicitly disposable test database
    (postgresql+psycopg://...). Refuses sqlite URLs and any database whose name
    does not look like a test database (m3_test*, m3-pg-test*, test_*, *_test).
  * Never deletes rows. Idempotent: fixed deterministic primary keys; a re-run
    reports "already present" instead of duplicating.

Usage (from repository root):
  python3 scripts/seed_pg_testdata.py \
      --db-url 'postgresql+psycopg://m3test:m3test@127.0.0.1:5434/m3_test'
"""
import argparse
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[1]
_API = REPO / "services" / "api"


def _ensure_backend_python():
    """Re-exec under the backend virtualenv app when system python lacks its deps."""
    try:
        import pydantic  # noqa: F401
        import sqlalchemy  # noqa: F401
    except ModuleNotFoundError:
        venv = _API / ".venv" / "bin" / "python"
        if venv.exists() and sys.executable != str(venv):
            os.execv(str(venv), [str(venv), __file__, *sys.argv[1:]])
        raise


_ensure_backend_python()
sys.path.insert(0, str(_API))

PROD_MARKERS = ("prod", "production", "live")


def refuse_if_unknown(db_url: str) -> None:
    if db_url.startswith("sqlite"):
        print("REFUSED: a PostgreSQL URL is required (SQLite is not the isolated-test engine here)."); sys.exit(3)
    parsed = urlparse(db_url)
    dbname = parsed.path.lstrip("/")
    if not dbname:
        print("REFUSED: url has no database name."); sys.exit(3)
    lowered = dbname.lower()
    looks_test = lowered.startswith(("m3_test", "m3-pg-test", "m3_pg_", "test_")) or lowered.endswith(("_test", "_seed"))
    forbidden = [m for m in PROD_MARKERS if m in lowered]
    if not looks_test or forbidden:
        print(f"REFUSED: '{dbname}' is not recognized as a disposable test database."); sys.exit(3)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", required=True)
    args = parser.parse_args()
    refuse_if_unknown(args.db_url)

    from sqlalchemy import create_engine, inspect, select
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    from app import models
    from app.security import hash_pin

    engine = create_engine(args.db_url)
    db = sessionmaker(bind=engine)()

    created = {
        "users": 0, "sites": 0, "facilities": 0, "patients": 0, "assignments": 0,
        "assessments": 0, "samples": 0, "tests": 0, "slidе_followups": 0,
        "slide_followups": 0, "followups": 0, "molecular": 0, "travel": 0,
    }

    def add(model, **kwargs):
        pk = kwargs.get("id")
        if pk and db.get(model, pk):
            return None
        db.add(model(**kwargs)); db.flush()
        return kwargs.get("id")

    # --- Accounts for all seven roles (PIN 2468, synthetic phones only) ---
    accounts = [
        ("pgtest-worker-1", "+917000000401", ["worker"]),
        ("pgtest-worker-2", "+917000000402", ["worker"]),
        ("pgtest-contractor-1", "+917000000411", ["contractor"]),
        ("pgtest-contractor-2", "+917000000412", ["contractor"]),
        ("pgtest-pathologist", "+917000000413", ["pathologist"]),
        ("pgtest-clinician", "+917000000414", ["clinician"]),
        ("pgtest-health-worker", "+917000000415", ["health_worker"]),
        ("pgtest-research", "+917000000416", ["research_lab"]),
        ("pgtest-admin", "+917000000417", ["admin"]),
    ]
    for label, phone, roles in accounts:
        user = db.get(models.User, label)
        if not user:
            user = models.User(id=label, phone_e164=phone, display_name=f"PG Test {label}", pin_hash=hash_pin("2468"))
            db.add(user); db.flush(); created["users"] += 1
        existing_roles = set(db.scalars(select(models.RoleAssignment.role).where(models.RoleAssignment.user_id == label)))
        for role in roles:
            if role not in existing_roles:
                db.add(models.RoleAssignment(user_id=label, role=role))

    # --- Two contractors, two sites, one facility pair, month/year boundary dates ---
    fac1 = add(models.Facility, id="pgtest-fac-uhc", code="PG-TEST-UHC", name="PG Test UHC", district="North Goa", facility_type="UHC")
    if fac1: created["facilities"] += 1
    for site_id, code, contractor_uid in [
        ("pgtest-site-1", "PG-TEST-S1", "pgtest-contractor-1"),
        ("pgtest-site-2", "PG-TEST-S2", "pgtest-contractor-2"),
    ]:
        if add(models.Site, id=site_id, code=code, name=f"PG Test Site {site_id[-1].upper()}",
               contractor_name="Synthetic Builders", district="North Goa", area="Panaji",
               contractor_user_id=contractor_uid):
            created["sites"] += 1

    # --- Workers: complete/incomplete drafts, prior history, no history, optional gaps ---
    worker_specs = [
        # (id, code, name, consent, dob, gender, symptoms, prior_history, draft_state)
        ("pgtest-worker-1", "TEST-WORKER-0001", "Synthetic Worker One", "documented", "1996-05-31", "male",
         ["fever", "chills_shivering"], "no", "submitted"),
        ("pgtest-worker-2", "TEST-WORKER-0002", "Synthetic Worker Two", "pending", "1988-12-31", "female",
         [], "yes", "draft"),
        ("pgtest-worker-3", "TEST-WORKER-0003", "Synthetic Worker Three", "documented", None, "male",
         ["fever"], "no", "submitted"),
        ("pgtest-worker-4", "TEST-WORKER-0004", "Synthetic Worker Four", "documented", "2000-02-29", "not_recorded",
         ["fever", "headache"], "yes", "submitted"),
    ]
    patients = {}
    for wid, code, name, consent, dob, gender, symptoms, prior, state in worker_specs:
        if add(models.Patient, id=wid, patient_code=code, display_name=name, consent_status=consent,
               dob=date.fromisoformat(dob) if dob else None,
               age_years=28 if not dob else None, gender=gender, occupation="construction",
               preferred_language="hi", initial_symptoms=symptoms):
            created["patients"] += 1
        patients[wid] = wid
        # assignments: worker 1,2 -> site-1; worker 3 -> site-2; worker 4 both (roster history)
        for site, start, end in ([("pgtest-site-1", date(2026, 10, 28), None), ("pgtest-site-2", date(2025, 12, 15), date(2026, 1, 4)), ("pgtest-site-1", date(2026, 11, 30), date(2026, 12, 1)) and ("pgtest-site-2", date(2026, 1, 2), date(2026, 1, 31))],):
            pass
    membership_matrix = [
        ("pgtest-worker-1", [("pgtest-site-1", date(2026, 10, 28), None)]),
        ("pgtest-worker-2", [("pgtest-site-1", date(2025, 12, 28), None)]),
        ("pgtest-worker-3", [("pgtest-site-2", date(2025, 12, 15), None)]),
        ("pgtest-worker-4", [
            ("pgtest-site-2", date(2025, 12, 15), date(2026, 1, 4)),   # ends across year boundary
            ("pgtest-site-1", date(2026, 10, 2), None),
        ]),
    ]
    for wid, memberships in membership_matrix:
        for site_id, start, end in memberships:
            exists = db.scalar(select(models.WorkerSiteAssignment).where(
                models.WorkerSiteAssignment.patient_id == wid,
                models.WorkerSiteAssignment.site_id == site_id,
                models.WorkerSiteAssignment.start_date == start.isoformat()))
            if not exists:
                db.add(models.WorkerSiteAssignment(patient_id=wid, site_id=site_id,
                                                   start_date=start.isoformat(),
                                                   end_date=end.isoformat() if end else None))
                created["assignments"] += 1

    # --- Travel events incl. planned and year-boundary episodes ---
    travel_rows = [
        ("pgtest-worker-1", "West Bengal", "Kolkata", date(2026, 11, 30), None, None, True, "planned"),
        ("pgtest-worker-2", "Jharkhand", None, date(2025, 12, 30), date(2026, 1, 2), None, False, "returned"),
    ]
    for wid, origin, destination, arrival, departure, ret, planned, label in travel_rows:
        exists = db.scalar(select(models.TravelEvent).where(models.TravelEvent.patient_id == wid,
                                                            models.TravelEvent.arrival_date == arrival.isoformat()))
        if not exists:
            db.add(models.TravelEvent(patient_id=wid, origin=origin, destination=destination,
                                      arrival_date=arrival.isoformat(),
                                      departure_date=departure.isoformat() if departure else None,
                                      return_date=ret.isoformat() if ret else None, planned=planned))
            created["travel"] += 1

    # --- Questionnaire submissions: one complete, one partial draft ---
    q_full = {
        "personal": {"full_name": "Synthetic Worker One", "dob": "1996-05-31", "gender": "male",
                     "mobile": "+917000000401", "id_type": "aadhaar",
                     "address_present": "PG Test Colony, Panaji", "preferred_language": "hindi"},
        "past_history": {"diagnosed_malaria": "no"},
        "present_clinical": {"fever_today": "no", "can_attend_testing": "yes"},
        "migration_history": {"time_in_goa": "over_6_months", "outside_goa_3m": "no", "fever_before_goa_3m": "no"},
        "planned_travel": {"planning": "yes", "episodes": [{"destination": "Kolkata", "departure_date": "2026-11-30"}]},
    }
    q_draft_partial = {"personal": {"full_name": "Synthetic Worker Two", "gender": "female",
                                    "mobile": "+917000000402", "id_type": "voter_id",
                                    "address_present": "PG Test Colony, Panaji", "preferred_language": "hindi"}}
    for wid, data, state in [(patients["pgtest-worker-1"], q_full, "submitted"),
                             (patients["pgtest-worker-2"], q_draft_partial, "draft")]:
        exists = db.scalar(select(models.QuestionnaireSubmission).where(
            models.QuestionnaireSubmission.patient_id == wid,
            models.QuestionnaireSubmission.state == state))
        if not exists:
            db.add(models.QuestionnaireSubmission(patient_id=wid, schema_version=1, state=state, data=data,
                                                  client_request_id=f"pgtest_crid_{wid[-1]}" if state == "submitted" else None,
                                                  submitted_at=datetime.now(timezone.utc) if state == "submitted" else None,
                                                  respondent_user_id=wid))
            created.setdefault("questionnaires", 0)
            created["questionnaires"] = created.get("questionnaires", 0) + 1

    # --- Clinical: admitted + non-admitted assessments; multiple per worker where allowed ---
    clinical_rows = [
        ("pgtest-worker-1", 38.6, "1_3_days", None, ["fever"], "admitted", "severe", "pv", "yes",
         date(2025, 12, 29)),   # admitted across Dec 28 boundary year
        ("pgtest-worker-1", 37.4, "resolved", None, [], "not_admitted", None, None, "yes",
         date(2026, 1, 15)),
        ("pgtest-worker-4", 38.1, "4_7_days", "2026-02-27", ["fever", "headache"], "admitted", "mild", "pf", "no",
         date(2026, 2, 28)),   # month boundary, treatment incomplete w/ documented reason
    ]
    for wid, temp, cat, onset, symptoms, admission, severity, species, treated, encounter in clinical_rows:
        exists = db.scalar(select(models.ClinicalAssessment).where(
            models.ClinicalAssessment.patient_id == wid,
            models.ClinicalAssessment.temperature_c == temp,
            models.ClinicalAssessment.admission_status == admission))
        if not exists:
            db.add(models.ClinicalAssessment(
                patient_id=wid, facility_id="pgtest-fac-uhc" if False else None, clinician_id="pgtest-clinician",
                temperature_c=temp, fever_duration_category=cat, onset_date=onset, symptoms=symptoms,
                general_condition="stable" if admission == "not_admitted" else "needs_review",
                admission_status=admission,
                admission_severity=severity, admission_species=species,
                treatment_completed="yes" if treated == "yes" else "no",
                treatment_incomplete_reason=None if treated == "yes" else "Worker left site mid-course (synthetic)",
                notes=f"Synthetic PG validation record [{label if False else 'pg'}]"))
            created["assessments"] += 1

    # --- Pathology: positive/negative, species combos, slide follow-ups ---
    lab_rows = [
        ("pgtest-worker-1", "PG-TEST-SMP-001", "microscopy", "positive", "pv", "thin", "yes", "yes", "D14"),
        ("pgtest-worker-2", "PG-TEST-SMP-002", "rdt", "negative", None, "not_applicable", None, None, None),
        ("pgtest-worker-3", "PG-TEST-SMP-003", "microscopy", "positive", "mixed", "both", "no", None, None),
        ("pgtest-worker-4", "PG-TEST-SMP-004", "smp", "pending", "undetermined", "not_applicable", None, None, None),
    ]
    for wid, code, method, result, species, smear, slide_received, positive, day in lab_rows:
        if add(models.Sample, id=f"pgtest-sample-{code[-3:].lower()}", sample_code=code, patient_id=wid,
               facility_id="pgtest-fac-uhc", status=result):
            created["samples"] += 1
        sample = db.scalar(select(models.Sample).where(models.Sample.sample_code == code))
        has_test = db.scalar(select(models.DiagnosticTest).where(models.DiagnosticTest.sample_id == sample.id))
        if not has_test:
            db.add(models.DiagnosticTest(sample_id=sample.id, method=method, result_status=result,
                                         species=species, smear_type=smear,
                                         operator_id="pgtest-pathologist",
                                         performed_at=datetime.now(timezone.utc) if result != "pending" else None))
            created["tests"] += 1
        if slide_received and not db.scalar(select(models.SlideFollowUp).where(models.SlideFollowUp.sample_id == sample.id)):
            db.add(models.SlideFollowUp(sample_id=sample.id, patient_id=wid, scheduled_day=day,
                                        due_date=(date(2026, 11, 20)).isoformat(), received=slide_received,
                                        positive=positive, positive_day=day, recorded_by_user_id="pgtest-pathologist"))
            created["slide_followups"] += 1

    # --- Follow-ups: completed & missed visits on the +3d protocol ---
    fu_rows = [
        ("pgtest-health-worker", wid0 := "pgtest-worker-1", "due", None, None),
        ("pgtest-health-worker", wid1 := "pgtest-worker-4", "completed", "Full course reported", "Recovered / Afebrile"),
        ("pgtest-health-worker", wid2 := "pgtest-worker-2", "missed", None, None),
    ]
    for assignee, wid, status, adherence, outcome in fu_rows:
        exists = db.scalar(select(models.FollowUp).where(models.FollowUp.patient_id == wid, models.FollowUp.status == status))
        if not exists:
            db.add(models.FollowUp(patient_id=wid, assigned_user_id=assignee, created_by_user_id="pgtest-clinician",
                                   scheduled_day="+3d", due_at=datetime.now(timezone.utc) + timedelta(days=3),
                                   status=status, adherence=adherence, outcome=outcome))
            created["followups"] += 1

    # --- Molecular results keyed by sample (approved fields only) ---
    mol_rows = [("PG-TEST-SMP-001", "detected", "pv", 1250.5, "yes", "normal"),
                ("PG-TEST-SMP-002", "not_detected", None, None, "not_tested", "normal")]
    for code, pcr, species, density, gam, hrp in mol_rows:
        sample = db.scalar(select(models.Sample).where(models.Sample.sample_code == code))
        if sample and not db.scalar(select(models.MolecularResult).where(models.MolecularResult.sample_id == sample.id)):
            db.add(models.MolecularResult(sample_id=sample.id, pcr_status=pcr, species_confirmation=species,
                                          parasite_density=density, parasite_density_unit="parasites/uL",
                                          gametocyte_presence=gam, pfhrp2_status=hrp, pfhrp3_status=hrp,
                                          performed_by="pgtest-research"))
            created["molecular"] += 1

    db.commit()
    counts = {}
    from sqlalchemy import func, text as _text
    for table in ("users", "sites", "facilities", "patients", "worker_site_assignments",
                  "questionnaire_submissions", "clinical_assessments", "samples", "diagnostic_tests",
                  "slide_follow_ups", "follow_ups", "molecular_results", "travel_events"):
        counts[table] = db.scalar(_text(f"SELECT COUNT(*) FROM {table}"))
    print("Seed summary (rows created this run by category):")
    for key, value in created.items():
        if value:
            print(f"  {key}: {value}")
    print("Current table totals:")
    for table, count in counts.items():
        print(f"  {table}: {count}")
    db.close()


if __name__ == "__main__":
    main()
