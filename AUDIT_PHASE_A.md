# M3 Platform — Phase A Audit (Evidence-Based)

**Date:** 2026-10-24  
**Repository:** /home/nimr/Projects/m3 (git repo)  
**Goal:** Understand actual app, align with real workflow, identify gaps for minimal changes.

## 1) High-Level Architecture (as implemented)

```
Expo Go mobile ─┐                         ┌─ PostgreSQL (private Docker network)
                 ├─ HTTPS in prod ─ FastAPI / OpenAPI ─ Alembic + SQLAlchemy
Vite web LAN ───┘                         └─ audit events and session records
```

**Key points:**
- **Mobile:** `apps/mobile` (Expo Router + TypeScript). Uses Expo SQLite only for signed-in user's viewing cache + Expo SecureStore for access token. **No outbox / no queued writes** (by design per docs). 
- **Web:** `apps/web` (Vite/React) office console.
- **API:** `services/api` (FastAPI) owns validation, role checks, patient scope, session validity, audit events, persistence. PostgreSQL authoritative. OpenAPI at `/docs`. CORS/mob API URL are env-configured.
- **Auth:** PIN-based login (phone + PIN), tokens stored server-side in `sessions`, logout revokes session. Passwords hashed (argon2 via pwdlib). Accounts provisioned via bootstrap or signup.
- **Deployment:** Docker Compose publishes API on port 8000; Postgres not published externally. `alembic upgrade head` runs on API startup in compose. Defaults to HTTP for local synthetic dev.

## 2) Roles (implemented)

From `services/api/app/permissions.py` and `schemas.py`:
- Roles: `worker`, `contractor`, `pathologist`, `clinician`, `health_worker`, `research_lab`, `admin` (legacy `pathology` accepted and normalized to `pathologist`)
- **Read-only:** `health_worker`, `research_lab`, `admin` (cannot write per `can_write()` returning False for mutations)
- **Write perms:**
  - `clinician`: `clinical`, `travel`, `followup_assign`, `qr`
  - `pathologist`: `lab` 
  - `contractor`: `membership`, `contractor_status`, `travel`, `site`
  - `worker`: `questionnaire`, `qr`

## 3) Data Model (core entities)

From `services/api/app/models.py`:
- **Identity**: `User` (phone_e164 unique, display_name, pin_hash, roles via `RoleAssignment`, optional link to `Patient` via `patient_id`, unique partial index on non-null). `Session` for auth.
- **Org structure**: `Facility` (code, name, district, facility_type), `Site` (code, name, contractor_name, contractor_user_id FK, district, area, status). Contractor can own/manage sites.
- **Worker/Patient**: `Patient` (UUID id, `patient_code` unique human-readable, demographics, phone_e164 indexed, screening_completed flag, client_request_id for idempotent replay, created_by_user_id). **No government ID stored as full number by default** (only id_type/id_other_details). 
- **Assignments**: `WorkerSiteAssignment` (patient_id, site_id, start_date, end_date nullable, contractor-reported status fields, reported_at/by, client_request_id). **Partial unique index ensures at most one active assignment per worker**.
- **Screening**: `QuestionnaireSubmission` (patient_id, schema_version, state draft/submitted, data JSON, client_request_id unique for idempotency, submitted_at). 
- **Travel**: `TravelEvent` (patient_id, origin, destination nullable, arrival/departure/return dates, planned bool).
- **Clinical**: `ClinicalAssessment` (patient_id, facility_id, clinician_id, encounter_at, vitals/symptoms/comorbidities, admission details, treatment_given/follow_up_assigned flags, re_screening_reason for rescreens, case_id). Has `screening_completed` stamped on first encounter.
- **Lab**: `Sample` (sample_code, patient_id, facility_id, collected_at, status, specimen_type, case_id) → `DiagnosticTest` (method, result_status, species, smear_type, operator_id). `SlideFollowUp` for scheduled slides.
- **Follow-up**: `FollowUp` (patient_id, assigned_user_id, due_at, status, adherence/outcome/notes). 
- **Cases/Surveillance**: `Case`, `CaseEvent`, `SymptomReport`, `Notification` (case-centric workflow added in later migration).
- **Research**: `MolecularResult` (sample_id, pcr_status, species_confirmation, parasite_density, gametocyte_presence, resistance_markers JSON, pfhrp2/3 status, performed_by).
- **Audit**: `AuditEvent` (actor, action, entity_type/id, occurred_at, detail JSON).
- **QR**: `WorkerQrToken` for site linking.

All use UUID PKs (string(36)) with `uid()`, timestamps with timezone. Soft-ish patterns (revoked_at on roles/sessions/tokens). History preserved (assignments have end_date, assessments not overwritten, tests stored separately).

## 4) Screening Questionnaire (5 sections) — matches docs

**Schema/storage:** `{"personal", "past_history", "present_clinical", "migration_history", "planned_travel"}` in `questionnaire_submissions.data` (JSON). Versioned (schema_version=1).  
**Validation:** `services/api/app/questionnaire.py` implements detailed rules matching the Sept 2026 source.  
**Mobile UI:** `apps/mobile/app/intake.tsx` with date pickers, conditional logic, draft save/load, idempotent submission.  
**API:** `POST/PUT /api/v1/questionnaires/*`, validation endpoint `POST /api/v1/validate-questionnaire` (DB-free).

Key validations: DOB 0-90 years ago, age in completed years must match DOB, phone format loose (8-15 digits), conditional chains for past malaria/treatment, fever/symptoms logic, travel dates (return >= departure, planned departure not in past), mutually exclusive symptoms, etc. Recent gaps fixed (see §5).

## 5) Questionnaire Gaps — Status (already addressed per docs)

Per `docs/QUESTIONNAIRE_GAP_IMPLEMENTATION.md` and `QUESTIONNAIRE_AUDIT_MATRIX.md`:
- **G1** (SMP/smear): `create_sample` now accepts `smear_type` for `microscopy` or `smp` (fixed). Tests added.
- **G2** (Clinician patient lookup): `create_assessment` uses `resolve_patient()` accepting code or UUID. Added `WorkerLookupField` component for search. New columns persisted (symptoms_other_note, treatment_given, follow_up_assigned). Tests added.
- **G3** (Planned travel): Server now requires departure+destination for `planned=true` and rejects past departure; historical trips unrestricted. Client picker has `minISO=today`. Tests added.
- **G4** (Positive needs species): Server requires species when `result_status="positive"`. Species enum enforced. Tests added.
- **G5**: Docs corrected.
- **G6**: Slide follow-up due date uses calendar picker.
- **G7**: Removed redundant mobile number field from contractor travel modal.

Backend tests: 153 passed, 1 skipped (SQLite) / 154 passed, 0 skipped (Postgres) after remediation. Mobile typecheck clean.

## 6) Current Workflow Implementation

### Worker/Patient
- Can self-register (worker role) via `/api/v1/auth/signup`; creates linked Patient profile.
- Can complete screening questionnaire (draft/save/submit). Single-screening enforced via `screening_completed` flag (SCR-009). Rescreens require authorized clinician/health_worker with reason.
- Has stable `patient_code` and UUID; phone indexed for lookup.

### ICMR/Authorized staff creating worker profiles
- `POST /api/v1/workers` allows `worker` or `contractor` roles (with write perms). Workers creating own profile get auto-linked. Contractors can create profiles with site assignment. Idempotent via `client_request_id`. Duplicate phone detection with candidates. DOB/age validation. Age mismatch flags `age_flagged`.

### Contractor
- Can create/manage sites (owns sites), assign workers to sites (via QR or worker_id), transfer workers between sites (with confirmation). Views roster for authorized sites only (minimal fields, no clinical notes). Can record `reported_malaria_status`/`reported_treatment_status` on assignment (separate from lab results). Can record travel episodes. Role-isolated.

### Health Worker
- **Read-only** per permissions. Can view assigned follow-ups (`assigned_followup_patient_ids`). Can search workers if in allowed roles? Search permissions depend - `GET /workers` allows health_worker to search by name/home state/phone (see main.py:695-710). Can view worker details if assigned follow-up. No create/update/delete.

### Clinician/Medical Officer
- Can create assessments (`create_assessment`), search workers by code/UUID/name/phone. Must provide reason for rescreen if already screened. Records admission/discharge, prescriptions as free text (`treatment_documentation`), flags (treatment_given, follow_up_assigned). Facility required context.

### Pathologist/Lab
- Can create samples and diagnostic tests (`create_sample`). Records method/result/species/smear type. Follow-up slides via `save_slide_followup`. Must link to existing patient; can search workers.

### Research Lab
- **Read-only**. Can access samples/molecular results? `GET /samples` allows research_lab. Has `MolecularResult` model and schema. Can create/update molecular results? `MolecularCreate` schema exists and permissions allow? `can_write` doesn't list molecular - research_lab is read-only, so cannot create molecular results via normal write paths. But need to look up actual endpoints.

### Admin/DHS
- **Read-only**. Broad operational view? Can search workers, view all records per `can_read_patient` returning True for admin.

## 7) API Endpoints (relevant)

**Auth:** POST /auth/login, /auth/signup, /auth/logout, GET /me, POST /bootstrap/users  
**Workers/Patients:** GET/POST /workers, GET/PATCH /workers/me, GET /workers/{id}, GET/POST /workers/{id}/qr-token, POST /workers/resolve-qr  
**Sites/Memberships:** GET/POST /sites, GET /sites/{id}/workers, POST /sites/{id}/workers, POST /workers/{id}/membership  
**Screening:** GET/PUT /questionnaires/draft, POST /questionnaires/submit, POST /validate-questionnaire  
**Travel:** POST /workers/{id}/travel  
**Contractor status:** PUT /workers/{id}/reported-status  
**Clinical:** POST /assessments, GET /assessments  
**Lab:** GET/POST /samples, POST /samples/{id}/slide-followups  
**Follow-ups:** GET/POST /followups  
**Research/Molecular:** POST /molecular (need to check), GET endpoints  
**Cases/Notifications:** Case workflow endpoints exist (Case model added)  
**Facilities:** GET /facilities  

## 8) Offline & Standalone

**Mobile:** Uses Expo SQLite only for **signed-in user's viewing cache** - no outbox, no queued writes (per ARCHITECTURE.md). First screen supports synthetic demo launch without API. Read-only cached worker browsing when offline.  
**API:** Has validation-only mode (`M3_DATABASE_MODE=none`) returning 503 for DB endpoints but `/validate-questionnaire` works without DB.  
**Docker:** Compose setup with scripts `m3s`/`m3i` for managing services.  
**Docs:** `docs/STANDALONE_LOCAL_SERVER.md`, `docs/OFFLINE_TABLET_DEMO.md` exist.

## 9) Gaps vs Required Workflow (from problem description)

Comparing required workflow (Steps 1-10) to implementation:

### Step 1 - Programme structure setup
**Have:** Facilities, Sites, Users/Roles/Assignments exist. Admin can manage? Admin is read-only per permissions - cannot create users/sites/facilities via write API (can_write returns False for admin). Bootstrap endpoint exists for initial setup. **Gap:** Admin role is read-only in current policy - may need to confirm if admin should be able to manage structure, or if different role handles it. Also "Authorised staff maintain..." - need to see who can create facilities/sites. Sites can be created by contractors (POST /sites requires contractor role). Facilities - only GET exists, no POST endpoint visible. **Potential gaps in management capabilities.**

### Step 2 - Onboard worker
**Have:** ICMR/project staff can create worker profiles via POST /workers (worker or contractor roles can write). Links to site via assignment. Duplicate detection exists. **Mostly OK.** Need to confirm which roles are considered "authorised ICMR/project staff" - could be admin/clinician/pathologist? Currently admin is read-only so cannot create workers. **Gap:** Role assignment for onboarding may need clarification.

### Step 3 - Site screening
**Have:** Health Worker can search workers (GET /workers allows health_worker), select site context, complete screening questionnaire. Questionnaire has 5 sections as specified. **OK.**

### Step 4 - Positive cases & referral
**Have:** Lab records results via samples/diagnostic tests, marks positive. Case workflow exists (Case model, notifications for positive results). **Need to verify** referral routing to PHC clinician is properly implemented.

### Step 5 - Clinician assessment & prescription
**Have:** Clinician creates assessment with treatment_documentation (free text). **Gap:** "Prescriptions should be structured according to the approved clinical requirements. Inspect the current prescription model before deciding which fields to add or change." Current model only has `treatment_documentation` (Text) - no structured prescription fields. May need to add structured prescription model/fields.

### Step 6 - Research Lab access for positive cases
**Have:** Research Lab is read-only, can view samples (GET /samples allows research_lab). MolecularResult model exists. **Critical requirement:** "Enforce this restriction on the backend/API, not just in the user interface. Test direct API access for unauthorised users and negative cases." Also "The field referred to as “other number” remains undefined and must not be exposed to the Research Lab until its meaning and sharing policy are approved." Need to check if any field named "other_number" exists and is exposed. Also need to verify Research Lab only sees positive cases? Current GET /samples doesn't filter by positive status - it just checks permissions. **Gap:** Filtering logic for Research Lab to only see positive cases and exclude certain fields.

### Step 7 - Record molecular results
**Have:** MolecularResult model exists with PCR, parasite density, gametocytes, resistance markers, pfhrp2/3. Schema MolecularCreate exists. **Gap:** Need to check if POST /molecular endpoint exists and permissions allow Research Lab to create? Research Lab is read-only per permissions.can_write() - returns False for all data kinds. But Research Lab needs to "record approved molecular research information" per requirements. **Major gap:** Permission model may need adjustment or different role setup.

### Step 8 - Clinician reviews treatment
**Have:** Clinician can create assessments (can update via new assessment?). Assessments are created via POST /assessments. Original prescription and revisions as separate records - each assessment is a separate record, so history preserved. **OK structure-wise.**

### Step 9 - Health Worker follow-up
**Have:** FollowUp model, Health Worker is read-only but can view assigned follow-ups. **Gap:** Health Worker needs to "record the approved follow-up information" (medication adherence, symptoms, adverse effects, follow-up status, outcomes). But Health Worker is read-only - cannot create/update follow-ups. Also need to check if there are endpoints for Health Worker to record follow-up data.

### Step 10 - Outcome and closure
**Have:** Case model has status/closed_at. **Need to verify** closure workflow exists.

## 10) Critical Issues Found

### Permission Issues
1. **Research Lab cannot write molecular results** - Research Lab is in READ_ONLY_ROLES and can_write returns False for them. But requirements say "The Research Lab records the approved PCR/molecular sample and result details" (Step 7). This is a direct conflict.
2. **Health Worker cannot record follow-up data** - Health Worker is read-only, but Step 9 says they must "record the approved follow-up information". Major conflict.
3. **Admin cannot manage structure** - Admin is read-only, but Step 1 says "Authorised staff maintain..." programme structure. Unclear who has write access.

### Missing/Unclear Endpoints
- POST /molecular or similar for creating molecular results?
- Endpoints for Health Worker to update follow-up records?
- Endpoints for managing facilities/sites by admin?
- Prescription model - currently just free text in assessment

### Research Lab access control
- Need to enforce: only positive RDT OR positive microscopy qualifies for Research Lab access
- Must exclude "other number" field (undefined) from Research Lab views/exports
- Must restrict to approved fields only
- Need to test direct API access

### Data model gaps
- Structured prescriptions (currently just treatment_documentation text)
- "other number" field - need to find if it exists anywhere
- Clear case/episode linking for workflow steps

## 11) Recommendations (Minimal Safe Changes)

### Immediate investigation needed
1. Find all occurrences of "other_number" or similar fields
2. Look up molecular result endpoints and how they're created
3. Look up follow-up update endpoints
4. Check if there are different permission interpretations
5. Understand the full Case workflow endpoints
6. Look up how Research Lab access is actually implemented

### Potential minimal fixes
1. **Permissions**: May need to adjust can_write for research_lab to allow writing molecular results? Or create specific permission. Or check if "research_lab" needs different treatment.
2. **Permissions**: Health Worker needs to record follow-up - may need to allow followup updates for health_worker.
3. **Research Lab filtering**: Add backend logic to filter samples/results for research_lab to only positive cases and exclude restricted fields.
4. **Prescriptions**: May need to add structured prescription fields to ClinicalAssessment or create separate Prescription model.
5. **Admin permissions**: May need to allow admin to manage certain resources.

But need to be careful not to change things without understanding full picture. Let us look up the actual molecular and follow-up endpoints.