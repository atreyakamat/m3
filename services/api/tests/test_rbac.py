"""Test RBAC role enforcement and strict read-only restrictions for M3.
PRD Reference: Section 1, 2, 3, 9, 14 (AUTH-001, AUTH-002, AUTH-003, AUTH-004).
Health Worker, Research Lab, and Admin must be strictly read-only for mutations.
"""
import os
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
import pytest

from app.database import Base, engine, SessionLocal
from app.main import (
    create_assessment,
    create_followup,
    create_research_result,
    create_sample,
    create_site,
    create_worker,
)
from app.models import Facility, Patient, RoleAssignment, Site, User
from app.schemas import (
    ROLES,
    AssessmentCreate,
    FollowUpCreate,
    MolecularCreate,
    SampleCreate,
    SiteCreate,
    WorkerCreate,
)
from app.security import hash_pin

def test_admin_role_exists_in_role_schema():
    assert "admin" in ROLES
    assert len(ROLES) >= 7

def test_health_worker_is_strictly_read_only_for_mutations():
    db = SessionLocal()
    hw = db.get(User, "health-worker-1")
    due = datetime.now(timezone.utc) + timedelta(days=2)
    # Health Worker should be denied (403) from creating follow-ups in initial release
    with pytest.raises(HTTPException) as exc:
        create_followup(FollowUpCreate(patient_id="patient-1", due_at=due), user=hw, db=db)
    assert exc.value.status_code == 403
    db.close()

def test_research_lab_is_strictly_read_only_for_mutations():
    db = SessionLocal()
    rl = db.get(User, "research-lab-1")
    # Research Lab should be denied (403) from creating molecular results in initial release
    with pytest.raises(HTTPException) as exc:
        create_research_result(MolecularCreate(sample_id="dummy", pcr_status="pending"), user=rl, db=db)
    assert exc.value.status_code == 403
    db.close()

def test_admin_is_strictly_read_only_for_mutations():
    db = SessionLocal()
    admin = db.get(User, "admin-1")
    # Admin cannot create sites
    with pytest.raises(HTTPException) as exc:
        create_site(SiteCreate(code="ADM-SITE", name="Admin Site", contractor_name="Admin", district="Goa", area="Panaji"), user=admin, db=db)
    assert exc.value.status_code == 403

    # Admin cannot create workers
    with pytest.raises(HTTPException) as exc2:
        create_worker(WorkerCreate(display_name="Admin Worker", consent_status="documented", site_id="site-1"), user=admin, db=db)
    assert exc2.value.status_code == 403
    db.close()

def test_clinician_can_create_followup():
    db = SessionLocal()
    clinician = db.get(User, "clinician-1")
    due = datetime.now(timezone.utc) + timedelta(days=2)
    result = create_followup(FollowUpCreate(patient_id="patient-1", assigned_user_id="health-worker-1", due_at=due, notes="Clinician follow-up plan"), user=clinician, db=db)
    assert "id" in result
    db.close()
