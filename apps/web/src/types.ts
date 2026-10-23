/** Domain types — ported verbatim from the previous main.tsx (payload
 *  contracts with the FastAPI backend must stay identical). */

export type User = {
  id: string
  display_name: string
  roles: string[]
  preferred_language: string
  patient_id?: string
}

export type WorkerSiteAssignment = {
  site_id: string
  site_name: string
  start_date: string
  end_date?: string | null
  reported_malaria_status?: string | null
  reported_treatment_status?: string | null
}

export type WorkerDetail = {
  id: string
  patient_code: string
  display_name?: string
  dob?: string
  age_years?: number
  gender?: string
  phone_e164?: string
  address_present?: string
  address_permanent?: string
  preferred_language?: string
  occupation?: string
  consent_status?: string
  site_assignments?: WorkerSiteAssignment[]
  travel_history?: Array<{
    origin: string
    destination: string
    arrival_date?: string
    departure_date?: string
    return_date?: string
    planned?: boolean
  }>
}

export type QuestionnaireItem = {
  id: string
  state: string
  schema_version: string
  created_at: string
  submitted_at?: string
  data?: {
    personal?: Record<string, any>
    past_history?: Record<string, any>
    present_clinical?: Record<string, any>
    migration_history?: Record<string, any>
    planned_travel?: Record<string, any>
  }
}

export type ClinicalAssessmentItem = {
  id: string
  encounter_at: string
  medical_officer_name?: string
  temperature_c?: number
  fever_duration_category?: string
  fever_duration_days?: number
  onset_date?: string
  symptoms?: string[]
  red_flags?: string[]
  general_condition?: string
  systolic_bp?: number
  diastolic_bp?: number
  admission_status?: string
  admission_species?: string
  admission_severity?: string
  treatment_documentation?: string
  treatment_completed?: string
  treatment_incomplete_reason?: string
  discharge_date?: string
  outcome?: string
  remarks?: string
  notes?: string
}

export type DiagnosticSampleItem = {
  id: string
  sample_code: string
  patient_id: string
  facility_id?: string
  specimen_type: string
  status: string
  created_at: string
  tests?: Array<{
    id: string
    method: string
    result_status: string
    species?: string
    smear_type?: string
    performed_at?: string
    notes?: string
  }>
  slide_follow_up?: {
    scheduled_day: string
    received: string
    positive?: string
    positive_day?: string
    not_received_reason?: string
    other_reason?: string
  }
}

export type FollowUpItem = {
  id: string
  patient_id: string
  assigned_user_id?: string
  due_at: string
  scheduled_day?: string
  status: string
  adherence?: string
  outcome?: string
  notes?: string
}

export type SiteItem = {
  id: string
  code: string
  name: string
  contractor_name?: string
  district?: string
  area?: string
  status: string
}

export type HealthWorkerItem = {
  id: string
  display_name: string
  phone_e164?: string
  jurisdiction?: string
}

export type CaseItem = {
  id: string
  case_code?: string
  patient_id?: string
  status: string
  urgent?: boolean
  source?: string
  created_at?: string
  acknowledged_at?: string | null
  closed_at?: string | null
  site_id?: string | null
  site_name?: string | null
}

export type CaseStatus =
  | "submitted" | "awaiting_clinical_review" | "assigned" | "in_assessment"
  | "diagnostic_testing_requested" | "awaiting_diagnostic_result"
  | "plan_recorded" | "followup_due" | "followup_completed" | "closed"

export type AuditEventItem = {
  id: string
  actor_user_id?: string | null
  action: string
  entity_type?: string
  entity_id?: string
  occurred_at?: string
  detail?: any
}

export type ResearchResultItem = {
  id: string
  sample_id?: string
  pcr_status?: string
  species_confirmation?: string
  parasite_density?: number | null
  parasite_density_unit?: string
  gametocyte_presence?: string
  pfhrp2_status?: string
  pfhrp3_status?: string
}

export type WorkerListItem = {
  id: string
  display_name?: string
  patient_code: string
  phone_e164?: string
  age_years?: number
  gender?: string
  occupation?: string
  consent_status?: string
  initial_symptoms?: string[]
}

/** /dashboard — three shapes scoped by role (see services/api main.py:1450). */
export type DashboardOperational = {
  scope: "authorized_operational"
  workers: number
  samples_pending: number
  tests_positive: number
  followups_due: number
  followups_overdue: number
  note: string
}
export type DashboardContractor = {
  scope: "managed_sites"
  workers: number
  sites: number
  note: string
}
export type DashboardWorker = {
  scope: "own"
  workers: number
  followups_due: number
  note: string
}
export type DashboardPayload = DashboardOperational | DashboardContractor | DashboardWorker

export type PagePayload<T> = { items: T[]; total: number; offset: number; limit: number }
export type ItemsPayload<T> = { items: T[] }

