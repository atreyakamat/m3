import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useAppStore } from '@/src/store'
import { t } from '@/src/i18n'
import { api } from '@/src/api'
import { StatusBadge } from '@/components/ui'
import type { CachedWorker } from '@/src/cache'
import { demoAssessments, demoSamples, demoFollowups } from '@/src/demoData'

/* Task 4: bottom-sheet worker inspection with four detail tabs.
 * Tab 1 Profile: demographics and contact.
 * Tab 2 Screening: symptoms and date of the (single) screening.
 * Tab 3 Lab tests: microscopy / rapid test results.
 * Tab 4 Treatment: assessments, follow-ups, disposition.
 * Sections her role cannot read answer with a clear role restriction notice. */

interface DetailTabKey {
  key: 'profile' | 'screening' | 'lab' | 'treatment'
}

const TABS: { key: DetailTabKey['key']; titleKey: string }[] = [
  { key: 'profile', titleKey: 'profileTab' },
  { key: 'screening', titleKey: 'screeningTab' },
  { key: 'lab', titleKey: 'labTab' },
  { key: 'treatment', titleKey: 'treatmentTab' },
]

export function WorkerDetailModal({
  visible,
  worker,
  onClose,
}: {
  visible: boolean
  worker: CachedWorker | null
  onClose: () => void
}) {
  const { session, online, language } = useAppStore()
  const tr = useCallback((k: string) => t(language, k as any), [language])
  const [tab, setTab] = useState<DetailTabKey['key']>('profile')
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [roleData, setRoleData] = useState<{
    assessments?: { items: any[]; error?: string }
    samples?: { items: any[]; error?: string }
    followups?: { items: any[]; error?: string }
  }>({})

  useEffect(() => {
    if (visible) {
      setTab('profile')
      setDetail(null)
      setRoleData({})
    }
  }, [visible, worker?.id])

  const loadAll = useCallback(async () => {
    if (!worker) return
    if (session?.demo) {
      // Offline Demo: show the synthetic profile plus any synthetic examples
      // from demoData (and local demo records) — never a server fetch.
      setDetailError(null)
      setDetail(worker)
      const roles = session?.user?.roles || []
      const next: typeof roleData = {}
      if (roles.includes('clinician') || roles.includes('health_worker')) {
        next.assessments = { items: demoAssessments().filter((a) => a.patient_code === worker.patient_code) }
      }
      if (roles.some((r) => ['pathologist', 'pathology', 'research_lab'].includes(r))) {
        next.samples = { items: demoSamples().filter((s) => s.patient_code === worker.patient_code) }
      }
      if (roles.includes('clinician') || roles.includes('health_worker')) {
        next.followups = { items: demoFollowups().filter((f) => f.patient_code === worker.patient_code) }
      }
      setRoleData(next)
      return
    }
    if (!session?.token || !online) {
      setDetailError(tr('noWorkerDetails'))
      return
    }
    setDetailLoading(true)
    setDetailError(null)
    const next: typeof roleData = {}
    try {
      try {
        setDetail(await api<any>(`/workers/${worker.id}`, session.token))
      } catch (e: any) {
        setDetailError(e instanceof Error ? e.message : tr('noWorkerDetails'))
      }
      const isClinician = (session?.user?.roles || []).includes('clinician') || (session?.user?.roles || []).includes('admin')
      const isPath = (session?.user?.roles || []).some((r) => ['pathologist', 'pathology'].includes(r))
      const isHw = (session?.user?.roles || []).includes('health_worker')
      if (isClinician || isPath || isHw) {
        try {
          const res = await api<any>(`/assessments?patient_id=${worker.id}`, session.token)
          next.assessments = { items: res?.items || [] }
        } catch (e: any) {
          next.assessments = { items: [], error: e instanceof Error ? e.message : undefined }
        }
      }
      if (isPath || (session?.user?.roles || []).includes('research_lab')) {
        try {
          const res = await api<any>(`/samples?patient_id=${worker.id}`, session.token)
          next.samples = { items: res?.items || [] }
        } catch (e: any) {
          next.samples = { items: [], error: e instanceof Error ? e.message : undefined }
        }
      }
      if (isClinician || isHw) {
        try {
          const res = await api<any>(`/follow-ups?patient_id=${worker.id}`, session.token)
          next.followups = { items: res?.items || [] }
        } catch (e: any) {
          next.followups = { items: [], error: e instanceof Error ? e.message : undefined }
        }
      }
      setRoleData(next)
    } finally {
      setDetailLoading(false)
    }
  }, [worker, session?.token, session?.demo, online, session?.user?.roles, tr])

  useEffect(() => {
    if (visible) loadAll()
  }, [visible, loadAll])

  if (!worker) return null
  const screened = Boolean(detail?.screening_completed ?? worker.screening_completed)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Grab handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Header: name, code, status */}
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{detail?.display_name || worker.display_name || worker.patient_code}</Text>
              <Text style={s.code}>
                {detail?.patient_code || worker.patient_code}
                {detail?.phone_e164 ? `  •  📞 ${detail.phone_e164}` : worker.phone_e164 ? `  •  📞 ${worker.phone_e164}` : ''}
              </Text>
            </View>
            <StatusBadge
              label={screened ? tr('alreadyScreenedBadge') : tr('pendingBadge')}
              variant={screened ? 'success' : 'warning'}
            />
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={s.close}>✕</Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {TABS.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                onPress={() => setTab(item.key)}
                style={[s.tab, tab === item.key && s.tabActive]}
              >
                <Text style={[s.tabText, tab === item.key && s.tabTextActive]}>
                  {tr(item.titleKey as any)}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={s.body}>
            {detailLoading && !detail ? (
              <View style={s.loadingRow}>
                <ActivityIndicator color="#0f766e" />
              </View>
            ) : tab === 'profile' ? (
              <ProfileTab detail={detail} fallback={worker} error={detailError} tr={tr} />
            ) : tab === 'screening' ? (
              <ScreeningTab
                detail={detail}
                worker={worker}
                assessments={roleData.assessments}
                tr={tr}
              />
            ) : tab === 'lab' ? (
              <LabTab samples={roleData.samples} tr={tr} />
            ) : (
              <TreatmentTab
                assessments={roleData.assessments}
                followups={roleData.followups}
                tr={tr}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function KV({ label, value, tr }: { label: string; value: any; tr: (k: string) => string }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <View style={kv.row}>
      <Text style={kv.label}>{label}</Text>
      <Text style={kv.value}>{String(value)}</Text>
    </View>
  )
}

function Restricted({ msg, tr }: { msg?: string; tr: (k: string) => string }) {
  return (
    <View style={s.restrictedBox}>
      <Text style={s.restrictedText}>🔒 {msg || tr('noAccess')}</Text>
    </View>
  )
}

function ProfileTab({
  detail,
  fallback,
  error,
  tr,
}: {
  detail: any | null
  fallback: CachedWorker
  error: string | null
  tr: (k: string) => string
}) {
  if (error && !detail) {
    return (
      <View style={s.section}>
        {error && error.toLowerCase().includes('access') && <Restricted msg={error} tr={tr} />}
        <View style={s.sectionBox}>
          <Text style={s.emptyTitle}>{fallback.patient_code}</Text>
          <Text style={s.emptyBody}>{error || tr('noData')}</Text>
        </View>
      </View>
    )
  }
  const d = detail || {}
  return (
    <View style={s.section}>
      <View style={s.sectionBox}>
        <KV label={tr('patientCode')} value={d.patient_code || fallback.patient_code} tr={tr} />
        <KV label={tr('fullName')} value={d.display_name || fallback.display_name} tr={tr} />
        <KV label={tr('age')} value={d.age_years ?? fallback.age_years} tr={tr} />
        <KV label={tr('gender')} value={d.gender || fallback.gender} tr={tr} />
        <KV label={tr('phone')} value={d.phone_e164 || fallback.phone_e164} tr={tr} />
        <KV label={tr('nativity')} value={d.nativity || fallback.nativity} tr={tr} />
        <KV label={tr('occupation')} value={d.occupation || fallback.occupation} tr={tr} />
        <KV label={tr('consent')} value={d.consent_status || fallback.consent_status} tr={tr} />
      </View>
      {error && <Text style={s.warnText}>{error}</Text>}
    </View>
  )
}

function ScreeningTab({
  detail,
  worker,
  assessments,
  tr,
}: {
  detail: any | null
  worker: CachedWorker
  assessments?: { items: any[]; error?: string }
  tr: (k: string) => string
}) {
  const screened = Boolean(detail?.screening_completed ?? worker.screening_completed)
  const symptoms = detail?.initial_symptoms || worker.initial_symptoms || []
  return (
    <View style={s.section}>
      <View style={s.sectionBox}>
        <View style={kv.row}>
          <Text style={kv.label}>{tr('screeningCompleted')}</Text>
          <Text style={kv.value}>{screened ? '✅' : '⏳'}</Text>
        </View>
        {detail?.screened_at && <KV label={tr('lastSync').replace('.','')} value={String((detail.screened_at as string).slice(0, 10))} tr={tr} />}
        {symptoms.length > 0 && (
          <View style={kv.row}>
            <Text style={kv.label}>{tr('symptoms')}</Text>
            <Text style={kv.value}>{symptoms.join(', ')}</Text>
          </View>
        )}
      </View>
      {assessments?.items?.length ? (
        assessments.items.slice(0, 5).map((a) => (
          <View key={a.id} style={s.sectionBox}>
            <KV
              label={tr('status')}
              value={`${String(a.encounter_at || '').slice(0, 10)} — ${a.general_condition || a.outcome || '-'}`}
              tr={tr}
            />
          </View>
        ))
      ) : assessments?.error ? (
        <Restricted msg={assessments.error} tr={tr} />
      ) : (
        <Text style={s.emptyBody}>{tr('noData')}</Text>
      )}
    </View>
  )
}

function LabTab({
  samples,
  tr,
}: {
  samples?: { items: any[]; error?: string }
  tr: (k: string) => string
}) {
  if (samples?.error && !samples.items.length)
    return <View style={s.section}><Restricted msg={samples.error} tr={tr} /></View>
  if (!samples?.items?.length)
    return (
      <View style={s.section}>
        <Restricted msg={tr('noData')} tr={tr} />
      </View>
    )
  return (
    <View style={s.section}>
      {samples.items.map((s2) => (
        <View key={s2.id} style={s.sectionBox}>
          <KV label={tr('sampleId')} value={s2.sample_code} tr={tr} />
          <KV label={tr('status')} value={s2.status} tr={tr} />
          <KV label={tr('temperature').slice(0, 0) + 'collected'} value={String(s2.collected_at || '').slice(0, 10)} tr={tr} />
          {(s2.tests || []).map((test: any, i: number) => (
            <KV
              key={i}
              label={test.method === 'microscopy' ? tr('microscopy') : test.method === 'rdt' ? tr('rdt') : test.method}
              value={test.result_status}
              tr={tr}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

function TreatmentTab({
  assessments,
  followups,
  tr,
}: {
  assessments?: { items: any[]; error?: string }
  followups?: { items: any[]; error?: string }
  tr: (k: string) => string
}) {
  return (
    <View style={s.section}>
      {assessments?.items?.some((a) => a.treatment_documentation || a.outcome || a.admission_status) ?
        assessments.items.filter(Boolean).slice(0, 5).map((a) => (
          <View key={a.id} style={s.sectionBox}>
            <KV label={tr('admission') || 'Date'} value={String(a.encounter_at || '').slice(0, 10)} tr={tr} />
            <KV label="Admission" value={a.admission_status} tr={tr} />
            <KV label={tr('treatmentDoc')} value={a.treatment_documentation} tr={tr} />
            <KV label={tr('outcome')} value={a.outcome} tr={tr} />
            <KV label={tr('notes')} value={a.notes} tr={tr} />
          </View>
        )) : null}
      {followups?.items?.length ? (
        followups.items.slice(0, 10).map((f) => (
          <View key={f.id} style={s.sectionBox}>
            <KV
              label={tr('scheduleDue')}
              value={`${String(f.due_at || '').slice(0, 10)} — ${f.status}${f.adherence ? ` (${f.adherence})` : ''}`}
              tr={tr}
            />
          </View>
        ))
      ) : followups?.error ? (
        <Restricted msg={followups.error} tr={tr} />
      ) : (
        <Restricted msg={tr('noData')} tr={tr} />
      )}
      {assessments?.error && !assessments.items?.length && followups?.error && !followups.items?.length && (
        <View style={s.sectionBox}>
          <Text style={s.emptyBody}>{tr('noAccess')}</Text>
        </View>
      )}
    </View>
  )
}

const kv = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 3,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    maxWidth: '50%',
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'right',
  },
})

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  code: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  close: {
    fontSize: 18,
    color: '#0f766e',
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  tabRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    margin: 12,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0f766e',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  body: {
    padding: 12,
    gap: 8,
  },
  section: {
    gap: 8,
  },
  sectionBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  restrictedBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  restrictedText: {
    color: '#92400e',
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  emptyBody: {
    fontSize: 13,
    color: '#64748b',
  },
  warnText: {
    fontSize: 12,
    color: '#be123c',
  },
  loadingRow: {
    padding: 40,
    alignItems: 'center',
  },
})

export default WorkerDetailModal
