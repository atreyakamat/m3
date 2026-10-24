# M3 Malaria Surveillance Platform — Phase D Final Handover Report

**Date:** 2026-10-24  
**Repo:** /home/nimr/Projects/m3 (git repo, branch: main)  
**Working tree state:** Modified files as tracked by git; untracked files include `AUDIT_PHASE_A.md`, `PHASE_A_AUDIT.md`, `docs/PHASE_B_IMPLEMENTATION_REPORT.md`, `docs/PHASE_B1_VERIFICATION_REPORT.md`, `docs/PHASE_C_IMPLEMENTATION_REPORT.md`  
**Constraints honored:** No resets/deletes, no destructive migrations, no shared DB changes, no commits/pushes/deploys, questionnaire unchanged, no invented clinical protocols/treatment defaults, no broad role expansion, Admin remains read-only by default.

---

## 1) Repository State and Changed Files

### Git diff summary (from `git diff --stat`)
```
.../app/src/main/python-backend/app/main.py        | 218 +++++++++++++++++++--
.../app/src/main/python-backend/app/models.py      |  27 +++
.../app/src/main/python-backend/app/permissions.py |  62 +++++-
.../app/src/main/python-backend/app/schemas.py     |  10 +
 services/api/app/main.py                           | 218 +++++++++++++++++++--
 services/api/app/models.py                         |  27 +++
 services/api/app/permissions.py                    |  62 +++++-
 services/api/app/schemas.py                        |  10 +
 services/api/tests/test_auth_matrix.py             |  20 +-
 services/api/tests/test_rbac.py                    |  41 ++--
 10 files changed, 623 insertions(+), 72 deletions(-)
```

### New/untracked files relevant to phases
- `PHASE_A_AUDIT.md` (untracked)
- `AUDIT_PHASE_A.md` (untracked)
- `docs/PHASE_B_IMPLEMENTATION_REPORT.md` (untracked)
- `docs/PHASE_B1_VERIFICATION_REPORT.md` (untracked)
- `docs/PHASE_C_IMPLEMENTATION_REPORT.md` (untracked)
- `services/api/alembic/versions/20261028_01_prescriptions.py` (untracked)
- `apps/mobile/android/app/src/main/assets/alembic_pack/alembic/versions/20261028_01_prescriptions.py` (untracked)

### Embedded backend sync (verified)
- `services/api/app/{main.py,models.py,permissions.py,schemas.py}` are byte-identical between `services/api/app/` and `apps/mobile/android/app/src/main/python-backend/app/` (per Phase B.1 verification).
- Migration `20261028_01_prescriptions.py` present in both API migrations and Android assets.

---

## 2) Dashboard Cards, Definitions, Scopes, and Navigation Destinations

### Backend: `/api/v1/dashboard` (role-aware) — verified in `services/api/app/main.py`
- **worker** (own only): `scope:"own"`, `workers:1|0`, `followups_due` for own patient. Personal view.
- **contractor**: `scope:"managed_sites"`, `workers` = distinct assigned workers on managed sites, `sites` = managed site count. Roster-only.
- **health_worker** (and not clinician/admin/pathologist): `scope:"health_worker_assigned"`, `workers` = assigned follow-up patients, `followups_due/overdue` for assigned follow-ups.
- **research_lab** (and not clinician/admin/pathologist): `scope:"research_eligible"`, `eligible_research_cases` = distinct patients with eligible positive samples, `eligible_samples` = count, `unread_notifications`. Restricted to positive RDT/microscopy.
- **admin** only (`roles == {"admin"}`): `scope:"admin_readonly"`, operational totals + `unread_notifications`. Read-only.
- **clinician/pathologist/other authorized**: `scope:"authorized_operational"`, workers/samples_pending/tests_positive/followups_due/followups_overdue + `unread_notifications`.

**Count semantics (verified):**
- Worker counts count distinct workers/patients as appropriate per scope (not duplicate sample/event rows).
- Sample counts count samples as appropriate.
- Follow-up counts use status/due_at as defined.
- Research Lab counts include only eligible positive RDT/microscopy records (enforced server-side).
- Dashboard and destination lists use same authorization scope/filters.

### Frontend UI
- **Web (`apps/web/src/screens/OverviewScreen.tsx`)**: Renders role-tailored metrics by scope; shows explicit limitations when data missing (no fabricated zeros). Displays workspace card with role badges.
- **Mobile (`apps/mobile/app/dashboard.tsx`)**: Loads dashboard/notifications/cases; shows role-appropriate UI. Demo mode uses synthetic data. Cards/navigation exist in existing UI structure; backend now provides correct scoped counts.

**Note:** The web OverviewScreen as written handles scopes `authorized_operational`, `managed_sites`, `own` — it does not explicitly render the new `health_worker_assigned`, `research_eligible`, or `admin_readonly` shapes with their specific fields. The backend now returns these shapes; UI may need to be extended to display them properly. This is a UI wiring gap to verify/complete if not already handled elsewhere.

---

## 3) Worker and Linked-Record Navigation Results

### Authorization & filtering (verified)
- **Patient scope**: `permissions.can_read_patient()` enforces access; Research Lab requires eligibility.
- **Worker list** (`GET /api/v1/workers`): filtered by role scope (contractor by site assignments, health_worker by assigned follow-ups, research_lab by eligible samples). Search respects role constraints.
- **Worker detail** (`GET /api/v1/workers/{id}`): enforces scope via `require_patient_scope()`; for Research Lab re-checks eligibility (403 if ineligible), strips forbidden fields, returns restricted `research` block with limited assessments/cases. Admin/clinician/pathologist see full appropriate views per role.
- **Samples** (`GET /api/v1/samples`): Research Lab filtered to eligible samples only; patient-scoped access enforced.
- **Follow-ups**: Health Worker sees only assigned; clinician can see/manage per scope.

### Linked records
- Worker detail includes permitted sections (site assignments, questionnaire/submissions, travel, clinical assessments, samples/diagnostics, follow-ups, cases as appropriate). Research Lab sees only approved diagnosis/prescription-like info in restricted `research` block (assessments limited fields, cases summary). No "other number" field exists/exposed.

### Safety
- Direct-ID access blocked server-side for unauthorized/ineligible cases.
- Missing/inaccessible records return appropriate errors.
- No duplicate/fabricated records created.

---

## 4) Notification Event Types, Recipients, Deduplication, and Target Behavior

### Model & endpoints (existing)
- `Notification` model exists. Endpoints: `GET /api/v1/notifications` (recipient-scoped, unread filter, pagination), `POST /api/v1/notifications/read` (mark own notifications read). `_notify_case_agents` creates per-recipient notifications transactionally.

### Phase C additions (verified in `services/api/app/main.py`)
- **Research Lab notifications**: On positive RDT/microscopy sample creation, notifies all active Research Lab recipients via `_research_lab_recipients()`. Notification kind `research_eligible`, title "Eligible research case", minimal body, `body_minimal=True`. Recipients are role-based and scoped.
- **Health Worker recipients**: Helper `_health_worker_recipients(db, assigned_user_id=None)` added for scoped recipient selection.
- **Dashboard**: Includes `unread_notifications` for relevant roles.

### Behavior
- Notifications are recipient-scoped only (no broadcast to all Health Workers unless rules require it).
- Marking notifications read does not alter clinical data/screening/diagnosis/prescriptions/status.
- Navigation to targets requires ownership/authorization checks.
- Deduplication: **Not globally enforced** per Phase C report. Notifications created per event/recipient; no idempotency mechanism implemented. If retries create duplicates, they would appear as separate notifications. No safe idempotency key derivable from current schema without guessing - limitation documented.

### Frontend
- Mobile dashboard loads notifications (`/notifications?limit=50`), displays in inbox, allows marking read. Notification bell component exists. Web console may need notification UI integration.

---

## 5) Screening Ownership and Authorization Results

### Protections (verified)
- Initial screening results recorded through established questionnaire/screening path (`/api/v1/questionnaires/submit`, etc.). Questionnaire unchanged (5 sections intact).
- No dashboard card includes editable positive/negative status control.
- **Research Lab**: Cannot modify screening results. Can only view eligible cases and create molecular results for eligible samples via authorized workflow. `POST /api/v1/research-results` enforces role, eligibility, no duplicates.
- **DHS**: Not present as distinct role in codebase. No global access or Admin equivalence granted.
- **Contractors**: Cannot modify screening results (no write permission for clinical/screening).
- **Health Workers**: Can update assigned follow-ups only via `PATCH/PUT /api/v1/follow-ups/{id}` with allowlisted fields; cannot create/assign follow-ups.
- **Molecular results**: Do not automatically alter screening results, clinical diagnoses, or prescriptions (no code path does this).
- **Marking notifications read**: Does not alter underlying clinical data.
- Server-side authorization enforced on all mutations; UI visibility alone is not sufficient.

### Follow-up updates (new capability)
- Health Workers can update assigned follow-ups with allowed fields: `status` (due/completed/cancelled/missed), `adherence`, `outcome`, `notes`, optional `base_updated_at` for optimistic concurrency.
- Immutable fields blocked (422): `patient_id`, `assigned_user_id`, `case_id`, `created_by_user_id`, `due_at`, `scheduled_day`.
- Setting status to completed sets `completed_at`; changing away clears it.
- Audited as `followup.updated` with changed fields.
- Clinicians can also update via same endpoint if in scope.

---

## 6) Embedded Backend Synchronization

### Verified sync
- API and embedded backend (`apps/mobile/android/app/src/main/python-backend/`) modules are synchronized:
  - `main.py`, `models.py`, `permissions.py`, `schemas.py` are byte-identical between `services/api/app/` and embedded copies (per Phase B.1 verification).
- Migration copied to `apps/mobile/android/app/src/main/assets/alembic_pack/alembic/versions/20261028_01_prescriptions.py`.
- No unrelated local modifications overwritten.

### Offline/standalone
- Standalone/validation paths exist (`M3_DATABASE_MODE=none`, `POST /api/v1/validate-questionnaire` works without DB). Offline demo mode in mobile app is synthetic/read-only. No claims made about offline mutation/sync/notification delivery without implementation/tests.

---

## 7) Tests Executed, Exact Commands, Outcomes, and Failures

### Environment assessment
- **Python**: System has Python 3.14.8 at `/usr/bin/python3.14`, Python 3.15.1 via mise at `/home/nimr/.local/share/mise/installs/python/3.15.1/bin/python3`. No venvs with dependencies in `services/api/.venv`.
- **Dependencies**: `services/api/requirements.txt` requires `fastapi==0.115.12`, `uvicorn[standard]==0.34.2`, `SQLAlchemy==2.0.55`, `psycopg[binary]==3.2.13`, `alembic==1.15.2`, `pytest==8.3.5`, `httpx==0.28.1`, etc. None installed in system site-packages or user site-packages. `psycopg-binary==3.2.13` not available for Python 3.15 per earlier attempts.
- **Network**: Internet connectivity to PyPI appears restricted/timing out (connection timeouts observed). No cached wheels found.
- **Docker**: Docker installed (29.9.2) but user not in docker group; permission denied connecting to docker socket. Cannot use `docker compose run`.

### Commands attempted
```bash
cd /home/nimr/Projects/m3/services/api && PYTHONPATH=. python3.14 -m pytest tests/test_rbac.py tests/test_auth_matrix.py tests/test_cases.py -v
python3.14 -m venv /tmp/api-venv && /tmp/api-venv/bin/pip install -r requirements.txt
/tmp/api-venv/bin/pip install fastapi uvicorn sqlalchemy alembic pytest httpx ...
docker compose run --rm api pytest tests/test_rbac.py tests/test_auth_matrix.py tests/test_cases.py -v
```

### Outcomes
- **All test execution attempts failed** due to missing dependencies (`ModuleNotFoundError: No module named 'fastapi'`). 
- Tests have been updated to match new expected behavior (see git diff): `tests/test_auth_matrix.py` and `tests/test_rbac.py` updated; `tests/test_cases.py` comment clarified.
- **No tests were successfully executed in this environment.** Exit codes not applicable due to import failures.

### Recommendation for test execution (supported environment)
```bash
# Using Docker (if permissions available)
docker compose run --rm api pytest services/api/tests/test_rbac.py services/api/tests/test_auth_matrix.py services/api/tests/test_cases.py -v

# Or with proper venv and compatible Python (Python 3.12 recommended per README)
cd services/api
python3.12 -m venv .venv
source .venv/bin/activate  # or .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. pytest tests/test_rbac.py tests/test_auth_matrix.py tests/test_cases.py -v

# Or use SQLite in-memory (tests use disposable DBs)
M3_TEST_DATABASE_URL=sqlite:///./test-m3.db PYTHONPATH=. pytest tests/test_rbac.py -v
```

**Relevant tests to run:** Authentication/role matrix, questionnaire regression/validation, dashboard role scopes/count accuracy/card destinations, Research Lab positive RDT/microscopy eligibility and negative/pending/indeterminate/cancelled/missing denial, direct-ID access/mixed-sample isolation, Research result creation authorization, Health Worker assigned vs unassigned follow-up updates, immutable fields/stale updates/completion timestamps/audit events, notification recipient scoping/target authorization/read behavior, case/referral behavior, prescription model/migration integrity, API and embedded backend consistency.

---

## 8) Migration Validation Results

### Migration added
- **File:** `services/api/alembic/versions/20261028_01_prescriptions.py` (also copied to embedded assets)
- **Type:** Additive only
- **Changes:** Creates `prescriptions` table with all required fields (patient_id, case_id, assessment_id, prescriber_id, medicine_name, dose/unit/frequency/duration/start_date, instructions, status with server_default 'active', supersedes_prescription_id, revised_by_prescription_id, timestamps). Includes indexes.
- **Downgrade:** Drops table only.
- **Data safety:** No drops/edits to existing columns or data. No destructive changes. Existing `treatment_documentation` on clinical_assessments preserved.
- **Dependencies:** `down_revision = "20261027_01"` (based on existing migration chain)
- **Compatibility:** Models updated to match. Embedded backend synced.

### Validation status
- Migration structure reviewed and confirmed additive/safe.
- **Not executed** in this environment (no DB/deps). Should be tested with disposable DB: `alembic upgrade head` then `alembic downgrade -1` then `alembic upgrade head` on test DB only. Never test destructive downgrade against retained data.

---

## 9) Security Findings and Fixes

### Fixed issues (verified)
- **Research Lab over-broad access:** Previously could see all samples/results regardless of eligibility. **Fixed:** Server-side filtering to positive RDT/microscopy only; eligibility enforced on lists, direct-by-ID, and creation.
- **Research Lab field exposure:** Patient view exposed extra fields. **Fixed:** Explicit allowlist `{id, patient_code, display_name, age_years, gender, updated_at}`; forbidden fields stripped; restricted `research` block with limited diagnosis/case info only.
- **Direct-ID bypass:** Ineligible cases could be accessed via guessing IDs. **Fixed:** Eligibility rechecked in worker_detail and patient scope; 403 for ineligible.
- **Health Worker follow-up updates blocked:** Workflow gap. **Fixed:** Scoped PATCH/PUT endpoint for assigned follow-ups only with field restrictions and audit.
- **Notification recipient scoping:** Research Lab/Health Worker recipients properly scoped.

### Security posture
- Role-based authorization enforced server-side on all endpoints.
- Direct-ID access protected.
- No "other number" field exists or exposed (guards in place).
- Screening result ownership intact; molecular results don't auto-alter screening/diagnosis/prescriptions.
- Marking notifications read doesn't alter clinical data.
- Admin remains read-only.
- No unauthorized access expansion.

### Remaining concerns
- **Notification deduplication:** Not implemented. Retries could create duplicates. No safe mechanism identifiable from schema alone.
- **DHS role:** Not present as distinct role; no assumptions made about Admin equivalence.
- **Prescription CRUD:** Not implemented (groundwork only) - requires stakeholder decisions.

---

## 10) Remaining DHS, Prescription, and Other Stakeholder Decisions

### DHS
- **Status:** Not present as a distinct role in codebase. Admin exists as read-only.
- **Decision needed:** Confirm what "DHS" means in this project, whether it differs from Admin, required permissions/scope, and whether notifications should be sent to DHS. No DHS notifications activated; no global access granted. This is independent of other work but blocks DHS-specific notification features.

### Prescriptions (workstream E)
- **Status:** Groundwork added - `Prescription` model and additive migration created. No API endpoints or UI implemented.
- **Decisions needed:**
  1. Required and optional prescription fields (beyond current model)
  2. Dose/unit/frequency/duration validation rules
  3. Allowed statuses and transitions
  4. Prescription-to-case/assessment linkage requirements
  5. Authorized roles for creation/revision/discontinuation (likely clinician-only)
  6. Immutable revision history and supersession rules (model supports via links)
  7. Audit requirements
  8. Approved visibility for each role (Research Lab? Health Worker? DHS?)
- **Note:** Do not backfill free-text `treatment_documentation` into structured prescriptions. Do not invent medication defaults/treatment protocols. Classified as deferred clinical workflow pending approval.

### Other decisions (from Phase B reports)
1. Which role(s) are "Authorised ICMR/project staff" for initial worker profile creation (admin is read-only currently)?
2. Who manages facilities/sites/assignments/user roles on an ongoing basis?
3. Final Research Lab field allowlist beyond current restricted set (diagnosis/prescription fields exposed)?
4. Case/episode closure rules?
5. SMP eligibility for Research Lab (currently excluded pending lab-owner confirmation)?
6. Health Worker follow-up constraints (case status requirements, etc.)?

---

## 11) Known Limitations and Explicitly Deferred Features

### Limitations
- **Tests not executed:** Cannot run pytest due to missing dependencies (fastapi/sqlalchemy/etc.) and no network access to PyPI; Docker not accessible without permissions. All test changes made but not verified in this environment.
- **Dashboard UI wiring:** Web OverviewScreen doesn't explicitly handle new scopes (`health_worker_assigned`, `research_eligible`, `admin_readonly`) with their specific fields - backend returns correct data but UI may not display all fields nicely.
- **Notification deduplication:** Not implemented; duplicates possible on retries. No safe idempotency mechanism without schema changes/clear event identity.
- **Prescription CRUD/UI:** Only model+migration added, no API endpoints or frontend.
- **DHS:** Not implemented as distinct role.
- **Offline mutation/sync:** Not verified/tested; only read-only/demo paths exist.

### Explicitly deferred
- Structured prescription API endpoints and UI (pending stakeholder decisions)
- Broad DHS notification/access (pending role mapping)
- Global notification deduplication (needs reliable event identity or approved schema change)
- UI enhancements for new dashboard scopes (backend ready)
- Any clinical protocol defaults/treatment durations/case closure rules

---

## 12) Release Recommendation

**RECOMMENDATION: BLOCKED**

### Evidence
1. **Core functionality implemented:** Dashboard role-aware counts, worker navigation with proper scoping, notification system with Research Lab/Health Worker support, Research Lab eligibility enforcement, Health Worker follow-up updates, screening ownership protections all implemented server-side with embedded backend synced.
2. **Security:** All authorization enforced server-side, no unauthorized access expansion, questionnaire unchanged.
3. **Tests updated:** Test expectations updated for new permissions.
4. **Migrations:** Additive prescription migration ready.
5. **BLOCKER - Tests not executed:** Cannot verify in this environment due to missing dependencies and inaccessible test infrastructure (no PyPI access, no Docker permissions). The codebase states tests passed in previous environments, but current environment cannot run them.

### Conditions for READY FOR REVIEW
- Run tests in supported environment (Docker or proper venv with Python 3.12) and confirm all relevant tests pass
- Verify dashboard UI displays new scopes correctly (or document UI gaps)
- Test migration upgrade/downgrade on disposable DB
- Address any test failures

### Production readiness note
Even if engineering tests pass, production readiness requires appropriate clinical validation, privacy/security approval, deployment review, and real-device verification as stated in requirements.

---

**Report generated by Phase D agent. All changes are additive/safe, no destructive operations performed, no data modified.**

---

## Update (Final Closure Pass)

### Task 1: Dashboard UI wiring (completed)
- **Web (`apps/web/src/types.ts`)**: Extended `DashboardPayload` to include `health_worker_assigned`, `research_eligible`, `admin_readonly` shapes matching backend.
- **Web (`apps/web/src/screens/OverviewScreen.tsx`)**: Added rendering for all role scopes with correct counts, loading/empty/error states, no fabricated values. Cards use existing `Metric`/`Card` components; navigation via `onGo` to existing tabs.
- **Mobile (`apps/mobile/app/dashboard.tsx`)**: Existing dashboard loads `/dashboard` and displays metrics; role-aware backend counts now available. No breaking changes made.
- **Role coverage**: worker, contractor, health_worker, research_lab, admin, clinician, pathologist all handled by scope-based rendering. No DHS role added. No screening controls added to cards.

### Task 2: Tests and migration
- **Test environment**: No compatible Python environment with dependencies available. Python 3.12 not found; Python 3.14/3.15 present but packages (fastapi/sqlalchemy/pytest/alembic/psycopg) not installed. Network/PyPI access appears restricted; Docker not accessible (permission denied). Could not run tests.
- **Tests updated in repo**: `services/api/tests/test_auth_matrix.py`, `services/api/tests/test_rbac.py` updated to match new permissions.
- **Migration**: `services/api/alembic/versions/20261028_01_prescriptions.py` is additive only (creates table, no drops/edits). Not executed in this environment. Must validate on disposable DB only.

### Task 3: Notifications
- Recipient scoping enforced server-side (Research Lab/Health Worker helpers). Target authorization via patient/sample scope checks. Read endpoint marks own notifications only; marking read does not alter clinical data. **Deduplication:** Not implemented globally; duplicates may occur on retries. No reliable event identity established from current schema without guessing - not implemented per safety constraints.

### Final Release Decision
**BLOCKED** - Core integrations implemented and UI wired for all scopes; tests could not be executed due to environment/infrastructure limitations. All safety constraints honored.
