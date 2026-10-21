import React, { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  api,
  saveToken,
  applyServerUrl,
  normalizeServerUrl,
  probeServerUrl,
} from '@/src/api'
import { demoWorkers, DEMO_OWNER, initCache, writeWorkers } from '@/src/cache'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import { Button, ChipPicker, Field, NoticeBanner, FormShell, StatusBadge } from '@/components/ui'

const loginSchema = z.object({
  phone: z.string().min(8, 'Phone number must be at least 8 digits'),
  pin: z.string().regex(/^\d{4,12}$/, 'PIN must be 4 to 12 digits'),
})

const signupSchema = z.object({
  displayName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(8, 'Phone number must be at least 8 digits'),
  pin: z.string().regex(/^\d{4,12}$/, 'PIN must be 4 to 12 digits'),
  role: z.enum([
    'worker',
    'clinician',
    'pathologist',
    'health_worker',
    'contractor',
    'research_lab',
  ]),
})

type LoginFormValues = z.infer<typeof loginSchema>
type SignupFormValues = z.infer<typeof signupSchema>

const ROLE_OPTIONS = [
  { label: 'Labour Worker', value: 'worker' },
  { label: 'Clinician / Doctor', value: 'clinician' },
  { label: 'Field Health Worker', value: 'health_worker' },
  { label: 'Contractor', value: 'contractor' },
  { label: 'Pathologist / Lab', value: 'pathologist' },
  { label: 'Research Lab', value: 'research_lab' },
]

export default function Index() {
  const { language, setLanguage, setSession, setLastSync, online, customServerUrl, setCustomServerUrl } = useAppStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  // Task 1: runtime server configuration (LAN IP / public tunnel URL).
  const [serverModalOpen, setServerModalOpen] = useState(false)
  const [serverInput, setServerInput] = useState('')
  const [serverTesting, setServerTesting] = useState(false)
  const [serverStatus, setServerStatus] = useState<null | { ok: boolean; message: string }>(null)

  // Login form
  const {
    control: loginControl,
    handleSubmit: handleLoginSubmit,
    setValue: setLoginValue,
    formState: { errors: loginErrors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: '',
      pin: '',
    },
  })

  // Signup form
  const {
    control: signupControl,
    handleSubmit: handleSignupSubmit,
    watch: watchSignup,
    formState: { errors: signupErrors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: '',
      phone: '',
      pin: '',
      role: 'worker',
    },
  })

  const selectedRole = watchSignup('role')
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)

  async function signIn(values: LoginFormValues) {
    setLoading(true)
    try {
      const result = await api<{
        access_token: string
        user: { id: string; display_name: string; phone_e164?: string; roles: string[]; patient_id?: string }
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

  async function signUp(values: SignupFormValues) {
    setLoading(true)
    try {
      const result = await api<{
        access_token: string
        user: { id: string; display_name: string; phone_e164?: string; roles: string[]; patient_id?: string }
      }>('/auth/signup', undefined, {
        method: 'POST',
        body: JSON.stringify({
          phone: values.phone,
          pin: values.pin,
          display_name: values.displayName,
          role: values.role,
          preferred_language: language,
        }),
      })
      await saveToken(result.access_token)
      setSession({ token: result.access_token, user: result.user, demo: false })

      if (values.role === 'worker') {
        Alert.alert(
          'Registration Successful',
          `Welcome, ${result.user.display_name}! Please proceed to complete your 5-section malaria screening intake questionnaire.`,
          [
            {
              text: 'Start Screening Questionnaire',
              onPress: () => router.replace('/intake'),
            },
          ]
        )
      } else {
        router.replace('/dashboard')
      }
    } catch (e) {
      Alert.alert('Registration Failed', e instanceof Error ? e.message : tr('error'))
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
    setMode('login')
    setLoginValue('phone', phone)
    setLoginValue('pin', '2468')
  }

  function openServerModal() {
    setServerInput(customServerUrl || '')
    setServerStatus(null)
    setServerModalOpen(true)
  }

  async function testServerConnection() {
    setServerTesting(true)
    setServerStatus(null)
    try {
      const status = await probeServerUrl(serverInput)
      setServerStatus(status === 200
        ? { ok: true, message: `${tr('connOk')}` }
        : { ok: false, message: `${tr('connFail')} — HTTP ${status}` })
    } catch (e) {
      setServerStatus({
        ok: false,
        message: `${tr('connFail')}${e instanceof Error && e.message === 'Invalid URL' ? '' : ''} — ${e instanceof Error ? e.message : tr('error')}`,
      })
    } finally {
      setServerTesting(false)
    }
  }

  function saveServerUrl() {
    const normalized = normalizeServerUrl(serverInput)
    if (!normalized) {
      setServerStatus({ ok: false, message: tr('serverUrlInvalid') })
      return
    }
    applyServerUrl(normalized)
    setCustomServerUrl(normalized)
    setServerStatus({ ok: true, message: `${tr('serverSaved')}: ${normalized}` })
    Alert.alert(tr('serverSaved'), normalized)
  }

  function clearServerUrl() {
    applyServerUrl(null)
    setCustomServerUrl(null)
    setServerInput('')
    setServerStatus({ ok: true, message: tr('serverCleared') })
  }

  return (
    <FormShell contentContainerStyle={s.scrollContent}>
        <View style={s.topBar}>
          <Text style={s.eyebrow}>M3 / GOA</Text>
          <View style={s.topBarActions}>
            <Button variant="ghost" size="sm" onPress={openServerModal}>
              {tr('serverConfig')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            >
              {language === 'en' ? 'हिन्दी' : 'English'}
            </Button>
          </View>
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
          {/* Mode Switcher: Sign In vs Sign Up */}
          <View style={s.segmentedRow}>
            <Pressable
              style={[s.segmentedTab, mode === 'login' && s.segmentedTabActive]}
              onPress={() => setMode('login')}
            >
              <Text
                style={[
                  s.segmentedTabText,
                  mode === 'login' && s.segmentedTabTextActive,
                ]}
              >
                {tr('signIn')}
              </Text>
            </Pressable>
            <Pressable
              style={[s.segmentedTab, mode === 'signup' && s.segmentedTabActive]}
              onPress={() => setMode('signup')}
            >
              <Text
                style={[
                  s.segmentedTabText,
                  mode === 'signup' && s.segmentedTabTextActive,
                ]}
              >
                {tr('signUp')}
              </Text>
            </Pressable>
          </View>

          {mode === 'login' ? (
            /* --- Sign In View --- */
            <>
              <Controller
                control={loginControl}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label={tr('phone')}
                    placeholder="+919000000001"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    error={loginErrors.phone?.message}
                    required
                  />
                )}
              />

              <Controller
                control={loginControl}
                name="pin"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label={tr('pin')}
                    placeholder="4-digit PIN (e.g. 2468)"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                    secureTextEntry
                    error={loginErrors.pin?.message}
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
                  onPress={handleLoginSubmit(signIn)}
                >
                  {tr('signIn')}
                </Button>
              </View>
            </>
          ) : (
            /* --- Sign Up / Register View --- */
            <>
              <Controller
                control={signupControl}
                name="displayName"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label={tr('fullName')}
                    placeholder="e.g. Ramesh Kumar"
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="words"
                    error={signupErrors.displayName?.message}
                    required
                  />
                )}
              />

              <Controller
                control={signupControl}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label={tr('phone')}
                    placeholder="+919876543210"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    error={signupErrors.phone?.message}
                    required
                  />
                )}
              />

              <Controller
                control={signupControl}
                name="pin"
                render={({ field: { onChange, value } }) => (
                  <Field
                    label="Choose 4-digit PIN"
                    placeholder="e.g. 1234"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                    secureTextEntry
                    error={signupErrors.pin?.message}
                    required
                  />
                )}
              />

              <Controller
                control={signupControl}
                name="role"
                render={({ field: { onChange, value } }) => (
                  <ChipPicker
                    label="Select Account Role"
                    options={ROLE_OPTIONS}
                    value={value}
                    onChange={onChange}
                    error={signupErrors.role?.message}
                    hint={
                      value === 'worker'
                        ? 'Worker accounts are directly prompted to take the 5-section screening questionnaire.'
                        : 'Staff role for clinical, pathology, or contractor site management.'
                    }
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
                  onPress={handleSignupSubmit(signUp)}
                >
                  {selectedRole === 'worker'
                    ? 'Register & Start Screening'
                    : 'Create Account'}
                </Button>
              </View>
            </>
          )}
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
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000005')}
            >
              Research Lab
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000006')}
            >
              Contractor
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000007')}
            >
              Admin
            </Button>
          </View>
        </View>

        <View style={s.demoSection}>
          <Button variant="ghost" size="md" onPress={demo}>
            {tr('demo')}
          </Button>
        </View>

        {/* Task 1: Server Configuration modal dialog */}
        <Modal visible={serverModalOpen} transparent animationType="fade" onRequestClose={() => setServerModalOpen(false)}>
          <View style={s.serverBackdrop}>
            <View style={s.serverCard}>
              <Text style={s.serverTitle}>{tr('serverConfig')}</Text>
              <Text style={s.serverSubtitle}>
                {tr('currentServer')}: {customServerUrl || '(default)'}
              </Text>
              <Field
                label={tr('serverUrlLabel')}
                hint={tr('serverUrlHint')}
                placeholder="192.168.1.116:8003 or https://xyz.trycloudflare.com"
                value={serverInput}
                onChangeText={(text) => {
                  setServerInput(text)
                  setServerStatus(null)
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {serverStatus && (
                <View style={[s.serverStatusBox, serverStatus.ok ? s.serverStatusOk : s.serverStatusFail]}>
                  <Text style={[s.serverStatusText, !serverStatus.ok && s.serverStatusFailText]}>
                    {serverStatus.ok ? '✅ ' : '⚠️ '}
                    {serverStatus.message}
                  </Text>
                </View>
              )}
              <View style={s.serverActionsRow}>
                <View style={s.serverActionBtn}>
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    loading={serverTesting}
                    onPress={testServerConnection}
                  >
                    {serverTesting ? tr('testing') : tr('testConnection')}
                  </Button>
                </View>
                <View style={s.serverActionBtn}>
                  <Button variant="primary" size="md" fullWidth onPress={saveServerUrl}>
                    {tr('saveServerUrl')}
                  </Button>
                </View>
              </View>
              <View style={s.serverActionsRow}>
                <View style={s.serverActionBtn}>
                  <Button variant="outline" size="md" fullWidth onPress={clearServerUrl}>
                    {tr('clearServer')}
                  </Button>
                </View>
                <View style={s.serverActionBtn}>
                  <Button variant="ghost" size="md" fullWidth onPress={() => setServerModalOpen(false)}>
                    {language === 'hi' ? 'बंद करें' : 'Close'}
                  </Button>
                </View>
              </View>
            </View>
          </View>
        </Modal>
    </FormShell>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  topBarActions: {
    flexDirection: 'row',
    gap: 4,
  },
  eyebrow: {
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },
  header: {
    gap: 6,
  },
  title: {
    color: '#1e293b',
    fontWeight: '800',
    fontSize: 34,
    letterSpacing: -1,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentedTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentedTabTextActive: {
    color: '#1e293b',
    fontWeight: '700',
  },
  submitAction: {
    marginTop: 6,
  },
  devBox: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
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
  // Task 1: Server Configuration dialog
  serverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  serverCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  serverTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  serverSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  serverStatusBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  serverStatusOk: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  serverStatusFail: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  serverStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  serverStatusFailText: {
    color: '#e11d48',
  },
  serverActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  serverActionBtn: {
    flex: 1,
  },
})
