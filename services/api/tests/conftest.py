"""Shared API test fixtures: fresh test database, seeded roles, TestClient + login helpers.

Default engine is SQLite on the suite-owned ./test-m3.db. Set M3_TEST_DATABASE_URL
or DATABASE_URL to run against a different disposable database: PostgreSQL is
honored as-is; an explicit SQLite URL is honored only when it is clearly
test-owned (test-named file or under the system temp directory) — anything
else is refused BEFORE any file is touched, so caller databases such as
./m3-dev.db can never be mutated or deleted. See tests/db_policy.py.
"""
import os

import db_policy

_resolved_url, _resolved_kind = db_policy.resolve_candidate_url(
    os.environ.get("M3_TEST_DATABASE_URL") or os.environ.get("DATABASE_URL"))
os.environ["DATABASE_URL"] = _resolved_url
# The server requires an explicit database mode (M3_DATABASE_MODE); the test
# harness sets it deterministically from the URL it has already resolved, so
# every mode rule (scheme lock, no implicit default) applies to tests too.
os.environ["M3_DATABASE_MODE"] = (
    "postgres" if _resolved_kind == "postgresql" else "sqlite")

os.environ["JWT_SECRET"] = "test-secret-not-for-deployment"
os.environ["BOOTSTRAP_SECRET"] = "bootstrap-test"

from app.config import get_settings
get_settings.cache_clear()

import pytest
from fastapi.testclient import TestClient

from app.database import engine, SessionLocal, Base
from app import models
from app.security import hash_pin
from app.main import app

ACCOUNTS = [
    ("worker", "+919000000021", ["worker"]),
    ("worker2", "+919000000022", ["worker"]),
    ("clinician", "+919000000023", ["clinician"]),
    ("pathologist", "+919000000024", ["pathologist"]),
    ("health_worker", "+919000000025", ["health_worker"]),
    ("research_lab", "+919000000026", ["research_lab"]),
    ("admin", "+919000000027", ["admin"]),
    ("contractor", "+919000000028", ["contractor"]),
    ("contractor2", "+919000000029", ["contractor"]),
    ("logout_tester", "+919000000095", ["worker"]),
]

def _seed():
    db = SessionLocal()
    # Users first: PostgreSQL enforces sites.contractor_user_id -> users.id (SQLite did not).
    for label, phone, roles in ACCOUNTS:
        user = models.User(id=label, phone_e164=phone, display_name=label.title(), pin_hash=hash_pin("2468"))
        db.add(user)
        for role in roles:
            assignment = models.RoleAssignment(user_id=user.id, role=role)
            if role == "contractor":
                assignment.scope_type, assignment.scope_id = "site", "site-a"
            db.add(assignment)

    extra_users = [
        ("contractor-1", "+919000000001", "contractor", "site-1"),
        ("contractor-2", "+919000000002", "contractor", "site-2"),
        ("clinician-1", "+919000000003", "clinician", None),
        ("pathology-1", "+919000000004", "pathology", None),
        ("worker-1", "+919000000005", "worker", None),
        ("health-worker-1", "+919000000006", "health_worker", None),
        ("research-lab-1", "+919000000007", "research_lab", None),
        ("admin-1", "+919000000008", "admin", None),
    ]
    for uid, phone, role, scope_id in extra_users:
        user = models.User(id=uid, phone_e164=phone, display_name=role.title(), pin_hash=hash_pin("1234"))
        db.add(user)
        assignment = models.RoleAssignment(user_id=uid, role=role, scope_id=scope_id)
        db.add(assignment)
    db.flush()

    facility = models.Facility(id="fac-1", code="SYN-PHC-01", name="Synthetic PHC", district="North Goa", facility_type="PHC")
    site_a = models.Site(id="site-a", code="SITE-A", name="Contractor A site", contractor_name="A Co", district="North Goa", area="Panaji", contractor_user_id="contractor-1")
    site_b = models.Site(id="site-b", code="SITE-B", name="Contractor B site", contractor_name="B Co", district="South Goa", area="Margao", contractor_user_id="contractor-2")
    site_1 = models.Site(id="site-1", code="SITE-1", name="Site One", contractor_name="Contractor A", district="North Goa", area="Panaji", contractor_user_id="contractor-1")
    site_2 = models.Site(id="site-2", code="SITE-2", name="Site Two", contractor_name="Contractor B", district="South Goa", area="Margao", contractor_user_id="contractor-2")
    patient_1 = models.Patient(id="patient-1", patient_code="M3-P100", display_name="Ravi Kumar", consent_status="documented")
    db.add_all([facility, site_a, site_b, site_1, site_2, patient_1])

    db.commit(); db.close()

@pytest.fixture(scope="session", autouse=True)
def fresh_db():
    import pathlib
    from sqlalchemy import text
    engine.dispose()
    if engine.dialect.name == "sqlite":
        # Delete ONLY the files this configuration owns (db + wal + shm),
        # derived from the configured engine URL — never a hard-coded name.
        for path in db_policy.sqlite_owned_paths(os.environ["DATABASE_URL"]):
            pathlib.Path(path).unlink(missing_ok=True)
    elif engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
            conn.commit()
    else:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    if engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_client_request_id ON patients (client_request_id) WHERE client_request_id IS NOT NULL"))
            conn.commit()
    _seed()
    yield
    engine.dispose()

@pytest.fixture(scope="session")
def client(fresh_db):
    return TestClient(app)

@pytest.fixture()
def unregistered_workers():
    """Return the shared worker accounts to the 'no worker profile yet' state.

    The server now refuses to give an account a second profile (stable worker
    identity), so tests that exercise first-time registration with a shared
    account must start from an unregistered account. This only detaches the link
    in the disposable test database (profiles/cases stay in place, like a real
    first sign-up); identity-protection behavior is covered by test_worker_identity.
    """
    db = SessionLocal()
    try:
        db.query(models.User).filter(models.User.id.in_(["worker", "worker2"])).update(
            {models.User.patient_id: None}, synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield


def login(client, label):
    phone = dict((row[0], row[1]) for row in ACCOUNTS)[label]
    response = client.post("/api/v1/auth/login", json={"phone": phone, "pin": "2468"})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

@pytest.fixture(scope="session")
def tokens(client):
    return {label: login(client, label) for label, _, _ in ACCOUNTS}

@pytest.fixture()
def whoami(client, tokens):
    def call(label):
        response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {tokens[label]}"})
        assert response.status_code == 200
        return response.json()["id"]
    return call
