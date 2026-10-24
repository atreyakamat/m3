# M3 Platform — Phase B.1 Verification Report

**Date:** 2026-10-24  
**Repo:** /home/nimr/Projects/m3 (git repo)  
**Commit:** 8ee4e9e  
**Working tree:** Modified files as shown by git diff (backend + tests + embedded backend copies + migration asset). No resets/deletes.

## 1) Repository state and files inspected
**Inspected:** `PHASE_B_IMPLEMENTATION_REPORT.md`, `PHASE_A_AUDIT.md`, `services/api/app/{permissions.py,main.py,models.py,schemas.py,security.py}`, `services/api/alembic/versions/20261028_01_prescriptions.py`, `services/api/tests/{test_rbac.py,test_auth_matrix.py,test_cases.py}`, embedded copies in `apps/mobile/android/app/src/main/python-backend/`, migration asset in `apps/mobile/android/app/src/main/assets/alembic_pack/alembic/versions/`.

**Sync check:** `main.py`, `permissions.py`, `models.py`, `schemas.py` are byte-identical between `services/api/app/` and `apps/mobile/android/app/src/main/python-backend/app/`. Migration `20261028_01_prescriptions.py` present in both versions/ and assets. ✓

**Diff summary:** 11 files changed (4 backend modules + 2 tests + 4 embedded copies + 1 new migration). ✓

## 2) Findings by work item

### 2.1 Research Lab authorization
**Code review:**
- `permissions.py`: `READ_ONLY_ROLES={"admin"}` only. `can_read_patient` for research_lab requires `patient_is_research_eligible`. `can_write` allows `research` only for research_lab. Eligibility helpers enforce positive RDT/microscopy only (`RESEARCH_ELIGIBLE_METHODS`, `RESEARCH_ELIGIBLE_RESULT="positive"`).
- `main.py`: `GET /api/v1/workers` filters research_lab to eligible patients (via samples join). `GET /api/v1/samples` filters to eligible samples. `GET /api/v1/research-results` filters to eligible samples. `GET /api/v1/workers/{id}` re-checks eligibility (403 if not), strips forbidden fields, adds restricted `research` block. `POST /api/v1/research-results` requires research_lab + `can_write("research")`, checks sample/patient exist and access, requires `sample_is_research_eligible`, prevents duplicates (409), audits `research_result.created`.

**Verified behaviors (code-level):**
- Positive RDT/microscopy → eligible. ✓
- Pending/indeterminate/cancelled/negative/missing → not eligible (no match). ✓
- Direct-by-UUID blocked if ineligible (eligibility rechecked in worker_detail and patient scope + filters). ✓
- Mixed samples: only eligible samples/patients exposed; unrelated samples filtered out. ✓
- Ineligible creation attempts: rejected (403 if not eligible, or 404 if missing). ✓
- Response schemas: patient allowlist enforced, forbidden fields popped; "other number" never added/exposed. Nested assessments/cases returned only in restricted `research` block with limited fields. ✓

**Potential issues found:**
- `GET /api/v1/samples` when called with `patient_id` uses `require_patient_scope` which now denies research_lab if patient not eligible (good). When called without `patient_id`, it filters rows to eligible samples/patients (good). ✓
- `worker_detail` for research_lab returns early with restricted result (doesn't add site_assignments/travel_history) — correct per allowlist. ✓
- `sample_view` for research_lab doesn't add facility/slide_followups — correct. ✓

### 2.2 Health Worker follow-up updates
**Code review:**
- `schemas.py`: added `FollowUpUpdate` with allowed fields + `base_updated_at`.
- `main.py`: `GET /api/v1/follow-ups` allows health_worker to see assigned only. `POST /api/v1/follow-ups` still clinician-only (health_worker gets 403). Added `PATCH/PUT /api/v1/follow-ups/{follow_up_id}` requiring health_worker/clinician, `can_write("followup_update")`, checks follow-up exists, checks assignment/scope (health_worker must be assigned), blocks immutable fields (`patient_id`, `assigned_user_id`, `case_id`, `created_by_user_id`, `due_at`, `scheduled_day`) with 422, handles `base_updated_at` stale check, sets/clears `completed_at` on status changes, audits `followup.updated` with changed fields.
- `permissions.py`: `can_write` allows `followup_update` for health_worker/clinician.

**Verified behaviors:**
- Assigned follow-up update allowed. ✓
- Unassigned/another worker's follow-up → 403. ✓
- Clinician access allowed (if in scope). ✓
- Immutable fields rejected. ✓
- Stale updates rejected with 409 + current_updated_at. ✓
- Completion timestamps set/cleared correctly. ✓
- Audit event created. ✓
- Cannot create/reassign via alternate routes (creation remains clinician-only). ✓

### 2.3 Prescription model and migration
**Code review:**
- `models.py`: added `Prescription` with patient/case/assessment/prescriber FKs, medicine/dose/unit/frequency/duration/start_date/instructions, status, supersession links, timestamps. Relationship to Patient added.
- `alembic/versions/20261028_01_prescriptions.py`: additive only, creates table with indexes/constraints, no drops/edits. Downgrade drops table.
- No API endpoints added. No backfill. Molecular results don't auto-alter prescriptions (no code path does this).

**Verified:**
- Structure supports history (separate rows, supersession links). ✓
- Additive migration. ✓
- No clinical defaults invented. ✓
- **Unresolved (must be decided before CRUD):** exact required/optional fields, status values/transitions, who can revise (clinician only?), linkage requirements (case/assessment required?), validation rules, permissions for CRUD endpoints, audit requirements, Research Lab/DHS visibility of revised prescriptions. Not implemented in this pass — correct per constraints.

### 2.4 Tests and integration
**Tests updated:** `test_rbac.py`, `test_auth_matrix.py` updated to match new permissions. `test_cases.py` comment clarified.
**Integration:** API and embedded backend synchronized (byte-identical modules + migration asset present).

## 3) Tests run, commands, and actual outcomes
**Environment:** No pytest/fastapi/sqlalchemy installed in system or obvious venvs. Attempted `pip install -r requirements.txt` in `/tmp/m3-venv` failed due to `psycopg-binary==3.2.13` not available for Python 3.15. Docker not accessible (permission denied). 

**Commands attempted:**
```bash
cd /home/nimr/Projects/m3/services/api && PYTHONPATH=. python -m pytest tests/test_rbac.py tests/test_questionnaire_gaps.py -v
pip list | grep pytest
python3 -m venv /tmp/m3-venv && /tmp/m3-venv/bin/pip install -q -r services/api/requirements.txt
```

**Results:** All attempts failed due to missing dependencies/environment. **Tests could not be executed.** Existing tests were updated to reflect new expected behavior (see changes), but actual pass/fail status unknown in this environment.

**Recommendation:** Run in supported environment: `docker compose run --rm api pytest services/api/tests/test_rbac.py services/api/tests/test_auth_matrix.py services/api/tests/test_cases.py -v` or equivalent with compatible Python/Postgres/SQLite setup.

## 4) Security or data-exposure findings with severity
- **LOW (fixed):** Research Lab could see all samples/results regardless of eligibility → **Fixed** by filtering and eligibility checks.
- **LOW (fixed):** Research Lab patient view exposed more fields → **Fixed** by explicit allowlist + forbidden field stripping.
- **LOW (fixed):** Direct-by-UUID access for ineligible cases possible → **Fixed** by rechecking eligibility in worker_detail and patient scope.
- **INFO:** "other number" not present; guards added to prevent exposure. ✓
- **INFO:** Health Worker couldn't update assigned follow-ups (workflow gap) → **Fixed** with scoped updates only. ✓
- **INFO:** Admin remains read-only (as designed). ✓

No high-severity issues found in code review.

## 5) Differences between code and Phase B report
**Match:** Permissions, filtering, follow-up updates, prescription model/migration, sync to embedded backend all implemented as described.
**Minor notes:**
- Report states "PATCH/PUT /api/v1/follow-ups/{id}" added — implemented. ✓
- Report mentions updating mobile/web UI only as needed — not done in this pass (backend only). Correctly scoped.
- Report says "tests updated to match" — done. ✓

No material discrepancies found.

## 6) Remaining stakeholder decisions
1. Authorised ICMR/project staff role for creating initial worker profiles (admin read-only)
2. Meaning of DHS vs Admin
3. Who manages facilities/sites/assignments/user roles
4. Exact approved fields for structured prescriptions + clinical defaults/validation
5. Final Research Lab field allowlist beyond current restricted set
6. Case/episode closure rules
7. SMP eligibility for Research Lab (currently excluded)
8. Health Worker follow-up constraints (case status requirements etc.)

## 7) Go/no-go recommendation for Phase C
**GO with conditions (No-Go for merge/deploy until tests pass):**

**Blockers:**
- **BLOCKER (environment):** Tests could not be executed due to missing dependencies/Python version/Docker access. Must run targeted tests in supported environment and confirm pass/fail.

**Non-blocking:**
- Prescription CRUD/UI deferred pending stakeholder decisions (appropriate).
- Mobile/web UI updates minimal/not done (can be done in Phase C).

**Recommendation:** Do not proceed to broad Phase C deployment/merge until tests pass in CI/supported environment. Code changes look correct per review; verification incomplete without test execution.
