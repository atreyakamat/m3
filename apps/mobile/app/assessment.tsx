import React, { useState } from 'react'
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
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
} from '@/components/ui'

const schema = z.object({
  patient_id: z.string().min(1, 'Patient ID or Code is required'),
  temperature_c: z.coerce.number().min(25, 'Invalid temp').max(45, 'Invalid temp').optional(),
  fever_duration_days: z.coerce.number().int().min(0).max(365).optional(),
  symptoms: z.string().optional(),
  notes: z.string().max(4000).optional(),
  treatment_documentation: z.string().max(2000).optional(),
  admission_status: z.enum(['outpatient', 'admitted']).default('outpatient'),
  admission_severity: z.enum(['mild', 'severe']).optional(),
  treatment_completed: z.enum(['yes', 'no', 'not_applicable']).default('not_applicable'),
  treatment_incomplete_reason: z.string().max(500).optional(),
  discharge_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const COMMON_SYMPTOMS = ['Fever', 'Chills', 'Headache', 'Body ache', 'Sweats', 'Nausea']

export default function Assessment() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const params = useLocalSearchParams<{ patientId?: string }>()

  const [pending, setPending] = useState(false)
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])

  const isClinician = session?.user?.roles?.includes('clinician')
  const disabled = !online || !session?.token || session?.demo || !isClinician

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patient_id: params.patientId || '',
      temperature_c: undefined,
      fever_duration_days: undefined,
      symptoms: '',
      notes: '',
      treatment_documentation: '',
      admission_status: 'outpatient',
      admission_severity: undefined,
      treatment_completed: 'not_applicable',
      treatment_incomplete_reason: '',
      discharge_date: '',
    },
  })

  const currentAdmission = watch('admission_status')
  const currentSeverity = watch('admission_severity')
  const currentTreatmentCompleted = watch('treatment_completed')

  function toggleSymptom(sym: string) {
    const next = selectedSymptoms.includes(sym)
      ? selectedSymptoms.filter((s) => s !== sym)
      : [...selectedSymptoms, sym]
    setSelectedSymptoms(next)
    setValue('symptoms', next.join(', '))
  }

  async function submit(values: FormValues) {
    if (disabled) {
      Alert.alert(tr('needsOnline'), tr('connectivityRequired'))
      return
    }

    if (values.admission_status === 'admitted' && !values.admission_severity) {
      Alert.alert('Severity Required', 'Please specify clinical severity (mild or severe) for admitted workers.')
      return
    }

    if (values.treatment_completed === 'no' && !values.treatment_incomplete_reason?.trim()) {
      Alert.alert('Reason Required', 'Please specify the reason why treatment was not completed.')
      return
    }

    setPending(true)
    try {
      const allSymptoms = (values.symptoms || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const payload: Record<string, any> = {
        patient_id: values.patient_id.trim(),
        temperature_c: values.temperature_c,
        fever_duration_days: values.fever_duration_days,
        symptoms: allSymptoms,
        notes: values.notes || undefined,
        treatment_documentation: values.treatment_documentation || undefined,
        admission_status: values.admission_status,
        treatment_completed: values.treatment_completed,
      }

      if (values.admission_status === 'admitted') {
        payload.admission_severity = values.admission_severity
        if (values.discharge_date?.trim()) payload.discharge_date = values.discharge_date.trim()
      }

      if (values.treatment_completed === 'no') {
        payload.treatment_incomplete_reason = values.treatment_incomplete_reason?.trim()
      }

      await api('/assessments', session.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      Alert.alert(
        tr('saved'),
        'Clinical observation assessment recorded successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/dashboard'),
          },
        ]
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
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        <Card title="Clinical Observation Assessment">
          <Controller
            control={control}
            name="patient_id"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('selectWorker')}
                placeholder="e.g. M3-6A817D7C or UUID"
                value={value}
                onChangeText={onChange}
                hint="Enter the patient code from intake or copy from the dashboard"
                error={errors.patient_id?.message}
                required
              />
            )}
          />

          <View style={s.rowFields}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="temperature_c"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label={tr('temperature')}
                    placeholder="38.5"
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={onChange}
                    keyboardType="decimal-pad"
                    error={errors.temperature_c?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="fever_duration_days"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label={tr('feverDays')}
                    placeholder="3"
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    error={errors.fever_duration_days?.message}
                  />
                )}
              />
            </View>
          </View>

          {/* Quick Symptom Chips */}
          <View style={s.symptomsSection}>
            <Text style={s.sectionLabel}>Observed Symptoms</Text>
            <View style={s.symptomsChipsRow}>
              {COMMON_SYMPTOMS.map((sym) => {
                const isSelected = selectedSymptoms.includes(sym)
                return (
                  <Button
                    key={sym}
                    variant={isSelected ? 'primary' : 'outline'}
                    size="sm"
                    onPress={() => toggleSymptom(sym)}
                  >
                    {sym}
                  </Button>
                )
              })}
            </View>

            <Controller
              control={control}
              name="symptoms"
              render={({ field: { onChange, value } }) => (
                <Field
                  label="All Symptoms (comma-separated)"
                  placeholder="fever, chills, headache"
                  value={value}
                  onChangeText={(val) => {
                    onChange(val)
                    setSelectedSymptoms(
                      val
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean)
                    )
                  }}
                  hint={tr('symptomsHint')}
                  error={errors.symptoms?.message}
                />
              )}
            />
          </View>

          {/* Admission Flow */}
          <ChipPicker
            label="Encounter / Admission Status"
            options={[
              { label: 'Outpatient Encounter', value: 'outpatient' },
              { label: 'Inpatient Hospital Admission', value: 'admitted' },
            ]}
            value={currentAdmission}
            onChange={(val) => setValue('admission_status', val as any)}
          />

          {currentAdmission === 'admitted' && (
            <View style={s.admissionBox}>
              <Text style={s.admissionTitle}>Inpatient Admission Details</Text>
              <ChipPicker
                label="Admission Clinical Severity"
                options={[
                  { label: 'Mild / Moderate', value: 'mild' },
                  { label: 'Severe / Complicated', value: 'severe' },
                ]}
                value={currentSeverity || 'mild'}
                onChange={(val) => setValue('admission_severity', val as any)}
                hint="Severity classification required when admitted"
              />

              <Controller
                control={control}
                name="discharge_date"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label="Discharge Date (YYYY-MM-DD)"
                    placeholder="e.g. 2026-10-25"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>
          )}

          {/* Treatment Completion */}
          <ChipPicker
            label="Treatment Course Completion Status"
            options={[
              { label: 'Not Applicable / Pending', value: 'not_applicable' },
              { label: 'Course Completed', value: 'yes' },
              { label: 'Course Incomplete', value: 'no' },
            ]}
            value={currentTreatmentCompleted}
            onChange={(val) => setValue('treatment_completed', val as any)}
          />

          {currentTreatmentCompleted === 'no' && (
            <Controller
              control={control}
              name="treatment_incomplete_reason"
              render={({ field: { onChange, value } }) => (
                <Field
                  label="Reason Course Incomplete"
                  placeholder="e.g. Migrated, side effects, lost to follow-up..."
                  value={value}
                  onChangeText={onChange}
                  required
                />
              )}
            />
          )}

          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('clinicianNotes')}
                placeholder="Physical examination notes, history, vitals..."
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={3}
                error={errors.notes?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="treatment_documentation"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('treatmentDoc')}
                placeholder="Documented prescribed regimen or hospital referral..."
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={3}
                hint="Prescription details recorded for follow-up verification"
                error={errors.treatment_documentation?.message}
              />
            )}
          />

          <View style={s.submitAction}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={pending}
              disabled={disabled || pending}
              onPress={handleSubmit(submit)}
            >
              {tr('submit')}
            </Button>
          </View>
        </Card>
    </FormShell>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  scrollContent: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    gap: 2,
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
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  symptomsSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#27272a',
  },
  symptomsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  admissionBox: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 8,
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
