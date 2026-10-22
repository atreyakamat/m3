# Questionnaire Update — 1 Sept 2026 source document

Implemented 22 Oct 2026. Source: `Questionnaire Updated 1 Sept 2026.docx`
(worker PERFORMA + Pathology, Clinician and Contractor questionnaires).
No commits were made; all work is in the uncommitted working tree.

Design constraints honoured throughout: existing teal/blue design system,
existing role permissions and API contracts, offline draft/outbox behavior,
idempotent intake submission (`client_request_id`), read-only/no-delete DB
policy (migrations are additive only).

---

## 1. Worker questionnaire (mobile intake, 5 sections)

DOB rule (client `src/dateFields.ts` + server `app/questionnaire.py`, identical
semantics on both sides):

- Primary interaction is a calendar date picker (`components/CalendarDatePickerField.tsx`);
  no manual typing as the primary path.
- Allowed range computed at runtime: `[today − 90 calendar years, today]`.
- No future dates. Lower boundary is inclusive today−90y (Feb 29 → Feb 28 clamp),
  upper boundary inclusive today. Leap-day-safe.
- `personal.dob` stored ISO `YYYY-MM-DD` (local calendar, not UTC-derived).
- Age auto-computed in completed years; shown live and on the review step.
- Legacy fallback: if the user does not know their DOB, the form keeps the
  manual-age path (`personal.dob_unknown: 'yes'|'no'`, kept in app state only,
  never sent to the server).

| Source (page/question) | Mobile UI | Backend field / API | Validation & conditionals |
|---|---|---|---|
| Page 1 · Full name (as per ID) | Intake step 1 text field | `personal.full_name` → `POST /questionnaire/{patient_id}` | req., max 140 |
| Page 1 · Date of birth (with age in completed years) | Calendar picker + auto-age + "Do you know your DOB?" toggle fallback | `personal.dob` (server derives/validates age from DOB first) | Range/min/max/leap rules above. If age also supplied, must equal `ageInCompletedYears(dob)` else rejected (`personal.age_years`) |
| Page 1 · Gender M/F | Chip picker | `personal.gender` | required |
| Page 1 · Mobile number | Numeric field | `personal.mobile` → `POST /workers` | E.164-normalised |
| Page 1 · Alternate contact (opt.) | Text field | `personal.alternate_contact` | optional |
| Page 1 · Gov ID type (Aadhaar / Voter ID / Other) | Chip picker + "other" note | `personal.id_type`, `personal.id_other_details` | other → note req. |
| Page 1 · Present / permanent address | Text fields | `personal.address_present`, `personal.address_permanent` | req. / req. |
| Page 1 · Preferred app language | Chip picker | `personal.preferred_language` | required |
| Page 2 · Diagnosed with malaria? Y/N/Don't know | Chip picker | `past_history.diagnosed_malaria` | gates sections below |
| Page 2 · How many times in last 2 years | Stepper/numeric | conditional child of diagnosed=yes | see existing Section II chain |
| Page 2 · Date of last detection (≤1y / 1–2y / Don't know) | Chip picker | `past_history.last_detection` | conditional |
| Page 2 · Place of treatment (UHC/PHC, private, govt, pharmacy, other) | Chip picker + note | `past_history.treatment_place`, `past_history.treatment_place_other` | conditional; other→note |
| Page 2 · Diagnosis test performed? Y/N | Chip picker | `past_history.diagnostic_test_performed` | conditional |
| Page 2 · Report same day? Y/N | Chip picker | `past_history.same_day_report` | conditional |
| Page 2 · RDT / Microscopy / Not sure | Chip picker | `past_history.test_method` | conditional |
| Page 2 · Medication period (3 / 14 / 28 / uninformed) | Chip picker | `past_history.medication_period` | conditional |
| Page 2 · Full course completed? Y/N/Not sure | Chip picker | `past_history.full_course_completed` | conditional |
| Page 2 · Mobile brand (new) | Text | `past_history.mobile_brand` (≤60) | optional; not gated by diagnosed (validated before early return) |
| Page 2 · Qualification (new) | Text | `past_history.qualification` (≤120) | optional; not gated |
| Page 2 · Repellent Yes/No (new) | Chip picker | `past_history.repellent_use` | Y/N only |
| Page 2 · Mosquito net Yes/No (new) | Chip picker | `past_history.mosquito_net_use` | Y/N only |
| Page 3 · Fever today? Y/N/Not sure | Chip picker | `present_clinical.fever_today` | required |
| Page 3 · Measured temperature if known | Numeric (shown only when fever_today ∈ {yes, not_sure}) | `present_clinical.temperature_c` | 30.0–45.0 °C |
| Page 3 · Fever duration | Chip picker | `present_clinical.fever_duration` | required when fever=yes/not_sure |
| Page 3 · Associated symptoms (multi) | Chip multi-select | `present_clinical.symptoms` | mutually exclusive with "no other symptoms" |
| Page 3 · Time of onset of current illness (date) | Calendar picker | `present_clinical.onset_date` | required when fever=yes **or** specific symptoms present; never in the future |
| Page 3 · Breathing difficulty / chest pain / confusion? | Chip picker (grouped as danger signs) | `present_clinical.breathing_difficulty`, `.chest_pain`, `.confusion` | Y/N each; maps the single source line into 3 explicit booleans (screening red-flag contract already uses these codes) |
| Page 3 · Can attend testing today? Y/N/Not required | Chip picker | `present_clinical.can_attend_testing` | required |
| Page 4 · How long in Goa | Chip picker | `migration_history.time_in_goa` | required |
| Page 4 · Travelled outside Goa last 3 months? Y/N | Chip picker | `migration_history.outside_goa_3m` | required; gates next Q |
| Page 4 · States visited | Text | `migration_history.states_visited` | conditional |
| Page 4 · Duration of last stay in home state | Chip picker | `migration_history.last_stay_home_state` | conditional |
| Page 4 · Fever/malaria in last 3 months before Goa? Y/N/DK | Chip picker | `migration_history.fever_before_goa` | required |
| Page 5 · Planning to visit outside Goa? Y/N | Chip picker | `planned_travel.planning` | required; gates episodes |
| Page 5 · Date of departure out of Goa | Calendar picker (future allowed) | `planned_travel.episodes[].departure_date` | **must be ≥ today** (server + client) |
| Page 5 · Date of return into Goa | Calendar picker | `planned_travel.episodes[].return_date` | return ≥ departure (server + client) |
| Page 5 · Place(s)/state(s) to visit | Text | `planned_travel.episodes[].destination` | conditional |
| Page 5 · Fever/malaria during that travel? Y/N | Chip picker | `planned_travel.episodes[].fever_or_malaria` | conditional |
| Page 5 · Treatment given? Y/N | Chip picker | `planned_travel.episodes[].treatment_given` | nested conditional |
| Page 5 · Full course completed? Y/N | Chip picker | `planned_travel.episodes[].treatment_completed` | nested conditional |
| Page 5 · Place of treatment | Text | `planned_travel.episodes[].treatment_place` | conditional |

Offline/idempotency: drafts saved locally with a visible "Draft saved HH:MM"
badge and a deliberate Discard action (confirmation alert); submission uses the
existing `client_request_id` + pending-id lifecycle, so offline retries and
repeated taps cannot create duplicates. Success banner appears only after the
server acks (or the ack is replayed from the outbox).

## 2. Pathologist questionnaire (`app/diagnostic.tsx`, page 3)

| Source (page 3 / question) | Mobile UI | Backend field / API | Validation & conditionals |
|---|---|---|---|
| Name of the pathologist | Auto from signed-in user + shown read-only | user identity from token | not manually editable |
| Facility name (drop-down) | Facility picker (from `GET /facilities` — PRD §7 approved list) | `facility_id` on `POST /samples` | must reference an existing facility |
| Address (drop-down, linked) | Auto-filled from selected facility | derived server-side / display only | read-only, follows facility |
| Patient name + mobile | Lookup fields (finds worker profile) | patient resolution (`name` + `mobile_e164` match) | worker must exist |
| Test done? RDT / SMP / Other | Chip picker, conditional results block per choice | sample/test rows (`test_type`, `test_result`, `species`, `slide insights`) | **"SMP" is unresolved — see §6** |
| RDT result: neg/pos + species | Chip pickers | RDT result fields | conditional on RDT |
| Microscopy result: neg/pos + species | Chip pickers | microscopy result fields | conditional on microscopy |
| Type of smear read: Thick/Thin/Both | Chip picker | smear-type field | required when microscopy chosen |
| Scheduled follow-up slides received? Y/N | Chip picker | follow-up slide fields (received, positive day, reason) | yes → day + positive flag; no → reason (`patient_not_available / left_goa / refused / slide_spoiled / not_collected / other`) |
| Reason for non-receipt of slide | Chip picker | reason field | conditional; other → note |

Other-method free text is kept in test notes (≤ clinically harmless length);
identity trail (patient name/mobile) repeated in notes is preserved.

These screens are online-only by design (matching current diagnostic flow);
drafts/outbox do not apply.

## 3. Clinician questionnaire (`app/assessment.tsx`, pages 4–5)

| Source (page 4–5 / question) | Mobile UI | Backend field / API (`POST /assessments`) | Validation & conditionals |
|---|---|---|---|
| Name of the Medical Officer | Text (prefilled user name) | `medical_officer_name` (≤140) | editable |
| Facility type + address (drop-down) | Single facility picker covering the PRD list: UHC Panji, PHC Candolim, UHC Margao, PHC Cortalim | `facility_id` | referenced facility must exist |
| Patient name + mobile | Lookup fields | patient resolution | worker must exist |
| 1. Body temperature °C | Numeric | `temperature_c` (25–45) | optional |
| 2. Duration of fever (<24h, 1–3, 4–7, >7) | Chip picker | `fever_duration_category` (+ `fever_duration_days` numeric when known) | category enum |
| 3. Key symptoms (multi + Others specify) | Multi-select + severity note | `symptoms[]`, `symptoms_other_note` (≤200, **new column**) | other-note appended as `other: <note>` marker; normalised max 120 |
| 4. General condition (stable/moderately ill/severe) | Chip picker | `general_condition` | enum |
| 5. Blood pressure | Two numeric fields | `systolic_bp`, `diastolic_bp` (30–300 / 20–200) | mmHg |
| 6. Co-morbidities (diabetes, hypertension, none, other) | Multi-select | `comorbidities_list` (+ `comorbidities` free text for "other/more detail") | "none" exclusive |
| 7. Treatment prescribed | Text | `treatment_documentation` (≤2000) | documentation only; no decision support |
| 8. Patient admitted? Y/N | Chip picker | `admission_status` | gates A vs B blocks; blocks switch without wiping the other block's data |
| 8A. Species/diagnosis at admission (+Other) | Chip picker + note | `admission_species`, `admission_species_other_note` (≤200, **new column**) | required when admitted |
| 8A. Symptoms at admission (tick all) | Multi-select (High fever, Chills/rigors, Severe headache, Vomiting, Abdominal pain, Breathlessness/chest pain, Confusion, Severe weakness, Jaundice, Bleeding, Other) | `admission_symptoms[]` (+ other note) | multi-select |
| 8A. Clinical severity (Mild/Severe malaria) | Chip picker | `admission_severity` (`mild`=severe) | required when admitted |
| 8A. Treatment completed (4 codes) | Chip picker | `treatment_completed`: `yes` full course / `no_still_on_treatment` / `no_stopped_early` / `referred_district_gmc` (legacy `no`→stopped-early semantic kept for old clients) | widened server pattern |
| 8A. If not completed, reason | Text | `treatment_incomplete_reason` | required for `no_still_on_treatment`, `no_stopped_early` (and legacy `no`); helper `_treatment_incomplete()` |
| 8A. Date of discharge/transfer | Calendar picker | `discharge_date` | chronological restriction deliberately NOT enforced — see §6 |
| 8A. Outcome at discharge | Chip picker (+other note) | `outcome` (+ `other: <note>` ≤100) | enum |
| 8A. Remarks | Text | `remarks` | free text |
| 8B. Treatment given? Y/N | Chip picker | `treatment_given` (**new column**) | when not admitted |
| 8B. Health-worker follow-up assigned? Y/N | Chip picker | `follow_up_assigned` (**new column**) | when not admitted |

## 4. Contractor questionnaire (`app/sites.tsx`, page 6)

| Source (page 6 / question) | Mobile UI | Backend field / API | Validation & conditionals |
|---|---|---|---|
| Name of the contractor | Auto from signed-in user | user identity | read-only |
| Construction site (drop-down) | Site picker (contractor-scoped) | site-scoped endpoints / workers roster | contractee scope enforced server-side |
| District / Area (drop-downs) | Derived from site record | derived | display only |
| Patient name + mobile | Existing roster-tap flow (no separate identity creation) | `POST reported-status` on existing worker | no duplicate/unlinked profiles are merged or created |
| 1. Malaria diagnosis status (Pv/Pf/Pv+Pf/Other) | Chip picker in reported-status modal | `malaria_status` on `POST /workers/{id}/reported-status` | **self-reported by the contractor; labelled and stored as reported, not laboratory-confirmed** — pending confirmation by pathologist. No clinical data (notes, symptoms, vitals) is exposed on this screen |
| 2. Treatment status (treated/untreated) | Chip picker | `treatment_status` | same reported-not-confirmed caveat |
| Section I · Travel details: traveller (drop-down of roster), dates out of / into Goa, onward destination | "Record Travel" button per roster row → modal with worker pick + 2 calendar pickers + destination | `POST /workers/{id}/travel` with `origin: 'Goa'`, `destination`, `departure_date`, `return_date?`, `planned: true` | return ≥ departure (server rule, shared semantics); **departure ≥ today was enforced on the CLIENT only at the time of writing** — server-side enforcement was added as gap G3 (see `docs/QUESTIONNAIRE_GAP_IMPLEMENTATION.md`); statuses read back as planned-travel, not diagnoses |

## 5. Database / migration

`alembic/versions/20261027_01_assessment_source_fields.py` (rev `20261027_01`,
down `20261026_01`) — additive only, no column renames/drops, no data writes:

- `clinical_assessments.symptoms_other_note` String nullable
- `clinical_assessments.admission_species_other_note` String nullable
- `clinical_assessments.treatment_given` String nullable
- `clinical_assessments.follow_up_assigned` String nullable

All four nullable so old clients and queued old payloads keep working
(backwards compatible). Applied and verified against the live PostgreSQL dev
instance (columns confirmed; Postgres volume untouched otherwise).

## 6. Ambiguities & open items (flagged, not guessed)

1. **"SMP" is unresolved.** Page 3 offers "RDT / SMP / Other". "SMP" is not a
   standard malaria-test abbreviation and could mean *smear/ microscopy
   procedure*, *slide microscopy positive reading*, or something
   site-specific. Implemented literally as a distinct test option with its own
   conditional result block; needs clarification from the document owner
   before the label is finalised.
2. **Discharge / transfer date chronology.** The source gives no rule about the
   discharge/transfer date relative to admission or onset. Left unrestricted
   (client + server) so clinical exit dates are never falsely rejected;
   documented rather than guessed.
3. **Breathing/chest/confusion line.** A single source line maps to three
   separate red-flag booleans; kept compatible with existing red-flag wording.
4. **Contractor-reported status ≠ laboratory confirmation.** Contractor
   "pv/pf/other" statuses are self-declared; the UI explicitly states they are
   contractor-reported and pending lab confirmation, and the value is stored
   in the reported-status channel — never used to satisfy lab-confirmation
   logic.
5. **Clinician detail exposure by contractor role.** Section 8 treatment
   specifics are visible only to clinician/admin scoped roles; the contractor
   surface receives minimal operational fields only (privacy verified live).
6. **E2E regression script vs. single-screening rule** (pre-existing, not from
   this change): `scripts/verify_e2e_lan.py` created an assessment without
   `re_screening_reason` although the intake questionnaire stamps
   `screening_completed=True`, so the server legitimately returns 422. The
   script now supplies a re-screening reason so it matches current intended
   behaviour (verified: the failure reproduces identically on the pre-change
   HEAD code build).
7. **Running Docker API is stale**: the `m3-compose-api` container is ~28h old
   and serves the pre-change code until `docker compose build api && docker
   compose up -d api` is run. All live verification below was done by running
   the new code in a throwaway container against throw-away databases; the
   running stack was not rebuilt or disturbed.

## 7. Regression results (exact counts)

| Suite | Command | Result |
|---|---|---|
| Backend pytest (SQLite) | `pytest tests/ -q` in docker | **132 passed, 1 skipped, 0 failed** (the skip is `test_postgres_legacy_upgrade_rehearsal`, which runs only when `M3_TEST_DATABASE_URL` points at a disposable PostgreSQL database — with it supplied the full suite is **133 passed, 0 skipped**) |
| Mobile date logic | `npm run test` (`node --test`) | **12 passed, 0 failed** |
| Mobile typecheck | `tsc --noEmit` | **0 errors** |
| Mobile lint (changed files) | `eslint` | **0 errors, 0 warnings** |
| E2E LAN surveillance | `verify_e2e_lan.py` (throwaway container + fresh DB) | **40 PASS, 0 FAIL** (after script fix in §6.6) |
| Contractor & QR regression | `verify_contractor_lan_qr.py` (throwaway container + fresh DB) | **11/11 steps passed** |
| Privacy / notification live | `verify_privacy_live.py` (throwaway container + fresh DB) | **60/60 checks passed** |
| Offline SQLite cache spec | `verify_offline_cache.py` | **ALL PASS** |

Fixture hygiene: every throwaway verification database (`m3_verify_tmp`,
`m3_verify_head`) was dropped; the temporary verification containers were
removed. No test artifacts remain in the repo. Nothing has been committed or
pushed.
