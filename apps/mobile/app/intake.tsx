import React, { useEffect, useState } from 'react'
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
  ChipPicker,
  StepIndicator,
  NoticeBanner,
  LoadingSpinner,
} from '@/components/ui'

const schema = z.object({
  display_name: z.string().min(2, 'Name is required').max(100),
  age_years: z.coerce.number().int().min(0, 'Invalid age').max(120, 'Invalid age').optional(),
  gender: z.string().max(30).optional(),
  site_id: z.string().min(1, 'Please select a construction site'),
  occupation: z.string().max(80).optional(),
  travel_origin: z.string().max(120).optional(),
  initial_symptoms: z.string().optional(),
  consent_status: z.literal('documented', {
    errorMap: () => ({ message: 'Documented consent is mandatory' }),
  }),
})

type FormValues = z.infer<typeof schema>

interface SiteItem {
  id: string
  code: string
  name: string
  area: string
}

export default function Intake() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [sites, setSites] = useState<SiteItem[]>([])
  const [loadingSites, setLoadingSites] = useState(false)

  const disabled = !online || !session?.token || session?.demo

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: '',
      gender: 'Male',
      site_id: '',
      occupation: 'Mason',
      travel_origin: '',
      initial_symptoms: '',
      consent_status: 'documented',
    },
  })

  const selectedSiteId = watch('site_id')
  const selectedGender = watch('gender') || 'Male'

  // Fetch authorized sites
  useEffect(() => {
    async function loadSites() {
      if (!session?.token || !online || session?.demo) {
        setSites([
          {
            id: '326dcebb-0d74-488c-95ac-3357ba2d3019',
            code: 'SYN-SITE-01',
            name: 'Synthetic Riverside Build',
            area: 'Panaji',
          },
        ])
        setValue('site_id', '326dcebb-0d74-488c-95ac-3357ba2d3019')
        return
      }

      setLoadingSites(true)
      try {
        const res = await api<{ items: SiteItem[] }>('/sites', session.token)
        if (res.items && res.items.length > 0) {
          setSites(res.items)
          setValue('site_id', res.items[0].id)
        }
      } catch (e) {
        console.error('Failed to load sites:', e)
      } finally {
        setLoadingSites(false)
      }
    }

    loadSites()
  }, [session?.token, online, session?.demo, setValue])

  async function goToStep(nextStep: number) {
    if (nextStep > step) {
      if (step === 1) {
        const valid = await trigger(['display_name', 'age_years', 'gender'])
        if (!valid) return
      } else if (step === 2) {
        const valid = await trigger(['site_id', 'occupation', 'travel_origin'])
        if (!valid) return
      }
    }
    setStep(nextStep)
  }

  async function submit(values: FormValues) {
    if (disabled) {
      Alert.alert(tr('needsOnline'), tr('connectivityRequired'))
      return
    }

    setSubmitting(true)
    try {
      const symptomsList = values.initial_symptoms
        ? values.initial_symptoms
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []

      const payload = {
        display_name: values.display_name,
        age_years: values.age_years,
        gender: values.gender,
        site_id: values.site_id,
        occupation: values.occupation,
        travel_origin: values.travel_origin,
        initial_symptoms: symptomsList,
        consent_status: values.consent_status,
      }

      const result = await api<any>('/workers', session.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      Alert.alert(
        tr('saved'),
        `${tr('patientCode')}: ${result.patient_code}\nWorker registered successfully.`,
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
      setSubmitting(false)
    }
  }

  const genderOptions = [
    { label: tr('male'), value: 'Male' },
    { label: tr('female'), value: 'Female' },
    { label: tr('other'), value: 'Other' },
  ]

  const siteOptions = sites.map((s) => ({
    label: `${s.code} · ${s.name}`,
    value: s.id,
    caption: s.area,
  }))

  const stepLabels = [
    tr('demographics'),
    tr('assignment'),
    tr('symptoms'),
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
          <Text style={s.eyebrow}>SURVEILLANCE INTAKE</Text>
          <Text style={s.title}>{tr('registerWorker')}</Text>
        </View>

        <StepIndicator
          currentStep={step}
          totalSteps={3}
          labels={stepLabels}
        />

        {!online && (
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        {/* STEP 1: DEMOGRAPHICS */}
        {step === 1 && (
          <Card title="Demographic Information">
            <Controller
              control={control}
              name="display_name"
              render={({ field: { onChange, value } }) => (
                <Field
                  label="Worker Full Name"
                  placeholder="e.g. Ramesh Kumar"
                  value={value}
                  onChangeText={onChange}
                  error={errors.display_name?.message}
                  required
                />
              )}
            />

            <Controller
              control={control}
              name="age_years"
              render={({ field: { onChange, value } }) => (
                <Field
                  label={tr('age')}
                  placeholder="e.g. 28"
                  value={value !== undefined ? String(value) : ''}
                  onChangeText={onChange}
                  keyboardType="numeric"
                  error={errors.age_years?.message}
                />
              )}
            />

            <ChipPicker
              label={tr('gender')}
              options={genderOptions}
              value={selectedGender}
              onChange={(val) => setValue('gender', val)}
            />

            <View style={s.stepActions}>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onPress={() => goToStep(2)}
              >
                {tr('next')} →
              </Button>
            </View>
          </Card>
        )}

        {/* STEP 2: SITE & OCCUPATION */}
        {step === 2 && (
          <Card title="Site Assignment & Travel">
            {loadingSites ? (
              <LoadingSpinner message={tr('loadingSites')} />
            ) : sites.length === 0 ? (
              <NoticeBanner
                type="warning"
                title={tr('noSites')}
                message="No authorized sites were returned for this account. Contact your project administrator."
              />
            ) : (
              <ChipPicker
                label={tr('selectSite')}
                options={siteOptions}
                value={selectedSiteId}
                onChange={(val) => setValue('site_id', val)}
                horizontal={false}
                error={errors.site_id?.message}
              />
            )}

            <Controller
              control={control}
              name="occupation"
              render={({ field: { onChange, value } }) => (
                <Field
                  label="Occupation / Role"
                  placeholder="e.g. Mason, Barbender, Carpenter"
                  value={value}
                  onChangeText={onChange}
                  error={errors.occupation?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="travel_origin"
              render={({ field: { onChange, value } }) => (
                <Field
                  label={tr('travelOrigin')}
                  placeholder="Origin state/district (e.g. Murshidabad, WB)"
                  value={value}
                  onChangeText={onChange}
                  hint="Documented travel history within the last 30 days"
                  error={errors.travel_origin?.message}
                />
              )}
            />

            <View style={s.navButtonsRow}>
              <Button
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={() => goToStep(1)}
              >
                ← {tr('previous')}
              </Button>
              <Button
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                onPress={() => goToStep(3)}
              >
                {tr('next')} →
              </Button>
            </View>
          </Card>
        )}

        {/* STEP 3: SYMPTOMS & CONSENT */}
        {step === 3 && (
          <Card title="Clinical Symptoms & Documented Consent">
            <Controller
              control={control}
              name="initial_symptoms"
              render={({ field: { onChange, value } }) => (
                <Field
                  label={tr('symptoms')}
                  placeholder="e.g. fever, chills, headache"
                  value={value}
                  onChangeText={onChange}
                  hint={tr('symptomsHint')}
                  error={errors.initial_symptoms?.message}
                />
              )}
            />

            <NoticeBanner
              type="info"
              title="Consent Status Gate"
              message="Documented consent is recorded. In this prototype phase, field workers confirm informed consent before recording demographic records."
            />

            {Object.keys(errors).length > 0 && (
              <NoticeBanner
                type="error"
                title="Validation Check"
                message="Please resolve highlighted fields before submitting."
              />
            )}

            <View style={s.navButtonsRow}>
              <Button
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={() => goToStep(2)}
              >
                ← {tr('previous')}
              </Button>
              <Button
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                loading={submitting}
                disabled={disabled || submitting}
                onPress={handleSubmit(submit)}
              >
                {tr('submit')}
              </Button>
            </View>
          </Card>
        )}
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
  stepActions: {
    marginTop: 10,
  },
  navButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
})
