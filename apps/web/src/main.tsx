import { Component, ErrorInfo, FormEvent, ReactNode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api } from './api'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import './styles.css'

// ----------------- Domain Types -----------------

export type User = {
  id: string
  display_name: string
  roles: string[]
  preferred_language: string
  patient_id?: string
}

export type Session = {
  access_token: string
  user: User
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

// ----------------- Labels & Localization -----------------

const labels = {
  en: {
    appName: 'M3 Malaria Surveillance Console',
    appSub: 'Goa State Comprehensive Malaria Elimination System',
    signIn: 'Sign In',
    phone: 'Phone number',
    pin: 'PIN',
    overview: 'Overview',
    workers: 'Workers Roster',
    samples: 'Diagnostics & Pathology',
    followups: 'Follow-ups Queue',
    sites: 'Construction Sites',
    reports: 'Surveillance Reports',
    auditLog: 'Audit Trail',
    signOut: 'Sign Out',
    search: 'Search by patient ID, code, or name...',
    loading: 'Loading surveillance records from API...',
    empty: 'No authorized records found',
    offline: 'LAN API is unreachable. Check server connection.',
    synthetic: 'Synthetic Demonstration Dataset — Not for unvalidated point-of-care deployment.',
    status: 'Status',
    patientCode: 'Patient Code',
    name: 'Name',
    age: 'Age / DOB',
    gender: 'Gender',
    occupation: 'Occupation',
    consent: 'Consent',
    method: 'Method',
    result: 'Result',
    species: 'Species',
    dueDate: 'Due Date',
    adherence: 'Adherence',
    outcome: 'Outcome',
    area: 'Area',
    actions: 'Actions',
    refresh: 'Refresh Data',
    viewDetails: 'View Details',
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    enrollWorker: 'Enroll at Site',
    updateStatus: 'Report Status',
    recordAssessment: 'Record Assessment',
    scheduleFollowup: 'Schedule Follow-up',
    recordSample: 'Record Sample',
    recordSlideFollowup: 'Slide Follow-up',
    readOnlyBadge: 'Read-Only Surveillance View — Mutation Disabled per M3 Protocol (HTTP 403)',
  },
  hi: {
    appName: 'एम3 मलेरिया निगरानी कंसोल',
    appSub: 'गोवा राज्य मलेरिया उन्मूलन निगरानी प्रणाली',
    signIn: 'साइन इन करें',
    phone: 'फ़ोन नंबर',
    pin: 'पिन',
    overview: 'सारांश',
    workers: 'श्रमिक सूची',
    samples: 'निदान एवं पैथोलॉजी',
    followups: 'अनुवर्ती देखभाल कतार',
    sites: 'निर्माण स्थल',
    reports: 'निगरानी रिपोर्ट',
    auditLog: 'ऑडिट ट्रेल',
    signOut: 'साइन आउट',
    search: 'रोगी आईडी, कोड या नाम से खोजें...',
    loading: 'सर्वर से रिकॉर्ड लोड हो रहे हैं...',
    empty: 'कोई अधिकृत रिकॉर्ड नहीं मिला',
    offline: 'एपीआई सर्वर से संपर्क नहीं हो पा रहा है।',
    synthetic: 'सिंथेटिक डेमो डेटा — केवल परीक्षण और मूल्यांकन के लिए।',
    status: 'स्थिति',
    patientCode: 'रोगी कोड',
    name: 'नाम',
    age: 'आयु / जन्म तिथि',
    gender: 'लिंग',
    occupation: 'व्यवसाय',
    consent: 'सहमति',
    method: 'विधि',
    result: 'परिणाम',
    species: 'प्रजाति',
    dueDate: 'देय तिथि',
    adherence: 'दवा पालन',
    outcome: 'परिणाम',
    area: 'क्षेत्र',
    actions: 'कार्रवाई',
    refresh: 'रीफ़्रेश करें',
    viewDetails: 'विवरण देखें',
    close: 'बंद करें',
    save: 'सुरक्षित करें',
    cancel: 'रद्द करें',
    enrollWorker: 'साइट पर पंजीकृत करें',
    updateStatus: 'स्वास्थ्य स्थिति दर्ज करें',
    recordAssessment: 'नैदानिक मूल्यांकन दर्ज करें',
    scheduleFollowup: 'अनुवर्ती निर्धारित करें',
    recordSample: 'नमूना दर्ज करें',
    recordSlideFollowup: 'स्लाइड अनुवर्ती दर्ज करें',
    readOnlyBadge: 'केवल-पढ़ने योग्य निगरानी दृश्य — एम3 प्रोटोकॉल के तहत संपादन प्रतिबंधित (HTTP 403)',
  },
}

// ----------------- Subcomponents -----------------

function StatusBadge({
  label,
  variant = 'neutral',
}: {
  label: string
  variant?: 'neutral' | 'success' | 'danger' | 'warning' | 'info'
}) {
  return <span className={`status-badge badge-${variant}`}>{label}</span>
}

function MetricCard({
  label,
  value,
  help,
}: {
  label: string
  value: number | string
  help?: string
}) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {help && <span className="metric-help">{help}</span>}
    </div>
  )
}

// ----------------- Login Screen -----------------

function Login({
  onSession,
  language,
  onToggleLang,
}: {
  onSession: (s: Session) => void
  language: 'en' | 'hi'
  onToggleLang: () => void
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('worker')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const t = labels[language]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const res = await api<Session>('/auth/signup', undefined, {
          method: 'POST',
          body: JSON.stringify({
            phone,
            pin,
            display_name: displayName,
            role,
            preferred_language: language,
          }),
        })
        onSession(res)
      } else {
        const res = await api<Session>('/auth/login', undefined, {
          method: 'POST',
          body: JSON.stringify({ phone, pin }),
        })
        onSession(res)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (mode === 'signup' ? 'Unable to create account' : 'Unable to sign in'))
    } finally {
      setLoading(false)
    }
  }

  function prefill(p: string) {
    setMode('login')
    setPhone(p)
    setPin('2468')
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-top">
          <span className="eyebrow">M3 / GOA SURVEILLANCE</span>
          <button type="button" className="lang-pill" onClick={onToggleLang}>
            {language === 'en' ? 'हिन्दी' : 'English'}
          </button>
        </div>

        <h1 className="login-title">{t.appName}</h1>
        <p className="login-subtitle">
          Secure multi-role console for active screening, clinical admission, longitudinal laboratory diagnostics, and contractor site monitoring.
        </p>

        {/* Tab switcher: Sign In vs Sign Up */}
        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            {t.signIn}
          </button>
          <button
            type="button"
            className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            {language === 'en' ? 'Register / Sign Up' : 'पंजीकरण / साइन अप'}
          </button>
        </div>

        <form onSubmit={submit} className="login-form">
          {mode === 'signup' && (
            <label className="input-group">
              <span className="input-label">Full Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
              />
            </label>
          )}

          <label className="input-group">
            <span className="input-label">{t.phone}</span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={mode === 'signup' ? '+919876543210' : '+919000000001'}
              required
            />
          </label>

          <label className="input-group">
            <span className="input-label">{mode === 'signup' ? 'Choose 4-Digit PIN' : t.pin}</span>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={mode === 'signup' ? 'e.g. 1234' : '4-digit PIN (2468)'}
              pattern="[0-9]{4,12}"
              required
            />
          </label>

          {mode === 'signup' && (
            <label className="input-group">
              <span className="input-label">Account Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="worker">Labour Worker (Direct Intake)</option>
                <option value="clinician">Clinician / Medical Officer</option>
                <option value="pathologist">Pathologist / Lab</option>
                <option value="health_worker">Field Health Worker</option>
                <option value="contractor">Contractor</option>
                <option value="research_lab">Research Laboratory</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
          )}

          {error && <div className="alert-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? 'Processing...'
              : mode === 'signup'
              ? 'Create Account & Sign In'
              : t.signIn}
          </button>
        </form>

        {mode === 'login' && (
          <div className="quick-roles-section">
            <span className="quick-roles-label">Quick Sign-in (PIN: 2468):</span>
            <div className="quick-roles-grid">
              <button type="button" onClick={() => prefill('+919000000001')}>1. Worker</button>
              <button type="button" onClick={() => prefill('+919000000002')}>2. Clinician</button>
              <button type="button" onClick={() => prefill('+919000000003')}>3. Pathology</button>
              <button type="button" onClick={() => prefill('+919000000004')}>4. Health Worker</button>
              <button type="button" onClick={() => prefill('+919000000005')}>5. Research Lab</button>
              <button type="button" onClick={() => prefill('+919000000006')}>6. Contractor</button>
              <button type="button" onClick={() => prefill('+919000000007')}>7. Admin</button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// ----------------- Action Modals -----------------

// Clinician: Assessment Modal
function ClinicalAssessmentModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [temp, setTemp] = useState('38.2')
  const [feverDays, setFeverDays] = useState('2')
  const [feverCat, setFeverCat] = useState('1_3_days')
  const [officerName, setOfficerName] = useState("Dr. D'Souza")
  const [symptoms, setSymptoms] = useState<string[]>(['fever', 'chills'])
  const [admissionStatus, setAdmissionStatus] = useState('admitted')
  const [admissionSeverity, setAdmissionSeverity] = useState('mild')
  const [admissionSpecies, setAdmissionSpecies] = useState('pv')
  const [treatmentCompleted, setTreatmentCompleted] = useState('yes')
  const [treatmentReason, setTreatmentReason] = useState('')
  const [treatmentDoc, setTreatmentDoc] = useState('Standard oral chloroquine protocol initiated')
  const [notes, setNotes] = useState('Clinical evaluation completed at primary health centre')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const symptomOptions = ['fever', 'chills', 'headache', 'nausea', 'vomiting', 'body_ache', 'fatigue']

  function toggleSymptom(sym: string) {
    setSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/assessments', token, {
        method: 'POST',
        body: JSON.stringify({
          patient_id: worker.id,
          medical_officer_name: officerName,
          temperature_c: parseFloat(temp) || 37.0,
          fever_duration_days: parseInt(feverDays) || 1,
          fever_duration_category: feverCat,
          symptoms,
          admission_status: admissionStatus,
          admission_severity: admissionStatus === 'admitted' ? admissionSeverity : undefined,
          admission_species: admissionSpecies || undefined,
          treatment_completed: treatmentCompleted,
          treatment_incomplete_reason: treatmentCompleted === 'no' ? treatmentReason : undefined,
          treatment_documentation: treatmentDoc,
          notes,
        }),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record assessment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">CLINICAL ENCOUNTER</span>
            <h3>Record Clinical Assessment</h3>
            <span className="text-secondary text-sm">Patient: {worker.patient_code} ({worker.display_name || 'De-identified'})</span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-grid">
            <label className="input-group">
              <span className="input-label">Medical Officer Name</span>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                required
              />
            </label>

            <label className="input-group">
              <span className="input-label">Temperature (°C)</span>
              <input
                type="number"
                step="0.1"
                min="35"
                max="43"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                required
              />
            </label>

            <label className="input-group">
              <span className="input-label">Fever Duration</span>
              <select value={feverCat} onChange={(e) => setFeverCat(e.target.value)}>
                <option value="<24h">&lt; 24 hours</option>
                <option value="1_3_days">1 to 3 days</option>
                <option value="4_7_days">4 to 7 days</option>
                <option value=">7_days">&gt; 7 days</option>
              </select>
            </label>

            <label className="input-group">
              <span className="input-label">Admission Status</span>
              <select value={admissionStatus} onChange={(e) => setAdmissionStatus(e.target.value)}>
                <option value="outpatient">Outpatient</option>
                <option value="admitted">Admitted</option>
                <option value="referred">Referred</option>
              </select>
            </label>
          </div>

          {admissionStatus === 'admitted' && (
            <div className="form-grid mt-3">
              <label className="input-group">
                <span className="input-label">Admission Severity (Required for Admitted)</span>
                <select value={admissionSeverity} onChange={(e) => setAdmissionSeverity(e.target.value)}>
                  <option value="mild">Mild</option>
                  <option value="severe">Severe</option>
                </select>
              </label>

              <label className="input-group">
                <span className="input-label">Suspected / Clinical Species</span>
                <select value={admissionSpecies} onChange={(e) => setAdmissionSpecies(e.target.value)}>
                  <option value="pv">Plasmodium vivax (Pv)</option>
                  <option value="pf">Plasmodium falciparum (Pf)</option>
                  <option value="mixed">Mixed (Pv + Pf)</option>
                  <option value="unconfirmed">Unconfirmed</option>
                </select>
              </label>
            </div>
          )}

          <div className="input-group mt-3">
            <span className="input-label">Presenting Symptoms</span>
            <div className="checkbox-row">
              {symptomOptions.map((sym) => (
                <label key={sym} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={symptoms.includes(sym)}
                    onChange={() => toggleSymptom(sym)}
                  />
                  <span>{sym.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-grid mt-3">
            <label className="input-group">
              <span className="input-label">Treatment Completed</span>
              <select value={treatmentCompleted} onChange={(e) => setTreatmentCompleted(e.target.value)}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not_applicable">Not Applicable</option>
              </select>
            </label>

            {treatmentCompleted === 'no' && (
              <label className="input-group">
                <span className="input-label">Incomplete Reason (Required)</span>
                <input
                  type="text"
                  value={treatmentReason}
                  onChange={(e) => setTreatmentReason(e.target.value)}
                  placeholder="e.g., Patient vomited medication / lost to follow-up"
                  required
                />
              </label>
            )}
          </div>

          <label className="input-group mt-3">
            <span className="input-label">Treatment Documentation (Prescribed Regimen)</span>
            <input
              type="text"
              value={treatmentDoc}
              onChange={(e) => setTreatmentDoc(e.target.value)}
            />
          </label>

          <label className="input-group mt-3">
            <span className="input-label">Clinical Remarks & Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Recording...' : 'Submit Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Clinician: Schedule Follow-up Modal
function ScheduleFollowupModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [healthWorkers, setHealthWorkers] = useState<HealthWorkerItem[]>([])
  const [assignedUserId, setAssignedUserId] = useState('')
  const [scheduledDay, setScheduledDay] = useState('Day 3')
  const [dueDaysAhead, setDueDaysAhead] = useState('3')
  const [notes, setNotes] = useState('Check chloroquine compliance, fever resolution, and adverse symptoms')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchHW() {
      try {
        const res = await api<{ items: HealthWorkerItem[] }>('/health-workers', token)
        if (res?.items?.length) {
          setHealthWorkers(res.items)
          setAssignedUserId(res.items[0].id)
        }
      } catch {
        // HW fetch failed
      }
    }
    fetchHW()
  }, [token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!assignedUserId) {
      setError('Please select an active health worker')
      return
    }
    setLoading(true)
    setError('')
    try {
      const days = parseInt(dueDaysAhead) || 3
      const dueDate = new Date(Date.now() + days * 86400000).toISOString()
      await api('/follow-ups', token, {
        method: 'POST',
        body: JSON.stringify({
          patient_id: worker.id,
          assigned_user_id: assignedUserId,
          scheduled_day: scheduledDay,
          due_at: dueDate,
          notes,
        }),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule follow-up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">COMMUNITY CARE DISPATCH</span>
            <h3>Schedule Field Follow-up</h3>
            <span className="text-secondary text-sm">Patient: {worker.patient_code} ({worker.display_name || 'De-identified'})</span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-grid">
            <label className="input-group">
              <span className="input-label">Protocol Day</span>
              <select value={scheduledDay} onChange={(e) => setScheduledDay(e.target.value)}>
                <option value="Day 3">Day 3 (Clinical response & fever check)</option>
                <option value="Day 7">Day 7 (Microscopy slide & compliance)</option>
                <option value="Day 14">Day 14 (Longitudinal cure / primaquine monitor)</option>
                <option value="Day 28">Day 28 (Parasitological cure confirmation)</option>
              </select>
            </label>

            <label className="input-group">
              <span className="input-label">Assign to Health Worker</span>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                required
              >
                {healthWorkers.length ? (
                  healthWorkers.map((hw) => (
                    <option key={hw.id} value={hw.id}>
                      {hw.display_name} {hw.jurisdiction ? `(${hw.jurisdiction})` : ''}
                    </option>
                  ))
                ) : (
                  <option value="">No active health workers available</option>
                )}
              </select>
            </label>

            <label className="input-group">
              <span className="input-label">Due in (Days from now)</span>
              <input
                type="number"
                min="1"
                max="60"
                value={dueDaysAhead}
                onChange={(e) => setDueDaysAhead(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="input-group mt-3">
            <span className="input-label">Instructions & Notes for Health Worker</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Scheduling...' : 'Assign Follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Pathologist: Diagnostic Sample Modal
function PathologistSampleModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [method, setMethod] = useState('microscopy')
  const [resultStatus, setResultStatus] = useState('positive')
  const [species, setSpecies] = useState('pv')
  const [smearType, setSmearType] = useState('both')
  const [specimenType, setSpecimenType] = useState('whole_blood')
  const [notes, setNotes] = useState('Giemsa stained thick and thin blood films evaluated under 100x oil immersion')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/samples', token, {
        method: 'POST',
        body: JSON.stringify({
          patient_id: worker.id,
          method,
          result_status: resultStatus,
          species: resultStatus === 'positive' ? species : undefined,
          smear_type: method === 'microscopy' ? smearType : undefined,
          specimen_type: specimenType,
          notes,
        }),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record diagnostic sample')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">PATHOLOGY LABORATORY</span>
            <h3>Record Diagnostic Sample</h3>
            <span className="text-secondary text-sm">Patient: {worker.patient_code} ({worker.display_name || 'De-identified'})</span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-grid">
            <label className="input-group">
              <span className="input-label">Diagnostic Method</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="microscopy">Microscopy (Gold Standard)</option>
                <option value="rdt">Rapid Diagnostic Test (RDT)</option>
                <option value="molecular_pcr">Molecular / PCR Assay</option>
              </select>
            </label>

            <label className="input-group">
              <span className="input-label">Result Status</span>
              <select value={resultStatus} onChange={(e) => setResultStatus(e.target.value)}>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="indeterminate">Indeterminate</option>
                <option value="pending">Pending</option>
              </select>
            </label>

            {resultStatus === 'positive' && (
              <label className="input-group">
                <span className="input-label">Plasmodium Species</span>
                <select value={species} onChange={(e) => setSpecies(e.target.value)}>
                  <option value="pv">Plasmodium vivax (Pv)</option>
                  <option value="pf">Plasmodium falciparum (Pf)</option>
                  <option value="mixed">Mixed (Pv + Pf)</option>
                  <option value="pm">Plasmodium malariae</option>
                  <option value="po">Plasmodium ovale</option>
                  <option value="pk">Plasmodium knowlesi</option>
                </select>
              </label>
            )}

            {method === 'microscopy' && (
              <label className="input-group">
                <span className="input-label">Smear Preparation</span>
                <select value={smearType} onChange={(e) => setSmearType(e.target.value)}>
                  <option value="both">Both Thick and Thin Smear</option>
                  <option value="thick">Thick Smear Only</option>
                  <option value="thin">Thin Smear Only</option>
                </select>
              </label>
            )}

            <label className="input-group">
              <span className="input-label">Specimen Type</span>
              <select value={specimenType} onChange={(e) => setSpecimenType(e.target.value)}>
                <option value="whole_blood">Whole Blood (EDTA / Venous)</option>
                <option value="fingerstick_blood">Capillary / Fingerstick Blood</option>
                <option value="filter_paper">DBS / Filter Paper Card</option>
              </select>
            </label>
          </div>

          <label className="input-group mt-3">
            <span className="input-label">Microscopist / Lab Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Recording...' : 'Save Sample Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Pathologist: Slide Follow-up Modal
function SlideFollowupModal({
  sampleId,
  sampleCode,
  token,
  onClose,
  onSuccess,
}: {
  sampleId: string
  sampleCode: string
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [day, setDay] = useState('Day 7')
  const [received, setReceived] = useState('yes')
  const [positive, setPositive] = useState('no')
  const [reason, setReason] = useState('patient_unavailable')
  const [otherReason, setOtherReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api(`/samples/${sampleId}/slide-followup`, token, {
        method: 'PUT',
        body: JSON.stringify({
          scheduled_day: day,
          received,
          positive: received === 'yes' ? positive : undefined,
          positive_day: received === 'yes' && positive === 'yes' ? day : undefined,
          not_received_reason: received === 'no' ? reason : undefined,
          other_reason: received === 'no' && reason === 'other' ? otherReason : undefined,
        }),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save slide follow-up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">LONGITUDINAL SURVEILLANCE</span>
            <h3>Record Slide Follow-Up</h3>
            <span className="text-secondary text-sm">Sample Code: {sampleCode}</span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-grid">
            <label className="input-group">
              <span className="input-label">Protocol Scheduled Day</span>
              <select value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="Day 7">Day 7 (Primary Slide Clearance Check)</option>
                <option value="Day 14">Day 14 (Late Parasitological Check)</option>
                <option value="Day 28">Day 28 (Final Protocol Clearance)</option>
              </select>
            </label>

            <label className="input-group">
              <span className="input-label">Was Follow-up Slide Received?</span>
              <select value={received} onChange={(e) => setReceived(e.target.value)}>
                <option value="yes">Yes — Slide received and evaluated</option>
                <option value="no">No — Slide not received</option>
              </select>
            </label>

            {received === 'yes' ? (
              <label className="input-group">
                <span className="input-label">Microscopy Slide Positivity</span>
                <select value={positive} onChange={(e) => setPositive(e.target.value)}>
                  <option value="no">Negative (Parasites cleared)</option>
                  <option value="yes">Positive (Recrudescence / Parasites persistent)</option>
                </select>
              </label>
            ) : (
              <>
                <label className="input-group">
                  <span className="input-label">Reason Not Received</span>
                  <select value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="patient_unavailable">Patient unavailable at site</option>
                    <option value="refused">Patient refused blood draw</option>
                    <option value="migrated">Migrated out of jurisdiction</option>
                    <option value="sample_damaged">Sample damaged in transit</option>
                    <option value="other">Other reason</option>
                  </select>
                </label>

                {reason === 'other' && (
                  <label className="input-group">
                    <span className="input-label">Specify Reason (Required)</span>
                    <input
                      type="text"
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      required
                    />
                  </label>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Record Slide Follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Contractor: Enroll Worker Modal
function ContractorEnrollModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchSites() {
      try {
        const res = await api<{ items: SiteItem[] }>('/sites', token)
        if (res?.items?.length) {
          setSites(res.items)
          setSiteId(res.items[0].id)
        }
      } catch {
        // Site fetch failed
      }
    }
    fetchSites()
  }, [token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!siteId) {
      setError('Please select an active site')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api(`/workers/${worker.id}/membership`, token, {
        method: 'POST',
        body: JSON.stringify({ site_id: siteId }),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll worker at site')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">CONTRACTOR MANAGEMENT</span>
            <h3>Enroll Worker at Construction Site</h3>
            <span className="text-secondary text-sm">Worker: {worker.patient_code} ({worker.display_name || 'Worker'})</span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="input-group">
            <span className="input-label">Select Site</span>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              {sites.length ? (
                sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.area}
                  </option>
                ))
              ) : (
                <option value="">No sites available under your contract</option>
              )}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enrolling...' : 'Enroll Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Contractor: Update Reported Status Modal
function ContractorStatusModal({
  worker,
  token,
  onClose,
  onSuccess,
}: {
  worker: WorkerDetail
  token: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [malariaStatus, setMalariaStatus] = useState('pv')
  const [treatmentStatus, setTreatmentStatus] = useState('treated')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api(`/workers/${worker.id}/reported-status`, token, {
        method: 'PUT',
        body: JSON.stringify({
          malaria_status: malariaStatus,
          treatment_status: treatmentStatus,
        }),
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reported status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">CONTRACTOR HEALTH REPORT</span>
            <h3>Update Worker Health Status</h3>
            <span className="text-secondary text-sm">Worker: {worker.patient_code} ({worker.display_name || 'Worker'})</span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} className="modal-body">
          {error && <div className="alert-error">{error}</div>}

          <div className="form-grid">
            <label className="input-group">
              <span className="input-label">Reported Health / Malaria Status</span>
              <select value={malariaStatus} onChange={(e) => setMalariaStatus(e.target.value)}>
                <option value="healthy">Healthy / No Fever</option>
                <option value="fever_unconfirmed">Fever (Unconfirmed)</option>
                <option value="pv">Plasmodium vivax (Confirmed)</option>
                <option value="pf">Plasmodium falciparum (Confirmed)</option>
                <option value="mixed">Mixed Infection</option>
              </select>
            </label>

            <label className="input-group">
              <span className="input-label">Treatment Adherence Status</span>
              <select value={treatmentStatus} onChange={(e) => setTreatmentStatus(e.target.value)}>
                <option value="treated">Treated / Medication Completed</option>
                <option value="under_treatment">Currently Under Treatment</option>
                <option value="untreated">Untreated / Awaiting Care</option>
              </select>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------- Worker Detail Drawer / Modal -----------------

function WorkerDrawer({
  workerId,
  session,
  onClose,
  onRefresh,
}: {
  workerId: string
  session: Session
  onClose: () => void
  onRefresh: () => void
}) {
  const [detail, setDetail] = useState<WorkerDetail | null>(null)
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireItem[]>([])
  const [assessments, setAssessments] = useState<ClinicalAssessmentItem[]>([])
  const [samples, setSamples] = useState<DiagnosticSampleItem[]>([])
  const [followups, setFollowups] = useState<FollowUpItem[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'screening' | 'clinical' | 'diagnostics' | 'followups' | 'travel'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Active Action Modals
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [showSampleModal, setShowSampleModal] = useState(false)
  const [slideFollowupTarget, setSlideFollowupTarget] = useState<{ id: string; code: string } | null>(null)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)

  const roles = session.user.roles || []
  const isClinician = roles.includes('clinician')
  const isPathologist = roles.includes('pathologist') || roles.includes('pathology')
  const isContractor = roles.includes('contractor')
  const isReadOnly = roles.some((r) => ['health_worker', 'research_lab', 'admin'].includes(r)) && !isClinician && !isPathologist && !isContractor

  async function loadWorker() {
    setLoading(true)
    setError('')
    try {
      // 1. Worker profile
      const w = await api<WorkerDetail>(`/workers/${workerId}`, session.access_token)
      setDetail(w)

      // 2. Questionnaires
      try {
        const qRes = await api<{ items: QuestionnaireItem[] }>(`/questionnaires?patient_id=${workerId}`, session.access_token)
        setQuestionnaires(qRes?.items || [])
      } catch {
        setQuestionnaires([])
      }

      // 3. Clinical assessments (clinician or admin)
      if (isClinician || roles.includes('admin')) {
        try {
          const aRes = await api<{ items: ClinicalAssessmentItem[] }>(`/assessments?patient_id=${workerId}`, session.access_token)
          setAssessments(aRes?.items || [])
        } catch {
          setAssessments([])
        }
      }

      // 4. Samples for this worker
      try {
        const sRes = await api<{ items: DiagnosticSampleItem[] }>('/samples?limit=100', session.access_token)
        const mySamples = (sRes?.items || []).filter((s) => s.patient_id === workerId)
        setSamples(mySamples)
      } catch {
        setSamples([])
      }

      // 5. Follow-ups for this worker
      try {
        const fRes = await api<{ items: FollowUpItem[] }>(`/follow-ups?patient_id=${workerId}`, session.access_token)
        setFollowups(fRes?.items || [])
      } catch {
        setFollowups([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load worker profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorker()
  }, [workerId])

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title-area">
            <span className="eyebrow">WORKER SURVEILLANCE PROFILE</span>
            <div className="drawer-title-row">
              <h2 className="drawer-title">{detail?.patient_code || workerId}</h2>
              <StatusBadge
                label={detail?.consent_status === 'documented' ? 'Consent Documented' : 'Consent Pending'}
                variant={detail?.consent_status === 'documented' ? 'success' : 'warning'}
              />
            </div>
            <span className="text-secondary text-sm">
              {detail?.display_name || 'Pseudonymized / De-identified Record'} ·{' '}
              {detail?.age_years ? `${detail.age_years} yrs` : 'Age Unspecified'} ·{' '}
              {detail?.gender ? detail.gender.toUpperCase() : 'Gender Unspecified'}
            </span>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {/* Read-Only Notice */}
        {isReadOnly && (
          <div className="notice-banner read-only-banner">
            <span className="badge-ro">READ ONLY</span>
            <span>Mutation endpoints strictly disabled for your surveillance role per M3 Surveillance Protocol (HTTP 403 server-enforced).</span>
          </div>
        )}

        {/* Action Toolbar for Authorized Roles */}
        <div className="drawer-action-bar">
          {isClinician && (
            <>
              <button
                className="btn-primary btn-sm"
                onClick={() => setShowAssessmentModal(true)}
              >
                + Record Assessment
              </button>
              <button
                className="btn-outline btn-sm"
                onClick={() => setShowFollowupModal(true)}
              >
                + Schedule Follow-up
              </button>
            </>
          )}

          {isPathologist && (
            <button
              className="btn-primary btn-sm"
              onClick={() => setShowSampleModal(true)}
            >
              + Record Diagnostic Sample
            </button>
          )}

          {isContractor && (
            <>
              <button
                className="btn-primary btn-sm"
                onClick={() => setShowEnrollModal(true)}
              >
                + Enroll at Site
              </button>
              <button
                className="btn-outline btn-sm"
                onClick={() => setShowStatusModal(true)}
              >
                + Update Health Status
              </button>
            </>
          )}
        </div>

        {/* Drawer Tabs */}
        <div className="drawer-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'screening' ? 'active' : ''}`}
            onClick={() => setActiveTab('screening')}
          >
            Questionnaires ({questionnaires.length})
          </button>
          {(isClinician || roles.includes('admin')) && (
            <button
              className={`tab-btn ${activeTab === 'clinical' ? 'active' : ''}`}
              onClick={() => setActiveTab('clinical')}
            >
              Clinical ({assessments.length})
            </button>
          )}
          <button
            className={`tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnostics')}
          >
            Diagnostics ({samples.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            Follow-ups ({followups.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'travel' ? 'active' : ''}`}
            onClick={() => setActiveTab('travel')}
          >
            Travel ({detail?.travel_history?.length || 0})
          </button>
        </div>

        {/* Drawer Content */}
        <div className="drawer-body">
          {loading ? (
            <div className="state-card loading-card">
              <div className="spinner" />
              <p>Loading worker surveillance record...</p>
            </div>
          ) : error ? (
            <div className="state-card error-card">
              <p>{error}</p>
              <button className="btn-primary btn-sm mt-2" onClick={loadWorker}>Retry</button>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="drawer-tab-pane">
              <div className="detail-section">
                <h4 className="section-title">Demographics & Identity</h4>
                <div className="key-value-grid">
                  <div className="kv-item">
                    <span className="kv-key">Patient Code</span>
                    <strong className="kv-val">{detail?.patient_code}</strong>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Full Name</span>
                    <strong className="kv-val">{detail?.display_name || 'De-identified'}</strong>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Calculated Age</span>
                    <strong className="kv-val">
                      {detail?.age_years ? `${detail.age_years} years` : 'Unspecified'}
                      {detail?.dob ? ` (DOB: ${detail.dob})` : ''}
                    </strong>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Gender</span>
                    <strong className="kv-val">{detail?.gender?.toUpperCase() || '—'}</strong>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Mobile Number</span>
                    <strong className="kv-val">{detail?.phone_e164 || 'Restricted / Not documented'}</strong>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Preferred Language</span>
                    <strong className="kv-val">{detail?.preferred_language || 'hindi'}</strong>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Present Address (Goa)</span>
                    <strong className="kv-val">{detail?.address_present || '—'}</strong>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Permanent Address</span>
                    <strong className="kv-val">{detail?.address_permanent || '—'}</strong>
                  </div>
                </div>
              </div>

              <div className="detail-section mt-4">
                <h4 className="section-title">Site Memberships & Contractor Status</h4>
                {detail?.site_assignments?.length ? (
                  <div className="assignment-list">
                    {detail.site_assignments.map((a, idx) => (
                      <div key={idx} className="assignment-card">
                        <div className="assignment-head">
                          <strong>{a.site_name}</strong>
                          <span className="text-secondary text-sm">Started: {a.start_date}</span>
                        </div>
                        <div className="assignment-meta">
                          <span>Reported Malaria: <strong>{a.reported_malaria_status || 'None reported'}</strong></span>
                          <span>Treatment: <strong>{a.reported_treatment_status || 'None reported'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary text-sm">No active site assignments documented.</p>
                )}
              </div>
            </div>
          ) : activeTab === 'screening' ? (
            <div className="drawer-tab-pane">
              {questionnaires.length ? (
                questionnaires.map((q) => (
                  <div key={q.id} className="submission-card">
                    <div className="submission-header">
                      <div>
                        <strong>Submission {q.id.slice(0, 8)}</strong>
                        <span className="text-secondary text-sm ml-2">
                          Version: {q.schema_version} · State: {q.state.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-secondary text-sm">
                        {q.submitted_at ? new Date(q.submitted_at).toLocaleString() : 'Draft'}
                      </span>
                    </div>

                    {q.data ? (
                      <div className="questionnaire-sections">
                        {/* Section 1 */}
                        <div className="q-section">
                          <span className="q-section-title">Section 1: Personal & Demographics</span>
                          <div className="q-field-grid">
                            <div>Name: <strong>{q.data.personal?.full_name || '—'}</strong></div>
                            <div>DOB: <strong>{q.data.personal?.dob || '—'}</strong></div>
                            <div>Mobile: <strong>{q.data.personal?.mobile || '—'}</strong></div>
                            <div>Address: <strong>{q.data.personal?.address_present || '—'}</strong></div>
                          </div>
                        </div>

                        {/* Section 2 */}
                        <div className="q-section">
                          <span className="q-section-title">Section 2: Past Malaria History</span>
                          <div className="q-field-grid">
                            <div>Diagnosed Malaria: <strong>{q.data.past_history?.diagnosed_malaria || 'no'}</strong></div>
                            {q.data.past_history?.diagnosed_malaria === 'yes' && (
                              <>
                                <div>Year: <strong>{q.data.past_history?.diagnosis_year || '—'}</strong></div>
                                <div>Hospitalized: <strong>{q.data.past_history?.hospitalized || '—'}</strong></div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Section 3 */}
                        <div className="q-section">
                          <span className="q-section-title">Section 3: Present Clinical Symptoms</span>
                          <div className="q-field-grid">
                            <div>Fever Today: <strong>{q.data.present_clinical?.fever_today || 'no'}</strong></div>
                            <div>Duration: <strong>{q.data.present_clinical?.fever_duration || '—'}</strong></div>
                            <div>Temperature: <strong>{q.data.present_clinical?.temperature_c ? `${q.data.present_clinical.temperature_c}°C` : '—'}</strong></div>
                            <div>Symptoms: <strong>{q.data.present_clinical?.symptoms?.join(', ') || 'None'}</strong></div>
                            <div>Can Attend Testing: <strong>{q.data.present_clinical?.can_attend_testing || 'yes'}</strong></div>
                          </div>
                        </div>

                        {/* Section 4 */}
                        <div className="q-section">
                          <span className="q-section-title">Section 4: Migration & Residence History</span>
                          <div className="q-field-grid">
                            <div>Time in Goa: <strong>{q.data.migration_history?.time_in_goa || '—'}</strong></div>
                            <div>Outside Goa in last 3m: <strong>{q.data.migration_history?.outside_goa_3m || 'no'}</strong></div>
                          </div>
                        </div>

                        {/* Section 5 */}
                        <div className="q-section">
                          <span className="q-section-title">Section 5: Planned Travel</span>
                          <div className="q-field-grid">
                            <div>Planning travel outside Goa: <strong>{q.data.planned_travel?.planning || 'no'}</strong></div>
                            {q.data.planned_travel?.planning === 'yes' && (
                              <div>Destination: <strong>{q.data.planned_travel?.destination_state || '—'}</strong></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="notice-muted mt-2">
                        Questionnaire content restricted for this role view.
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="state-card empty-card">
                  <p>No screening questionnaires submitted for this worker.</p>
                </div>
              )}
            </div>
          ) : activeTab === 'clinical' ? (
            <div className="drawer-tab-pane">
              {assessments.length ? (
                assessments.map((a) => (
                  <div key={a.id} className="clinical-encounter-card">
                    <div className="encounter-header">
                      <div>
                        <strong>Encounter with {a.medical_officer_name || 'Medical Officer'}</strong>
                        <span className="text-secondary text-sm ml-2">
                          {new Date(a.encounter_at).toLocaleString()}
                        </span>
                      </div>
                      <StatusBadge
                        label={a.admission_status?.toUpperCase() || 'OUTPATIENT'}
                        variant={a.admission_status === 'admitted' ? 'warning' : 'neutral'}
                      />
                    </div>
                    <div className="encounter-grid mt-2">
                      <div>Temp: <strong>{a.temperature_c ? `${a.temperature_c}°C` : '—'}</strong></div>
                      <div>Fever Duration: <strong>{a.fever_duration_category || '—'}</strong></div>
                      <div>Severity: <strong>{a.admission_severity?.toUpperCase() || '—'}</strong></div>
                      <div>Species: <strong>{a.admission_species?.toUpperCase() || '—'}</strong></div>
                      <div>Treatment Completed: <strong>{a.treatment_completed?.toUpperCase() || '—'}</strong></div>
                    </div>
                    {a.treatment_documentation && (
                      <div className="mt-2 text-sm">
                        <span className="text-secondary">Documented Care Plan: </span>
                        <strong>{a.treatment_documentation}</strong>
                      </div>
                    )}
                    {a.notes && (
                      <div className="mt-1 text-sm text-secondary">
                        Remarks: {a.notes}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="state-card empty-card">
                  <p>No clinical encounters documented for this worker.</p>
                  {isClinician && (
                    <button
                      className="btn-primary btn-sm mt-2"
                      onClick={() => setShowAssessmentModal(true)}
                    >
                      Record First Assessment
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'diagnostics' ? (
            <div className="drawer-tab-pane">
              {samples.length ? (
                samples.map((s) => (
                  <div key={s.id} className="sample-card">
                    <div className="sample-head">
                      <div>
                        <strong>Sample Code: {s.sample_code}</strong>
                        <span className="text-secondary text-sm ml-2">({s.specimen_type})</span>
                      </div>
                      <StatusBadge
                        label={s.status?.toUpperCase()}
                        variant={
                          s.status === 'positive'
                            ? 'danger'
                            : s.status === 'negative'
                              ? 'success'
                              : 'warning'
                        }
                      />
                    </div>

                    {s.tests?.map((t) => (
                      <div key={t.id} className="sample-test-detail">
                        <span>Method: <strong>{t.method?.toUpperCase()}</strong></span>
                        <span>Species: <strong>{t.species?.toUpperCase() || '—'}</strong></span>
                        <span>Smear: <strong>{t.smear_type || '—'}</strong></span>
                        {t.notes && <span className="text-sm text-secondary">Notes: {t.notes}</span>}
                      </div>
                    ))}

                    {/* Longitudinal Slide Follow-up */}
                    <div className="slide-followup-box mt-2">
                      <div className="slide-followup-header">
                        <span className="text-sm font-semibold">Longitudinal Slide Follow-up</span>
                        {isPathologist && (
                          <button
                            className="btn-outline btn-xs"
                            onClick={() => setSlideFollowupTarget({ id: s.id, code: s.sample_code })}
                          >
                            + Record Slide Follow-up
                          </button>
                        )}
                      </div>
                      {s.slide_follow_up ? (
                        <div className="slide-followup-data">
                          <span>Scheduled: <strong>{s.slide_follow_up.scheduled_day}</strong></span>
                          <span>Received: <strong>{s.slide_follow_up.received?.toUpperCase()}</strong></span>
                          {s.slide_follow_up.received === 'yes' ? (
                            <span>Positivity: <strong>{s.slide_follow_up.positive?.toUpperCase()}</strong></span>
                          ) : (
                            <span>Reason: <strong>{s.slide_follow_up.not_received_reason} ({s.slide_follow_up.other_reason || ''})</strong></span>
                          )}
                        </div>
                      ) : (
                        <span className="text-secondary text-xs">No follow-up slide recorded yet.</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="state-card empty-card">
                  <p>No pathology or diagnostic samples on record for this worker.</p>
                  {isPathologist && (
                    <button
                      className="btn-primary btn-sm mt-2"
                      onClick={() => setShowSampleModal(true)}
                    >
                      Record Diagnostic Sample
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'followups' ? (
            <div className="drawer-tab-pane">
              {followups.length ? (
                followups.map((f) => (
                  <div key={f.id} className="followup-card">
                    <div className="followup-head">
                      <div>
                        <strong>{f.scheduled_day || 'Follow-up Encounter'}</strong>
                        <span className="text-secondary text-sm ml-2">
                          Due: {new Date(f.due_at).toLocaleDateString()}
                        </span>
                      </div>
                      <StatusBadge
                        label={f.status?.toUpperCase() || 'DUE'}
                        variant={f.status === 'completed' ? 'success' : 'neutral'}
                      />
                    </div>
                    <div className="followup-meta mt-1">
                      <span>Adherence: <strong>{f.adherence || 'Pending evaluation'}</strong></span>
                      <span>Outcome: <strong>{f.outcome || 'Pending evaluation'}</strong></span>
                    </div>
                    {f.notes && <div className="text-xs text-secondary mt-1">Notes: {f.notes}</div>}
                  </div>
                ))
              ) : (
                <div className="state-card empty-card">
                  <p>No scheduled follow-up visits recorded for this worker.</p>
                  {isClinician && (
                    <button
                      className="btn-primary btn-sm mt-2"
                      onClick={() => setShowFollowupModal(true)}
                    >
                      Schedule Follow-up Visit
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'travel' ? (
            <div className="drawer-tab-pane">
              {detail?.travel_history?.length ? (
                detail.travel_history.map((t, idx) => (
                  <div key={idx} className="travel-card">
                    <strong>{t.origin} → {t.destination}</strong>
                    <div className="travel-meta text-sm text-secondary mt-1">
                      <span>Arrival: {t.arrival_date || '—'}</span>
                      <span>Departure: {t.departure_date || '—'}</span>
                      <span>Return: {t.return_date || '—'}</span>
                      {t.planned && <StatusBadge label="Planned Travel" variant="info" />}
                    </div>
                  </div>
                ))
              ) : (
                <div className="state-card empty-card">
                  <p>No external travel history documented.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Child Action Modals */}
      {showAssessmentModal && detail && (
        <ClinicalAssessmentModal
          worker={detail}
          token={session.access_token}
          onClose={() => setShowAssessmentModal(false)}
          onSuccess={() => {
            setShowAssessmentModal(false)
            loadWorker()
            onRefresh()
          }}
        />
      )}

      {showFollowupModal && detail && (
        <ScheduleFollowupModal
          worker={detail}
          token={session.access_token}
          onClose={() => setShowFollowupModal(false)}
          onSuccess={() => {
            setShowFollowupModal(false)
            loadWorker()
            onRefresh()
          }}
        />
      )}

      {showSampleModal && detail && (
        <PathologistSampleModal
          worker={detail}
          token={session.access_token}
          onClose={() => setShowSampleModal(false)}
          onSuccess={() => {
            setShowSampleModal(false)
            loadWorker()
            onRefresh()
          }}
        />
      )}

      {slideFollowupTarget && (
        <SlideFollowupModal
          sampleId={slideFollowupTarget.id}
          sampleCode={slideFollowupTarget.code}
          token={session.access_token}
          onClose={() => setSlideFollowupTarget(null)}
          onSuccess={() => {
            setSlideFollowupTarget(null)
            loadWorker()
            onRefresh()
          }}
        />
      )}

      {showEnrollModal && detail && (
        <ContractorEnrollModal
          worker={detail}
          token={session.access_token}
          onClose={() => setShowEnrollModal(false)}
          onSuccess={() => {
            setShowEnrollModal(false)
            loadWorker()
            onRefresh()
          }}
        />
      )}

      {showStatusModal && detail && (
        <ContractorStatusModal
          worker={detail}
          token={session.access_token}
          onClose={() => setShowStatusModal(false)}
          onSuccess={() => {
            setShowStatusModal(false)
            loadWorker()
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

// ----------------- Records Tables -----------------

function RecordsTable({
  tab,
  data,
  t,
  onSelectWorker,
  onSlideFollowup,
  isPathologist,
  auditOffset,
  onAuditPageChange,
  onAcknowledgeCase,
}: {
  tab: string
  data: any
  t: (typeof labels)['en']
  onSelectWorker: (id: string) => void
  onSlideFollowup: (sampleId: string, sampleCode: string) => void
  isPathologist: boolean
  auditOffset?: number
  onAuditPageChange?: (offset: number) => void
  onAcknowledgeCase?: (caseId: string) => void
}) {
  const items = data?.items || []

  if (!items.length) {
    return (
      <div className="state-card empty-card">
        <h3>{t.empty}</h3>
        <p>No records matched your search query or role permissions.</p>
      </div>
    )
  }

  if (tab === 'workers') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.patientCode}</th>
              <th>{t.name}</th>
              <th>{t.age} / {t.gender}</th>
              <th>{t.occupation}</th>
              <th>{t.consent}</th>
              <th>Symptoms</th>
              <th>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w: any) => (
              <tr key={w.id} className="interactive-row" onClick={() => onSelectWorker(w.id)}>
                <td>
                  <strong>{w.patient_code}</strong>
                </td>
                <td>{w.display_name || <span className="text-secondary italic">De-identified</span>}</td>
                <td>
                  {[w.age_years ? `${w.age_years}y` : null, w.gender]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </td>
                <td>{w.occupation || 'Field Construction Worker'}</td>
                <td>
                  <StatusBadge
                    label={w.consent_status === 'documented' ? 'Documented' : 'Pending'}
                    variant={w.consent_status === 'documented' ? 'success' : 'neutral'}
                  />
                </td>
                <td>{w.initial_symptoms?.length ? w.initial_symptoms.join(', ') : 'None documented'}</td>
                <td>
                  <button
                    className="btn-outline btn-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectWorker(w.id)
                    }}
                  >
                    View Details →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'samples') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sample Code</th>
              <th>{t.patientCode}</th>
              <th>{t.method}</th>
              <th>{t.result}</th>
              <th>{t.species}</th>
              <th>Smear / Type</th>
              <th>Slide Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any) => {
              const test = s.tests?.[0] || {}
              const isPositive = s.status === 'positive' || test.result_status === 'positive'
              return (
                <tr key={s.id}>
                  <td><strong>{s.sample_code}</strong></td>
                  <td>
                    <button
                      className="link-btn"
                      onClick={() => onSelectWorker(s.patient_id)}
                    >
                      {s.patient_id.slice(0, 8)}...
                    </button>
                  </td>
                  <td>{(test.method || s.method || 'microscopy').toUpperCase()}</td>
                  <td>
                    <StatusBadge
                      label={(test.result_status || s.status || 'PENDING').toUpperCase()}
                      variant={
                        isPositive
                          ? 'danger'
                          : (test.result_status || s.status) === 'negative'
                            ? 'success'
                            : 'warning'
                      }
                    />
                  </td>
                  <td>{test.species ? test.species.toUpperCase() : '—'}</td>
                  <td>{test.smear_type || s.specimen_type || '—'}</td>
                  <td>
                    {isPathologist && isPositive ? (
                      <button
                        className="btn-outline btn-xs"
                        onClick={() => onSlideFollowup(s.id, s.sample_code)}
                      >
                        + Follow-up
                      </button>
                    ) : (
                      <span className="text-secondary text-xs">N/A</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'followups') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.patientCode}</th>
              <th>{t.dueDate}</th>
              <th>Protocol Day</th>
              <th>{t.status}</th>
              <th>{t.adherence}</th>
              <th>{t.outcome}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f: any) => {
              const isOverdue = new Date(f.due_at).getTime() < Date.now() && f.status !== 'completed'
              return (
                <tr key={f.id}>
                  <td>
                    <button
                      className="link-btn"
                      onClick={() => onSelectWorker(f.patient_id)}
                    >
                      {f.patient_id.slice(0, 8)}...
                    </button>
                  </td>
                  <td>{new Date(f.due_at).toLocaleString()}</td>
                  <td><strong>{f.scheduled_day || 'Routine'}</strong></td>
                  <td>
                    <StatusBadge
                      label={isOverdue ? 'OVERDUE' : f.status?.toUpperCase() || 'DUE'}
                      variant={isOverdue ? 'danger' : f.status === 'completed' ? 'success' : 'neutral'}
                    />
                  </td>
                  <td>{f.adherence || '—'}</td>
                  <td>{f.outcome || '—'}</td>
                  <td>
                    <button
                      className="btn-outline btn-xs"
                      onClick={() => onSelectWorker(f.patient_id)}
                    >
                      Open Worker →
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'research') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sample Code</th>
              <th>PCR Status</th>
              <th>Species Confirmed</th>
              <th>Parasite Density</th>
              <th>Gametocytes</th>
              <th>pfhrp2 / pfhrp3</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r: any) => (
              <tr key={r.id}>
                <td><strong>{r.sample_id}</strong></td>
                <td>
                  <StatusBadge
                    label={r.pcr_status?.toUpperCase()}
                    variant={
                      r.pcr_status === 'detected'
                        ? 'danger'
                        : r.pcr_status === 'not_detected'
                          ? 'success'
                          : 'warning'
                    }
                  />
                </td>
                <td>{r.species_confirmation ? r.species_confirmation.toUpperCase() : '—'}</td>
                <td>{r.parasite_density != null ? `${r.parasite_density} ${r.parasite_density_unit || 'parasites/µL'}` : '—'}</td>
                <td>{r.gametocyte_presence || 'not_tested'}</td>
                <td>{r.pfhrp2_status} / {r.pfhrp3_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="notice-muted mt-3">
          Approved molecular dataset (read-only). Records are de-identified and keyed to opaque sample codes; Research Lab accounts cannot create, edit or delete results.
        </p>
      </div>
    )
  }

  if (tab === 'sites') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Site Code</th>
              <th>Site Name</th>
              <th>Contractor</th>
              <th>{t.area}</th>
              <th>{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((site: any) => (
              <tr key={site.id}>
                <td><strong>{site.code}</strong></td>
                <td>{site.name}</td>
                <td>{site.contractor_name || 'Assigned Contractor'}</td>
                <td>{site.area || site.district || 'Goa'}</td>
                <td>
                  <StatusBadge
                    label={site.status?.toUpperCase() || 'ACTIVE'}
                    variant={site.status === 'active' ? 'success' : 'neutral'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'cases') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Case Code</th>
              <th>Status</th>
              <th>Urgency</th>
              <th>Site</th>
              <th>Reported / Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c: any) => (
              <tr key={c.id}>
                <td><strong>{c.case_code}</strong></td>
                <td>
                  <StatusBadge
                    label={c.status.replace(/_/g, ' ').toUpperCase()}
                    variant={
                      c.status === 'awaiting_clinical_review'
                        ? 'warning'
                        : c.status === 'closed'
                        ? 'neutral'
                        : 'info'
                    }
                  />
                </td>
                <td>
                  {c.urgent ? (
                    <StatusBadge label="URGENT" variant="danger" />
                  ) : (
                    <span className="text-secondary text-sm">Standard</span>
                  )}
                </td>
                <td>{c.site_name || c.site_id || '—'}</td>
                <td>{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                <td>
                  {c.status === 'awaiting_clinical_review' && onAcknowledgeCase ? (
                    <button
                      className="btn-primary btn-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAcknowledgeCase(c.id)
                      }}
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="text-secondary text-sm">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'audit') {
    const currentOffset = auditOffset || 0
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Actor</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ev: any) => (
              <tr key={ev.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(ev.occurred_at).toLocaleString()}
                </td>
                <td>
                  <span className="code-badge">{ev.action}</span>
                </td>
                <td><strong>{ev.entity_type}</strong></td>
                <td>
                  <span className="text-secondary mono">{ev.entity_id ? ev.entity_id.slice(0, 16) : '—'}</span>
                </td>
                <td>{ev.actor_user_id || 'System'}</td>
                <td>
                  <span className="audit-detail" title={typeof ev.detail === 'object' ? JSON.stringify(ev.detail) : String(ev.detail ?? '')}>
                    {typeof ev.detail === 'object' ? JSON.stringify(ev.detail) : ev.detail || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination-bar">
          <span>
            Showing {data?.total ? currentOffset + 1 : 0} – {Math.min(currentOffset + 50, data?.total || 0)} of {data?.total || 0} audit events
          </span>
          <div className="pagination-controls">
            <button
              className="btn-outline btn-xs"
              disabled={currentOffset === 0}
              onClick={() => onAuditPageChange?.(Math.max(0, currentOffset - 50))}
            >
              ← Previous
            </button>
            <button
              className="btn-outline btn-xs"
              disabled={currentOffset + 50 >= (data?.total || 0)}
              onClick={() => onAuditPageChange?.(currentOffset + 50)}
            >
              Next →
            </button>
          </div>
        </div>
        <p className="notice-muted mt-3">
          Tamper-evident audit log for surveillance compliance (PRD DATA-002). Every account provision, screening submission, lab diagnosis, and session lifecycle event is permanently recorded with actor identity and timestamp.
        </p>
      </div>
    )
  }

  return null
}

// ----------------- Main App Component -----------------

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('m3-session') || 'null')
    } catch {
      return null
    }
  })

  const [tab, setTab] = useState('overview')
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [auditEntityType, setAuditEntityType] = useState('')
  const [auditOffset, setAuditOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [slideFollowupTarget, setSlideFollowupTarget] = useState<{ id: string; code: string } | null>(null)

  const t = labels[language]
  const token = session?.access_token

  const roles = session?.user?.roles || []
  const isClinician = roles.includes('clinician')
  const isPathologist = roles.includes('pathologist') || roles.includes('pathology')
  const isContractor = roles.includes('contractor')
  const isHealthWorker = roles.includes('health_worker')
  const isResearchLab = roles.includes('research_lab')
  const isAdmin = roles.includes('admin')
  const ALL_ROLES = ['worker', 'contractor', 'pathologist', 'pathology', 'clinician', 'health_worker', 'research_lab', 'admin']

  useEffect(() => {
    if (session) {
      sessionStorage.setItem('m3-session', JSON.stringify(session))
    } else {
      sessionStorage.removeItem('m3-session')
    }
  }, [session])

  async function loadData() {
    if (!token) return
    if (tab === 'analytics') {
      setLoading(false)
      return
    }
    let path = '/dashboard'
    if (tab === 'workers') {
      path = `/workers?limit=50${query ? `&q=${encodeURIComponent(query)}` : ''}`
    } else if (tab === 'cases') {
      path = '/cases?limit=50'
    } else if (tab === 'samples') {
      path = '/samples?limit=50'
    } else if (tab === 'followups') {
      path = '/follow-ups?limit=50'
    } else if (tab === 'sites') {
      path = '/sites'
    } else if (tab === 'research') {
      path = '/research-results'
    } else if (tab === 'reports') {
      path = '/dashboard'
    } else if (tab === 'audit') {
      const params = new URLSearchParams()
      params.set('limit', '50')
      params.set('offset', String(auditOffset))
      if (auditAction) params.set('action', auditAction)
      if (auditEntityType) params.set('entity_type', auditEntityType)
      path = `/audit-events?${params.toString()}`
    }

    setLoading(true)
    setError('')
    try {
      const res = await api(path, token)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tab, token, query, auditAction, auditEntityType, auditOffset])

  const navAll: [string, string, string[]][] = [
    // Server-enforced read scopes (PRD section 3/4): filtered per signed-in role so the
    // console never presents a tab whose data the role cannot read (P1 requirement).
    // Hiding is UX only; the server independently enforces every endpoint.
    ['overview', t.overview, ALL_ROLES],
    ['analytics', 'Surveillance Analytics', ['admin', 'clinician', 'research_lab', 'pathologist', 'pathology']],
    ['cases', 'Case Queue', ['clinician', 'admin', 'contractor', 'health_worker', 'pathologist', 'pathology']],
    ['workers', t.workers, ['health_worker', 'contractor', 'admin', 'clinician']],
    ['samples', t.samples, ['pathologist', 'pathology', 'clinician']],
    ['followups', t.followups, ['health_worker', 'clinician', 'admin']],
    ['sites', t.sites, ['contractor', 'health_worker', 'admin', 'clinician']],
    ['research', 'Research Results', ['research_lab', 'clinician']],
    ['reports', t.reports, ['health_worker', 'research_lab', 'admin', 'clinician']],
    ['audit', t.auditLog, ['admin']],
  ]
  const nav = navAll
    .filter(([, , allowed]) => isAdmin || allowed.some((r) => roles.includes(r)))
    .map(([id, label]) => [id, label] as [string, string])

  // Reset to a permitted tab if the active tab disappears for this role.
  useEffect(() => {
    if (session && !nav.some(([id]) => id === tab)) setTab('overview')
  }, [session, nav.map(([id]) => id).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAcknowledgeCase(caseId: string) {
    if (!token) return
    try {
      await api(`/cases/${caseId}/acknowledge`, token, { method: 'POST' })
      await loadData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to acknowledge case')
    }
  }

  if (!session) {
    return (
      <Login
        onSession={setSession}
        language={language}
        onToggleLang={() => setLanguage(language === 'en' ? 'hi' : 'en')}
      />
    )
  }

  return (
    <div className="shell">
      {/* Mobile Top Bar */}
      <header className="mobile-header">
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="mobile-title">M3 SURVEILLANCE</span>
        <span className="badge-online">Online</span>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="eyebrow">M3 / MALARIA SURVEILLANCE</span>
          <h2 className="brand-title">Control Console</h2>
          <div className="user-profile">
            <strong className="user-name">{session.user.display_name}</strong>
            <div className="user-roles">
              {session.user.roles.map((r) => (
                <span key={r} className="role-tag">{r}</span>
              ))}
            </div>
            {isHealthWorker && !isClinician && (
              <span className="role-scope-hint">Field Health Worker (Read-Only Mutations)</span>
            )}
            {isResearchLab && !isClinician && (
              <span className="role-scope-hint">Research Lab (De-identified View)</span>
            )}
            {isAdmin && (
              <span className="role-scope-hint">Administrator (Audit & Read-Only Mutations)</span>
            )}
          </div>
        </div>

        <nav className="nav-menu">
          {nav.map(([id, label]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              onClick={() => {
                setTab(id)
                setMenuOpen(false)
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn-secondary btn-sm"
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          >
            {language === 'en' ? 'हिन्दी में देखें' : 'Switch to English'}
          </button>
          <button
            className="btn-outline btn-sm"
            onClick={async () => {
              // P2: revoke the server-side session, best-effort (needs connectivity).
              try {
                await api('/auth/logout', token, { method: 'POST' })
              } catch {
                /* offline or already expired: sessionStorage-scoped session dies with the tab anyway */
              }
              setSession(null)
              sessionStorage.removeItem('m3-session')
            }}
          >
            {t.signOut}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content">
        <header className="content-header">
          <div>
            <span className="eyebrow">AUTHORIZED SURVEILLANCE CONSOLE</span>
            <h1 className="page-heading">
              {nav.find((x) => x[0] === tab)?.[1]}
            </h1>
          </div>
          <div className="header-actions">
            <button
              className="btn-outline btn-sm"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : t.refresh}
            </button>
            <span className="badge-online">API Connected</span>
          </div>
        </header>

        <div className="notice-banner">
          {t.synthetic}
        </div>

        {/* Tab Controls & Filters */}
        {tab === 'workers' && (
          <div className="filter-bar">
            <input
              type="search"
              className="search-input"
              placeholder={t.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {tab === 'audit' && (
          <div className="filter-bar">
            <div className="filter-row">
              <input
                type="search"
                className="filter-select"
                placeholder="Filter by Action (e.g. auth.login)..."
                value={auditAction}
                onChange={(e) => {
                  setAuditAction(e.target.value)
                  setAuditOffset(0)
                }}
              />
              <input
                type="search"
                className="filter-select"
                placeholder="Filter by Entity Type (e.g. worker, sample)..."
                value={auditEntityType}
                onChange={(e) => {
                  setAuditEntityType(e.target.value)
                  setAuditOffset(0)
                }}
              />
              {(auditAction || auditEntityType) && (
                <button
                  className="btn-outline btn-xs"
                  onClick={() => {
                    setAuditAction('')
                    setAuditEntityType('')
                    setAuditOffset(0)
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        )}

        {error ? (
          <div className="state-card error-card">
            <h3>{t.offline}</h3>
            <p>{error}</p>
            <button className="btn-primary btn-sm mt-3" onClick={loadData}>Retry</button>
          </div>
        ) : loading ? (
          <div className="state-card loading-card">
            <div className="spinner" />
            <p>{t.loading}</p>
          </div>
        ) : tab === 'analytics' ? (
          <AnalyticsDashboard token={session.access_token} roles={roles} />
        ) : tab === 'overview' || tab === 'reports' ? (
          <div className="overview-view">
            <div className="metrics-grid">
              <MetricCard label="Total Registered Workers" value={data?.workers ?? '—'} help="Enrolled across all active sites" />
              <MetricCard label="Pending Lab Samples" value={data?.samples_pending ?? 'Restricted'} help="Awaiting microscopy evaluation" />
              <MetricCard label="Positive Parasite Tests" value={data?.tests_positive ?? 'Restricted'} help="Laboratory or RDT confirmed" />
              <MetricCard label="Follow-ups Due" value={data?.followups_due ?? 0} help="Scheduled within protocol window" />
              <MetricCard label="Follow-ups Overdue" value={data?.followups_overdue ?? 0} help="Overdue beyond due_at timestamp" />
            </div>

            <div className="overview-section">
              <h3>Goa Malaria Elimination Surveillance Protocol</h3>
              <p className="notice-muted mt-2">
                Under the Goa State Comprehensive Malaria Surveillance Framework (M3), active screening questionnaires, point-of-care RDTs, and confirmatory laboratory microscopy are tracked chronologically. Diagnostic findings inform clinician care plans without automated override. Health workers dispatch follow-up visits on Day 3, 7, 14, and 28 to ensure radical cure and prevent secondary transmission in migrant labour settlements.
              </p>
            </div>
          </div>
        ) : (
          <RecordsTable
            tab={tab}
            data={data}
            t={t}
            onSelectWorker={(id) => setSelectedWorkerId(id)}
            onSlideFollowup={(id, code) => setSlideFollowupTarget({ id, code })}
            isPathologist={isPathologist}
            auditOffset={auditOffset}
            onAuditPageChange={(offset) => setAuditOffset(offset)}
            onAcknowledgeCase={handleAcknowledgeCase}
          />
        )}
      </main>

      {/* Selected Worker Detail Drawer */}
      {selectedWorkerId && (
        <WorkerDrawer
          workerId={selectedWorkerId}
          session={session}
          onClose={() => setSelectedWorkerId(null)}
          onRefresh={loadData}
        />
      )}

      {/* Slide Follow-up Modal triggered from Samples Table */}
      {slideFollowupTarget && (
        <SlideFollowupModal
          sampleId={slideFollowupTarget.id}
          sampleCode={slideFollowupTarget.code}
          token={session.access_token}
          onClose={() => setSlideFollowupTarget(null)}
          onSuccess={() => {
            setSlideFollowupTarget(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReset = () => {
    sessionStorage.removeItem('m3-session')
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto', fontFamily: 'system-ui, sans-serif', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>Something went wrong</h2>
          <p style={{ color: '#475569', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            An unexpected error occurred in the surveillance console:
            <br />
            <code style={{ background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.875rem' }}>
              {this.state.error?.message || 'Unknown error'}
            </code>
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              Reload Page
            </button>
            <button
              onClick={this.handleReset}
              style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              Clear Session & Reset
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
