import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Patient, Site, WorkerQrToken, WorkerSiteAssignment


def test_contractor_create_site_success_and_idempotency(client, tokens):
    contractor_tok = tokens["contractor"]
    req_id = f"req_site_{uuid.uuid4().hex[:12]}"

    payload = {
        "code": f"SITE-TST-{uuid.uuid4().hex[:4].upper()}",
        "name": "Mandovi Riverfront Expansion",
        "district": "North Goa",
        "area": "Panaji",
        "client_request_id": req_id,
    }

    # 1. First creation: 201 Created
    res1 = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {contractor_tok}"}, json=payload)
    assert res1.status_code == 201, res1.text
    data1 = res1.json()
    assert data1["code"] == payload["code"]
    assert data1["name"] == payload["name"]
    assert data1["district"] == payload["district"]
    assert data1["area"] == payload["area"]
    assert data1["worker_count"] == 0
    assert data1["duplicate"] is False
    assert "id" in data1
    site_id = data1["id"]

    # 2. Idempotent replay with same client_request_id: 200 OK, duplicate=True
    res2 = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {contractor_tok}"}, json=payload)
    assert res2.status_code == 200, res2.text
    data2 = res2.json()
    assert data2["id"] == site_id
    assert data2["duplicate"] is True

    # 3. Cross-account attempt with same client_request_id from contractor2: 409 Foreign Replay
    res3 = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {tokens['contractor2']}"}, json=payload)
    assert res3.status_code == 409
    assert "identifier cannot be used" in res3.text or res3.status_code == 409


def test_contractor_create_site_auto_code(client, tokens):
    contractor_tok = tokens["contractor"]
    payload = {
        "name": "Zuaring Green Valley Phase 2",
        "district": "South Goa",
        "area": "Vasco",
    }
    res = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {contractor_tok}"}, json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["code"].startswith("SITE-")
    assert len(data["code"]) > 6
    assert data["name"] == payload["name"]


def test_site_authorization_and_cross_contractor_isolation(client, tokens):
    # Contractor 1 creates Site A
    res_a = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {tokens['contractor']}"}, json={
        "name": "Contractor 1 Exclusive Site",
        "district": "North Goa",
        "area": "Mapusa",
    })
    assert res_a.status_code == 201
    site_a_id = res_a.json()["id"]

    # Contractor 2 creates Site B
    res_b = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {tokens['contractor2']}"}, json={
        "name": "Contractor 2 Exclusive Site",
        "district": "South Goa",
        "area": "Margao",
    })
    assert res_b.status_code == 201
    site_b_id = res_b.json()["id"]

    # Contractor 1 lists sites -> sees Site A, does not see Site B
    res_list1 = client.get("/api/v1/sites", headers={"Authorization": f"Bearer {tokens['contractor']}"})
    assert res_list1.status_code == 200
    items1 = [s["id"] for s in res_list1.json()["items"]]
    assert site_a_id in items1
    assert site_b_id not in items1

    # Contractor 2 lists sites -> sees Site B, does not see Site A
    res_list2 = client.get("/api/v1/sites", headers={"Authorization": f"Bearer {tokens['contractor2']}"})
    assert res_list2.status_code == 200
    items2 = [s["id"] for s in res_list2.json()["items"]]
    assert site_b_id in items2
    assert site_a_id not in items2

    # Contractor 2 cannot access Contractor 1's site detail or roster
    assert client.get(f"/api/v1/sites/{site_a_id}", headers={"Authorization": f"Bearer {tokens['contractor2']}"}).status_code == 403
    assert client.get(f"/api/v1/sites/{site_a_id}/workers", headers={"Authorization": f"Bearer {tokens['contractor2']}"}).status_code == 403
    assert client.post(f"/api/v1/sites/{site_a_id}/workers", headers={"Authorization": f"Bearer {tokens['contractor2']}"}, json={"worker_id": "dummy"}).status_code == 403

    # Worker and Health Worker cannot create sites
    assert client.post("/api/v1/sites", headers={"Authorization": f"Bearer {tokens['worker']}"}, json={"name": "X", "district": "Y", "area": "Z"}).status_code == 403
    assert client.post("/api/v1/sites", headers={"Authorization": f"Bearer {tokens['health_worker']}"}, json={"name": "X", "district": "Y", "area": "Z"}).status_code == 403


def _create_fresh_worker(client):
    phone = f"+919{uuid.uuid4().int % 1000000000:09d}"
    res = client.post("/api/v1/auth/signup", json={
        "phone": phone,
        "pin": "2468",
        "display_name": f"Worker {uuid.uuid4().hex[:4]}",
        "role": "worker",
    })
    assert res.status_code == 201, res.text
    return res.json()["access_token"], res.json()["user"]


def test_worker_qr_token_generation_and_resolution(client, tokens):
    worker_tok, _ = _create_fresh_worker(client)

    # 1. Worker gets their QR token via GET /workers/me/qr-token
    res1 = client.get("/api/v1/workers/me/qr-token", headers={"Authorization": f"Bearer {worker_tok}"})
    assert res1.status_code == 200, res1.text
    data1 = res1.json()
    assert "token" in data1
    assert data1["payload"]["type"] == "m3_worker_qr"
    assert data1["payload"]["token"] == data1["token"]
    first_token = data1["token"]

    # 2. Calling GET again returns the same active token
    res2 = client.get("/api/v1/workers/me/qr-token", headers={"Authorization": f"Bearer {worker_tok}"})
    assert res2.status_code == 200
    assert res2.json()["token"] == first_token

    # 3. Worker regenerates QR token via POST
    res3 = client.post("/api/v1/workers/me/qr-token", headers={"Authorization": f"Bearer {worker_tok}"})
    assert res3.status_code == 201
    second_token = res3.json()["token"]
    assert second_token != first_token

    # 4. Contractor resolves active token via POST /workers/resolve-qr
    res4 = client.post("/api/v1/workers/resolve-qr", headers={"Authorization": f"Bearer {tokens['contractor']}"}, json={"qr_token": second_token})
    assert res4.status_code == 200, res4.text
    worker_identity = res4.json()
    assert "patient_id" in worker_identity
    assert "patient_code" in worker_identity
    # Strict privacy: absolutely no clinical symptoms or notes
    assert "symptoms" not in worker_identity
    assert "clinical_notes" not in worker_identity
    assert "tests" not in worker_identity

    # 5. Contractor resolves active token via GET /qr/{token}
    res5 = client.get(f"/api/v1/qr/{second_token}", headers={"Authorization": f"Bearer {tokens['contractor']}"})
    assert res5.status_code == 200
    assert res5.json()["patient_id"] == worker_identity["patient_id"]

    # 6. Expired first token is rejected
    res_old = client.get(f"/api/v1/qr/{first_token}", headers={"Authorization": f"Bearer {tokens['contractor']}"})
    assert res_old.status_code == 404


def test_contractor_assign_worker_via_qr_token(client, tokens):
    contractor_tok = tokens["contractor"]
    worker_tok, _ = _create_fresh_worker(client)

    # 1. Create a fresh site
    site_res = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "name": "Harbor Construction Zone",
        "district": "South Goa",
        "area": "Mormugao",
    })
    assert site_res.status_code == 201
    site_id = site_res.json()["id"]

    # 2. Worker gets their active QR token
    qr_res = client.get("/api/v1/workers/me/qr-token", headers={"Authorization": f"Bearer {worker_tok}"})
    assert qr_res.status_code == 200
    qr_token = qr_res.json()["token"]
    patient_id = qr_res.json()["patient_id"]

    # 3. Contractor assigns worker using the QR token
    assign_req_id = f"req_assign_{uuid.uuid4().hex[:12]}"
    assign_res = client.post(f"/api/v1/sites/{site_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "qr_token": qr_token,
        "client_request_id": assign_req_id,
    })
    assert assign_res.status_code == 201, assign_res.text
    assign_data = assign_res.json()
    assert assign_data["assigned"] is True
    assert assign_data["already_assigned"] is False
    assert assign_data["duplicate"] is False
    assert assign_data["site_id"] == site_id
    assert assign_data["worker"]["id"] == patient_id

    # 4. Contractor checks site roster
    roster_res = client.get(f"/api/v1/sites/{site_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"})
    assert roster_res.status_code == 200
    roster = roster_res.json()
    assert roster["total"] == 1
    assert roster["items"][0]["id"] == patient_id
    # Privacy check on roster items: no clinical notes, no symptoms, no specimens
    roster_worker = roster["items"][0]
    assert "initial_symptoms" not in roster_worker
    assert "clinical_notes" not in roster_worker
    assert "tests" not in roster_worker
    assert "diagnosis" not in roster_worker

    # 5. Check live worker count on GET /sites
    sites_res = client.get("/api/v1/sites", headers={"Authorization": f"Bearer {contractor_tok}"})
    found_site = next(s for s in sites_res.json()["items"] if s["id"] == site_id)
    assert found_site["worker_count"] == 1

    # 6. Idempotent replay with same client_request_id returns 200 OK duplicate=True
    replay_res = client.post(f"/api/v1/sites/{site_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "qr_token": qr_token,
        "client_request_id": assign_req_id,
    })
    assert replay_res.status_code == 200
    assert replay_res.json()["duplicate"] is True

    # 7. Resubmitting with a new client_request_id recognizes worker is already on this site
    already_res = client.post(f"/api/v1/sites/{site_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "qr_token": qr_token,
        "client_request_id": f"req_assign_{uuid.uuid4().hex[:12]}",
    })
    assert already_res.status_code == 200
    assert already_res.json()["already_assigned"] is True
    assert already_res.json()["duplicate"] is False


def test_inter_site_transfer_workflow_with_confirmation(client, tokens):
    contractor_tok = tokens["contractor"]
    worker_tok, _ = _create_fresh_worker(client)

    # 1. Contractor creates Site 1 and Site 2
    res_s1 = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "name": "Site One Transfer Origin",
        "district": "North Goa",
        "area": "Porvorim",
    })
    assert res_s1.status_code == 201
    site1_id = res_s1.json()["id"]

    res_s2 = client.post("/api/v1/sites", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "name": "Site Two Transfer Destination",
        "district": "North Goa",
        "area": "Calangute",
    })
    assert res_s2.status_code == 201
    site2_id = res_s2.json()["id"]

    # 2. Worker 2 gets QR token and is assigned to Site 1
    qr_res = client.get("/api/v1/workers/me/qr-token", headers={"Authorization": f"Bearer {worker_tok}"})
    assert qr_res.status_code == 200
    qr_token = qr_res.json()["token"]

    assign_s1 = client.post(f"/api/v1/sites/{site1_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "qr_token": qr_token,
    })
    assert assign_s1.status_code == 201

    # Verify Site 1 has 1 worker
    r1 = client.get(f"/api/v1/sites/{site1_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}).json()
    assert r1["total"] == 1

    # 3. Contractor tries to assign Worker 2 to Site 2 WITHOUT confirm_transfer
    transfer_try = client.post(f"/api/v1/sites/{site2_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "qr_token": qr_token,
        "confirm_transfer": False,
    })
    assert transfer_try.status_code == 409
    detail = transfer_try.json()["detail"]
    assert detail["requires_transfer_confirmation"] is True
    assert detail["current_site_id"] == site1_id

    # Site 1 still has 1 worker, Site 2 still has 0 workers
    assert client.get(f"/api/v1/sites/{site1_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}).json()["total"] == 1
    assert client.get(f"/api/v1/sites/{site2_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}).json()["total"] == 0

    # 4. Contractor confirms transfer with confirm_transfer=True
    transfer_ok = client.post(f"/api/v1/sites/{site2_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}, json={
        "qr_token": qr_token,
        "confirm_transfer": True,
    })
    assert transfer_ok.status_code == 201, transfer_ok.text
    assert transfer_ok.json()["assigned"] is True

    # 5. Site 1 roster now has 0 active workers; Site 2 roster has 1 active worker
    r1_after = client.get(f"/api/v1/sites/{site1_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}).json()
    r2_after = client.get(f"/api/v1/sites/{site2_id}/workers", headers={"Authorization": f"Bearer {contractor_tok}"}).json()
    assert r1_after["total"] == 0
    assert r2_after["total"] == 1


def test_single_active_site_assignment_database_constraint():
    """Verify at the database constraint level that a worker cannot have two active assignments (end_date IS NULL)."""
    db = SessionLocal()
    try:
        # Create a test patient and two test sites
        p = Patient(patient_code=f"CONSTR-{uuid.uuid4().hex[:6]}", display_name="Constraint Worker")
        db.add(p)
        s1 = Site(code=f"CST-{uuid.uuid4().hex[:5]}", name="Constraint Site 1", contractor_name="Constraint Contractor", district="D1", area="A1")
        s2 = Site(code=f"CST-{uuid.uuid4().hex[:5]}", name="Constraint Site 2", contractor_name="Constraint Contractor", district="D2", area="A2")
        db.add_all([s1, s2])
        db.flush()

        # First active assignment succeeds
        a1 = WorkerSiteAssignment(patient_id=p.id, site_id=s1.id, start_date="2026-10-25", end_date=None)
        db.add(a1)
        db.commit()

        # Second active assignment MUST fail with IntegrityError
        a2 = WorkerSiteAssignment(patient_id=p.id, site_id=s2.id, start_date="2026-10-25", end_date=None)
        db.add(a2)
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()
