import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { api, removeToken } from '@/src/api'
import {
  DEMO_OWNER,
  demoWorkers,
  readLastSync,
  writeWorkers,
  readWorkers,
  clearOwner,
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

  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const owner = session?.user?.id || DEMO_OWNER
  const roles = session?.user?.roles || []
  const canWrite = online && !session?.demo

  const isWorkerOnly = roles.length === 1 && roles[0] === 'worker'
  const isContractor = roles.includes('contractor')
  const isClinician = roles.includes('clinician')
  const isPathology = roles.includes('pathology')
  const isHealthWorker = roles.includes('health_worker')
  const isResearch = roles.includes('research_lab')

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
      loadCache()
    } catch (e) {
      Alert.alert(tr('error'), e instanceof Error ? e.message : tr('error'))
    } finally {
      setRefreshing(false)
    }
  }, [session?.token, online, session?.demo, owner, loadCache, setLastSync, tr])

  useEffect(() => {
    loadCache()
    if (session?.demo) {
      setSummary({
        workers: 1,
        followups_due: 1,
        samples_pending: 1,
        tests_positive: 0,
      })
    } else {
      refresh()
    }
  }, [session?.demo, loadCache, refresh])

  function logout() {
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
          {/* Intake - Health Workers & Admins */}
          {(isHealthWorker || !isWorkerOnly) && (
            <ActionCard
              title={tr('intake')}
              subtitle="Register worker, assign site, consent"
              disabled={!canWrite}
              onPress={() => router.push('/intake')}
            />
          )}

          {/* Clinical Assessment - Clinicians & Health Workers */}
          {(isClinician || isHealthWorker) && (
            <ActionCard
              title={tr('clinical')}
              subtitle="Observations, symptoms, fever"
              disabled={!canWrite}
              onPress={() => router.push('/assessment')}
            />
          )}

          {/* Pathology - Lab & Clinicians */}
          {(isPathology || isClinician) && (
            <ActionCard
              title={tr('pathology')}
              subtitle="RDT & Microscopy test documentation"
              disabled={!canWrite}
              onPress={() => router.push('/diagnostic')}
            />
          )}

          {/* Follow-ups - Health Workers & Clinicians */}
          {(isHealthWorker || isClinician) && (
            <ActionCard
              title={tr('followups')}
              subtitle="Protocol-scheduled checkups"
              disabled={!canWrite}
              onPress={() => router.push('/followup')}
            />
          )}

          {/* Research Lab - Research Team */}
          {(isResearch || isClinician) && (
            <ActionCard
              title={tr('research')}
              subtitle="PCR & molecular surveillance results"
              disabled={!canWrite}
              onPress={() => router.push('/research')}
            />
          )}

          {/* Construction Sites - Contractor, Health Worker, Clinician */}
          <ActionCard
            title={tr('sites')}
            subtitle="Construction camps & active sites"
            onPress={() => router.push('/sites')}
          />
        </View>
      </View>

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
