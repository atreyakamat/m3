/** Diagnostics — lab sample list opened from the dashboard Diagnostics count
 *  card (§25; the mobile dashboard labels it "pathology"). List navigation is
 *  enabled only for roles the samples endpoint authorizes (pathologist /
 *  legacy pathology, and the eligibility-gated research lab).
 *
 *  Authorization: this screen enforces NOTHING itself. GET /samples?q=… is
 *  role-scoped by the server: research_lab sees ONLY eligibility-gated
 *  positive samples, PII-stripped (no linked-worker name at all); the
 *  pathologist lab scope sees the canonical linked-worker name, which is what
 *  name search matches against.
 *
 *  Search: server-side on the linked worker's canonical display name,
 *  case-insensitive and trimmed, debounced, with stale-response protection, a
 *  clear control, honest "no match" state and preserved RDT / microscopy / SMP
 *  distinctions (every test row keeps its method, species and result chips).
 *  Demo sessions list local synthetic records only.
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
  StatusBadge,
} from '@/components/ui'
import { DemoBanner } from '@/components/DemoBanner'
import { demoSamples } from '@/src/demoData'
import {
  isSearching, LIST_PAGE_SIZE, normalizeQuery, SEARCH_DEBOUNCE_MS, SearchSeq, samplesListPath,
} from '@/src/listSearch'

interface TestRow {
  id: string
  method?: string | null
  result_status?: string | null
  species?: string | null
  smear_type?: string | null
}

interface SampleRow {
  id: string
  sample_code: string
  patient_id: string
  /** Pathologist lab scope only; research_lab never receives it (PII-stripped). */
  patient_display_name?: string | null
  status: string
  specimen_type?: string | null
  tests?: TestRow[]
  slide_followups?: Array<{ id: string; scheduled_day?: string | number | null; received?: string | null }>
}

export default function SamplesList() {
  const { language, session, online } = useAppStore()
  const tr = useCallback((k: Parameters<typeof t>[1]) => t(language, k), [language])
  const isDemo = Boolean(session?.demo)

  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [rows, setRows] = useState<SampleRow[] | null>(null)
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
      const res = await api<{ items: SampleRow[]; total: number }>(
        samplesListPath(appliedQuery, offset, LIST_PAGE_SIZE), token)
      if (!seq.current.isCurrent(n)) return
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
      if (!seq.current.isCurrent(n)) return
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      if (seq.current.isCurrent(n)) {
        setLoading(false)
        setAppending(false)
      }
    }
  }, [appliedQuery, session?.token])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery((prev) => {
        const next = normalizeQuery(query)
        return next === prev ? prev : next
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (isDemo || !session?.token) return
    void load(0, false)
  }, [appliedQuery, isDemo, session?.token])

  const [demoRows, setDemoRows] = useState<SampleRow[] | null>(null)
  useEffect(() => {
    if (!isDemo) return
    // Demo samples carry a patient CODE only (analytic demo data keeps no
    // personal fields at all). Local case-insensitive code match is the search.
    const all = demoSamples().map((d) => ({
      id: d.id,
      sample_code: d.sample_code,
      patient_id: d.patient_code,
      status: d.result_status,
      specimen_type: 'blood',
      tests: [{ id: `${d.id}-test`, method: d.method, result_status: d.result_status, species: d.species, smear_type: d.smear_type }],
    }))
    const q = normalizeQuery(query).toLowerCase()
    setDemoRows(q ? all.filter((s) => s.sample_code.toLowerCase().includes(q) || s.patient_id.toLowerCase().includes(q)) : all)
  }, [isDemo, query])

  const shownDemo = demoRows ?? []
  const canLoadMore = total !== null && (rows?.length ?? 0) < total
  const searching = isSearching(query)

  return (
    <FormShell contentContainerStyle={st.container}>
      <View style={st.header}>
        <Text style={st.eyebrow}>DIAGNOSTICS &amp; PATHOLOGY</Text>
        <Text style={st.title}>{tr('pathology')}</Text>
      </View>

      <NoticeBanner
        type="info"
        title={tr('diagnosticsHint')}
        message={tr('serverSearchNote')}
      />
      {!isDemo && !online && (
        <NoticeBanner
          type="offline"
          title={tr('offline')}
          message="Name search needs the LAN API. Your dashboard sample count reflects the last server sync."
        />
      )}
      {isDemo && <DemoBanner detail="Read-only synthetic sample set. Recording lab results happens from the diagnostic form; nothing here uploads anywhere." />}

      <Card>
        <Field
          label={tr('search')}
          placeholder={tr('searchDiagnostics')}
          value={query}
          onChangeText={setQuery}
          hint={searching ? `Searching: “${normalizeQuery(query)}” (linked-worker name, case-insensitive)` : undefined}
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
            <EmptyState title={tr('noMatchTitle')} message={tr('diagnosticsNoMatch')} />
          ) : (
            <EmptyState title={tr('noRecords')} message="Demo sample set is empty." />
          )
        ) : (
          <Card title={`${shownDemo.length} demo sample(s)`}>
            {shownDemo.map((s) => <SampleRowView key={s.id} s={s} />)}
          </Card>
        )
      ) : error ? (
        <NoticeBanner
          type="error"
          title="Could not load diagnostics"
          message={error}
          actionLabel="Retry"
          onAction={() => void load(0, false)}
        />
      ) : loading && rows === null ? (
        <LoadingSpinner message="Loading samples..." />
      ) : rows !== null && rows.length === 0 ? (
        searching ? (
          <EmptyState title={tr('noMatchTitle')} message={tr('diagnosticsNoMatch')} />
        ) : (
          <EmptyState title={tr('noRecords')} message="No samples are authorized for your scope yet." />
        )
      ) : rows !== null ? (
        <Card title={`${rows.length} of ${total ?? rows.length} sample(s)`}>
          {rows.map((s) => <SampleRowView key={s.id} s={s} />)}
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
          <Text style={st.hint}>{tr('diagnosticsHint')}</Text>
        </Card>
      ) : null}
    </FormShell>
  )
}

function SampleRowView({ s }: { s: SampleRow }) {
  return (
    <View style={st.row}>
      <View style={st.rowMain}>
        <View style={st.rowTopline}>
          <Text style={st.rowTitle}>{s.sample_code}</Text>
          <StatusBadge
            label={(s.status || 'pending').toUpperCase()}
            variant={s.status === 'positive' ? 'danger' : s.status === 'negative' ? 'success' : 'neutral'}
            style={{ marginLeft: 'auto' }}
          />
        </View>
        <Text style={st.rowMeta}>
          {s.patient_display_name || `${(s.patient_id || '').slice(0, 8)}…`}
          {s.specimen_type ? ` · ${s.specimen_type}` : ''}
        </Text>
        {(s.tests ?? []).map((tt, i) => (
          <View key={tt.id ?? i} style={st.testRow}>
            <Text style={st.testText}>
              {(tt.method || 'test').toUpperCase()}
              {tt.result_status ? ` · ${tt.result_status.toUpperCase()}` : ''}
              {tt.species ? ` · ${tt.species.toUpperCase()}` : ''}
              {tt.smear_type ? ` · ${tt.smear_type} smear` : ''}
            </Text>
          </View>
        ))}
        {(s.slide_followups?.length ?? 0) > 0 ? (
          <Text style={st.slideFu}>
            Slide follow-up: day {String(s.slide_followups![0].scheduled_day ?? '?')} ·
            {' '}received: {s.slide_followups![0].received || 'pending'}
          </Text>
        ) : null}
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
  rowMain: { gap: 4 },
  rowTopline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181b',
  },
  rowMeta: {
    fontSize: 12,
    color: '#71717a',
  },
  testRow: { marginTop: 2 },
  testText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#3f3f46',
  },
  slideFu: {
    fontSize: 12,
    color: '#71717a',
  },
})
