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
  method: z.enum(['rdt', 'microscopy']),
  result_status: z.enum(['pending', 'positive', 'negative', 'indeterminate', 'cancelled']),
  species: z.enum(['pf', 'pv', 'mixed', 'other', 'undetermined']).optional(),
  smear_type: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function Diagnostic() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const params = useLocalSearchParams<{ patientId?: string }>()

  const [pending, setPending] = useState(false)
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
      method: 'rdt',
      result_status: 'pending',
      species: undefined,
      smear_type: '',
    },
  })

  const currentMethod = watch('method')
  const currentResultStatus = watch('result_status')
  const currentSpecies = watch('species')

  async function submit(values: FormValues) {
    if (disabled) {
      Alert.alert(tr('needsOnline'), tr('connectivityRequired'))
      return
    }

    setPending(true)
    try {
      const payload = {
        patient_id: values.patient_id.trim(),
        method: values.method,
        result_status: values.result_status,
        species: values.result_status === 'positive' ? values.species : undefined,
        smear_type: values.method === 'microscopy' ? values.smear_type : undefined,
      }

      const res = await api<any>('/samples', session.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      Alert.alert(
        tr('saved'),
        `Sample recorded: ${res.sample_code || 'Success'}\nStatus: ${res.result_status.toUpperCase()}`,
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

  const methodOptions = [
    { label: 'Rapid Test (RDT)', value: 'rdt' as const },
    { label: 'Microscopy Smear', value: 'microscopy' as const },
  ]

  const resultOptions = [
    { label: 'Pending', value: 'pending' as const },
    { label: 'Positive', value: 'positive' as const },
    { label: 'Negative', value: 'negative' as const },
    { label: 'Indeterminate', value: 'indeterminate' as const },
    { label: 'Cancelled', value: 'cancelled' as const },
  ]

  const speciesOptions = [
    { label: 'P. falciparum (Pf)', value: 'pf' as const },
    { label: 'P. vivax (Pv)', value: 'pv' as const },
    { label: 'Mixed (Pf + Pv)', value: 'mixed' as const },
    { label: 'Other Species', value: 'other' as const },
    { label: 'Undetermined', value: 'undetermined' as const },
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
          <Text style={s.eyebrow}>PATHOLOGY & DIAGNOSTICS</Text>
          <Text style={s.title}>{tr('pathology')}</Text>
        </View>

        <NoticeBanner
          type="info"
          title="Laboratory Protocol"
          message="RDT and microscopy entries are managed as distinct laboratory records. A pending or indeterminate result must never be treated as negative."
        />

        {!online && (
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        <Card title="Diagnostic Sample Entry">
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
                  placeholder="Thick & thin smear, Giemsa stain"
                  value={value}
                  onChangeText={onChange}
                  hint="Specify slide preparation technique"
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
            <ChipPicker
              label={tr('species')}
              options={speciesOptions}
              value={currentSpecies || 'pf'}
              onChange={(val) => setValue('species', val)}
              horizontal={false}
              hint="Identified parasite species"
            />
          )}

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
  submitAction: {
    marginTop: 8,
  },
})
