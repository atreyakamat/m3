import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { api } from '@/src/api'
import { useAppStore } from '@/src/store'
import {
  enqueueOutbox,
  readOutbox,
  outboxCount,
  getPendingRequestId,
  setPendingRequestId,
  clearPendingRequestId,
} from '@/src/cache'
import {
  Button,
  Card,
  ChipPicker,
  Field,
  FormShell,
  MultiChipPicker,
  NoticeBanner,
  type FormScrollApi,
} from '@/components/ui'

const SYMPTOM_OPTIONS = [
  { value: 'fever', label: 'Fever' },
  { value: 'chills_shivering', label: 'Chills / shivering' },
  { value: 'headache', label: 'Headache' },
  { value: 'sweating', label: 'Sweating' },
  { value: 'body_ache', label: 'Body ache' },
  { value: 'nausea_vomiting', label: 'Nausea / vomiting' },
  { value: 'weakness_fatigue', label: 'Weakness / fatigue' },
  { value: 'breathing_difficulty', label: 'Breathing difficulty' },
  { value: 'chest_pain', label: 'Chest pain' },
  { value: 'confusion', label: 'Confusion' },
  { value: 'other', label: 'Other' },
]

const ONSET_OPTIONS = [
  { value: 'today', label: 'Started today' },
  { value: '1_3_days', label: '1-3 days' },
  { value: 'more_3_days', label: 'More than 3 days' },
  { value: 'over_a_week', label: 'Over a week' },
  { value: 'not_sure', label: 'Not sure' },
]

const ATTEND_OPTIONS = [
  { value: 'yes', label: 'Yes, visited' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
]

const DANGER_CODES = ['breathing_difficulty', 'chest_pain', 'confusion']

const FIELD_ORDER = ['symptoms', 'onset_category', 'temperature_c', 'location_note', 'attend_facility', 'description'] as const

// Approval-gated urgent wording: static and instructional (what happens next
// and where to go now) — no invented clinical thresholds (DEC-13 territory).
const URGENT_TITLE = 'Urgent concern flagged'
const URGENT_BODY =
  'Based on the symptoms you selected, a clinician will be notified immediately. ' +
  'If you are severely unwell right now, go to the nearest health facility or contact your site coordinator directly. ' +
  'This screen does not replace medical advice.'

type Props = { demoMode?: boolean }

export default function Symptom() {
  const { session, online } = useAppStore()
  const router = useRouter()
  const scrollApiRef = useRef<FormScrollApi | null>(null)
  const owner = session?.user?.id ? `${session.user.id}` : 'anonymous'
  const isWorker = Boolean(session?.user?.roles?.includes('worker'))

  const [symptoms, setSymptoms] = useState<string[]>([])
  const [onsetCategory, setOnsetCategory] = useState<string | null>(null)
  const [temperature, setTemperature] = useState('')
  const [locationNote, setLocationNote] = useState('')
  const [attendFacility, setAttendFacility] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<(typeof FIELD_ORDER)[number], string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    caseCode: string; status: string; urgent: boolean; savedOffline: boolean
  } | null>(null)
  const [queued, setQueued] = useState(0)

  const isUrgent = symptoms.some((x) => DANGER_CODES.includes(x))

  useEffect(() => {
    setQueued(outboxCount(owner, 'queued'))
  }, [owner])

  const validate = useCallback(() => {
    const errors: Partial<Record<(typeof FIELD_ORDER)[number], string>> = {}
    if (symptoms.length === 0) errors.symptoms = 'Select at least one symptom.'
    if (temperature && (!/^\d{2}(\.\d)?$/.test(temperature) || Number(temperature) < 30 || Number(temperature) > 45)) {
      errors.temperature_c = 'Temperature must be between 30 and 45 °C.'
    }
    if (locationNote.length > 200) errors.location_note = 'Keep the location note under 200 characters.'
    if (description.length > 2000) errors.description = 'Keep the description under 2000 characters.'
    if (!attendFacility) errors.attend_facility = 'Tell us if you already visited a facility.'
    return errors
  }, [symptoms, temperature, locationNote, description, attendFacility])

  const buildPayload = useCallback((crid: string) => ({
    symptoms,
    onset_category: onsetCategory ?? undefined,
    temperature_c: temperature ? Number(temperature) : undefined,
    location_note: locationNote || undefined,
    description: description || undefined,
    attend_facility: attendFacility ?? undefined,
    client_request_id: crid,
  }), [symptoms, onsetCategory, temperature, locationNote, description, attendFacility])

  const resetForm = useCallback(() => {
    setSymptoms([]); setOnsetCategory(null); setTemperature('')
    setLocationNote(''); setAttendFacility(null); setDescription('')
    setFieldErrors({}); setResult(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss()
    const errors = validate()
    setFieldErrors(errors)
    const first = FIELD_ORDER.find((k) => errors[k])
    if (first) {
      scrollApiRef.current?.scrollToError(first)
      return
    }
    if (!session?.token || session?.demo) {
      // No authority to write anywhere: show the device-save state in-page
      // (Alert is unreliable on web) and stop. Nothing was sent to a server.
      setResult({
        caseCode: 'n/a (demo)',
        status: 'device only — not sent to the surveillance server',
        urgent: isUrgent,
        savedOffline: true,
      })
      return
    }
    if (isWorker && online && !session?.user?.patient_id) {
      Alert.alert(
        'Worker profile needed',
        'A worker registration is required before a health report. Please complete the worker registration first.'
      )
      return
    }
    // Same idempotency lifecycle as the screening submission: one per-purpose
    // pending key, minted once and retired only by an authoritative server
    // ack; the server de-dupes by client_request_id on replay.
    let crid = getPendingRequestId(owner, 'symptom_report')
    if (!crid) {
      crid = `sym_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      setPendingRequestId(owner, crid, 'symptom_report')
    }
    const payload = buildPayload(crid)
    setSubmitting(true)
    try {
      if (online) {
        const res = await api<any>('/symptom-reports', session.token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        clearPendingRequestId(owner, crid, 'symptom_report')
        setResult({
          caseCode: res?.case_code || 'Confirmed',
          status: res?.status || 'awaiting clinical review',
          urgent: Boolean(res?.urgent),
          savedOffline: false,
        })
      } else {
        // Offline: durable keyed queue item, replayed by intake's flush on
        // reconnect; retire stale pending keys of prior queued reports.
        enqueueOutbox(owner, 'symptom_report', payload)
        const prior = readOutbox(owner).filter(
          (r) => r.kind === 'symptom_report' && r.status === 'queued' && r.payload?.client_request_id !== crid
        )
        for (const p of prior) {
          const oldCrid = String(p.payload?.client_request_id ?? '')
          if (oldCrid) clearPendingRequestId(owner, oldCrid, 'symptom_report')
        }
        setQueued(outboxCount(owner, 'queued'))
        setResult({
          caseCode: 'pending sync',
          status: 'stored on this device',
          urgent: isUrgent,
          savedOffline: true,
        })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      if (/Authentication required/i.test(message)) {
        Alert.alert('Saved on this device — awaiting transmission',
          'Your session expired. Sign in again; the report will be sent automatically once connected. Do not submit again.')
      } else {
        Alert.alert('Could not save', message || 'Please review the form and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }, [validate, session, owner, isWorker, online, buildPayload, isUrgent])

  return (
    <FormShell scrollApiRef={scrollApiRef}>
      <View style={st.page}>
        {result ? (
          <Card
            title={result.savedOffline ? 'Saved for sync' : 'Report received'}
            badge={result.urgent ? 'Urgent' : undefined}
          >
            <NoticeBanner
              type={result.urgent ? 'warning' : 'info'}
              title={result.urgent ? URGENT_TITLE : 'What happens next'}
              message={
                result.savedOffline
                  ? isUrgent
                    ? `${URGENT_BODY}\nThis report is saved on this phone and will be sent automatically when you are back online (reference: ${result.caseCode}).`
                    : 'This report is saved on this phone and will be sent automatically when you are back online. Do not submit again for the same problem.'
                  : `Clinical staff has been notified. Case reference: ${result.caseCode}. Current status: ${result.status.replace(/_/g, ' ')}.`
              }
            />
            <Button variant="secondary" onPress={resetForm} fullWidth style={{ marginTop: 12 }}>
              Report another problem
            </Button>
            <Button variant="ghost" onPress={() => router.replace('/dashboard')} fullWidth style={{ marginTop: 8 }}>
              Back to dashboard
            </Button>
          </Card>
        ) : (
          <>
            <Card
              title="I feel unwell / need medical help"
              subtitle="Tell us what is wrong. A clinician reviews every report."
            >
              {isUrgent && (
                <NoticeBanner type="warning" title={URGENT_TITLE} message={URGENT_BODY} />
              )}
              <MultiChipPicker
                label="What are you feeling right now?"
                options={SYMPTOM_OPTIONS}
                values={symptoms}
                onToggle={(val) =>
                  setSymptoms((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]))
                }
                error={fieldErrors.symptoms}
                errorKey="symptoms"
                horizontal={false}
              />
              <ChipPicker
                label="When did it start?"
                options={ONSET_OPTIONS}
                value={onsetCategory ?? ''}
                onChange={(val) => setOnsetCategory(val || null)}
                errorKey="onset_category"
              />
              <Field
                label="Temperature (°C, optional)"
                value={temperature}
                onChangeText={setTemperature}
                keyboardType="decimal-pad"
                error={fieldErrors.temperature_c}
                errorKey="temperature_c"
                placeholder="e.g. 39.2"
              />
              <Field
                label="Where are you now (site / block / room)"
                value={locationNote}
                onChangeText={setLocationNote}
                error={fieldErrors.location_note}
                errorKey="location_note"
                placeholder="e.g. Labour line block C"
                autoCapitalize="sentences"
              />
              <ChipPicker
                label="Have you already visited a health facility for this?"
                options={ATTEND_OPTIONS}
                value={attendFacility ?? ''}
                onChange={(val) => setAttendFacility(val || null)}
                error={fieldErrors.attend_facility}
                errorKey="attend_facility"
              />
              <Text style={st.inputLabel}>Anything else we should know (optional)</Text>
              <View collapsable={false}>
                <TextInput
                  style={st.textArea}
                  multiline
                  maxLength={2000}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe how you are feeling, in your own words."
                />
              </View>
              {fieldErrors.description ? <Text style={st.errorText}>{fieldErrors.description}</Text> : null}
            </Card>
            <Button onPress={handleSubmit} loading={submitting} fullWidth>
              {submitting ? 'Sending…' : online ? 'Send report' : 'Save for sync'}
            </Button>
            {queued > 0 && (
              <NoticeBanner
                type="offline"
                title="Offline queue"
                message={`${queued} report${queued === 1 ? '' : 's'} saved on this device awaiting connection.`}
                style={{ marginTop: 12 }}
              />
            )}
          </>
        )}
      </View>
    </FormShell>
  )
}

const st = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#44403c', marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 10,
    backgroundColor: '#fff',
    minHeight: 96,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#1c1917',
  },
  errorText: { color: '#b91c1c', marginTop: 4, fontSize: 12 },
})
