"""Endpoint/service authorization checks against a fresh SQLite database.

The production API uses PostgreSQL; these tests exercise the same route functions and
dependencies without a running network server.
"""
import os
from fastapi import HTTPException
import pytest

os.environ["DATABASE_URL"] = "sqlite:///./test-m3.db"
os.environ["JWT_SECRET"] = "test-secret-not-for-deployment"
os.environ["BOOTSTRAP_SECRET"] = "bootstrap-test"

from app.database import Base, engine, SessionLocal
from app.main import create_sample, create_worker, login
from app.models import RoleAssignment, Site, User
from app.schemas import LoginIn, SampleCreate, WorkerCreate
from app.security import hash_pin, require_roles

def setup_function():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    db = SessionLocal()
    db.add(Site(id="site-1", code="SITE-1", name="Synthetic site", contractor_name="Synthetic Co", district="Goa", area="Panaji"))
    for user_id, phone, role in [("clinician-1", "+919000000011", "clinician"), ("pathology-1", "+919000000012", "pathology"), ("worker-1", "+919000000013", "worker")]:
        db.add(User(id=user_id, phone_e164=phone, display_name=role, pin_hash=hash_pin("1234")))
        db.add(RoleAssignment(user_id=user_id, role=role))
    db.commit(); db.close()

def test_unknown_phone_and_wrong_pin_use_same_generic_response():
    db = SessionLocal(); messages = []
    for phone, pin in [("9000000099", "1234"), ("9000000011", "9999")]:
        try: login(LoginIn(phone=phone, pin=pin), db)
        except HTTPException as error: messages.append((error.status_code, error.detail))
    db.close()
    assert messages == [(401, "Unable to sign in with those credentials")] * 2

def test_role_gate_and_pathology_sample_are_enforced():
    db = SessionLocal()
    clinician, pathology, worker = (db.get(User, key) for key in ("clinician-1", "pathology-1", "worker-1"))
    with pytest.raises(HTTPException) as denied:
        require_roles("clinician")(user=pathology, db=db)
    assert denied.value.status_code == 403
    created = create_worker(WorkerCreate(site_id="site-1", consent_status="documented"), user=worker, db=db)
    sample = create_sample(SampleCreate(patient_id=created["id"], method="rdt", result_status="pending"), user=pathology, db=db)
    assert sample["tests"][0]["result_status"] == "pending"
    assert sample["tests"][0]["species"] is None
    db.close()
