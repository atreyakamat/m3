import { FormEvent, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { api } from './api'
import './styles.css'

type User = {
  id: string
  display_name: string
  roles: string[]
  preferred_language: string
  patient_id?: string
}

type Session = {
  access_token: string
  user: User
}

type Labels = {
  appName: string
  signIn: string
  phone: string
  pin: string
  overview: string
  workers: string
  samples: string
  followups: string
  sites: string
  reports: string
  signOut: string
  search: string
  loading: string
  empty: string
  offline: string
  synthetic: string
  status: string
  patientCode: string
  name: string
  age: string
  gender: string
  occupation: string
  consent: string
  method: string
  result: string
  species: string
  dueDate: string
  adherence: string
  outcome: string
  area: string
  actions: string
  refresh: string
}

const labels: Record<'en' | 'hi', Labels> = {
  en: {
    appName: 'M3 Malaria Surveillance Console',
    signIn: 'Sign In',
    phone: 'Phone number',
    pin: 'PIN',
    overview: 'Overview',
    workers: 'Workers Roster',
    samples: 'Diagnostics & Pathology',
    followups: 'Follow-ups',
    sites: 'Construction Sites',
    reports: 'Surveillance Reports',
    signOut: 'Sign Out',
    search: 'Search by patient ID, code, or name...',
    loading: 'Loading surveillance records from API...',
    empty: 'No authorized records found',
    offline: 'LAN API is currently unreachable. Check server connection.',
    synthetic: 'Synthetic Demonstration Dataset — Not for clinical point-of-care deployment.',
    status: 'Status',
    patientCode: 'Patient ID',
    name: 'Name',
    age: 'Age',
    gender: 'Gender',
    occupation: 'Occupation',
    consent: 'Consent',
    method: 'Method',
    result: 'Result',
    species: 'Species',
    dueDate: 'Due Date',
    adherence: 'Adherence',
    outcome: 'Outcome',
    area: 'Area',
    actions: 'Actions',
    refresh: 'Refresh Data',
  },
  hi: {
    appName: 'एम3 मलेरिया निगरानी कंसोल',
    signIn: 'साइन इन करें',
    phone: 'फ़ोन नंबर',
    pin: 'पिन',
    overview: 'सारांश',
    workers: 'श्रमिक सूची',
    samples: 'निदान एवं पैथोलॉजी',
    followups: 'अनुवर्ती देखभाल',
    sites: 'निर्माण स्थल',
    reports: 'निगरानी रिपोर्ट',
    signOut: 'साइन आउट',
    search: 'रोगी आईडी, कोड या नाम से खोजें...',
    loading: 'सर्वर से रिकॉर्ड लोड हो रहे हैं...',
    empty: 'कोई अधिकृत रिकॉर्ड नहीं मिला',
    offline: 'एपीआई सर्वर से संपर्क नहीं हो पा रहा है।',
    synthetic: 'सिंथेटिक डेमो डेटा — केवल परीक्षण और मूल्यांकन के लिए।',
    status: 'स्थिति',
    patientCode: 'रोगी आईडी',
    name: 'नाम',
    age: 'आयु',
    gender: 'लिंग',
    occupation: 'व्यवसाय',
    consent: 'सहमति',
    method: 'विधि',
    result: 'परिणाम',
    species: 'प्रजाति',
    dueDate: 'देय तिथि',
    adherence: 'दवा पालन',
    outcome: 'परिणाम',
    area: 'क्षेत्र',
    actions: 'कार्रवाई',
    refresh: 'रीफ़्रेश करें',
  },
}

function Login({ onSession, language, onToggleLang }: {
  onSession: (s: Session) => void
  language: 'en' | 'hi'
  onToggleLang: () => void
}) {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const t = labels[language]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api<Session>('/auth/login', undefined, {
        method: 'POST',
        body: JSON.stringify({ phone, pin }),
      })
      onSession(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  function prefill(p: string) {
    setPhone(p)
    setPin('2468')
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-top">
          <span className="eyebrow">M3 / GOA SURVEILLANCE</span>
          <button
            type="button"
            className="lang-pill"
            onClick={onToggleLang}
          >
            {language === 'en' ? 'हिन्दी' : 'English'}
          </button>
        </div>

        <h1 className="login-title">{t.appName}</h1>
        <p className="login-subtitle">
          Authorized console access for clinical surveillance, laboratory diagnostics, and contractor site monitoring.
        </p>

        <form onSubmit={submit} className="login-form">
          <label className="input-group">
            <span className="input-label">{t.phone}</span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919000000001"
              required
            />
          </label>

          <label className="input-group">
            <span className="input-label">{t.pin}</span>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit PIN (2468)"
              pattern="[0-9]{4,12}"
              required
            />
          </label>

          {error && <div className="alert-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : t.signIn}
          </button>
        </form>

        <div className="quick-roles-section">
          <span className="quick-roles-label">Quick Sign-in (PIN: 2468):</span>
          <div className="quick-roles-row">
            <button type="button" onClick={() => prefill('+919000000001')}>Worker</button>
            <button type="button" onClick={() => prefill('+919000000002')}>Clinician</button>
            <button type="button" onClick={() => prefill('+919000000003')}>Pathology</button>
            <button type="button" onClick={() => prefill('+919000000004')}>Health Worker</button>
            <button type="button" onClick={() => prefill('+919000000005')}>Research Lab</button>
            <button type="button" onClick={() => prefill('+919000000006')}>Contractor</button>
          </div>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </div>
  )
}

function StatusBadge({
  label,
  variant = 'neutral',
}: {
  label: string
  variant?: 'neutral' | 'success' | 'danger' | 'warning'
}) {
  return <span className={`status-badge badge-${variant}`}>{label}</span>
}

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('m3-session') || 'null')
    } catch {
      return null
    }
  })

  const [tab, setTab] = useState('overview')
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const t = labels[language]
  const token = session?.access_token

  useEffect(() => {
    if (session) {
      sessionStorage.setItem('m3-session', JSON.stringify(session))
    } else {
      sessionStorage.removeItem('m3-session')
    }
  }, [session])

  async function loadData() {
    if (!token) return
    let path = '/dashboard'
    if (tab === 'workers') {
      path = `/workers?limit=50${query ? `&q=${encodeURIComponent(query)}` : ''}`
    } else if (tab === 'samples') {
      path = '/samples?limit=50'
    } else if (tab === 'followups') {
      path = '/follow-ups?limit=50'
    } else if (tab === 'sites') {
      path = '/sites'
    } else if (tab === 'reports') {
      path = '/dashboard'
    }

    setLoading(true)
    setError('')
    try {
      const res = await api(path, token)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tab, token, query])

  if (!session) {
    return (
      <Login
        onSession={setSession}
        language={language}
        onToggleLang={() => setLanguage(language === 'en' ? 'hi' : 'en')}
      />
    )
  }

  const nav = [
    ['overview', t.overview],
    ['workers', t.workers],
    ['samples', t.samples],
    ['followups', t.followups],
    ['sites', t.sites],
    ['reports', t.reports],
  ]

  return (
    <div className="shell">
      {/* Mobile Top Bar */}
      <header className="mobile-header">
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="mobile-title">M3 SURVEILLANCE</span>
        <span className="badge-online">Online</span>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="eyebrow">M3 / MALARIA SURVEILLANCE</span>
          <h2 className="brand-title">Office Console</h2>
          <div className="user-profile">
            <strong className="user-name">{session.user.display_name}</strong>
            <div className="user-roles">
              {session.user.roles.map((r) => (
                <span key={r} className="role-tag">{r}</span>
              ))}
            </div>
          </div>
        </div>

        <nav className="nav-menu">
          {nav.map(([id, label]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              onClick={() => {
                setTab(id)
                setMenuOpen(false)
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn-secondary btn-sm"
            onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          >
            {language === 'en' ? 'हिन्दी में देखें' : 'Switch to English'}
          </button>
          <button
            className="btn-outline btn-sm"
            onClick={() => {
              setSession(null)
              sessionStorage.removeItem('m3-session')
            }}
          >
            {t.signOut}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content">
        <header className="content-header">
          <div>
            <span className="eyebrow">AUTHORIZED VIEW</span>
            <h1 className="page-heading">
              {nav.find((x) => x[0] === tab)?.[1]}
            </h1>
          </div>
          <div className="header-actions">
            <button
              className="btn-outline btn-sm"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : t.refresh}
            </button>
            <span className="badge-online">API Connected</span>
          </div>
        </header>

        <div className="notice-banner">
          {t.synthetic}
        </div>

        {/* Tab Content */}
        {tab === 'workers' && (
          <div className="filter-bar">
            <input
              type="search"
              className="search-input"
              placeholder={t.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {error ? (
          <div className="state-card error-card">
            <h3>{t.offline}</h3>
            <p>{error}</p>
            <button className="btn-primary btn-sm" onClick={loadData}>Retry</button>
          </div>
        ) : loading ? (
          <div className="state-card loading-card">
            <div className="spinner" />
            <p>{t.loading}</p>
          </div>
        ) : tab === 'overview' || tab === 'reports' ? (
          <div className="overview-view">
            <div className="metrics-grid">
              <Metric label="Total Workers" value={data?.workers ?? '—'} />
              <Metric label="Pending Lab Samples" value={data?.samples_pending ?? 'Restricted'} />
              <Metric label="Positive Tests" value={data?.tests_positive ?? 'Restricted'} />
              <Metric label="Follow-ups Due" value={data?.followups_due ?? 0} />
              <Metric label="Follow-ups Overdue" value={data?.followups_overdue ?? 0} />
            </div>

            <div className="overview-section">
              <h3>Surveillance Guidelines</h3>
              <p className="notice-muted">
                Point-of-care RDTs and laboratory microscopy are tracked separately. All clinical observations are documented chronologically without automated diagnostic replacement. Molecular research assays (pfhrp2/3 deletions, gametocytes) are segregated from primary patient care triage.
              </p>
            </div>
          </div>
        ) : (
          <RecordsTable tab={tab} data={data} t={t} />
        )}
      </main>
    </div>
  )
}

function RecordsTable({
  tab,
  data,
  t,
}: {
  tab: string
  data: any
  t: Labels
}) {
  const items = data?.items || []

  if (!items.length) {
    return (
      <div className="state-card empty-card">
        <h3>{t.empty}</h3>
        <p>No records matched your search query or role permissions.</p>
      </div>
    )
  }

  if (tab === 'workers') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.patientCode}</th>
              <th>{t.name}</th>
              <th>{t.age} / {t.gender}</th>
              <th>{t.occupation}</th>
              <th>{t.consent}</th>
              <th>Initial Symptoms</th>
            </tr>
          </thead>
          <tbody>
            {items.map((w: any) => (
              <tr key={w.id}>
                <td><strong>{w.patient_code}</strong></td>
                <td>{w.display_name || '—'}</td>
                <td>
                  {[w.age_years ? `${w.age_years}y` : null, w.gender]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </td>
                <td>{w.occupation || '—'}</td>
                <td>
                  <StatusBadge
                    label={w.consent_status === 'documented' ? 'Documented' : 'Pending'}
                    variant={w.consent_status === 'documented' ? 'success' : 'neutral'}
                  />
                </td>
                <td>{w.initial_symptoms?.length ? w.initial_symptoms.join(', ') : 'None documented'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'samples') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sample Code</th>
              <th>{t.patientCode}</th>
              <th>{t.method}</th>
              <th>{t.result}</th>
              <th>{t.species}</th>
              <th>Smear / Type</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any) => (
              <tr key={s.id}>
                <td><strong>{s.sample_code}</strong></td>
                <td>{s.patient_id}</td>
                <td>{s.method?.toUpperCase()}</td>
                <td>
                  <StatusBadge
                    label={s.result_status?.toUpperCase()}
                    variant={
                      s.result_status === 'positive'
                        ? 'danger'
                        : s.result_status === 'negative'
                          ? 'success'
                          : 'warning'
                    }
                  />
                </td>
                <td>{s.species ? s.species.toUpperCase() : '—'}</td>
                <td>{s.smear_type || s.specimen_type || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'followups') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.patientCode}</th>
              <th>{t.dueDate}</th>
              <th>{t.status}</th>
              <th>{t.adherence}</th>
              <th>{t.outcome}</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f: any) => {
              const isOverdue = new Date(f.due_at).getTime() < Date.now() && f.status !== 'completed'
              return (
                <tr key={f.id}>
                  <td><strong>{f.patient_id}</strong></td>
                  <td>{new Date(f.due_at).toLocaleString()}</td>
                  <td>
                    <StatusBadge
                      label={isOverdue ? 'OVERDUE' : f.status?.toUpperCase() || 'DUE'}
                      variant={isOverdue ? 'danger' : 'neutral'}
                    />
                  </td>
                  <td>{f.adherence || '—'}</td>
                  <td>{f.outcome || '—'}</td>
                  <td>{f.notes || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (tab === 'sites') {
    return (
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Site Code</th>
              <th>Site Name</th>
              <th>{t.area}</th>
              <th>{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((site: any) => (
              <tr key={site.id}>
                <td><strong>{site.code}</strong></td>
                <td>{site.name}</td>
                <td>{site.area}</td>
                <td>
                  <StatusBadge
                    label={site.status?.toUpperCase() || 'ACTIVE'}
                    variant={site.status === 'active' ? 'success' : 'neutral'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}

createRoot(document.getElementById('root')!).render(<App />)
