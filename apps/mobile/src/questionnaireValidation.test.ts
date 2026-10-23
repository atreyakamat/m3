// Worker questionnaire conditional validation (source questionnaire rules).
// These run in intake (worker live + demo paths) and prove the shared module
// preserves the conditional logic exactly.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'

// questionnaireValidation.ts uses the app-convention extensionless import
// (`./dateFields`). Node ESM cannot resolve that, so add a test-only resolve
// hook that appends .ts for app-relative specifiers. App source is unchanged.
registerHooks({
  resolve(spec, ctx, nextResolve) {
    if (spec.startsWith('./') && !/\.(ts|tsx|js|jsx|json)$/.test(spec)) {
      return nextResolve(spec + '.ts', ctx)
    }
    return nextResolve(spec, ctx)
  },
})

const here = fileURLToPath(new URL('.', import.meta.url))
const { computeQuestionnaireSectionErrors }: any = await import(
  pathToFileURL(here + 'questionnaireValidation.ts').href
)

function baseForm(): any {
  return {
    personal: {
      full_name: 'Synthetic Participant A',
      dob: '1997-05-01',
      dob_unknown: 'no',
      age_years: '',
      gender: 'male',
      mobile: '+910000000001',
      alternate_contact: '',
      id_type: 'aadhaar',
      id_other_details: '',
      address_present: 'Synthetic Demo Colony, Panaji',
      address_permanent: '',
      preferred_language: 'hindi',
      site_id: '',
    },
    past_history: {
      diagnosed_malaria: 'no', times_malaria_2y: '', last_detection: '',
      treatment_place: '', treatment_place_other: '', diagnostic_test_performed: '',
      same_day_report: '', test_method: '', medication_period: '',
      full_course_completed: '', repellent_use: '', mosquito_net_use: '',
      mobile_brand: '', qualification: '',
    },
    present_clinical: {
      fever_today: 'no', temperature_c: '', fever_duration: '',
      symptoms: ['no_other_symptoms'], onset_date: '', breathing_difficulty: 'no',
      chest_pain: 'no', confusion: 'no', can_attend_testing: 'not_required',
    },
    migration_history: {
      time_in_goa: '1_6_months', outside_goa_3m: 'no', states_visited: '',
      last_stay_home_state: '', fever_before_goa_3m: 'no',
    },
    planned_travel: { planning: 'no', episodes: [] },
  }
}

test('a fully satisfied form validates with zero errors in every section', () => {
  for (let sec = 1; sec <= 5; sec++) {
    assert.deepEqual(computeQuestionnaireSectionErrors(baseForm(), sec), {})
  }
})

test('Section 2 conditionals only bind when previously diagnosed with malaria', () => {
  const f = baseForm()
  // Not diagnosed: follow-up questions may be empty — no errors.
  assert.deepEqual(computeQuestionnaireSectionErrors(f, 2), {})
  // Diagnosed: the whole conditional chain activates.
  f.past_history.diagnosed_malaria = 'yes'
  const errs = computeQuestionnaireSectionErrors(f, 2)
  for (const key of [
    'past_history.times_malaria_2y', 'past_history.last_detection', 'past_history.treatment_place',
    'past_history.diagnostic_test_performed',
  ]) {
    assert.ok(errs[key], `expected required error for ${key}`)
  }
  // Deeper nesting: test performed → same-day report → method/period/course.
  f.past_history.times_malaria_2y = '2'
  f.past_history.last_detection = '1_2_years'
  f.past_history.treatment_place = 'pharmacy'
  f.past_history.diagnostic_test_performed = 'yes'
  const errs2 = computeQuestionnaireSectionErrors(f, 2)
  assert.ok(errs2['past_history.same_day_report'])
  f.past_history.same_day_report = 'yes'
  const errs3 = computeQuestionnaireSectionErrors(f, 2)
  assert.ok(errs3['past_history.test_method'])
  assert.ok(errs3['past_history.medication_period'])
  f.past_history.test_method = 'microscopy'
  f.past_history.medication_period = 'days_3'
  const errs4 = computeQuestionnaireSectionErrors(f, 2)
  assert.ok(errs4['past_history.full_course_completed'])
  f.past_history.full_course_completed = 'yes'
  assert.deepEqual(computeQuestionnaireSectionErrors(f, 2), {})
})

test('Section 3: fever or specific symptoms require duration and onset; healthy answers do not', () => {
  const f = baseForm()
  assert.deepEqual(computeQuestionnaireSectionErrors(f, 3), {})

  f.present_clinical.fever_today = 'yes'
  let errs = computeQuestionnaireSectionErrors(f, 3)
  assert.ok(errs['present_clinical.fever_duration'])
  assert.ok(errs['present_clinical.onset_date'])

  f.present_clinical.fever_today = 'no'
  f.present_clinical.symptoms = ['chills_shivering']
  errs = computeQuestionnaireSectionErrors(f, 3)
  assert.ok(errs['present_clinical.onset_date'], 'specific symptoms require onset even without fever')

  f.present_clinical.temperature_c = '46'
  errs = computeQuestionnaireSectionErrors(f, 3)
  assert.ok(errs['present_clinical.temperature_c'])
  f.present_clinical.temperature_c = '37.5'
  f.present_clinical.onset_date = new Date().toISOString().slice(0, 10)
  assert.deepEqual(computeQuestionnaireSectionErrors(f, 3), {})
})

test('Section 4/5 conditionals: outside-Goa travel and planned travel episodes', () => {
  const f = baseForm()
  f.migration_history.outside_goa_3m = 'yes'
  let errs = computeQuestionnaireSectionErrors(f, 4)
  assert.ok(errs['migration_history.states_visited'])
  assert.ok(errs['migration_history.last_stay_home_state'])

  f.planned_travel.planning = 'yes'
  errs = computeQuestionnaireSectionErrors(f, 5)
  assert.ok(errs['planned_travel.episodes'])

  f.planned_travel.episodes = [{
    departure_date: '', return_date: '', place_state: '',
    fever_malaria_during: '', treatment_given: '',
  }]
  errs = computeQuestionnaireSectionErrors(f, 5)
  assert.ok(errs['episode.0.departure_date'])
  assert.ok(errs['episode.0.return_date'])
  assert.ok(errs['episode.0.place_state'])
  assert.ok(errs['episode.0.fever_malaria_during'])

  // Fever during travel activates the nested treatment chain.
  f.planned_travel.episodes[0].departure_date = '2026-11-01'
  f.planned_travel.episodes[0].return_date = '2026-11-05'
  f.planned_travel.episodes[0].place_state = 'Synthetic Demo State'
  f.planned_travel.episodes[0].fever_malaria_during = 'yes'
  errs = computeQuestionnaireSectionErrors(f, 5)
  assert.ok(errs['episode.0.treatment_given'])
  f.planned_travel.episodes[0].treatment_given = 'yes'
  errs = computeQuestionnaireSectionErrors(f, 5)
  assert.ok(errs['episode.0.full_course_completed'])
  assert.ok(errs['episode.0.treatment_place'])
  f.planned_travel.episodes[0].full_course_completed = 'no'
  f.planned_travel.episodes[0].treatment_place = 'other'
  errs = computeQuestionnaireSectionErrors(f, 5)
  assert.ok(errs['episode.0.treatment_place_other'])
  f.planned_travel.episodes[0].treatment_place_other = 'Synthetic Demo Clinic'
  assert.deepEqual(computeQuestionnaireSectionErrors(f, 5), {})
})

test('Section 1: dob_unknown fallback and other-ID conditionals', () => {
  const f = baseForm()
  f.personal.dob = ''
  f.personal.dob_unknown = 'yes'
  let errs = computeQuestionnaireSectionErrors(f, 1)
  assert.ok(errs['personal.age_years'])
  f.personal.age_years = '29'
  errs = computeQuestionnaireSectionErrors(f, 1)
  assert.ok(!errs['personal.dob'], 'DOB not required with age fallback')

  f.personal.dob_unknown = 'no'
  f.personal.id_type = 'other'
  errs = computeQuestionnaireSectionErrors(f, 1)
  assert.ok(errs['personal.id_other_details'])
  f.personal.id_other_details = 'Synthetic PT reference'
  errs = computeQuestionnaireSectionErrors(f, 1)
  assert.ok(!errs['personal.id_other_details'])
})

test('short mobile numbers are rejected; every synthetic worker phone passes', () => {
  const f = baseForm()
  f.personal.mobile = '12345'
  let errs = computeQuestionnaireSectionErrors(f, 1)
  assert.ok(errs['personal.mobile'])
  f.personal.mobile = '+910000000001'
  errs = computeQuestionnaireSectionErrors(f, 1)
  assert.ok(!errs['personal.mobile'])
})
