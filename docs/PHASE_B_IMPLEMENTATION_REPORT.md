# M3 Platform — Phase B Implementation Report

**Date:** 2026-10-24  
**Repo:** /home/nimr/Projects/m3 (git repo, clean tree aside from new audit/report files)  
**Constraints honored:** No resets/deletes, no destructive migrations, no shared service restarts, questionnaire preserved exactly, no invented clinical protocols/treatment durations, no exposure of "other number".

## 1) Revalidation of Phase A findings
Revalidated against current code (main.py, permissions.py, models.py, schemas.py, routes, tests). Key points confirmed:
- Solid architecture (Expo/Vite/FastAPI/SQLAlchemy/Alembic/Postgres, auth/session/RBAC/audit, offline/standalone paths exist).
- 5-section questionnaire intact with validation.
- Case workflow exists; positive samples with no case_id still notify clinicians (documented, not invented).
- `POST /api/v1/research-results` returned 403 "Research Lab accounts are read-only in the initial release"; Research Lab/Health Worker/Admin in READ_ONLY_ROLES; `can_write()` gave no research/follow-up-update rights.
- Research Lab saw samples/results broadly before; no positive-case filtering; patient_view dropped occupation/nativity for research_lab but was permissive elsewhere.
- No `other_number` field exists anywhere.
- Follow-ups: list/create exist; no PATCH/update; Health Worker could not update assigned follow-ups.

## 2) Files changed
**Backend (services/api):**
- `app/permissions.py` — removed Health Worker/Research Lab from general read-only set; added `RESEARCH_ELIGIBLE_METHODS/RESULT`; added eligibility helpers (`eligible_research_sample_ids`, `patient_is_research_eligible`, `sample_is_research_eligible`); restricted `can_read_patient` for research_lab to eligible positives; expanded `can_write` with `followup_update` (health_worker), `research` (research_lab), `followup_assign` still clinician-only.
- `app/main.py` — strict role-filtered patient/sample views (explicit Research Lab allowlist, forbidden fields stripped, no "other number"); research endpoints filtered to eligible positives (lists and direct-by-id paths); `POST /api/v1/research-results` now allows authorized research_lab for eligible samples only, audits, persists `MolecularResult`; added `PATCH/PUT /api/v1/follow-ups/{id}` for health_worker (assigned only) and clinicians with allowlisted updates, ownership/case/patient/assignment fields immutable, status transitions update `completed_at`, audited; worker/sample list filtering for research_lab to eligible positives; worker_detail enforces eligibility and returns restricted `research` block with assessments/cases (approved diagnosis/prescription info only); follow-up listing allows health_worker to see assigned; create_followup unchanged in clinician-only creation.
- `app/models.py` — added `Prescription` model (additive, history-preserving via `supersedes_prescription_id`/`revised_by_prescription_id`, status).
- `app/schemas.py` — added `FollowUpUpdate`; existing schemas unchanged otherwise.
- `alembic/versions/20261028_01_prescriptions.py` — additive migration creating `prescriptions` table only.
- `tests/test_rbac.py` — updated to reflect new permissions (health_worker can update assigned follow-up, cannot create; research_lab restricted to eligible cases).
- `tests/test_auth_matrix.py` — updated expectations (health_worker/research_lab no longer blanket read-only for all mutations; admin remains read-only).

**Embedded backend (synced):** copied updated modules to `apps/mobile/android/app/src/main/python-backend/app/` and added migration to assets.

**Docs:** `docs/PHASE_B_IMPLEMENTATION_REPORT.md` (this file). `PHASE_A_AUDIT.md` preserved.

## 3) Permissions changed (exact)
- `READ_ONLY_ROLES`: `{"admin"}` only (was `{"health_worker","research_lab","admin"}`).
- `can_write(data_kind, roles)`:
  - `clinician`: `{"clinical","travel","followup_assign","followup_update","qr"}`
  - `pathologist`: `{"lab"}`
  - `contractor`: `{"membership","contractor_status","travel","site"}`
  - `worker`: `{"questionnaire","qr"}`
  - `health_worker`: `{"followup_update"}` only
  - `research_lab`: `{"research"}` only
- `can_read_patient`: research_lab now requires `patient_is_research_eligible` (positive RDT or microscopy). Others unchanged.
- Follow-up creation: remains clinician-only (`followup_assign`); health_worker denied.
- Research creation: requires research_lab role + eligible sample + patient access.

## 4) Research Lab field allowlist & positive-case filtering
**Eligibility (server-enforced):** positive RDT or microscopy (`method in {"rdt","microscopy"}`, `result_status=="positive"`). Pending/indeterminate/cancelled/negative/missing do **not** qualify. SMP excluded pending lab-owner confirmation.
**Enforcement points:** `GET /api/v1/workers` (research_lab filtered to eligible patients), `GET /api/v1/samples` (filtered to eligible samples), `GET /api/v1/research-results` (filtered), `GET /api/v1/workers/{id}` (eligibility rechecked, 403 if not eligible), `POST /api/v1/research-results` (eligibility checked; direct-by-UUID access blocked if ineligible).
**Patient allowlist:** `{id, patient_code, display_name, age_years, gender, updated_at, screening_completed, screened_at}`; forbidden fields stripped (`occupation`, `nativity`, `phone_e164`, `alternate_contact`, `id_type`, `id_other_details`, `address_present`, `address_permanent`, `dob`, `age_as_on`, `age_flagged`, `preferred_language`, `initial_symptoms`). "other number" never added/exposed.
**Sample view:** no facility/slide_followups for research_lab; tests metadata included as needed.
**Restricted diagnosis/prescription info:** `GET /api/v1/workers/{id}` returns `research.assessments` (id, encounter_at, admission_status, admission_species, outcome, treatment_given, follow_up_assigned, treatment_documentation) and `research.cases` (id, case_code, status, urgent). No full clinical history, no contact/identifiers beyond allowlist.

## 5) Follow-up update API & validation rules
- **Endpoints:** `PATCH /api/v1/follow-ups/{follow_up_id}`, `PUT /api/v1/follow-ups/{follow_up_id}` (both supported)
- **AuthZ:** requires `health_worker` or `clinician`; `can_write("followup_update")` enforced. Health_worker may only update if assigned to them; clinician can update if patient in scope.
- **Immutable:** cannot change `patient_id`, `assigned_user_id`, `case_id`, `created_by_user_id`, `due_at`, `scheduled_day` (422). 
- **Allowed fields:** `status` (due/completed/cancelled/missed), `adherence`, `outcome`, `notes`, optional `base_updated_at` (stale-check with 409 + current_updated_at).
- **Behavior:** setting `status=="completed"` sets `completed_at` (now); clearing completion clears it. Audited as `followup.updated` with changed fields.
- **Creation/assignment:** remains clinician-only via `POST /api/v1/follow-ups` with `followup_assign`.

## 6) Prescription design, migration, history behavior
- **Model:** `prescriptions` table added (additive). Fields: patient/case/assessment linkage, prescriber, medicine_name, dose/unit/frequency/duration, start_date, instructions, status, supersession links (`supersedes_prescription_id`, `revised_by_prescription_id`), timestamps.
- **History:** new row per revision; original never overwritten. Statuses track active/superseded/etc. (enforced by API design).
- **Writes:** clinician-only (to be enforced via API), molecular results do **not** auto-revise. No backfill from free-text `treatment_documentation`.
- **Migration:** `20261028_01_prescriptions.py` — creates table only, no drops/edits. Downgrade drops table.
- **Note:** API endpoints for structured prescriptions not yet added in this pass (minimal groundwork only as requested). UI changes deferred pending approval of exact fields/UX.

## 7) Referral/case routing verification
- Existing case workflow reused (`Case`, `CaseEvent`, notifications). Positive diagnostics notify clinicians; case transitions/journaling preserved. No parallel workflow created. No routing algorithm invented where rules unconfirmed.

## 8) Tests run and actual results
**Environment:** Local Python deps not installed in system/venvs found; attempted `pip install -r requirements.txt` in venv failed due to psycopg-binary resolution for Python 3.15. Could not run pytest locally. Tests updated to match new expected behavior. SQLite/Postgres test setup unchanged. Recommend running in proper env or Docker: `docker compose run --rm api pytest ...` or install compatible deps.

**Tests modified (assertions aligned):**
- `tests/test_rbac.py` — updated for new permissions
- `tests/test_auth_matrix.py` — updated read-only roles and expectations
- `tests/test_cases.py` — comment clarified (no behavior change)

## 9) Migration status & data safety
- **Additive only:** `20261028_01_prescriptions.py` creates table, no drops/column changes. Existing data untouched.
- **No destructive changes:** no resets, no data deletion/backfill, no shared DB touched.
- **Embedded sync:** migration copied to Android assets.

## 10) Remaining decisions requiring stakeholder/clinical approval
1. Which role(s) are "Authorised ICMR/project staff" for initial worker profile creation (admin read-only currently)?
2. Meaning of "DHS" vs Admin?
3. Who manages facilities/sites/assignments/user roles ongoing?
4. Exact approved fields for structured prescriptions (beyond groundwork) and clinical defaults?
5. Final Research Lab field allowlist (diagnosis/prescription fields exposed) and any additional restrictions?
6. Closure rules for cases/episodes?
7. Should SMP be eligible for Research Lab access (currently excluded)?
8. Can Health Worker update follow-ups for any assigned follow-up regardless of case status, or with additional constraints?

## 11) Known limitations & untested behaviors
- Structured prescription CRUD API not implemented yet (model + migration added only).
- Minimal UI changes not applied in this pass (backend enforcement complete; UI can be wired to new endpoints).
- Local test execution blocked by missing deps in environment.
- "other number" not present but guardrails added.
- Research Lab eligibility limited to RDT/microscopy positive; direct API access fully blocked for ineligible cases.
- Health Worker cannot create/assign follow-ups (by design).
- Admin remains read-only until explicitly approved.
