/**
 * Offline Demo Mode — deterministic synthetic data (PRD-safe, no runtime deps).
 *
 * Every record in this module is generated from fixed constants:
 *  - all personal fields are unmistakably synthetic ("Synthetic Participant …",
 *    "M3-SYN-…" worker/sample codes, invalid demo phone series "+9100000000…"),
 *  - no field is fetched from or shaped like a real patient record,
 *  - nothing here is ever transmitted: the callers persist into the isolated
 *    demo namespace (src/demoStore.ts) only.
 *
 * Removing a record from these builders or editing constants is the ONLY way
 * demo data changes — the builders are pure so the same installed APK always
 * shows the same demo dataset (no RNG, no clock-derived identity values).
 */

export type DemoRole =
  | 'worker'
  | 'contractor'
  | 'pathologist'
  | 'clinician'
  | 'health_worker'
  | 'research_lab'
  | 'admin'

/** The demo identity never carries a token — it can never authorise a real
 * API call even if a screen accidentally calls `api()` with it. */
export const DEMO_USER_ID = 'synthetic-demo'
export const DEMO_SESSION_STAMP = 'demo'

export const DEMO_ROLES: { role: DemoRole; label: string; description: string }[] = [
  { role: 'worker', label: 'Labour Worker', description: 'Screening questionnaire, drafts and local demo submissions' },
  { role: 'contractor', label: 'Contractor', description: 'Synthetic site roster, assignments, travel and reported status' },
  { role: 'pathologist', label: 'Pathologist / Lab', description: 'Species/result validation, smear type, follow-up slides' },
  { role: 'clinician', label: 'Clinician / Medical Officer', description: 'Synthetic case review, assessment forms, local follow-up' },
  { role: 'health_worker', label: 'Health Worker', description: 'Read-only synthetic surveillance examples' },
  { role: 'research_lab', label: 'Research Lab', description: 'Read-only synthetic aggregate data, no identifiers' },
  { role: 'admin', label: 'Admin', description: 'Read-only synthetic audit and surveillance views' },
]

export function demoRoleLabel(role: string): string {
  return DEMO_ROLES.find((r) => r.role === role)?.label ?? 'Demo'
}

export type DemoSessionUser = {
  id: typeof DEMO_USER_ID
  display_name: string
  roles: DemoRole[]
  patient_id?: string
  demo_stamp: typeof DEMO_SESSION_STAMP
}

/** Build the demo session for one role. There is no token field: a demo
 * session can never present credentials to the real backend. */
export function demoSessionFor(role: DemoRole): {
  token: undefined
  demo: true
  user: DemoSessionUser
} {
  return {
    token: undefined,
    demo: true,
    user: {
      id: DEMO_USER_ID,
      display_name: `Synthetic Demo — ${demoRoleLabel(role)}`,
      roles: [role],
      demo_stamp: DEMO_SESSION_STAMP,
      ...(role === 'worker' ? { patient_id: 'demo-worker-1' } : {}),
    },
  }
}

const FIXED_BASE_TIME = '2026-10-20T09:00:00.000Z'

export type DemoWorker = {
  id: string
  patient_code: string
  display_name: string
  age_years: number
  gender: string
  occupation: string
  consent_status: string
  initial_symptoms: string[]
  updated_at: string
  phone_e164: string
  nativity: string
  screening_completed: boolean
  screened_at: string | null
}

/** Deterministic six-worker synthetic roster (one is pre-screened). */
export function demoWorkers(): DemoWorker[] {
  return [
    {
      id: 'demo-worker-1', patient_code: 'M3-SYN-7K2Q', display_name: 'Synthetic Participant A',
      age_years: 29, gender: 'not_recorded', occupation: 'construction', consent_status: 'documented',
      initial_symptoms: ['fever'], updated_at: FIXED_BASE_TIME,
      phone_e164: '+910000000001', nativity: 'Synthetic Demo State',
      screening_completed: true, screened_at: FIXED_BASE_TIME,
    },
    {
      id: 'demo-worker-2', patient_code: 'M3-SYN-4P8M', display_name: 'Synthetic Participant B',
      age_years: 34, gender: 'male', occupation: 'construction', consent_status: 'documented',
      initial_symptoms: [], updated_at: FIXED_BASE_TIME,
      phone_e164: '+910000000002', nativity: 'Synthetic Demo State',
      screening_completed: false, screened_at: null,
    },
    {
      id: 'demo-worker-3', patient_code: 'M3-SYN-9T1C', display_name: 'Synthetic Participant C',
      age_years: 41, gender: 'female', occupation: 'construction', consent_status: 'documented',
      initial_symptoms: ['chills_shivering'], updated_at: FIXED_BASE_TIME,
      phone_e164: '+910000000003', nativity: 'Synthetic Demo State 2',
      screening_completed: false, screened_at: null,
    },
    {
      id: 'demo-worker-4', patient_code: 'M3-SYN-2Z6H', display_name: 'Synthetic Participant D',
      age_years: 25, gender: 'male', occupation: 'construction', consent_status: 'documented',
      initial_symptoms: [], updated_at: FIXED_BASE_TIME,
      phone_e164: '+910000000004', nativity: 'Synthetic Demo State 2',
      screening_completed: false, screened_at: null,
    },
    {
      id: 'demo-worker-5', patient_code: 'M3-SYN-6B4R', display_name: 'Synthetic Participant E',
      age_years: 37, gender: 'male', occupation: 'construction', consent_status: 'documented',
      initial_symptoms: ['fever', 'headache'], updated_at: FIXED_BASE_TIME,
      phone_e164: '+910000000005', nativity: 'Synthetic Demo State',
      screening_completed: false, screened_at: null,
    },
    {
      id: 'demo-worker-6', patient_code: 'M3-SYN-8L3W', display_name: 'Synthetic Participant F',
      age_years: 31, gender: 'female', occupation: 'construction', consent_status: 'documented',
      initial_symptoms: [], updated_at: FIXED_BASE_TIME,
      phone_e164: '+910000000006', nativity: 'Synthetic Demo State 2',
      screening_completed: false, screened_at: null,
    },
  ]
}

export type DemoSite = {
  id: string; code: string; name: string; district: string; area: string
  worker_count: number; created_at: string
}

export function demoSites(): DemoSite[] {
  return [
    { id: 'demo-site-1', code: 'SYN-01', name: 'Synthetic Site One', district: 'North Goa (demo)', area: 'Synthetic Taluk A', worker_count: 3, created_at: FIXED_BASE_TIME },
    { id: 'demo-site-2', code: 'SYN-02', name: 'Synthetic Site Two', district: 'South Goa (demo)', area: 'Synthetic Taluk B', worker_count: 2, created_at: FIXED_BASE_TIME },
  ]
}

export type DemoRosterItem = {
  worker_id: string; patient_code: string; display_name: string
  site_id: string; site_code: string
  assigned_at: string
  /** reported (planned/travel) status — contractor-visible fields only */
  reported_status: 'screened' | 'not_screened' | 'followup_pending'
  travel_reported: string
  malaria_reported: string
}

export function demoRoster(siteId?: string): DemoRosterItem[] {
  const one = siteId ? siteId === 'demo-site-1' : true
  const two = siteId ? siteId === 'demo-site-2' : true
  const all: DemoRosterItem[] = [
    { worker_id: 'demo-worker-1', patient_code: 'M3-SYN-7K2Q', display_name: 'Synthetic Participant A', site_id: 'demo-site-1', site_code: 'SYN-01', assigned_at: FIXED_BASE_TIME, reported_status: 'screened', travel_reported: 'No travel planned (synthetic example)', malaria_reported: 'Never diagnosed (synthetic example)' },
    { worker_id: 'demo-worker-2', patient_code: 'M3-SYN-4P8M', display_name: 'Synthetic Participant B', site_id: 'demo-site-1', site_code: 'SYN-01', assigned_at: FIXED_BASE_TIME, reported_status: 'not_screened', travel_reported: 'Planned travel in 2 weeks (synthetic example)', malaria_reported: 'Never diagnosed (synthetic example)' },
    { worker_id: 'demo-worker-3', patient_code: 'M3-SYN-9T1C', display_name: 'Synthetic Participant C', site_id: 'demo-site-1', site_code: 'SYN-01', assigned_at: FIXED_BASE_TIME, reported_status: 'followup_pending', travel_reported: 'Returned from travel (synthetic example)', malaria_reported: 'Treated previously, course completed (synthetic example)' },
    { worker_id: 'demo-worker-5', patient_code: 'M3-SYN-6B4R', display_name: 'Synthetic Participant E', site_id: 'demo-site-2', site_code: 'SYN-02', assigned_at: FIXED_BASE_TIME, reported_status: 'not_screened', travel_reported: 'No travel planned (synthetic example)', malaria_reported: 'Not recorded (synthetic example)' },
    { worker_id: 'demo-worker-6', patient_code: 'M3-SYN-8L3W', display_name: 'Synthetic Participant F', site_id: 'demo-site-2', site_code: 'SYN-02', assigned_at: FIXED_BASE_TIME, reported_status: 'screened', travel_reported: 'No travel planned (synthetic example)', malaria_reported: 'Never diagnosed (synthetic example)' },
  ]
  if (one && two) return all
  return all.filter((r) => r.site_id === siteId)
}

export type DemoFacility = { id: string; name: string; district: string }
export function demoFacilities(): DemoFacility[] {
  return [
    { id: 'demo-facility-1', name: 'Synthetic PHC (demo)', district: 'North Goa' },
    { id: 'demo-facility-2', name: 'Synthetic UHC (demo)', district: 'South Goa' },
  ]
}

export type DemoCase = {
  id: string; case_code: string; status: string; urgent: boolean
  site_name: string | null; created_at: string; patient_code: string
  ownership: 'seed' | 'local'
}

/** Deterministic synthetic case queue (same examples every launch).
 * ownership 'local' rows are appended from the demo store at read time. */
export function demoCases(seededOnly = true): DemoCase[] {
  const seeded: DemoCase[] = [
    { id: 'demo-case-1', case_code: 'M3-SYN-CASE-01', status: 'awaiting_clinical_review', urgent: false, site_name: 'Synthetic Site One', created_at: FIXED_BASE_TIME, patient_code: 'M3-SYN-4P8M', ownership: 'seed' },
    { id: 'demo-case-2', case_code: 'M3-SYN-CASE-02', status: 'assigned', urgent: true, site_name: 'Synthetic Site Two', created_at: FIXED_BASE_TIME, patient_code: 'M3-SYN-6B4R', ownership: 'seed' },
    { id: 'demo-case-3', case_code: 'M3-SYN-CASE-03', status: 'closed', urgent: false, site_name: 'Synthetic Site One', created_at: FIXED_BASE_TIME, patient_code: 'M3-SYN-9T1C', ownership: 'seed' },
  ]
  return seededOnly ? seeded : seeded
}

export function demoCasesForWorker(patientCode: string): DemoCase[] {
  return demoCases().filter((c) => c.patient_code === patientCode || patientCode === 'demo-worker-1')
}

export type DemoAssessment = {
  id: string; patient_code: string; temperature_c: number | null
  admission_status: string; general_condition: string; created_at: string
}

export function demoAssessments(): DemoAssessment[] {
  return [
    { id: 'demo-assessment-1', patient_code: 'M3-SYN-7K2Q', temperature_c: 38.6, admission_status: 'outpatient', general_condition: 'fair', created_at: FIXED_BASE_TIME },
    { id: 'demo-assessment-2', patient_code: 'M3-SYN-9T1C', temperature_c: 37.4, admission_status: 'outpatient', general_condition: 'good', created_at: FIXED_BASE_TIME },
  ]
}

export type DemoSample = {
  id: string; sample_code: string; patient_code: string; method: string
  result_status: string; species: string | null; smear_type: string | null
  created_at: string
}

export function demoSamples(): DemoSample[] {
  return [
    { id: 'demo-sample-1', sample_code: 'M3-SYN-S-001', patient_code: 'M3-SYN-7K2Q', method: 'microscopy', result_status: 'positive', species: 'pf', smear_type: 'both', created_at: FIXED_BASE_TIME },
    { id: 'demo-sample-2', sample_code: 'M3-SYN-S-002', patient_code: 'M3-SYN-4P8M', method: 'rdt', result_status: 'negative', species: null, smear_type: null, created_at: FIXED_BASE_TIME },
    { id: 'demo-sample-3', sample_code: 'M3-SYN-S-003', patient_code: 'M3-SYN-6B4R', method: 'microscopy', result_status: 'pending', species: null, smear_type: 'thick', created_at: FIXED_BASE_TIME },
  ]
}

export type DemoFollowup = {
  id: string; patient_code: string; assigned_to: string; assigned_to_name: string
  scheduled_day: string; due_at: string; status: string; created_at: string
}

export function demoFollowups(): DemoFollowup[] {
  return [
    { id: 'demo-followup-1', patient_code: 'M3-SYN-7K2Q', assigned_to: 'demo-health-worker-1', assigned_to_name: 'Synthetic Health Worker 1', scheduled_day: '+3d', due_at: '2026-10-23T09:00:00.000Z', status: 'pending', created_at: FIXED_BASE_TIME },
    { id: 'demo-followup-2', patient_code: 'M3-SYN-6B4R', assigned_to: 'demo-health-worker-2', assigned_to_name: 'Synthetic Health Worker 2', scheduled_day: '+7d', due_at: '2026-10-27T09:00:00.000Z', status: 'pending', created_at: FIXED_BASE_TIME },
  ]
}

export function demoHealthWorkerOptions(): { id: string; display_name: string }[] {
  return [
    { id: 'demo-health-worker-1', display_name: 'Synthetic Health Worker 1' },
    { id: 'demo-health-worker-2', display_name: 'Synthetic Health Worker 2' },
  ]
}

export type DemoResearchAggregate = {
  id: string; sample_id: string; pcr_status: string
  species_confirmation: string | null; parasite_density: number | null
  parasite_density_unit: string | null; gametocyte_presence: string
  pfhrp2_status: string; pfhrp3_status: string
}

/** Read-only molecular dataset with NO identifiers beyond opaque synthetic
 * sample codes. */
export function demoResearchAggregates(): DemoResearchAggregate[] {
  return [
    { id: 'demo-res-1', sample_id: 'M3-RES-SYN-0001', pcr_status: 'detected', species_confirmation: 'pf', parasite_density: 12400, parasite_density_unit: 'parasites/µL', gametocyte_presence: 'not_detected', pfhrp2_status: 'present', pfhrp3_status: 'present' },
    { id: 'demo-res-2', sample_id: 'M3-RES-SYN-0002', pcr_status: 'not_detected', species_confirmation: null, parasite_density: null, parasite_density_unit: null, gametocyte_presence: 'not_detected', pfhrp2_status: 'present', pfhrp3_status: 'present' },
    { id: 'demo-res-3', sample_id: 'M3-RES-SYN-0003', pcr_status: 'inconclusive', species_confirmation: null, parasite_density: null, parasite_density_unit: null, gametocyte_presence: 'inconclusive', pfhrp2_status: 'deleted', pfhrp3_status: 'present' },
  ]
}

export type DemoAuditEvent = {
  id: string; at: string; actor: string; action: string; detail: string
}

export function demoAuditEvents(): DemoAuditEvent[] {
  return [
    { id: 'demo-audit-1', at: FIXED_BASE_TIME, actor: 'synthetic-demo:clinician', action: 'demo.assessment.recorded', detail: 'Synthetic assessment example recorded in local demo store' },
    { id: 'demo-audit-2', at: FIXED_BASE_TIME, actor: 'synthetic-demo:pathologist', action: 'demo.sample.recorded', detail: 'Synthetic diagnostic example recorded in local demo store' },
    { id: 'demo-audit-3', at: FIXED_BASE_TIME, actor: 'synthetic-demo:health_worker', action: 'demo.followup.viewed', detail: 'Synthetic follow-up queue viewed in offline demo' },
  ]
}

/** Role-appropriate synthetic dashboard metrics — fixed numbers, clearly
 * labelled as demo scope elsewhere in the UI. */
export function demoDashboardMetrics(role: DemoRole): {
  workers: number; samples_pending: number; followups_due: number; tests_positive: number
} {
  const workers = demoWorkers().length
  switch (role) {
    case 'pathologist':
      return { workers, samples_pending: 1, followups_due: 0, tests_positive: 1 }
    case 'clinician':
      return { workers, samples_pending: 1, followups_due: 2, tests_positive: 1 }
    case 'worker':
      return { workers: 0, samples_pending: 0, followups_due: 0, tests_positive: 0 }
    case 'contractor':
      return { workers: demoRoster().length, samples_pending: 0, followups_due: 1, tests_positive: 0 }
    default:
      return { workers, samples_pending: 1, followups_due: 2, tests_positive: 1 }
  }
}
