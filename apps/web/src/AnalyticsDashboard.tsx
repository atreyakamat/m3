import React, { useState, useEffect } from 'react'
import { api, baseUrl } from './api'
import { Badge, Button, Card, Modal, StatusBadge, Tabs } from './ui/components'

interface AnalyticsDashboardProps {
  token: string
  roles: string[]
}

export function AnalyticsDashboard({ token, roles }: AnalyticsDashboardProps) {
  const [subTab, setSubTab] = useState<'overview' | 'diagnostic' | 'lifecycle' | 'quality' | 'records'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Unified Filter State (PRD 7.1)
  const [period, setPeriod] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [dateBasis, setDateBasis] = useState<'received' | 'event'>('received')
  const [district, setDistrict] = useState<string>('')
  const [method, setMethod] = useState<string>('')
  const [resultStatus, setResultStatus] = useState<string>('')
  const [species, setSpecies] = useState<string>('')
  const [caseStatus, setCaseStatus] = useState<string>('')

  // Data states
  const [summaryData, setSummaryData] = useState<any>(null)
  const [trendsData, setTrendsData] = useState<any>(null)
  const [breakdownMethod, setBreakdownMethod] = useState<any>(null)
  const [breakdownDistrict, setBreakdownDistrict] = useState<any>(null)
  const [breakdownSite, setBreakdownSite] = useState<any>(null)
  const [dqData, setDqData] = useState<any>(null)
  const [testsData, setTestsData] = useState<any>(null)
  const [definitions, setDefinitions] = useState<any>(null)

  // Drill-down inspection state
  const [activeDqCheck, setActiveDqCheck] = useState<any>(null)
  const [dqRecords, setDqRecords] = useState<any[]>([])
  const [dqRecordsLoading, setDqRecordsLoading] = useState(false)
  const [recordsOffset, setRecordsOffset] = useState(0)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // Construct query string for API calls
  function buildQuery(extra: Record<string, string | number> = {}): string {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    if (dateBasis) params.set('date_basis', dateBasis)
    if (district) params.set('district', district)
    if (method) params.set('method', method)
    if (resultStatus) params.set('result_status', resultStatus)
    if (species) params.set('species', species)
    if (caseStatus) params.set('case_status', caseStatus)
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    }
    const q = params.toString()
    return q ? `?${q}` : ''
  }

  function handlePeriodChange(p: string) {
    setPeriod(p)
    const today = new Date().toISOString().split('T')[0]
    if (p === 'today') {
      setDateFrom(today)
      setDateTo(today)
    } else if (p === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      setDateFrom(d.toISOString().split('T')[0])
      setDateTo(today)
    } else if (p === '30d') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setDateFrom(d.toISOString().split('T')[0])
      setDateTo(today)
    } else if (p === 'all') {
      setDateFrom('')
      setDateTo('')
    }
  }

  function resetFilters() {
    setPeriod('all')
    setDateFrom('')
    setDateTo('')
    setDateBasis('received')
    setDistrict('')
    setMethod('')
    setResultStatus('')
    setSpecies('')
    setCaseStatus('')
    setRecordsOffset(0)
  }

  // Load analytics data
  async function loadData() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const q = buildQuery()
      const [sumRes, defRes] = await Promise.all([
        api<any>(`/analytics/summary${q}`, token),
        api<any>('/analytics/definitions', token),
      ])
      setSummaryData(sumRes)
      setDefinitions(defRes)

      // Fetch sub-tab data asynchronously
      if (subTab === 'diagnostic') {
        const [tr, bm, bd, bs] = await Promise.all([
          api<any>(`/analytics/trends${q}`, token),
          api<any>(`/analytics/breakdown${buildQuery({ by: 'method' })}`, token),
          api<any>(`/analytics/breakdown${buildQuery({ by: 'district' })}`, token),
          api<any>(`/analytics/breakdown${buildQuery({ by: 'site' })}`, token),
        ])
        setTrendsData(tr)
        setBreakdownMethod(bm)
        setBreakdownDistrict(bd)
        setBreakdownSite(bs)
      } else if (subTab === 'quality') {
        const dq = await api<any>(`/analytics/data-quality${q}`, token)
        setDqData(dq)
      } else if (subTab === 'records') {
        const recs = await api<any>(`/analytics/tests${buildQuery({ offset: recordsOffset, limit: 25 })}`, token)
        setTestsData(recs)
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [subTab, dateFrom, dateTo, dateBasis, district, method, resultStatus, species, caseStatus, recordsOffset])

  // Drill down on a specific DQ check
  async function inspectDqCheck(check: any) {
    setActiveDqCheck(check)
    setDqRecordsLoading(true)
    try {
      const res = await api<any>(`/analytics/data-quality/${check.key}/records${buildQuery({ limit: 50 })}`, token)
      setDqRecords(res.items || [])
    } catch (e) {
      setDqRecords([])
    } finally {
      setDqRecordsLoading(false)
    }
  }

  // Trigger CSV export
  async function handleExport(dataset: 'tests' | 'cases') {
    if (!token) return
    setExporting(true)
    setExportError('')
    try {
      const q = buildQuery()
      const url = `${baseUrl}/analytics/export/${dataset}.csv${q}`
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error(`Export failed (${resp.status})`)
      const blob = await resp.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `m3-${dataset}-analytics-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err: any) {
      console.error(err)
      setExportError(`Export error: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const tests = summaryData?.tests
  const cases = summaryData?.cases
  const workers = summaryData?.workers
  const reports = summaryData?.symptom_reports
  const followups = summaryData?.followups
  const pr = tests?.positive_rate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {/* Analytics Header & Title */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <div style={{ minWidth: 0 }}>
          <div className="m3-hint">Localhost Surveillance Intelligence</div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginTop: 2, overflowWrap: 'anywhere' }}>
            Goa Malaria Surveillance & Epidemiological Analytics
          </h2>
          <p className="m3-hint" style={{ marginTop: 'var(--sp-2)' }}>
            <span>As of: <strong>{summaryData?.meta?.as_of ? new Date(summaryData.meta.as_of).toLocaleString() : '—'}</strong> ({summaryData?.meta?.timezone || 'UTC'})</span>
            <span style={{ marginInline: 'var(--sp-2)' }}>·</span>
            <span>Source: <Badge tone="ok" dot={false}>Persisted Database Records</Badge> (SQLAlchemy / Alembic Head)</span>
            <span style={{ marginInline: 'var(--sp-2)' }}>·</span>
            <span>Date Basis: <strong>{dateBasis === 'received' ? 'Server Received' : 'Clinical Event Time'}</strong></span>
          </p>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            <Button variant="secondary" size="sm" onClick={loadData} disabled={loading}>
              {loading ? 'Refreshing...' : '↻ Refresh Data'}
            </Button>
            <Button
              size="sm"
              onClick={() => handleExport('tests')}
              disabled={exporting}
              title="Export filtered records to formula-injection-safe CSV"
            >
              {exporting ? 'Exporting...' : '📥 Export Tests (CSV)'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('cases')}
              disabled={exporting}
              title="Export filtered case records to CSV"
            >
              📥 Export Cases
            </Button>
          </div>
          {exportError && <p className="m3-error" role="alert">⚠ {exportError}</p>}
        </div>
      </header>

      {/* Unified Surveillance Filter Bar (Section 7.1) */}
      <section className="m3-card" style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Surveillance Filters</span>
          {(period !== 'all' || district || method || resultStatus || species || caseStatus || dateFrom || dateTo) && (
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              Reset All Filters
            </Button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--sp-3)' }}>
          <div className="m3-field">
            <label className="m3-label">Reporting Period</label>
            <select className="m3-select" value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
              <option value="all">All Available Records</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
          <div className="m3-field">
            <label className="m3-label">Date From (UTC)</label>
            <input
              type="date"
              className="m3-input"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPeriod('custom')
              }}
            />
          </div>
          <div className="m3-field">
            <label className="m3-label">Date To (UTC)</label>
            <input
              type="date"
              className="m3-input"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPeriod('custom')
              }}
            />
          </div>
          <div className="m3-field">
            <label className="m3-label">Date Basis</label>
            <select
              className="m3-select"
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as any)}
            >
              <option value="received">Server Received (created_at)</option>
              <option value="event">Clinical Event (performed_at / reported_at)</option>
            </select>
          </div>
          <div className="m3-field">
            <label className="m3-label">District</label>
            <select className="m3-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">All Districts</option>
              <option value="North Goa">North Goa</option>
              <option value="South Goa">South Goa</option>
            </select>
          </div>
          <div className="m3-field">
            <label className="m3-label">Diagnostic Method</label>
            <select className="m3-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">All Methods</option>
              <option value="rdt">Rapid Diagnostic Test (RDT)</option>
              <option value="microscopy">Laboratory Microscopy</option>
              <option value="other">Other / Molecular</option>
            </select>
          </div>
          <div className="m3-field">
            <label className="m3-label">Result Status</label>
            <select className="m3-select" value={resultStatus} onChange={(e) => setResultStatus(e.target.value)}>
              <option value="">All Outcomes</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="pending">Pending Lab Evaluation</option>
              <option value="indeterminate">Indeterminate</option>
            </select>
          </div>
          <div className="m3-field">
            <label className="m3-label">Parasite Species</label>
            <select className="m3-select" value={species} onChange={(e) => setSpecies(e.target.value)}>
              <option value="">All Species</option>
              <option value="pv">Plasmodium vivax (Pv)</option>
              <option value="pf">Plasmodium falciparum (Pf)</option>
              <option value="mixed">Mixed (Pf + Pv)</option>
              <option value="other">Other / Undetermined</option>
            </select>
          </div>
        </div>
      </section>

      {/* Sub-tab Navigation */}
      <Tabs
        value={subTab}
        onChange={(id) => setSubTab(id as typeof subTab)}
        tabs={[
          { id: 'overview', label: '📊 Executive Summary' },
          { id: 'diagnostic', label: '🔬 Diagnostic & Positivity Rates' },
          { id: 'lifecycle', label: '🏥 Case Lifecycle & Durations' },
          {
            id: 'quality',
            label: '🛡️ Data Quality & Completeness',
            badge: dqData?.summary?.checks_with_findings > 0 ? dqData.summary.checks_with_findings : undefined,
          },
          { id: 'records', label: '📋 Traceability & Provenance Drill-down' },
        ]}
      />

      {/* Error / Loading State */}
      {error && (
        <div className="m3-banner tone-danger" role="alert">
          <div>
            <p style={{ fontWeight: 700 }}>Error loading analytics</p>
            <p style={{ marginTop: 2 }}>{error}</p>
          </div>
          <div className="banner-action">
            <Button variant="secondary" size="sm" onClick={loadData}>Retry</Button>
          </div>
        </div>
      )}

      {loading && !summaryData && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 'var(--sp-3) 0' }}>
          <div className="m3-spinner m3-spinner-dark" aria-hidden="true" />
          <p>Querying operational tables and calculating aggregates...</p>
        </div>
      )}

      {/* TAB 1: EXECUTIVE SUMMARY */}
      {subTab === 'overview' && summaryData && (
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          {/* Section 7.2 Executive Summary Cards */}
          <div className="metric-grid">
            <div className="metric">
              <div className="metric-label" title="Unique worker profiles enrolled in patients table">
                Total Registered Workers
              </div>
              <div className="metric-value">{workers?.registered ?? '—'}</div>
              <div className="metric-hint">
                Active on Site: <strong>{workers?.with_active_site_assignment ?? 0}</strong>
              </div>
            </div>

            <div className="metric">
              <div className="metric-label" title="Active health episodes tracked through case state machine">
                Malaria Surveillance Cases
              </div>
              <div className="metric-value">{cases?.total ?? '—'}</div>
              <div className="metric-hint">
                Urgent: <Badge tone="danger" dot={false}>{cases?.urgent ?? 0}</Badge> · Standard: {((cases?.total ?? 0) - (cases?.urgent ?? 0))}
              </div>
            </div>

            <div className="metric">
              <div className="metric-label" title="All RDT and microscopy examinations in diagnostic_tests">
                Total Diagnostic Tests
              </div>
              <div className="metric-value">{tests?.total ?? '—'}</div>
              <div className="metric-hint">
                Linked to Case: <strong>{tests?.linkage?.linked_to_case ?? 0}</strong> · Unlinked: {tests?.linkage?.not_linked ?? 0}
              </div>
            </div>

            <div className="metric">
              <div className="metric-label" title="positive / (positive + negative) * 100. Pending and indeterminate excluded from denominator.">
                Test Positivity Rate
              </div>
              <div className="metric-value">
                {pr?.rate !== null && pr?.rate !== undefined ? `${(pr.rate * 100).toFixed(1)}%` : '0.0%'}
              </div>
              <div className="metric-hint">
                {pr?.numerator ?? 0} pos / {pr?.denominator ?? 0} completed tests
              </div>
            </div>

            <div className="metric tone-danger">
              <div className="metric-label" title="Confirmed positive results (RDT or Microscopy)">
                Positive Tests
              </div>
              <div className="metric-value">{tests?.by_result?.positive ?? 0}</div>
              <div className="metric-hint">
                Pv: {tests?.positive_by_species?.pv ?? 0} · Pf: {tests?.positive_by_species?.pf ?? 0} · Mixed: {tests?.positive_by_species?.mixed ?? 0}
              </div>
            </div>

            <div className="metric tone-ok">
              <div className="metric-label" title="Tests with confirmed negative parasite status">
                Negative Tests
              </div>
              <div className="metric-value">{tests?.by_result?.negative ?? 0}</div>
              <div className="metric-hint">
                Pending: <strong>{tests?.by_result?.pending ?? 0}</strong>
              </div>
            </div>

            <div className="metric tone-warn">
              <div className="metric-label" title="Scheduled protocol visits past due_at timestamp where status remains 'due'">
                Follow-ups Overdue
              </div>
              <div className="metric-value">{followups?.overdue ?? 0}</div>
              <div className="metric-hint">
                Total Due: {followups?.by_status?.due ?? 0} · Completed: {followups?.by_status?.completed ?? 0}
              </div>
            </div>

            <div className="metric">
              <div className="metric-label" title="Worker-initiated unwell reports submitted via mobile client">
                Symptom Reports
              </div>
              <div className="metric-value">{reports?.total ?? '—'}</div>
              <div className="metric-hint">
                Distinct Workers: <strong>{reports?.distinct_people ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Units of Analysis & Provenance Gaps Notice (Section 7.2) */}
          <Card title="Surveillance Lineage & Epistemological Basis">
            <p style={{ color: 'var(--text-2)', maxWidth: '90ch' }}>
              Under the Goa Comprehensive Malaria Elimination Surveillance Protocol, units of analysis are tracked distinctly: <strong>Tests</strong> (rows in diagnostic_tests), <strong>Cases</strong> (health episodes in cases), and <strong>People</strong> (distinct patients). A positive test is never presented as a unique malaria case because patients undergo follow-up confirmatory microscopy.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
              <Badge tone="accent" dot={false}>Provenance Gaps Explicitly Logged:</Badge>
              <Badge tone="neutral" dot={false}>Client capture time not stored</Badge>
              <Badge tone="neutral" dot={false}>Source channel not stored</Badge>
              <Badge tone="neutral" dot={false}>Sync state not stored server-side</Badge>
              <Badge tone="neutral" dot={false}>performed_at assigned at result recording</Badge>
            </div>
          </Card>

          {/* Durations Summary Card */}
          <Card title="Clinical Lifecycle Durations (Observed Persisted Timestamps)">
            <div className="metric-grid" style={{ marginTop: 'var(--sp-2)' }}>
              <div className="metric">
                <div className="metric-label">Submission to Clinician Acknowledgment</div>
                <div className="metric-value">
                  {cases?.durations?.submission_to_acknowledgement?.available
                    ? `${(cases.durations.submission_to_acknowledgement.avg_seconds / 3600).toFixed(1)} hrs`
                    : 'N/A (Pending)'}
                </div>
                <div className="metric-hint">
                  Sample size: {cases?.durations?.submission_to_acknowledgement?.n ?? 0} cases
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">Submission to First Diagnostic Result</div>
                <div className="metric-value">
                  {cases?.durations?.submission_to_first_completed_result?.available
                    ? `${(cases.durations.submission_to_first_completed_result.avg_seconds / 3600).toFixed(1)} hrs`
                    : 'N/A (Pending)'}
                </div>
                <div className="metric-hint">
                  Sample size: {cases?.durations?.submission_to_first_completed_result?.n ?? 0} cases
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">Submission to Case Closure</div>
                <div className="metric-value">
                  {cases?.durations?.submission_to_closure?.available
                    ? `${(cases.durations.submission_to_closure.avg_seconds / 86400).toFixed(1)} days`
                    : 'In Progress'}
                </div>
                <div className="metric-hint">
                  Sample size: {cases?.durations?.submission_to_closure?.n ?? 0} cases
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: DIAGNOSTIC TESTING & POSITIVITY */}
      {subTab === 'diagnostic' && (
        <div style={{ display: 'grid', gap: 'var(--sp-4)', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {/* Tests by Method */}
          <Card title="Tests by Diagnostic Modality" subtitle="Breakdown of active surveillance tests by laboratory method.">
            <div className="chart-bar-list">
              {breakdownMethod?.groups?.map((g: any) => {
                const pct = breakdownMethod.groups[0]?.total > 0 ? (g.total / breakdownMethod.groups[0].total) * 100 : 0
                return (
                  <div key={g.key} className="chart-bar-item">
                    <div className="chart-bar-labels">
                      <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{g.key?.toUpperCase() || 'UNKNOWN'}</span>
                      <span style={{ fontSize: 'var(--fs-sm)' }}><strong>{g.total}</strong> tests ({g.positive} pos, {g.negative} neg)</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill fill-primary" style={{ width: `${Math.min(100, Math.max(5, pct))}%` }} />
                    </div>
                    <div className="m3-hint" style={{ marginTop: 'var(--sp-1)' }}>
                      Positivity Rate: <strong>{g.positive_rate?.rate !== null ? `${(g.positive_rate.rate * 100).toFixed(1)}%` : '—'}</strong>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Species Breakdown */}
          <Card title="Species Identification (Positive Results)" subtitle="Parasite speciation confirmed via RDT or Giemsa microscopy.">
            <div className="chart-bar-list">
              {Object.entries(tests?.positive_by_species || {}).map(([sp, count]: [string, any]) => {
                const totalPos = tests?.by_result?.positive || 1
                const pct = Math.round((count / totalPos) * 100)
                return (
                  <div key={sp} className="chart-bar-item">
                    <div className="chart-bar-labels">
                      <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                        {sp === 'pv' ? 'Plasmodium vivax (Pv)' : sp === 'pf' ? 'Plasmodium falciparum (Pf)' : sp === 'mixed' ? 'Mixed (Pf + Pv)' : sp}
                      </span>
                      <span style={{ fontSize: 'var(--fs-sm)' }}><strong>{count}</strong> ({pct}%)</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill fill-danger" style={{ width: `${Math.max(5, pct)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Positivity by Site & District Table */}
      {subTab === 'diagnostic' && (
        <Card title="Site-Level Surveillance & Positivity Rates" subtitle="Descriptive positive rates by construction site. Small denominators (<5) are explicitly flagged as unstable.">
          <div className="m3-table-wrap" tabIndex={0} role="region" aria-label="Site-level test breakdown">
            <table className="m3-table">
              <thead>
                <tr>
                  <th>Site Code</th>
                  <th>Site Name</th>
                  <th>Total Tests</th>
                  <th>Positive</th>
                  <th>Negative</th>
                  <th>Positivity Rate</th>
                  <th>Reliability</th>
                </tr>
              </thead>
              <tbody>
                {breakdownSite?.groups?.map((s: any) => (
                  <tr key={s.key || 'unassigned'}>
                    <td><span className="m3-cell-main">{s.key || '—'}</span></td>
                    <td>{s.label || 'Unassigned Field Location'}</td>
                    <td className="m3-cell-num">{s.total}</td>
                    <td><Badge tone="danger" dot={false}>{s.positive}</Badge></td>
                    <td><Badge tone="ok" dot={false}>{s.negative}</Badge></td>
                    <td>
                      <strong>{s.positive_rate?.rate !== null ? `${(s.positive_rate.rate * 100).toFixed(1)}%` : '—'}</strong>
                    </td>
                    <td>
                      {s.total >= 5 ? (
                        <Badge tone="ok">Adequate Sample</Badge>
                      ) : (
                        <Badge tone="warn">Small Denominator</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {(!breakdownSite?.groups || breakdownSite.groups.length === 0) && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-2)', padding: 'var(--sp-4) 0' }}>
                      No site-level test records matched filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: CASE LIFECYCLE */}
      {subTab === 'lifecycle' && (
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <Card title="Case Distribution Across Lifecycle States (Section 7.4)" subtitle="Active surveillance cases strictly mapped across the 10 state machine stages.">
            <div className="metric-grid" style={{ marginTop: 'var(--sp-2)' }}>
              {Object.entries(cases?.by_status || {}).map(([st, count]: [string, any]) => (
                <div key={st} className="metric">
                  <div className="metric-label">{st.replace(/_/g, ' ').toUpperCase()}</div>
                  <div className="metric-value">{count}</div>
                  <div className="metric-hint">
                    {cases?.total ? `${Math.round((count / cases.total) * 100)}% of total` : '0%'}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Clinical Durations & Triage Latency">
            <div className="metric-grid" style={{ marginTop: 'var(--sp-2)' }}>
              <div className="metric">
                <div className="metric-label">Submission to Triage / Acknowledgment</div>
                <div className="metric-value">
                  {cases?.durations?.submission_to_acknowledgement?.available
                    ? `${(cases.durations.submission_to_acknowledgement.avg_seconds / 3600).toFixed(1)} hours`
                    : 'N/A'}
                </div>
                <div className="metric-hint">
                  Min: {cases?.durations?.submission_to_acknowledgement?.min_seconds ? `${(cases.durations.submission_to_acknowledgement.min_seconds / 60).toFixed(0)}m` : '—'} · Max: {cases?.durations?.submission_to_acknowledgement?.max_seconds ? `${(cases.durations.submission_to_acknowledgement.max_seconds / 3600).toFixed(1)}h` : '—'}
                </div>
              </div>

              <div className="metric">
                <div className="metric-label">Submission to First Diagnostic Result</div>
                <div className="metric-value">
                  {cases?.durations?.submission_to_first_completed_result?.available
                    ? `${(cases.durations.submission_to_first_completed_result.avg_seconds / 3600).toFixed(1)} hours`
                    : 'N/A'}
                </div>
                <div className="metric-hint">
                  Min: {cases?.durations?.submission_to_first_completed_result?.min_seconds ? `${(cases.durations.submission_to_first_completed_result.min_seconds / 60).toFixed(0)}m` : '—'}
                </div>
              </div>

              <div className="metric">
                <div className="metric-label">Submission to Case Resolution / Closure</div>
                <div className="metric-value">
                  {cases?.durations?.submission_to_closure?.available
                    ? `${(cases.durations.submission_to_closure.avg_seconds / 86400).toFixed(1)} days`
                    : 'In Progress'}
                </div>
                <div className="metric-hint">
                  Evaluated across {cases?.durations?.submission_to_closure?.n ?? 0} closed episodes
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: DATA QUALITY & COMPLETENESS */}
      {subTab === 'quality' && (
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <Card
            title="Data Completeness & Surveillance Integrity Rules (Section 7.5)"
            subtitle="12 automated integrity rules checking required fields, orphan linkages, and non-standard states."
            actions={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                <Badge tone="neutral">Rules Checked: {dqData?.summary?.checks_run ?? 12}</Badge>
                <Badge tone="warn">With Findings: {dqData?.summary?.checks_with_findings ?? 0}</Badge>
                <Badge tone="danger">High Severity: {dqData?.summary?.high_severity_findings ?? 0}</Badge>
              </div>
            }
          >
            <div className="m3-table-wrap" tabIndex={0} role="region" aria-label="Data quality checks">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Rule Key</th>
                    <th>Integrity Check Description</th>
                    <th>Severity</th>
                    <th>Table</th>
                    <th>Affected / Total</th>
                    <th>Pct</th>
                    <th>Recommended Remediation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dqData?.checks?.map((chk: any) => (
                    <tr key={chk.key}>
                      <td><code>{chk.key}</code></td>
                      <td>
                        <span className="m3-cell-main">{chk.name}</span>
                        <span className="m3-cell-sub">{chk.definition}</span>
                      </td>
                      <td>
                        <Badge tone={chk.severity === 'high' ? 'danger' : chk.severity === 'medium' ? 'warn' : 'neutral'}>
                          {chk.severity?.toUpperCase()}
                        </Badge>
                      </td>
                      <td><code>{chk.table}</code></td>
                      <td>
                        <Badge tone={chk.affected > 0 ? 'danger' : 'ok'} dot={false}>{chk.affected}</Badge> / {chk.total}
                      </td>
                      <td className="m3-cell-num">{chk.pct_affected !== null ? `${chk.pct_affected}%` : '0%'}</td>
                      <td className="m3-hint">{chk.remediation}</td>
                      <td>
                        {chk.affected > 0 ? (
                          <Button variant="secondary" size="sm" onClick={() => inspectDqCheck(chk)}>
                            Drill Down →
                          </Button>
                        ) : (
                          <span className="badge tone-ok no-dot">✓ Pass</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Drill-down Drawer for Data Quality Check */}
          {activeDqCheck && (
            <Modal
              open
              wide
              title={`Data Quality Drill-down: ${activeDqCheck.name}`}
              onClose={() => setActiveDqCheck(null)}
            >
              <p className="m3-hint">
                Rule <code>{activeDqCheck.key}</code> · {activeDqCheck.affected} affected records in <code>{activeDqCheck.table}</code>
              </p>
              <div className="m3-banner tone-info" style={{ marginTop: 'var(--sp-3)' }}>
                <span>
                  <strong>Remediation:</strong> {activeDqCheck.remediation} ({activeDqCheck.safe_to_remediate_automatically ? 'Safe for automated script' : 'Requires human clinical/supervisor review'})
                </span>
              </div>
              {dqRecordsLoading ? (
                <div className="m3-spinner m3-spinner-dark" style={{ margin: 'var(--sp-4) auto', display: 'block' }} aria-hidden="true" />
              ) : (
                <div className="m3-table-wrap" style={{ marginTop: 'var(--sp-3)' }} tabIndex={0} role="region" aria-label="Affected records">
                  <table className="m3-table">
                    <thead>
                      <tr>
                        <th>Record Type</th>
                        <th>Identifiers</th>
                        <th>Status / Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dqRecords.map((r: any, idx: number) => (
                        <tr key={idx}>
                          <td><Badge tone="neutral" dot={false}>{r.record_type}</Badge></td>
                          <td>
                            {r.sample_code && <span className="m3-cell-main">Sample: {r.sample_code}</span>}
                            {r.test_id && <span className="m3-cell-sub">Test ID: <code>{r.test_id}</code></span>}
                            {r.case_code && <span className="m3-cell-sub">Case: {r.case_code}</span>}
                            {r.worker_ref && <span className="m3-cell-sub">Worker Ref: <code>{r.worker_ref}</code></span>}
                          </td>
                          <td>
                            {r.status ? <StatusBadge status={r.status} /> : <span className="m3-hint">Flagged for integrity review</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Modal>
          )}
        </div>
      )}

      {/* TAB 5: TRACEABILITY & PROVENANCE DRILL-DOWN */}
      {subTab === 'records' && (
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <Card
            title="Test-Level Provenance & Traceability Records (Section 7.6)"
            subtitle="Individual records showing modality, timestamps, linkage status, and pseudonymized patient reference."
            actions={
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={recordsOffset <= 0}
                  onClick={() => setRecordsOffset(Math.max(0, recordsOffset - 25))}
                >
                  ← Previous 25
                </Button>
                <span className="m3-hint" style={{ marginInline: 'var(--sp-1)' }}>
                  Showing {recordsOffset + 1} - {Math.min((testsData?.total || 0), recordsOffset + 25)} of {testsData?.total || 0}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={recordsOffset + 25 >= (testsData?.total || 0)}
                  onClick={() => setRecordsOffset(recordsOffset + 25)}
                >
                  Next 25 →
                </Button>
              </div>
            }
          >
            <div className="m3-table-wrap" tabIndex={0} role="region" aria-label="Test-level provenance records">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th>Test ID</th>
                    <th>Sample</th>
                    <th>Case Code</th>
                    <th>Worker Pseudonym</th>
                    <th>Facility / Site</th>
                    <th>Method</th>
                    <th>Result</th>
                    <th>Species</th>
                    <th>Received Timestamp</th>
                    <th>Linkage</th>
                    <th>Quality Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {testsData?.items?.map((t: any) => (
                    <tr key={t.test_id}>
                      <td><code>{t.test_id?.slice(0, 8)}...</code></td>
                      <td><span className="m3-cell-main">{t.sample_code}</span></td>
                      <td>{t.case_code || '—'}</td>
                      <td><code>{t.worker_ref}</code></td>
                      <td>
                        <span className="m3-cell-main">{t.facility?.name || t.site?.name || '—'}</span>
                        <span className="m3-cell-sub">{t.district || 'Goa'}</span>
                      </td>
                      <td><Badge tone="neutral" dot={false}>{t.method}</Badge></td>
                      <td>
                        <Badge tone={t.result_status === 'positive' ? 'danger' : t.result_status === 'negative' ? 'ok' : 'warn'}>
                          {t.result_status?.toUpperCase()}
                        </Badge>
                      </td>
                      <td>{t.species?.toUpperCase() || '—'}</td>
                      <td className="m3-hint">{t.server_received_at ? new Date(t.server_received_at).toLocaleString() : '—'}</td>
                      <td>
                        <Badge tone={t.linkage_status === 'linked' ? 'ok' : 'warn'}>{t.linkage_status}</Badge>
                      </td>
                      <td>
                        {t.data_quality_flags?.length > 0 ? (
                          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                            {t.data_quality_flags.map((fl: string) => (
                              <Badge key={fl} tone="danger" dot={false}>{fl}</Badge>
                            ))}
                          </span>
                        ) : (
                          <Badge tone="ok" dot={false}>Clean</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!testsData?.items || testsData.items.length === 0) && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-2)', padding: 'var(--sp-4) 0' }}>
                        No records found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
