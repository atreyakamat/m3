"""Synthetic-only fixture command: python -m app.seed."""
from datetime import timedelta
from sqlalchemy import select
from .database import SessionLocal
from .models import (Facility, Site, Patient, WorkerSiteAssignment, ClinicalAssessment, Sample,
                     DiagnosticTest, FollowUp, MolecularResult, TravelEvent, now, uid)
from .security import hash_pin
from .models import User, RoleAssignment

DEMO_PIN = "2468"  # Deliberately development-only, printed by the seed command; never a production bootstrap.
ACCOUNTS = [
    ("+919000000001", "Synthetic Worker", ["worker"]),
    ("+919000000002", "Dr Synthetic", ["clinician"]),
    ("+919000000003", "Pathologist Synthetic", ["pathologist"]),
    ("+919000000004", "Health Worker Synthetic", ["health_worker"]),
    ("+919000000005", "Research Lab Synthetic", ["research_lab"]),
    ("+919000000006", "Contractor Synthetic", ["contractor"]),
    ("+919000000007", "Admin Synthetic", ["admin"]),
]
FACILITIES = [
    ("SYN-UHC-PANAJI", "Synthetic UHC Panji", "North Goa", "UHC"),
    ("SYN-PHC-CANDOLIM", "Synthetic PHC Candolim", "North Goa", "PHC"),
    ("SYN-UHC-MARGAO", "Synthetic UHC Margao", "South Goa", "UHC"),
    ("SYN-PHC-CORTALIM", "Synthetic PHC Cortalim", "South Goa", "PHC"),
]
# PRD-defined approved clinic list (section 7): UHC Panji, PHC Candolim, UHC Margao, PHC Cortalim.

def seed():
    db = SessionLocal()
    try:
        if db.scalar(select(User.id).limit(1)):
            print("Seed skipped: database already contains users.")
            return
        facilities = [Facility(code=code, name=name, district=district, facility_type=ftype)
                      for code, name, district, ftype in FACILITIES]
        site = Site(code="SYN-SITE-01", name="Synthetic Riverside Build", contractor_name="Synthetic Construction Co",
                    district="North Goa", area="Panaji")
        db.add_all([*facilities, site]); db.flush()
        users = {}
        for index, (phone, name, roles) in enumerate(ACCOUNTS, start=1):
            user = User(phone_e164=phone, display_name=name, pin_hash=hash_pin(DEMO_PIN), preferred_language="en")
            db.add(user); db.flush()
            for role in roles:
                assignment = RoleAssignment(user_id=user.id, role=role)
                if role == "contractor":
                    assignment.scope_type, assignment.scope_id = "site", site.id
                db.add(assignment)
            users[roles[0]] = user
        patient = Patient(patient_code="M3-SYN-7K2Q", display_name="Synthetic Participant A", age_years=29,
                          gender="male", phone_e164="+919000000008", occupation="construction",
                          nativity="Synthetic origin", consent_status="documented", initial_symptoms=["fever"])
        db.add(patient); db.flush()
        site.contractor_user_id = users["contractor"].id  # site owner: receives minimal case-coordination notices
        users["worker"].patient_id = patient.id
        db.add(WorkerSiteAssignment(patient_id=patient.id, site_id=site.id, start_date="2026-10-01"))
        db.add(TravelEvent(patient_id=patient.id, origin="West Bengal", arrival_date="2026-10-01"))
        assessment = ClinicalAssessment(patient_id=patient.id, facility_id=facilities[0].id, clinician_id=users["clinician"].id,
                                        temperature_c=38.1, fever_duration_days=2, fever_duration_category="1_3_days",
                                        symptoms=["fever"], general_condition="stable", notes="Synthetic training record only.")
        sample = Sample(sample_code="SYN-SMP-001", patient_id=patient.id, facility_id=facilities[1].id, status="pending")
        db.add_all([assessment, sample]); db.flush()
        test = DiagnosticTest(sample_id=sample.id, method="rdt", result_status="pending", operator_id=users["pathologist"].id)
        followup = FollowUp(patient_id=patient.id, assigned_user_id=users["health_worker"].id,
                            created_by_user_id=users["clinician"].id, scheduled_day="day_3",
                            due_at=now() + timedelta(days=1), status="due")
        molecular = MolecularResult(sample_id=sample.id, pcr_status="pending", gametocyte_presence="not_tested",
                                    pfhrp2_status="not_tested", pfhrp3_status="not_tested",
                                    performed_by=users["research_lab"].id)
        db.add_all([test, followup, molecular]); db.commit()
        print("Synthetic M3 data seeded. Demo accounts +919000000001 through +919000000007 use PIN 2468.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
