# Questionnaire Audit Matrix — 1 Sept 2026 source

Audit basis: `Questionnaire Updated 1 Sept 2026.docx`, verified line-by-line against the
implementation (UI code, client validation, schemas, endpoints, models, migrations, tests).
Status legend: **Verified** (UI + client validation + server validation + persistence + test
evidence), **Partial** (some layers evidenced, others not), **Missing** (required behavior
absent), **Ambiguous** (source term/rule unresolved), **Not Tested** (implemented but without
test evidence).

`intake.tsx` = `apps/mobile/app/intake.tsx`; `questionnaire.py` =
`services/api/app/questionnaire.py`; `main.py` = `services/api/app/main.py`;
`schemas.py` = `services/api/app/schemas.py`; `models.py` = `services/api/app/models.py`;
`dateFields.ts` = `apps/mobile/src/dateFields.ts`.

---

## 1. Labour Worker — pages 1–2 (intake, 5 sections)

| Source | Question (faithful) | UI | Options | Conditional rule | Client validation | Server validation | API mapping | Persistence | Test evidence | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p1 §I | Full name (as per ID) | `Field` "Full Name" (`personal.full_name`) | free text | always | ≥2 chars (intake.tsx:572) | str 2–120 (questionnaire.py:130) | `QuestionnaireSubmitIn.data.personal.full_name`; `WorkerCreate.display_name` | `questionnaire_submissions.data` (JSON); `patients.display_name` | `test_personal_required_fields_gate_on_all_empty` asserts required error | Verified | — |
| p1 §I | Date of Birth | `CalendarDatePickerField` "Date of Birth" (`personal.dob`), month-grid modal, year picker, out-of-range days disabled | picker only (no primary typing) | always; fallback below | `validateDobISO` (dateFields.ts:90); runtime `[today−90y, today]`, local calendar | `dob` vs `dob_boundaries()` (questionnaire.py:134–142); `/workers` re-enforces (main.py:706–718) | `personal.dob`; `WorkerCreate.dob` | `questionnaire_submissions.data`; `patients.dob`, `age_as_on` | backend `test_dob_boundaries_90_years_and_no_future` (min-day accepted, min−1d + future rejected); mobile date tests 1–3 | Verified | — |
| p1 §I | Age (in completed years) | auto-age text under picker (`ageInCompletedYears`) | derived | shown when DOB picked | auto-calculated | must equal completed-years when sent with DOB (questionnaire.py:143–150) | `personal.age_years`; `WorkerCreate.age_years` | `patients.age_years` (+`age_flagged` on `/workers`) | `test_age_in_completed_years_semantics`; mobile test 7 | Verified / **Ambiguous** | `/workers` flags mismatch (`age_flagged=True`) while questionnaire rejects (`422`) — two behaviours for one rule; needs owner confirmation |
| p1 §I | (not in source) "Do you know your date of birth?" fallback | Chip (+manual age field) | Yes-picked / No-age-only | shown always; manual field when `dob_unknown==='yes'` | age 0–120 (intake.tsx:577–579) | DOB-or-age required; age 0–120 (questionnaire.py:132,151–154); `dob_unknown` never sent | `personal.age_years` (fallback only) | `patients.age_years` | `test_reg003_dob_or_age_required_and_mismatch_flagged` | Verified | field is a UI affordance not in source (documented) |
| p1 §I | Gender M/F | ChipPicker (`personal.gender`) | male / female | always | — | required enum (questionnaire.py:155) | `personal.gender`; `WorkerCreate.gender` | `questionnaire_submissions.data`; `patients.gender` | via empty-section test | Verified / Not Tested (no dedicated unit for path) | — |
| p1 §I | Mobile number | `Field` phone-pad (`personal.mobile`) | free numeric | always | ≥8 digits (intake.tsx:589) | shape 8–15 digits (questionnaire.py:85–93); phone normalised; dup 409 | `personal.mobile`; `WorkerCreate.mobile/phone` | `patients.phone_e164` | identity/idempotency suites (test_worker_identity.py) | Verified | — |
| p1 §I | Alternate contact (optional) | `Field` (`personal.alternate_contact`) | free | always | — | ≤120 (questionnaire.py:161) | `personal.alternate_contact` | `patients.alternate_contact` | — | Verified / Not Tested | — |
| p1 §I | Government ID type + Other | ChipPicker + note (`personal.id_type`, `id_other_details`) | Aadhaar / Voter ID / Other | note shown+required when `other` | note required (intake.tsx:592) | enum + note required for `other` (questionnaire.py:163–165) | `personal.id_type`, `id_other_details`; `WorkerCreate.id_type`, `id_other_details` | `patients.id_type/id_other_details` | `test_reg004_other_id_requires_details` | Verified | — |
| p1 §I | Present address | multiline `Field` (`personal.address_present`) | free | always | ≥4 chars (intake.tsx:595) | required 4–400 (questionnaire.py:166–168) | `personal.address_present`; `WorkerCreate.address_present` | `patients.address_present` | via empty-section test | Verified | — |
| p1 §I | Permanent address (Home Town) | multiline `Field` (`personal.address_permanent`) | free | optional | — | ≤400 (questionnaire.py:169–170) | `personal.address_permanent` | `patients.address_permanent` | — | Verified / Not Tested | — |
| p1 §I | Preferred language H/E/B/Other | ChipPicker (`personal.preferred_language`) | Hindi / English / Bengali / Other | always | — | required enum (questionnaire.py:171) | `personal.preferred_language` | + `users.preferred_language` | — | Verified / Not Tested | — |
| p2 §II | Diagnosed with malaria? Yes/No/Don't know | ChipPicker (`past_history.diagnosed_malaria`) | Yes / No / Don't know | gates 2.2–2.9 | required (intake.tsx:602) | `YES_NO_UNSURE` (questionnaire.py:176) | `past_history.diagnosed_malaria` | JSON | `test_past_history_conditional_chain`, `test_section_2_not_diagnosed_short_circuits` | Verified | — |
| p2 §II | How many times in last 2 years | numeric `Field` (`past_history.times_malaria_2y`) | 0–50 | when diagnosed=yes | 0–50 (intake.tsx:606) | int 0–50 (questionnaire.py:192–194) | `past_history.times_malaria_2y` | JSON | `test_past_history_conditional_chain` | Verified | — |
| p2 §II | Date of last detection ≤1y / 1–2y / Don't know | ChipPicker (`past_history.last_detection`) | ≤1 Year / 1–2 Years / Don't know | diagnosed=yes | required (intake.tsx:610) | enum (questionnaire.py:195) | `past_history.last_detection` | JSON | same | Verified | — |
| p2 §II | Place of last treatment + Others | ChipPicker + note (`treatment_place`, `treatment_place_other`) | UHC/PHC, Private clinic, Govt Hospital, Pharmacy, Other | diagnosed=yes; note when other | other⇒note (intake.tsx:616) | `TREATMENT_PLACES` + note req. (questionnaire.py:196–198) | `past_history.treatment_place(_other)` | JSON | same | Verified | — |
| p2 §II | Diagnosis test performed? Y/N | ChipPicker | Yes / No | diagnosed=yes | required (intake.tsx:619) | gates same-day chain (questionnaire.py:199–201) | `past_history.diagnostic_test_performed` | JSON | same | Verified | — |
| p2 §II | Report on same day? Y/N | ChipPicker | Yes / No | test performed=yes | required (intake.tsx:623) | gates method chain (questionnaire.py:202–204) | `past_history.same_day_report` | JSON | test_past_history_conditional_chain | Verified | — |
| p2 §II | RDT / Microscopy / Not sure | ChipPicker (`past_history.test_method`) | RDT / Microscopy / Not sure | same-day=yes | required (intake.tsx:627) | enum (questionnaire.py:205) | `past_history.test_method` | JSON | test_hook in chain test | Verified | — |
| p2 §II | Medication period 3/14/28/Not informed/DK | ChipPicker | 3 Days / 14 Days (Pv) / 28-day follow-up / Not informed / Don't know | same-day=yes | required (intake.tsx:630) | enum incl. both `not_informed`, `dont_know` (questionnaire.py:206) | `past_history.medication_period` | JSON | chain test | Verified / Ambiguous (minor) | source shows a single combined "Not informed / Don't know" box; implementation splits into 2 codes |
| p2 §II | Completed full course? Y/N/Not sure | ChipPicker | Yes / No / Not sure | medication ∈ {3,14,28} (intake.tsx:1514; questionnaire.py:207) | required (intake.tsx:633) | required in same window (questionnaire.py:207–208) | `past_history.full_course_completed` | JSON | chain test | Verified | — |
| p2 (add-on line) | Mobile brand | `Field` (`past_history.mobile_brand`) | free | optional, always shown | — | ≤60 only when supplied, validated **before** the diagnosed≠yes early-return (questionnaire.py:185–189) | `past_history.mobile_brand` | JSON | `test_past_history_new_source_fields_optional_and_validated` | Verified | — |
| p2 (add-on line) | Qualification | `Field` (`past_history.qualification`) | free | optional, always shown | — | ≤120 (same) | `past_history.qualification` | JSON | same test | Verified | — |
| p2 (add-on line) | Repellent Yes/No | ChipPicker | Yes / No | optional, always shown | — | `YES_NO` (questionnaire.py:181–182) | `past_history.repellent_use` | JSON | same test | Verified | — |
| p2 (add-on line) | Mosquito net Yes/No | ChipPicker | Yes / No | optional, always shown | — | `YES_NO` (same) | `past_history.mosquito_net_use` | JSON | same test | Verified | — |
| p3 §III | Fever today? Yes/No/Not sure | ChipPicker | Yes / No / Not sure | gates temp+duration | required (intake.tsx:646) | `YES_NO_NOT_SURE` (questionnaire.py:212–213) | `present_clinical.fever_today` | JSON | `test_empty_data_reports_required_errors_per_section` | Verified | — |
| p3 §III | Measured temperature (if known) | numeric `Field` (`present_clinical.temperature_c`) | 30.0–45.0 | fever=yes or not_sure (intake.tsx:1601) | 30.0–45.0 (intake.tsx:653–657) | same (questionnaire.py:214–221) | `present_clinical.temperature_c` | JSON | `test_invalid_temperature_range` | Verified | — |
| p3 §III | Duration of fever <24h/1–3/>3/Not required | ChipPicker | 24 hours / 1–3 days / >3 days / Not required | fever=yes or not_sure | required (intake.tsx:650) | required in same window (questionnaire.py:222–225) | `present_clinical.fever_duration` | JSON | chain empty-tests | Verified | — |
| p3 §III | Associated symptoms (multi) + No other symptoms | `MultiChipPicker` (`present_clinical.symptoms`) | Chills/shivering, Headache, Sweating, Body ache, Nausea/vomiting, Weakness/fatigue, No other symptoms | always | `no_other_symptoms` exclusive (intake.tsx:466–485) | exclusion + unknown-code rejection (questionnaire.py:226–232) | `present_clinical.symptoms[]` | JSON | `test_s003_no_other_symptoms_mutually_exclusive` | Verified | — |
| p3 §III | Time of onset of current illness (date) | `CalendarDatePickerField` `maxISO=today` | picker | shown & required when fever=yes **or** specific symptoms (not_sure alone ⇒ optional) | `validatePastEventDate` (no future) | `_reject_future_date(..., required=needs_onset)` (questionnaire.py:233–237) | `present_clinical.onset_date` | JSON | 3 onset tests (required-with-symptom, required-with-fever, future-rejected) | Verified / Ambiguous (minor) | onset requiredness under `not_sure` alone is implicit; owner to confirm |
| p3 §III | Breathing difficulty, chest pain or confusion? | 3 chips (`breathing_difficulty`, `chest_pain`, `confusion`) | Yes / No each | always | each required (intake.tsx:668–676) | 3× `YES_NO` required (questionnaire.py:238–239) | corresponding keys | JSON | via empty-section test | Verified | single source line split into 3 booleans (documented) |
| p3 §III | Able to go for testing today? Y/N/Not required | ChipPicker | Yes / No / Not required | always | required | `YES_NO_NOT_REQUIRED` (questionnaire.py:240) | `present_clinical.can_attend_testing` | JSON | via empty-section test | Verified | — |
| p4 §IV | How long in Goa ≤1m/1–6m/≥6m | ChipPicker | ≤1 month / 1–6 / ≥6 | always | required (intake.tsx:684) | enum (questionnaire.py:244) | `migration_history.time_in_goa` | JSON | `test_migration_history_conditionals` | Verified | — |
| p4 §IV | Travelled outside Goa last 3m? Y/N + states + stay duration | ChipPicker + states `Field` + duration chips | Yes / No (+7/14 days, ≤1 month) | yes ⇒ states + duration | required; states non-empty | states list non-empty ≤20 + stay enum (questionnaire.py:245–255) | `migration_history.outside_goa_3m`, `states_visited[]` (split on commas), `last_stay_home_state` | JSON | same test | Verified | — |
| p4 §IV | Fever/malaria in 3 months before Goa? Y/N/DK | ChipPicker | Yes / No / Don't know | always | required | `YES_NO_UNSURE` (questionnaire.py:256) | `migration_history.fever_before_goa_3m` | JSON | same test | Verified | — |
| p5 §V | Planning to visit outside Goa? Y/N | ChipPicker | Yes / No | yes ⇒ ≥1 episode | required (intake.tsx:705) | `YES_NO`; episodes non-empty ≤10 (questionnaire.py:258–270) | `planned_travel.planning`, `episodes[]` | JSON | empty-errors test + episode chain test | Verified | — |
| p5 §V | Date of departure (out of Goa) | `CalendarDatePickerField` `minISO=today` | picker | episode always (required) | `validatePlannedTravelDates` — past departure rejected (dateFields.ts:137) | `departure < today_iso()` rejected (questionnaire.py:281–282) | `episodes[].departure_date` | JSON | `test_planned_departure_cannot_be_in_the_past`; mobile test 10 | Verified | — |
| p5 §V | Date of return back (into Goa) | picker `minISO=departure` | picker | required; ≥ departure | order check | `return_date < departure_date` rejected (questionnaire.py:276–278) | `episodes[].return_date` | JSON | `test_s004_travel_return_cannot_precede_departure`; mobile test 9 | Verified | — |
| p5 §V | Place(s)/state(s) visited | `Field` (`episodes[].place_state`) | free | required | required | required (questionnaire.py:283–284) | `episodes[].place_state` | JSON | episode chain test | Verified | — |
| p5 §V | Fever/malaria during travel? Y/N | ChipPicker | Yes / No | required | required | required (questionnaire.py:285–288) | `episodes[].fever_malaria_during` | JSON | episode chain test | Verified | — |
| p5 §V | Treatment given? Y/N | ChipPicker | Yes / No | fever=yes | required | required (questionnaire.py:289–291) | `episodes[].treatment_given` | JSON | episode chain test (error path asserted) | Verified | — |
| p5 §V | Full course completed? Y/N/Not sure | ChipPicker | Yes / No / Not sure | treatment=yes | required | required (questionnaire.py:292–293) | `episodes[].full_course_completed` | JSON | episode chain test | Verified | — |
| p5 §V | Place of treatment + Other | ChipPicker + note (`treatment_place(_other)`) | UHC/PHC, Govt, Private, Pharmacy, Other | treatment=yes; note when other | required | required (questionnaire.py:294–296) | `episodes[].treatment_place(_other)` | JSON | episode chain test | Verified | — |
| — | Drafts (local+server), saved indicator, deliberate discard | badge + ghost Discard + confirm alert | — | — | n/a | `GET/PUT /questionnaires/draft` (main.py:948–976) | local drafts + `questionnaire_submissions(state='draft')` | `verify_offline_cache` draft tests; `test_validate_skip_sections_for_partial_draft_saving` | Verified | — |
| — | Idempotent submission / offline retry | pending-id minted once, cleared on ack; outbox oldest-first | — | — | n/a | `client_request_id` dedupe → 200 duplicate (main.py:977–995) | unique partial index on `client_request_id` | `test_questionnaire_idempotency_lifecycle`, `test_offline_first_time_worker_replay_does_not_duplicate` + 11 offline-cache PASS | Verified | — |
| — | Hidden fields not submitted as stale answers | payload builder omits hidden conditional keys (intake.tsx:835–950) | — | — | unconditional purge in builder | server tolerates stale extra keys (dict passthrough) | n/a | JSON | **new gap test** `test_stale_hidden_fields_are_tolerated_not_validated` | Verified (documented tolerance) | stricter rejection would break old queued drafts — left tolerant by design |
| — | Values preserved between sections | state retained; per-section mount only | — | — | — | — | — | — | manual code inspection | Verified / Not Tested (no mobile UI automation available) | no automated UI test possible in this environment |

### Worker summary

| Status | Count |
|---|---|
| Verified | 33 |
| Partial | 0 |
| Missing | 0 |
| Ambiguous | 3 (age-mismatch semantics; `not_informed`/`dont_know` split; onset under `not_sure`) |
| Not Tested (sub-rows) | 2 (gender/path; section-traversal UI) |

---

## 2. Pathologist — page 3 (`apps/mobile/app/diagnostic.tsx`, `SampleCreate`/`SlideFollowUpSave`, `create_sample`, `save_slide_followup`)

| Source | Question (faithful) | UI | Options | Conditional rule | Client validation | Server validation | API mapping | Persistence | Test evidence | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p3 admin | Name of the pathologist | read-only field from session | — | always | — | `operator_id=user.id` (main.py:1212) | implicit (token) | `diagnostic_tests.operator_id` | — | Verified | — |
| p3 admin | Facility name (drop-down) | staff facility ChipPicker | `/facilities` list | always | — | `facility_id` must exist (main.py:1192) | `SampleCreate.facility_id` | `samples.facility_id` | — | Verified (dropdown) / **Ambiguous** (address below) | address represented by district only |
| p3 admin | Address (linked drop-down) | district badge derived from selected facility | derived | follows facility | — | — | — | facility record | — | Partial | source shows full address; `Facility` model stores district only — needs owner input |
| p3 admin | Patient name + mobile; demographics linked to mobile number | code/UUID field + name + mobile fields; **Find Worker** lookup via `GET /workers?q=` (implemented in this update) | candidates list | always | code required | identity via `require_patient_scope` → `resolve_patient` (code or UUID, main.py:116–123, 1191) | `SampleCreate.patient_id` | `samples.patient_id` (`DiagnosticTest.notes` identity trail) | identity none (partial coverage below) | Partial | typed name/mobile historically not matched against the record (now assisted by lookup); matching remains manual |
| p3 lab 1 | Malaria diagnosis test done? RDT / SMP / Other | ChipPicker (`method`) | RDT / **Microscopy** / SMP / Other | gates result+smear blocks | other⇒note (diagnostic.tsx:125) | enum `DIAGNOSTIC_METHODS`; other⇒note (main.py:1195) | `SampleCreate.method` | `diagnostic_tests.method` | `test_analytics.py` smp fixture tally (no HTTP path) | **Ambiguous** + was **Partial** | "SMP" meaning still unresolved (kept literal); microscopy added beyond Q1's list (matches Q3); see gap G1 |
| p3 lab 2/3 | RDT result / Microscopy result: neg/pos + species (Pf/Pv/Mixed/Other) | shared Result chips + species chips (species shown when positive) | pending/positive/negative/indeterminate; pf/pv/mixed/other/undetermined | species block ⇒ positive only | positive⇒species required; other⇒note (diagnostic.tsx:129–135) | species enum validated server-side (`SPECIES`, schemas.py:149–153; HTTP-confirmed: unsupported → 422); **positive⇒species was NOT enforced server-side** (fixed in gap G4) | `SampleCreate.result_status/species/species_other_note` | `diagnostic_tests.result_status/species/species_other_note` | sample created in `test_pathology_slide_followup_and_reasons` (positive+pv); **remediation HTTP tests** (valid/missing/unsupported species → 201/422/422) | Partial → **Verified** (G4) | was: server accepted positive w/o species |
| p3 lab 4 | Type of smear read: Thick / Thin / Both | ChipPicker | Thick / Thin / Both | shown+required for microscopy & SMP | required for both methods (diagnostic.tsx:137–140) | enum `thick/thin/both/not_applicable`; smear method-rule **previously excluded SMP → 422 contradiction** (fixed in gap G1) | `SampleCreate.smear_type` | `diagnostic_tests.smear_type` | `test_pathology_slide_followup_and_reasons` (microscopy+both) | Partial → **Verified for new rule** (G1 tests) | was: UI-required + server-forbidden for SMP |
| p3 slide | Scheduled follow-up slides received? YES/NO | ChipPicker (`received`) | Yes / No | always | — | pattern `^(yes|no)$`, required (schema SlideFollowUpSave:164) | `SlideFollowUpSave.received` | `slide_followups.received` | `test_pathology_slide_followup_and_reasons` (received=no + reason) | Verified | — |
| p3 slide | Follow-up day slide positive? + which day | positivity chips + day chips | Yes / No; Day 1/3/7/14/28 | received=yes | day shown when positive | `positive` required when received; `positive_day` required when positive (main.py:1265–1267) | `SlideFollowUpSave.positive/positive_day` | `slide_followups.positive/positive_day` | same test (422 assertions) | Verified | — |
| p3 slide | Reason for not receipt + Other | reason chips + note | Patient not available / Left Goa / Refused / Slide broken-spoiled / Not collected by worker / Other | received=no | other⇒note (diagnostic.tsx:240) | reason required; `SLIDE_REASONS` enum; other⇒text (main.py:1269–1272) | `SlideFollowUpSave.not_received_reason/other_reason` | `slide_followups.not_received_reason/other_reason` | same test (422 assertions + 409 stale) | Verified | — |
| p3 slide (proto-day) | Scheduled day | day chips (`scheduled_day`) | Day 1/3/7/14/28 | always | — | string ≤20 | `SlideFollowUpSave.scheduled_day` | `slide_followups.scheduled_day` | same test | Verified | — |
| p3 slide | (due date — implied by scheduling) | **now `CalendarDatePickerField`** (gap G6) | picker | optional | valid ISO date | pattern only | `SlideFollowUpSave.due_date` | `slide_followups.due_date` | — | Partial → improved (G6) | was free-text with no format feedback |

### Pathologist summary

| Status | Count |
|---|---|
| Verified | 8 |
| Partial | 3 (patient identity matching; facility address; due-date field) |
| Missing | 0 |
| Ambiguous | 2 (SMP; microscopy-as-method) |
| Not Tested→fixed | 2 (SMP smoke, positive-species rule — added under G1/G4) |

---

## 3. Clinician / Medical Officer — pages 4–5 (`apps/mobile/app/assessment.tsx`, `AssessmentCreate`, `create_assessment`)

| Source | Question (faithful) | UI | Options | Conditional rule | Client validation | Server validation | API mapping | Persistence | Test evidence | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p4 admin | Name of the Medical Officer | `Field` ("Medical Officer Name") | free | always | — | ≤140 (schema:87) | `medical_officer_name` | `clinical_assessments.medical_officer_name` | `test_clinician_admission_conditional_flow` | Verified | — |
| p4 admin | Facility type + address (linked drop-downs) | staff facility ChipPicker + district badge | `/facilities` (UHC Panji, PHC Candolim, UHC Margao, PHC Cortalim per seed; source list §7) | always | — | must exist (main.py:1130/1133) | `facility_id` | `clinical_assessments.facility_id` | same test (fac-1) | Verified (link) / **Ambiguous** (address=district) | address not a full street address |
| p4 admin | Patient name + mobile (demographics linked to mobile) | **Find Worker** lookup + identity fields (implemented in this update); retains code/UUID entry | candidates list | always | patient required (assessment.tsx:207) | `db.get(Patient, body.patient_id)` — **PK-only; patient codes 404** (fixed in gap G2 → `resolve_patient`) | `AssessmentCreate.patient_id` | `clinical_assessments.patient_id` | workflow test used fixture PK; **G2 tests add code + UUID paths** | Partial → Verified for G2 | source wants name+mobile linkage — now supported via lookup |
| p4 q1 | Body temperature °C | numeric `Field` | 25.0–45.0 | always | 25–45 (assessment.tsx:210) | `ge=25 le=45` (schema:88) | `temperature_c` | row | same test | Verified | clinician bound differs from worker 30–45; source gives no range (documented) |
| p4 q2 | Duration of fever <24h / 1–3 / 4–7 / >7 | ChipPicker (`fever_duration_category`) | 4 categories | always | — | enum (schema:90); `fever_duration_days` 0–365 separate | `fever_duration_category` (+unused `fever_duration_days`) | row | — | Partial | numeric days not collected in UI (category only) — flag for owner |
| p4 q3 | Key symptoms multi + Others specify | MultiChipPicker + note (`symptoms`+`symptoms_other_note`) | Chills/rigors, Sweating, Headache, Nausea/vomiting, Abdominal pain, Joint/body aches, Weakness/fatigue, Other | note field when `other` selected | — | list ≤20; `symptoms_other_note` ≤200 (**new column**) | `symptoms[]`, `symptoms_other_note` | `clinical_assessments.symptoms_other_note` (migration 20261027_01) | **G2 tests add persistence assertions** | Partial → Verified (was Not Tested) | note also appended as `other: …` marker inside `symptoms` (documented choice) |
| p4 q4 | General condition stable / moderately ill / severe | ChipPicker | 3 values | always | — | string ≤80 | `general_condition` | row | — | Verified / Not Tested (no dedicated assert) | — |
| p4 q5 | Blood pressure (mmHg) | 2 numeric fields | 30–300 / 20–200 | always | bounds (assessment.tsx:216–223) | schema bounds (schema:99–100) | `systolic_bp`, `diastolic_bp` | row | — | Verified / Not Tested | — |
| p4 q6 | Co-morbidities: Diabetes / Hypertension / None / Other | MultiChip + note; `none` exclusive | 4 values | note when other | — | list ≤20 + free text ≤2000 | `comorbidities_list`, `comorbidities` | row | — | Verified / Not Tested | — |
| p4 q7 | Treatment prescribed | multiline `Field` (`treatment_documentation`) | free | always | — | ≤2000 | `treatment_documentation` | row | same test | Verified | no decision support (correct per PRD) |
| p5 q8 | Patient admitted? Yes/No | ChipPicker; blocks A/B swap | Yes / No | gates 8A vs 8B; other branch's data preserved | required (assessment.tsx:224) | free-text `admission_status` | `admission_status` (admitted/outpatient) | row | — | Verified / Not Tested | — |
| p5 8A | Species/diagnosis at admission + Other | chips + note | Pf / Pv / Mixed / Other | admitted=yes | — | `admission_species_other_note` ≤200 (**new column**) | `admission_species`, `admission_species_other_note` | migration column | **G2 tests** | Partial → Verified (was Not Tested) | — |
| p5 8A | Symptoms at admission (tick all) | MultiChip (10 source options + Other) | High fever…Bleeding, Other | admitted=yes | — | list ≤20 | `admission_symptoms[]` | row | — | Verified / Not Tested | — |
| p5 8A | Clinical severity: Mild / Severe malaria | ChipPicker | Mild Malaria / Severe Malaria | admitted=yes ⇒ required | required (assessment.tsx:228) | required when admitted (main.py:1128/1131) | `admission_severity` (`mild`/`severe`) | row | workflow test (severe) | Verified | — |
| p5 8A | Treatment completed: Yes / No-still-on-treatment / No-stopped-early / Referred District/GMC | ChipPicker | 4 source codes (+ legacy accepted) | admitted=yes | — | pattern w/ legacy codes (schema:113–114) | `treatment_completed` | row | workflow test (yes) | Verified | legacy codes retained for old clients |
| p5 8A | If not completed, reason | `Field` | free | shown+required for `no_still_on_treatment`, `no_stopped_early`, legacy `no` | required (assessment.tsx:231) | `_treatment_incomplete()` + reason check (main.py:1060, 1126/1135) | `treatment_incomplete_reason` | row | **G2 tests** | Partial → Verified (behavior was code-verified only; now tested) | — |
| p5 8A | Date of discharge / transfer | `CalendarDatePickerField` (no range) | picker | admitted=yes; optional | none | format-only (no chronology) | `discharge_date` | row | — | **Ambiguous** | chronology unspecified in source — deliberately unrestricted **pending owner confirmation** (per brief) |
| p5 8A | Outcome at discharge + Other | chips + note (`other: …` ≤100 marker) | Recovered / Improved OPD / Referred District-GMC / Other | admitted=yes | — | ≤100 | `outcome` | row | — | Verified / Not Tested | marker format is an implementation convention |
| p5 8A | Remarks | multiline | free | admitted / not-admitted both | — | ≤4000 | `remarks` | row | — | Verified / Not Tested | — |
| p5 8B | Treatment given? YES/NO | ChipPicker | Yes / No | admitted=no | — | pattern `^(yes|no)$` (schema:121) | `treatment_given` (**new column**, migration 20261027_01) | `clinical_assessments.treatment_given` | **G2 tests** | Partial → Verified (was Missing tests) | was: accepted+serialized but never tested |
| p5 8B | Health worker assigned for follow-up? YES/NO | ChipPicker (`follow_up_assigned`) | Yes / No | admitted=no | — | pattern `^(yes|no)$` (schema:122) | `follow_up_assigned` (**new col**) | `clinical_assessments.follow_up_assigned` | **G2 tests** | Partial → Verified (was Missing tests) | flag only; visits tracked on Follow-ups screen (existing) |
| — | Re-screen governance (SCR-009) | n/a (server) | — | already-screened worker ⇒ 403 for health_worker, 422 without reason for clinician | — | `is_rescreen` + reason (main.py:1112–1139) | `re_screening_reason` (schema:123; models.py:200) | row + audit + kafka | e2e live run (earlier phase) — no unit test | Partial | unit-level test **G2 tests**: reason enforced |

### Clinician summary

| Status | Count |
|---|---|
| Verified | 16 |
| Partial | 4 (identity lookup before G2; fever-days category-only; 8B fields now tested; re-screen reason) |
| Missing | 0 (code-resolution defect fixed as G2) |
| Ambiguous | 2 (facility address; discharge chronology) |
| Not Tested | 4 sub-rows (general condition, BP, comorbidities, outcome marker) |

---

## 4. Contractor — page 6 (`apps/mobile/app/sites.tsx`, `ReportedStatusIn`, `TravelEpisodeCreate`, `set_reported_status`, `add_travel`)

| Source | Question (faithful) | UI | Options | Conditional rule | Client validation | Server validation | API mapping | Persistence | Test evidence | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| p6 admin | Name of the contractor | read-only from session | — | always | — | `require_roles("contractor")` + `_assert_write_role` (main.py:887–888) | token identity | `assignments.reported_by_user_id` | `test_contractor_worker_linking_and_status` (direct call); auth-matrix row | Verified | — |
| p6 admin | Construction site (drop-down) | scope-limited site selector | authorized sites only | always | — | site scoping in listing/roster (main.py:373–379, 449) | n/a (pre-selected context) | — | `test_contractor_create_site_success_and_idempotency`, cross-isolation test | Verified | — |
| p6 admin | District / Area (drop-down option) | derived text from selected site record | derived | follows site | — | `SiteCreate.district/area` required at creation | sites table | row | creation tests | Verified | — |
| p6 admin | Patient name / mobile (linked to patient ID) | roster-tap → pre-filled worker identity; mobile number input removed (gap G7 — redundant free-text was never persisted) | roster members | roster shows authorized-site workers only | — | `require_patient_scope` + active-membership requirement (main.py:889–895) | path param | `worker_site_assignments` | QR/roster suites (#D); cross-contractor isolation | Verified | free "mobile-number dropdown" from source replaced by roster-linked identity (documented) |
| p6 q1 | Malaria diagnosis status: Pv / Pf / Pv+Pf / Other | reported-status modal + amber disclaimer "...not laboratory-confirmed... pending confirmation by a pathologist" | Pv, Pf, Pv+Pf, Other (+offered additions: Not Reported / None / Unknown) | always | — | pattern (schema:247); 409 stale-overwrite guard (schema:249) | `ReportedStatusIn.malaria_status` | `worker_site_assignments.reported_malaria_status` | direct-call test; warnings badges only; **never read by lab-confirmation logic** | Verified / Ambiguous | extra codes beyond source (not_reported/none/unknown) need owner sign-off; kept because roster badge defaults require them |
| p6 q2 | Treatment status: Treated / Untreated | ChipPicker | Treated / Untreated (+Not Reported / Unknown) | always | — | pattern (schema:248) | `ReportedStatusIn.treatment_status` | `worker_site_assignments.reported_treatment_status` | direct-call test | Verified / Ambiguous (extra codes as above) | — |
| p6 §I | Traveller planning to visit outside Goa (name/ID dropdown) | roster row "Record Travel" → modal with worker pre-filled | roster members | per-worker | — | worker scope enforced (`add_travel`:905–932: history unrestricted, planned requires departure+destination, departure ≥ today) | path param | `travel_events.patient_id` | — | Verified | — |
| p6 §I | Date of visit outside Goa | **`CalendarDatePickerField` now with `minISO=today`** (gap G3) | picker | required | past departure rejected client-side (G3) + server rule (G3, now incl. requiredness) | `planned && departure<today` ⇒ 422; planned episodes without departure/destination ⇒ 422 (main.py:914–927) | `TravelEpisodeCreate.departure_date` | `travel_events.departure_date` + `planned=true` | **G3 tests** (required→422, past→422, today/future→201; direct + HTTP) | Missing → Verified (G3) | departed-past rule was neither client- nor server-enforced; requiredness was client-only until remediation |
| p6 §I | Date of return inside Goa | picker `minISO=departure` | picker | optional; ≥ departure | order check | order check 422 (main.py:930–931) | `return_date` | `travel_events.return_date` | **G3 test** (reversed → 422) | Verified (tested now) | — |
| p6 §I | Place(s)/state(s) visited | `Field` required | free | required | required (sites.tsx:349) | required client-side; **server now also rejects planned episodes without a destination** (main.py:919–921) | `TravelEpisodeCreate.destination` | `travel_events.destination` | **G3 remediation tests** (missing destination → 422 direct + HTTP) | Partial → **Verified** (G3 requiredness) | was: requiredness client-only; **resolved in the remediation phase** |
| — | Reported ≠ laboratory-confirmed | disclaimer text; stored in separate channel from lab results | — | always | — | no code path links `reported_*` to `DiagnosticTest` | separate tables | — | privacy suite 60/60 (earlier phase) | Verified | — |
| — | Role authorization isolation | n/a | — | — | — | 403/404 out-of-scope | — | — | `test_contractor_site_isolation`, auth matrix | Verified | — |

### Contractor summary

| Status | Count |
|---|---|
| Verified | 10 |
| Partial | 0 |
| Missing | 0 (departure rule + planned-travel requiredness fixed as G3) |
| Ambiguous | 2 (extra status codes; roster‑identity vs mobile "dropdown") |
| Not Tested→fixed | travel rule set (G3, incl. server-side requiredness) |

---

## 5. Cross-cutting requirements (validated across forms)

| Requirement | Evidence | Status |
|---|---|---|
| DOB range dynamic from today (90y) both sides | `dob_boundaries` / `dobMinISO` tests | Verified |
| Leap-day + local-tz handling | `add_calendar_years` clamp tests, local-`Date` formatting tests | Verified |
| Age in completed years | `test_age_in_completed_years_semantics` (+ mobile) | Verified |
| Future dates blocked for historical events only | onset (`maxISO=today`, future rejected); planned travel allows future (probe: future departure 201); doctest `test_onset_date_cannot_be_in_the_future` | Verified |
| Return ≥ departure (both forms) | intake test + G3 probe/test | Verified |
| Discharge chronology | unrestricted both sides — **requires owner confirmation** | Ambiguous |
| Reported vs lab-confirmed separation | separate tables/channels + UI disclaimer + privacy suite | Verified |
| Offline drafts & idempotent retries | 11 offline-cache PASS + backend replay/idempotency tests | Verified |
| Research Lab / Admin permissions unchanged | auth-matrix unchanged; no permission code touched by gap fixes | Verified |
| No reset of shared DB / volumes | all test runs used disposable SQLite/PG databases; volume untouched | Verified |

### Overall counts (before gap implementation)

| Form | Verified | Partial | Missing | Ambiguous | Not Tested |
|---|---|---|---|---|---|
| Worker | 33 | 0 | 0 | 3 | 2 |
| Pathologist | 8 | 3 | 0 | 2 | 2 |
| Clinician | 16 | 4 | 0 | 2 | 4 |
| Contractor | 8 | 1 | 1 | 2 | 1 |

(Confirmed gaps G1–G7 are implemented in Phase B; the remediation phase then
added the server-side planned-travel requiredness (departure + destination)
and HTTP-level regression tests. See `docs/QUESTIONNAIRE_GAP_IMPLEMENTATION.md`
for before/after and exact test evidence.)
