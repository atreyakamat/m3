import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { api } from '@/src/api'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import {
  saveDraft,
  readDraft,
  deleteDraft,
  enqueueOutbox,
  readOutbox,
  removeOutbox,
  setOutboxStatus,
  outboxCount,
  isAuthError,
  getPendingRequestId,
  setPendingRequestId,
  clearPendingRequestId,
  DEMO_OWNER,
} from '@/src/cache'
import {
  Button,
  Field,
  Card,
  ChipPicker,
  MultiChipPicker,
  StepIndicator,
  NoticeBanner,
  LoadingSpinner,
  StatusBadge,
  FormShell,
  FormScrollApi,
} from '@/components/ui'
import { CalendarDatePickerField } from '@/components/CalendarDatePickerField'
import {
  addCalendarYears,
  ageInCompletedYears,
  dobMaxISO,
  dobMinISO,
  todayISO,
  validateDobISO,
  validatePastEventDate,
  validatePlannedTravelDates,
} from '@/src/dateFields'

interface TravelEpisodeState {
  departure_date: string
  return_date: string
  place_state: string
  fever_malaria_during: 'yes' | 'no' | ''
  treatment_given?: 'yes' | 'no' | ''
  full_course_completed?: 'yes' | 'no' | 'not_sure' | ''
  treatment_place?: string
  treatment_place_other?: string
}

interface QuestionnaireFormData {
  personal: {
    full_name: string
    dob: string
    dob_unknown: 'yes' | 'no' // local fallback when the worker does not know DOB
    age_years: string // manual fallback age (only when dob_unknown === 'yes')
    gender: 'male' | 'female' | ''
    mobile: string
    alternate_contact: string
    id_type: 'aadhaar' | 'voter_id' | 'other' | ''
    id_other_details: string
    address_present: string
    address_permanent: string
    preferred_language: 'hindi' | 'english' | 'bengali' | 'other' | ''
    site_id?: string
  }
  past_history: {
    diagnosed_malaria: 'yes' | 'no' | 'dont_know' | ''
    times_malaria_2y: string
    last_detection: 'less_1_year' | '1_2_years' | 'dont_know' | ''
    treatment_place: 'uhc_phc' | 'private_clinic' | 'govt_hospital' | 'pharmacy' | 'other' | ''
    treatment_place_other: string
    diagnostic_test_performed: 'yes' | 'no' | ''
    same_day_report: 'yes' | 'no' | ''
    test_method: 'rdt' | 'microscopy' | 'not_sure' | ''
    medication_period: 'days_3' | 'days_14' | 'followup_28' | 'not_informed' | 'dont_know' | ''
    full_course_completed: 'yes' | 'no' | 'not_sure' | ''
    // Source questionnaire page 2, recorded alongside Section II.
    repellent_use: 'yes' | 'no' | ''
    mosquito_net_use: 'yes' | 'no' | ''
    mobile_brand: string
    qualification: string
  }
  present_clinical: {
    fever_today: 'yes' | 'no' | 'not_sure' | ''
    temperature_c: string
    fever_duration: 'within_24h' | '1_3_days' | 'more_3_days' | 'not_required' | ''
    symptoms: string[]
    onset_date: string
    breathing_difficulty: 'yes' | 'no' | ''
    chest_pain: 'yes' | 'no' | ''
    confusion: 'yes' | 'no' | ''
    can_attend_testing: 'yes' | 'no' | 'not_required' | ''
  }
  migration_history: {
    time_in_goa: 'up_to_1_month' | '1_6_months' | '6_months_or_more' | ''
    outside_goa_3m: 'yes' | 'no' | ''
    states_visited: string
    last_stay_home_state: '7_days' | '14_days' | 'up_to_1_month' | ''
    fever_before_goa_3m: 'yes' | 'no' | 'dont_know' | ''
  }
  planned_travel: {
    planning: 'yes' | 'no' | ''
    episodes: TravelEpisodeState[]
  }
}

const INITIAL_FORM: QuestionnaireFormData = {
  personal: {
    full_name: '',
    dob: '',
    dob_unknown: 'no',
    age_years: '',
    gender: 'male',
    mobile: '',
    alternate_contact: '',
    id_type: 'aadhaar',
    id_other_details: '',
    address_present: '',
    address_permanent: '',
    preferred_language: 'hindi',
    site_id: '',
  },
  past_history: {
    diagnosed_malaria: 'no',
    times_malaria_2y: '',
    last_detection: '',
    treatment_place: '',
    treatment_place_other: '',
    diagnostic_test_performed: '',
    same_day_report: '',
    test_method: '',
    medication_period: '',
    full_course_completed: '',
    repellent_use: '',
    mosquito_net_use: '',
    mobile_brand: '',
    qualification: '',
  },
  present_clinical: {
    fever_today: 'no',
    temperature_c: '',
    fever_duration: '',
    symptoms: ['no_other_symptoms'],
    onset_date: '',
    breathing_difficulty: 'no',
    chest_pain: 'no',
    confusion: 'no',
    can_attend_testing: 'not_required',
  },
  migration_history: {
    time_in_goa: '1_6_months',
    outside_goa_3m: 'no',
    states_visited: '',
    last_stay_home_state: '',
    fever_before_goa_3m: 'no',
  },
  planned_travel: {
    planning: 'no',
    episodes: [],
  },
}

const SYMPTOM_OPTIONS = [
  { label: 'No other symptoms', value: 'no_other_symptoms' },
  { label: 'Chills / Shivering', value: 'chills_shivering' },
  { label: 'Headache', value: 'headache' },
  { label: 'Sweating', value: 'sweating' },
  { label: 'Body ache', value: 'body_ache' },
  { label: 'Nausea / Vomiting', value: 'nausea_vomiting' },
  { label: 'Weakness / Fatigue', value: 'weakness_fatigue' },
]

export default function Intake() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)

  const owner = session?.user?.id || DEMO_OWNER
  const isWorker = session?.user?.roles?.includes('worker')

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<QuestionnaireFormData>(INITIAL_FORM)
  const [sites, setSites] = useState<{ id: string; code: string; name: string; area: string }[]>([])
  const [loadingSites, setLoadingSites] = useState(false)
  // Draft state for the visible saved-draft indicator
  const [lastDraftAt, setLastDraftAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [draftSavedMsg, setDraftSavedMsg] = useState('')
  const [queuedCount, setQueuedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const scrollApiRef = useRef<FormScrollApi | null>(null)

  // Load authorized sites & initial draft on mount
  useEffect(() => {
    async function init() {
      // 1. Read local draft first
      const local = readDraft(owner)
      if (local && typeof local === 'object') {
        setFormData((prev) => ({
          ...prev,
          ...local,
          personal: { ...prev.personal, ...(local.personal || {}) },
          past_history: { ...prev.past_history, ...(local.past_history || {}) },
          present_clinical: { ...prev.present_clinical, ...(local.present_clinical || {}) },
          migration_history: { ...prev.migration_history, ...(local.migration_history || {}) },
          planned_travel: { ...prev.planned_travel, ...(local.planned_travel || {}) },
        }))
      }

      // 2. If online worker, check server draft
      if (online && session?.token && isWorker && !session?.demo) {
        try {
          const res = await api<{ submission_id: string | null; data?: any }>(
            '/questionnaires/draft',
            session.token
          )
          if (res?.data && Object.keys(res.data).length > 0) {
            setFormData((prev) => ({
              ...prev,
              ...res.data,
              personal: { ...prev.personal, ...(res.data.personal || {}) },
              past_history: { ...prev.past_history, ...(res.data.past_history || {}) },
              present_clinical: { ...prev.present_clinical, ...(res.data.present_clinical || {}) },
              migration_history: { ...prev.migration_history, ...(res.data.migration_history || {}) },
              planned_travel: { ...prev.planned_travel, ...(res.data.planned_travel || {}) },
            }))
          }
        } catch {
          // Fall back gracefully to local draft
        }
      }

      // Prepopulate worker profile details from authenticated session if not set
      const userDisplayName = session?.user?.display_name
      const userPhone = session?.user?.phone_e164
      if (userDisplayName || userPhone) {
        setFormData((prev) => ({
          ...prev,
          personal: {
            ...prev.personal,
            full_name: prev.personal.full_name || userDisplayName || '',
            mobile: prev.personal.mobile || userPhone || '',
            preferred_language: prev.personal.preferred_language || (language === 'hi' ? 'hindi' : 'english'),
          },
        }))
      }

      // 3. Load sites
      if (session?.token && online && !session?.demo) {
        setLoadingSites(true)
        try {
          const res = await api<{ items: any[] }>('/sites', session.token)
          if (res?.items) setSites(res.items)
        } catch {
          // Sites unavailable
        } finally {
          setLoadingSites(false)
        }
      }

      setQueuedCount(outboxCount(owner)); setFailedCount(outboxCount(owner, "failed"))
    }

    init()
  }, [owner, session?.token, online, isWorker, session?.demo])

  // Flush any writes queued while offline, oldest first, stopping at the first
  // transport failure. Each item carries its own client_request_id, so a server
  // duplicate-ack still counts as success and retries cannot create duplicates
  // (PRD SCR-006; P0 offline registration reconciliation).
  // Item kinds:
  //  - 'worker_register': payload = { worker: <WorkerCreate body with client_request_id>,
  //        questionnaire: { data, client_request_id } }; the profile is created first,
  //        then the questionnaire submitted against the (server-side) new profile.
  //  - 'questionnaire_submit': payload = { data, client_request_id }.
  const flushOutbox = useCallback(async () => {
    if (!online || !session?.token || session?.demo) return
    const items = readOutbox(owner).filter((item) => item.status !== 'failed')
    for (const item of items) {
      setOutboxStatus(item.id, 'syncing', null)
      try {
        if (item.kind === 'worker_register') {
          const { worker, questionnaire } = item.payload
          const created = await api<any>('/workers', session.token, {
            method: 'POST',
            body: JSON.stringify(worker),
          })
          if (created?.id) {
            useAppStore.setState({
              session: { ...(session as any), user: { ...(session!.user as any), patient_id: created.id } },
            })
          }
          await api('/questionnaires/submit', session.token, {
            method: 'POST',
            body: JSON.stringify(questionnaire),
          })
        } else if (item.kind === 'symptom_report') {
          await api('/symptom-reports', session.token, {
            method: 'POST',
            body: JSON.stringify(item.payload),
          })
        } else {
          await api('/questionnaires/submit', session.token, {
            method: 'POST',
            body: JSON.stringify(item.payload),
          })
        }
        removeOutbox(item.id)
        // Authoritative server ack: retire the pending idempotency key that
        // belongs to this item if it still matches (never touches another
        // owner's key or a minted-for-newer-attempt key).
        const itemCrid = item.kind === 'worker_register'
          ? item.payload?.questionnaire?.client_request_id
          : item.payload?.client_request_id
        if (itemCrid) clearPendingRequestId(owner, itemCrid, item.kind === 'symptom_report' ? 'symptom_report' : 'questionnaire')
        deleteDraft(owner) // server accepted the full item; local draft is now redundant
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (isAuthError(message)) {
          // Expired/revoked session: keep every queued record, surface the reason.
          setOutboxStatus(item.id, 'failed', 'Session expired. Sign in again to send queued records.')
          break
        }
        if (/\(4(0[03-9]|22)\)|Invalid|required|Validation|validation|Duplicate|already exists|already uses/.test(message)) {
          // Permanent rejection (validation/404/409): keep the draft locally so the
          // user can review and fix it, but stop treating the queue item as retryable.
          setOutboxStatus(item.id, 'failed', message)
          continue
        }
        // Transport/offline problem: return to the durably queued state and retry later.
        setOutboxStatus(item.id, 'queued', message || 'Network unavailable', 1)
        break
      }
    }
    setQueuedCount(outboxCount(owner))
    setFailedCount(outboxCount(owner, 'failed'))
  }, [owner, online, session?.token, session?.demo])

  // Replay queued offline submissions whenever connectivity or session returns.
  useEffect(() => {
    flushOutbox()
  }, [online, session?.token, flushOutbox])

  // Save draft locally & remotely
  const handleSaveDraft = useCallback(
    async (showFeedback = true) => {
      saveDraft(owner, formData)
      const nowStr = new Date().toLocaleTimeString()
      setLastDraftAt(nowStr)
      let feedback = `Draft saved locally (${nowStr})`

      if (online && session?.token && isWorker && !session?.demo) {
        try {
          await api('/questionnaires/draft', session.token, {
            method: 'PUT',
            body: JSON.stringify({ data: buildQuestionnairePayload() }),
          })
          feedback = `Draft saved & synced (${nowStr})`
        } catch {
          feedback = `Saved locally; server sync pending (${nowStr})`
        }
      }

      if (showFeedback) {
        setDraftSavedMsg(feedback)
        setTimeout(() => setDraftSavedMsg(''), 4000)
      }
    },
    [owner, formData, online, session?.token, isWorker, session?.demo]
  )

  // Deliberate draft discard: asks for confirmation, then clears the local
  // draft, its pending offline request id and resets the form state. The
  // matching server draft is simply overwritten by the next save.
  function handleDiscardDraft() {
    Alert.alert(
      'Discard draft?',
      'All answers on this device will be cleared. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            deleteDraft(owner)
            clearPendingRequestId(owner)
            setFormData(INITIAL_FORM)
            setErrors({})
            setLastDraftAt('')
            setStep(1)
            scrollApiRef.current?.scrollToTop()
            setDraftSavedMsg('Draft discarded. The form has been cleared.')
            setTimeout(() => setDraftSavedMsg(''), 4000)
          },
        },
      ]
    )
  }

  // Helper setters
  function updatePersonal<K extends keyof QuestionnaireFormData['personal']>(
    field: K,
    val: QuestionnaireFormData['personal'][K]
  ) {
    setFormData((prev) => ({
      ...prev,
      personal: { ...prev.personal, [field]: val },
    }))
    if (errors[`personal.${field}`]) {
      setErrors((e) => {
        const next = { ...e }
        delete next[`personal.${field}`]
        return next
      })
    }
  }

  function updatePastHistory<K extends keyof QuestionnaireFormData['past_history']>(
    field: K,
    val: QuestionnaireFormData['past_history'][K]
  ) {
    setFormData((prev) => ({
      ...prev,
      past_history: { ...prev.past_history, [field]: val },
    }))
    if (errors[`past_history.${field}`]) {
      setErrors((e) => {
        const next = { ...e }
        delete next[`past_history.${field}`]
        return next
      })
    }
  }

  function updatePresentClinical<K extends keyof QuestionnaireFormData['present_clinical']>(
    field: K,
    val: QuestionnaireFormData['present_clinical'][K]
  ) {
    setFormData((prev) => ({
      ...prev,
      present_clinical: { ...prev.present_clinical, [field]: val },
    }))
    if (errors[`present_clinical.${field}`]) {
      setErrors((e) => {
        const next = { ...e }
        delete next[`present_clinical.${field}`]
        return next
      })
    }
  }

  function handleSymptomToggle(symptomCode: string) {
    const current = formData.present_clinical.symptoms
    let next: string[] = []

    if (symptomCode === 'no_other_symptoms') {
      next = ['no_other_symptoms']
    } else {
      const filtered = current.filter((s) => s !== 'no_other_symptoms')
      if (filtered.includes(symptomCode)) {
        next = filtered.filter((s) => s !== symptomCode)
      } else {
        next = [...filtered, symptomCode]
      }
      if (next.length === 0) {
        next = ['no_other_symptoms']
      }
    }

    updatePresentClinical('symptoms', next)
  }

  function updateMigration<K extends keyof QuestionnaireFormData['migration_history']>(
    field: K,
    val: QuestionnaireFormData['migration_history'][K]
  ) {
    setFormData((prev) => ({
      ...prev,
      migration_history: { ...prev.migration_history, [field]: val },
    }))
    if (errors[`migration_history.${field}`]) {
      setErrors((e) => {
        const next = { ...e }
        delete next[`migration_history.${field}`]
        return next
      })
    }
  }

  function updateTravelPlanning(val: 'yes' | 'no') {
    setFormData((prev) => {
      const episodes: TravelEpisodeState[] =
        val === 'yes' && prev.planned_travel.episodes.length === 0
          ? [
              {
                departure_date: '',
                return_date: '',
                place_state: '',
                fever_malaria_during: 'no',
                treatment_given: 'no',
              },
            ]
          : prev.planned_travel.episodes
      return {
        ...prev,
        planned_travel: { planning: val, episodes },
      }
    })
  }

  function updateEpisode(idx: number, patch: Partial<TravelEpisodeState>) {
    setFormData((prev) => {
      const eps = [...prev.planned_travel.episodes]
      eps[idx] = { ...eps[idx], ...patch }
      return {
        ...prev,
        planned_travel: { ...prev.planned_travel, episodes: eps },
      }
    })
  }

  function addEpisode() {
    if (formData.planned_travel.episodes.length >= 10) return
    setFormData((prev) => ({
      ...prev,
      planned_travel: {
        ...prev.planned_travel,
        episodes: [
          ...prev.planned_travel.episodes,
          {
            departure_date: '',
            return_date: '',
            place_state: '',
            fever_malaria_during: 'no',
          },
        ],
      },
    }))
  }

  function removeEpisode(idx: number) {
    setFormData((prev) => {
      const eps = prev.planned_travel.episodes.filter((_, i) => i !== idx)
      return {
        ...prev,
        planned_travel: { ...prev.planned_travel, episodes: eps },
      }
    })
  }

  // Section-by-section validation
  // Build the error map for one section WITHOUT committing it to state.
  function computeSectionErrors(sec: number): Record<string, string> {
    const errs: Record<string, string> = {}

    if (sec === 1) {
      const p = formData.personal
      if (!p.full_name || p.full_name.trim().length < 2) {
        errs['personal.full_name'] = 'Full name is required (min 2 characters)'
      }
      if (p.dob_unknown === 'yes') {
        // Fallback: the worker does not know their DOB — manual age only.
        const a = parseInt(p.age_years, 10)
        if (isNaN(a) || a < 0 || a > 120) {
          errs['personal.age_years'] = 'Completed age must be between 0 and 120'
        }
      } else {
        const dobErr = validateDobISO(p.dob)
        if (!p.dob) {
          errs['personal.dob'] = 'Date of birth is required (tap the field to pick it)'
        } else if (dobErr) {
          errs['personal.dob'] = dobErr
        }
      }
      if (!p.mobile || p.mobile.replace(/\D/g, '').length < 8) {
        errs['personal.mobile'] = 'A valid mobile number is required (min 8 digits)'
      }
      if (p.id_type === 'other' && !p.id_other_details.trim()) {
        errs['personal.id_other_details'] = 'Details are required when Other ID is selected'
      }
      if (!p.address_present || p.address_present.trim().length < 4) {
        errs['personal.address_present'] = 'Present address is required (min 4 characters)'
      }
    }

    if (sec === 2) {
      const h = formData.past_history
      if (!h.diagnosed_malaria) {
        errs['past_history.diagnosed_malaria'] = 'Please select malaria diagnosis status'
      }
      if (h.diagnosed_malaria === 'yes') {
        const times = parseInt(h.times_malaria_2y, 10)
        if (isNaN(times) || times < 0 || times > 50) {
          errs['past_history.times_malaria_2y'] = 'Enter malaria episodes in last 2 years (0-50)'
        }
        if (!h.last_detection) {
          errs['past_history.last_detection'] = 'Please select timing of last detection'
        }
        if (!h.treatment_place) {
          errs['past_history.treatment_place'] = 'Please select treatment location'
        }
        if (h.treatment_place === 'other' && !h.treatment_place_other.trim()) {
          errs['past_history.treatment_place_other'] = 'Specify other treatment place'
        }
        if (!h.diagnostic_test_performed) {
          errs['past_history.diagnostic_test_performed'] = 'Specify if diagnostic test was performed'
        }
        if (h.diagnostic_test_performed === 'yes') {
          if (!h.same_day_report) {
            errs['past_history.same_day_report'] = 'Specify if same-day report was received'
          }
          if (h.same_day_report === 'yes') {
            if (!h.test_method) {
              errs['past_history.test_method'] = 'Select test method'
            }
            if (!h.medication_period) {
              errs['past_history.medication_period'] = 'Select medication period'
            }
            if (
              ['days_3', 'days_14', 'followup_28'].includes(h.medication_period) &&
              !h.full_course_completed
            ) {
              errs['past_history.full_course_completed'] = 'Specify if full course was completed'
            }
          }
        }
      }
    }

    if (sec === 3) {
      const c = formData.present_clinical
      if (!c.fever_today) {
        errs['present_clinical.fever_today'] = 'Specify current fever status'
      }
      const hasSpecific = c.symptoms.some((s) => s !== 'no_other_symptoms')
      if (['yes', 'not_sure'].includes(c.fever_today) && !c.fever_duration) {
        errs['present_clinical.fever_duration'] = 'Fever duration is required'
      }
      if (c.temperature_c) {
        const t = parseFloat(c.temperature_c)
        if (isNaN(t) || t < 30.0 || t > 45.0) {
          errs['present_clinical.temperature_c'] = 'Temperature must be between 30.0 and 45.0 °C'
        }
      }
      // Onset of the current illness: required with fever or specific
      // symptoms, never in the future (past-event field).
      const needsOnset = c.fever_today === 'yes' || hasSpecific
      if (needsOnset && !c.onset_date) {
        errs['present_clinical.onset_date'] = 'Onset date of the current illness is required'
      } else if (c.onset_date) {
        const onsetErr = validatePastEventDate(c.onset_date, 'Onset date')
        if (onsetErr) errs['present_clinical.onset_date'] = onsetErr
      }
      if (!c.breathing_difficulty) {
        errs['present_clinical.breathing_difficulty'] = 'Required'
      }
      if (!c.chest_pain) {
        errs['present_clinical.chest_pain'] = 'Required'
      }
      if (!c.confusion) {
        errs['present_clinical.confusion'] = 'Required'
      }
      if (!c.can_attend_testing) {
        errs['present_clinical.can_attend_testing'] = 'Required'
      }
    }

    if (sec === 4) {
      const m = formData.migration_history
      if (!m.time_in_goa) {
        errs['migration_history.time_in_goa'] = 'Select duration lived in Goa'
      }
      if (!m.outside_goa_3m) {
        errs['migration_history.outside_goa_3m'] = 'Specify travel outside Goa in last 3 months'
      }
      if (m.outside_goa_3m === 'yes') {
        if (!m.states_visited.trim()) {
          errs['migration_history.states_visited'] = 'Specify states visited outside Goa'
        }
        if (!m.last_stay_home_state) {
          errs['migration_history.last_stay_home_state'] = 'Select duration of stay in home state'
        }
      }
      if (!m.fever_before_goa_3m) {
        errs['migration_history.fever_before_goa_3m'] = 'Specify prior fever/malaria history'
      }
    }

    if (sec === 5) {
      const t = formData.planned_travel
      if (!t.planning) {
        errs['planned_travel.planning'] = 'Specify if travel is planned'
      }
      if (t.planning === 'yes') {
        if (t.episodes.length === 0) {
          errs['planned_travel.episodes'] = 'Add at least one travel episode'
        }
        t.episodes.forEach((ep, idx) => {
          const dateErrs = validatePlannedTravelDates(ep.departure_date, ep.return_date)
          if (!ep.departure_date) {
            errs[`episode.${idx}.departure_date`] = 'Departure date is required (tap the field to pick it)'
          } else if (dateErrs.departure) {
            errs[`episode.${idx}.departure_date`] = dateErrs.departure
          }
          if (!ep.return_date) {
            errs[`episode.${idx}.return_date`] = 'Return date is required (tap the field to pick it)'
          } else if (dateErrs.return) {
            errs[`episode.${idx}.return_date`] = dateErrs.return
          }
          if (!ep.place_state.trim()) {
            errs[`episode.${idx}.place_state`] = 'Destination place/state required'
          }
          if (!ep.fever_malaria_during) {
            errs[`episode.${idx}.fever_malaria_during`] = 'Specify fever during travel'
          }
          if (ep.fever_malaria_during === 'yes') {
            if (!ep.treatment_given) {
              errs[`episode.${idx}.treatment_given`] = 'Specify if treatment was given'
            }
            if (ep.treatment_given === 'yes') {
              if (!ep.full_course_completed) {
                errs[`episode.${idx}.full_course_completed`] = 'Course completion required'
              }
              if (!ep.treatment_place) {
                errs[`episode.${idx}.treatment_place`] = 'Treatment place required'
              }
              if (ep.treatment_place === 'other' && !ep.treatment_place_other?.trim()) {
                errs[`episode.${idx}.treatment_place_other`] = 'Details required for Other place'
              }
            }
          }
        })
      }
    }

    return errs
  }

  // Canonical field order per section, used to scroll to the FIRST invalid
  // field instead of jumping to the top of the page.
  const SECTION_FIELD_ORDER: Record<number, string[]> = {
    1: [
      'personal.full_name', 'personal.dob', 'personal.age_years', 'personal.gender',
      'personal.mobile', 'personal.alternate_contact', 'personal.id_type',
      'personal.id_other_details', 'personal.address_present', 'personal.address_permanent',
    ],
    2: [
      'past_history.diagnosed_malaria', 'past_history.times_malaria_2y',
      'past_history.last_detection', 'past_history.treatment_place',
      'past_history.treatment_place_other', 'past_history.diagnostic_test_performed',
      'past_history.same_day_report', 'past_history.test_method',
      'past_history.medication_period', 'past_history.full_course_completed',
    ],
    3: [
      'present_clinical.fever_today', 'present_clinical.fever_duration',
      'present_clinical.temperature_c', 'present_clinical.onset_date',
      'present_clinical.breathing_difficulty', 'present_clinical.chest_pain',
      'present_clinical.confusion', 'present_clinical.can_attend_testing',
    ],
    4: [
      'migration_history.time_in_goa', 'migration_history.outside_goa_3m',
      'migration_history.states_visited', 'migration_history.last_stay_home_state',
      'migration_history.fever_before_goa_3m',
    ],
    5: [
      'planned_travel.planning', 'planned_travel.episodes',
      'episode.0.departure_date', 'episode.0.return_date', 'episode.0.place_state',
      'episode.0.fever_malaria_during', 'episode.0.treatment_given',
      'episode.0.full_course_completed', 'episode.0.treatment_place',
      'episode.0.treatment_place_other',
    ],
  }
  const EPISODE_KEY_ORDER = [
    'departure_date', 'return_date', 'place_state', 'fever_malaria_during',
    'treatment_given', 'full_course_completed', 'treatment_place', 'treatment_place_other',
  ]

  function firstErrorKey(section: number, errs: Record<string, string>): string | null {
    for (const key of SECTION_FIELD_ORDER[section] || []) {
      if (errs[key]) return key
    }
    // Episode indexes beyond the first are dynamic: lowest index, canonical
    // suffix order.
    if (section === 5) {
      const idxs = Array.from(new Set(
        Object.keys(errs)
          .map((k) => k.match(/^episode\.(\d+)\./)?.[1])
          .filter((v): v is string => Boolean(v))
      )).sort((a, b) => Number(a) - Number(b))
      for (const idx of idxs) {
        for (const suffix of EPISODE_KEY_ORDER) {
          const key = `episode.${idx}.${suffix}`
          if (errs[key]) return key
        }
      }
    }
    return Object.keys(errs)[0] || null
  }

  function goToStep(nextStep: number) {
    if (nextStep > step) {
      const errs = computeSectionErrors(step)
      setErrors(errs)
      if (Object.keys(errs).length > 0) {
        // Scroll to the FIRST invalid field so the user sees the problem.
        const key = firstErrorKey(step, errs)
        if (key) scrollApiRef.current?.scrollToError(key)
        else scrollApiRef.current?.scrollToTop()
        return
      }
    }
    // Keyboard must not leak into the next page; state values are untouched.
    Keyboard.dismiss()
    // Auto-save draft on step change
    handleSaveDraft(false)
    setStep(nextStep)
    scrollApiRef.current?.scrollToTop()
  }

  // Construct pure PRD schema payload
  function buildQuestionnairePayload() {
    const p = formData.personal
    const h = formData.past_history
    const c = formData.present_clinical
    const m = formData.migration_history
    const tData = formData.planned_travel

    const personalPayload: Record<string, any> = {
      full_name: p.full_name.trim(),
      gender: p.gender,
      mobile: p.mobile.trim(),
      id_type: p.id_type,
      address_present: p.address_present.trim(),
      preferred_language: p.preferred_language,
    }
    if (p.dob) {
      // DOB is the source of truth; send it together with its auto-calculated
      // age in completed years (server validates the pairing).
      personalPayload.dob = p.dob
      const age = ageInCompletedYears(p.dob)
      if (age !== null) personalPayload.age_years = age
    } else if (p.dob_unknown === 'yes' && p.age_years) {
      // Fallback: worker does not know their DOB; completed age only.
      personalPayload.age_years = parseInt(p.age_years, 10)
    }
    if (p.alternate_contact.trim()) personalPayload.alternate_contact = p.alternate_contact.trim()
    if (p.id_type === 'other') personalPayload.id_other_details = p.id_other_details.trim()
    if (p.address_permanent.trim()) personalPayload.address_permanent = p.address_permanent.trim()

    const pastPayload: Record<string, any> = {
      diagnosed_malaria: h.diagnosed_malaria,
    }
    if (h.diagnosed_malaria === 'yes') {
      pastPayload.times_malaria_2y = parseInt(h.times_malaria_2y, 10)
      pastPayload.last_detection = h.last_detection
      pastPayload.treatment_place = h.treatment_place
      if (h.treatment_place === 'other') pastPayload.treatment_place_other = h.treatment_place_other.trim()
      pastPayload.diagnostic_test_performed = h.diagnostic_test_performed
      if (h.diagnostic_test_performed === 'yes') {
        pastPayload.same_day_report = h.same_day_report
        if (h.same_day_report === 'yes') {
          pastPayload.test_method = h.test_method
          pastPayload.medication_period = h.medication_period
          if (['days_3', 'days_14', 'followup_28'].includes(h.medication_period)) {
            pastPayload.full_course_completed = h.full_course_completed
          }
        }
      }
    }
    // Source page 2 add-ons (optional).
    if (h.repellent_use) pastPayload.repellent_use = h.repellent_use
    if (h.mosquito_net_use) pastPayload.mosquito_net_use = h.mosquito_net_use
    if (h.mobile_brand.trim()) pastPayload.mobile_brand = h.mobile_brand.trim()
    if (h.qualification.trim()) pastPayload.qualification = h.qualification.trim()

    const clinicalPayload: Record<string, any> = {
      fever_today: c.fever_today,
      symptoms: c.symptoms,
      breathing_difficulty: c.breathing_difficulty,
      chest_pain: c.chest_pain,
      confusion: c.confusion,
      can_attend_testing: c.can_attend_testing,
    }
    if (c.temperature_c) clinicalPayload.temperature_c = parseFloat(c.temperature_c)
    if (['yes', 'not_sure'].includes(c.fever_today)) clinicalPayload.fever_duration = c.fever_duration
    // Onset of the current illness: sent when fever is reported or specific
    // symptoms were selected, matching the server-side requirement.
    const clinicalHasSpecific = c.symptoms.some((s) => s !== 'no_other_symptoms')
    if (c.fever_today === 'yes' || clinicalHasSpecific) {
      clinicalPayload.onset_date = c.onset_date
    }

    const migrationPayload: Record<string, any> = {
      time_in_goa: m.time_in_goa,
      outside_goa_3m: m.outside_goa_3m,
      fever_before_goa_3m: m.fever_before_goa_3m,
    }
    if (m.outside_goa_3m === 'yes') {
      migrationPayload.states_visited = m.states_visited
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      migrationPayload.last_stay_home_state = m.last_stay_home_state
    }

    const travelPayload: Record<string, any> = {
      planning: tData.planning,
    }
    if (tData.planning === 'yes') {
      travelPayload.episodes = tData.episodes.map((ep) => {
        const item: Record<string, any> = {
          departure_date: ep.departure_date,
          return_date: ep.return_date,
          place_state: ep.place_state.trim(),
          fever_malaria_during: ep.fever_malaria_during,
        }
        if (ep.fever_malaria_during === 'yes') {
          item.treatment_given = ep.treatment_given
          if (ep.treatment_given === 'yes') {
            item.full_course_completed = ep.full_course_completed
            item.treatment_place = ep.treatment_place
            if (ep.treatment_place === 'other') item.treatment_place_other = ep.treatment_place_other?.trim()
          }
        }
        return item
      })
    }

    return {
      personal: personalPayload,
      past_history: pastPayload,
      present_clinical: clinicalPayload,
      migration_history: migrationPayload,
      planned_travel: travelPayload,
    }
  }

  // Final Submit
  async function handleSubmit() {
    if (submitting) return // repeated-tap guard (button is also disabled while submitting)
    Keyboard.dismiss()
    // Validate all 5 sections; jump to and reveal the FIRST invalid field.
    for (let sIdx = 1; sIdx <= 5; sIdx++) {
      const errs = computeSectionErrors(sIdx)
      if (Object.keys(errs).length > 0) {
        setErrors(errs)
        setStep(sIdx)
        const key = firstErrorKey(sIdx, errs)
        // The target fields mount with the new step; give registration one
        // frame before revealing (form state is untouched by the switch).
        setTimeout(() => {
          if (key) scrollApiRef.current?.scrollToError(key)
          else scrollApiRef.current?.scrollToTop()
        }, 80)
        return
      }
    }

    if (!session?.token || session?.demo) {
      Alert.alert(
        'Offline / Demo Mode',
        'A live authorized session is required to submit screening questionnaires to the surveillance server. Your draft has been safely saved locally.'
      )
      return
    }

    const payload = buildQuestionnairePayload()
    // Idempotency key lifecycle: mint once per logical submission, persisted
    // per owner until the server ACKNOWLEDGES this attempt. Retentions across
    // repeated presses, ambiguous timeouts, and offline/outbox replay prevent
    // duplicate submissions (server dedupes by client_request_id). A genuinely
    // NEW submission happens only after an ack clears the pending key.
    let pendingId = getPendingRequestId(owner)
    let clientReqId = pendingId
    if (!clientReqId) {
      clientReqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      setPendingRequestId(owner, clientReqId)
    }
    const requestBody = {
      data: payload,
      client_request_id: clientReqId,
    }

    const needsProfile = isWorker && !session?.user?.patient_id
    const workerPayload: {
      display_name: string
      dob?: string
      age_years?: number
      gender: string
      mobile: string
      alternate_contact?: string
      id_type: string
      id_other_details?: string
      address_present: string
      address_permanent?: string
      preferred_language: string
      site_id?: string
      consent_status: string
      client_request_id: string
    } | null = needsProfile ? {
      display_name: formData.personal.full_name,
      dob: formData.personal.dob || undefined,
      // Auto-calculated age in completed years from DOB, or the manual
      // fallback when the worker does not know their date of birth.
      age_years: formData.personal.dob
        ? (ageInCompletedYears(formData.personal.dob) ?? undefined)
        : (formData.personal.dob_unknown === 'yes' && formData.personal.age_years
            ? parseInt(formData.personal.age_years, 10)
            : undefined),
      gender: formData.personal.gender,
      mobile: formData.personal.mobile,
      alternate_contact: formData.personal.alternate_contact || undefined,
      id_type: formData.personal.id_type,
      id_other_details: formData.personal.id_other_details || undefined,
      address_present: formData.personal.address_present,
      address_permanent: formData.personal.address_permanent || undefined,
      preferred_language: formData.personal.preferred_language,
      site_id: formData.personal.site_id || undefined,
      consent_status: 'documented',
      // Stable replay key so connectivity loss between create and submit
      // cannot produce a second worker profile (server resolves dup as 200).
      client_request_id: `reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    } : null

    setSubmitting(true)
    try {
      if (online) {
        if (workerPayload) {
          const created = await api<any>('/workers', session.token, {
            method: 'POST',
            body: JSON.stringify(workerPayload),
          })
          if (created?.id) {
            useAppStore.setState({
              session: { ...(session as any), user: { ...(session!.user as any), patient_id: created.id } },
            })
          }
        }
        const res = await api<any>('/questionnaires/submit', session.token, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
        // Authoritative ack (HTTP 2xx, duplicate-flagged replays included):
        // clear the pending idempotency key so the NEXT submission mints a new one.
        clearPendingRequestId(owner, clientReqId)
        deleteDraft(owner)
        Alert.alert(
          'Screening Submitted',
          `Screening submission recorded successfully.\nSubmission ID: ${res?.submission_id || res?.id || 'Confirmed'}${res?.duplicate ? '\n(duplicate request ignored)' : ''}`,
          [
                    {
              text: 'OK',
              onPress: () => router.replace('/dashboard'),
            },
          ]
        )
      } else {
        // Offline: one durable, keyed queue item carrying BOTH the optional
        // worker registration and the questionnaire, replayed in order on reconnect.
        // The draft stays on the device until the server confirms delivery.
        const registrationPayload = {
          worker: workerPayload,
          questionnaire: requestBody,
        }
        enqueueOutbox(owner, workerPayload ? 'worker_register' : 'questionnaire_submit',
          workerPayload ? registrationPayload : requestBody)
        setQueuedCount(outboxCount(owner)); setFailedCount(outboxCount(owner, "failed"))
        Alert.alert(
          'Saved locally for sync',
          'You are offline. This registration and screening questionnaire were saved locally with a unique request ID and will be sent automatically when the connection returns. Do not resubmit, to avoid duplicates.',
          [{ text: 'OK', onPress: () => router.replace('/dashboard') }]
        )
      }
    } catch (e) {
      if (!online) {
        // Nothing half-sent: queue whichever logical write had not been confirmed.
        const registrationPayload = {
          worker: workerPayload,
          questionnaire: requestBody,
        }
        enqueueOutbox(owner, workerPayload ? 'worker_register' : 'questionnaire_submit',
          workerPayload ? registrationPayload : requestBody)
        setQueuedCount(outboxCount(owner)); setFailedCount(outboxCount(owner, "failed"))
        Alert.alert(
          'Saved locally for sync',
          'The server could not be reached. The registration and questionnaire stay queued locally and will retry automatically when the connection returns.',
        )
        return
      }
      const message = e instanceof Error ? e.message : tr('error')
      if (online && isAuthError(message)) {
        Alert.alert(
          'Session expired',
          'Sign in again to send this submission. Your in-progress screening form and any offline-safe content are still on screen.',
        )
        return
      }
      Alert.alert(tr('error'), message)
    } finally {
      setSubmitting(false)
    }
  }

  const stepLabels = [
    'Demographics',
    'Malaria History',
    'Clinical Signs',
    'Mobility',
    'Travel Plans',
    'Review & Submit',
  ]

  const genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
  ]

  const idTypeOptions = [
    { label: 'Aadhaar', value: 'aadhaar' },
    { label: 'Voter ID', value: 'voter_id' },
    { label: 'Other', value: 'other' },
  ]

  const languageOptions = [
    { label: 'Hindi', value: 'hindi' },
    { label: 'English', value: 'english' },
    { label: 'Bengali', value: 'bengali' },
    { label: 'Other', value: 'other' },
  ]

  const TOTAL_STEPS = 6

  // Sticky footer controls (rendered by FormShell OUTSIDE the ScrollView so
  // Previous/Next/Submit stay reachable while the Android keyboard is open).
  // - No Previous on step 1; Submit appears only on the final step.
  // - Answers live in `formData` state and are untouched by navigation.
  const footerControls = (
    <View style={s.footerRow}>
      {step > 1 && (
        <Button
          variant="outline"
          size="md"
          style={{ flex: 1 }}
          onPress={() => goToStep(step - 1)}
        >
          {`← ${stepLabels[step - 2]}`}
        </Button>
      )}
      {step < TOTAL_STEPS && (
        <Button
          variant="primary"
          size="md"
          style={{ flex: 1 }}
          onPress={() => goToStep(step + 1)}
        >
          {`${stepLabels[step]} →`}
        </Button>
      )}
      {step === TOTAL_STEPS && (
        <Button
          variant="primary"
          size="md"
          style={{ flex: 1 }}
          loading={submitting}
          disabled={submitting}
          onPress={handleSubmit}
        >
          Submit Screening
        </Button>
      )}
    </View>
  )

  return (
    <FormShell footer={footerControls} scrollApiRef={scrollApiRef}>
      {/* Top Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.eyebrow}>M3 SURVEILLANCE PLATFORM</Text>
            <Text style={s.title}>Worker Screening</Text>
          </View>
          <View style={s.headerActions}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => handleSaveDraft(true)}
            >
              Save Draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={handleDiscardDraft}
            >
              Discard
            </Button>
          </View>
        </View>
        {/* Explicit saved-draft indicator (timestamp of the last save) */}
        {lastDraftAt ? (
          <StatusBadge label={`Draft saved ${lastDraftAt}`} variant="success" />
        ) : (
          <StatusBadge label="Draft: not saved yet" variant="warning" />
        )}
      </View>

      {/* Step Indicator */}
      <StepIndicator currentStep={step} totalSteps={6} labels={stepLabels} />

        {/* Draft Notification */}
        {draftSavedMsg ? (
          <NoticeBanner type="info" message={draftSavedMsg} />
        ) : null}

        {/* Pending offline submission indicator */}
        {queuedCount > 0 || failedCount > 0 ? (
          <NoticeBanner
            type={failedCount > 0 ? 'error' : 'warning'}
            title={failedCount > 0 ? 'Queued & needs attention' : 'Pending sync'}
            message={[
              queuedCount > 0 ? `${queuedCount} record${queuedCount === 1 ? '' : 's'} queued locally with unique request IDs; they will be sent automatically when the connection returns. Do not resubmit.` : null,
              failedCount > 0 ? `${failedCount} record${failedCount === 1 ? '' : 's'} were rejected or the session expired; nothing was lost — sign in again or correct the record, then reopen this screen to retry.` : null,
            ].filter(Boolean).join(' ')}
          />
        ) : null}

        {/* SECTION 1: PERSONAL DEMOGRAPHICS */}
        {step === 1 && (
          <Card title="Section 1: Demographics & Identity" subtitle="Worker baseline profile">
            <Field
              label="Full Name"
              placeholder="e.g. Ramesh Kumar"
              value={formData.personal.full_name}
              onChangeText={(v) => updatePersonal('full_name', v)}
              error={errors['personal.full_name']}
              errorKey='personal.full_name'
              required
            />

            <CalendarDatePickerField
              label="Date of Birth"
              value={formData.personal.dob}
              onChange={(v) => updatePersonal('dob', v)}
              error={errors['personal.dob']}
              errorKey='personal.dob'
              minISO={dobMinISO()}
              maxISO={dobMaxISO()}
              required
            />
            {formData.personal.dob ? (
              <Text style={s.ageComputedText}>
                Age (in completed years): {ageInCompletedYears(formData.personal.dob) ?? '—'}
              </Text>
            ) : null}

            <ChipPicker
              label="Do you know your date of birth?"
              options={[
                { label: 'Yes — picked above', value: 'no' },
                { label: "No — enter age only", value: 'yes' },
              ]}
              value={formData.personal.dob_unknown || 'no'}
              onChange={(v) => updatePersonal('dob_unknown', v as any)}
              hint="Age fallback for workers without documented birth dates."
            />

            {formData.personal.dob_unknown === 'yes' && (
              <Field
                label="Completed Age (years)"
                placeholder="Years (0-120)"
                keyboardType="numeric"
                value={formData.personal.age_years}
                onChangeText={(v) => updatePersonal('age_years', v)}
                error={errors['personal.age_years']}
                errorKey='personal.age_years'
                required
              />
            )}

            <ChipPicker
              label="Gender"
              options={genderOptions}
              value={formData.personal.gender || 'male'}
              onChange={(v) => updatePersonal('gender', v as any)}
            />

            <View style={s.rowTwo}>
              <Field
                containerStyle={{ flex: 1 }}
                label="Mobile Number"
                placeholder="+91..."
                keyboardType="phone-pad"
                value={formData.personal.mobile}
                onChangeText={(v) => updatePersonal('mobile', v)}
                error={errors['personal.mobile']}
                errorKey='personal.mobile'
                required
              />
              <Field
                containerStyle={{ flex: 1 }}
                label="Alternate Contact"
                placeholder="Optional"
                keyboardType="phone-pad"
                value={formData.personal.alternate_contact}
                onChangeText={(v) => updatePersonal('alternate_contact', v)}
              />
            </View>

            <ChipPicker
              label="Identity Document Type"
              options={idTypeOptions}
              value={formData.personal.id_type || 'aadhaar'}
              onChange={(v) => updatePersonal('id_type', v as any)}
            />

            {formData.personal.id_type === 'other' && (
              <Field
                label="Other Document Details"
                placeholder="Specify type and reference"
                value={formData.personal.id_other_details}
                onChangeText={(v) => updatePersonal('id_other_details', v)}
                error={errors['personal.id_other_details']}
                errorKey='personal.id_other_details'
                required
              />
            )}

            <Field
              label="Present Address (Current in Goa)"
              placeholder="e.g. Room 12, Campal Labour Colony, Panaji"
              multiline
              value={formData.personal.address_present}
              onChangeText={(v) => updatePersonal('address_present', v)}
              error={errors['personal.address_present']}
              errorKey='personal.address_present'
              required
            />

            <Field
              label="Permanent Address (Home State)"
              placeholder="Origin village, district, state"
              multiline
              value={formData.personal.address_permanent}
              onChangeText={(v) => updatePersonal('address_permanent', v)}
            />

            <ChipPicker
              label="Preferred Language"
              options={languageOptions}
              value={formData.personal.preferred_language || 'hindi'}
              onChange={(v) => updatePersonal('preferred_language', v as any)}
            />

            {sites.length > 0 && (
              <ChipPicker
                label="Assigned Construction Site (Optional)"
                options={[
                  { label: 'None / Decoupled', value: '' },
                  ...sites.map((s) => ({
                    label: `${s.code} · ${s.name}`,
                    value: s.id,
                    caption: s.area,
                  })),
                ]}
                value={formData.personal.site_id || ''}
                onChange={(v) => updatePersonal('site_id', v)}
                horizontal={false}
              />
            )}

          </Card>
        )}

        {/* SECTION 2: PAST MALARIA HISTORY */}
        {step === 2 && (
          <Card title="Section 2: Malaria History" subtitle="Previous infection and treatments">
            <ChipPicker
              label="Ever diagnosed with malaria before?"
              options={[
                { label: 'No', value: 'no' },
                { label: 'Yes', value: 'yes' },
                { label: "Don't know", value: 'dont_know' },
              ]}
              value={formData.past_history.diagnosed_malaria}
              onChange={(v) => updatePastHistory('diagnosed_malaria', v as any)}
              error={errors['past_history.diagnosed_malaria']}
              errorKey='past_history.diagnosed_malaria'
            />

            {formData.past_history.diagnosed_malaria === 'yes' && (
              <View style={s.conditionalBlock}>
                <Field
                  label="Episodes in Last 2 Years"
                  placeholder="Number (0-50)"
                  keyboardType="numeric"
                  value={formData.past_history.times_malaria_2y}
                  onChangeText={(v) => updatePastHistory('times_malaria_2y', v)}
                  error={errors['past_history.times_malaria_2y']}
                  errorKey='past_history.times_malaria_2y'
                  required
                />

                <ChipPicker
                  label="Timing of Last Detection"
                  options={[
                    { label: '< 1 year ago', value: 'less_1_year' },
                    { label: '1 - 2 years ago', value: '1_2_years' },
                    { label: "Don't know", value: 'dont_know' },
                  ]}
                  value={formData.past_history.last_detection}
                  onChange={(v) => updatePastHistory('last_detection', v as any)}
                  error={errors['past_history.last_detection']}
                  errorKey='past_history.last_detection'
                />

                <ChipPicker
                  label="Treatment Facility / Place"
                  options={[
                    { label: 'UHC / PHC', value: 'uhc_phc' },
                    { label: 'Govt Hospital', value: 'govt_hospital' },
                    { label: 'Private Clinic', value: 'private_clinic' },
                    { label: 'Pharmacy', value: 'pharmacy' },
                    { label: 'Other', value: 'other' },
                  ]}
                  value={formData.past_history.treatment_place}
                  onChange={(v) => updatePastHistory('treatment_place', v as any)}
                  error={errors['past_history.treatment_place']}
                  errorKey='past_history.treatment_place'
                />

                {formData.past_history.treatment_place === 'other' && (
                  <Field
                    label="Other Treatment Place Details"
                    placeholder="Describe facility"
                    value={formData.past_history.treatment_place_other}
                    onChangeText={(v) => updatePastHistory('treatment_place_other', v)}
                    error={errors['past_history.treatment_place_other']}
                    errorKey='past_history.treatment_place_other'
                    required
                  />
                )}

                <ChipPicker
                  label="Diagnostic Test Performed?"
                  options={[
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                  ]}
                  value={formData.past_history.diagnostic_test_performed}
                  onChange={(v) => updatePastHistory('diagnostic_test_performed', v as any)}
                  error={errors['past_history.diagnostic_test_performed']}
                  errorKey='past_history.diagnostic_test_performed'
                />

                {formData.past_history.diagnostic_test_performed === 'yes' && (
                  <View style={s.subConditionalBlock}>
                    <ChipPicker
                      label="Same-Day Report Received?"
                      options={[
                        { label: 'Yes', value: 'yes' },
                        { label: 'No', value: 'no' },
                      ]}
                      value={formData.past_history.same_day_report}
                      onChange={(v) => updatePastHistory('same_day_report', v as any)}
                      error={errors['past_history.same_day_report']}
                      errorKey='past_history.same_day_report'
                    />

                    {formData.past_history.same_day_report === 'yes' && (
                      <>
                        <ChipPicker
                          label="Test Method"
                          options={[
                            { label: 'RDT Strip', value: 'rdt' },
                            { label: 'Microscopy Slide', value: 'microscopy' },
                            { label: 'Not sure', value: 'not_sure' },
                          ]}
                          value={formData.past_history.test_method}
                          onChange={(v) => updatePastHistory('test_method', v as any)}
                          error={errors['past_history.test_method']}
                          errorKey='past_history.test_method'
                        />

                        <ChipPicker
                          label="Medication Period Prescribed"
                          options={[
                            { label: '3 Days', value: 'days_3' },
                            { label: '14 Days', value: 'days_14' },
                            { label: '28-Day Followup', value: 'followup_28' },
                            { label: 'Not Informed', value: 'not_informed' },
                            { label: "Don't Know", value: 'dont_know' },
                          ]}
                          value={formData.past_history.medication_period}
                          onChange={(v) => updatePastHistory('medication_period', v as any)}
                          error={errors['past_history.medication_period']}
                          errorKey='past_history.medication_period'
                        />

                        {['days_3', 'days_14', 'followup_28'].includes(
                          formData.past_history.medication_period
                        ) && (
                          <ChipPicker
                            label="Full Course Completed?"
                            options={[
                              { label: 'Yes', value: 'yes' },
                              { label: 'No', value: 'no' },
                              { label: 'Not sure', value: 'not_sure' },
                            ]}
                            value={formData.past_history.full_course_completed}
                            onChange={(v) =>
                              updatePastHistory('full_course_completed', v as any)
                            }
                            error={errors['past_history.full_course_completed']}
                            errorKey='past_history.full_course_completed'
                          />
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Source questionnaire page 2, survey add-ons (optional). */}
            <View style={s.dangerSignsBox}>
              <Text style={s.dangerSignsTitle}>Protection & Profile (Optional)</Text>
              <ChipPicker
                label="Do you use mosquito repellent?"
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ]}
                value={formData.past_history.repellent_use}
                onChange={(v) => updatePastHistory('repellent_use', v as any)}
                error={errors['past_history.repellent_use']}
                errorKey='past_history.repellent_use'
              />
              <ChipPicker
                label="Do you sleep under a mosquito net?"
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ]}
                value={formData.past_history.mosquito_net_use}
                onChange={(v) => updatePastHistory('mosquito_net_use', v as any)}
                error={errors['past_history.mosquito_net_use']}
                errorKey='past_history.mosquito_net_use'
              />
              <Field
                label="Mobile Brand"
                placeholder="e.g. Samsung (optional)"
                value={formData.past_history.mobile_brand}
                onChangeText={(v) => updatePastHistory('mobile_brand', v)}
                error={errors['past_history.mobile_brand']}
                errorKey='past_history.mobile_brand'
              />
              <Field
                label="Qualification"
                placeholder="e.g. Class 10 (optional)"
                value={formData.past_history.qualification}
                onChangeText={(v) => updatePastHistory('qualification', v)}
                error={errors['past_history.qualification']}
                errorKey='past_history.qualification'
              />
            </View>

          </Card>
        )}

        {/* SECTION 3: PRESENT CLINICAL PRESENTATION */}
        {step === 3 && (
          <Card title="Section 3: Present Clinical Presentation" subtitle="Current symptoms and red flags">
            <ChipPicker
              label="Fever today or in the last 48 hours?"
              options={[
                { label: 'No', value: 'no' },
                { label: 'Yes', value: 'yes' },
                { label: 'Not sure', value: 'not_sure' },
              ]}
              value={formData.present_clinical.fever_today}
              onChange={(v) => updatePresentClinical('fever_today', v as any)}
              error={errors['present_clinical.fever_today']}
              errorKey='present_clinical.fever_today'
            />

            {['yes', 'not_sure'].includes(formData.present_clinical.fever_today) && (
              <>
                <ChipPicker
                  label="Fever Duration"
                  options={[
                    { label: '< 24 Hours', value: 'within_24h' },
                    { label: '1 - 3 Days', value: '1_3_days' },
                    { label: '> 3 Days', value: 'more_3_days' },
                    { label: 'Not required', value: 'not_required' },
                  ]}
                  value={formData.present_clinical.fever_duration}
                  onChange={(v) => updatePresentClinical('fever_duration', v as any)}
                  error={errors['present_clinical.fever_duration']}
                  errorKey='present_clinical.fever_duration'
                />

                <Field
                  label="Measured Body Temperature (°C)"
                  placeholder="e.g. 37.5 (if known)"
                  keyboardType="numeric"
                  value={formData.present_clinical.temperature_c}
                  onChangeText={(v) => updatePresentClinical('temperature_c', v)}
                  error={errors['present_clinical.temperature_c']}
                  errorKey='present_clinical.temperature_c'
                />
              </>
            )}

            <MultiChipPicker
              label="Reported Symptoms"
              options={SYMPTOM_OPTIONS}
              values={formData.present_clinical.symptoms}
              onToggle={handleSymptomToggle}
              hint="'No other symptoms' is mutually exclusive with specific symptoms."
            />

            {(formData.present_clinical.fever_today === 'yes' ||
              formData.present_clinical.symptoms.some((s) => s !== 'no_other_symptoms')) && (
              <CalendarDatePickerField
                label="Onset Date of Current Illness"
                value={formData.present_clinical.onset_date}
                onChange={(v) => updatePresentClinical('onset_date', v)}
                error={errors['present_clinical.onset_date']}
                errorKey='present_clinical.onset_date'
                maxISO={todayISO()}
                hint="When today's illness first started (no future dates)"
                required
              />
            )}

            <View style={s.dangerSignsBox}>
              <Text style={s.dangerSignsTitle}>Clinical Danger Signs / Red Flags</Text>

              <ChipPicker
                label="Difficulty Breathing?"
                options={[
                  { label: 'No', value: 'no' },
                  { label: 'Yes', value: 'yes' },
                ]}
                value={formData.present_clinical.breathing_difficulty}
                onChange={(v) => updatePresentClinical('breathing_difficulty', v as any)}
                error={errors['present_clinical.breathing_difficulty']}
                errorKey='present_clinical.breathing_difficulty'
              />

              <ChipPicker
                label="Chest Pain?"
                options={[
                  { label: 'No', value: 'no' },
                  { label: 'Yes', value: 'yes' },
                ]}
                value={formData.present_clinical.chest_pain}
                onChange={(v) => updatePresentClinical('chest_pain', v as any)}
                error={errors['present_clinical.chest_pain']}
                errorKey='present_clinical.chest_pain'
              />

              <ChipPicker
                label="Altered Sensorium / Confusion?"
                options={[
                  { label: 'No', value: 'no' },
                  { label: 'Yes', value: 'yes' },
                ]}
                value={formData.present_clinical.confusion}
                onChange={(v) => updatePresentClinical('confusion', v as any)}
                error={errors['present_clinical.confusion']}
                errorKey='present_clinical.confusion'
              />
            </View>

            <ChipPicker
              label="Can Worker Attend Diagnostic Testing Today?"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
                { label: 'Not required', value: 'not_required' },
              ]}
              value={formData.present_clinical.can_attend_testing}
              onChange={(v) => updatePresentClinical('can_attend_testing', v as any)}
              error={errors['present_clinical.can_attend_testing']}
              errorKey='present_clinical.can_attend_testing'
            />

          </Card>
        )}

        {/* SECTION 4: MIGRATION & MOBILITY */}
        {step === 4 && (
          <Card title="Section 4: Mobility & Migration" subtitle="Time in Goa and interstate travel">
            <ChipPicker
              label="Time lived or worked in Goa"
              options={[
                { label: 'Up to 1 month', value: 'up_to_1_month' },
                { label: '1 - 6 months', value: '1_6_months' },
                { label: '6 months or more', value: '6_months_or_more' },
              ]}
              value={formData.migration_history.time_in_goa}
              onChange={(v) => updateMigration('time_in_goa', v as any)}
              error={errors['migration_history.time_in_goa']}
              errorKey='migration_history.time_in_goa'
            />

            <ChipPicker
              label="Traveled outside Goa in the last 3 months?"
              options={[
                { label: 'No', value: 'no' },
                { label: 'Yes', value: 'yes' },
              ]}
              value={formData.migration_history.outside_goa_3m}
              onChange={(v) => updateMigration('outside_goa_3m', v as any)}
              error={errors['migration_history.outside_goa_3m']}
              errorKey='migration_history.outside_goa_3m'
            />

            {formData.migration_history.outside_goa_3m === 'yes' && (
              <View style={s.conditionalBlock}>
                <Field
                  label="States Visited"
                  placeholder="e.g. West Bengal, Odisha, Bihar"
                  value={formData.migration_history.states_visited}
                  onChangeText={(v) => updateMigration('states_visited', v)}
                  error={errors['migration_history.states_visited']}
                  errorKey='migration_history.states_visited'
                  hint="Comma-separated state names"
                  required
                />

                <ChipPicker
                  label="Duration of Stay in Home State"
                  options={[
                    { label: 'Up to 7 days', value: '7_days' },
                    { label: 'Up to 14 days', value: '14_days' },
                    { label: 'Up to 1 month', value: 'up_to_1_month' },
                  ]}
                  value={formData.migration_history.last_stay_home_state}
                  onChange={(v) => updateMigration('last_stay_home_state', v as any)}
                  error={errors['migration_history.last_stay_home_state']}
                  errorKey='migration_history.last_stay_home_state'
                />
              </View>
            )}

            <ChipPicker
              label="Had fever or malaria in the 3 months before coming to Goa?"
              options={[
                { label: 'No', value: 'no' },
                { label: 'Yes', value: 'yes' },
                { label: "Don't know", value: 'dont_know' },
              ]}
              value={formData.migration_history.fever_before_goa_3m}
              onChange={(v) => updateMigration('fever_before_goa_3m', v as any)}
              error={errors['migration_history.fever_before_goa_3m']}
              errorKey='migration_history.fever_before_goa_3m'
            />

          </Card>
        )}

        {/* SECTION 5: PLANNED TRAVEL */}
        {step === 5 && (
          <Card title="Section 5: Planned Travel" subtitle="Upcoming journeys outside Goa">
            <ChipPicker
              label="Planning to travel outside Goa in the near future?"
              options={[
                { label: 'No', value: 'no' },
                { label: 'Yes', value: 'yes' },
              ]}
              value={formData.planned_travel.planning}
              onChange={(v) => updateTravelPlanning(v as any)}
              error={errors['planned_travel.planning']}
              errorKey='planned_travel.planning'
            />

            {formData.planned_travel.planning === 'yes' && (
              <View style={s.conditionalBlock}>
                {errors['planned_travel.episodes'] && (
                  <NoticeBanner
                    type="error"
                    title="Required"
                    message={errors['planned_travel.episodes']}
                  />
                )}

                {formData.planned_travel.episodes.map((ep, idx) => (
                  <View key={idx} style={s.episodeCard}>
                    <View style={s.episodeHeader}>
                      <Text style={s.episodeTitle}>Travel Episode #{idx + 1}</Text>
                      {formData.planned_travel.episodes.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => removeEpisode(idx)}
                        >
                          ✕ Remove
                        </Button>
                      )}
                    </View>

                    <CalendarDatePickerField
                      label="Departure Date (out of Goa)"
                      value={ep.departure_date}
                      onChange={(v) => updateEpisode(idx, { departure_date: v })}
                      error={errors[`episode.${idx}.departure_date`]}
                      errorKey={`episode.${idx}.departure_date`}
                      minISO={todayISO()}
                      hint="Planned departure — today or later"
                      required
                    />
                    <CalendarDatePickerField
                      label="Return Date (back into Goa)"
                      value={ep.return_date}
                      onChange={(v) => updateEpisode(idx, { return_date: v })}
                      error={errors[`episode.${idx}.return_date`]}
                      errorKey={`episode.${idx}.return_date`}
                      minISO={ep.departure_date || todayISO()}
                      hint={ep.departure_date ? 'Not earlier than the departure date' : 'Pick departure date first'}
                      required
                    />

                    <Field
                      label="Destination (State / District)"
                      placeholder="e.g. Murshidabad, West Bengal"
                      value={ep.place_state}
                      onChangeText={(v) => updateEpisode(idx, { place_state: v })}
                      error={errors[`episode.${idx}.place_state`]}
                      errorKey={`episode.${idx}.place_state`}
                      required
                    />

                    <ChipPicker
                      label="Had fever or malaria during previous trips?"
                      options={[
                        { label: 'No', value: 'no' },
                        { label: 'Yes', value: 'yes' },
                      ]}
                      value={ep.fever_malaria_during}
                      onChange={(v) =>
                        updateEpisode(idx, { fever_malaria_during: v as any })
                      }
                      error={errors[`episode.${idx}.fever_malaria_during`]}
                      errorKey={`episode.${idx}.fever_malaria_during`}
                    />

                    {ep.fever_malaria_during === 'yes' && (
                      <View style={s.subConditionalBlock}>
                        <ChipPicker
                          label="Was treatment received?"
                          options={[
                            { label: 'No', value: 'no' },
                            { label: 'Yes', value: 'yes' },
                          ]}
                          value={ep.treatment_given || 'no'}
                          onChange={(v) =>
                            updateEpisode(idx, { treatment_given: v as any })
                          }
                          error={errors[`episode.${idx}.treatment_given`]}
                          errorKey={`episode.${idx}.treatment_given`}
                        />

                        {ep.treatment_given === 'yes' && (
                          <>
                            <ChipPicker
                              label="Full course completed?"
                              options={[
                                { label: 'Yes', value: 'yes' },
                                { label: 'No', value: 'no' },
                                { label: 'Not sure', value: 'not_sure' },
                              ]}
                              value={ep.full_course_completed || 'yes'}
                              onChange={(v) =>
                                updateEpisode(idx, {
                                  full_course_completed: v as any,
                                })
                              }
                              error={errors[`episode.${idx}.full_course_completed`]}
                              errorKey={`episode.${idx}.full_course_completed`}
                            />

                            <ChipPicker
                              label="Treatment Place"
                              options={[
                                { label: 'UHC / PHC', value: 'uhc_phc' },
                                { label: 'Govt Hospital', value: 'govt_hospital' },
                                { label: 'Private Clinic', value: 'private_clinic' },
                                { label: 'Pharmacy', value: 'pharmacy' },
                                { label: 'Other', value: 'other' },
                              ]}
                              value={ep.treatment_place || 'uhc_phc'}
                              onChange={(v) =>
                                updateEpisode(idx, { treatment_place: v })
                              }
                              error={errors[`episode.${idx}.treatment_place`]}
                              errorKey={`episode.${idx}.treatment_place`}
                            />

                            {ep.treatment_place === 'other' && (
                              <Field
                                label="Other Facility Details"
                                placeholder="Describe facility"
                                value={ep.treatment_place_other || ''}
                                onChangeText={(v) =>
                                  updateEpisode(idx, {
                                    treatment_place_other: v,
                                  })
                                }
                                error={errors[`episode.${idx}.treatment_place_other`]}
                                errorKey={`episode.${idx}.treatment_place_other`}
                                required
                              />
                            )}
                          </>
                        )}
                      </View>
                    )}
                  </View>
                ))}

                {formData.planned_travel.episodes.length < 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={addEpisode}
                  >
                    + Add Another Travel Episode
                  </Button>
                )}
              </View>
            )}

          </Card>
        )}

        {/* STEP 6: REVIEW & SUBMISSION */}
        {step === 6 && (
          <Card
            title="Section 6: Review & Final Submission"
            subtitle="Verify entered screening questionnaire"
          >
            <NoticeBanner
              type="info"
              title="Verification Checklist"
              message="Check all entered details with the worker before final submission. Changes after submission require an amendment record."
            />

            {/* Section 1 Summary */}
            <View style={s.summaryCard}>
              <View style={s.summaryCardHeader}>
                <Text style={s.summaryTitle}>1. Demographics & Identity</Text>
                <Button variant="ghost" size="sm" onPress={() => setStep(1)}>
                  Edit
                </Button>
              </View>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Name: </Text>
                {formData.personal.full_name || '—'}
              </Text>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>DOB / Age: </Text>
                {formData.personal.dob
                  ? `${formData.personal.dob} (${
                      ageInCompletedYears(formData.personal.dob) ?? '—'
                    } yrs, completed)`
                  : formData.personal.age_years
                    ? `DOB not known — ${formData.personal.age_years} yrs (completed)`
                    : '—'}
              </Text>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Gender: </Text>
                {formData.personal.gender?.toUpperCase() || '—'}
              </Text>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Mobile: </Text>
                {formData.personal.mobile || '—'}
              </Text>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Present Address: </Text>
                {formData.personal.address_present || '—'}
              </Text>
            </View>

            {/* Section 2 Summary */}
            <View style={s.summaryCard}>
              <View style={s.summaryCardHeader}>
                <Text style={s.summaryTitle}>2. Malaria History</Text>
                <Button variant="ghost" size="sm" onPress={() => setStep(2)}>
                  Edit
                </Button>
              </View>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Diagnosed with malaria: </Text>
                {formData.past_history.diagnosed_malaria?.toUpperCase() || '—'}
              </Text>
              {formData.past_history.diagnosed_malaria === 'yes' && (
                <>
                  <Text style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Episodes in 2 yrs: </Text>
                    {formData.past_history.times_malaria_2y || '—'}
                  </Text>
                  <Text style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Treatment Facility: </Text>
                    {formData.past_history.treatment_place?.toUpperCase() || '—'}
                  </Text>
                </>
              )}
            </View>

            {/* Section 3 Summary */}
            <View style={s.summaryCard}>
              <View style={s.summaryCardHeader}>
                <Text style={s.summaryTitle}>3. Clinical Presentation</Text>
                <Button variant="ghost" size="sm" onPress={() => setStep(3)}>
                  Edit
                </Button>
              </View>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Fever Status: </Text>
                {formData.present_clinical.fever_today?.toUpperCase() || '—'}
                {formData.present_clinical.fever_duration
                  ? ` (${formData.present_clinical.fever_duration})`
                  : ''}
              </Text>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Symptoms: </Text>
                {formData.present_clinical.symptoms.join(', ') || 'None'}
              </Text>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Danger Signs: </Text>
                Breathing: {formData.present_clinical.breathing_difficulty || 'no'}, Chest: {formData.present_clinical.chest_pain || 'no'}, Confusion: {formData.present_clinical.confusion || 'no'}
              </Text>
            </View>

            {/* Section 4 Summary */}
            <View style={s.summaryCard}>
              <View style={s.summaryCardHeader}>
                <Text style={s.summaryTitle}>4. Mobility & Migration</Text>
                <Button variant="ghost" size="sm" onPress={() => setStep(4)}>
                  Edit
                </Button>
              </View>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Time in Goa: </Text>
                {formData.migration_history.time_in_goa || '—'}
              </Text>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Outside Goa (3m): </Text>
                {formData.migration_history.outside_goa_3m?.toUpperCase() || '—'}
                {formData.migration_history.states_visited
                  ? ` (${formData.migration_history.states_visited})`
                  : ''}
              </Text>
            </View>

            {/* Section 5 Summary */}
            <View style={s.summaryCard}>
              <View style={s.summaryCardHeader}>
                <Text style={s.summaryTitle}>5. Travel Plans</Text>
                <Button variant="ghost" size="sm" onPress={() => setStep(5)}>
                  Edit
                </Button>
              </View>
              <Text style={s.summaryItem}>
                <Text style={s.summaryLabel}>Planning Travel: </Text>
                {formData.planned_travel.planning?.toUpperCase() || '—'}
              </Text>
              {formData.planned_travel.planning === 'yes' && (
                <Text style={s.summaryItem}>
                  <Text style={s.summaryLabel}>Episodes: </Text>
                  {formData.planned_travel.episodes.length} recorded
                </Text>
              )}
            </View>

            {Object.keys(errors).length > 0 && (
              <NoticeBanner
                type="error"
                title="Validation Incomplete"
                message="One or more sections contain incomplete or invalid information. Please review each step before submitting."
              />
            )}

          </Card>
        )}
      </FormShell>
  )
}

const s = StyleSheet.create({
  header: {
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ageComputedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f766e',
    marginTop: 6,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#71717a',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#18181b',
    letterSpacing: -0.5,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 10,
  },
  conditionalBlock: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 12,
    marginTop: 4,
  },
  subConditionalBlock: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 10,
  },
  dangerSignsBox: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 10,
    marginTop: 6,
  },
  dangerSignsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  episodeCard: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 10,
  },
  episodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
    paddingBottom: 6,
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181b',
  },
  summaryCard: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 4,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
    paddingBottom: 4,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#18181b',
  },
  summaryItem: {
    fontSize: 13,
    color: '#27272a',
    lineHeight: 18,
  },
  summaryLabel: {
    fontWeight: '600',
    color: '#71717a',
  },
})
