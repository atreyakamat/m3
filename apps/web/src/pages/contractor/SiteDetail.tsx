import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, Button } from '../../components/ui';
import { palette } from '../../lib/tokens';
import { WorkerDetailModal, AssignmentStatusBadge } from './WorkerDetailModal';

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
    workerCode?: string;
    patientId: string;
    name: string;
    phone: string | null;
    age: number | null;
    gender: string | null;
    active?: boolean;
    assignmentStatus?: string;
    startedAt?: string;
    malariaStatus: null;
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
  const [selectedWorkerCode, setSelectedWorkerCode] = useState<string | null>(null);

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
      <div className="stack" style={{ gap: 16 }}>
        <Banner kind="danger">
          {error || 'Failed to load site details.'}
        </Banner>
        <div className="row" style={{ gap: 12 }}>
          <Button onClick={reload}>Retry</Button>
          <Link to="/contractor/sites" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Back to Sites</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { site, stats, workers, travels, transfers } = data;

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
            Site Code: <strong style={{ fontFamily: 'monospace' }}>{site.siteCode}</strong> · Area: <strong>{site.area}</strong> · Status: {site.active ? 'Active' : 'Inactive'}
          </div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <Link to={`/contractor/workers?siteCode=${site.siteCode}`} style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Manage Site Workforce</Button>
          </Link>
          <Link to="/contractor" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Card accent={palette.primary}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Workforce</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: palette.primary, marginTop: 4 }}>{stats.totalWorkers}</div>
          <div className="muted small" style={{ marginTop: 4 }}>Workers deployed at this site</div>
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
              Workforce registered at {site.name} ({workers.length} of {data.totalWorkers})
            </p>
          </div>
          <Link
            to={`/contractor/workers?siteCode=${site.siteCode}`}
            style={{ color: '#3D5A80', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
          >
            Open Full Roster →
          </Link>
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
                  <th style={{ padding: '10px 12px' }}>Demographics</th>
                  <th style={{ padding: '10px 12px' }}>Assignment Status</th>
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
                    <td style={{ padding: '12px', color: '#64748B', fontSize: 13 }}>
                      {w.age ? `${w.age} yrs` : '—'} · {w.gender || '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <AssignmentStatusBadge status={w.assignmentStatus ?? 'ACTIVE'} />
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedWorkerCode(w.workerId)}
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
                        View Details
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
                      <strong style={{ color: palette.text }}>{t.workerName}</strong>
                      <div className="muted small" style={{ fontFamily: 'monospace' }}>{t.workerId}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {t.destination ?? 'Hometown'}{t.state ? `, ${t.state}` : ''}
                    </td>
                    <td style={{ padding: '12px', color: '#64748B' }}>
                      {t.departureDate ? new Date(t.departureDate).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px', color: '#64748B' }}>
                      {t.returnDate ? new Date(t.returnDate).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: t.isSevenDayAlert ? '#FEE2E2' : '#F1F5F9',
                          color: t.isSevenDayAlert ? '#DC2626' : '#475569',
                        }}
                      >
                        {t.isSevenDayAlert ? '7-Day Surveillance Alert' : t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section: Site Transfers */}
      <Card>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, color: palette.text }}>Site Transfer Requests</h3>
        <p className="muted small" style={{ margin: '0 0 16px' }}>
          Transfer requests into or out of {site.name}
        </p>

        {transfers.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
            No transfer requests on record for this site.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>Worker</th>
                  <th style={{ padding: '10px 12px' }}>Current Site</th>
                  <th style={{ padding: '10px 12px' }}>Destination Site</th>
                  <th style={{ padding: '10px 12px' }}>Initiator</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tr) => (
                  <tr key={tr.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ color: palette.text }}>{tr.workerName}</strong>
                      <div className="muted small" style={{ fontFamily: 'monospace' }}>{tr.workerId}</div>
                    </td>
                    <td style={{ padding: '12px', color: '#64748B' }}>
                      {tr.currentSite?.name ?? '—'}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: palette.text }}>
                      {tr.destinationSite.name}
                    </td>
                    <td style={{ padding: '12px', color: '#64748B' }}>
                      {tr.initiator}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: tr.status.includes('REJECTED')
                            ? '#FEE2E2'
                            : tr.status.includes('ACCEPTED')
                            ? '#ECFDF5'
                            : '#FEF3C7',
                          color: tr.status.includes('REJECTED')
                            ? '#DC2626'
                            : tr.status.includes('ACCEPTED')
                            ? '#065F46'
                            : '#D97706',
                        }}
                      >
                        {tr.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#64748B' }}>
                      {new Date(tr.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Reusable Worker Detail Modal */}
      {selectedWorkerCode && (
        <WorkerDetailModal
          workerCode={selectedWorkerCode}
          onClose={() => setSelectedWorkerCode(null)}
        />
      )}
    </div>
  );
}
