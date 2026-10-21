"""Five-section screening questionnaire via the /api/v1/questionnaires endpoints.

PRD References: sections 4, 5, 10 and test catalogue REG-001..004, SCR-001..006.
Worker registration is decoupled from site membership; drafts are private to the
respondent; submission is idempotent; drafts never appear as submitted records.
"""
import pytest

pytestmark = pytest.mark.usefixtures("unregistered_workers")

def _auth(token):
    return {"Authorization": f"Bearer {token}"} if token else {}

VALID = {
    "personal": {
        "full_name": "Full Worker", "dob": "1992-04-10", "gender": "male",
        "mobile": "+919123456789", "id_type": "aadhaar",
        "address_present": "Campal, Panaji", "preferred_language": "hindi",
    },
    "past_history": {"diagnosed_malaria": "no", "repellent": "yes", "mosquito_net": "yes"},
    "present_clinical": {"fever_today": "no", "symptoms": ["no_other_symptoms"],
                         "breathing_difficulty": "no", "chest_pain": "no", "confusion": "no",
                         "can_attend_testing": "not_required"},
    "migration_history": {"time_in_goa": "1_6_months", "outside_goa_3m": "no", "fever_before_goa_3m": "no"},
    "planned_travel": {"planning": "no"},
}


def _register(client, tokens, suffix):
    created = client.post("/api/v1/workers", headers=_auth(tokens[f"worker{suffix}"] if suffix else tokens["worker"]),
                          json={"display_name": "Screening Worker", "consent_status": "documented"})
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_reg001_decoupled_registration_without_site(client, tokens):
    created = client.post("/api/v1/workers", headers=_auth(tokens["worker"]),
                          json={"display_name": "Ramesh Kumar", "dob": "1995-05-15",
                                "gender": "male", "mobile": "+919876543210", "consent_status": "documented"})
    assert created.status_code == 201, created.text
    profile = created.json()
    assert profile["patient_code"].startswith("M3-")
    assert profile["dob"] == "1995-05-15"
    assert profile["age_years"] is not None and profile["age_years"] > 25  # derived from DOB
    detail = client.get(f"/api/v1/workers/{profile['id']}", headers=_auth(tokens["worker"]))
    assert detail.status_code == 200
    assert detail.json()["site_assignments"] == []  # no site required


def test_reg003_dob_mismatch_flagged_not_rejected(client, tokens):
    created = client.post("/api/v1/workers", headers=_auth(tokens["worker2"]),
                          json={"display_name": "Suresh Mismatch", "dob": "1995-05-15",
                                "age_years": 20, "gender": "male", "consent_status": "documented"})
    assert created.status_code == 201
    detail = client.get(f"/api/v1/workers/{created.json()['id']}", headers=_auth(tokens["worker2"]))
    assert detail.json()["age_flagged"] is True
    assert detail.json()["age_years"] != 20  # stored as derived from DOB


def test_reg005_duplicate_mobile_rejected_with_candidates_not_merged(client, tokens):
    first = client.post("/api/v1/workers", headers=_auth(tokens["worker"]),
                        json={"display_name": "First Worker", "mobile": "+919123456789", "consent_status": "documented"})
    assert first.status_code == 201
    duplicate = client.post("/api/v1/workers", headers=_auth(tokens["worker2"]),
                            json={"display_name": "Second Worker", "mobile": "919123456789", "consent_status": "documented"})
    assert duplicate.status_code == 409
    assert "X-Duplicate-Candidates" in duplicate.headers


def test_scr001_scr005_draft_save_and_recovery(client, tokens):
    worker_id = _register(client, tokens, "")
    draft = client.put("/api/v1/questionnaires/draft", headers=_auth(tokens["worker"]), json={"data": {
        "personal": {"full_name": "Draft Worker", "gender": "male", "preferred_language": "bengali"}}})
    assert draft.status_code == 200, draft.text
    restored = client.get("/api/v1/questionnaires/draft", headers=_auth(tokens["worker"]))
    assert restored.status_code == 200
    body = restored.json()
    assert body["data"]["personal"]["preferred_language"] == "bengali"
    # Drafts remain visibly incomplete to others: not listed as submitted records.
    listed = client.get(f"/api/v1/questionnaires?patient_id={worker_id}", headers=_auth(tokens["worker"]))
    assert [i["state"] for i in listed.json()["items"]] == ["draft"]


def test_scr002_conditional_and_invalid_submission_rejected(client, tokens):
    _register(client, tokens, "")
    payload = dict(VALID)
    payload["present_clinical"] = {"fever_today": "yes"}  # duration required when fever is reported
    response = client.post("/api/v1/questionnaires/submit", headers=_auth(tokens["worker"]),
                           json={"data": payload, "client_request_id": "invalid-req-0001"})
    assert response.status_code == 422
    errors = response.json()["detail"]["errors"]
    assert any(e["path"] == "present_clinical.fever_duration" for e in errors)


def test_scr006_full_submission_then_double_submit_returns_same_record(client, tokens):
    worker_id = _register(client, tokens, "")
    submit = client.post("/api/v1/questionnaires/submit", headers=_auth(tokens["worker"]),
                         json={"data": VALID, "client_request_id": "req-uuid-12345"})
    assert submit.status_code == 201, submit.text
    first = submit.json()
    assert first["duplicate"] is False
    again = client.post("/api/v1/questionnaires/submit", headers=_auth(tokens["worker"]),
                        json={"data": dict(VALID, planned_travel={"planning": "yes"}), "client_request_id": "req-uuid-12345"})
    assert again.status_code == 200
    assert again.json()["duplicate"] is True
    assert again.json()["submission_id"] == first["submission_id"]
    # No draft is left behind and exactly one submitted record exists.
    assert client.get("/api/v1/questionnaires/draft", headers=_auth(tokens["worker"])).json()["submission_id"] is None
    listed = client.get(f"/api/v1/questionnaires?patient_id={worker_id}", headers=_auth(tokens["worker"]))
    states = [i["state"] for i in listed.json()["items"]]
    assert states.count("submitted") == 1 and "draft" not in states


def test_amendment_is_versioned_not_overwriting(client, tokens):
    _register(client, tokens, "")
    submit = client.post("/api/v1/questionnaires/submit", headers=_auth(tokens["worker"]),
                         json={"data": VALID, "client_request_id": "amend-req-0001"})
    submission_id = submit.json()["submission_id"]
    amended = client.post(f"/api/v1/questionnaires/{submission_id}/amend", headers=_auth(tokens["worker"]),
                          json={"data": dict(VALID, past_history={"diagnosed_malaria": "yes"})})
    assert amended.status_code == 201
    assert amended.json()["state"] == "amended"
    me = client.get("/api/v1/workers/me", headers=_auth(tokens["worker"]))
    assert me.status_code == 200
    listed = client.get(f"/api/v1/questionnaires?patient_id={me.json()['id']}", headers=_auth(tokens["worker"]))
    states = [i["state"] for i in listed.json()["items"]]
    assert "amended" in states and "submitted" in states  # history preserved


def test_clinician_reads_submitted_not_drafts(client, tokens, whoami):
    _register(client, tokens, "")  # self-contained: the account must own a profile for the lookup below
    worker_token_id = whoami("worker")
    detail = client.get(f"/api/v1/workers/{worker_token_id}", headers=_auth(tokens["clinician"]))
    assert detail.status_code == 200
    listed = client.get(f"/api/v1/questionnaires?patient_id={detail.json()['id']}", headers=_auth(tokens["clinician"]))
    assert listed.status_code == 200
    for item in listed.json()["items"]:
        assert item["state"] != "draft"


def test_draft_privacy_between_workers(client, tokens):
    _register(client, tokens, "")
    client.put("/api/v1/questionnaires/draft", headers=_auth(tokens["worker"]), json={"data": {"personal": {"full_name": "Private"}}})
    other_id = _register(client, tokens, "2")
    listed = client.get(f"/api/v1/questionnaires?patient_id={other_id}", headers=_auth(tokens["worker"]))
    assert listed.status_code in (200, 403)  # worker2's own records; worker sees own content only
    restored = client.get("/api/v1/questionnaires/draft", headers=_auth(tokens["worker2"]))
    assert restored.json()["data"] == {}
