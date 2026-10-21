import React, { useCallback, useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { api } from '@/src/api'
import { useAppStore } from '@/src/store'
import {
  Button,
  Card,
  EmptyState,
  LoadingSpinner,
  NoticeBanner,
  StatusBadge,
} from '@/components/ui'
import { router } from 'expo-router'

// Worker-facing case status screen. Served data is already role-scoped by the
// API: a worker's list/detail contains ONLY their own cases and a notes-free
// status_timeline (server redacts the clinical event trail from non-clinical
// viewers). This screen must not invent or enrich anything: statuses, times
// and case references come straight from the server response.

const STATUS_COPY: Record<string, string> = {
  submitted: 'Received',
  awaiting_clinical_review: 'Waiting for a clinician to review',
  assigned: 'Clinician has taken up your case',
  in_assessment: 'Clinician is assessing your case',
  diagnostic_testing_requested: 'A diagnostic test has been ordered',
  awaiting_diagnostic_result: 'Waiting for the test result',
  plan_recorded: 'Treatment / plan recorded',
  followup_due: 'A follow-up is scheduled',
  followup_completed: 'Follow-up completed',
  closed: 'Case closed',
}

function statusLabel(status: string): string {
  return STATUS_COPY[status] || `Status: ${String(status).replace(/_/g, ' ')}`
}

export default function MyCases() {
  const { session, online } = useAppStore()
  const token = session?.token

  const [cases, setCases] = useState<any[]>([])
  const [detail, setDetail] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)

  const authGuard = useCallback((): boolean => {
    if (!token || session?.demo || !session?.user?.roles?.includes('worker')) {
      setError('A signed-in worker session is required to view case status.')
      return false
    }
    return true
  }, [token, session])

  const loadList = useCallback(async () => {
    if (!authGuard()) return
    setLoading(true)
    setError('')
    try {
      const res = await api<any>('/cases?limit=50', token)
      setCases(res?.items || [])
      setLastSync(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh case status.')
    } finally {
      setLoading(false)
    }
  }, [token, authGuard])

  const loadDetail = useCallback(async (caseId: string) => {
    if (!authGuard()) return
    setLoading(true)
    setError('')
    try {
      const res = await api<any>(`/cases/${caseId}`, token)
      setDetail(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load case details.')
    } finally {
      setLoading(false)
    }
  }, [token, authGuard])

  useEffect(() => {
    loadList()
    // Reconnect-aware: whenever connectivity/token changes, re-fetch.
  }, [loadList, online])

  if (detail) {
    return (
      <ScrollView contentContainerStyle={st.container}>
        <Card
          title={`Case ${detail.case_code}`}
          badge={detail.urgent ? 'URGENT' : undefined}
        >
          <StatusBadge
            label={statusLabel(String(detail.status)).toUpperCase()}
            variant={detail.status === 'closed' ? 'neutral' : 'warning'}
          />
          <Text style={st.updated}>Last update: {String(detail.updated_at || detail.created_at).slice(0, 16).replace('T', ' ')}</Text>
          {(detail.status_timeline || []).length > 0 && (
            <>
              <Text style={st.sectionLabel}>What has happened</Text>
              {detail.status_timeline.map((step: any, i: number) => (
                <View key={`${step.to_status}-${i}`} style={st.timelineRow}>
                  <View style={st.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.timelineText}>{statusLabel(String(step.to_status))}</Text>
                    <Text style={st.timelineTime}>{String(step.created_at).slice(0, 16).replace('T', ' ')}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
          {String(detail.status) === 'followup_due' && (
            <NoticeBanner
              type="info"
              title="Follow-up"
              message="A health worker will visit or contact you for a follow-up. Please stay available at the site during your shift."
            />
          )}
          {String(detail.status) === 'closed' && (
            <NoticeBanner
              type="info"
              title="All done"
              message="Your case is closed. If you feel unwell again, submit a new health report."
            />
          )}
        </Card>
        <Button variant="ghost" onPress={() => setDetail(null)}>
          Back to my cases
        </Button>
      </ScrollView>
    )
  }

  return (
    <ScrollView contentContainerStyle={st.container}>
      {!online && (
        <NoticeBanner
          type="offline"
          title="Offline"
          message="Showing the last synchronized data. Case status updates when the connection returns."
        />
      )}
      {session?.demo && (
        <NoticeBanner
          type="warning"
          title="Demo Mode"
          message="Sign in with your worker account to see your real case status. Nothing is shown here by guesswork."
        />
      )}
      {error ? <NoticeBanner type="error" title="Could not load" message={error} /> : null}
      <View style={st.header}>
        <Text style={st.title}>My cases</Text>
        <Button size="sm" variant="outline" onPress={loadList} loading={loading}>
          Refresh
        </Button>
      </View>
      {loading && cases.length === 0 ? (
        <LoadingSpinner message="Loading case status…" />
      ) : cases.length === 0 ? (
        <EmptyState
          title="No cases yet"
          message={
            lastSync
              ? 'You have no health records in review right now. Tap Refresh after reconnecting.'
              : 'Tap Refresh to synchronize your case status.'
          }
        />
      ) : (
        cases.map((c) => (
          <Card key={c.id} style={st.caseCard}>
            <View style={st.caseTop}>
              <View style={{ flex: 1 }}>
                <Text style={st.caseCode}>{c.case_code}</Text>
                <Text style={st.caseMeta}>{String(c.created_at).slice(0, 16).replace('T', ' ')}{c.site_name ? ` · ${c.site_name}` : ''}</Text>
              </View>
              {c.urgent ? <StatusBadge label="URGENT" variant="danger" /> : null}
            </View>
            <StatusBadge
              label={statusLabel(String(c.status)).toUpperCase()}
              variant={c.status === 'closed' ? 'neutral' : 'warning'}
            />
            <Button
              variant="ghost"
              size="sm"
              onPress={() => loadDetail(c.id)}
            >
              View status history →
            </Button>
          </Card>
        ))
      )}
      {lastSync && (
        <Text style={st.syncNote}>Synchronized {lastSync.slice(0, 19).replace('T', ' ')} · data shown comes from the server only.</Text>
      )}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: '#f5f5f4', minHeight: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#1c1917', flex: 1 },
  caseCard: { gap: 8 },
  caseTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  caseCode: { fontSize: 15, fontWeight: '700', color: '#1c1917' },
  caseMeta: { fontSize: 12, color: '#78716c', marginTop: 2 },
  updated: { fontSize: 12, color: '#78716c', marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#44403c', marginTop: 12, marginBottom: 6 },
  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#166534', marginTop: 6 },
  timelineText: { fontSize: 14, color: '#1c1917' },
  timelineTime: { fontSize: 11, color: '#78716c', marginTop: 2 },
  syncNote: { fontSize: 11, color: '#a8a29e', textAlign: 'center', marginTop: 4 },
})
