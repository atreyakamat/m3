import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
})

type FormValues = z.infer<typeof schema>

const COMMON_SYMPTOMS = ['Fever', 'Chills', 'Headache', 'Body ache', 'Sweats', 'Nausea']

export default function Assessment() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const params = useLocalSearchParams<{ patientId?: string }>()

  const [pending, setPending] = useState(false)
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])

  const disabled = !online || !session?.token || session?.demo

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
    },
  })

  const currentPatientId = watch('patient_id')

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

    setPending(true)
    try {
      const allSymptoms = (values.symptoms || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const payload = {
        patient_id: values.patient_id.trim(),
        temperature_c: values.temperature_c,
        fever_duration_days: values.fever_duration_days,
        symptoms: allSymptoms,
        notes: values.notes || undefined,
        treatment_documentation: values.treatment_documentation || undefined,
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.container}
    >
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Text style={s.eyebrow}>CLINICAL OBSERVATION</Text>
          <Text style={s.title}>{tr('clinical')}</Text>
        </View>

        <NoticeBanner
          type="info"
          title="Clinical Scope Notice"
          message="Entries document observations only. The platform makes no automated diagnosis or treatment recommendations; all clinical decisions rest with the attending clinician."
        />

        {!online && (
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        <Card title="Assessment Details">
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
      </ScrollView>
    </KeyboardAvoidingView>
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
  submitAction: {
    marginTop: 8,
  },
})
