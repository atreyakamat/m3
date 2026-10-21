import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { api, removeToken, baseUrl } from '@/src/api'
import {
  DEMO_OWNER,
  demoWorkers,
  readLastSync,
  writeWorkers,
  readWorkers,
  clearOwner,
  readOutbox,
  outboxCount,
  readDraft,
  CachedWorker,
} from '@/src/cache'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import {
  Button,
  Card,
  Field,
  NoticeBanner,
  StatusBadge,
  EmptyState,
} from '@/components/ui'

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
  } = useAppStore()

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

  const checkDiagnostics = useCallback(async () => {
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
  }, [])

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
  const canWrite = online && !session?.demo

  const isWorkerOnly = roles.length === 1 && roles[0] === 'worker'
  const isContractor = roles.includes('contractor')
  const isClinician = roles.includes('clinician')
  const isPathology = roles.some((r) => ['pathologist', 'pathology'].includes(r))
  const isHealthWorker = roles.includes('health_worker')
  const isResearch = roles.includes('research_lab')
  const isAdmin = roles.includes('admin')

  const loadCache = useCallback(() => {
    try {
      const records = readWorkers(owner)
      setCachedWorkers(records)
    } catch {
      setCachedWorkers([])
    }
  }, [owner])

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
    if (session?.demo) {
      setSummary({
        workers: 1,
        followups_due: 1,
        samples_pending: 1,
        tests_positive: 0,
      })
    } else if (session?.token && online) {
      refresh()
      loadNotifications()
      loadCases()
    }
  }, [session?.token, online, session?.demo, owner])

  // P2: server-side session revocation is best-effort — it requires connectivity.
  // Locally cached authenticated state is cleared regardless; queued records and
  // drafts stay on the device so no field work is lost (mission P2 requirement).
  function logout() {
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
    setSession(null)
    router.replace('/')
  }

  const filteredWorkers = cachedWorkers.filter((w) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      w.patient_code.toLowerCase().includes(q) ||
      (w.display_name && w.display_name.toLowerCase().includes(q)) ||
      (w.occupation && w.occupation.toLowerCase().includes(q))
    )
  })

  return (
    <ScrollView contentContainerStyle={s.container}>
      {/* Top Header */}
      <View style={s.topNav}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>M3 / SURVEILLANCE PLATFORM</Text>
          <Text style={s.userName}>{session?.user?.display_name || 'Authorized User'}</Text>
          <View style={s.rolesRow}>
            {roles.map((r) => (
              <StatusBadge key={r} label={r.toUpperCase()} variant="neutral" />
            ))}
            {session?.demo && (
              <StatusBadge label="DEMO" variant="warning" />
            )}
          </View>
        </View>

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
      ) : session?.demo ? (
        <NoticeBanner
          type="warning"
          title="Demo Mode"
          message="Running in local sandbox mode with synthetic records. Sign in with an authorized LAN user for live server writes."
        />
      ) : null}

      {/* Metrics Row */}
      <View style={s.metricsRow}>
        <MetricCard label={tr('workers')} value={summary?.workers} />
        <MetricCard label={tr('pathology')} value={summary?.samples_pending} />
        <MetricCard label={tr('followups')} value={summary?.followups_due} />
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
          placeholder="Filter by patient ID or name"
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
          filteredWorkers.map((w) => (
            <Card key={w.id} style={s.workerCard}>
              <View style={s.workerTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.workerCode}>{w.patient_code}</Text>
                  {w.display_name && (
                    <Text style={s.workerName}>{w.display_name}</Text>
                  )}
                </View>
                <StatusBadge
                  label={w.consent_status === 'documented' ? 'CONSENTED' : 'PENDING'}
                  variant={w.consent_status === 'documented' ? 'success' : 'neutral'}
                />
              </View>

              <Text style={s.workerMeta}>
                {[
                  w.occupation || 'Worker',
                  w.age_years ? `${w.age_years} yrs` : null,
                  w.gender ? w.gender : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              {w.initial_symptoms && w.initial_symptoms.length > 0 && (
                <View style={s.symptomBox}>
                  <Text style={s.symptomLabel}>Initial symptoms:</Text>
                  <Text style={s.symptomText}>{w.initial_symptoms.join(', ')}</Text>
                </View>
              )}

              {/* Quick Action Buttons for this Worker */}
              {canWrite && (isClinician || isHealthWorker || isPathology) && (
                <View style={s.workerActionsRow}>
                  {(isClinician || isHealthWorker) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: '/assessment',
                          params: { patientId: w.patient_code },
                        })
                      }
                    >
                      + Assessment
                    </Button>
                  )}
                  {(isPathology || isClinician) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: '/diagnostic',
                          params: { patientId: w.patient_code },
                        })
                      }
                    >
                      + Diagnostic
                    </Button>
                  )}
                  {(isHealthWorker || isClinician) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: '/followup',
                          params: { patientId: w.patient_code },
                        })
                      }
                    >
                      + Follow-up
                    </Button>
                  )}
                </View>
              )}
            </Card>
          ))
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
          Configured API: {baseUrl}
        </Text>
        <Text style={s.workerMeta}>
          Local Outbox: {readOutbox(owner).length} queued for sync · Draft: {readDraft(owner) ? 'Saved' : 'None'}
        </Text>

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
              onPress={refresh}
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

      {/* Footer Controls */}
      <View style={s.footer}>
        <Button
          variant="outline"
          size="sm"
          onPress={() => setLanguage(language === 'en' ? 'hi' : 'en')}
        >
          {language === 'en' ? 'Switch to हिन्दी' : 'Switch to English'}
        </Button>
        <Button variant="danger" size="sm" onPress={logout}>
          {tr('logout')}
        </Button>
      </View>
    </ScrollView>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: number | undefined
}) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricNumber}>{value !== undefined ? value : '—'}</Text>
    </View>
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
  return (
    <Card style={[s.actionCard, disabled && s.actionCardDisabled]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.actionTitle, disabled && s.actionTextDisabled]}>{title}</Text>
        <Text style={s.actionSubtitle}>{subtitle}</Text>
      </View>
      <Button
        variant={disabled ? 'outline' : 'secondary'}
        size="sm"
        disabled={disabled}
        onPress={onPress}
      >
        {disabled ? 'Offline' : 'Open →'}
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
    backgroundColor: '#f4f4f5',
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
    color: '#71717a',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#18181b',
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
    borderColor: '#e4e4e7',
    padding: 14,
    borderRadius: 12,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a',
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#18181b',
    marginTop: 4,
    letterSpacing: -0.5,
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
    color: '#18181b',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#71717a',
  },
  actionsGrid: {
    gap: 8,
  },
  actionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
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
