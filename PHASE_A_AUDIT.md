# M3 Platform — Phase A Audit (Evidence-Based)

**Date:** 2026-10-24  
**Repo:** /home/nimr/Projects/m3 (git repo)  
**Working tree:** Clean as-is (no resets/deletions). Dependencies not installed in obvious venvs, tests require env setup.

## 1) Architecture (actual)

```
Expo Go mobile ─┐                         ┌─ PostgreSQL (private Docker network)
                 ├─ HTTPS in prod ─ FastAPI / OpenAPI ─ Alembic + SQLAlchemy
Vite web LAN ───┘                         └─ audit events and session records
```

- **Mobile (`apps/mobile`)**: Expo Router + TypeScript. Expo SQLite for signed-in user's viewing cache only; Expo SecureStore for access token. **No outbox/queued writes**. Read-only cached browsing offline; first screen has synthetic demo without API. (`docs/ARCHITECTURE.md`)
- **Web (`apps/web`)**: Vite/React office console.
- **API (`services/api`)**: FastAPI owns validation, RBAC, patient-scope, sessions, audit, persistence. PostgreSQL authoritative. OpenAPI at `/docs`. Compose publishes API on 8000 (host), Postgres unexposed to host. `alembic upgrade head` runs on startup in compose.
- **Auth**: PIN-based (phone + 4-12 digit PIN), argon2 hashes, JWT sessions in DB (`sessions` table), server-side logout revokes sessions. Rate limiting/lockout exist. Bootstrap via secret header.
- **Offline/standalone**: Validation-only mode (`M3_DATABASE_MODE=none`) returns 503 for DB endpoints but `POST /api/v1/validate-questionnaire` works without DB. Scripts `m3s`/`m3i` manage services. Docs for standalone/local-server and offline tablet demo exist.

## 2) Data model (key entities/relationships)

From `services/api/app/models.py` + migrations:
- **Identity**: `User` (phone_e164 unique, display_name, pin_hash, preferred_language, active, patient_id FK to Patient with partial unique index), `RoleAssignment` (user_id, role, scope_type/scope_id, revoked_at, unique per scope), `Session`.
- **Org**: `Facility` (code/name/district/facility_type), `Site` (code/name/contractor_name/contractor_user_id, district/area, status, client_request_id). 
- **Workers/Patients**: `Patient` (UUID id, patient_code unique, demographics/contact/address/id_type/other details, age/dob/age_flagged, phone_e164 indexed, screening_completed/screened_at, consent_status, nativity/occupation, client_request_id unique partial, created_by_user_id). **No full government ID stored by default.**
- **Assignments**: `WorkerSiteAssignment` (patient_id, site_id, start_date, end_date nullable, reported_malaria_status/treatment_status reported by contractor, reported_at/by, client_request_id). **Partial unique index: at most one active assignment per worker**. History preserved via end_date.
- **Screening**: `QuestionnaireSubmission` (patient_id, schema_version, state draft/submitted, data JSON, client_request_id unique, submitted_at, respondent_user_id). 5 sections as specified.
- **Travel**: `TravelEvent` (patient_id, origin, destination, arrival/departure/return dates, planned bool).
- **Clinical**: `ClinicalAssessment` (patient_id, facility_id, clinician_id, encounter_at, vitals/symptoms/comorbidities/general condition/BP, admission details/species/severity/outcome/treatment completion, treatment_documentation, treatment_given/follow_up_assigned flags, symptoms_other_note, admission_species_other_note, re_screening_reason, case_id). First encounter stamps `patient.screening_completed=True`.
- **Lab**: `Sample` (sample_code, patient_id, facility_id, collected_at, status, specimen_type, case_id) → `DiagnosticTest` (method/other_method_note, result_status, species/species_other_note, smear_type, operator_id, performed_at) → `SlideFollowUp` (scheduled_day/due_date, received/positive/positive_day, reasons).
- **Follow-up**: `FollowUp` (patient_id, assigned_user_id, created_by_user_id, scheduled_day, due_at, status, case_id, adherence/outcome/notes, completed_at).
- **Cases/Surveillance**: `Case` (case_code, patient_id, site_id, status, urgent, source, assigned_user_id, client_request_id), `CaseEvent` (journal), `SymptomReport`, `Notification`.
- **Research**: `MolecularResult` (sample_id, pcr_status, species_confirmation, parasite_density/unit, gametocyte_presence, resistance_markers JSON, pfhrp2_status, pfhrp3_status, performed_by).
- **Audit**: `AuditEvent` (actor, action, entity_type/entity_id, occurred_at, detail JSON).
- **QR**: `WorkerQrToken`.

All use UUID PKs, timezone-aware timestamps, FK relationships. History is preserved (end dates, separate assessment records, separate lab events). Soft-revocation patterns used.

## 3) Roles & Permissions (actual)

From `permissions.py`, `security.py`, `schemas.ROLES`:
- **Roles**: `worker`, `contractor`, `pathologist`, `clinician`, `health_worker`, `research_lab`, `admin` (+ legacy `pathology` normalized to `pathologist`)
- **Read-only**: `health_worker`, `research_lab`, `admin` (via `READ_ONLY_ROLES`, `can_write()` returns False for them)
- **Write permissions (`can_write`)**:
  - `clinician` → `clinical`, `travel`, `followup_assign`, `qr`
  - `pathologist` → `lab`
  - `contractor` → `membership`, `contractor_status`, `travel`, `site`
  - `worker` → `questionnaire`, `qr`
- **Patient scope (`can_read_patient`)**:
  - admin/clinician/pathologist → all
  - worker → self only
  - contractor → workers at authorized sites (active assignments)
  - health_worker → workers assigned follow-ups
  - research_lab → all (but field filtering applied by view helpers)

**Note:** Research Lab and Health Worker are read-only in current policy; Admin is read-only. This conflicts with parts of the required workflow (Research Lab must record molecular results; Health Worker must record follow-up data). Also "Authorised ICMR/project staff create initial worker profiles" - unclear which role this maps to given admin is read-only.

## 4) API Surface (relevant endpoints)

**Auth**: POST `/api/v1/auth/login`, `/auth/signup`, `/auth/logout`, GET `/api/v1/me`, POST `/api/v1/bootstrap/users`  
**Workers**: GET/POST `/api/v1/workers`, GET/PATCH `/api/v1/workers/me`, GET `/api/v1/workers/{id}`, GET/POST `/api/v1/workers/{id}/qr-token`, POST `/api/v1/workers/resolve-qr`  
**Sites/Memberships**: GET/POST `/api/v1/sites`, GET `/api/v1/sites/{id}/workers`, POST `/api/v1/sites/{id}/workers`, POST `/api/v1/workers/{id}/membership`, PUT `/api/v1/workers/{id}/reported-status`  
**Screening**: GET/PUT `/api/v1/questionnaires/draft`, POST `/api/v1/questionnaires/submit`, POST `/api/v1/validate-questionnaire`  
**Travel**: POST `/api/v1/workers/{patient_id}/travel`  
**Clinical**: POST `/api/v1/assessments`, GET `/api/v1/assessments`  
**Lab**: GET/POST `/api/v1/samples`, POST `/api/v1/samples/{id}/slide-followups`  
**Follow-ups**: GET `/api/v1/follow-ups`, POST `/api/v1/follow-ups` (clinician can create/assign; health_worker cannot create per RBAC tests)  
**Research**: GET `/api/v1/research-results`, POST `/api/v1/research-results` **returns 403 "Research Lab accounts are read-only in the initial release"**  
**Cases/Notifications**: Case workflow endpoints exist (symptom reports, transitions, notifications)  
**Facilities**: GET `/api/v1/facilities` (no POST visible)  
**Audit**: GET `/api/v1/audit-events` (admin only)  

## 5) Screening Questionnaire (5 sections) - matches requirements

**Structure (verified in `questionnaire.py`, `intake.tsx`)**:
1. Personal details (name, DOB/age, gender, mobile, alternate contact, ID type+details, present/permanent address, preferred language)
2. Past malaria history (diagnosed status, episodes in last 2 years, last detection, treatment place, test details, medication period, course completion, plus repellent/net use/brand/qualification)
3. Present clinical details (fever, temperature, duration, symptoms with "no other symptoms" exclusivity, onset date, breathing/chest pain/confusion, can attend testing)
4. Migration/travel history (time in Goa, outside Goa in last 3 months with states/stay duration, fever before Goa)
5. Planned travel (planning flag, episodes with departure/return/place/fever/treatment/course)

**Validation rules preserved** as documented. Recent gaps fixed (G1-G7) - SMP/smear aligned, patient code lookup for assessments, planned travel server validation, positive requires species, slide due date picker, contractor travel cleanup. All questionnaire tests passing per docs.

## 6) Mobile & Web UI (structure)

**Mobile (`apps/mobile/app/`)**: `_layout.tsx`, `index.tsx` (login/dashboard), `intake.tsx` (screening), `assessment.tsx` (clinician), `diagnostic.tsx` (pathologist), `followup.tsx`, `sites.tsx` (contractor), `research.tsx`, `symptom.tsx`, `mycases.tsx`, `dashboard.tsx`. Components include `WorkerLookupField.tsx` for searching workers.

**Web (`apps/web/src/`)**: Screens and components for office console, role-based views.

## 7) Tests & Status

- Backend tests: 153 passed, 1 skipped (SQLite) / 154 passed, 0 skipped (Postgres) per gap remediation docs. Questionnaire gaps fully tested.
- Mobile typecheck clean.
- RBAC tests confirm read-only roles are enforced.

## 8) Gap Analysis vs Required Workflow

### What works well
- Core entities/relationships exist with history preservation
- Questionnaire fully implemented with validation matching docs
- Role-based access framework in place
- Site/contractor/worker assignment model with history
- Lab results, clinical assessments, follow-ups modeled
- Case/surveillance workflow exists
- Idempotency, audit logging, duplicate prevention
- Research Lab can view samples/research results (read access)

### Critical Gaps

**Permissions/workflow conflicts:**
1. **Research Lab cannot record molecular results** - `POST /api/v1/research-results` hardcoded to return 403 "Research Lab accounts are read-only in the initial release". But Step 7 requires Research Lab to record PCR/molecular results. **Blocker.**
2. **Health Worker cannot record follow-up data** - Health Worker is read-only; `POST /api/v1/follow-ups` denies health_worker. But Step 9 requires Health Worker to record adherence/symptoms/outcomes. **Blocker.**
3. **Admin is read-only** - cannot manage programme structure (facilities/sites/users) as implied by Step 1. Bootstrap exists for initial setup, but ongoing management unclear. **Needs clarification.**
4. **"Authorised ICMR/project staff create initial worker profiles"** - unclear which role(s) this is. Worker/contractor can create via POST /workers; admin cannot (read-only). Clinician/pathologist cannot create workers per can_write. **Needs clarification.**

**Research Lab access control (Step 6):**
5. **No positive-case filtering** - GET /samples and GET /research-results don't filter Research Lab to only positive cases. Research Lab can see all samples/results regardless of status.
6. **No field-level filtering for Research Lab** - Patient view for research_lab removes occupation/nativity but may still expose other fields. Need to ensure only "patient's name and approved demographic fields, plus the specifically approved diagnosis and prescription information" are exposed. Also need to verify no "other number" field exists/exposed.
7. **"Other number" field** - not found in codebase search, but requirement says "The field referred to as 'other number' remains undefined and must not be exposed to the Research Lab until its meaning and sharing policy are approved." Need to ensure we don't accidentally create/expose it.

**Prescriptions (Step 5, 8):**
8. **No structured prescription model** - ClinicalAssessment has only `treatment_documentation` (free text). Requirements say "Prescriptions should be structured according to the approved clinical requirements. Inspect the current prescription model before deciding which fields to add or change." Also need to track original vs revised prescriptions separately with history.
9. **No revision tracking** - Need to ensure revised prescriptions are distinct time-stamped records, not overwrites. Current model creates new assessment records each time, so history is preserved if done right - but need to verify.

**Follow-up (Step 9):**
10. **No endpoint for Health Worker to update follow-up records** - Can list follow-ups but cannot update adherence/symptoms/outcomes. Need to add capability.

**Referral/routing (Step 4):**
11. **Case workflow exists but need to verify** it properly routes positive cases to PHC clinician as specified.

### Minor/unclear items
- **DHS role** - Not present as separate role; Admin exists as read-only. Requirements say "Inspect the existing definitions and confirm what DHS means in this project. Do not assume that DHS and Admin are interchangeable."
- **Health Worker site assignment scope** - "Health Workers may select only sites assigned to their authorised account/facility scope" - need to verify how this is enforced.
- **Facilities management** - No POST/PUT/DELETE endpoints for facilities visible; only GET.
- **"Other number"** - appears only in audit docs as a concern, not found in actual schema/code.

## 9) Recommended Approach (Phase B)

**Minimal safe changes needed:**

### Must address (blocking workflow)
1. **Enable Research Lab to record molecular results** - Change POST /research-results to allow research_lab role with appropriate checks. Add permission `research_write` or adjust can_write. Enforce positive-case eligibility.
2. **Enable Health Worker to record follow-up data** - Add endpoint to update follow-ups (PATCH/PUT /follow-ups/{id}) allowing health_worker to update assigned follow-ups with allowed fields (adherence, symptoms, notes, outcome, status). Add permission check.
3. **Add Research Lab access restrictions** - Filter samples/research results for research_lab to only positive cases (positive RDT or positive microscopy). Add field filtering to exclude restricted data. Ensure "other number" not exposed (and add guard if field ever added).
4. **Clarify role mappings** - Document which roles can do onboarding/structure management. May need to allow admin or specific roles to create workers/sites/facilities based on "authorised staff" interpretation.

### Should address
5. **Structured prescriptions** - Add prescription model or structured fields to assessments. Track revisions separately.
6. **Strengthen referral/case routing** - Verify positive results create proper referrals to clinicians.
7. **Add follow-up update schema/validation**

### Investigate first
- Check if there might be other endpoints for molecular/follow-up updates
- Understand full Case workflow usage
- Check mobile app flows for each role

**Constraints:** Don't break existing tests, preserve backward compatibility, use migrations for schema changes, enforce on backend not just UI.

## 10) Questions for Stakeholders (from gaps)
1. Which role(s) are "Authorised ICMR/project staff" that create initial worker profiles? (admin is read-only currently)
2. What does "DHS" mean in this project? Is it different from Admin?
3. Who can manage programme structure (facilities, sites, assignments) on an ongoing basis?
4. What are the "approved clinical requirements" for structured prescriptions?
5. What fields exactly should Research Lab see for positive cases vs what must be hidden?
6. Can Health Worker update follow-ups directly, or only through clinician assignment?
7. Is the "other number" field used anywhere, or is it purely a future concern?
8. What are the approved closure rules for cases/episodes?
9. Should Research Lab be able to create molecular results, or only view them?
