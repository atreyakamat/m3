# M3 Platform — Phase C Implementation Report

**Date:** 2026-10-24  
**Repo:** /home/nimr/Projects/m3 (git repo)  
**Commit:** 8ee4e9e  
**Constraints honored:** No resets/deletes, no destructive migrations, no shared DB changes, questionnaire unchanged, no invented clinical rules/prescription defaults, no broad role expansion.

## 1) Actual repository state and changed files
**Prior state:** Clean working tree except untracked audit/report files. Phase B/B.1 changes present (permissions/follow-up updates/research restrictions/prescription groundwork).
**Phase C changes (files modified):**
- `services/api/app/main.py` — role-aware dashboard counts (health_worker, research_lab, admin), Research Lab/health worker notification recipients, notify Research Lab on positive RDT/microscopy.
- `apps/mobile/android/app/src/main/python-backend/app/main.py` — synced from API.

**Unchanged:** models/schemas/migrations (no schema changes needed), frontend mostly unchanged in this pass (dashboard/cards/notifications UI already present; backend supports enhanced counts/notifications).

## 2) Existing architecture reused
Expo/React Native, Vite/React, FastAPI, SQLAlchemy, Alembic, PostgreSQL, auth/JWT/sessions/RBAC/audit, notifications model/endpoints, case workflow, offline/standalone paths. Embedded Android backend synced.

## 3) Dashboard cards and exact count definitions
**API `/api/v1/dashboard` (role-aware):**
- `worker` only: `scope:"own"`, `workers:1|0`, `followups_due` for own patient. Personal view.
- `contractor`: `scope:"managed_sites"`, `workers` = distinct assigned workers on managed sites, `sites` = managed site count. Roster-only.
- `health_worker` (no clinician/admin/pathologist): `scope:"health_worker_assigned"`, `workers` = assigned follow-up patients, `followups_due/overdue` for assigned follow-ups.
- `research_lab` (no clinician/admin/pathologist): `scope:"research_eligible"`, `eligible_research_cases` = distinct patients with eligible positive samples, `eligible_samples` = count, `unread_notifications`. Restricted to positive RDT/microscopy.
- `admin` only: `scope:"admin_readonly"`, operational totals + `unread_notifications`. Read-only.
- Others (clinician/pathologist): `scope:"authorized_operational"`, workers/samples_pending/tests_positive/followups_due/followups_overdue + `unread_notifications`.

**Card behavior (existing UI):** Mobile dashboard shows metrics row (workers/pathology/followups) and role-specific action cards; web OverviewScreen uses role-tailored metrics. Cards are navigation controls in existing UI; counts now reflect authorized scopes.

## 4) Role-based access matrix
- Health Worker: assigned workers/follow-ups only; can update assigned follow-ups via PATCH/PUT; cannot create/assign follow-ups.
- Clinician: clinical scope as before; can create follow-ups/assign.
- Research Lab: only eligible positive RDT/microscopy cases/samples/results; field-restricted views; cannot change screening/results/prescriptions.
- Pathologist: lab workflow unchanged.
- Contractor: managed sites roster only, no clinical details.
- Admin: read-only, operational counts.
- Worker: own records only.
- DHS: **not present as distinct role** in codebase; no global access granted. Notification support prepared but inactive until verified DHS mapping exists (documented).

## 5) Worker-detail links and authorization rules
Existing worker_detail enforces patient scope via `require_patient_scope`. Research Lab gets restricted view + `research` block with limited assessments/cases. Other roles see permitted fields/sections. Links use stable IDs; inaccessible targets return safe errors.

## 6) Notification events, recipients, deduplication and target behavior
**Existing:** `/api/v1/notifications` list (recipient-scoped, unread filter, pagination), `/api/v1/notifications/read` marks own notifications read. `_notify_case_agents` creates per-recipient notifications transactionally.
**Added:** Research Lab notified on positive RDT/microscopy (`research_eligible`, body_minimal). Health Worker recipients helper added. Recipients are role-based and scoped (no broadcast to all). Deduplication not enforced globally but notifications created per event/recipient; marking read doesn't change clinical status. Navigation via notification IDs requires ownership check.

## 7) Screening-result ownership protections
Screening results recorded via questionnaire/diagnostic paths only; dashboard has no positive/negative toggles; Research Lab cannot change results; molecular results don't auto-change RDT/microscopy; backend enforces permissions.

## 8) API/schema/migration changes
**API:** Dashboard enhanced with role-aware scopes; Research Lab notifications added. No new endpoints added. **Schema/Migrations:** None. **Embedded backend:** Synced.

## 9) Tests run, commands, and actual outcomes
**Environment:** Dependencies not installed; pytest unavailable. Tests not executed. Commands attempted: `pytest` in services/api failed due to missing modules. **Status:** BLOCKED - tests not run.

## 10) Known limitations and unresolved stakeholder decisions
- DHS role/mapping not verified; notifications inactive until confirmed.
- Prescription CRUD/UI not implemented (groundwork only).
- Some dashboard cards may need UI wiring for new scopes.
- Tests must be run in supported environment.

## 11) Security findings and remediation
- Research Lab scope enforced server-side.
- Health Worker follow-up updates scoped to assigned records only.
- Notifications recipient-scoped; read doesn't alter clinical data.
- No unauthorized data exposure found in review.

## 12) Go/no-go recommendation
**GO with conditions:** Backend changes are safe and additive. **BLOCKER:** Tests not executed due to environment issues - must run in CI/Docker before merge/deployment. UI uses existing components; no breaking changes. Prescription/clinical rules not invented.
