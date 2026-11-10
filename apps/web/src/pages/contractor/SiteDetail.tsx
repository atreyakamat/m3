import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, Button } from '../../components/ui';
import { palette, radius } from '../../lib/tokens';
import { MalariaStatusChip } from '../../components/StatusChip';

interface SiteDetailData {
  site: {
    id: string;
    siteCode: string;
    name: string;
    area: string;
    active: boolean;
  };
  stats: {
    siteCode: string;
    siteName: string;
    totalWorkers: number;
    positive: number;
    negative: number;
    awaitingResults: number;
    noResultRecorded: number;
    lastUpdated: string;
  };
  workers: Array<{
    workerId: string;
    patientId: string;
    name: string;
    phone: string | null;
    age: number | null;
    gender: string | null;
    malariaStatus: 'POSITIVE' | 'NEGATIVE' | null;
  }>;
  totalWorkers: number;
  travels: Array<{
    id: string;
    workerId: string;
    workerName: string;
    phone: string | null;
    departureDate: string | null;
    returnDate: string | null;
    destination: string | null;
    state: string | null;
    status: string;
    isUpcoming: boolean;
    malariaStatus: 'POSITIVE' | 'NEGATIVE' | null;
    isSevenDayAlert: boolean;
  }>;
  transfers: Array<{
    id: string;
    workerName: string;
    workerId: string;
    currentSite: { siteId: string; name: string } | null;
    destinationSite: { siteId: string; name: string };
    initiator: string;
    status: string;
    createdAt: string;
    isAwaitingMyApproval: boolean;
  }>;
}

export function ContractorSiteDetail() {
  const { siteCode } = useParams<{ siteCode: string }>();
  const [selectedWorker, setSelectedWorker] = useState<SiteDetailData['workers'][0] | null>(null);

  const { data, loading, error, reload } = useAsync<SiteDetailData>(
    () => api.get(`/contractor/sites/${siteCode}/detail`),
    [siteCode],
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spinner />
        <p className="muted" style={{ marginTop: 12 }}>Loading construction site details…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="stack">
        <Banner kind="danger">
          {error || 'Failed to load site details.'}
        </Banner>
        <div className="row">
          <Button onClick={reload}>Retry</Button>
          <Link to="/contractor/sites" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Back to Sites</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { site, stats, workers, travels } = data;

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Header & Back link */}
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <Link
            to="/contractor/sites"
            style={{
              textDecoration: 'none',
              color: '#3D5A80',
              fontWeight: 600,
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}
          >
            ← Back to My Sites
          </Link>
          <h2 style={{ margin: 0, fontSize: 24, color: palette.text }}>{site.name}</h2>
          <div className="muted small" style={{ marginTop: 4 }}>
            Site Code: <strong>{site.siteCode}</strong> · Area: <strong>{site.area}</strong> · Status: {site.active ? 'Active' : 'Inactive'}
          </div>
        </div>
        <Link to="/contractor" style={{ textDecoration: 'none' }}>
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Card accent={palette.primary}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Workforce</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: palette.primary, marginTop: 4 }}>{stats.totalWorkers}</div>
          <div className="muted small" style={{ marginTop: 4 }}>Registered at this site</div>
        </Card>
        <Card accent="#2E7D32">
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Tested Negative</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2E7D32', marginTop: 4 }}>{stats.negative}</div>
          <div className="muted small" style={{ marginTop: 4 }}>Verified malaria negative</div>
        </Card>
        <Card accent={stats.positive > 0 ? '#D32F2F' : palette.border}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Positive Cases</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: stats.positive > 0 ? '#D32F2F' : palette.text, marginTop: 4 }}>
            {stats.positive}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>{stats.positive > 0 ? 'Under clinical management' : 'No active positive cases'}</div>
        </Card>
        <Card accent={palette.secondary}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending / Unrecorded</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: palette.secondary, marginTop: 4 }}>
            {stats.awaitingResults + stats.noResultRecorded}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>{stats.awaitingResults} awaiting results</div>
        </Card>
      </div>

      {/* Section: Assigned Workers */}
      <Card>
        <div className="spread" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>Assigned Workers</h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Workers deployed at {site.name} ({workers.length} of {data.totalWorkers})
            </p>
          </div>
        </div>

        {workers.length === 0 ? (
          <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            No workers currently assigned to this construction site.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>Worker Name</th>
                  <th style={{ padding: '10px 12px' }}>Worker ID</th>
                  <th style={{ padding: '10px 12px' }}>Phone</th>
                  <th style={{ padding: '10px 12px' }}>Malaria Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.workerId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ color: palette.text }}>{w.name}</strong>
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 13 }}>
                      {w.workerId}
                    </td>
                    <td style={{ padding: '12px', color: '#64748B' }}>
                      {w.phone ?? '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <MalariaStatusChip status={w.malariaStatus ?? 'NO_RESULT'} />
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedWorker(w)}
                        style={{
                          background: 'none',
                          border: '1px solid #CBD5E1',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 13,
                          cursor: 'pointer',
                          color: '#3D5A80',
                          fontWeight: 600,
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section: Travel & Upcoming Departures */}
      <Card>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, color: palette.text }}>Worker Travel & Departures</h3>
        <p className="muted small" style={{ margin: '0 0 16px' }}>
          Travel surveillance records for workers assigned to this site
        </p>

        {travels.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
            No travel records logged for workers at this site.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>Worker</th>
                  <th style={{ padding: '10px 12px' }}>Destination</th>
                  <th style={{ padding: '10px 12px' }}>Departure Date</th>
                  <th style={{ padding: '10px 12px' }}>Return Date</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {travels.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9', background: t.isSevenDayAlert ? '#FEF2F2' : undefined }}>
                    <td style={{ padding: '12px' }}>
                      <strong>{t.workerName}</strong>
                      <span className="muted small" style={{ marginLeft: 6 }}>({t.workerId})</span>
                      {t.isSevenDayAlert && (
                        <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                          7-Day Alert
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>{t.destination ?? t.state ?? '—'}</td>
                    <td style={{ padding: '12px' }}>{t.departureDate ? new Date(t.departureDate).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px' }}>{t.returnDate ? new Date(t.returnDate).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, background: '#E2E8F0', color: '#334155', fontWeight: 600 }}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setSelectedWorker(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: radius.lg,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spread" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, color: palette.text }}>Worker Information</h3>
              <button
                onClick={() => setSelectedWorker(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Full Name</span>
                <strong>{selectedWorker.name}</strong>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Worker ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedWorker.workerId}</span>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Phone Number</span>
                <span>{selectedWorker.phone ?? 'Not provided'}</span>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Assigned Site</span>
                <span>{site.name}</span>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Malaria Status</span>
                <MalariaStatusChip status={selectedWorker.malariaStatus ?? 'NO_RESULT'} />
              </div>
              {selectedWorker.age && (
                <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span className="muted">Age / Gender</span>
                  <span>{selectedWorker.age} yrs · {selectedWorker.gender ?? '—'}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <Button onClick={() => setSelectedWorker(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
