import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { api, removeToken, base } from '@/src/api'
import { destinationHint, metricDestination, type MetricKey } from '@/src/metricNav'
import {
  DEMO_OWNER,
  readLastSync,
  readWorkers,
  writeWorkers,
  clearOwner,
  readOutbox,
  outboxCount,
  readDraft,
  readMeta,
  CachedWorker,
} from '@/src/cache'
import {
  demoSessionFor,
  demoWorkers,
  demoCases,
  demoAuditEvents,
  demoDashboardMetrics,
  DEMO_ROLES,
  type DemoRole,
  type DemoCase,
} from '@/src/demoData'
import {
  initDemoStore,
  setActiveDemoRole,
  resetDemoData,
  listDemoRecords,
  listDemoActivity,
  listDemoDrafts,
  type DemoRecord,
} from '@/src/demoStore'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import { flushOutbox } from '@/src/outbox'
import {
  Button,
  Card,
  Field,
  NoticeBanner,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
import { TourModal } from '@/components/TourModal'
import { DemoBanner } from '@/components/DemoBanner'
import { WorkerCard } from '@/components/WorkerCard'
import { WorkerDetailModal } from '@/components/WorkerDetailModal'
import { NotificationBell } from '@/components/NotificationBell'

interface DashboardMetricData {
  workers?: number
  samples_pending?: number
  followups_due?: number
  followups_overdue?: number
  tests_positive?: number
}

export default function Dashboard() {
  const {
    language,
    session,
    online,
    lastSync,
    setLastSync,
    setLanguage,
    setSession,
    clearSessionExpired,
  } = useAppStore()
  // 401 session-degradation: api.ts flags this centrally; render the banner
  // and let the user explicitly sign out (no auto-signout, drafts preserved).
  const sessionExpiredAt = useAppStore((x) => x.sessionExpiredAt)

  const [summary, setSummary] = useState<DashboardMetricData | null>(null)
  const [cachedWorkers, setCachedWorkers] = useState<CachedWorker[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [notifs, setNotifs] = useState<any[]>([])
  const [notifsLoading, setNotifsLoading] = useState(false)
  const [cases, setCases] = useState<any[]>([])
  const [diagnosticsInfo, setDiagnosticsInfo] = useState<any>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  // Task 3: interactive guided tour (shown once, reopenable from dashboard).
  const [showTour, setShowTour] = useState(false)
  // Task 4: worker inspect bottom sheet.
  const [detailWorker, setDetailWorker] = useState<CachedWorker | null>(null)
  // Offline Demo Mode: local synthetic work + role switcher.
  const [demoRoleOpen, setDemoRoleOpen] = useState(false)
  const [demoRecords, setDemoRecords] = useState<DemoRecord[]>([])
  const [demoActivity, setDemoActivity] = useState<any[]>([])
  const isDemo = Boolean(session?.demo)
  const refreshDemoWork = useCallback(() => {
    if (!session?.demo) return
    setDemoRecords(listDemoRecords())
    setDemoActivity(listDemoActivity())
  }, [session?.demo])

  // Offline demo runs its own self-check: no server contact is attempted.
  const checkDiagnostics = useCallback(async () => {
    if (session?.demo) {
      setDiagnosticsInfo({
        status: 'offline_demo',
        api_reachable: false,
        database_ready: false,
        app_version: 'offline-demo (local device)',
        environment: 'demo — local device only; no server was contacted',
      })
      return
    }
    setDiagnosticsLoading(true)
    try {
      const diag = await api<any>('/diagnostics')
      setDiagnosticsInfo(diag)
    } catch (e: any) {
      setDiagnosticsInfo({
        status: 'unreachable',
        api_reachable: false,
        database_ready: false,
        error: e instanceof Error ? e.message : 'Cannot reach API',
      })
    } finally {
      setDiagnosticsLoading(false)
    }
  }, [session?.demo])

  const [showQrModal, setShowQrModal] = useState(false)
  const [workerQrData, setWorkerQrData] = useState<{ token: string; patient_code?: string; created_at?: string } | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  const loadWorkerQr = useCallback(async () => {
    if (!session?.token || !online || session.demo) {
      setWorkerQrData({
        token: 'demo_qr_token_pass_worker_active',
        patient_code: 'M3-DEMO-001',
      })
      return
    }
    setQrLoading(true)
    try {
      const res = await api<any>('/workers/me/qr-token', session.token)
      setWorkerQrData(res)
    } catch (e: any) {
      Alert.alert('QR Pass', e instanceof Error ? e.message : 'Failed to load QR pass')
    } finally {
      setQrLoading(false)
    }
  }, [session?.token, online, session?.demo])

  const refreshWorkerQr = useCallback(async () => {
    if (!session?.token || !online || session.demo) return
    setQrLoading(true)
    try {
      const res = await api<any>('/workers/me/qr-token', session.token, { method: 'POST' })
      setWorkerQrData(res)
      Alert.alert('New QR Pass Generated', 'A new active QR token has been generated. Any previous QR tokens are now deactivated.')
    } catch (e: any) {
      Alert.alert('QR Pass Error', e instanceof Error ? e.message : 'Failed to regenerate QR token')
    } finally {
      setQrLoading(false)
    }
  }, [session?.token, online, session?.demo])

  const tr = useCallback((k: Parameters<typeof t>[1]) => t(language, k), [language])
  const owner = session?.user?.id || DEMO_OWNER
  const roles = session?.user?.roles || []
  // Demo sessions are explicitly allowed to exercise write-looking forms; the
  // screens capture those writes into the ISOLATED demo store instead of the
  // server. Only connectivity + a real token grant real write capability.
  const canWrite = Boolean((online && !session?.demo) || session?.demo)

  const isWorkerOnly = roles.length === 1 && roles[0] === 'worker'
  const isContractor = roles.includes('contractor')
  const isClinician = roles.includes('clinician')
  const isPathology = roles.some((r) => ['pathologist', 'pathology'].includes(r))
  const isHealthWorker = roles.includes('health_worker')
  const isResearch = roles.includes('research_lab')
  const isAdmin = roles.includes('admin')

  const loadCache = useCallback(() => {
    try {
      // Demo mode reads ONLY deterministic synthetic roster data; real cached
      // worker rows are never shown or modified inside a demo session.
      setCachedWorkers(session?.demo ? (demoWorkers() as unknown as CachedWorker[]) : readWorkers(owner))
    } catch {
      setCachedWorkers([])
    }
  }, [owner, session?.demo])

  const refresh = useCallback(async () => {
    if (!session?.token || !online || session.demo) return
    setRefreshing(true)
    try {
      const [workersRes, dashRes] = await Promise.all([
        api<any>('/workers?limit=100', session.token),
        api<any>('/dashboard', session.token),
      ])
      if (workersRes?.items) {
        writeWorkers(owner, workersRes.items)
      }
      setLastSync(new Date().toISOString())
      setSummary(dashRes)
      try {
        const records = readWorkers(owner)
        setCachedWorkers(records)
      } catch {
        setCachedWorkers([])
      }
    } catch (e) {
      Alert.alert(t(language, 'error'), e instanceof Error ? e.message : t(language, 'error'))
    } finally {
      setRefreshing(false)
    }
  }, [session?.token, online, session?.demo, owner, language, setLastSync])

  // Phase 2/3: persisted in-app notification inbox — every role with a session
  // sees notices routed to them; nothing is fabricated, an empty list is real.
  const loadNotifications = useCallback(async () => {
    if (!session?.token || !online || session?.demo || session?.user?.roles?.length === 0) return
    setNotifsLoading(true)
    try {
      const res = await api<any>('/notifications?limit=50', session.token)
      setNotifs(res?.items || [])
    } catch {
      // Non-fatal: notifications are informational.
    } finally {
      setNotifsLoading(false)
    }
  }, [session?.token, online, session?.demo])

  // Phase 3: role-scoped case queue (clinician/pathologist/admin; workers see
  // own case status through the same list endpoint).
  const loadCases = useCallback(async () => {
    if (!session?.token || !online || session?.demo) return
    try {
      const res = await api<any>('/cases?limit=20', session.token)
      setCases(res?.items || [])
    } catch {
      setCases([])
    }
  }, [session?.token, online, session?.demo])

  const markNotificationRead = useCallback(async (id: string) => {
    if (!session?.token) return
    try {
      await api('/notifications/read', session.token, {
        method: 'POST',
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
    } catch {
      // Non-fatal.
    }
  }, [session?.token])

  const ackCase = useCallback(async (caseId: string) => {
    if (!session?.token) return
    try {
      await api(`/cases/${caseId}/acknowledge`, session.token, { method: 'POST' })
      Alert.alert('Case acknowledged', 'The case is now assigned to you; record the clinical assessment next.')
      if (roles.includes('clinician')) loadCases()
    } catch (e) {
      Alert.alert('Not acknowledged', e instanceof Error ? e.message : 'Please retry.')
    }
  }, [session?.token, roles, loadCases])

  useEffect(() => {
    loadCache()
    refreshDemoWork()
    // Task 3: auto-open the guided tour on first launch only.
    if (!readMeta('m3_tour_completed')) setShowTour(true)
    if (session?.demo) {
      setSummary(demoDashboardMetrics(roles[0] as DemoRole))
    } else if (session?.token && online) {
      refresh()
      loadNotifications()
      loadCases()
    }
  }, [session?.token, online, session?.demo, owner, roles, loadCache, refreshDemoWork])

  // P2: server-side session revocation is best-effort — it requires connectivity.
  // Locally cached authenticated state is cleared regardless; queued records and
  // drafts stay on the device so no field work is lost (mission P2 requirement).
  function logout() {
    if (session?.demo) {
      // Demo sign-out is purely local: no API call, no token removal (a demo
      // session never holds one), no clearing of any real cached data, and no
      // demo-data wipe (use the explicit "Reset Demo Data" action for that).
      setActiveDemoRole(null)
      setSession(null)
      router.replace('/')
      return
    }
    if (session?.local) {
      // LOCAL (standalone) sign-out is a real logout against the embedded
      // backend. The local server itself keeps running across account
      // switches; its SQLite data persists until the explicit reset action.
      if (session.token && online) {
        api('/auth/logout', session.token, { method: 'POST' }).catch(() => {})
      }
      removeToken()
      clearSessionExpired()
      setSession(null)
      router.replace('/')
      return
    }
    if (session?.token !== undefined && online && !session?.demo) {
      api('/auth/logout', session.token, { method: 'POST' }).catch(() => {
        // Offline/expired: the server session expires on its own schedule; local sign-out proceeds.
      })
    }
    if (owner) {
      try {
        clearOwner(owner)
      } catch {}
    }
    removeToken()
    clearSessionExpired()
    setSession(null)
    router.replace('/')
  }

  // Replay Outbox: actually flushes the durable queue via the shared
  // src/outbox.ts module (previously this button only called `refresh`, which
  // never sent queued records). Reports before/after counts honestly.
  const [replayingOutbox, setReplayingOutbox] = useState(false)
  const handleReplayOutbox = useCallback(async () => {
    if (!session?.token || session?.demo || !online || replayingOutbox) return
    const before = outboxCount(owner)
    if (before === 0) {
      Alert.alert('Outbox is empty', 'There are no queued records to replay.')
      return
    }
    setReplayingOutbox(true)
    try {
      const result = await flushOutbox(owner, session.token, {
        demo: Boolean(session.demo),
      })
      const remaining = outboxCount(owner)
      Alert.alert(
        'Outbox Replay Finished',
        `Queued: ${before} — replayed ${result.succeeded}, failed ${result.failed}` +
          (result.authBlocked ? ' (session expired — sign in again to send the rest)' : '') +
          (remaining > 0 ? ` · ${remaining} still queued` : '')
      )
    } catch {
      Alert.alert('Outbox Replay Finished', `Queued: ${before} — replay failed; the queue is untouched and will retry automatically.`)
    } finally {
      setReplayingOutbox(false)
    }
  }, [owner, online, session?.token, session?.demo, replayingOutbox])

  const filteredWorkers = cachedWorkers.filter((w) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    // Task 4: match against name, phone, home state and occupation — no
    // alphanumeric patient code memorization required from field staff.
    return (
      w.patient_code.toLowerCase().includes(q) ||
      (w.display_name && w.display_name.toLowerCase().includes(q)) ||
      (w.phone_e164 && w.phone_e164.toLowerCase().includes(q)) ||
      (w.nativity && w.nativity.toLowerCase().includes(q)) ||
      (w.occupation && w.occupation.toLowerCase().includes(q))
    )
  })
  // Task 5: quick-action per role, respecting single-screening governance.
  // Clinician: Screen / Re-screen always via assessment. Health worker: only
  // authorized re-screen on already-screened workers (routine follow-up else).
  // Pathology: + Diagnostic. others: no quick action.
  const quickActionFor = (w: CachedWorker) => {
    const screened = Boolean(w.screening_completed)
    if (isClinician) {
      return {
        label: screened ? tr('rescreen') : tr('screenWorker'),
        disabled: !canWrite,
        onPress: () =>
          router.push({ pathname: '/assessment', params: { patientId: w.patient_code } }),
      }
    }
    if (isPathology) {
      return {
        label: `+ ${tr('pathology')}`,
        disabled: !canWrite && !isClinician,
        onPress: () =>
          router.push({ pathname: '/diagnostic', params: { patientId: w.patient_code } }),
      }
    }
    if (isHealthWorker && screened) {
      // Authorized re-screening (server enforces role + reason).
      return {
        label: tr('rescreen'),
        disabled: false,
        onPress: () =>
          router.push({ pathname: '/assessment', params: { patientId: w.patient_code } }),
      }
    }
    if (isHealthWorker) {
      return {
        label: `+ ${tr('followups')}`,
        disabled: false,
        onPress: () =>
          router.push({ pathname: '/followup', params: { patientId: w.patient_code } }),
      }
    }
    return undefined
  }

  return (
    <ScrollView contentContainerStyle={[s.container, { width: '100%', maxWidth: 820, alignSelf: 'center' }]}>
      {/* Top Header */}
      <View style={s.topNav}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>M3 / SURVEILLANCE PLATFORM</Text>
          <Text style={s.userName}>{session?.user?.display_name || 'Authorized User'}</Text>
          <View style={s.rolesRow}>
            {roles.map((r) => (
              <StatusBadge key={r} label={r.toUpperCase()} variant="neutral" />
            ))}
            {session?.local && (
              <StatusBadge label="LOCAL SERVER" variant="warning" />
            )}
            {session?.demo && (
              <StatusBadge label="DEMO" variant="warning" />
            )}
          </View>
        </View>

        {/* Task 7: notification bell with unread badge, top-right header. */}
        <NotificationBell />
        <StatusBadge
          label={online ? 'ONLINE' : 'OFFLINE'}
          variant={online ? 'success' : 'danger'}
        />
      </View>

      {/* Connectivity & Offline Banner */}
      {!online ? (
        <NoticeBanner
          type="offline"
          title="Offline Mode Active"
          message="Connection to LAN API is currently unavailable. You may view and search cached patient records below. Submissions and writes are disabled."
        />
      ) : null}
      {/* Local-Server Banner: persistent honesty about where data lives. */}
      {session?.local && (
        <NoticeBanner
          type="info"
          title="Standalone local server"
          message="This tablet is running the REAL M3 backend on 127.0.0.1. Accounts, records and audit history persist in app-private storage only — nothing is uploaded anywhere and no remote surveillance server participates in this session."
        />
      )}
      {/* Persistent Offline-Demo banner (demo sessions only). Stays visible on
          the dashboard; individual screens render their own banner too. */}
      {session?.demo && <DemoBanner />}

      {/* Demo self-check: server diagnostics are never contacted in demo. */}
      {session?.demo ? (
        <NoticeBanner
          type="info"
          title="Server, sync & notifications are switched off"
          message="This demo session never authenticates against the real backend: no sign-in, no refresh, no outbox replay, no notifications. All seven roles are explored with built-in synthetic data. Your real queued records (if you signed in online before) remain preserved and untouched."
        />
      ) : null}

      {/* Central 401 session-degradation banner (flag set by src/api.ts).
          Never wipes drafts or the token — sign out is user-initiated. */}
      {sessionExpiredAt ? (
        <NoticeBanner
          type="error"
          title={tr('sessionEndedTitle')}
          message={tr('sessionEndedMessage')}
          actionLabel={tr('signOut')}
          onAction={logout}
        />
      ) : null}

      {/* Metrics Row — each card is ONE accessible pressable (card, count and
          label all inside it) that opens the matching role-scoped record list;
          roles without an authorized list destination get an inert card
          (report §24). */}
      <View style={s.metricsRow}>
        <MetricCard metricKey="workers" label={tr('workers')} value={summary?.workers} roles={roles} />
        <MetricCard metricKey="pathology" label={tr('pathology')} value={summary?.samples_pending} roles={roles} />
        <MetricCard metricKey="followups" label={tr('followups')} value={summary?.followups_due} roles={roles} />
      </View>

      {/* Role-Specific Quick Actions */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Surveillance Actions</Text>
        <View style={s.actionsGrid}>
          {/* Screening questionnaire - the labour worker's own five-section form.
              Always reachable: offline it queues via the outbox and demo mode
              explains that live writes need a session (handled in-screen). */}
          {isWorkerOnly && (
            <ActionCard
              title={tr('intake')}
              subtitle="Complete your five-section screening"
              onPress={() => router.push('/intake')}
            />
          )}

          {/* Phase 2: worker "I feel unwell / need medical help" pathway.
              Always reachable (server guards apply per-session; offline saves
              to the encrypted outbox). */}
          {roles.includes('worker') && (
            <ActionCard
              title="I feel unwell"
              subtitle="Health report — goes to a clinician"
              onPress={() => router.push('/symptom')}
            />
          )}

          {/* Gate 4: worker case-status tracker. Shows ONLY the worker's own
              cases with server-confirmed status; no clinical notes (server
              already redacts the clinical event trail from workers). */}
          {roles.includes('worker') && (
            <ActionCard
              title="My cases"
              subtitle="Status of your health reports"
              onPress={() => router.push('/mycases')}
            />
          )}

          {roles.includes('worker') && (
            <ActionCard
              title="My QR Pass"
              subtitle="Show QR code to your contractor"
              onPress={() => {
                setShowQrModal(true)
                loadWorkerQr()
              }}
            />
          )}

          {/* Clinical Assessment - Clinicians only (server-enforced) */}
          {isClinician && (
            <ActionCard
              title={tr('clinical')}
              subtitle="Observations, symptoms, fever"
              disabled={!canWrite}
              onPress={() => router.push('/assessment')}
            />
          )}

          {/* Pathology - Pathologists only */}
          {(isPathology || isClinician) && (
            <ActionCard
              title={tr('pathology')}
              subtitle="RDT, microscopy & follow-up slides"
              disabled={!canWrite && !isClinician}
              onPress={() => router.push('/diagnostic')}
            />
          )}

          {/* Follow-ups - Health Workers (read-only view) & Clinicians (assign) */}
          {(isHealthWorker || isClinician) && (
            <ActionCard
              title={tr('followups')}
              subtitle={isClinician ? 'Assign health worker' : 'Your assigned assignments'}
              onPress={() => router.push('/followup')}
            />
          )}

          {/* Research Lab - read-only molecular dataset */}
          {(isResearch || isClinician) && (
            <ActionCard
              title={tr('research')}
              subtitle="Read-only molecular results"
              onPress={() => router.push('/research')}
            />
          )}

          {/* Construction Sites - contractor site management */}
          {isContractor && (
            <ActionCard
              title={tr('sites')}
              subtitle="Sites, QR worker assign & rosters"
              onPress={() => router.push('/sites')}
            />
          )}
        </View>
      </View>

      {/* Phase 3: Notification inbox (persisted, server-routed; none fabricated).
          Tap an unread notification to mark it read. */}
      {(notifs.length > 0 || notifsLoading) && !session?.demo && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Notifications</Text>
            <Text style={s.sectionSubtitle}>
              {notifs.filter((n) => !n.read_at).length} unread
            </Text>
          </View>
          {notifs.slice(0, 5).map((n) => (
            <Card key={`notif-${n.id}`} style={s.workerCard}>
              <Text style={{ color: n.read_at ? undefined : '#7c2d12' }}>{n.title}</Text>
              <Text style={s.workerMeta} numberOfLines={2}>{n.body}</Text>
              <View style={s.rolesRow}>
                <StatusBadge label={n.kind.replace(/_/g, ' ').toUpperCase()} variant="neutral" />
                <Text style={s.sectionSubtitle}>
                  {String(n.created_at).slice(0, 16).replace('T', ' ')}
                </Text>
              </View>
              {!n.read_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => markNotificationRead(n.id)}
                >
                  Mark read
                </Button>
              )}
            </Card>
          ))}
        </View>
      )}

      {/* Phase 3: Case queue. Clinician risk-stratifies + acknowledges routed
          reports; contractors/health workers see their scoped operational
          status. The list the server returns is already role-filtered. */}
      {cases.length > 0 && !session?.demo && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Case queue</Text>
            <Text style={s.sectionSubtitle}>{cases.length} recent</Text>
          </View>
          {cases.slice(0, 8).map((c) => (
            <Card key={c.id} style={s.workerCard}>
              <View style={s.workerTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.workerCode}>{c.case_code}</Text>
                  <Text style={s.workerMeta}>
                    {c.site_name ? `Site: ${c.site_name} · ` : ''}
                    {String(c.created_at).slice(0, 16).replace('T', ' ')}
                  </Text>
                </View>
                <View style={s.rolesRow}>
                  {c.urgent ? <StatusBadge label="URGENT" variant="danger" /> : null}
                  <StatusBadge label={String(c.status).toUpperCase()} variant={c.status === 'closed' ? 'neutral' : 'warning'} />
                </View>
              </View>
              {isClinician && c.status === 'awaiting_clinical_review' && (
                <Button variant="outline" size="sm" onPress={() => ackCase(c.id)}>
                  Acknowledge
                </Button>
              )}
            </Card>
          ))}
        </View>
      )}

      {/* Offline Demo: deterministic synthetic case queue (no server, no real
          clinical records) for clinician/pathologist/health-worker/admin review. */}
      {session?.demo && (isClinician || isPathology || isHealthWorker || isAdmin) && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Synthetic case queue (demo)</Text>
            <Text style={s.sectionSubtitle}>{demoCases().length} examples</Text>
          </View>
          {demoCases().map((c: DemoCase) => (
            <Card key={c.id} style={s.workerCard}>
              <View style={s.workerTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.workerCode}>{c.case_code}</Text>
                  <Text style={s.workerMeta}>
                    {c.site_name ? `Site: ${c.site_name} · ` : ''}
                    Worker: {c.patient_code} · {'synthetic'}
                  </Text>
                </View>
                <View style={s.rolesRow}>
                  {c.urgent ? <StatusBadge label="URGENT" variant="danger" /> : null}
                  <StatusBadge label="SYN" variant="warning" />
                  <StatusBadge label={String(c.status).toUpperCase()} variant={c.status === 'closed' ? 'neutral' : 'warning'} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Admin (demo): read-only synthetic audit + surveillance views. */}
      {session?.demo && isAdmin && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Synthetic audit & surveillance (demo)</Text>
            <Text style={s.sectionSubtitle}>read-only</Text>
          </View>
          <NoticeBanner
            type="info"
            title="Read-only in Offline Demo"
            message="Admin has no write capability in the application. These synthetic audit examples illustrate the audited event trail; they contain no real account activity."
          />
          {demoAuditEvents().map((e) => (
            <Card key={e.id} style={s.workerCard}>
              <Text style={s.workerCode}>{e.action}</Text>
              <Text style={s.workerMeta}>{e.detail}</Text>
              <Text style={s.sectionSubtitle}>
                {String(e.at).slice(0, 16).replace('T', ' ')} · {e.actor}
              </Text>
            </Card>
          ))}
        </View>
      )}

      {/* Offline Demo: local synthetic work inspector — drafts, demo
          submissions and local activity, kept strictly apart from the real
          outbox ("x queued for sync" below covers REAL submissions only). */}
      {session?.demo && (
        <Card style={s.syncCard}>
          <View style={s.sectionHeader}>
            <Text style={s.syncTitle}>{t(language, 'demoWorkTitle')}</Text>
            <StatusBadge label="LOCAL ONLY" variant="warning" />
          </View>
          {demoRecords.length === 0 ? (
            <Text style={s.workerMeta}>{t(language, 'demoWorkEmpty')}</Text>
          ) : (
            demoRecords.slice(0, 6).map((r) => (
              <View key={r.id} style={s.demoRecordRow}>
                <StatusBadge label="SYN" variant="warning" />
                <View style={{ flex: 1 }}>
                  <Text style={s.workerCode}>{r.label}</Text>
                  <Text style={s.workerMeta}>
                    {String(r.created_at).slice(0, 16).replace('T', ' ')} · {String(r.status).replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            ))
          )}
          {demoActivity.slice(0, 4).map((a) => (
            <Text key={a.id} style={s.workerMeta}>
              • {a.label} — {String(a.at).slice(0, 16).replace('T', ' ')}
            </Text>
          ))}
          {listDemoDrafts().length > 0 ? (
            <Text style={s.workerMeta}>Saved demo draft: {listDemoDrafts().length} (restored automatically when you open the questionnaire)</Text>
          ) : null}
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
            <Button
              variant="ghost"
              size="sm"
              style={{ flex: 1 }}
              onPress={refreshDemoWork}
            >
              Refresh demo list
            </Button>
            <Button
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => {
                Alert.alert(
                  t(language, 'offlineDemoResetConfirmTitle'),
                  t(language, 'offlineDemoResetConfirmBody'),
                  [
                    { text: language === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                    {
                      text: language === 'hi' ? 'रीसेट' : 'Reset',
                      style: 'destructive',
                      onPress: () => {
                        resetDemoData()
                        refreshDemoWork()
                      },
                    },
                  ]
                )
              }}
            >
              {t(language, 'offlineDemoReset')}
            </Button>
          </View>
        </Card>
      )}

      {/* Cached Worker Browser */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{tr('workers')}</Text>
          <Text style={s.sectionSubtitle}>
            {cachedWorkers.length} {cachedWorkers.length === 1 ? 'record' : 'records'} cached locally
          </Text>
        </View>

        <Field
          label={tr('search')}
          placeholder={tr('searchHint')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {filteredWorkers.length === 0 ? (
          <EmptyState
            title={tr('noRecords')}
            message={
              online && !session?.demo
                ? 'Tap Refresh below to synchronize worker records from the API server.'
                : 'No offline records found matching your filter.'
            }
          />
        ) : (
          filteredWorkers.map((w) => {
            // Task 5 UI feedback: locked screening shows "Screening Completed".
            const screeningInfo = Boolean(w.screening_completed) ? (
              <Text style={s.screenedNote}>
                🔒 {tr('screeningCompleted')}
                {w.screened_at ? ` · ${String(w.screened_at).slice(0, 10)}` : ''}
              </Text>
            ) : null
            return (
              <View key={w.id}>
                <WorkerCard
                  worker={w}
                  onOpenRecord={() => setDetailWorker(w)}
                  {...(quickActionFor(w)
                    ? {
                        onQuickAction: quickActionFor(w)!.onPress,
                        quickActionLabel: quickActionFor(w)!.label,
                        quickActionDisabled: quickActionFor(w)!.disabled,
                      }
                    : {})}
                />
                {screeningInfo}
              </View>
            )
          })
        )}
      </View>

      {/* Sync Card */}
      <Card style={s.syncCard}>
        <Text style={s.syncTitle}>{tr('lastSync')}</Text>
        <Text style={s.syncTime}>
          {lastSync
            ? new Date(lastSync).toLocaleString()
            : readLastSync(owner)
              ? new Date(readLastSync(owner)!).toLocaleString()
              : tr('notAvailable')}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            loading={refreshing}
            disabled={!online || session?.demo || refreshing}
            onPress={refresh}
          >
            {tr('refresh')}
          </Button>
        </View>
      </Card>

      {/* Diagnostics & Self-Healing Card (Section 4.4) */}
      <Card style={s.syncCard}>
        <View style={s.sectionHeader}>
          <Text style={s.syncTitle}>System Diagnostics & Health</Text>
          <StatusBadge
            label={online ? 'CONNECTED' : 'OFFLINE'}
            variant={online ? 'success' : 'danger'}
          />
        </View>
        <Text style={s.workerMeta}>
          Configured API: {base()}
        </Text>
        {session?.demo ? (
          <Text style={s.workerMeta}>
            OFFLINE DEMO: this session never contacts the API — the configured server above is shown for information only. Local demo items are never queued into the real outbox.
          </Text>
        ) : (
          <Text style={s.workerMeta}>
            Local Outbox: {readOutbox(owner).length} queued for sync · Draft: {readDraft(owner) ? 'Saved' : 'None'}
          </Text>
        )}

        {showDiagnostics && diagnosticsInfo && (
          <View style={{ marginTop: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <Text style={{ fontSize: 12, color: '#334155' }}>
              Database: <Text style={{ fontWeight: '700' }}>{diagnosticsInfo.database_ready ? 'Connected (SELECT 1)' : 'Not ready'}</Text> ({diagnosticsInfo.database_dialect || '—'})
            </Text>
            <Text style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
              Migrations: <Text style={{ fontWeight: '700' }}>{diagnosticsInfo.migration_state?.is_up_to_date ? 'Head (Up to date)' : diagnosticsInfo.migration_state?.current_revision || 'Unknown'}</Text>
            </Text>
            <Text style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
              App Version: {diagnosticsInfo.app_version || '0.1.0'} · Env: {diagnosticsInfo.environment || 'development'}
            </Text>
          </View>
        )}

        <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            style={{ flex: 1 }}
            loading={diagnosticsLoading}
            onPress={() => {
              setShowDiagnostics(true)
              checkDiagnostics()
            }}
          >
            {showDiagnostics ? 'Re-check Diagnostics' : 'Inspect Diagnostics'}
          </Button>
          {readOutbox(owner).length > 0 && online && (
            <Button
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              loading={replayingOutbox}
              disabled={replayingOutbox}
              onPress={handleReplayOutbox}
            >
              Replay Outbox
            </Button>
          )}
        </View>
      </Card>

      {/* Worker QR Pass Modal */}
      <Modal
        visible={showQrModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowQrModal(false)}
      >
        <ScrollView contentContainerStyle={s.container}>
          <View style={s.topNav}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>WORKER IDENTIFICATION</Text>
              <Text style={s.userName}>My Worker QR Pass</Text>
              <Text style={s.workerMeta}>
                {session?.user?.display_name || 'Worker'} · {workerQrData?.patient_code || 'ID Pending'}
              </Text>
            </View>
            <StatusBadge label="ACTIVE PASS" variant="success" />
          </View>

          <Card title="Worker QR Code Token" subtitle="Show this token to your site contractor">
            <View style={{ padding: 16, backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#e4e4e7', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 13, color: '#71717a', textAlign: 'center' }}>
                Present this active token to your contractor on site to enroll in or verify your work assignment.
              </Text>
              <View style={{ padding: 14, backgroundColor: '#f4f4f5', borderRadius: 6, width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#18181b', letterSpacing: 0.5, textAlign: 'center' }} selectable>
                  {workerQrData?.token || (qrLoading ? 'Generating token...' : 'No active token')}
                </Text>
              </View>
              <StatusBadge label="SINGLE ACTIVE PASS" variant="neutral" />
            </View>

            <View style={{ gap: 10, marginTop: 14 }}>
              <Button
                variant="outline"
                size="md"
                loading={qrLoading}
                disabled={qrLoading}
                onPress={refreshWorkerQr}
              >
                Regenerate QR Pass
              </Button>
              <Button
                variant="secondary"
                size="md"
                onPress={() => setShowQrModal(false)}
              >
                Close
              </Button>
            </View>
          </Card>
        </ScrollView>
      </Modal>

      {/* Worker Detail Modal (Task 4: bottom sheet, four tabs) */}
      <WorkerDetailModal
        visible={Boolean(detailWorker)}
        worker={detailWorker}
        onClose={() => setDetailWorker(null)}
      />

      {/* Guided tour (Task 3): auto on first launch, reopenable below. */}
      <TourModal visible={showTour} onClose={() => setShowTour(false)} />

      {/* Footer Controls */}
      <View style={s.footer}>
        <Button variant="outline" size="sm" onPress={() => setShowTour(true)}>
          {tr('startTour')}
        </Button>
        <Button variant="outline" size="sm" onPress={() => setLanguage(language === 'en' ? 'hi' : 'en')}>
          {language === 'en' ? 'Switch to हिन्दी' : 'Switch to English'}
        </Button>
        {session?.demo && (
          <Button variant="outline" size="sm" onPress={() => setDemoRoleOpen(true)}>
            {t(language, 'offlineDemoSwitchRole')}
          </Button>
        )}
        <Button variant="danger" size="sm" onPress={logout}>
          {tr('logout')}
        </Button>
      </View>

      {/* Demo role switcher — changes the demo identity ONLY. It is impossible
          for it to grant real server privileges: the session keeps token=undefined. */}
      <Modal visible={demoRoleOpen} transparent animationType="fade" onRequestClose={() => setDemoRoleOpen(false)}>
        <View style={s.demoBackdrop}>
          <View style={s.demoSwitchCard}>
            <Text style={s.demoSwitchTitle}>{t(language, 'offlineDemoChooseRole')}</Text>
            {DEMO_ROLES.map(({ role, label }) => (
              <Button
                key={role}
                variant={roles[0] === role ? 'primary' : 'outline'}
                size="md"
                fullWidth
                onPress={() => {
                  // Explicit demo role swap: same synthetic identity, new
                  // demo role. Never touches tokens, real sessions, or data.
                  initDemoStore()
                  setActiveDemoRole(role)
                  setSession(demoSessionFor(role as DemoRole) as any)
                  setDemoRoleOpen(false)
                }}
              >
                {label}
              </Button>
            ))}
            <Button variant="ghost" size="md" onPress={() => setDemoRoleOpen(false)}>
              {language === 'hi' ? 'बंद करें' : 'Close'}
            </Button>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

function MetricCard({
  metricKey,
  label,
  value,
  roles,
}: {
  metricKey: MetricKey
  label: string
  value: number | undefined
  roles: string[]
}) {
  const destination = metricDestination(metricKey, roles)
  const body = (<>
    <Text style={s.metricLabel}>{label}</Text>
    <Text style={s.metricNumber}>{value !== undefined ? value : '—'}</Text>
    {/* Affordance: same pressable carries the reachable-list hint. */}
    <Text style={s.metricOpen}>{destination ? 'View list →' : ' '}</Text>
  </>)
  if (!destination) {
    return <View style={s.metricCard}>{body}</View>
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} — ${destinationHint(metricKey)}`}
      accessibilityHint={destinationHint(metricKey)}
      onPress={() => router.push(destination as never)}
      style={({ pressed }) => [s.metricCard, s.metricCardClickable, pressed && s.metricCardPressed]}
    >
      {body}
    </Pressable>
  )
}

function ActionCard({
  title,
  subtitle,
  disabled = false,
  onPress,
}: {
  title: string
  subtitle: string
  disabled?: boolean
  onPress: () => void
}) {
  // The card is an inert View; the SINGLE tap target is one full-width button
  // that carries the title/subtitle and the "Open" affordance — no nested
  // pressables and no double dispatch.
  return (
    <Card style={[s.actionCard, disabled && s.actionCardDisabled]}>
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        disabled={disabled}
        onPress={onPress}
        style={s.actionCardTap}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.actionTitle, disabled && s.actionTextDisabled]}>{title}</Text>
            <Text style={s.actionSubtitle}>{subtitle}</Text>
          </View>
          <Text style={[s.actionOpen, disabled && s.actionTextDisabled]}>
            {disabled ? 'Offline' : 'Open →'}
          </Text>
        </View>
      </Button>
    </Card>
  )
}

const s = StyleSheet.create({
  container: {
    padding: 18,
    paddingTop: 54,
    paddingBottom: 40,
    gap: 16,
    backgroundColor: '#f8fafc',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#64748b',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    borderRadius: 12,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f766e',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  // Tappable count card affordances (report §24): same card surface, plus a
  // visible interactive hint and a pressed state. Native accessibility
  // (role=label+hint) keeps screen readers announcing the destination.
  metricCardClickable: {
    borderColor: '#99f6e4',
    minHeight: 72,
    justifyContent: 'center',
  },
  metricCardPressed: {
    backgroundColor: '#f0fdfa',
    borderColor: '#14b8a6',
  },
  metricOpen: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
    marginTop: 6,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#1e293b',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  actionsGrid: {
    gap: 8,
  },
  actionCard: {
    padding: 8,
    gap: 2,
  },
  actionCardTap: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  actionOpen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },
  actionCardDisabled: {
    backgroundColor: '#fafafa',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181b',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#71717a',
  },
  actionTextDisabled: {
    color: '#a1a1aa',
  },
  workerCard: {
    gap: 8,
    padding: 14,
  },
  screenedNote: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
  workerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workerCode: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181b',
    letterSpacing: 0.2,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#52525b',
    marginTop: 1,
  },
  workerMeta: {
    fontSize: 13,
    color: '#71717a',
  },
  symptomBox: {
    backgroundColor: '#f4f4f5',
    padding: 8,
    borderRadius: 8,
    gap: 2,
  },
  symptomLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase',
  },
  symptomText: {
    fontSize: 13,
    color: '#18181b',
  },
  workerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    paddingTop: 8,
  },
  demoRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
  demoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  demoSwitchCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  demoSwitchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 4,
  },
  syncCard: {
    padding: 14,
    gap: 4,
  },
  syncTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717a',
  },
  syncTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#18181b',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
})
