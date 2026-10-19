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
  due_at: z.string().datetime('Must be a valid ISO datetime'),
  adherence: z.string().optional(),
  outcome: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function getFutureDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export default function Followup() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const params = useLocalSearchParams<{ patientId?: string }>()

  const [pending, setPending] = useState(false)
  const [selectedInterval, setSelectedInterval] = useState<number>(3)
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
      due_at: getFutureDate(3),
      adherence: 'Full course reported',
      outcome: 'Recovered / Afebrile',
      notes: '',
    },
  })

  const currentDueAt = watch('due_at')
  const currentAdherence = watch('adherence') || 'Full course reported'
  const currentOutcome = watch('outcome') || 'Recovered / Afebrile'

  function applyPresetDays(days: number) {
    setSelectedInterval(days)
    setValue('due_at', getFutureDate(days))
  }

  async function submit(values: FormValues) {
    if (disabled) {
      Alert.alert(tr('needsOnline'), tr('connectivityRequired'))
      return
    }

    setPending(true)
    try {
      const payload = {
        patient_id: values.patient_id.trim(),
        due_at: values.due_at,
        adherence: values.adherence || undefined,
        outcome: values.outcome || undefined,
        notes: values.notes || undefined,
      }

      await api('/follow-ups', session.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      Alert.alert(
        tr('saved'),
        `Follow-up scheduled for: ${new Date(values.due_at).toLocaleDateString()}`,
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

  const adherenceOptions = [
    { label: 'Full Course Reported', value: 'Full course reported' },
    { label: 'Partial Adherence', value: 'Partial adherence' },
    { label: 'Missed Doses', value: 'Missed doses' },
    { label: 'Untreated', value: 'Untreated' },
  ]

  const outcomeOptions = [
    { label: 'Recovered / Afebrile', value: 'Recovered / Afebrile' },
    { label: 'Symptomatic / Persistent', value: 'Symptomatic / Persistent' },
    { label: 'Referred for Admission', value: 'Referred for Admission' },
    { label: 'Lost to Follow-up', value: 'Lost to Follow-up' },
  ]

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
          <Text style={s.eyebrow}>MONITORING & RETENTION</Text>
          <Text style={s.title}>{tr('followups')}</Text>
        </View>

        <NoticeBanner
          type="info"
          title="Protocol-Scheduled Follow-ups"
          message="Follow-up timing is determined by clinical surveillance protocol (+1d, +3d, +7d, +14d, +28d). Select an approved protocol interval below."
        />

        {!online && (
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        <Card title="Schedule Follow-up Visit">
          <Controller
            control={control}
            name="patient_id"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('selectWorker')}
                placeholder="e.g. M3-6A817D7C or UUID"
                value={value}
                onChangeText={onChange}
                hint="Patient code or UUID"
                error={errors.patient_id?.message}
                required
              />
            )}
          />

          {/* Protocol Preset Buttons */}
          <View style={s.presetSection}>
            <Text style={s.presetLabel}>Standard Protocol Intervals:</Text>
            <View style={s.presetRow}>
              {[1, 3, 7, 14, 28].map((days) => (
                <Button
                  key={days}
                  variant={selectedInterval === days ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => applyPresetDays(days)}
                >
                  +{days} {days === 1 ? 'day' : 'days'}
                </Button>
              ))}
            </View>
          </View>

          <Controller
            control={control}
            name="due_at"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('scheduleDue')}
                value={value}
                onChangeText={onChange}
                hint={`Scheduled: ${new Date(value).toLocaleString()}`}
                error={errors.due_at?.message}
                required
              />
            )}
          />

          <ChipPicker
            label={tr('adherence')}
            options={adherenceOptions}
            value={currentAdherence}
            onChange={(val) => setValue('adherence', val)}
            horizontal={false}
          />

          <ChipPicker
            label={tr('outcome')}
            options={outcomeOptions}
            value={currentOutcome}
            onChange={(val) => setValue('outcome', val)}
            horizontal={false}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('notes')}
                placeholder="Follow-up observations, worker status, next steps..."
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={3}
                error={errors.notes?.message}
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
  presetSection: {
    gap: 6,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#27272a',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  submitAction: {
    marginTop: 8,
  },
})
