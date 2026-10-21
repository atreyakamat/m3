# M3 Testing and Smoke Verification Report

Date of Verification: 2026-10-20  
Environment: Linux x86_64, Node v22.23.2, npm 10.9.8, Python 3.11.16 / 3.14.7  
Active Host LAN IP: Dynamic / Auto-detected (API Port: `8001`, Web Port: `5173`, Metro Port: `8081`)

---

## 1. Test Execution Matrix

| Test Suite / Step | Command Executed | Result | Details / Output |
|---|---|---|---|
| **Backend Unit & Regression Suite (SQLite)** | `cd services/api && env -u M3_TEST_DATABASE_URL -u DATABASE_URL .venv/bin/python -m pytest` | **PASS (53/53)** | `53 passed, 1 skipped (Postgres target) in 4.37s`. Zero failures. Tests auth matrix, 5-section questionnaire rules, RBAC 7 roles, screening lifecycle, workflows, migrations, and stale edit guards. |
| **Backend Integration Suite (PostgreSQL)** | `cd services/api && M3_TEST_DATABASE_URL="postgresql+psycopg://127.0.0.1:5432/m3_test_pg" .venv/bin/python -m pytest` | **PASS (54/54)** | `54 passed in 2.84s`. Full suite executed against PostgreSQL engine, including migration rehearsal and partial unique index validation. |
| **Synthetic Legacy Upgrade Migration Test** | `cd services/api && .venv/bin/python -m pytest tests/test_migrations.py -v` | **PASS (2/2)** | Tests legacy schema initialization (v20261019_01), pre-upgrade data hashing, Alembic upgrade head, record-level checksum equality, and additive column/table readiness. |
| **PostgreSQL Upgrade Rehearsal Script** | `bash scripts/pg_upgrade_rehearsal.sh` | **PASS** | Automated schema upgrade rehearsal with legacy synthetic data preservation, information_schema inspection, and ORM roundtrip verification. |
| **PostgreSQL Concurrency Integrity Check** | `M3_TEST_DATABASE_URL="..." python3 scripts/pg_concurrency_check.py` | **PASS** | Proves two-layer guarantee protecting offline reconciliation: exactly one worker session commits, second session rejected via partial unique index `uq_patients_client_request_id` with clean rollback. |
| **5-Section Questionnaire Schema Validation** | `cd services/api && .venv/bin/python -m pytest tests/test_questionnaire.py` | **PASS (14/14)** | Sections 1–5 schema validation, mutual symptom exclusions, travel episode date ordering, conditional clinical branches. |
| **RBAC & Read-Only Enforcement Matrix** | `cd services/api && .venv/bin/python -m pytest tests/test_auth_matrix.py tests/test_rbac.py` | **PASS (12/12)** | Health Worker, Research Lab, and Admin strictly return HTTP 403 on all mutation routes. Unauthenticated 401 verified. |
| **Decoupled Worker Registration & Screening** | `cd services/api && .venv/bin/python -m pytest tests/test_screening.py` | **PASS (9/9)** | Decoupled worker registration (without site requirement), derived age from DOB, mismatch flagged, draft save/restore, review & idempotent submit. |
| **Contractor & Clinical Workflows** | `cd services/api && .venv/bin/python -m pytest tests/test_workflows.py` | **PASS (11/11)** | Contractor site-scoping, opaque QR tokens, reported status recording, pathology slide follow-ups with reasons & stale detection, clinician admission flow, and session isolation. |
| **Web Console Lint / Typecheck** | `cd apps/web && npm run lint` (`tsc --noEmit`) | **PASS** | `0 errors` on TypeScript 5.8 |
| **Web Console Production Build** | `cd apps/web && npm run build` (`tsc -b && vite build`) | **PASS** | Built in 174ms: `dist/index.html` (0.16 kB), `dist/assets/index-CDvgSVBR.css` (16.96 kB), `dist/assets/index-RVIep3dt.js` (245.18 kB). Includes Admin Audit Log viewer tab. |
| **Mobile TypeScript Compilation** | `cd apps/mobile && npm run typecheck` (`tsc --noEmit`) | **PASS** | `0 errors` across all screening steps, forms, outbox synchronization, and UI components |
| **Mobile Headless ESLint** | `cd apps/mobile && npm run lint` (`eslint --config eslint.config.mjs .`) | **PASS** | `0 errors` completed non-interactively in CI/headless environments |
| **Full LAN API E2E Flow (All 7 Roles)** | `python3 scripts/verify_e2e_lan.py` | **PASS** | All 7 roles authenticated with PIN 2468, read-only gates enforced (403), intake -> screening -> admission assessment -> follow-up assignment -> pathology -> slide reason -> contractor status -> offline replay -> audit trail verified. |
| **Offline Caching & Outbox Synchronization** | `python3 scripts/verify_offline_cache.py` | **PASS** | SQLite cache tables created, sync metadata stored, offline worker browsing verified, tenant isolation confirmed, draft retention across logout verified, and `worker_register` outbox queue lifecycle verified. |
| **Database Backup & Restore Checksums** | `./scripts/backup-db.sh && ./scripts/restore-db.sh` | **PASS** | SHA256 archive checksum verification and record-level table counts manifest validation on restore. |

---

## 2. PRD Alignment and Architectural Improvements

1. **Seven PRD Roles & Strict Read-Only Enforcement**:
   - Reconciled role vocabulary across `schemas.py`, `models.py`, `permissions.py`, and `main.py` to support all seven PRD roles: `worker`, `contractor`, `clinician`, `pathologist` (legacy `pathology` aliased), `health_worker`, `research_lab`, and `admin`.
   - Enforced strict read-only access for `health_worker`, `research_lab`, and `admin`. All mutation routes return HTTP 403 Forbidden with detailed audit logging.

2. **Decoupled Worker Registration & Derived Age**:
   - Worker registration no longer requires mandatory `site_id`.
   - Worker age is derived directly from DOB (`dob`). If user inputs an age that contradicts DOB, the record is flagged (`age_flagged = True`) rather than rejecting the field worker.
   - Accepts loose phone format without enforcing rigid international masks on mobile field entries.

3. **5-Section Labour-Worker Screening Questionnaire**:
   - Implemented full schema in `app/questionnaire.py` with versioning (`SCHEMA_VERSION = 1`).
   - Section 1: Demographics & Identity (Personal details, ID type with Other details, present/permanent address).
   - Section 2: Malaria History (Prior diagnosis, 2-year episodes, last detection, treatment facility, diagnostic method, full course completion).
   - Section 3: Clinical Presentation & Danger Signs (Fever today, measured temperature, fever duration, symptom onset date, danger signs, testing attendance). Enforces mutual exclusion between "No other symptoms" and specific symptoms.
   - Section 4: Mobility & Migration (Time in Goa, 3-month interstate travel, states visited, stay duration, prior fever).
   - Section 5: Planned Travel (Travel episodes, departure and return dates with `return_date >= departure_date`, fever history during travel, treatment course completion).

4. **Offline Draft Retention Safeguard**:
   - In-progress field screening questionnaires are stored locally in SQLite (`local_drafts` table scoped by `owner_id`).
   - Drafts are **never silently discarded** on sign-out, session expiration, or network loss.
   - Tenant isolation ensures other accounts logging into the same shared handheld device cannot see another worker's draft.
   - Explicit submission clears the local draft upon HTTP 201 Created or HTTP 200 (idempotent duplicate).

5. **Contractor Site Scoping & Reported Status**:
   - Contractor accounts only access workers and operational metrics for their assigned sites.
   - Contractors can enroll workers by Worker ID or opaque QR token (`POST /api/v1/workers/{patient_id}/membership`).
   - Contractors can record operational reported status (`PUT /api/v1/workers/{patient_id}/reported-status`).

6. **Clinician Admission & Pathology Follow-Up Slides**:
   - Clinician assessment includes inpatient admission flow with mandatory severity classification (`mild` / `severe`), discharge date, and treatment completion status with incomplete reasons.
   - Clinicians assign follow-up visits directly to designated Health Worker accounts.
   - Pathologists record scheduled slide examinations (Day 1, 3, 7, 14, 28) and capture standardized not-received reasons (`patient_unavailable`, `left_goa_migrated`, `refused`, `slide_broken_spoiled`, `not_collected_by_worker`, `other`).

7. **Monochromatic Mobile UI**:
   - Rebuilt `apps/mobile/app/intake.tsx` as a complete 5-section paginated questionnaire with step indicators (Steps 1–5 + Step 6 Review & Final Submit).
   - Styled with clean monochromatic typography (charcoal `#18181b`, subtle neutral borders `#e4e4e7`, white/off-white background `#f4f4f5`, restrained blue accents for primary actions).
   - Added `MultiChipPicker` in `components/ui.tsx` for accessible, single-tap multiple symptom selection with clear mutual exclusion logic.

---

## 3. How to Run the Test Suites

### A. Run Backend Pytest Suite
```sh
cd services/api
PYTHONPATH=. .venv/bin/pytest tests/ -v
```

### B. Run Automated LAN End-to-End Test Suite
```sh
python3 scripts/verify_e2e_lan.py
```

### C. Run Offline Cache & Draft Retention Test
```sh
python3 scripts/verify_offline_cache.py
```

### D. Run Mobile TypeScript Check
```sh
cd apps/mobile
npm run typecheck
```

### E. Run Web Console Lint & Build
```sh
cd apps/web
npm run lint
npm run build
```

### F. Live clinical-privacy and notification-routing check (all seven roles)
Writes synthetic accounts/sites/cases: run it against a disposable database (e.g. a throwaway API on another port), not pilot data.
```sh
M3_E2E_BASE_URL=http://127.0.0.1:8011/api/v1 M3_BOOTSTRAP_SECRET=<that API's bootstrap secret> python3 scripts/verify_privacy_live.py
```

### G. Worker identity and orphaned-profile reconciliation
An account owns exactly one worker profile (`users.patient_id`, unique). `POST /workers` from an account that already has a profile returns the existing profile (`200`, `already_registered: true`) and is audited as `worker.reregistration_blocked`; it never creates a second profile. Regression tests: `services/api/tests/test_worker_identity.py`.

Records orphaned by the earlier defect are listed (read-only) and relinked only by explicit, audited operator action. Nothing is merged or deleted:
```sh
DATABASE_URL=sqlite:///$PWD/services/api/m3-dev.db python3 scripts/reconcile_worker_identity.py            # report
DATABASE_URL=... python3 scripts/reconcile_worker_identity.py --user <user_id> --patient <patient_id> --reason "why"           # dry-run
DATABASE_URL=... python3 scripts/reconcile_worker_identity.py --user <user_id> --patient <patient_id> --reason "why" --apply   # audited relink
```
Back up the database first. Relinking away from a profile that holds records requires `--acknowledge-current-profile-orphaned`; reverse by relinking to the previous id recorded in the `worker.identity_reconciled` audit event.
