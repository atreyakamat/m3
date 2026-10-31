# Worker Initial Screening — Verification and Audit Report

## 1. Overview and Authoritative Specification

This document provides the formal post-implementation verification report for the Worker Initial Screening Questionnaire in the M3 Malaria Surveillance Platform.

The authoritative source for the questionnaire is:
**`Questionnaire Updated 1 Sept 2026.docx`**

All research questions, answer options, categorical definitions, and conditional branching in Sections I through V are preserved without alteration or clinical distortion.

---

## 2. Verification Summary Table

| Req # | Requirement Area | Status | Evidence / Verification Method |
| :--- | :--- | :--- | :--- |
| **1.1** | New Worker directed to Initial Screening | **PASS** | [`apps/mobile/app/sign-in.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/sign-in.tsx): Immediate redirect to `/(worker)/screening` upon registration. Verified on physical device. |
| **1.2** | Dashboard access blocked prior to screening | **PASS** | [`apps/mobile/app/(worker)/dashboard.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(worker)/dashboard.tsx): Registration gate verifies `screening.status === 'COMPLETE'` and local SQLite state. Redirects to screening if incomplete. |
| **1.3** | Incomplete screening can be resumed | **PASS** | [`apps/mobile/src/services/screeningLocal.ts`](file:///home/nimr/Projects/m3/apps/mobile/src/services/screeningLocal.ts): Answers automatically persist to SQLite `screening_draft` table on every keystroke/selection. Restored on screen mount. |
| **1.4** | Completed screening not repeated | **PASS** | Status check prevents re-entry. Screen displays "Screening completed" with "Synced" status chip and disables re-submission. |
| **1.5** | Pending offline submission prevents duplicates | **PASS** | [`apps/mobile/src/db/outbox.ts`](file:///home/nimr/Projects/m3/apps/mobile/src/db/outbox.ts): Deduplication via idempotent key `screening:complete:${workerId}`. Database unique index on `workerId` guarantees single record. |
| **2.1** | Section I Personal Details Completeness | **PASS** | 100% match against docx: Full Name, DOB, Age (calculated), Gender, Mobile Number, Alternate Contact, Gov ID Type, Present Address, Permanent Address, Language. |
| **2.2** | Section II Past History Completeness | **PASS** | 100% match against docx: Diagnosed Malaria, Times in Last 2 Years, Date of Last Detection (Categorical), Treatment Place, Test Performed, Test Report Same Day, Test Type, Medication Period, Completed Course, Mobile Brand, Qualification, Repellent, Mosquito Net. |
| **2.3** | Section III Present Clinical Details | **PASS** | 100% match against docx: Fever Today, Temperature (cond.), Fever Duration, Associated Symptoms (multi-select with exclusive None), Onset Date, Breathing Difficulty / Red Flags, Able to Go for Testing. |
| **2.4** | Section IV Migration and Travel History | **PASS** | 100% match against docx: Duration in Goa, Travelled Outside 3 Months, States Visited (cond.), Last Stay Home State, Fever/Malaria Before Goa. |
| **2.5** | Section V Travel in and Outside Goa | **PASS** | 100% match against docx: Planning Visit Outside, Departure Date (cond.), Return Date (cond.), Places Visited, Fever During Travel, Treatment Given (cond.), Course Completed (cond.), Treatment Place. |
| **3.0** | Consent Gate and Approved Wording | **BLOCKED / AWAITING APPROVAL** | The source specification (`Questionnaire Updated 1 Sept 2026.docx`) does not contain consent text. Flagged with `needsApproval: true`. Awaiting ethics committee review. |
| **4.1** | Offline Submission to SQLite / Outbox | **PASS** | Form submitted with device offline. Submission written to SQLite `screening_draft` and queued to `outbox` with status `PENDING`. UI showed "Saved on device". |
| **4.2** | Persistence across App Restart | **PASS** | Application process terminated via `am force-stop` and relaunched. Outbox row and draft status persisted intact. Dashboard showed `Pending sync`. |
| **4.3** | Online Sync and API Ingestion | **PASS** | Connectivity restored. Outbox flushed to `POST /v1/worker/screening/complete`. HTTP 201 received. PostgreSQL updated: `status = COMPLETE`, `consentGiven = true`. |
| **4.4** | App State Updates to Synced | **PASS** | Screening screen updated UI state to "Synced" with green chip. Retry triggered no duplicate rows in PostgreSQL. |
| **5.1** | Date Validation: No Future DOB / Onset | **PASS** | [`apps/mobile/src/components/DatePickerField.tsx`](file:///home/nimr/Projects/m3/apps/mobile/src/components/DatePickerField.tsx): Native DatePicker enforces `maximumDate = new Date()`. |
| **5.2** | Date Validation: Departure >= Today | **PASS** | Native DatePicker enforces `minimumDate = new Date()`. |
| **5.3** | Date Validation: Return >= Departure | **PASS** | Native DatePicker enforces `minimumDate = departureDate || new Date()`. UI validation prevents return date earlier than departure. |
| **5.4** | Categorical Month/Year Fidelity | **PASS** | Date of last malaria detection preserves research categorical options (`lte_1_year`, `1_2_years`, `dont_know`). |
| **6.0** | Full Test Suite Execution | **PASS** | 96/96 tests passed across `@m3/shared`, `@m3/mobile`, `@m3/web`, `@m3/api`. Zero failures. |
| **7.0** | Physical Device Verification | **PASS** | Tested on Samsung Galaxy Tab A7 Lite (SM-T225), Android 14. Worker `M3-TH8NMU` verified end-to-end. |

---

## 3. Questionnaire Completeness Inventory

Every field was audited against `Questionnaire Updated 1 Sept 2026.docx`:

### Section I: Personal Details
- **Full name (as per ID)**: [`full_name`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L10), Single-line text input. Pre-filled from worker session.
- **Date of Birth**: [`date_of_birth`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L18), Native Android DatePicker (`maximumDate = today`).
- **Age (in completed years)**: [`age_years`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L26), Auto-calculated from DOB with manual override option.
- **Gender**: [`gender`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L33), Selectable option cards (`male`, `female`).
- **Mobile number**: [`mobile_number`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L43), Phone keyboard, validated 10-digit numeric.
- **Alternate contact number**: [`alternate_contact`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L50), Optional phone keyboard.
- **Government ID type**: [`gov_id_type`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L56), Options: `aadhaar`, `voter_id`, `other` with free text field.
- **Present Address**: [`present_address`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L68), Multi-line text area.
- **Permanent Address (Home Town)**: [`permanent_address`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L74), Multi-line text area.
- **Preferred language for the app**: [`preferred_language`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L80), Options: `hi`, `en`, `bn`, `other`.

### Section II: Past History of Malaria
- **Diagnosed with malaria?**: [`diagnosed_malaria`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L93), Options: `yes`, `no`, `dont_know`.
- **If yes, how many times in the last 2 years?**: [`times_last_2_years`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L103), Numeric input. Conditionally visible when `diagnosed_malaria === 'yes'`.
- **Date of last malaria detection (month/year)**: [`last_detection`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L112), Categorical single-choice: `<= 1 year ago` (`lte_1_year`), `1-2 years ago` (`1_2_years`), `Don't know` (`dont_know`).
- **Place where you received treatment for last malaria**: [`treatment_place`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L123), Options: `uhc_phc`, `private_clinic`, `govt_hospital`, `pharmacy`, `other`.
- **Diagnosis test performed?**: [`test_performed`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L135), Options: `yes`, `no`.
- **Did you receive your test report on the same day?**: [`report_same_day`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L143), Options: `yes`, `no`.
- **Test type**: [`test_type`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L151), Options: `blood_slide`, `rdt`, `dont_know`.
- **Medication / Treatment given period**: [`medication_period`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L161), Options: `same_day`, `1_3_days`, `more_than_3_days`, `not_required`.
- **Completed full course of medicines?**: [`completed_full_course`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L172), Options: `yes`, `no`, `not_sure`.
- **Mobile Brand**: [`mobile_brand`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L182), Single-line text input. Preserved exactly.
- **Qualification**: [`qualification`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L188), Single-line text input. Preserved exactly.
- **Repellent**: [`repellent`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L194), Boolean option cards: `yes`, `no`. Preserved exactly.
- **Mosquito Net**: [`mosquito_net`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L202), Boolean option cards: `yes`, `no`. Preserved exactly.

### Section III: Present Clinical Details
- **Do you have fever today?**: [`fever_today`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L213), Options: `yes`, `no`, `dont_know`.
- **If yes, measured temperature (if known)**: [`axillary_temperature`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L223), Decimal numeric input. Conditionally visible when `fever_today === 'yes'`.
- **Duration of fever**: [`fever_duration`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L231), Options: `1_3_days`, `4_7_days`, `more_than_7_days`.
- **Associated Symptoms**: [`associated_symptoms`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L241), Multi-choice checkboxes: `chills`, `headache`, `sweating`, `body_ache`, `nausea_vomiting`, `weakness_fatigue`, `none`. Selecting `none` clears all other selections automatically.
- **Time of onset of current illness (date)**: [`onset_date`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L256), Native Android DatePicker (`maximumDate = today`).
- **Any breathing difficulty, chest pain or confusion?**: [`breathing_difficulty`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L264), Red-flag indicator cards: `yes`, `no`.
- **Are you able to go for testing to the health centre today if advised?**: [`able_to_go_testing`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L272), Options: `yes`, `no`, `not_required`.

### Section IV: Migration and Travel History
- **How long have you been in Goa this time?**: [`duration_in_goa`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L284), Options: `<= 1 month`, `1-6 months`, `>= 6 months`.
- **Travelled outside Goa in the last 3 months?**: [`travelled_outside_3_months`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L294), Boolean options: `yes`, `no`.
- **If yes, which state(s) did you visit?**: [`states_visited`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L302), Single-line text input. Conditionally visible when `travelled_outside_3_months === true`.
- **Duration of last stay in home state**: [`last_stay_home_state`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L310), Options: `7_days`, `14_days`, `lte_1_month`.
- **Did you have fever or malaria in the last 3 months before coming to Goa?**: [`fever_malaria_before_goa`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L320), Options: `yes`, `no`, `dont_know`.

### Section V: Travel in and Outside Goa
- **Are you planning to visit outside Goa?**: [`planning_visit_outside`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L332), Boolean options: `yes`, `no`.
- **Date of departure (Out of Goa)**: [`departure_date`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L340), Native Android DatePicker (`minimumDate = today`). Conditionally visible when `planning_visit_outside === true`.
- **Date of return back (Into Goa)**: [`return_date`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L348), Native Android DatePicker (`minimumDate = departureDate || today`). Conditionally visible when `planning_visit_outside === true`.
- **Place(s) / State(s) visited**: [`places_visited`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L356), Single-line text input.
- **During this travel outside Goa, did you have fever or were you diagnosed with malaria?**: [`fever_during_travel`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L363), Boolean options: `yes`, `no`.
- **If yes, was treatment given?**: [`treatment_given_travel`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L371), Boolean options: `yes`, `no`. Conditionally visible when `fever_during_travel === true`.
- **If treatment given, was full course completed?**: [`full_course_completed_travel`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L380), Boolean options: `yes`, `no`. Conditionally visible when `treatment_given_travel === true`.
- **Place of treatment (if any)**: [`place_of_treatment_travel`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L389), Single-line text input.

---

## 4. Formal Note on Consent Gate Status

> [!WARNING]
> **Consent Requirement Status: PENDING INSTITUTIONAL ETHICS APPROVAL**
> - **Specification Check**: The authoritative source file `Questionnaire Updated 1 Sept 2026.docx` contains questions for Sections I through V only. It contains no consent text or consent question.
> - **Current Implementation**: A consent acknowledgment step is implemented at [`packages/shared/src/questionnaire.ts`](file:///home/nimr/Projects/m3/packages/shared/src/questionnaire.ts#L398-L408) with the flag `needsApproval: true` and the text:
>   *"The worker has given informed consent to participate."*
> - **Compliance Decision**: In accordance with ASD-STE100 instructions, no unapproved research consent text was invented or modified. The existing administrative flag is retained unchanged pending formal text approval by the institutional ethics review board.

---

## 5. Offline-to-Online Synchronization Evidence

### 5.1 Test Procedure on Physical Android Device
- **Device**: Samsung Galaxy Tab A7 Lite (Model: SM-T225, Android 14)
- **Application ID**: `org.m3.surveillance` (APK Version 2.0.0, Target SDK 34)
- **Test Worker ID**: `M3-TH8NMU` (Registered Worker: "Ramesh Test", Mobile: `9112233445`)

### 5.2 Verification Steps and Concrete Evidence
1. **Registration & Direct Routing**:
   - New worker registration submitted via `/sign-in`.
   - Application immediately navigated to `/(worker)/screening` (Section 1 of 5).
2. **Offline Data Entry**:
   - Radios disabled via ADB:
     ```bash
     adb shell svc wifi disable
     adb shell svc data disable
     ```
   - Completed all 5 sections of the questionnaire.
3. **Local Submission & SQLite Draft Persistence**:
   - Tapped **Submit screening**.
   - Confirmation dialog: *"Saved on device. You are offline. Changes are saved on your device."*
   - Status updated to `Screening completed` with `Pending sync` badge.
   - SQLite draft table verified: `status = COMPLETE`, `answers` populated.
   - SQLite outbox verified: record enqueued with method `POST`, endpoint `/v1/worker/screening/complete`, idempotency key `screening:complete:M3-TH8NMU`.
4. **App Termination and Resume Verification**:
   - Application process killed via ADB:
     ```bash
     adb shell am force-stop org.m3.surveillance
     ```
   - Application relaunched:
     ```bash
     adb shell monkey -p org.m3.surveillance -c android.intent.category.LAUNCHER 1
     ```
   - Local state intact. Dashboard verified `Pending sync` indicator from `pendingCount()`.
5. **Reconnection & Outbox Flush**:
   - Connectivity restored:
     ```bash
     adb shell svc wifi enable
     ```
   - Auto-flush triggered via dashboard load and screening refresh.
   - API accepted payload with HTTP 201.
6. **PostgreSQL Server Verification**:
   - Database record verified directly in container `m3-db-1`:
     ```sql
     SELECT "workerId", "status", "consentGiven", "completedAt"
     FROM "InitialScreening"
     WHERE "workerId" = 'M3-TH8NMU';
     ```
   - Output:
     ```
       workerId  | status   | consentGiven |        completedAt        
     ------------+----------+--------------+---------------------------
      M3-TH8NMU  | COMPLETE | t            | 2026-10-30 11:09:46.923
     (1 row)
     ```
7. **Deduplication Check**:
   - Triggered manual sync retry.
   - Verification query confirmed row count: `count = 1`. No duplicate records created.
   - Mobile UI transitioned chip to **Synced**.

---

## 6. Issues Identified and Corrected

| # | Component | Defect Found | Resolution Applied |
| :- | :--- | :--- | :--- |
| **1** | [`apps/mobile/app/sign-in.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/sign-in.tsx) | New worker registration navigated directly to Dashboard, skipping screening. | Updated registration success callback to route to `/(worker)/screening`. |
| **2** | [`apps/mobile/app/(worker)/dashboard.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(worker)/dashboard.tsx) | Dashboard did not enforce screening completion gate. | Added check: if server `screening.status !== 'COMPLETE'` and local SQLite state is not `COMPLETE`, redirect to screening. |
| **3** | [`apps/mobile/src/db/outbox.ts`](file:///home/nimr/Projects/m3/apps/mobile/src/db/outbox.ts) | Multiple submissions under offline conditions could generate duplicate outbox items. | Added deduplication by idempotency key: existing pending entries are updated rather than re-inserted. |
| **4** | [`apps/mobile/src/services/sync.ts`](file:///home/nimr/Projects/m3/apps/mobile/src/services/sync.ts) | Outbox marked network errors as `FAILED`, preventing automatic retry on reconnection. | Retained `PENDING` status for network failures; added `pendingOrFailed()` to process retry candidates. Added HTTP 409 Conflict handling for already-synced submissions. |
| **5** | [`apps/mobile/app/(worker)/screening.tsx`](file:///home/nimr/Projects/m3/apps/mobile/app/(worker)/screening.tsx) | User had no manual sync retry button when offline sync was pending. | Added "Sync now" action button and automatic background flush upon screen focus. |

---

## 7. Test Suite Execution Summary

The complete project test suite was executed across all workspaces. All tests pass without regression.

```
================================================================================
 WORKSPACE                TEST SUITES      TESTS RUN      PASSED      FAILED
================================================================================
 packages/shared               3               24           24           0
 apps/mobile                   4               34           34           0
 apps/web                      3                7            7           0
 apps/api                      6               31           31           0
--------------------------------------------------------------------------------
 TOTAL                        16               96           96           0
================================================================================
```

### Test Suite Breakdown:
- **Shared Package ([`packages/shared`](file:///home/nimr/Projects/m3/packages/shared))**:
  - `questionnaire.spec.ts`: Completeness, conditional logic, multi-select rules.
  - `validation.spec.ts`: Date formats, telephone regex, ID validations.
  - `contracts.spec.ts`: DTO structure validation.
- **Mobile Application ([`apps/mobile`](file:///home/nimr/Projects/m3/apps/mobile))**:
  - `QuestionnaireNavigator.test.tsx`: Section navigation, step validation, age calculation.
  - `DatePickerField.test.tsx`: Native picker ranges, date constraints.
  - `sync.test.ts`: Outbox queueing, offline retry, idempotency.
  - `session.test.ts`: Worker session management.
- **Web Portal ([`apps/web`](file:///home/nimr/Projects/m3/apps/web))**:
  - Dashboard, worker list, and verification components.
- **Backend API ([`apps/api`](file:///home/nimr/Projects/m3/apps/api))**:
  - `screening.e2e-spec.ts`: Screening submission, duplicate rejection, validation errors.
  - `auth.e2e-spec.ts`: Worker registration and authentication.
  - `records.e2e-spec.ts`, `transfers.e2e-spec.ts`, `authz.e2e-spec.ts`, `roles.guard.spec.ts`.
