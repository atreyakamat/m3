/**
 * Clinician assessment — source questionnaire pages 4-5 (01 Sept 2026).
 *
 * Conditional "IF ADMITTED = YES" block follows the source: species/diagnosis,
 * admission symptoms, clinical severity, treatment completion (with reason
 * when incomplete), discharge/transfer date + outcome, remarks. When not
 * admitted, treatment-given and health-worker follow-up flags are recorded.
 *
 * Role gating here is client-side convenience; the server enforces clinical
 * authorization on POST /assessments (require_roles clinician + patient scope).
 * Online-only by design, matching the existing assessment flow.
 */
import React, { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '@/src/api'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import {
  Button,
  Field,
  Card,
  FormShell,
  NoticeBanner,
  ChipPicker,
  MultiChipPicker,
  StatusBadge,
} from '@/components/ui'
import { CalendarDatePickerField } from '@/components/CalendarDatePickerField'
import { WorkerLookupField } from '@/components/WorkerLookupField'
import { DemoBanner } from '@/components/DemoBanner'
import { demoFacilities } from '@/src/demoData'
import { saveDemoRecord } from '@/src/demoStore'

const ENCOUNTER_SYMPTOM_OPTIONS = [
  { label: 'Chills / rigors', value: 'chills_rigors' },
  { label: 'Sweating', value: 'sweating' },
  { label: 'Headache', value: 'headache' },
  { label: 'Nausea / vomiting', value: 'nausea_vomiting' },
  { label: 'Abdominal pain', value: 'abdominal_pain' },
  { label: 'Joint / body aches', value: 'joint_body_aches' },
  { label: 'Weakness / fatigue', value: 'weakness_fatigue' },
  { label: 'Other (specify below)', value: 'other' },
]

const ADMISSION_SYMPTOM_OPTIONS = [
  { label: 'High fever', value: 'high_fever' },
  { label: 'Chills / rigors', value: 'chills_rigors' },
  { label: 'Severe headache', value: 'severe_headache' },
  { label: 'Vomiting', value: 'vomiting' },
  { label: 'Abdominal pain', value: 'abdominal_pain' },
  { label: 'Breathlessness / chest pain', value: 'breathlessness_chest_pain' },
  { label: 'Confusion', value: 'confusion' },
  { label: 'Severe weakness', value: 'severe_weakness' },
  { label: 'Jaundice', value: 'jaundice' },
  { label: 'Bleeding', value: 'bleeding' },
  { label: 'Other (describe in remarks)', value: 'other' },
]

const SPECIES_OPTIONS = [
  { label: 'P. falciparum (Pf)', value: 'pf' },
  { label: 'P. vivax (Pv)', value: 'pv' },
  { label: 'Mixed (Pf + Pv)', value: 'mixed' },
  { label: 'Other', value: 'other' },
]

const FEVER_DURATION_OPTIONS = [
  { label: '< 24 hours', value: '<24h' },
  { label: '1-3 days', value: '1_3_days' },
  { label: '4-7 days', value: '4_7_days' },
  { label: '> 7 days', value: '>7_days' },
]

const TREATMENT_COMPLETED_OPTIONS = [
  { label: 'Yes — full course completed', value: 'yes' },
  { label: 'No — still on treatment at discharge / transfer', value: 'no_still_on_treatment' },
  { label: 'No — stopped early', value: 'no_stopped_early' },
  { label: 'Referred to District / GMC', value: 'referred_district_gmc' },
]

const OUTCOME_OPTIONS = [
  { label: 'Recovered / symptom-free', value: 'recovered' },
  { label: 'Improved — continue OPD medicines', value: 'improved_opd' },
  { label: 'Referred District Hospital / GMC', value: 'referred_district_gmc' },
  { label: 'Other', value: 'other' },
]

const COMORBIDITY_OPTIONS = [
  { label: 'Diabetes', value: 'diabetes' },
  { label: 'Hypertension', value: 'hypertension' },
  { label: 'None', value: 'none' },
  { label: 'Other', value: 'other' },
]

interface AssessmentFormState {
  patientCode: string
  medicalOfficerName: string
  facilityId: string
  temperatureC: string
  feverDuration: string
  symptoms: string[]
  otherSymptoms: string
  generalCondition: string
  systolicBp: string
  diastolicBp: string
  comorbidities: string[]
  comorbidityOtherNote: string
  prescribedTreatment: string
  admitted: string
  admissionSpecies: string
  admissionSpeciesOtherNote: string
  admissionSymptoms: string[]
  admissionSeverity: string
  treatmentCompleted: string
  treatmentIncompleteReason: string
  dischargeDate: string
  dischargeOutcome: string
  dischargeOutcomeOther: string
  remarks: string
  treatmentGiven: string
  followUpAssigned: string
}

const INITIAL_STATE: AssessmentFormState = {
  patientCode: '',
  medicalOfficerName: '',
  facilityId: '',
  temperatureC: '',
  feverDuration: '',
  symptoms: [],
  otherSymptoms: '',
  generalCondition: '',
  systolicBp: '',
  diastolicBp: '',
  comorbidities: [],
  comorbidityOtherNote: '',
  prescribedTreatment: '',
  admitted: '',
  admissionSpecies: '',
  admissionSpeciesOtherNote: '',
  admissionSymptoms: [],
  admissionSeverity: '',
  treatmentCompleted: '',
  treatmentIncompleteReason: '',
  dischargeDate: '',
  dischargeOutcome: '',
  dischargeOutcomeOther: '',
  remarks: '',
  treatmentGiven: '',
  followUpAssigned: '',
}

const INCOMPLETE_TREATMENT_CODES = ['no', 'no_still_on_treatment', 'no_stopped_early']

function toggleSelect(current: string[], code: string, exclusiveCode?: string): string[] {
  if (exclusiveCode && code === exclusiveCode) {
    return current.includes(code) ? [] : [exclusiveCode]
  }
  const next = exclusiveCode ? current.filter((c) => c !== exclusiveCode) : [...current]
  if (next.includes(code)) return next.filter((c) => c !== code)
  return [...next, code]
}

export default function Assessment() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const params = useLocalSearchParams<{ patientId?: string }>()
  const isClinician = session?.user?.roles?.includes('clinician')
  // Demo sessions with the clinician role may fill the form and finalize a
  // LOCAL demo assessment (captured in the demo store); a real token +
  // connectivity are still required for a server write.
  const isDemo = Boolean(session?.demo)
  const disabled = (() => {
    if (isDemo) return !isClinician
    return !online || !session?.token || !isClinician
  })()

  const [form, setForm] = useState<AssessmentFormState>(() => ({
    ...INITIAL_STATE,
    patientCode: params.patientId || '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [facilities, setFacilities] = useState<{ id: string; name: string; district: string }[]>([])

  function set<K extends keyof AssessmentFormState>(key: K, value: AssessmentFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  useEffect(() => {
    async function loadFacilities() {
      if (session?.demo) {
        // Deterministic synthetic facilities — no server contact in demo.
        setFacilities(demoFacilities())
        return
      }
      if (!session?.token || !online) return
      try {
        const res = await api<{ items: any[] }>('/facilities', session.token)
        setFacilities(res.items || [])
      } catch {
        // Optional dropdown; leave options empty when unavailable.
      }
    }
    loadFacilities()
  }, [session?.token, session?.demo, online])
  const selectedFacility = facilities.find((f) => f.id === form.facilityId) || null

  async function submit() {
    if (disabled) {
      Alert.alert(tr('needsOnline'), tr('connectivityRequired'))
      return
    }
    const errs: Record<string, string> = {}
    if (!form.patientCode.trim()) {
      errs.patientCode = 'Patient ID or code is required'
    }
    if (form.temperatureC) {
      const tVal = parseFloat(form.temperatureC)
      if (isNaN(tVal) || tVal < 25 || tVal > 45) {
        errs.temperatureC = 'Temperature must be 25.0-45.0 °C'
      }
    }
    if (form.systolicBp) {
      const bp = parseInt(form.systolicBp, 10)
      if (isNaN(bp) || bp < 30 || bp > 300) errs.systolicBp = 'Systolic BP must be 30-300 mmHg'
    }
    if (form.diastolicBp) {
      const bp = parseInt(form.diastolicBp, 10)
      if (isNaN(bp) || bp < 20 || bp > 200) errs.diastolicBp = 'Diastolic BP must be 20-200 mmHg'
    }
    if (!form.admitted) {
      errs.admitted = 'Select whether the patient was admitted'
    }
    if (form.admitted === 'yes') {
      if (!form.admissionSeverity) {
        errs.admissionSeverity = 'Clinical severity at admission is required (server rule)'
      }
      if (INCOMPLETE_TREATMENT_CODES.includes(form.treatmentCompleted) &&
          !form.treatmentIncompleteReason.trim()) {
        errs.treatmentIncompleteReason = 'Reason is required when treatment was not completed'
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      Alert.alert('Check the form', 'Please correct the highlighted fields and try again.')
      return
    }

    const symptoms = form.symptoms.includes('other') && form.otherSymptoms.trim()
      ? [...form.symptoms.filter((s) => s !== 'other'), SymptomsOtherMarker(form.otherSymptoms.trim())]
      : form.symptoms

    const payload: Record<string, any> = {
      patient_id: form.patientCode.trim(),
      medical_officer_name: form.medicalOfficerName.trim() || undefined,
      facility_id: form.facilityId || undefined,
      temperature_c: form.temperatureC ? parseFloat(form.temperatureC) : undefined,
      fever_duration_category: form.feverDuration || undefined,
      symptoms,
      general_condition: form.generalCondition || undefined,
      systolic_bp: form.systolicBp ? parseInt(form.systolicBp, 10) : undefined,
      diastolic_bp: form.diastolicBp ? parseInt(form.diastolicBp, 10) : undefined,
      comorbidities_list: form.comorbidities,
      comorbidities: form.comorbidityOtherNote.trim() || undefined,
      treatment_documentation: form.prescribedTreatment.trim() || undefined,
    }
    if (form.treatmentCompleted) payload.treatment_completed = form.treatmentCompleted

    if (form.admitted === 'yes') {
      payload.admission_status = 'admitted'
      payload.admission_severity = form.admissionSeverity || undefined
      payload.admission_species = form.admissionSpecies || undefined
      payload.admission_symptoms = form.admissionSymptoms
      if (INCOMPLETE_TREATMENT_CODES.includes(form.treatmentCompleted)) {
        payload.treatment_incomplete_reason = form.treatmentIncompleteReason.trim()
      }
      if (form.dischargeDate.trim()) payload.discharge_date = form.dischargeDate.trim()
      let outcome = form.dischargeOutcome
      if (outcome === 'other' && form.dischargeOutcomeOther.trim()) {
        outcome = `other: ${form.dischargeOutcomeOther.trim()}`.slice(0, 100)
      }
      if (outcome) payload.outcome = outcome
      if (form.remarks.trim()) payload.remarks = form.remarks.trim()
      if (form.admissionSpecies === 'other' && form.admissionSpeciesOtherNote.trim()) {
        payload.admission_species_other_note = form.admissionSpeciesOtherNote.trim()
      }
    } else if (form.admitted === 'no') {
      payload.admission_status = 'outpatient'
      if (form.treatmentGiven) payload.treatment_given = form.treatmentGiven
      if (form.followUpAssigned) payload.follow_up_assigned = form.followUpAssigned
      // Both scenario branches keep remarks; the not-admitted branch records
      // follow-up / treatment narrative there.
      if (form.remarks.trim()) payload.remarks = form.remarks.trim()
    }
    if (form.symptoms.includes('other') && form.otherSymptoms.trim()) {
      payload.symptoms_other_note = form.otherSymptoms.trim()
    }

    if (isDemo) {
      // Offline Demo: the SAME local validation passed; finalize as a local
      // synthetic demo assessment. No server write is attempted and the
      // record can never upload.
      const record = saveDemoRecord({
        kind: 'assessment',
        label: `Clinical assessment — ${form.patientCode.trim() || 'Synthetic Patient (demo)'}`,
        payload,
      })
      Alert.alert(
        'Demo assessment saved locally',
        `Reference: ${record.id}\nSaved on this device at ${new Date(record.created_at).toLocaleString()}.\n\nThis is SYNTHETIC DEMO data only; it has NOT been recorded in any clinic system and will never upload to a server.`,
        [{ text: 'OK', onPress: () => router.replace('/dashboard') }]
      )
      return
    }

    setPending(true)
    try {
      await api('/assessments', session!.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      // Explicit success message only after the server confirms the write.
      Alert.alert(
        tr('saved'),
        'Clinical assessment recorded successfully.',
        [{ text: 'OK', onPress: () => router.replace('/dashboard') }]
      )
    } catch (e) {
      Alert.alert(tr('error'), e instanceof Error ? e.message : tr('error'))
    } finally {
      setPending(false)
    }
  }

  return (
    <FormShell contentContainerStyle={s.scrollContent}>
      <View style={s.header}>
        <Text style={s.eyebrow}>MEDICAL ENCOUNTER</Text>
        <Text style={s.title}>{tr('clinical')}</Text>
      </View>

      <NoticeBanner
        type="info"
        title="Clinician Clinical Scope"
        message="Document objective clinical observations, admissions, and treatment course adherence. Automated clinical decision support or treatment prescribing algorithms are not permitted."
      />

      {!online && (
        <NoticeBanner type="offline" title={tr('offline')} message={tr('connectivityRequired')} />
      )}
      {isDemo && <DemoBanner detail="Fill the clinician form as usual — the same field validation runs. Submitting finalizes a SYNTHETIC local demo assessment on this tablet; nothing is sent to any server." />}
      {!isDemo && disabled && (
        <NoticeBanner
          type="info"
          title="Clinician session required"
          message="Sign in with a provisioned clinician account to submit assessments."
        />
      )}

      <Card title="General & Administrative" subtitle="Source questionnaire page 4">
        <WorkerLookupField
          workerLabel="Patient"
          value={form.patientCode}
          onChangeText={(v) => set('patientCode', v)}
          token={session?.token}
          disabled={disabled}
          error={errors.patientCode}
          required
        />
        <Field
          label="Medical Officer Name"
          placeholder="e.g. Dr. A. Fernandes"
          value={form.medicalOfficerName}
          onChangeText={(v) => set('medicalOfficerName', v)}
        />
        {facilities.length > 0 && (
          <ChipPicker
            label="Facility (dropdown)"
            horizontal={false}
            options={facilities.map((f) => ({ label: f.name, value: f.id, caption: f.district }))}
            value={form.facilityId}
            onChange={(v) => set('facilityId', v)}
          />
        )}
        {selectedFacility && (
          <StatusBadge
            label={`Linked facility address: ${selectedFacility.district}`}
            variant="neutral"
          />
        )}
      </Card>

      <Card title="Clinical Assessment" subtitle="Vitals, symptoms, comorbidities">
        <Field
          label={tr('temperature')}
          placeholder="e.g. 38.5 (°C)"
          keyboardType="decimal-pad"
          value={form.temperatureC}
          onChangeText={(v) => set('temperatureC', v)}
          error={errors.temperatureC}
        />

        <ChipPicker
          label="Duration of fever (as reported)"
          options={FEVER_DURATION_OPTIONS}
          value={form.feverDuration}
          onChange={(v) => set('feverDuration', v)}
        />

        <MultiChipPicker
          label="Key symptoms (multiple select)"
          options={ENCOUNTER_SYMPTOM_OPTIONS}
          values={form.symptoms}
          onToggle={(code) => set('symptoms', toggleSelect(form.symptoms, code))}
          hint="'Other' asks for a note below."
        />
        {form.symptoms.includes('other') && (
          <Field
            label="Others (specify)"
            placeholder="Describe the other symptom"
            value={form.otherSymptoms}
            onChangeText={(v) => set('otherSymptoms', v)}
            required
          />
        )}

        <ChipPicker
          label="General condition"
          options={[
            { label: 'Stable', value: 'stable' },
            { label: 'Moderately ill', value: 'moderately_ill' },
            { label: 'Severe', value: 'severe' },
          ]}
          value={form.generalCondition}
          onChange={(v) => set('generalCondition', v)}
        />

        <View style={s.rowFields}>
          <View style={{ flex: 1 }}>
            <Field
              label="Blood pressure — systolic (mmHg)"
              placeholder="e.g. 120"
              keyboardType="numeric"
              value={form.systolicBp}
              onChangeText={(v) => set('systolicBp', v)}
              error={errors.systolicBp}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Blood pressure — diastolic (mmHg)"
              placeholder="e.g. 80"
              keyboardType="numeric"
              value={form.diastolicBp}
              onChangeText={(v) => set('diastolicBp', v)}
              error={errors.diastolicBp}
            />
          </View>
        </View>

        <MultiChipPicker
          label="Co-morbidities (multiple select)"
          options={COMORBIDITY_OPTIONS}
          values={form.comorbidities}
          onToggle={(code) => set('comorbidities', toggleSelect(form.comorbidities, code, 'none'))}
          hint="'None' is mutually exclusive with specific comorbidities."
        />
        {form.comorbidities.includes('other') && (
          <Field
            label="Other co-morbidity (specify)"
            placeholder="Describe"
            value={form.comorbidityOtherNote}
            onChangeText={(v) => set('comorbidityOtherNote', v)}
          />
        )}

        <Field
          label="Treatment Prescribed"
          placeholder="Documented treatment plan or referral"
          value={form.prescribedTreatment}
          onChangeText={(v) => set('prescribedTreatment', v)}
          multiline
          numberOfLines={3}
          hint="Recorded for follow-up verification only — no treatment decision support."
        />
      </Card>

      <Card title="Admission" subtitle="Conditional fields follow the source questionnaire">
        <ChipPicker
          label="Patient admitted?"
          options={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ]}
          value={form.admitted}
          onChange={(v) => set('admitted', v)}
          error={errors.admitted}
        />

        {form.admitted === 'yes' && (
          <View style={s.admissionBox}>
            <Text style={s.admissionTitle}>A. Admitted — inpatient details</Text>

            <ChipPicker
              label="Species / diagnosis at admission"
              options={SPECIES_OPTIONS}
              value={form.admissionSpecies}
              onChange={(v) => set('admissionSpecies', v)}
            />
            {form.admissionSpecies === 'other' && (
              <Field
                label="Other species / diagnosis (specify)"
                placeholder="Describe"
                value={form.admissionSpeciesOtherNote}
                onChangeText={(v) => set('admissionSpeciesOtherNote', v)}
              />
            )}

            <MultiChipPicker
              label="Symptoms at the time of admission (multiple)"
              options={ADMISSION_SYMPTOM_OPTIONS}
              values={form.admissionSymptoms}
              onToggle={(code) => set('admissionSymptoms', toggleSelect(form.admissionSymptoms, code))}
              hint="Findings beyond the checklist go to remarks."
            />

            <ChipPicker
              label="Clinical severity at admission"
              options={[
                { label: 'Mild Malaria', value: 'mild' },
                { label: 'Severe Malaria', value: 'severe' },
              ]}
              value={form.admissionSeverity}
              onChange={(v) => set('admissionSeverity', v)}
              error={errors.admissionSeverity}
            />

            <ChipPicker
              label="Treatment completed during admission?"
              horizontal={false}
              options={TREATMENT_COMPLETED_OPTIONS}
              value={form.treatmentCompleted}
              onChange={(v) => set('treatmentCompleted', v)}
            />
            {INCOMPLETE_TREATMENT_CODES.includes(form.treatmentCompleted) && (
              <Field
                label="If not completed — reason"
                placeholder="e.g. migrated, side effects, referred"
                value={form.treatmentIncompleteReason}
                onChangeText={(v) => set('treatmentIncompleteReason', v)}
                error={errors.treatmentIncompleteReason}
                required
              />
            )}

            <CalendarDatePickerField
              label="Date of discharge / transfer"
              value={form.dischargeDate}
              onChange={(v) => set('dischargeDate', v)}
              optional
              hint="The actual date of the discharge or transfer event"
            />

            <ChipPicker
              label="Outcome at discharge"
              options={OUTCOME_OPTIONS}
              value={form.dischargeOutcome}
              onChange={(v) => set('dischargeOutcome', v)}
            />
            {form.dischargeOutcome === 'other' && (
              <Field
                label="Other outcome (specify)"
                placeholder="Describe"
                value={form.dischargeOutcomeOther}
                onChangeText={(v) => set('dischargeOutcomeOther', v)}
              />
            )}

            <Field
              label="Remarks"
              placeholder="Additional clinical notes..."
              value={form.remarks}
              onChangeText={(v) => set('remarks', v)}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {form.admitted === 'no' && (
          <View style={s.admissionBox}>
            <Text style={s.admissionTitle}>B. Not admitted — source page 5</Text>
            <ChipPicker
              label="Treatment given?"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
              ]}
              value={form.treatmentGiven}
              onChange={(v) => set('treatmentGiven', v)}
            />
            <ChipPicker
              label="Health worker assigned for follow-up?"
              options={[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
              ]}
              value={form.followUpAssigned}
              onChange={(v) => set('followUpAssigned', v)}
              hint="Records the assignment flag; actual visits are tracked on the Follow-ups screen."
            />
            <Field
              label="Treatment given / plan details"
              placeholder="What was given in this encounter..."
              value={form.prescribedTreatment}
              onChangeText={(v) => set('prescribedTreatment', v)}
              multiline
              numberOfLines={2}
            />
            <Field
              label="Remarks"
              placeholder="Additional notes..."
              value={form.remarks}
              onChangeText={(v) => set('remarks', v)}
              multiline
              numberOfLines={2}
            />
          </View>
        )}
      </Card>

      <View style={s.submitAction}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={pending}
          disabled={disabled || pending}
          onPress={submit}
        >
          {tr('submit')}
        </Button>
      </View>
    </FormShell>
  )
}

function SymptomsOtherMarker(note: string): string {
  // Clinical API accepts free-form symptom list entries; keep the marker
  // explicit for downstream analytics while the dedicated column stores the
  // clean note.
  return `other: ${note}`.slice(0, 120)
}

const s = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: { gap: 2 },
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
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  admissionBox: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 12,
  },
  admissionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181b',
    textTransform: 'uppercase',
  },
  submitAction: {
    marginTop: 8,
  },
})
