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
import { api, saveToken } from '@/src/api'
import { demoWorkers, DEMO_OWNER, initCache, writeWorkers } from '@/src/cache'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import { Button, Field, NoticeBanner } from '@/components/ui'

const schema = z.object({
  phone: z.string().min(8, 'Phone number must be at least 8 digits'),
  pin: z.string().regex(/^\d{4,12}$/, 'PIN must be 4 to 12 digits'),
})

type FormValues = z.infer<typeof schema>

export default function Index() {
  const { language, setLanguage, setSession, setLastSync, online } = useAppStore()
  const [loading, setLoading] = useState(false)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: '',
      pin: '',
    },
  })

  const tr = (k: Parameters<typeof t>[1]) => t(language, k)

  async function signIn(values: FormValues) {
    setLoading(true)
    try {
      const result = await api<{
        access_token: string
        user: { id: string; display_name: string; roles: string[]; patient_id?: string }
      }>('/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify(values),
      })
      await saveToken(result.access_token)
      setSession({ token: result.access_token, user: result.user, demo: false })
      router.replace('/dashboard')
    } catch (e) {
      Alert.alert(tr('signinError'), e instanceof Error ? e.message : tr('error'))
    } finally {
      setLoading(false)
    }
  }

  function demo() {
    initCache()
    writeWorkers(DEMO_OWNER, demoWorkers)
    setLastSync(new Date().toISOString())
    setSession({
      demo: true,
      user: {
        id: DEMO_OWNER,
        display_name: 'Synthetic Demo Account',
        roles: ['worker'],
        patient_id: 'demo-worker-1',
      },
    })
    router.replace('/dashboard')
  }

  function fillSeededAccount(phone: string) {
    setValue('phone', phone)
    setValue('pin', '2468')
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
        <View style={s.topBar}>
          <Text style={s.eyebrow}>M3 / GOA</Text>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          >
            {language === 'en' ? 'हिन्दी' : 'English'}
          </Button>
        </View>

        <View style={s.header}>
          <Text style={s.title}>{tr('appName')}</Text>
          <Text style={s.subtitle}>{tr('syntheticNotice')}</Text>
        </View>

        {!online && (
          <NoticeBanner
            type="offline"
            title={tr('offline')}
            message={tr('connectivityRequired')}
          />
        )}

        <View style={s.form}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('phone')}
                placeholder="+919000000001"
                value={value}
                onChangeText={onChange}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={errors.phone?.message}
                required
              />
            )}
          />

          <Controller
            control={control}
            name="pin"
            render={({ field: { onChange, value } }) => (
              <Field
                label={tr('pin')}
                placeholder="4-digit PIN (e.g. 2468)"
                value={value}
                onChangeText={onChange}
                keyboardType="number-pad"
                secureTextEntry
                error={errors.pin?.message}
                required
              />
            )}
          />

          <View style={s.submitAction}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading || !online}
              onPress={handleSubmit(signIn)}
            >
              {tr('signIn')}
            </Button>
          </View>
        </View>

        {/* Development Quick Role Fill */}
        <View style={s.devBox}>
          <Text style={s.devTitle}>Demo Quick Sign-In (PIN 2468):</Text>
          <View style={s.devRow}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000001')}
            >
              Worker
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000002')}
            >
              Clinician
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000003')}
            >
              Pathology
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000004')}
            >
              Health Worker
            </Button>
          </View>
        </View>

        <View style={s.demoSection}>
          <Button variant="ghost" size="md" onPress={demo}>
            {tr('demo')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
    justifyContent: 'center',
    gap: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: '#a1a1aa',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },
  header: {
    gap: 6,
  },
  title: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 34,
    letterSpacing: -1,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  submitAction: {
    marginTop: 6,
  },
  devBox: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d4d4d8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoSection: {
    alignItems: 'center',
  },
})
