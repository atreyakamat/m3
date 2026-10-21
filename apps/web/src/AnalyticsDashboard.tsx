import React, { useState, useEffect } from 'react'
import { api, baseUrl } from './api'

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
      alert(`Export error: ${err.message}`)
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
    <div className="analytics-container">
      {/* Analytics Header & Title */}
      <div className="analytics-header">
        <div>
          <div className="eyebrow">Localhost Surveillance Intelligence</div>
          <h2 className="analytics-title">Goa Malaria Surveillance & Epidemiological Analytics</h2>
          <div className="analytics-meta text-xs text-secondary mt-1">
            <span>As of: <strong>{summaryData?.meta?.as_of ? new Date(summaryData.meta.as_of).toLocaleString() : '—'}</strong> ({summaryData?.meta?.timezone || 'UTC'})</span>
            <span className="ml-2">·</span>
            <span className="ml-2">Source: <strong className="text-success">Persisted Database Records</strong> (SQLAlchemy / Alembic Head)</span>
            <span className="ml-2">·</span>
            <span className="ml-2">Date Basis: <strong>{dateBasis === 'received' ? 'Server Received' : 'Clinical Event Time'}</strong></span>
          </div>
        </div>
        <div className="analytics-actions">
          <button className="btn-outline btn-sm" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh Data'}
          </button>
          <button
            className="btn-primary btn-sm ml-2"
            onClick={() => handleExport('tests')}
            disabled={exporting}
            title="Export filtered records to formula-injection-safe CSV"
          >
            {exporting ? 'Exporting...' : '📥 Export Tests (CSV)'}
          </button>
          <button
            className="btn-secondary btn-sm ml-2"
            onClick={() => handleExport('cases')}
            disabled={exporting}
            title="Export filtered case records to CSV"
          >
            📥 Export Cases
          </button>
        </div>
      </div>

      {/* Unified Surveillance Filter Bar (Section 7.1) */}
      <div className="analytics-filter-card">
        <div className="filter-card-header">
          <span className="font-semibold text-sm">Surveillance Filters</span>
          {(period !== 'all' || district || method || resultStatus || species || caseStatus || dateFrom || dateTo) && (
            <button className="btn-outline btn-xs" onClick={resetFilters}>
              Reset All Filters
            </button>
          )}
        </div>
        <div className="filter-grid">
          <div>
            <label className="filter-label">Reporting Period</label>
            <select className="filter-select" value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
              <option value="all">All Available Records</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
          <div>
            <label className="filter-label">Date From (UTC)</label>
            <input
              type="date"
              className="filter-select"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPeriod('custom')
              }}
            />
          </div>
          <div>
            <label className="filter-label">Date To (UTC)</label>
            <input
              type="date"
              className="filter-select"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPeriod('custom')
              }}
            />
          </div>
          <div>
            <label className="filter-label">Date Basis</label>
            <select
              className="filter-select"
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as any)}
            >
              <option value="received">Server Received (created_at)</option>
              <option value="event">Clinical Event (performed_at / reported_at)</option>
            </select>
          </div>
          <div>
            <label className="filter-label">District</label>
            <select className="filter-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">All Districts</option>
              <option value="North Goa">North Goa</option>
              <option value="South Goa">South Goa</option>
            </select>
          </div>
          <div>
            <label className="filter-label">Diagnostic Method</label>
            <select className="filter-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">All Methods</option>
              <option value="rdt">Rapid Diagnostic Test (RDT)</option>
              <option value="microscopy">Laboratory Microscopy</option>
              <option value="other">Other / Molecular</option>
            </select>
          </div>
          <div>
            <label className="filter-label">Result Status</label>
            <select className="filter-select" value={resultStatus} onChange={(e) => setResultStatus(e.target.value)}>
              <option value="">All Outcomes</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="pending">Pending Lab Evaluation</option>
              <option value="indeterminate">Indeterminate</option>
            </select>
          </div>
          <div>
            <label className="filter-label">Parasite Species</label>
            <select className="filter-select" value={species} onChange={(e) => setSpecies(e.target.value)}>
              <option value="">All Species</option>
              <option value="pv">Plasmodium vivax (Pv)</option>
              <option value="pf">Plasmodium falciparum (Pf)</option>
              <option value="mixed">Mixed (Pf + Pv)</option>
              <option value="other">Other / Undetermined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="analytics-tabs-bar">
        <button
          className={`analytics-tab-btn ${subTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSubTab('overview')}
        >
          📊 Executive Summary
        </button>
        <button
          className={`analytics-tab-btn ${subTab === 'diagnostic' ? 'active' : ''}`}
          onClick={() => setSubTab('diagnostic')}
        >
          🔬 Diagnostic & Positivity Rates
        </button>
        <button
          className={`analytics-tab-btn ${subTab === 'lifecycle' ? 'active' : ''}`}
          onClick={() => setSubTab('lifecycle')}
        >
          🏥 Case Lifecycle & Durations
        </button>
        <button
          className={`analytics-tab-btn ${subTab === 'quality' ? 'active' : ''}`}
          onClick={() => setSubTab('quality')}
        >
          🛡️ Data Quality & Completeness
          {dqData?.summary?.checks_with_findings > 0 && (
            <span className="tab-pill-badge">{dqData.summary.checks_with_findings}</span>
          )}
        </button>
        <button
          className={`analytics-tab-btn ${subTab === 'records' ? 'active' : ''}`}
          onClick={() => setSubTab('records')}
        >
          📋 Traceability & Provenance Drill-down
        </button>
      </div>

      {/* Error / Loading State */}
      {error && (
        <div className="state-card error-card my-3">
          <h3>Error loading analytics</h3>
          <p>{error}</p>
          <button className="btn-primary btn-sm mt-2" onClick={loadData}>Retry</button>
        </div>
      )}

      {loading && !summaryData && (
        <div className="state-card loading-card my-3">
          <div className="spinner" />
          <p>Querying operational tables and calculating aggregates...</p>
        </div>
      )}

      {/* TAB 1: EXECUTIVE SUMMARY */}
      {subTab === 'overview' && summaryData && (
        <div className="analytics-content-view">
          {/* Section 7.2 Executive Summary Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Total Registered Workers</span>
                <span className="info-icon" title="Unique worker profiles enrolled in patients table">ⓘ</span>
              </div>
              <div className="metric-val">{workers?.registered ?? '—'}</div>
              <div className="metric-meta text-xs text-secondary mt-1">
                Active on Site: <strong>{workers?.with_active_site_assignment ?? 0}</strong>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Malaria Surveillance Cases</span>
                <span className="info-icon" title="Active health episodes tracked through case state machine">ⓘ</span>
              </div>
              <div className="metric-val">{cases?.total ?? '—'}</div>
              <div className="metric-meta text-xs text-secondary mt-1">
                Urgent: <strong className="text-danger">{cases?.urgent ?? 0}</strong> · Standard: {((cases?.total ?? 0) - (cases?.urgent ?? 0))}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Total Diagnostic Tests</span>
                <span className="info-icon" title="All RDT and microscopy examinations in diagnostic_tests">ⓘ</span>
              </div>
              <div className="metric-val">{tests?.total ?? '—'}</div>
              <div className="metric-meta text-xs text-secondary mt-1">
                Linked to Case: <strong>{tests?.linkage?.linked_to_case ?? 0}</strong> · Unlinked: {tests?.linkage?.not_linked ?? 0}
              </div>
            </div>

            <div className="metric-card highlight-card">
              <div className="metric-header">
                <span className="metric-label">Test Positivity Rate</span>
                <span className="info-icon" title="positive / (positive + negative) * 100. Pending and indeterminate excluded from denominator.">ⓘ</span>
              </div>
              <div className="metric-val text-primary">
                {pr?.rate !== null && pr?.rate !== undefined ? `${(pr.rate * 100).toFixed(1)}%` : '0.0%'}
              </div>
              <div className="metric-meta text-xs text-secondary mt-1">
                {pr?.numerator ?? 0} pos / {pr?.denominator ?? 0} completed tests
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Positive Tests</span>
                <span className="info-icon" title="Confirmed positive results (RDT or Microscopy)">ⓘ</span>
              </div>
              <div className="metric-val text-danger">{tests?.by_result?.positive ?? 0}</div>
              <div className="metric-meta text-xs text-secondary mt-1">
                Pv: {tests?.positive_by_species?.pv ?? 0} · Pf: {tests?.positive_by_species?.pf ?? 0} · Mixed: {tests?.positive_by_species?.mixed ?? 0}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Negative Tests</span>
                <span className="info-icon" title="Tests with confirmed negative parasite status">ⓘ</span>
              </div>
              <div className="metric-val text-success">{tests?.by_result?.negative ?? 0}</div>
              <div className="metric-meta text-xs text-secondary mt-1">
                Pending: <strong>{tests?.by_result?.pending ?? 0}</strong>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Follow-ups Overdue</span>
                <span className="info-icon" title="Scheduled protocol visits past due_at timestamp where status remains 'due'">ⓘ</span>
              </div>
              <div className="metric-val text-warning">{followups?.overdue ?? 0}</div>
              <div className="metric-meta text-xs text-secondary mt-1">
                Total Due: {followups?.by_status?.due ?? 0} · Completed: {followups?.by_status?.completed ?? 0}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Symptom Reports</span>
                <span className="info-icon" title="Worker-initiated unwell reports submitted via mobile client">ⓘ</span>
              </div>
              <div className="metric-val">{reports?.total ?? '—'}</div>
              <div className="metric-meta text-xs text-secondary mt-1">
                Distinct Workers: <strong>{reports?.distinct_people ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Units of Analysis & Provenance Gaps Notice (Section 7.2) */}
          <div className="analytics-card mt-4">
            <h3 className="section-title">Surveillance Lineage & Epistemological Basis</h3>
            <p className="notice-muted mt-2">
              Under the Goa Comprehensive Malaria Elimination Surveillance Protocol, units of analysis are tracked distinctly: <strong>Tests</strong> (rows in diagnostic_tests), <strong>Cases</strong> (health episodes in cases), and <strong>People</strong> (distinct patients). A positive test is never presented as a unique malaria case because patients undergo follow-up confirmatory microscopy.
            </p>
            <div className="gap-badges-row mt-3">
              <span className="badge-ro">Provenance Gaps Explicitly Logged:</span>
              <span className="badge-neutral ml-2">Client capture time not stored</span>
              <span className="badge-neutral ml-2">Source channel not stored</span>
              <span className="badge-neutral ml-2">Sync state not stored server-side</span>
              <span className="badge-neutral ml-2">performed_at assigned at result recording</span>
            </div>
          </div>

          {/* Durations Summary Card */}
          <div className="analytics-card mt-4">
            <h3 className="section-title">Clinical Lifecycle Durations (Observed Persisted Timestamps)</h3>
            <div className="durations-grid mt-3">
              <div className="duration-item">
                <div className="duration-label">Submission to Clinician Acknowledgment</div>
                <div className="duration-val">
                  {cases?.durations?.submission_to_acknowledgement?.available
                    ? `${(cases.durations.submission_to_acknowledgement.avg_seconds / 3600).toFixed(1)} hrs`
                    : 'N/A (Pending)'}
                </div>
                <div className="duration-meta text-xs text-secondary">
                  Sample size: {cases?.durations?.submission_to_acknowledgement?.n ?? 0} cases
                </div>
              </div>
              <div className="duration-item">
                <div className="duration-label">Submission to First Diagnostic Result</div>
                <div className="duration-val">
                  {cases?.durations?.submission_to_first_completed_result?.available
                    ? `${(cases.durations.submission_to_first_completed_result.avg_seconds / 3600).toFixed(1)} hrs`
                    : 'N/A (Pending)'}
                </div>
                <div className="duration-meta text-xs text-secondary">
                  Sample size: {cases?.durations?.submission_to_first_completed_result?.n ?? 0} cases
                </div>
              </div>
              <div className="duration-item">
                <div className="duration-label">Submission to Case Closure</div>
                <div className="duration-val">
                  {cases?.durations?.submission_to_closure?.available
                    ? `${(cases.durations.submission_to_closure.avg_seconds / 86400).toFixed(1)} days`
                    : 'In Progress'}
                </div>
                <div className="duration-meta text-xs text-secondary">
                  Sample size: {cases?.durations?.submission_to_closure?.n ?? 0} cases
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIAGNOSTIC TESTING & POSITIVITY */}
      {subTab === 'diagnostic' && (
        <div className="analytics-content-view">
          <div className="two-column-grid">
            {/* Tests by Method */}
            <div className="analytics-card">
              <h3 className="section-title">Tests by Diagnostic Modality</h3>
              <p className="text-xs text-secondary mt-1">Breakdown of active surveillance tests by laboratory method.</p>
              <div className="chart-bar-list mt-3">
                {breakdownMethod?.groups?.map((g: any) => {
                  const pct = breakdownMethod.groups[0]?.total > 0 ? (g.total / breakdownMethod.groups[0].total) * 100 : 0
                  return (
                    <div key={g.key} className="chart-bar-item">
                      <div className="chart-bar-labels">
                        <span className="font-semibold text-sm">{g.key?.toUpperCase() || 'UNKNOWN'}</span>
                        <span className="text-sm"><strong>{g.total}</strong> tests ({g.positive} pos, {g.negative} neg)</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill fill-primary" style={{ width: `${Math.min(100, Math.max(5, pct))}%` }} />
                      </div>
                      <div className="text-xs text-secondary mt-1">
                        Positivity Rate: <strong>{g.positive_rate?.rate !== null ? `${(g.positive_rate.rate * 100).toFixed(1)}%` : '—'}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Species Breakdown */}
            <div className="analytics-card">
              <h3 className="section-title">Species Identification (Positive Results)</h3>
              <p className="text-xs text-secondary mt-1">Parasite speciation confirmed via RDT or Giemsa microscopy.</p>
              <div className="chart-bar-list mt-3">
                {Object.entries(tests?.positive_by_species || {}).map(([sp, count]: [string, any]) => {
                  const totalPos = tests?.by_result?.positive || 1
                  const pct = Math.round((count / totalPos) * 100)
                  return (
                    <div key={sp} className="chart-bar-item">
                      <div className="chart-bar-labels">
                        <span className="font-semibold text-sm">
                          {sp === 'pv' ? 'Plasmodium vivax (Pv)' : sp === 'pf' ? 'Plasmodium falciparum (Pf)' : sp === 'mixed' ? 'Mixed (Pf + Pv)' : sp}
                        </span>
                        <span className="text-sm"><strong>{count}</strong> ({pct}%)</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill fill-danger" style={{ width: `${Math.max(5, pct)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Positivity by Site & District Table */}
          <div className="analytics-card mt-4">
            <h3 className="section-title">Site-Level Surveillance & Positivity Rates</h3>
            <p className="text-xs text-secondary mt-1">
              Descriptive positive rates by construction site. Small denominators (&lt;5) are explicitly flagged as unstable.
            </p>
            <div className="table-responsive mt-3">
              <table className="data-table">
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
                      <td><strong>{s.key || '—'}</strong></td>
                      <td>{s.label || 'Unassigned Field Location'}</td>
                      <td>{s.total}</td>
                      <td className="text-danger font-semibold">{s.positive}</td>
                      <td className="text-success">{s.negative}</td>
                      <td>
                        <strong>{s.positive_rate?.rate !== null ? `${(s.positive_rate.rate * 100).toFixed(1)}%` : '—'}</strong>
                      </td>
                      <td>
                        {s.total >= 5 ? (
                          <span className="status-badge badge-success">Adequate Sample</span>
                        ) : (
                          <span className="status-badge badge-warning">Small Denominator</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!breakdownSite?.groups || breakdownSite.groups.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-center text-secondary py-4">No site-level test records matched filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CASE LIFECYCLE */}
      {subTab === 'lifecycle' && (
        <div className="analytics-content-view">
          <div className="analytics-card">
            <h3 className="section-title">Case Distribution Across Lifecycle States (Section 7.4)</h3>
            <p className="text-xs text-secondary mt-1">
              Active surveillance cases strictly mapped across the 10 state machine stages.
            </p>
            <div className="lifecycle-grid mt-4">
              {Object.entries(cases?.by_status || {}).map(([st, count]: [string, any]) => (
                <div key={st} className="lifecycle-card">
                  <div className="lifecycle-state-label">{st.replace(/_/g, ' ').toUpperCase()}</div>
                  <div className="lifecycle-count">{count}</div>
                  <div className="lifecycle-pct text-xs text-secondary">
                    {cases?.total ? `${Math.round((count / cases.total) * 100)}% of total` : '0%'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-card mt-4">
            <h3 className="section-title">Clinical Durations & Triage Latency</h3>
            <div className="durations-grid mt-3">
              <div className="duration-item">
                <div className="duration-label">Submission to Triage / Acknowledgment</div>
                <div className="duration-val">
                  {cases?.durations?.submission_to_acknowledgement?.available
                    ? `${(cases.durations.submission_to_acknowledgement.avg_seconds / 3600).toFixed(1)} hours`
                    : 'N/A'}
                </div>
                <div className="text-xs text-secondary mt-1">
                  Min: {cases?.durations?.submission_to_acknowledgement?.min_seconds ? `${(cases.durations.submission_to_acknowledgement.min_seconds / 60).toFixed(0)}m` : '—'} · Max: {cases?.durations?.submission_to_acknowledgement?.max_seconds ? `${(cases.durations.submission_to_acknowledgement.max_seconds / 3600).toFixed(1)}h` : '—'}
                </div>
              </div>

              <div className="duration-item">
                <div className="duration-label">Submission to First Diagnostic Result</div>
                <div className="duration-val">
                  {cases?.durations?.submission_to_first_completed_result?.available
                    ? `${(cases.durations.submission_to_first_completed_result.avg_seconds / 3600).toFixed(1)} hours`
                    : 'N/A'}
                </div>
                <div className="text-xs text-secondary mt-1">
                  Min: {cases?.durations?.submission_to_first_completed_result?.min_seconds ? `${(cases.durations.submission_to_first_completed_result.min_seconds / 60).toFixed(0)}m` : '—'}
                </div>
              </div>

              <div className="duration-item">
                <div className="duration-label">Submission to Case Resolution / Closure</div>
                <div className="duration-val">
                  {cases?.durations?.submission_to_closure?.available
                    ? `${(cases.durations.submission_to_closure.avg_seconds / 86400).toFixed(1)} days`
                    : 'In Progress'}
                </div>
                <div className="text-xs text-secondary mt-1">
                  Evaluated across {cases?.durations?.submission_to_closure?.n ?? 0} closed episodes
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATA QUALITY & COMPLETENESS */}
      {subTab === 'quality' && (
        <div className="analytics-content-view">
          <div className="analytics-card">
            <div className="dq-summary-header">
              <div>
                <h3 className="section-title">Data Completeness & Surveillance Integrity Rules (Section 7.5)</h3>
                <p className="text-xs text-secondary mt-1">
                  12 automated integrity rules checking required fields, orphan linkages, and non-standard states.
                </p>
              </div>
              <div className="dq-stats">
                <span className="status-badge badge-neutral">Rules Checked: {dqData?.summary?.checks_run ?? 12}</span>
                <span className="status-badge badge-warning ml-2">With Findings: {dqData?.summary?.checks_with_findings ?? 0}</span>
                <span className="status-badge badge-danger ml-2">High Severity: {dqData?.summary?.high_severity_findings ?? 0}</span>
              </div>
            </div>

            <div className="table-responsive mt-3">
              <table className="data-table">
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
                        <strong>{chk.name}</strong>
                        <div className="text-xs text-secondary">{chk.definition}</div>
                      </td>
                      <td>
                        <span className={`status-badge ${chk.severity === 'high' ? 'badge-danger' : chk.severity === 'medium' ? 'badge-warning' : 'badge-neutral'}`}>
                          {chk.severity?.toUpperCase()}
                        </span>
                      </td>
                      <td><code>{chk.table}</code></td>
                      <td>
                        <strong className={chk.affected > 0 ? 'text-danger' : 'text-success'}>
                          {chk.affected}
                        </strong> / {chk.total}
                      </td>
                      <td>{chk.pct_affected !== null ? `${chk.pct_affected}%` : '0%'}</td>
                      <td className="text-xs">{chk.remediation}</td>
                      <td>
                        {chk.affected > 0 ? (
                          <button className="btn-outline btn-xs" onClick={() => inspectDqCheck(chk)}>
                            Drill Down →
                          </button>
                        ) : (
                          <span className="text-success text-xs font-semibold">✓ Pass</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-down Drawer for Data Quality Check */}
          {activeDqCheck && (
            <div className="modal-backdrop" onClick={() => setActiveDqCheck(null)}>
              <div className="modal-card wide-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <h3>Data Quality Drill-down: {activeDqCheck.name}</h3>
                    <p className="text-xs text-secondary mt-1">
                      Rule <code>{activeDqCheck.key}</code> · {activeDqCheck.affected} affected records in <code>{activeDqCheck.table}</code>
                    </p>
                  </div>
                  <button className="btn-close" onClick={() => setActiveDqCheck(null)}>×</button>
                </div>
                <div className="modal-body">
                  <div className="notice-banner mb-3">
                    <strong>Remediation:</strong> {activeDqCheck.remediation} ({activeDqCheck.safe_to_remediate_automatically ? 'Safe for automated script' : 'Requires human clinical/supervisor review'})
                  </div>
                  {dqRecordsLoading ? (
                    <div className="spinner my-4" />
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
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
                              <td><span className="status-badge badge-neutral">{r.record_type}</span></td>
                              <td>
                                {r.test_id && <div>Test ID: <code>{r.test_id}</code></div>}
                                {r.sample_code && <div>Sample: <strong>{r.sample_code}</strong></div>}
                                {r.case_code && <div>Case: <strong>{r.case_code}</strong></div>}
                                {r.worker_ref && <div>Worker Ref: <code>{r.worker_ref}</code></div>}
                              </td>
                              <td>{r.status || 'Flagged for integrity review'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: TRACEABILITY & PROVENANCE DRILL-DOWN */}
      {subTab === 'records' && (
        <div className="analytics-content-view">
          <div className="analytics-card">
            <div className="flex-between">
              <div>
                <h3 className="section-title">Test-Level Provenance & Traceability Records (Section 7.6)</h3>
                <p className="text-xs text-secondary mt-1">
                  Individual records showing modality, timestamps, linkage status, and pseudonymized patient reference.
                </p>
              </div>
              <div className="records-pagination-controls">
                <button
                  className="btn-outline btn-xs"
                  disabled={recordsOffset <= 0}
                  onClick={() => setRecordsOffset(Math.max(0, recordsOffset - 25))}
                >
                  ← Previous 25
                </button>
                <span className="text-xs text-secondary mx-2">
                  Showing {recordsOffset + 1} - {Math.min((testsData?.total || 0), recordsOffset + 25)} of {testsData?.total || 0}
                </span>
                <button
                  className="btn-outline btn-xs"
                  disabled={recordsOffset + 25 >= (testsData?.total || 0)}
                  onClick={() => setRecordsOffset(recordsOffset + 25)}
                >
                  Next 25 →
                </button>
              </div>
            </div>

            <div className="table-responsive mt-3">
              <table className="data-table">
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
                      <td><strong>{t.sample_code}</strong></td>
                      <td>{t.case_code || '—'}</td>
                      <td><code>{t.worker_ref}</code></td>
                      <td>
                        <div>{t.facility?.name || t.site?.name || '—'}</div>
                        <div className="text-xs text-secondary">{t.district || 'Goa'}</div>
                      </td>
                      <td><span className="status-badge badge-neutral">{t.method}</span></td>
                      <td>
                        <span className={`status-badge ${t.result_status === 'positive' ? 'badge-danger' : t.result_status === 'negative' ? 'badge-success' : 'badge-warning'}`}>
                          {t.result_status?.toUpperCase()}
                        </span>
                      </td>
                      <td>{t.species?.toUpperCase() || '—'}</td>
                      <td className="text-xs">{t.server_received_at ? new Date(t.server_received_at).toLocaleString() : '—'}</td>
                      <td>
                        <span className={`status-badge ${t.linkage_status === 'linked' ? 'badge-success' : 'badge-warning'}`}>
                          {t.linkage_status}
                        </span>
                      </td>
                      <td>
                        {t.data_quality_flags?.length > 0 ? (
                          t.data_quality_flags.map((fl: string) => (
                            <span key={fl} className="status-badge badge-danger mr-1">{fl}</span>
                          ))
                        ) : (
                          <span className="text-xs text-success">Clean</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!testsData?.items || testsData.items.length === 0) && (
                    <tr>
                      <td colSpan={11} className="text-center text-secondary py-4">No records found matching current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
