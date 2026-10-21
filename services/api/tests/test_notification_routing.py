"""Contractor notification routing: owner AND site-scoped contractors, minimal body only,
never a different site's contractor, never clinical content."""
import uuid

from sqlalchemy import select

from app import models
from app.database import SessionLocal
from app.security import hash_pin

PIN = "2468"


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _phone():
    return "+9190" + str(uuid.uuid4().int)[:8]


def _mk_contractor(db, scope_site_id=None):
    u = models.User(phone_e164=_phone(), display_name="Synthetic Contractor", pin_hash=hash_pin(PIN))
    db.add(u); db.flush()
    db.add(models.RoleAssignment(user_id=u.id, role="contractor",
                                 scope_type="site" if scope_site_id else "global", scope_id=scope_site_id))
    return u


def _login(client, phone):
    r = client.post("/api/v1/auth/login", json={"phone": phone, "pin": PIN})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_scoped_contractor_without_ownership_is_notified_minimally(client):
    db = SessionLocal()
    try:
        tag = uuid.uuid4().hex[:6].upper()
        site = models.Site(code=f"RT-{tag}", name="Routing Site", contractor_name="Co", district="North Goa", area="Panaji")
        other = models.Site(code=f"RO-{tag}", name="Other Site", contractor_name="Co2", district="South Goa", area="Margao")
        db.add_all([site, other]); db.flush()
        owner = _mk_contractor(db)           # owns the site via contractor_user_id
        site.contractor_user_id = owner.id
        scoped = _mk_contractor(db, site.id)  # manages it only through a site-scoped role
        stranger = _mk_contractor(db, other.id)
        owner_phone, scoped_phone, stranger_phone = owner.phone_e164, scoped.phone_e164, stranger.phone_e164
        owner_id, scoped_id, stranger_id, site_id = owner.id, scoped.id, stranger.id, site.id
        db.commit()
    finally:
        db.close()

    wphone = _phone()
    auth = client.post("/api/v1/auth/signup", json={"phone": wphone, "pin": PIN, "display_name": "Routing Worker", "role": "worker"}).json()
    db = SessionLocal()
    try:
        db.add(models.WorkerSiteAssignment(patient_id=auth["user"]["patient_id"], site_id=site_id, start_date="2026-10-01"))
        db.commit()
    finally:
        db.close()
    r = client.post("/api/v1/symptom-reports", headers=_h(auth["access_token"]), json={
        "symptoms": ["fever", "confusion"], "description": "SECRET-CLINICAL-TEXT", "client_request_id": "rt-" + uuid.uuid4().hex})
    assert r.status_code == 201, r.text
    case_id = r.json()["case_id"]

    for phone, uid in ((owner_phone, owner_id), (scoped_phone, scoped_id)):
        items = client.get("/api/v1/notifications", headers=_h(_login(client, phone))).json()["items"]
        mine = [n for n in items if n["case_id"] == case_id]
        assert len(mine) == 1 and mine[0]["body_minimal"] is True and mine[0]["kind"] == "case_site_coordination"
        blob = (mine[0]["title"] + mine[0]["body"]).lower()
        assert "secret-clinical-text" not in blob and "confusion" not in blob and "fever" not in blob

    other_items = client.get("/api/v1/notifications", headers=_h(_login(client, stranger_phone))).json()["items"]
    assert not [n for n in other_items if n["case_id"] == case_id], "other site's contractor must get nothing"


def test_worker_facing_responses_carry_no_clinical_detail(client):
    """Worker's own case list/detail/notifications (including after clinician closure with a
    free-text note) never contain symptom text, urgency-driving symptoms, or clinician notes."""
    wphone = _phone()
    auth = client.post("/api/v1/auth/signup", json={"phone": wphone, "pin": PIN, "display_name": "Privacy Worker", "role": "worker"}).json()
    tok = auth["access_token"]
    r = client.post("/api/v1/symptom-reports", headers=_h(tok), json={
        "symptoms": ["fever", "confusion"], "description": "WORKER-SECRET-DESC", "client_request_id": "pv-" + uuid.uuid4().hex})
    assert r.status_code == 201, r.text
    case_id = r.json()["case_id"]
    clin = _login(client, _clinician_phone())
    assert client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=_h(clin)).status_code == 200
    assert client.post(f"/api/v1/cases/{case_id}/transition", headers=_h(clin),
                       json={"to_status": "closed", "note": "CLINICIAN-PRIVATE-NOTE"}).status_code == 200
    blobs = [client.get(f"/api/v1/cases/{case_id}", headers=_h(tok)).text,
             client.get("/api/v1/cases", headers=_h(tok)).text,
             client.get("/api/v1/notifications", headers=_h(tok)).text]
    for blob in blobs:
        low = blob.lower()
        assert "worker-secret-desc" not in low and "clinician-private-note" not in low
        assert "confusion" not in low and "symptoms" not in low


def _clinician_phone():
    db = SessionLocal()
    try:
        u = models.User(phone_e164=_phone(), display_name="Priv Clinician", pin_hash=hash_pin(PIN))
        db.add(u); db.flush()
        db.add(models.RoleAssignment(user_id=u.id, role="clinician")); db.commit()
        return u.phone_e164
    finally:
        db.close()
