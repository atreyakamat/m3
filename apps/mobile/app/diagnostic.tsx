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
import { api, ApiError } from '@/src/api'
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

const sampleSchema = z.object({
  patient_id: z.string().min(1, 'Patient ID or Code is required'),
  method: z.enum(['rdt', 'microscopy', 'smp', 'other']),
  result_status: z.enum(['pending', 'positive', 'negative', 'indeterminate', 'cancelled']),
  species: z.enum(['pf', 'pv', 'mixed', 'other', 'undetermined']).optional(),
  species_other_note: z.string().max(200).optional(),
  smear_type: z.string().optional(),
})

type SampleFormValues = z.infer<typeof sampleSchema>

export default function Diagnostic() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const params = useLocalSearchParams<{ patientId?: string }>()

  const isPathologist = session?.user?.roles?.some((r: string) =>
    ['pathologist', 'pathology'].includes(r)
  )
  const disabled = !online || !session?.token || session?.demo || !isPathologist

  const [pending, setPending] = useState(false)
  const [activeTab, setActiveTab] = useState<'sample' | 'slide_followup'>('sample')

  // Slide follow-up state
  const [slideSampleId, setSlideSampleId] = useState('')
  const [scheduledDay, setScheduledDay] = useState('Day 3')
  const [slideDueDate, setSlideDueDate] = useState('')
  const [slideReceived, setSlideReceived] = useState<'yes' | 'no'>('yes')
  const [slidePositive, setSlidePositive] = useState<'yes' | 'no'>('no')
  const [positiveDay, setPositiveDay] = useState('Day 3')
  const [notReceivedReason, setNotReceivedReason] = useState<
    | 'patient_unavailable'
    | 'left_goa_migrated'
    | 'refused'
    | 'slide_broken_spoiled'
    | 'not_collected_by_worker'
    | 'other'
  >('patient_unavailable')
  const [otherReason, setOtherReason] = useState('')
  const [slideSubmitting, setSlideSubmitting] = useState(false)
  const [slideSuccessMsg, setSlideSuccessMsg] = useState('')

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SampleFormValues>({
    resolver: zodResolver(sampleSchema),
    defaultValues: {
      patient_id: params.patientId || '',
      method: 'rdt',
      result_status: 'pending',
      species: undefined,
      species_other_note: '',
      smear_type: '',
    },
  })

  const currentMethod = watch('method')
  const currentResultStatus = watch('result_status')
  const currentSpecies = watch('species')

  async function submitSample(values: SampleFormValues) {
    if (disabled) {
      Alert.alert(tr('needsOnline'), tr('connectivityRequired'))
      return
    }

    setPending(true)
    try {
      const payload: Record<string, any> = {
        patient_id: values.patient_id.trim(),
        method: values.method,
        result_status: values.result_status,
      }

      if (values.result_status === 'positive') {
        payload.species = values.species
        if (values.species === 'other') {
          payload.species_other_note = values.species_other_note || undefined
        }
      }

      if (values.method === 'microscopy') {
        payload.smear_type = values.smear_type || 'both'
      }

      const res = await api<any>('/samples', session.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      Alert.alert(
        tr('saved'),
        `Sample recorded: ${res.sample_code || 'Success'}\nStatus: ${res.result_status?.toUpperCase()}`,
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

  async function resolveSlideVersion(sampleId: string): Promise<string | undefined> {
    // Optimistic concurrency: the guard compares against the newest slide row
    // (falling back to the sample row when no follow-up exists yet, main.py:590).
    const list = await api<{ items: any[] }>('/samples', session?.token)
    const match = (list?.items || []).find(
      (item) => item.id === sampleId || item.sample_code === sampleId
    )
    if (!match) return undefined
    const slides = match.slide_followups as { updated_at?: string }[] | undefined
    const latest = slides && slides.length > 0 ? slides[slides.length - 1].updated_at : undefined
    return latest || (match.updated_at as string | undefined)
  }

  async function submitSlideWithVersion(baseUpdatedAt: string | undefined, sampleId: string) {
    await api(`/samples/${sampleId}/slide-followup`, session?.token, {
      method: 'PUT',
      body: JSON.stringify({ ...slidePayload(), base_updated_at: baseUpdatedAt }),
    })
  }

  function slidePayload(): Record<string, any> {
    const payload: Record<string, any> = {
      scheduled_day: scheduledDay,
      due_date: slideDueDate.trim() || undefined,
      received: slideReceived,
    }

    if (slideReceived === 'yes') {
      payload.positive = slidePositive
      if (slidePositive === 'yes') {
        payload.positive_day = positiveDay
      }
    } else {
      payload.not_received_reason = notReceivedReason
      if (notReceivedReason === 'other') {
        payload.other_reason = otherReason.trim()
      }
    }
    return payload
  }

  async function submitSlideFollowup() {
    if (!slideSampleId.trim()) {
      Alert.alert('Sample ID Required', 'Please enter the Sample Code or ID for the follow-up slide.')
      return
    }

    if (slideReceived === 'no' && notReceivedReason === 'other' && !otherReason.trim()) {
      Alert.alert('Reason Required', 'Please describe the other reason why the slide was not received.')
      return
    }

    setSlideSubmitting(true)
    setSlideSuccessMsg('')
    const sampleId = slideSampleId.trim()
    try {
      let baseUpdatedAt: string | undefined
      try {
        baseUpdatedAt = await resolveSlideVersion(sampleId)
      } catch {
        baseUpdatedAt = undefined
      }
      await submitSlideWithVersion(baseUpdatedAt, sampleId)

      setSlideSuccessMsg('Follow-up slide record saved successfully.')
      setSlideSampleId('')
    } catch (e) {
      const err = e as ApiError
      if (err instanceof ApiError && err.status === 409 && err.detail?.current_updated_at) {
        Alert.alert(
          'Record Changed Elsewhere',
          `This slide's follow-up was updated on another device at ${String(err.detail.current_updated_at).replace('T', ' ').slice(0, 19)}.\n\nYour entry was not applied. Load the latest record and apply your change again?`,
          [
            { text: 'Keep server version', style: 'cancel' },
            {
              text: 'Load & retry',
              onPress: async () => {
                setSlideSubmitting(true)
                try {
                  await submitSlideWithVersion(err.detail.current_updated_at, sampleId)
                  setSlideSuccessMsg('Follow-up slide record saved successfully.')
                  setSlideSampleId('')
                } catch (retryError) {
                  Alert.alert(tr('error'), retryError instanceof Error ? retryError.message : tr('error'))
                } finally {
                  setSlideSubmitting(false)
                }
              },
            },
          ]
        )
      } else {
        Alert.alert(tr('error'), e instanceof Error ? e.message : tr('error'))
      }
    } finally {
      setSlideSubmitting(false)
    }
  }

  const methodOptions = [
    { label: 'Rapid Test (RDT)', value: 'rdt' as const },
    { label: 'Microscopy Smear', value: 'microscopy' as const },
    { label: 'SMP Slide', value: 'smp' as const },
  ]

  const resultOptions = [
    { label: 'Pending', value: 'pending' as const },
    { label: 'Positive', value: 'positive' as const },
    { label: 'Negative', value: 'negative' as const },
    { label: 'Indeterminate', value: 'indeterminate' as const },
  ]

  const speciesOptions = [
    { label: 'P. falciparum (Pf)', value: 'pf' as const },
    { label: 'P. vivax (Pv)', value: 'pv' as const },
    { label: 'Mixed (Pf + Pv)', value: 'mixed' as const },
    { label: 'Other Species', value: 'other' as const },
    { label: 'Undetermined', value: 'undetermined' as const },
  ]

  return (
    <FormShell contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <Text style={s.eyebrow}>PATHOLOGY & DIAGNOSTICS</Text>
          <Text style={s.title}>{tr('pathology')}</Text>
        </View>

        <NoticeBanner
          type="info"
          title="Laboratory Protocol & Isolation"
          message="Pathologists verify initial diagnostic assays and longitudinal slide follow-ups. Indeterminate or pending samples are never marked negative."
        />

        {!online && (
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        {/* Tab Toggle */}
        <View style={s.tabRow}>
          <Button
            variant={activeTab === 'sample' ? 'primary' : 'outline'}
            size="sm"
            style={{ flex: 1 }}
            onPress={() => setActiveTab('sample')}
          >
            Diagnostic Sample
          </Button>
          <Button
            variant={activeTab === 'slide_followup' ? 'primary' : 'outline'}
            size="sm"
            style={{ flex: 1 }}
            onPress={() => setActiveTab('slide_followup')}
          >
            Slide Follow-Up
          </Button>
        </View>

        {/* TAB 1: DIAGNOSTIC SAMPLE */}
        {activeTab === 'sample' && (
          <Card title="Diagnostic Sample Entry" subtitle="Initial specimen registration and microscopy">
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

            <ChipPicker
              label={tr('method')}
              options={methodOptions}
              value={currentMethod}
              onChange={(val) => setValue('method', val)}
            />

            {currentMethod === 'microscopy' && (
              <Controller
                control={control}
                name="smear_type"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label="Smear Type"
                    placeholder="thick, thin, or both"
                    value={value}
                    onChangeText={onChange}
                    hint="Slide preparation method"
                  />
                )}
              />
            )}

            <ChipPicker
              label={tr('resultStatus')}
              options={resultOptions}
              value={currentResultStatus}
              onChange={(val) => setValue('result_status', val)}
            />

            {currentResultStatus === 'positive' && (
              <>
                <ChipPicker
                  label={tr('species')}
                  options={speciesOptions}
                  value={currentSpecies || 'pf'}
                  onChange={(val) => setValue('species', val)}
                  horizontal={false}
                  hint="Identified parasite species"
                />

                {currentSpecies === 'other' && (
                  <Controller
                    control={control}
                    name="species_other_note"
                    render={({ field: { onChange, value } }) => (
                      <Field
                        label="Other Species Description"
                        placeholder="e.g. P. malariae, P. ovale"
                        value={value}
                        onChangeText={onChange}
                        required
                      />
                    )}
                  />
                )}
              </>
            )}

            <View style={s.submitAction}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={pending}
                disabled={disabled || pending}
                onPress={handleSubmit(submitSample)}
              >
                Save Diagnostic Sample
              </Button>
            </View>
          </Card>
        )}

        {/* TAB 2: SLIDE FOLLOW-UP */}
        {activeTab === 'slide_followup' && (
          <Card title="Longitudinal Slide Follow-Up" subtitle="Scheduled post-treatment slide checks">
            {slideSuccessMsg ? (
              <NoticeBanner type="info" message={slideSuccessMsg} />
            ) : null}

            <Field
              label="Sample ID / Code"
              placeholder="e.g. M3-S-XXXXXXXX or Sample UUID"
              value={slideSampleId}
              onChangeText={setSlideSampleId}
              required
            />

            <ChipPicker
              label="Scheduled Protocol Day"
              options={[
                { label: 'Day 1', value: 'Day 1' },
                { label: 'Day 3', value: 'Day 3' },
                { label: 'Day 7', value: 'Day 7' },
                { label: 'Day 14', value: 'Day 14' },
                { label: 'Day 28', value: 'Day 28' },
              ]}
              value={scheduledDay}
              onChange={setScheduledDay}
            />

            <Field
              label="Due Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-10-25"
              value={slideDueDate}
              onChangeText={setSlideDueDate}
            />

            <ChipPicker
              label="Was Slide Received by Laboratory?"
              options={[
                { label: 'Yes, Slide Received', value: 'yes' },
                { label: 'No, Slide Not Received', value: 'no' },
              ]}
              value={slideReceived}
              onChange={(v) => setSlideReceived(v as any)}
            />

            {slideReceived === 'yes' ? (
              <View style={s.slideResultBox}>
                <ChipPicker
                  label="Follow-Up Slide Positivity"
                  options={[
                    { label: 'Negative (Clear)', value: 'no' },
                    { label: 'Positive (Parasites Present)', value: 'yes' },
                  ]}
                  value={slidePositive}
                  onChange={(v) => setSlidePositive(v as any)}
                />

                {slidePositive === 'yes' && (
                  <ChipPicker
                    label="Day Slide Confirmed Positive"
                    options={[
                      { label: 'Day 1', value: 'Day 1' },
                      { label: 'Day 3', value: 'Day 3' },
                      { label: 'Day 7', value: 'Day 7' },
                      { label: 'Day 14', value: 'Day 14' },
                      { label: 'Day 28', value: 'Day 28' },
                    ]}
                    value={positiveDay}
                    onChange={setPositiveDay}
                  />
                )}
              </View>
            ) : (
              <View style={s.slideResultBox}>
                <ChipPicker
                  label="Reason Slide Was Not Received"
                  options={[
                    { label: 'Patient unavailable', value: 'patient_unavailable' },
                    { label: 'Left Goa / Migrated', value: 'left_goa_migrated' },
                    { label: 'Worker refused', value: 'refused' },
                    { label: 'Slide broken / spoiled', value: 'slide_broken_spoiled' },
                    { label: 'Not collected by health worker', value: 'not_collected_by_worker' },
                    { label: 'Other reason', value: 'other' },
                  ]}
                  value={notReceivedReason}
                  onChange={(v) => setNotReceivedReason(v as any)}
                  horizontal={false}
                />

                {notReceivedReason === 'other' && (
                  <Field
                    label="Specify Other Reason"
                    placeholder="Describe why slide could not be examined"
                    value={otherReason}
                    onChangeText={setOtherReason}
                    required
                  />
                )}
              </View>
            )}

            <View style={s.submitAction}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={slideSubmitting}
                disabled={disabled || slideSubmitting}
                onPress={submitSlideFollowup}
              >
                Record Slide Follow-Up
              </Button>
            </View>
          </Card>
        )}
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
  tabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  submitAction: {
    marginTop: 8,
  },
  slideResultBox: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    gap: 10,
  },
})
