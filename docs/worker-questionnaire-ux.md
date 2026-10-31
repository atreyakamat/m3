# M3 Worker Questionnaire — UX & Technical Reference

## 1. Executive Summary

This document specifies the user experience, component architecture, input controls, date rules, and offline synchronisation mechanisms for the **M3 Worker Initial Screening Questionnaire** (`apps/mobile/app/(worker)/screening.tsx`).

The interface is engineered specifically for construction workers operating on physical Android devices, providing intuitive touch controls, multilingual accessibility, and complete offline survivability.

---

## 2. Input Controls

| Question Type | UI Component | Touch Target | Behavioral Specification |
| :--- | :--- | :--- | :--- |
| **Full Date** | `DatePickerField` | 52px height | Opens native Android system DatePickerDialog. Renders formatted local date (`DD MMM YYYY`). Stores `YYYY-MM-DD`. |
| **Single Choice** | `OptionCard` (Radio) | 56px min height | Border highlight (`palette.primary`), circular indicator with inner dot, soft background tint (`palette.primarySoft`). |
| **Multi Choice** | `OptionCard` (Checkbox) | 56px min height | Square check indicator (`✓`). Selecting "None" automatically deselects other active choices. |
| **Phone Number** | `TextInput` (`phone-pad`) | 52px min height | Numeric keyboard only. Strips non-digits; enforces exact 10-digit length. |
| **Temperature** | `TextInput` (`decimal-pad`) | 52px min height | Supports decimal points (e.g. 98.6). Displays `°F` unit label. |
| **Free Text / Address** | `TextInput` (Multi-line) | 90px min height | Expanded vertical area for address entries with proper scrolling. |
| **Month / Year** | `OptionCard` group | 56px min height | Retains research categorical intervals (`≤ 1 Year`, `1–2 Years`, `Don't know`). |

---

## 3. Date Picker Behaviour & Validation Rules

### 3.1 Date Constraints Matrix

| Field ID | Label | Min Date | Max Date | Dependent Logic |
| :--- | :--- | :--- | :--- | :--- |
| `date_of_birth` | Date of Birth | Today - 110 years | Today | Auto-computes completed years into `age_years`. Future dates blocked by picker. |
| `onset_date` | Time of onset of current illness | Today - 50 years | Today | Historical date only. Future dates blocked by picker. |
| `departure_date` | Date of departure (Out of Goa) | Today | Today + 5 years | Future date only. If updated after return date, resets `return_date`. |
| `return_date` | Date of return back (Into Goa) | `departure_date` or Today | Today + 5 years | Cannot precede `departure_date`. Future date only. |

### 3.2 Timezone & Formatting
- **Internal Storage**: UTC-safe ISO-8601 calendar date (`YYYY-MM-DD`).
- **Display**: Localised using device locale format (`15 Oct 2026`).
- **Picker**: Android native Material DatePickerDialog summoned via `@react-native-community/datetimepicker`.

---

## 4. Conditional Question Logic

Conditional visibility is evaluated dynamically against the reactive answers store:

1. **Malaria Frequency**:
   - `times_last_2_years` renders only when `diagnosed_malaria === 'yes'`.
2. **Axillary Temperature**:
   - `axillary_temperature` renders only when `fever_today === 'yes'`.
3. **Out-of-Goa Travel States**:
   - `states_visited` renders only when `travelled_outside_3_months === true`.
4. **Planned Travel Schedule**:
   - `departure_date` and `return_date` render only when `planning_visit_outside === true`.
5. **Travel Treatment Follow-up**:
   - `treatment_given_travel` renders only when `fever_during_travel === true`.
   - `full_course_completed_travel` renders only when `treatment_given_travel === true`.

*Data Integrity Note*: When a parent answer is toggled, previously entered child values are preserved safely in memory without data corruption.

---

## 5. Navigation & Step-Based Architecture

The questionnaire is partitioned into the 5 authoritative sections:
1. **Section I**: Personal Details
2. **Section II**: Past History of Malaria
3. **Section III**: Present Clinical Details
4. **Section IV**: Migration and Travel History
5. **Section V**: Travel in and Outside Goa + Informed Consent

### Navigation Controls:
- **Progress Indicator**: Visible progress bar at the top displaying `Section X of 5`.
- **Continue Control**: Validates mandatory visible fields on the current screen before allowing transition to the next section.
- **Previous Control**: Allows non-destructive backward navigation.
- **Submit Control**: Prominently presented on Section 5 once Informed Consent has been confirmed.

---

## 6. Offline Persistence & Synchronisation

The mobile application implements a resilient offline-first architecture:
- **Continuous Local Drafts**: Every answer modification is recorded immediately in SQLite (`screening_draft` table).
- **Restart Recovery**: Reopening the application immediately restores the saved state, retaining draft progress.
- **Offline Submission**: Submitting without network connectivity persists the completed record locally with `syncState = 'PENDING'` and enqueues a mutation task in the `outbox` table with an idempotent key (`screening_<workerId>`).
- **Synchronisation Flow**: When network connectivity returns, `flushOutbox()` synchronises the queued record with `/api/v1/screening/me/complete` and promotes local state to `SYNCED`.
- **Status Transparency**: Clear status badges inform workers whether their answers are `Saved on device`, `Pending sync`, or `Synced`.

---

## 7. Multilingual Support

Full translations are provisioned for all 4 supported languages:
- **English (`en`)**
- **Hindi (`hi`)**
- **Bengali (`bn`)**
- **Marathi (`mr`)**

All navigation buttons, section titles, field labels, placeholder texts, date pickers, validation errors, and confirmation screens adapt instantly to the worker's selected language.

---

## 8. Verification & Test Suite

Comprehensive automated test coverage validates:
- Navigation stepping forward and backward.
- Validation preventing transition when mandatory fields are missing.
- 10-digit mobile number format enforcement.
- Conditional question visibility toggling.
- Informed consent enforcement on Section 5.
- Native date picker value formatting and range boundaries.
- Offline SQLite draft and outbox storage routines.
