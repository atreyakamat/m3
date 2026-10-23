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
  isLocalMode,
  setLocalMode as setLocalModeApi,
} from '@/src/api'
import { demoSessionFor, demoRoleLabel, DEMO_ROLES, type DemoRole } from '@/src/demoData'
import {
  initDemoStore,
  setActiveDemoRole,
  getActiveDemoRole,
  listDemoRecords,
  listDemoActivity,
} from '@/src/demoStore'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import { localServerAvailable, localServerReset, localServerStart, localServerStop, localServerStatus, type LocalServerStatus } from '@/src/localServer'
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

// Demo entry is HIDDEN from the sign-in screen (superseded by Standalone Local
// Server mode testing). The entire demo-mode implementation remains in the code
// base intact — flip this flag to `true` to restore the demo card, the Quick
// Sign-In dev box and demo-session restore-on-launch.
const SHOW_DEMO_ENTRY = false

export default function Index() {
  const { language, setLanguage, setSession, setLastSync, online, customServerUrl, setCustomServerUrl, localMode, setLocalMode, setLocalServerReady, setOnline } = useAppStore()
  // Standalone Local Server bridge status (Phase 5): controls the embedded
  // real-backend startup UX. Server lifecycle lives in the native module.
  const [localServerState, setLocalServerState] = useState<LocalServerStatus | null>(null)
  const [localBusy, setLocalBusy] = useState(false)
  const localPollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  // Task 1: runtime server configuration (LAN IP / public tunnel URL).
  const [serverModalOpen, setServerModalOpen] = useState(false)
  const [serverInput, setServerInput] = useState('')
  const [serverTesting, setServerTesting] = useState(false)
  const [serverStatus, setServerStatus] = useState<null | { ok: boolean; message: string }>(null)
  // Offline Demo Mode: explicit role picker, no network involved.
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [demoSelectedRole, setDemoSelectedRole] = useState<DemoRole | ''>('')

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
      setSession({ token: result.access_token, user: result.user, demo: false, local: isLocalMode() })
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
      setSession({ token: result.access_token, user: result.user, demo: false, local: isLocalMode() })

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

  // -----------------------------------------------------------------------
  // Standalone Local Server mode (Phase 5). The REAL FastAPI backend is
  // embedded in the app (Chaquopy) and bound to 127.0.0.1 only. The API
  // client is switched to the loopback URL only AFTER an explicit readiness
  // signal, and local mode is persisted so a restart re-enters the same
  // lifecycle instead of silently falling back to a remote URL.
  // -----------------------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!localServerAvailable()) return
      const st = await localServerStatus()
      if (cancelled) return
      setLocalServerState(st)
      // Returning user: local mode was persisted but the in-process server
      // does not survive a process death — boot it again automatically.
      if (isLocalMode() && st.state !== 'ready') {
        void startLocalServer()
      }
    }
    void boot()
    return () => { cancelled = true; if (localPollTimer.current) clearTimeout(localPollTimer.current) }
  }, [])

  async function pollLocalServer(): Promise<LocalServerStatus> {
    let st: LocalServerStatus | null = null
    for (let i = 0; i < 100; i++) {
      st = await localServerStatus()
      if (st.state !== 'starting') return st
      await new Promise<void>((r) => setTimeout(r, 700))
    }
    return st ?? { state: 'failed', detail: 'Timed out waiting for the local server' }
  }

  async function startLocalServer() {
    if (localBusy) return
    setLocalBusy(true)
    try {
      await localServerStart()
      const st = await pollLocalServer()
      setLocalServerState(st)
      if (st.state === 'ready') {
        setLocalModeApi(true) // api.ts: force loopback base URL + persist flag
        setLocalMode(true)    // store
        setLocalServerReady(true)
        setOnline(true)       // the backend is on-device: local reads/writes work
        setLastSync(null)
      } else if (st.state === 'failed') {
        // Explicit failure surfaced to the tester; API target is left untouched.
        setLocalModeApi(false)
        setLocalMode(false)
        setLocalServerReady(false)
      }
    } catch (e) {
      setLocalServerState({ state: 'failed', detail: e instanceof Error ? e.message : String(e) })
      setLocalServerReady(false)
    } finally {
      setLocalBusy(false)
    }
  }

  async function stopLocalServer() {
    setLocalBusy(true)
    try {
      await localServerStop()
      setLocalServerState({ state: 'stopped', detail: '' })
      setLocalServerReady(false)
      setOnline(false)
    } finally {
      setLocalBusy(false)
    }
  }

  function exitLocalMode() {
    if (localPollTimer.current) clearTimeout(localPollTimer.current)
    void localServerStop()
    setLocalModeApi(false) // restores the saved remote URL resolution order
    setLocalMode(false)
    setLocalServerReady(false)
    setLocalServerState(null)
    // Recompute connectivity honestly for remote-server mode.
    setOnline(true)
  }

  /** Explicitly destructive: deletes the standalone SQLite database after a
   * typed confirmation dialog (all committed records are LOST). Refuses while
   * the server is running — stop it first. Never cascades into the remote
   * server config or any online-mode storage. */
  function requestLocalReset() {
    if (localServerState?.state === 'ready' || localServerState?.state === 'starting' || localBusy) {
      Alert.alert(tr('localServerStop'), tr('localServerIdleNotice'))
      return
    }
    Alert.alert(
      tr('localServerResetConfirmTitle'),
      tr('localServerResetConfirmBody'),
      [
        { text: tr('cancel'), style: 'cancel' },
        {
          text: tr('localServerReset'),
          style: 'destructive',
          onPress: async () => {
            try {
              await localServerReset()
            } catch (e) {
              Alert.alert(tr('localServerFailed'), e instanceof Error ? e.message : String(e))
            }
          },
        },
      ],
    )
  }

  function enterDemo(role: DemoRole) {
    // ZERO network activity: demo mode is initialized entirely from built-in
    // deterministic synthetic data. Nothing here may call `api()` or probe a
    // server — the demo session carries no token, so it could never authorize
    // a real request even if a screen attempted one.
    initDemoStore()
    setActiveDemoRole(role)
    setLastSync(null)
    setSession(demoSessionFor(role) as any)
    setDemoModalOpen(false)
    router.replace('/dashboard')
  }

  // Restore a persisted offline-demo session after an app restart (the marker
  // lives in the ISOLATED demo store, never in real session storage).
  // Skipped while the demo entry is hidden (SHOW_DEMO_ENTRY = false).
  React.useEffect(() => {
    if (!SHOW_DEMO_ENTRY) return
    const savedRole = getActiveDemoRole()
    if (savedRole && DEMO_ROLES.some((r) => r.role === savedRole)) {
      setSession(demoSessionFor(savedRole as DemoRole) as any)
      router.replace('/dashboard')
    }
  }, [])

  function fillSeededAccount(phone: string) {
    setMode('login')
    setLoginValue('phone', phone)
    // Shared dev database was seeded with PIN 1234 (older seed run).
    // Repo seed.py now documents 2468 — kept in sync issue docs/docs/UI_REBUILD_REPORT.md.
    setLoginValue('pin', '1234')
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
    <FormShell contentContainerStyle={[s.scrollContent, { width: '100%', maxWidth: 640, alignSelf: 'center' }]}>
        <View style={s.topBar}>
          <Text style={s.eyebrow}>M3 / GOA</Text>
          <View style={s.topBarActions}>
            {!localMode && (
              <Button variant="ghost" size="sm" onPress={openServerModal}>
                {tr('serverConfig')}
              </Button>
            )}
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

        {/* Standalone Local Server (Phase 5): the tablet hosts the REAL backend. */}
        <View style={s.demoSection}>
          <Text style={s.demoTitle}>{tr('localServerTitle')}</Text>
          <Text style={s.demoBody}>{tr('localServerBody')}</Text>
          {localServerState?.detail ? (
            <Text style={s.demoBody}>{localServerState.detail.slice(0, 280)}</Text>
          ) : null}
          {(!localMode || localServerState?.state !== 'ready') && (
            <Button
              variant="outline"
              size="md"
              disabled={localBusy || !localServerAvailable()}
              onPress={startLocalServer}
            >
              {localBusy ? tr('localServerStarting') : tr('localServerStart')}
            </Button>
          )}
          {localMode ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="ghost" size="sm" disabled={localBusy} onPress={stopLocalServer}>
                {tr('localServerStop')}
              </Button>
              <Button variant="ghost" size="sm" onPress={exitLocalMode}>
                {tr('localServerExit')}
              </Button>
              {(!localMode || localServerState?.state !== 'ready') && (
                <Button variant="danger" size="sm" disabled={localBusy} onPress={requestLocalReset}>
                  {tr('localServerReset')}
                </Button>
              )}
            </View>
          ) : null}
        </View>

        {!online && localMode && localServerState && (
          <NoticeBanner
            type={localServerState.state === 'failed' ? 'warning' : 'offline'}
            title={localServerState.state === 'failed' ? tr('localServerFailed') : tr('localServerTitle')}
            message={localServerState.state === 'failed'
              ? localServerState.detail.slice(0, 240)
              : tr('localServerIdleNotice')}
          />
        )}
        {!online && !localMode && (
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
              accessibilityRole="button"
              onPress={() => setMode('login')}
              style={({ pressed }) => [
                s.segmentedTab,
                mode === 'login' && s.segmentedTabActive,
                pressed && s.segmentedTabPressed,
              ]}
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
              accessibilityRole="button"
              onPress={() => setMode('signup')}
              style={({ pressed }) => [
                s.segmentedTab,
                mode === 'signup' && s.segmentedTabActive,
                pressed && s.segmentedTabPressed,
              ]}
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
                    placeholder="4-digit PIN (dev DB: 1234)"
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

        {/* Development Quick Role Fill — HIDDEN together with the demo card
            (SHOW_DEMO_ENTRY flag). Real login flow is unaffected. */}
        {SHOW_DEMO_ENTRY ? (
        <View style={s.devBox}>
          <Text style={s.devTitle}>Demo Quick Sign-In (PIN 1234 — dev DB; seed.py: 2468):</Text>
          <View style={s.devRow}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000001')}
            >
              Contractor
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000003')}
            >
              Clinician
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000004')}
            >
              Pathology
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000005')}
            >
              Worker
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000006')}
            >
              Health Worker
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000007')}
            >
              Research Lab
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => fillSeededAccount('+919000000008')}
            >
              Admin
            </Button>
          </View>
        </View>
        ) : null}

        {/* Offline Demo Mode — HIDDEN: superseded by Standalone Local Server mode.
            Code kept intact; restore by setting SHOW_DEMO_ENTRY = true. */}
        {SHOW_DEMO_ENTRY ? (
        <View style={s.demoSection}>
          <Text style={s.demoTitle}>{tr('offlineDemoEntryTitle')}</Text>
          <Text style={s.demoBody}>{tr('offlineDemoEntryBody')}</Text>
          <Button variant="outline" size="md" onPress={() => setDemoModalOpen(true)}>
            {tr('offlineDemoEnter')} →
          </Button>
        </View>
        ) : null}

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

        {/* Offline Demo role chooser — demo identity only, never real auth */}
        <Modal visible={demoModalOpen} transparent animationType="fade" onRequestClose={() => setDemoModalOpen(false)}>
          <View style={s.serverBackdrop}>
            <View style={[s.serverCard, s.demoCard]}>
              <Text style={s.serverTitle}>{tr('offlineDemoTitle')}</Text>
              <Text style={s.serverSubtitle}>{tr('offlineDemoChooseRole')}:</Text>
              <View style={s.demoRoleGrid}>
                {DEMO_ROLES.map(({ role, label, description }) => {
                  const active = demoSelectedRole === role
                  return (
                    <Pressable
                      key={role}
                      accessibilityRole="button"
                      onPress={() => setDemoSelectedRole(role)}
                      style={[s.demoRoleCard, active && s.demoRoleCardActive]}
                    >
                      <Text style={[s.demoRoleLabel, active && s.demoRoleLabelActive]}>{label}</Text>
                      <Text style={s.demoRoleDesc}>{description}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <View style={s.demoSeedRow}>
                <Text style={s.demoSeedText}>
                  Demo work on this device:{' '}
                  {listDemoRecords().length} submission{listDemoRecords().length === 1 ? '' : 's'} ·{' '}
                  {listDemoActivity().length} activity item{listDemoActivity().length === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={s.serverActionsRow}>
                <View style={s.serverActionBtn}>
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    disabled={!demoSelectedRole}
                    onPress={() => demoSelectedRole && enterDemo(demoSelectedRole)}
                  >
                    {demoSelectedRole
                      ? `${tr('offlineDemoEnter')} — ${demoRoleLabel(demoSelectedRole)}`
                      : tr('offlineDemoEnter')}
                  </Button>
                </View>
              </View>
              <View style={s.serverActionsRow}>
                <View style={s.serverActionBtn}>
                  <Button variant="ghost" size="md" fullWidth onPress={() => setDemoModalOpen(false)}>
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
  segmentedTabPressed: {
    backgroundColor: '#e2e8f0',
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
    backgroundColor: '#fef7ed',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f59e0b',
    padding: 14,
    gap: 8,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  demoBody: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 17,
  },
  demoCard: {
    maxWidth: 620,
    alignSelf: 'center',
  },
  demoRoleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoRoleCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  demoRoleCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  demoRoleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  demoRoleLabelActive: {
    color: '#92400e',
  },
  demoRoleDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  demoSeedRow: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
  },
  demoSeedText: {
    fontSize: 12,
    color: '#475569',
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
