# M3 Platform — Onboarding & Cross-Role Simulation Baseline Report

## 1. Executive Summary

This baseline report records the state of the M3 Malaria Surveillance Platform codebase, databases, migration history, active modules, and existing automated test suites prior to the full cross-role onboarding simulation and Samsung Galaxy Tab A7 Lite verification.

All platform components (NestJS backend API, PostgreSQL databases, React/Vite Admin portal, and Expo React Native mobile client) were inspected. A connected physical Samsung Galaxy Tab A7 Lite (Model SM-T225, Android 14) was verified over USB ADB.

---

## 2. Git & Working Tree Inspection

- **Current Branch**: `main`
- **Active Changes**:
  - `apps/mobile`: Visual guidance system (`react-native-svg` 15.8.0), 18 vector SVG illustrations, 10-screen guided tour, 3-step action cards, audio guide controller, contractor dependant count display.
  - `apps/api`: Contractor dependants headcount aggregation, facilities management, staff assignments, workforce transfer workflows.
  - `packages/shared`: Facility schemas, health-worker schemas, assisted-screening schemas, household relationship schemas.
  - `apps/web`: Admin facility management pages, profile corrections review, health worker web modules.
- **Git Status Integrity**: All untracked changes relate to current feature implementations and valid migrations. No merge conflicts or corrupted working tree states exist.

---

## 3. Database Schema and Migration Status

The Prisma schema is synchronized across both `m3` (development) and `m3_test` (e2e testing) databases running on PostgreSQL (port 5544).

### 3.1 Migration History

| Migration Identifier | Description | Applied Status |
| :--- | :--- | :--- |
| `20261030074038_init` | Initial surveillance schema (Users, Workers, Screening, Diagnostic Results) | Applied |
| `20261030075000_partial_unique_indexes` | Partial unique indexes for active worker assignments and transfers | Applied |
| `20261031092014_add_travel_records_and_voice` | Travel records and voice note storage | Applied |
| `20261102090000_admin_module` | Admin module, Goa geographical hierarchy (`LocationNode`), audit logs | Applied |
| `20261102120000_site_landmark_and_contact` | Construction site landmarks, contact phone numbers | Applied |
| `20261103060000_workforce_management_and_qr_pass` | QR worker pass tokens, multi-contractor site assignments | Applied |
| `20261105100000_facilities_and_worker_updates` | PHC/UHC Facilities, staff assignments, household members, assisted screening | Applied |

### 3.2 Current Database Record Baseline (`m3`)

- **Users**: 19 total accounts (1 Admin, 2 Contractors, 1 Health Worker, 2 Clinicians, 2 Pathologists, 1 Research Lab, 10 Workers).
- **Facilities**: 2 registered facilities:
  - `PHC-001`: Candolim Primary Health Centre (North Goa, Bardez).
  - `UHC-001`: Panaji Urban Health Centre (North Goa, Tiswadi).
- **Construction Sites**: 1 existing test site (`SITE-TEST01`, Candolim).
- **Workers**: 9 existing test worker profiles.
- **Screenings**: 6 initial screening records.
- **Diagnostic Results**: 4 laboratory results.
- **Household Members**: 0 existing records (clean slate for simulation).
- **Travel Records**: 1 existing test travel record.
- **Notifications**: 1 facility/system notification.

---

## 4. Workflows and Architecture Inspection

### 4.1 Admin Portal
- **Location**: [`apps/web`](file:///home/nimr/Projects/m3/apps/web)
- **Role Permissions**: Restricted to `ADMIN`. Blocks Workers and Contractors.
- **Capabilities**: Site creation using Goa 4-level hierarchy (State -> District -> Taluka -> Village/Area), Contractor creation, Health Worker creation, Facility management (PHC/UHC), Staff assignment, and Worker profile review.

### 4.2 Worker Mobile Application
- **Location**: [`apps/mobile`](file:///home/nimr/Projects/m3/apps/mobile)
- **Capabilities**: 18 Indic languages, visual guided tour, phone-based registration, informed consent, initial screening questionnaire, QR Worker Pass generation, household member registration, travel reporting, and unwell symptom reporting.
- **Visual Guidance**: 18 vector SVG illustrations, 3-step action mental model (`WorkerGuideCard`), $\ge 48\,\text{dp}$ touch targets, and spoken TTS.

### 4.3 Contractor Module
- **Location**: [`apps/mobile/app/(contractor)`](file:///home/nimr/Projects/m3/apps/mobile/app/(contractor)) and [`apps/api/src/contractor`](file:///home/nimr/Projects/m3/apps/api/src/contractor)
- **Capabilities**: Phone + PIN authentication, first-login PIN change, active construction site switcher, worker roster search, QR pass scanner, duplicate phone check, transfer initiation and approval, 7-day malaria travel alerts with mandatory review comments.
- **Data Privacy**: Species, prescriptions, symptoms, clinical notes, Aadhaar, and dependant clinical data are stripped from responses.

### 4.4 Health Worker Module
- **Location**: Mobile [`apps/mobile/app/(health-worker)`](file:///home/nimr/Projects/m3/apps/mobile/app/(health-worker)) and Web [`apps/web/src/pages/health-worker`](file:///home/nimr/Projects/m3/apps/web/src/pages/health-worker)
- **Capabilities**: Facility-linked operations, worker lookup, initial and assisted screening, suspected malaria episode registration, diagnostic test requests (RDT/Microscopy), travel arrival monitoring, and facility inbox notifications.
- **Clinical Limits**: Health Workers can request diagnostic tests but cannot confirm diagnostic results without Pathologist or Clinician authority.

---

## 5. Physical Device Baseline

- **Device**: Samsung Galaxy Tab A7 Lite
- **Model**: SM-T225 (gta7litexx)
- **Android Version**: 14
- **Connection**: USB ADB (`transport_id: 1`)
- **Port Forwarding**: `adb reverse tcp:8003 tcp:8003` active.
- **Installed Package**: `org.m3.surveillance` (Version 2.0.0, release build from Nov 3, requires update for latest Nov 5 visual guidance features).

---

## 6. Baseline Test Status

| Test Suite | Package | Suites | Tests | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Shared Schemas & Logic** | `@m3/shared` | 6 | 43 | **PASS (100%)** |
| **Mobile Tests** | `@m3/mobile` | 11 | 84 | **PASS (100%)** |
| **Backend E2E (Contractor & Transfers)** | `@m3/api` | 2 | 12 | **PASS (100%)** |
| **Web Portal Tests** | `@m3/web` | 6 | 23 | **PASS (100%)** |
| **Total Baseline Tests** | | **25** | **162** | **100% PASS** |

---

## 7. Identified Incomplete Workflows and Simulation Action Plan

1. **Synthetic Simulation Dataset**:
   - Need dedicated simulation construction site `SITE-SIM01`.
   - Need 2 dedicated simulation Contractors assigned to `SITE-SIM01`.
   - Need 1 dedicated simulation Health Worker assigned to `PHC-001`.
   - Need 4 dedicated simulation Workers:
     - `M3-SIM01` (POSITIVE, 2 dependants).
     - `M3-SIM02` (NEGATIVE, 1 dependant).
     - `M3-SIM03` (PENDING / AWAITING RESULT, 0 dependants).
     - `M3-SIM04` (Unscreened / No Result, upcoming travel).
2. **APK Rebuild**:
   - Rebuild Android release APK containing the latest visual guidance components and update on tablet.
3. **Cross-Role Interaction Validation**:
   - Execute all cross-role workflows: Worker-Contractor, Worker-Health Worker, Household Dependant updates, Travel surveillance, and Offline sync.
4. **Physical Tablet Evidence**:
   - Capture live screenshots of physical tablet execution across each role.
