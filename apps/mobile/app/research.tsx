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
import { router } from 'expo-router'
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

const statusEnum = z.enum([
  'not_tested',
  'pending',
  'inconclusive',
  'detected',
  'not_detected',
])

type LabStatus = z.infer<typeof statusEnum>

const schema = z.object({
  sample_id: z.string().min(1, 'Sample ID or Sample Code is required'),
  pcr_status: statusEnum,
  gametocyte_presence: statusEnum,
  pfhrp2_status: statusEnum,
  pfhrp3_status: statusEnum,
  parasite_density: z.coerce.number().min(0).optional(),
  parasite_density_unit: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function Research() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)

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
      sample_id: '',
      pcr_status: 'pending',
      gametocyte_presence: 'not_tested',
      pfhrp2_status: 'not_tested',
      pfhrp3_status: 'not_tested',
      parasite_density_unit: 'parasites/µL',
    },
  })

  const currentPcr = watch('pcr_status')
  const currentGametocyte = watch('gametocyte_presence')
  const currentPfhrp2 = watch('pfhrp2_status')
  const currentPfhrp3 = watch('pfhrp3_status')

  async function submit(values: FormValues) {
    if (disabled) {
      Alert.alert(tr('needsOnline'), tr('connectivityRequired'))
      return
    }

    setPending(true)
    try {
      await api('/research-results', session.token, {
        method: 'POST',
        body: JSON.stringify(values),
      })

      Alert.alert(
        tr('saved'),
        'Molecular research result logged successfully.',
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

  const labStatusOptions: { label: string; value: LabStatus }[] = [
    { label: 'Not Tested', value: 'not_tested' },
    { label: 'Pending', value: 'pending' },
    { label: 'Detected', value: 'detected' },
    { label: 'Not Detected', value: 'not_detected' },
    { label: 'Inconclusive', value: 'inconclusive' },
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
          <Text style={s.eyebrow}>EPIDEMIOLOGY & MOLECULAR LAB</Text>
          <Text style={s.title}>{tr('research')}</Text>
        </View>

        <NoticeBanner
          type="info"
          title="Research Data Isolation"
          message="Research lab findings are segregated from immediate clinical point-of-care decisions. Deletion markers and submicroscopic gametocyte detection support longitudinal molecular surveillance."
        />

        {!online && (
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        <Card title="Molecular Assay Logging">
          <Controller
            control={control}
            name="sample_id"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('sampleId')}
                placeholder="e.g. M3-S-58D58D60 or Sample UUID"
                value={value}
                onChangeText={onChange}
                hint="Identifier of diagnostic sample collected by pathology"
                error={errors.sample_id?.message}
                required
              />
            )}
          />

          <ChipPicker<LabStatus>
            label={tr('pcrStatus')}
            options={labStatusOptions}
            value={currentPcr}
            onChange={(val) => setValue('pcr_status', val)}
          />

          <ChipPicker<LabStatus>
            label={tr('gametocyte')}
            options={labStatusOptions}
            value={currentGametocyte}
            onChange={(val) => setValue('gametocyte_presence', val)}
          />

          <ChipPicker<LabStatus>
            label={tr('pfhrp2')}
            options={labStatusOptions}
            value={currentPfhrp2}
            onChange={(val) => setValue('pfhrp2_status', val)}
          />

          <ChipPicker<LabStatus>
            label={tr('pfhrp3')}
            options={labStatusOptions}
            value={currentPfhrp3}
            onChange={(val) => setValue('pfhrp3_status', val)}
          />

          <View style={s.rowFields}>
            <View style={{ flex: 1.5 }}>
              <Controller
                control={control}
                name="parasite_density"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label={tr('parasiteDensity')}
                    placeholder="e.g. 12500"
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    error={errors.parasite_density?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="parasite_density_unit"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label="Unit"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>
          </View>

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
  submitAction: {
    marginTop: 8,
  },
})
