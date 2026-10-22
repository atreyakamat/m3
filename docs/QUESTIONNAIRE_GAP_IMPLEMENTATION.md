# Questionnaire Gap Implementation — confirmed fixes G1–G7

Companion to `docs/QUESTIONNAIRE_AUDIT_MATRIX.md`. This document lists every
confirmed gap from the 1 Sept 2026 questionnaire audit, the fix that was
implemented, and the evidence that it now behaves as specified. Ambiguities
that were deliberately **not** resolved (pending owner approval) are listed at
the end.

Scope guards honoured throughout:

- Additive/backend-compatible only — **no migration was needed**; all gaps are
  validation/logic defects, not schema-expressiveness deficits. The only new
  migration remains the pre-existing `20261027_01_assessment_source_fields`.
- No existing requirement was changed; Research Lab / Admin permissions are
  untouched; the running stack was not rebuilt or disturbed.
- SMP is preserved as the literal source option — no meaning was invented.

---

## G1 — SMP samples could never carry a smear type (High, contradiction)

**Confirmed defect (before).** The worker/intake-end UI required a smear type
for microscopy **and SMP**, but `create_sample` only accepted
`smear_type` for `method == "microscopy"`; a valid SMP submission was rejected
with `422 "Smear type applies only to microscopy or smear tests"`.

**Fix.** `services/api/app/main.py` (`create_sample`):

```python
if body.smear_type and body.smear_type != "not_applicable" and body.method not in ("microscopy", "smp"):
    raise HTTPException(422, "Smear type applies only to microscopy or smear tests")
```

The source asks "Type of Smear read" under the slide-based methods; SMP keeps
its literal meaning — only the contradiction with the client rule was removed.

**Evidence.** Pre-fix probe: `SMP+smear -> 422`. Post-fix probe:
`sample SMP -> 201`. Tests: `test_questionnaire_gaps.py::test_sample_smear_type_accepted_for_smp_and_microscopy`
(smp/thin, smp/both, microscopy/thick) and `::test_sample_smear_type_still_rejected_for_rdt`
(the 422 boundary stays), plus the remediation-phase HTTP-level
`::test_samples_http_smear_rules_for_rdt_microscopy_smp`
(SMP both → 201 and microscopy thick → 201 over the real API; RDT with a
smear type → 422; an invalid smear *value* → 422 from the schema enum).

## G2 — Clinician assessment rejected the patient code shown in the UI (High)

**Confirmed defect (before).** `create_assessment` did `db.get(Patient,
body.patient_id)` — a PRIMARY-KEY-only lookup. The UI submits the patient
**code** (e.g. `M3-P100`), so real clinician submissions got
`404 "Patient record not found"` while a bare UUID worked. Pre-fix probe:
`assessment by CODE -> 404 / by UUID -> 201`.

**Fix.** `main.py` (`create_assessment`) uses the shared resolver:

```python
patient = resolve_patient(db, body.patient_id)   # accepts code or UUID
```

The 404/403 ordering of the original role matrix is preserved
(non-clinicians still get 403 on unknown ids). Additionally, the source's
"Patient Name / Mobile Number — Demographic Details: Linked to Mobile Number"
requirement is now supported on both clinical forms through the new shared
`apps/mobile/components/WorkerLookupField.tsx`: it searches the role-scoped
`GET /workers?q=` endpoint by mobile number or name and links the selected
authoritative record; manual code/UUID entry remains as an offline fallback.
Wired into `app/assessment.tsx` (replaces the free-text code field) and
`app/diagnostic.tsx` (replaces the three manual identity fields; the typed
name/mobile still feed the pathology identity-trail note via
`onIdentityChange`).

**Evidence.** Post-fix probe: `assessment by CODE -> 201 / by UUID -> 201`.
Tests: `test_assessment_accepts_patient_code_and_uuid` (code path + UUID path,
including the authorized re-screen reason for the second encounter on the same
worker), `test_assessment_unknown_patient_404` (unknown code still 404),
`test_assessment_new_source_columns_persisted_and_serialized` (new
`symptoms_other_note` / `treatment_given` / `follow_up_assigned` columns
persist and serialize), `test_assessment_admitted_other_species_note_persisted`.
Remediation-phase HTTP tests over the real ASGI app:
`test_assessment_http_identity_paths` — submission by worker code → 201, by
UUID → 201 (with the re-screen reason), unknown identifier → 404, worker-role
token → 403 (unauthorized identity is rejected without record disclosure).

## G3 — Planned travel allowed a past departure date (Medium, rule not enforced)

**Confirmed defect (before).** The intake form rejected a planned departure in
the past (`questionnaire.validate` + client `minISO`), but the contractor
`/travel` endpoint (`add_travel`) did not. Pre-fix probe:
`travel PAST departure (planned) -> 201`.

**Fix.**

- Server (`main.py`, `add_travel`, remediation phase): when `planned` is true
  an episode must carry a **departure date and a destination**
  (`422 "Departure date is required for planned travel"`,
  `422 "Destination is required for planned travel"` — reflecting the sites.tsx
  travel modal, which has always required both), and a departure before today
  is rejected: `422 "Planned departure date cannot be in the past"`.
  Historical trips (`planned=False`, e.g. arrival into Goa) stay COMPLETELY
  unrestricted — no departure, destination, or date order is required, and the
  `planned=true` requiredness applies to nothing historical. No schema change
  was needed: the fields stay optional on `TravelEpisodeCreate` because the
  requiredness is conditional on `planned`, which a schema-level constraint
  cannot express per-call.
- Client (`apps/mobile/app/sites.tsx`, earlier phase): the contractor modal's
  departure picker gets `minISO={todayISO()}` and `handleSaveTravel`
  validates departure present, departure ≥ today, return ≥ departure, and
  destination present before sending.

The return-after-departure rule was already enforced; tests were added to
lock it. Discharge-date chronology (clinician form) was **not** touched —
see ambiguities.

**Evidence.** Post-fix probe: `travel PAST departure -> 422` /
`FUTURE departure -> 201` (requiredness remediation updates this probe case:
`NO dates -> 422`, complete episodes only). Tests
(`tests/test_questionnaire_gaps.py`): requiredness
`test_travel_planned_requires_departure`,
`test_travel_planned_requires_destination`; order/historical
`test_travel_planned_departure_cannot_be_in_the_past`,
`test_travel_planned_departure_today_is_allowed` (today is allowed),
`test_travel_historical_dates_stay_allowed_when_not_planned`,
`test_travel_return_before_departure_rejected`, and the true-HTTP-path
`test_travel_planned_past_departure_rejected_over_http`
plus, from the remediation phase,
`test_travel_planned_requiredness_and_history_over_http`
(missing departure → 422, missing destination → 422, valid future → 201,
historical without dates → 201 over the real API).

## G4 — Positive results accepted without a species (Medium, data correctness)

**Confirmed defect (before).** A sample with `result_status="positive"` and no
species was accepted (`201`), producing an unattributed positive result.
Pre-fix probe: `RDT POSITIVE without species -> 201`.

**Fix.** `main.py` (`create_sample`):

```python
if body.result_status == "positive" and not body.species:
    raise HTTPException(422, "Species is required when the result is positive")
```

This mirrors the client rule (species block becomes required when a positive
result is selected). The species **vocabulary** is enforced server-side by the
pre-existing `SampleCreate` validator — `species_value` rejects anything
outside `SPECIES = {pf, pv, mixed, other, undetermined}`
(`schemas.py:149–153`; same enum as the client's zod schema and analytics'
`KNOWN_SPECIES`) — verified over HTTP in the remediation phase: unsupported
values are rejected, never persisted. No species is ever inferred, and no new
clinical category was invented; theOther-species note requirement is preserved
(`main.py:1197`, client `diagnostic.tsx:136-137`).

**Evidence.** Remediating HTTP-level tests (`tests/test_questionnaire_gaps.py`,
real ASGI app): `test_samples_http_positive_species_rules` —
positive without species → 422 `"Species is required"`, unsupported species
`"xyz"` → 422 `"Unsupported species"`, RDT positive + `pv` → 201, microscopy
positive + `pf` + smear → 201, negative without species → 201 (species not
required for non-positive results, the intended behavior);
`test_samples_http_smear_rules_for_rdt_microscopy_smp` — RDT with a smear
type → 422, invalid smear value → 422, valid SMP/microscopy with smears → 201.
Client-side tests already cover the enum at the form edge.

## G5 — Documentation over-claims (Low)

**Confirmed defect (before).** `docs/QUESTIONNAIRE_UPDATE_2026-10-22.md`
claimed the contractor travel "departure ≥ today" was a **server** rule (it
was client-only at the time), and reported the backend count as
"133 passed" without noting that the PostgreSQL-rehearsal test is skipped
unless `M3_TEST_DATABASE_URL` is supplied.

**Fix.** Both statements were corrected in place (travel row now states the
rule was client-only at the time and points to gap G3; the test table states
**132 passed, 1 skipped** for the default run and **133 passed, 0 skipped**
with the disposable PG URL).

## G6 — Pathology slide "Due Date" was a free-text field (Low, usability)

**Confirmed defect (before).** The slide follow-up due date was collected in a
plain text field with no format feedback, while every other date in the
questionnaire uses the calendar picker with ISO normalization.

**Fix.** `app/diagnostic.tsx` now uses `CalendarDatePickerField` (optional, no
range constraints — due dates are scheduling metadata, not historical-event or
planned-travel fields, so no chronology rule is invented). The API's accepted
format (`^\d{4}-\d{2}-\d{2}$`, `schemas.py:163`) matches the picker output.

**Evidence.** HTTP regression test from the remediation phase:
`test_slide_followup_due_date_format_over_http` — a bad format `01/11/2026`
is rejected with 422 (schema pattern), a valid ISO date is accepted with 200.
No chronology restriction exists server-side, matching the client picker
(which imposes none).

## G7 — Contractor travel modal collected a mobile number that was never used (Low)

**Confirmed defect (before).** The modal had a free "Worker Mobile Number (if
known)" input whose value was never sent, validated, or stored.

**Fix.** Removed from `app/sites.tsx`. The source asks for a roster-linked
worker identity ("Mobile number (Name/ID) Drop down list"), which the modal
already satisfies via the pre-filled roster identity
(`display_name (patient_code)`); the redundant free text invited data entry
that silently went nowhere.

**Evidence.** `npm run typecheck` clean after removal (a leftover
`setTravelMobile` call in the roster-row reset block was caught and fixed).

---

## Before / after status (audit-matrix summary)

| Form | Before | After (this update) |
|---|---|---|
| Worker | 33 Verified, 0 Partial, 0 Missing, 3 Ambiguous | Unchanged — no worker-form gap was confirmed; **stale-hidden-field tolerance now documented with a test** |
| Pathologist | 8 Verified, 3 Partial, 0 Missing, 2 Ambiguous | G1, G4 fixed and tested; G6 improved; **11 Verified** (SMP smoke + positive-species rows moved to Verified), 1 Partial (facility address — ambiguity), 2 Ambiguous (SMP, microscopy-as-method) |
| Clinician | 16 Verified, 4 Partial, 1 Missing (code resolution), 2 Ambiguous, 4 Not Tested | G2 fixed and tested; identity lookup added; **19 Verified** (code resolution, new-column persistence, incomplete-treatment reason all now tested), 2 Partial, 2 Ambiguous |
| Contractor | 8 Verified, 1 Partial (destination), 1 Missing (departure rule) | G3 fixed and tested (incl. server-side planned requiredness from the remediation phase); G7 cleaned; **10 Verified**, 0 Partial, 2 Ambiguous |

## Test commands and exact results

| Suite | Command | Result |
|---|---|---|
| Backend, disposable SQLite | `docker compose run --rm --no-deps -v $PWD:/home/atreya/Work/m3 -w /home/atreya/Work/m3/services/api -e DATABASE_URL='sqlite:////tmp/test_full_m3.db' api sh -c 'PYTHONPATH=. python -m pytest tests/ -q -p no:cacheprovider'` | **146 passed, 1 skipped** (skip = PG-rehearsal test; baseline before this change was **132 passed, 1 skipped** — the +14 are `tests/test_questionnaire_gaps.py`) |
| Backend, disposable PostgreSQL (rehearsal + migration exercised) | same with `-e DATABASE_URL='postgresql+psycopg://m3_compose_user:***@db:5432/m3_audit_pytest_gap'` | **147 passed, 0 skipped** (disposable DB created and dropped; shared `m3_compose_dev` DB untouched) |
| Gap file alone | `pytest tests/test_questionnaire_gaps.py -q` | **14 passed** (plus **7 remediation HTTP tests**, together **21 passed**) |
| Backend, disposable SQLite (after remediation) | `pytest tests/ -q` (`DATABASE_URL='sqlite:////tmp/test_full_m3.db'` in docker) | **153 passed, 1 skipped** (146 + 7 remediation HTTP tests; skip = PG-rehearsal test) |
| Backend, disposable PostgreSQL (after remediation) | same with `-e DATABASE_URL='postgresql+psycopg://m3_compose_user:***@db:5432/m3_remediation_pytest'` | **154 passed, 0 skipped** (the +1 vs SQLite is the PG-rehearsal test; disposable DB created and dropped; shared `m3_compose_dev` DB untouched — 49 patients before and after) |
| Mobile typecheck | `npm run typecheck` (`tsc --noEmit`) | **0 errors** |
| Mobile lint (changed files) | `eslint app/sites.tsx app/assessment.tsx app/diagnostic.tsx components/WorkerLookupField.tsx` | **0 errors, 0 warnings** |
| Live probe (throwaway container, fresh DB) | `python /probe/audit_probe.py` | CODE→201, UUID→201, planned-past→422, future→201, reversed→422, planned-no-dates→422 "Departure date is required", planned-no-destination→422 "Destination is required", historical-no-dates→201, SMP→201, positive-no-species→422 |

Failure history (honest record): one intermediate full-suite run failed
`test_workflows.py::test_clinician_admission_conditional_flow` because the
first draft of the assessment tests used the shared `patient-1` fixture,
marking the worker screened (SCR-009) for later suites; the tests were moved
to their own dedicated workers and the full suite was re-run fully green.

## Remaining ambiguities requiring owner approval (not resolved here)

1. **SMP** — remains a literal source option; its meaning (slide method?
   screening programme? typo?) is unresolved. It is accepted end-to-end but no
   clinical semantics were invented.
2. **Discharge chronology** — the source does not specify an ordering rule for
   discharge/transfer date. Deliberately left unrestricted on both sides
   (request brief: confirm with the owner first).
3. **"Not informed / Don't know"** in source page 2 renders as a single
   combined box; the implementation keeps two codes (`not_informed`,
   `dont_know`). Merge or keep — owner's choice.
4. **Onset-of-illness requiredness under fever "not sure"** is implicit
   (required when a specific symptom is ticked, optional for `not_sure`
   alone). Needs sign-off.
5. **Facility address** — the drop-down selects a facility; address is
   represented by district only. Providing full addresses per facility needs
   owner data.
6. **Contractor reported-status codes** beyond the source (Not Reported / None
   / Unknown) exist because roster badges need a default state — confirm or
   trim.
7. ~~**Contractor travel destination** requiredness is client-only~~
   **RESOLVED in the remediation phase**: the server now rejects planned
   episodes without departure or destination (historical `planned=False`
   episodes intentionally accept a bare origin for records like arrival into
   Goa), with direct + HTTP regression tests.
8. **Age mismatch handling** — questionnaire submits reject (422) while
   `/workers` registration flags (`age_flagged=True`). One semantics should
   be chosen.
9. **Clinician temperature range 25–45 vs worker 30–45** — the source gives no
   numeric range; the differing bounds were pre-existing and left untouched.
