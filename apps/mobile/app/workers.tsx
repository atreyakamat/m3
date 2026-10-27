/** Worker records — server-authorized list opened from the dashboard Workers
 *  count card (§25). Card, count and label all route here; the stack header
 *  returns to the dashboard.
 *
 *  Authorization: this screen enforces NOTHING itself. It calls
 *  GET /workers?q=…&offset=…&limit=… and shows what the server returns for
 *  the signed-in role (worker → own record only; contractor → own-site
 *  rosters; health_worker → assigned follow-up patients; clinician/pathologist
 *  → authorized records; research_lab → eligibility-gated profiles; admin →
 *  read-only) — exactly the scope the dashboard count uses.
 *
 *  Search: server-side, case-insensitive and trimmed, with debounce,
 *  stale-response protection, a clear control and an honest "no match" state.
 *  Demo sessions list local synthetic records only (clearly labelled).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api } from '@/src/api'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import {
  Button,
  Card,
  EmptyState,
  Field,
  FormShell,
  LoadingSpinner,
  NoticeBanner,
} from '@/components/ui'
import { DemoBanner } from '@/components/DemoBanner'
import { demoWorkers } from '@/src/demoData'
import {
  isSearching, LIST_PAGE_SIZE, normalizeQuery, SEARCH_DEBOUNCE_MS, SearchSeq, workersListPath,
} from '@/src/listSearch'

interface WorkerRow {
  id: string
  patient_code: string
  display_name?: string | null
  age_years?: number | null
  gender?: string | null
  occupation?: string | null
  consent_status?: string | null
}

export default function WorkersList() {
  const { language, session, online } = useAppStore()
  const tr = useCallback((k: Parameters<typeof t>[1]) => t(language, k), [language])
  const isDemo = Boolean(session?.demo)

  // Query text (typing) vs applied text (debounced, what the server last/next serves).
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [rows, setRows] = useState<WorkerRow[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [appending, setAppending] = useState(false)
  const [error, setError] = useState('')

  // Stale-response protection: only the newest request may commit.
  const seq = useRef(new SearchSeq())

  const load = useCallback(async (offset: number, append: boolean) => {
    const token = session?.token
    if (!token) return
    const n = seq.current.begin()
    if (append) setAppending(true)
    else setLoading(true)
    setError('')
    try {
      const res = await api<{ items: WorkerRow[]; total: number }>(
        workersListPath(appliedQuery, offset, LIST_PAGE_SIZE), token)
      if (!seq.current.isCurrent(n)) return // an older response loses
      if (append) {
        setRows((prev) => {
          const seen = new Set((prev ?? []).map((r) => r.id))
          return [...(prev ?? []), ...res.items.filter((r) => !seen.has(r.id))]
        })
      } else {
        setRows(res.items)
      }
      setTotal(res.total)
    } catch (e) {
      if (!seq.current.isCurrent(n)) return // stale error belongs to an older query
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      if (seq.current.isCurrent(n)) {
        setLoading(false)
        setAppending(false)
      }
    }
  }, [appliedQuery, session?.token])

  // Debounce: one request per pause in typing, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery((prev) => {
        const next = normalizeQuery(query)
        return next === prev ? prev : next
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  // Applied query changed → reset pagination and re-query the server.
  useEffect(() => {
    if (isDemo || !session?.token) return
    void load(0, false)
  }, [appliedQuery, isDemo, session?.token])

  // Demo session: local synthetic roster only. Never talks to a server, and
  // the honest banner says so.
  const [demoRows, setDemoRows] = useState<WorkerRow[] | null>(null)
  useEffect(() => {
    if (!isDemo) return
    const all = demoWorkers().map((w) => ({
      id: w.id, patient_code: w.patient_code, display_name: w.display_name,
      age_years: w.age_years, gender: w.gender, occupation: w.occupation, consent_status: w.consent_status,
    }))
    const q = normalizeQuery(query).toLowerCase()
    setDemoRows(q ? all.filter((w) => (w.display_name || '').toLowerCase().includes(q)) : all)
  }, [isDemo, query])

  const shownDemo = demoRows ?? []
  const canLoadMore = total !== null && (rows?.length ?? 0) < total
  const searching = isSearching(query)

  return (
    <FormShell contentContainerStyle={st.container}>
      <View style={st.header}>
        <Text style={st.eyebrow}>WORKFORCE</Text>
        <Text style={st.title}>{tr('workers')}</Text>
      </View>

      <NoticeBanner
        type="info"
        title={tr('serverSearchNote')}
        message={isDemo
          ? 'Demo session: local synthetic roster only — search runs on device data, not the server.'
          : 'Search by name runs on the server and returns only records authorized for your role.'}
      />
      {!isDemo && !online && (
        <NoticeBanner
          type="offline"
          title={tr('offline')}
          message="Name search needs the LAN API. Your dashboard count card reflects the last server sync."
        />
      )}
      {isDemo && <DemoBanner detail="Read-only synthetic roster. Worker registration happens from the Intake action card; searching here never uploads anything." />}

      <Card>
        <Field
          label={tr('search')}
          placeholder={tr('searchWorkers')}
          value={query}
          onChangeText={setQuery}
          hint={searching ? `Searching: “${normalizeQuery(query)}” (name match is case-insensitive)` : undefined}
        />
        {searching ? (
          <View style={st.clearRow}>
            <Button variant="ghost" size="sm" onPress={() => setQuery('')}>
              ✕ {tr('clearSearch')}
            </Button>
          </View>
        ) : null}
      </Card>

      {isDemo ? (
        shownDemo.length === 0 ? (
          searching ? (
            <EmptyState title={tr('noMatchTitle')} message={tr('workersNoMatch')} />
          ) : (
            <EmptyState title={tr('noRecords')} message="Demo roster is empty." />
          )
        ) : (
          <Card title={`${shownDemo.length} demo worker(s)`}>
            {shownDemo.map((w) => <WorkerRowView key={w.id} w={w} />)}
          </Card>
        )
      ) : error ? (
        <NoticeBanner
          type="error"
          title="Could not load workers"
          message={error}
          actionLabel="Retry"
          onAction={() => void load(0, false)}
        />
      ) : loading && rows === null ? (
        <LoadingSpinner message="Loading workers..." />
      ) : rows !== null && rows.length === 0 ? (
        searching ? (
          <EmptyState title={tr('noMatchTitle')} message={tr('workersNoMatch')} />
        ) : (
          <EmptyState title={tr('noRecords')} message="No worker records are in your authorized scope yet." />
        )
      ) : rows !== null ? (
        <Card title={`${rows.length} of ${total ?? rows.length} worker record(s)`}>
          {rows.map((w) => <WorkerRowView key={w.id} w={w} />)}
          {canLoadMore ? (
            <View style={st.clearRow}>
              <Button
                variant="outline"
                size="sm"
                loading={appending}
                onPress={() => void load(rows.length, true)}
              >
                {tr('loadMore')}
              </Button>
            </View>
          ) : null}
          <Text style={st.hint}>{tr('serverSearchNote')}</Text>
        </Card>
      ) : null}
    </FormShell>
  )
}

function WorkerRowView({ w }: { w: WorkerRow }) {
  return (
    <View style={st.row}>
      <View style={st.rowMain}>
        <Text style={st.rowTitle}>{w.display_name || 'De-identified'}</Text>
        <Text style={st.rowMeta}>
          {w.patient_code}
          {w.age_years ? ` · ${w.age_years}y` : ''}
          {w.gender ? ` · ${w.gender}` : ''}
        </Text>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  container: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
    flexGrow: 1,
    backgroundColor: '#f4f4f5',
  },
  header: { gap: 2 },
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
  clearRow: { marginTop: 4 },
  hint: {
    fontSize: 12,
    color: '#71717a',
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
  },
  rowMain: { gap: 2 },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181b',
  },
  rowMeta: {
    fontSize: 12,
    color: '#71717a',
  },
})
