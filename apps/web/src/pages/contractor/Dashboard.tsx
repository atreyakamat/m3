import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, Button, TextField } from '../../components/ui';
import { palette, radius } from '../../lib/tokens';
import { MalariaStatusChip, TransferStatusChip } from '../../components/StatusChip';

interface DashboardData {
  contractor: {
    id: string;
    contractorCode: string;
    name: string;
    phone: string;
  };
  metrics: {
    totalAssignedWorkers: number;
    activeWorkers: number;
    workersCurrentlyAtSite: number;
    pendingTransferRequests: number;
  };
  sites: Array<{
    id: string;
    siteId: string;
    siteCode: string;
    name: string;
    area: string;
    activeWorkers: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'ASSIGNMENT' | 'TRAVEL' | 'TRANSFER';
    title: string;
    description: string;
    timestamp: string;
    workerCode: string;
    workerName: string;
    siteCode: string | null;
    siteName: string | null;
  }>;
  workers: Array<{
    workerCode: string;
    patientId: string;
    name: string;
    phone: string | null;
    age: number | null;
    gender: string | null;
    siteCode: string;
    siteName: string;
    active: boolean;
    malariaStatus: 'POSITIVE' | 'NEGATIVE' | null;
  }>;
  pendingTransfers: Array<{
    id: string;
    transferId: string;
    workerCode: string;
    workerName: string;
    currentSite: { siteId: string; name: string } | null;
    destinationSite: { siteId: string; name: string };
    initiator: string;
    status: string;
    createdAt: string;
    isAwaitingMyApproval: boolean;
  }>;
}

export function ContractorDashboard() {
  const nav = useNavigate();
  const [workerSearch, setWorkerSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<DashboardData['workers'][0] | null>(null);

  const { data, loading, error, reload } = useAsync<DashboardData>(
    () => api.get('/contractor/dashboard'),
    [],
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spinner />
        <p className="muted" style={{ marginTop: 14 }}>Loading contractor dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <Banner kind="danger">
          {error || 'Failed to load contractor dashboard.'}
        </Banner>
        <div>
          <Button onClick={reload}>Retry</Button>
        </div>
      </div>
    );
  }

  const { contractor, metrics, sites, recentActivity, workers, pendingTransfers } = data;

  const filteredWorkers = workers.filter((w) => {
    if (!workerSearch.trim()) return true;
    const q = workerSearch.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.workerCode.toLowerCase().includes(q) ||
      (w.phone && w.phone.includes(q))
    );
  });

  return (
    <div className="stack" style={{ gap: 28 }}>
      {/* Contractor Welcome & Quick Actions */}
      <div className="spread" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: palette.text }}>
            {contractor.name}
          </h2>
          <div className="muted small" style={{ marginTop: 4 }}>
            Contractor ID: <strong>{contractor.contractorCode}</strong> · Registered Phone: {contractor.phone || '—'}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="secondary" onClick={() => nav('/contractor/initiate')}>
            + Initiate Transfer
          </Button>
          <Button onClick={() => nav('/contractor/approvals')}>
            Review Approvals
          </Button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {/* Card 1: Total Assigned Workers */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => nav('/contractor/workers')}
          onKeyDown={(e) => e.key === 'Enter' && nav('/contractor/workers')}
          style={{ cursor: 'pointer' }}
          title="Click to view all assigned workers"
        >
          <Card accent="#3D5A80">
            <div className="spread">
              <span className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Total Assigned Workers
              </span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#3D5A80', marginTop: 8 }}>
              {metrics.totalAssignedWorkers}
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              Across all assigned sites →
            </div>
          </Card>
        </div>

        {/* Card 2: Active Workers */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => nav('/contractor/workers')}
          onKeyDown={(e) => e.key === 'Enter' && nav('/contractor/workers')}
          style={{ cursor: 'pointer' }}
          title="Click to view active workforce"
        >
          <Card accent="#2B6CB0">
            <div className="spread">
              <span className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Active Workers
              </span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#2B6CB0', marginTop: 8 }}>
              {metrics.activeWorkers}
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              Currently engaged workforce →
            </div>
          </Card>
        </div>

        {/* Card 3: Workers Currently at Site */}
        <Card accent="#2E7D32">
          <div className="spread">
            <span className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Workers Currently at Site
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#2E7D32', marginTop: 8 }}>
            {metrics.workersCurrentlyAtSite}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            Physically on site in Goa
          </div>
        </Card>

        {/* Card 4: Pending Transfer Requests */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => nav('/contractor/approvals')}
          onKeyDown={(e) => e.key === 'Enter' && nav('/contractor/approvals')}
          style={{ cursor: 'pointer' }}
          title="Click to open transfer approvals"
        >
          <Card accent={metrics.pendingTransferRequests > 0 ? '#E28743' : palette.border}>
            <div className="spread">
              <span className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Pending Transfer Requests
              </span>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: metrics.pendingTransferRequests > 0 ? '#E28743' : palette.text,
                marginTop: 8,
              }}
            >
              {metrics.pendingTransferRequests}
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {metrics.pendingTransferRequests > 0 ? 'Awaiting decision →' : 'No pending requests'}
            </div>
          </Card>
        </div>
      </div>

      {/* Grid Row 1: Site Overview & Recent Worker Activity */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Section: Site Overview */}
        <Card>
          <div className="spread" style={{ marginBottom: 16 }}>
            <div>
              <h3
                style={{ margin: 0, fontSize: 18, color: palette.text, cursor: 'pointer' }}
                onClick={() => nav(sites.length === 1 ? `/contractor/sites/${sites[0].siteCode}` : '/contractor/sites')}
              >
                Site Overview
              </h3>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                Assigned construction sites ({sites.length})
              </p>
            </div>
            <Link
              to="/contractor/sites"
              style={{ fontSize: 13, color: '#3D5A80', textDecoration: 'none', fontWeight: 600 }}
            >
              View all sites →
            </Link>
          </div>

          {sites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p className="muted" style={{ margin: 0 }}>
                No construction sites assigned yet. Please contact the administrator.
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {sites.map((s) => (
                <div
                  key={s.siteCode}
                  onClick={() => nav(`/contractor/sites/${s.siteCode}`)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: radius.md,
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <div>
                    <strong style={{ color: palette.text, fontSize: 15 }}>{s.name}</strong>
                    <div className="muted small" style={{ marginTop: 2 }}>
                      {s.siteCode} · {s.area}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#3D5A80' }}>
                      {s.activeWorkers}
                    </div>
                    <div className="muted small">active workers</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section: Recent Worker Activity */}
        <Card>
          <div className="spread" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>Recent Worker Activity</h3>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                Latest authorized workforce events
              </p>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                background: '#E2E8F0',
                color: '#475569',
                fontWeight: 600,
              }}
            >
              Live Feed
            </span>
          </div>

          {recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p className="muted" style={{ margin: 0 }}>
                No recent worker activity recorded.
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 12, maxHeight: 320, overflowY: 'auto' }}>
              {recentActivity.map((act) => {
                let badgeColor = '#3D5A80';
                let badgeBg = '#E7ECF3';
                if (act.type === 'TRAVEL') {
                  badgeColor = '#2B6CB0';
                  badgeBg = '#EBF8FF';
                } else if (act.type === 'TRANSFER') {
                  badgeColor = '#C05621';
                  badgeBg = '#FEEBC8';
                }

                return (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: badgeBg,
                        color: badgeColor,
                        whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}
                    >
                      {act.type}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: palette.text }}>
                        {act.description}
                      </div>
                      <div className="muted small" style={{ marginTop: 2 }}>
                        {new Date(act.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Section: Worker Management */}
      <Card>
        <div className="spread" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3
              style={{ margin: 0, fontSize: 18, color: palette.text, cursor: 'pointer' }}
              onClick={() => nav('/contractor/workers')}
            >
              Worker Management
            </h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Workers deployed across your sites ({workers.length} active)
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ width: 220 }}>
              <TextField
                placeholder="Search workers…"
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => nav('/contractor/workers')}>
              Full Workforce →
            </Button>
          </div>
        </div>

        {filteredWorkers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p className="muted" style={{ margin: 0 }}>
              {workerSearch ? 'No workers match your search.' : 'No workers currently assigned to your workforce.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>Worker Name</th>
                  <th style={{ padding: '10px 12px' }}>Worker ID</th>
                  <th style={{ padding: '10px 12px' }}>Phone</th>
                  <th style={{ padding: '10px 12px' }}>Assigned Site</th>
                  <th style={{ padding: '10px 12px' }}>Malaria Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((w) => (
                  <tr key={w.workerCode} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ color: palette.text }}>{w.name}</strong>
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 13 }}>
                      {w.workerCode}
                    </td>
                    <td style={{ padding: '12px', color: '#64748B' }}>
                      {w.phone ?? '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Link
                        to={`/contractor/sites/${w.siteCode}`}
                        style={{ color: '#3D5A80', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {w.siteName}
                      </Link>
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

      {/* Section: Transfer Requests */}
      <Card>
        <div className="spread" style={{ marginBottom: 16 }}>
          <div>
            <h3
              style={{ margin: 0, fontSize: 18, color: palette.text, cursor: 'pointer' }}
              onClick={() => nav('/contractor/approvals')}
            >
              Transfer Requests
            </h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Pending transfers requiring contractor approval ({pendingTransfers.length})
            </p>
          </div>
          <Button variant="secondary" onClick={() => nav('/contractor/approvals')}>
            Open Approvals View →
          </Button>
        </div>

        {pendingTransfers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p className="muted" style={{ margin: 0 }}>
              No pending transfer requests.
            </p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {pendingTransfers.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: radius.md,
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <strong style={{ color: palette.text, fontSize: 15 }}>{t.workerName}</strong>
                  <span className="muted small" style={{ marginLeft: 6 }}>({t.workerCode})</span>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    From: <strong>{t.currentSite?.name ?? 'Current Site'}</strong> → To: <strong>{t.destinationSite.name}</strong>
                  </div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    Initiated by {t.initiator.toLowerCase()} · {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <TransferStatusChip status={t.status as never} />
                  <Button onClick={() => nav('/contractor/approvals')}>
                    Review
                  </Button>
                </div>
              </div>
            ))}
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
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedWorker.workerCode}</span>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Phone</span>
                <span>{selectedWorker.phone ?? 'Not provided'}</span>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Assigned Site</span>
                <strong>{selectedWorker.siteName}</strong>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Malaria Status</span>
                <MalariaStatusChip status={selectedWorker.malariaStatus ?? 'NO_RESULT'} />
              </div>
              {selectedWorker.age && (
                <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span className="muted">Age / Gender</span>
                  <span>{selectedWorker.age} years · {selectedWorker.gender ?? '—'}</span>
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
