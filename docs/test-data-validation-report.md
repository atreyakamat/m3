# M3 Malaria Surveillance Platform — Test Data Validation Report

## 1. Environment and Safety Confirmation

- **Operating Environment**: Local development and integration testing environment.
- **Backend API**: `http://localhost:8003/api/v1` (NestJS 10, Container: `m3-api-1`).
- **Web Application**: `http://localhost:5173` (React 18 + Vite, Container: `m3-web-1`).
- **Database**: PostgreSQL 16.5 Alpine (`m3-db-1` on port `5544`, database `m3`).
- **Physical Test Device**: Samsung Galaxy Tab A7 Lite (SM-T225, Android 14, Target SDK 34, APK: `org.m3.surveillance` v2.0.0).
- **Safety Protocol**:
  - Test identification marker: `M3-TEST-2026`.
  - Worker name prefix: `TEST-M3`.
  - Synthetic identities and records only. No real patient data used.
  - Zero modification or deletion of existing records (`Asha Demo`, `Atreya`, `Ramesh Test`).
  - Database unique constraints and relational integrity maintained throughout.

---

## 2. Injected Test Worker Accounts

Ten synthetic worker accounts were created with unique 10-digit mobile numbers and PIN `1234`.

### Group A — Negative Malaria Results (5 Workers)

| Worker Name | Worker ID (Test ID) | Phone Number | Construction Site | Result | Diagnostic Method | Species | Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-M3-NEG-01** | `M3-TEST-NEG-01` | `9800000001` | Candolim Tower Project (`SITE-CNDLM1`) | **NEGATIVE** | RDT | None | Asymptomatic, no travel |
| **TEST-M3-NEG-02** | `M3-TEST-NEG-02` | `9800000002` | Panaji Riverfront (`SITE-PANJI1`) | **NEGATIVE** | Microscopy | None | Past history of malaria |
| **TEST-M3-NEG-03** | `M3-TEST-NEG-03` | `9800000003` | Margao Metro Depot (`SITE-MARGO1`) | **NEGATIVE** | RDT | None | Recent travel outside Goa |
| **TEST-M3-NEG-04** | `M3-TEST-NEG-04` | `9800000004` | Vasco Port Expansion (`SITE-VASCO1`) | **NEGATIVE** | Microscopy | None | Current fever reported (38.3°C) |
| **TEST-M3-NEG-05** | `M3-TEST-NEG-05` | `9800000005` | Curchorem Bridge Works (`SITE-CURCH1`) | **NEGATIVE** | RDT | None | Planned travel outside Goa |

### Group B — Positive Malaria Results (5 Workers)

| Worker Name | Worker ID (Test ID) | Phone Number | Construction Site | Result | Diagnostic Method | Species | Scenario / Medication |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-M3-POS-01** | `M3-TEST-POS-01` | `9800000011` | Candolim Tower Project (`SITE-CNDLM1`) | **POSITIVE** | RDT | *P. falciparum* | Current fever (38.9°C); Artemether + Lumefantrine Rx; Pending follow-up |
| **TEST-M3-POS-02** | `M3-TEST-POS-02` | `9800000012` | Panaji Riverfront (`SITE-PANJI1`) | **POSITIVE** | Microscopy | *P. vivax* | Asymptomatic infection; No prescription (empty state); Answered follow-up |
| **TEST-M3-POS-03** | `M3-TEST-POS-03` | `9800000013` | Margao Metro Depot (`SITE-MARGO1`) | **POSITIVE** | RDT | *Mixed* (*P.f.* + *P.v.*) | High fever (39.2°C); ACT + Primaquine Rx |
| **TEST-M3-POS-04** | `M3-TEST-POS-04` | `9800000014` | Vasco Port Expansion (`SITE-VASCO1`) | **POSITIVE** | Microscopy | *P. vivax* | Fever and travel to West Bengal; Chloroquine + Primaquine Rx |
| **TEST-M3-POS-05** | `M3-TEST-POS-05` | `9800000015` | Curchorem Bridge Works (`SITE-CURCH1`) | **POSITIVE** | RDT | *P. falciparum* | Previous malaria history; ACT standard 6-dose Rx |

---

## 3. Data Injection Architecture and Process

Data injection used the official API endpoints with authentication guards:
1. **Worker Registration**: [`POST /api/v1/auth/worker/register`](file:///home/nimr/Projects/m3/apps/api/src/auth/auth.controller.ts#L17) creates worker, user credentials, and hashes PIN.
2. **Identifier Assignment**: Stable human-facing `workerCode` set to required test IDs (`M3-TEST-NEG-01`..`05`, `M3-TEST-POS-01`..`05`).
3. **Site Selection**: [`POST /api/v1/workers/me/site`](file:///home/nimr/Projects/m3/apps/api/src/workers/workers.controller.ts#L24) assigns initial construction site and records site audit entry.
4. **Baseline Screening**: [`POST /api/v1/screening/me/complete`](file:///home/nimr/Projects/m3/apps/api/src/screening/screening.controller.ts) completes Sections I–V with validated answers and consent flag.
5. **Clinical Episode**: Clinician logs in via [`POST /api/v1/auth/staff/login`](file:///home/nimr/Projects/m3/apps/api/src/auth/auth.controller.ts#L29) and opens a malaria episode via [`POST /api/v1/records/episodes`](file:///home/nimr/Projects/m3/apps/api/src/records/records.controller.ts#L81).
6. **Authorized Diagnostic**: Clinician records official test result via [`POST /api/v1/records/diagnostics`](file:///home/nimr/Projects/m3/apps/api/src/records/records.controller.ts#L88).
7. **Prescription**: Where clinically required, clinician issues prescription via [`POST /api/v1/records/prescriptions`](file:///home/nimr/Projects/m3/apps/api/src/records/records.controller.ts#L95).
8. **Follow-Up and Symptoms**: Follow-up check-ins and symptom reports linked directly to the worker.

---

## 4. Database Verification Results

Database query executed directly on container `m3-db-1`:

```sql
SELECT 
  w."workerCode",
  w.name,
  w.phone,
  s.status as "screeningStatus",
  e.status as "episodeStatus",
  d."testType",
  d.result,
  d.species
FROM "Worker" w
LEFT JOIN "InitialScreening" s ON s."workerId" = w.id
LEFT JOIN "MalariaEpisode" e ON e."workerId" = w.id
LEFT JOIN "DiagnosticResult" d ON d."episodeId" = e.id
WHERE w."workerCode" LIKE 'M3-TEST-%'
ORDER BY w."workerCode";
```

### Query Output:
```
   workerCode   |      name      |   phone    | screeningStatus | episodeStatus |  testType  |  result  |   species    
----------------+----------------+------------+-----------------+---------------+------------+----------+--------------
 M3-TEST-NEG-01 | TEST-M3-NEG-01 | 9800000001 | COMPLETE        | SUSPECTED     | RDT        | NEGATIVE | 
 M3-TEST-NEG-02 | TEST-M3-NEG-02 | 9800000002 | COMPLETE        | SUSPECTED     | MICROSCOPY | NEGATIVE | 
 M3-TEST-NEG-03 | TEST-M3-NEG-03 | 9800000003 | COMPLETE        | SUSPECTED     | RDT        | NEGATIVE | 
 M3-TEST-NEG-04 | TEST-M3-NEG-04 | 9800000004 | COMPLETE        | SUSPECTED     | MICROSCOPY | NEGATIVE | 
 M3-TEST-NEG-05 | TEST-M3-NEG-05 | 9800000005 | COMPLETE        | SUSPECTED     | RDT        | NEGATIVE | 
 M3-TEST-POS-01 | TEST-M3-POS-01 | 9800000011 | COMPLETE        | CONFIRMED     | RDT        | POSITIVE | P_FALCIPARUM
 M3-TEST-POS-02 | TEST-M3-POS-02 | 9800000012 | COMPLETE        | CONFIRMED     | MICROSCOPY | POSITIVE | P_VIVAX
 M3-TEST-POS-03 | TEST-M3-POS-03 | 9800000013 | COMPLETE        | CONFIRMED     | RDT        | POSITIVE | MIXED
 M3-TEST-POS-04 | TEST-M3-POS-04 | 9800000014 | COMPLETE        | CONFIRMED     | MICROSCOPY | POSITIVE | P_VIVAX
 M3-TEST-POS-05 | TEST-M3-POS-05 | 9800000015 | COMPLETE        | CONFIRMED     | RDT        | POSITIVE | P_FALCIPARUM
```

### Relational Integrity Findings:
1. **Count**: Exactly 10 test workers.
2. **Negative Group**: Exactly 5 negative diagnostic records.
3. **Positive Group**: Exactly 5 positive diagnostic records with valid species (`P_FALCIPARUM`, `P_VIVAX`, `MIXED`).
4. **Episode Transitions**: Positive records automatically transition `MalariaEpisode.status` from `SUSPECTED` to `CONFIRMED`. Negative records retain `SUSPECTED` (unconfirmed episode).
5. **Screenings**: All 10 workers have `InitialScreening.status = 'COMPLETE'`.
6. **Prescriptions**: Append-only records exist for `POS-01`, `POS-03`, `POS-04`, `POS-05`. `POS-02` has zero prescriptions (clean empty state).
7. **Symptom Independence**: `NEG-04` reported fever and headache; diagnostic result remained strictly `NEGATIVE`.

---

## 5. Physical Device Validation (Samsung Galaxy Tab A7 Lite)

Physical Android device testing verified the complete Worker interface for all malaria states:

### 5.1 Negative Worker Display (`TEST-M3-NEG-01`)
- **Dashboard**: Displays `Hello, TEST-M3-NEG-01`, `Worker ID: M3-TEST-NEG-01`, `Candolim Tower Project`.
- **Status Chip**: Displays green chip with bold label: `Negative` (`fg: #1F7A45`, `bg: #E3F5EA`).
- **Malaria Detail Screen**: Displays test type `RDT`, result `NEGATIVE`, and test date `25/10/2026`.
- **Prescription Screen**: Displays empty state: `"No prescription recorded"`.
- **Evidence Screenshot**: [`screenshots/device_negative.png`](file:///home/nimr/Projects/m3/screenshots/device_negative.png), [`screenshots/device_negative_detail.png`](file:///home/nimr/Projects/m3/screenshots/device_negative_detail.png).

### 5.2 Positive Worker Display (`TEST-M3-POS-01`)
- **Dashboard**: Displays `Hello, TEST-M3-POS-01`, `Worker ID: M3-TEST-POS-01`, `Candolim Tower Project`.
- **Status Chip**: Displays red chip with bold label: `Positive` (`fg: #A62828`, `bg: #FBE4E4`).
- **Malaria Detail Screen**: Displays test type `RDT`, result `POSITIVE`, species `P. FALCIPARUM`, date `29/10/2026`.
- **Prescriptions Screen**: Displays current active prescription:
  *"Artemether 20mg + Lumefantrine 120mg: 4 tablets twice daily for 3 days. M3-TEST-2026 synthetic record."*
- **Follow-Up Screen**: Displays interactive question with selectable chips: `Much better`, `About the same`, `Worse`.
- **Evidence Screenshot**: [`screenshots/device_positive.png`](file:///home/nimr/Projects/m3/screenshots/device_positive.png), [`screenshots/device_positive_detail.png`](file:///home/nimr/Projects/m3/screenshots/device_positive_detail.png), [`screenshots/device_positive_rx.png`](file:///home/nimr/Projects/m3/screenshots/device_positive_rx.png), [`screenshots/device_followup.png`](file:///home/nimr/Projects/m3/screenshots/device_followup.png).

### 5.3 Worker with Pending Sample (`Ramesh Test` — `M3-TH8NMU`)
- **Scenario**: Episode opened (`SUSPECTED`), diagnostic sample pending.
- **Dashboard**: Displays amber chip with label: `Awaiting result` (`fg: #A5741A`, `bg: #FCF2DD`).
- **Evidence Screenshot**: [`screenshots/device_awaiting.png`](file:///home/nimr/Projects/m3/screenshots/device_awaiting.png).

### 5.4 Worker with No Diagnostic Result (`Asha Demo` — `M3-DEMO01`)
- **Scenario**: Initial screening complete, zero episodes or diagnostic tests recorded.
- **Dashboard**: Displays neutral gray chip with label: `No result recorded` (`fg: #475569`, `bg: #E8EBEF`).
- **Critical Requirement Confirmed**: The application **never** defaults to "Negative" when results are absent.
- **Evidence Screenshot**: [`screenshots/device_no_result.png`](file:///home/nimr/Projects/m3/screenshots/device_no_result.png).

---

## 6. Web Portal and Contractor Workspace Verification

### 6.1 Contractor Workspace Verification (`contractor.north`)
- **Login**: Signed in with username `contractor.north`.
- **Active Sites View**: Candolim Tower Project shows 3 active workers; Panaji Riverfront shows 2 active workers.
- **Worker Lookup by Worker ID**: Looked up `M3-TEST-POS-01`.
  - **Returned Fields**:
    ```json
    {
      "workerId": "M3-TEST-POS-01",
      "name": "TEST-M3-POS-01",
      "currentSite": {
        "siteId": "SITE-CNDLM1",
        "name": "Candolim Tower Project"
      }
    }
    ```
  - **Confidentiality Check**: Contractors have **no access** to malaria diagnostic results, species, symptoms, or prescriptions. Access control verified.

### 6.2 Clinician and Pathologist Role Assessment
- **API Functionality**: The backend provides fully functional authorized endpoints for clinical writes:
  - `POST /api/v1/records/episodes`
  - `POST /api/v1/records/diagnostics`
  - `POST /api/v1/records/prescriptions`
- **Web UI Status**: The React web application routes `/portal` to [`Placeholder.tsx`](file:///home/nimr/Projects/m3/apps/web/src/pages/Placeholder.tsx).
  - Displays notice: *"The Clinician/Pathologist workflow is not part of this release. This is a placeholder dashboard. No clinical or operational data is shown here."*
  - **Reported Limitation**: Role-specific web dashboards for Clinicians and Pathologists are not yet implemented in the web portal.

---

## 7. User Interface Comparison (Positive vs Negative)

| UI Element | Negative Worker (`TEST-M3-NEG-01`) | Positive Worker (`TEST-M3-POS-01`) |
| :--- | :--- | :--- |
| **Status Label** | `Negative` | `Positive` |
| **Status Foreground** | `#1F7A45` (Forest Green) | `#A62828` (Crimson Red) |
| **Status Background** | `#E3F5EA` (Mint Green Tint) | `#FBE4E4` (Rose Tint) |
| **Dual Coding** | Distinct text label + color | Distinct text label + color |
| **Species Display** | Omitted | Formatted (e.g., `P. FALCIPARUM`, `P. VIVAX`, `MIXED`) |
| **Prescription Section**| Clean empty state ("No prescription recorded") | Active prescription cards + issue dates |
| **Follow-Up Section** | Omitted / Clean dash | Interactive questionnaire (Much better / Same / Worse) |
| **Symptom Influence** | Symptom reports do NOT change status | Symptom reports do NOT change status |

---

## 8. Acceptance Criteria Evaluation

| # | Requirement | Expected Result | Actual Result | Status |
| :- | :--- | :--- | :--- | :--- |
| **1** | Test Workers | Exactly 10 created | Exactly 10 created with prefix `TEST-M3` and ID `M3-TEST-*` | **PASS** |
| **2** | Negative Results | Exactly 5 negative | Exactly 5 negative records (RDT & Microscopy) | **PASS** |
| **3** | Positive Results | Exactly 5 positive | Exactly 5 positive records (*P.f.*, *P.v.*, *Mixed*) | **PASS** |
| **4** | Worker Profiles | All correctly linked | Linked to site, screening, user, and phone | **PASS** |
| **5** | Screening Records | All correctly linked | Complete Sections I–V for all 10 workers | **PASS** |
| **6** | Diagnostic Records | Correct result & species | Stored against episodes with correct species | **PASS** |
| **7** | Dashboard Display | Correct status label & color | Dual-coded status chips display correctly | **PASS** |
| **8** | Missing Results | Not displayed as negative | Displays `No result recorded` | **PASS** |
| **9** | Prescriptions | Empty or populated state | Verified empty state and populated cards | **PASS** |
| **10**| Follow-Up | Pending or completed state | Interactive responses verified | **PASS** |
| **11**| Contractor View | Appropriate access | Clinical data strictly hidden; transfer lookup works | **PASS** |
| **12**| Mobile View | Correct display on device | Verified on Samsung Galaxy Tab A7 Lite | **PASS** |
| **13**| Web View | Correct display | Verified component rendering and API contracts | **PASS** |
| **14**| Database Integrity | No duplicates or corruption | Verified via psql; zero unintended modifications | **PASS** |

---

## 9. Bugs and Missing Functionality

1. **Web Clinician/Pathologist Portal UI**:
   - *Observation*: While the backend API has full clinical endpoints, the web frontend shows a placeholder banner for Clinician and Pathologist roles.
   - *Recommendation*: Implement dedicated clinical entry views in `@m3/web` in the next development cycle.
2. **Episode Association on Repeated Negative Tests**:
   - *Observation*: When a worker tests negative, the episode status remains `SUSPECTED` unless manually closed.
   - *Recommendation*: Consider adding a status `DISMISSED` or `RESOLVED_NEGATIVE` for resolved negative clinical episodes.

---

## 10. Overall Result

**OVERALL RESULT: PASS**

The M3 Malaria Surveillance Platform handles positive, negative, pending, and unrecorded malaria results across the worker journey without data leakage or clinical distortion. All test records are tagged `M3-TEST-2026` and separated from existing records.
