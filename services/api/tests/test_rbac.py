"""Test RBAC role enforcement and restricted mutations for M3.

Admin remains strictly read-only. Health Worker may update assigned
follow-ups; Research Lab may create molecular results only for eligible
positive cases. Other mutations remain denied per role.
"""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi import HTTPException

from app.database import SessionLocal
from app.main import (
    create_followup,
    create_research_result,
    create_site,
    create_worker,
    update_followup,
)
from app.models import FollowUp, User
from app.schemas import (
    ROLES,
    FollowUpCreate,
    FollowUpUpdate,
    MolecularCreate,
    SiteCreate,
    WorkerCreate,
)


def test_admin_role_exists_in_role_schema():
    assert "admin" in ROLES
    assert len(ROLES) >= 7


def test_health_worker_can_update_assigned_followup_not_create():
    db = SessionLocal()
    hw = db.get(User, "health-worker-1")
    due = datetime.now(timezone.utc) + timedelta(days=2)
    # Creating follow-ups is still clinician-only
    with pytest.raises(HTTPException) as exc:
        create_followup(FollowUpCreate(patient_id="patient-1", due_at=due), user=hw, db=db)
    assert exc.value.status_code == 403
    # Create a follow-up assigned to hw
    clinician = db.get(User, "clinician-1")
    res = create_followup(FollowUpCreate(patient_id="patient-1", assigned_user_id="health-worker-1", due_at=due, notes="x"), user=clinician, db=db)
    fu = db.get(FollowUp, res["id"])
    upd = update_followup(fu.id, FollowUpUpdate(status="completed", adherence="taken_as_prescribed", notes="ok"), user=hw, db=db)
    assert upd["status"] == "completed"
    db.close()


def test_research_lab_cannot_create_research_for_ineligible_or_missing_sample():
    db = SessionLocal()
    rl = db.get(User, "research-lab-1")
    with pytest.raises(HTTPException) as exc:
        create_research_result(MolecularCreate(sample_id="dummy", pcr_status="pending"), user=rl, db=db)
    assert exc.value.status_code in (403, 404)
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
