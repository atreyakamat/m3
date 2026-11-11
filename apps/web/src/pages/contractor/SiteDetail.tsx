import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, Button } from '../../components/ui';
import { palette } from '../../lib/tokens';
import { WorkerDetailModal, AssignmentStatusBadge } from './WorkerDetailModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { TransferDetailModal } from './TransferDetailModal';

interface SiteDetailData {
  site: {
    id: string;
    siteCode: string;
    name: string;
    area: string;
    address?: string | null;
    landmark?: string | null;
    contactPhone?: string | null;
    contractorRole?: string | null;
    isPrimary?: boolean;
    active: boolean;
    createdAt?: string | null;
  };
  stats: {
    siteCode: string;
    siteName: string;
    totalWorkers: number;
    totalAssigned?: number;
    activeWorkers?: number;
    inactiveWorkers?: number;
    positive: number;
    negative: number;
    awaitingResults: number;
    noResultRecorded: number;
    lastUpdated: string;
  };
  activeWorkersCount?: number;
  inactiveWorkersCount?: number;
  canAssignWorkers?: boolean;
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
    endedAt?: string | null;
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
    direction?: string;
    originTown?: string | null;
    originState?: string | null;
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
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Workforce filter state
  const [workforceSearch, setWorkforceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ENDED'>('ALL');

  // End assignment modal state
  const [endWorkerTarget, setEndWorkerTarget] = useState<{ workerId: string; name: string } | null>(null);
  const [endReason, setEndReason] = useState('');
  const [endingAssignment, setEndingAssignment] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  const { data, loading, error, reload } = useAsync<SiteDetailData>(
    () => api.get(`/contractor/sites/${siteCode}/detail`),
    [siteCode],
  );

  async function handleConfirmEndAssignment() {
    if (!endWorkerTarget || !siteCode) return;
    setEndingAssignment(true);
    setActionMessage(null);

    try {
      await api.post(`/contractor/sites/${siteCode}/workers/${endWorkerTarget.workerId}/end-assignment`, {
        reason: endReason.trim() || undefined,
      });

      setActionMessage({
        kind: 'success',
        text: `Workforce assignment for ${endWorkerTarget.name} (${endWorkerTarget.workerId}) has been successfully ended.`,
      });
      setEndWorkerTarget(null);
      setEndReason('');
      reload();
    } catch (err: any) {
      setActionMessage({
        kind: 'danger',
        text: err?.message || 'Failed to end worker assignment.',
      });
    } finally {
      setEndingAssignment(false);
    }
  }

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

  // Filter workforce based on search and status
  const filteredWorkers = workers.filter((w) => {
    const isEnded = w.assignmentStatus === 'ENDED' || w.assignmentStatus === 'INACTIVE' || !!w.endedAt || w.active === false;
    const isActive = !isEnded;

    if (statusFilter === 'ACTIVE' && !isActive) return false;
    if (statusFilter === 'ENDED' && !isEnded) return false;

    if (!workforceSearch.trim()) return true;
    const query = workforceSearch.toLowerCase();
    const matchName = w.name.toLowerCase().includes(query);
    const matchId = w.workerId.toLowerCase().includes(query);
    const matchPhone = w.phone ? w.phone.includes(query) : false;
    return matchName || matchId || matchPhone;
  });

  const activeCount = data.activeWorkersCount ?? stats.activeWorkers ?? workers.filter((w) => w.assignmentStatus === 'ACTIVE' || (!w.endedAt && w.active !== false)).length;
  const inactiveCount = data.inactiveWorkersCount ?? stats.inactiveWorkers ?? workers.filter((w) => w.assignmentStatus === 'ENDED' || w.assignmentStatus === 'INACTIVE' || !!w.endedAt).length;
  const totalAssignedCount = stats.totalAssigned ?? stats.totalWorkers ?? workers.length;

  const contractorRoleLabel = site.contractorRole === 'PRIMARY' || site.isPrimary
    ? 'Primary Contractor'
    : 'Associated Site';

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Header & Navigation */}
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
          <div className="muted small" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span>Site Code: <strong style={{ fontFamily: 'monospace' }}>{site.siteCode}</strong></span>
            <span>·</span>
            <span>Area: <strong>{site.area}</strong></span>
            <span>·</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: site.active ? '#ECFDF5' : '#F1F5F9',
                color: site.active ? '#065F46' : '#64748B',
              }}
            >
              ● {site.active ? 'Operational' : 'Inactive'}
            </span>
            <span>·</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                background: '#EEF2FF',
                color: '#4338CA',
              }}
            >
              {contractorRoleLabel}
            </span>
          </div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Button
            onClick={() => setShowAssignModal(true)}
            style={{
              backgroundColor: '#2E7D32',
              borderColor: '#2E7D32',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            + Assign Worker to Site
          </Button>
          <Link to={`/contractor/workers?siteCode=${site.siteCode}`} style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Global Roster</Button>
          </Link>
          <Link to="/contractor" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </div>

      {actionMessage && (
        <Banner kind={actionMessage.kind}>
          {actionMessage.text}
        </Banner>
      )}

      {/* Workforce & Clinical Metrics Summary */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        <Card accent={palette.primary}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Active Workforce
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: palette.primary, marginTop: 4 }}>
            {activeCount}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            Currently deployed at site
          </div>
        </Card>

        <Card accent="#64748B">
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Ended / Inactive
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#64748B', marginTop: 4 }}>
            {inactiveCount}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            Assignments completed
          </div>
        </Card>

        <Card accent="#2E7D32">
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Verified Negative
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#2E7D32', marginTop: 4 }}>
            {stats.negative}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            Site aggregate cleared
          </div>
        </Card>

        <Card accent={stats.positive > 0 ? '#D32F2F' : palette.border}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Positive Cases
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: stats.positive > 0 ? '#D32F2F' : palette.text, marginTop: 4 }}>
            {stats.positive}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {stats.positive > 0 ? 'Under clinical management' : 'No active positives'}
          </div>
        </Card>

        <Card accent={palette.secondary}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
            Pending Tests
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: palette.secondary, marginTop: 4 }}>
            {stats.awaitingResults + stats.noResultRecorded}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {stats.awaitingResults} awaiting lab results
          </div>
        </Card>
      </div>

      {/* Site Master Details Card */}
      <Card>
        <div className="spread" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>Site Master Details</h3>
          <span className="muted small">Total Registered: <strong>{totalAssignedCount}</strong> workers</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div className="muted small">Operational Area / Region</div>
            <div style={{ fontWeight: 600, color: palette.text, marginTop: 4 }}>{site.area}</div>
          </div>
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div className="muted small">Site Identification Code</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 600, color: palette.text, marginTop: 4 }}>{site.siteCode}</div>
          </div>
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div className="muted small">Site Address & Landmark</div>
            <div style={{ fontWeight: 500, color: palette.text, marginTop: 4 }}>
              {[site.address, site.landmark].filter(Boolean).join(', ') || 'No address logged'}
            </div>
          </div>
          <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div className="muted small">Site Contact Phone</div>
            <div style={{ fontWeight: 500, color: palette.text, marginTop: 4 }}>{site.contactPhone || '—'}</div>
          </div>
        </div>
      </Card>

      {/* Section: Workforce Operations */}
      <Card>
        <div className="spread" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>Site Workforce Operations</h3>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Showing {filteredWorkers.length} of {workers.length} workers registered to this site
            </p>
          </div>
          <Button
            onClick={() => setShowAssignModal(true)}
            style={{
              backgroundColor: '#2E7D32',
              borderColor: '#2E7D32',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            + Assign Worker
          </Button>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            marginBottom: 16,
            padding: '12px 16px',
            background: '#F8FAFC',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            <input
              type="text"
              placeholder="Search site workforce (Name, ID, Phone)..."
              value={workforceSearch}
              onChange={(e) => setWorkforceSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === 'ALL' ? palette.primary : '#CBD5E1',
                background: statusFilter === 'ALL' ? palette.primary : '#FFFFFF',
                color: statusFilter === 'ALL' ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
              }}
            >
              All ({totalAssignedCount})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === 'ACTIVE' ? '#2E7D32' : '#CBD5E1',
                background: statusFilter === 'ACTIVE' ? '#2E7D32' : '#FFFFFF',
                color: statusFilter === 'ACTIVE' ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
              }}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('ENDED')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === 'ENDED' ? '#64748B' : '#CBD5E1',
                background: statusFilter === 'ENDED' ? '#64748B' : '#FFFFFF',
                color: statusFilter === 'ENDED' ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
              }}
            >
              Ended ({inactiveCount})
            </button>
          </div>

          {workforceSearch && (
            <button
              onClick={() => setWorkforceSearch('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear Search
            </button>
          )}
        </div>

        {filteredWorkers.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p className="muted" style={{ margin: 0 }}>
              {workforceSearch
                ? `No workers match "${workforceSearch}".`
                : statusFilter !== 'ALL'
                ? `No ${statusFilter.toLowerCase()} workers found at this site.`
                : 'No workers currently assigned to this construction site.'}
            </p>
            {workforceSearch && (
              <Button
                variant="secondary"
                onClick={() => setWorkforceSearch('')}
                style={{ marginTop: 12 }}
              >
                Clear Search Filter
              </Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>Worker Name</th>
                  <th style={{ padding: '10px 12px' }}>Worker ID</th>
                  <th style={{ padding: '10px 12px' }}>Phone / Demographics</th>
                  <th style={{ padding: '10px 12px' }}>Started At</th>
                  <th style={{ padding: '10px 12px' }}>Ended At</th>
                  <th style={{ padding: '10px 12px' }}>Assignment Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((w) => {
                  const isEnded = w.assignmentStatus === 'ENDED' || w.assignmentStatus === 'INACTIVE' || !!w.endedAt || w.active === false;
                  return (
                    <tr key={w.workerId} style={{ borderBottom: '1px solid #F1F5F9', background: isEnded ? '#FAFAFA' : undefined }}>
                      <td style={{ padding: '12px' }}>
                        <strong style={{ color: palette.text }}>{w.name}</strong>
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 13 }}>
                        {w.workerId}
                      </td>
                      <td style={{ padding: '12px', color: '#64748B', fontSize: 13 }}>
                        <div>{w.phone ?? 'No phone logged'}</div>
                        <div className="muted small">
                          {[w.age ? `${w.age} yrs` : null, w.gender].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#64748B', fontSize: 13 }}>
                        {w.startedAt ? new Date(w.startedAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#64748B', fontSize: 13 }}>
                        {w.endedAt ? new Date(w.endedAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <AssignmentStatusBadge status={isEnded ? 'ENDED' : 'ACTIVE'} />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
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
                          {!isEnded && (
                            <button
                              onClick={() => setEndWorkerTarget({ workerId: w.workerId, name: w.name })}
                              style={{
                                background: '#FFF1F2',
                                border: '1px solid #FECDD3',
                                borderRadius: 6,
                                padding: '4px 10px',
                                fontSize: 13,
                                cursor: 'pointer',
                                color: '#BE123C',
                                fontWeight: 600,
                              }}
                            >
                              End Assignment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section: Entry and Exit Activity */}
      <Card>
        <div className="spread" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>Worker Entry & Exit Activity</h3>
          <span className="muted small">{travels.length} surveillance movements</span>
        </div>
        <p className="muted small" style={{ margin: '0 0 16px' }}>
          Travel surveillance records and 7-day active surveillance notifications for site workforce
        </p>

        {travels.length === 0 ? (
          <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            No travel or movement records logged for workers at this site.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                  <th style={{ padding: '10px 12px' }}>Direction</th>
                  <th style={{ padding: '10px 12px' }}>Worker</th>
                  <th style={{ padding: '10px 12px' }}>Route / Location</th>
                  <th style={{ padding: '10px 12px' }}>Departure Date</th>
                  <th style={{ padding: '10px 12px' }}>Return Date</th>
                  <th style={{ padding: '10px 12px' }}>Surveillance Status</th>
                </tr>
              </thead>
              <tbody>
                {travels.map((t) => {
                  const isEntering = t.direction === 'ENTERING_GOA';
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9', background: t.isSevenDayAlert ? '#FEF2F2' : undefined }}>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isEntering ? '#DCFCE7' : '#FEF3C7',
                            color: isEntering ? '#166534' : '#92400E',
                          }}
                        >
                          {isEntering ? '↘ Entry into Goa' : '↗ Exit from Goa'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <strong style={{ color: palette.text }}>{t.workerName}</strong>
                        <div className="muted small" style={{ fontFamily: 'monospace' }}>{t.workerId}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {isEntering ? (
                          <div>
                            <span className="muted small">Origin: </span>
                            <strong>{[t.originTown, t.originState].filter(Boolean).join(', ') || 'Out of state'}</strong>
                          </div>
                        ) : (
                          <div>
                            <span className="muted small">Destination: </span>
                            <strong>{[t.destination, t.state].filter(Boolean).join(', ') || 'Hometown'}</strong>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: '#64748B' }}>
                        {t.departureDate ? new Date(t.departureDate).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#64748B' }}>
                        {t.returnDate ? new Date(t.returnDate).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {t.isSevenDayAlert ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 12,
                              background: '#FEE2E2',
                              color: '#DC2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            ⚠️ 7-Day Surveillance Alert
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 12,
                              background: '#F1F5F9',
                              color: '#475569',
                            }}
                          >
                            {t.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section: Site Transfers */}
      <Card>
        <div className="spread" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>Site Transfer Requests</h3>
          <Link
            to="/contractor/transfers"
            style={{ color: '#3D5A80', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
          >
            All Transfers Hub →
          </Link>
        </div>
        <p className="muted small" style={{ margin: '0 0 16px' }}>
          Inter-site transfer requests involving {site.name}
        </p>

        {transfers.length === 0 ? (
          <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
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
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
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
                            : tr.status.includes('ACCEPTED') || tr.status === 'COMPLETED'
                            ? '#ECFDF5'
                            : '#FEF3C7',
                          color: tr.status.includes('REJECTED')
                            ? '#DC2626'
                            : tr.status.includes('ACCEPTED') || tr.status === 'COMPLETED'
                            ? '#065F46'
                            : '#D97706',
                        }}
                      >
                        {tr.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#64748B', fontSize: 13 }}>
                      {new Date(tr.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedTransferId(tr.id)}
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
                        View Transfer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Direct Assignment Modal */}
      {showAssignModal && (
        <AssignWorkerModal
          isOpen={showAssignModal}
          siteCode={site.siteCode}
          siteName={site.name}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setShowAssignModal(false);
            setActionMessage({
              kind: 'success',
              text: 'Worker has been directly assigned to the workforce.',
            });
            reload();
          }}
        />
      )}

      {/* End Assignment Confirmation Modal */}
      {endWorkerTarget && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !endingAssignment && setEndWorkerTarget(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#991B1B' }}>
                End Workforce Assignment
              </h3>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                Confirm deactivation of worker assignment at this site
              </p>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 16px', color: palette.text, lineHeight: 1.5 }}>
                Are you sure you want to end the active assignment for{' '}
                <strong>{endWorkerTarget.name}</strong> ({endWorkerTarget.workerId}) at{' '}
                <strong>{site.name}</strong>?
              </p>

              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 16,
                  fontSize: 13,
                  color: '#475569',
                }}
              >
                ℹ️ The worker will be recorded as ended, retaining their historical logs. They will become eligible for future deployment or transfers.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Reason for Ending Assignment (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project phase completed, worker released"
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  disabled={endingAssignment}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '16px 24px',
                background: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setEndWorkerTarget(null)}
                disabled={endingAssignment}
              >
                Cancel
              </Button>
              <button
                onClick={handleConfirmEndAssignment}
                disabled={endingAssignment}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: endingAssignment ? 'not-allowed' : 'pointer',
                  opacity: endingAssignment ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {endingAssignment && <Spinner />}
                Confirm End Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Worker Detail Modal */}
      {selectedWorkerCode && (
        <WorkerDetailModal
          workerCode={selectedWorkerCode}
          onClose={() => setSelectedWorkerCode(null)}
        />
      )}

      {/* Reusable Transfer Detail Modal */}
      {selectedTransferId && (
        <TransferDetailModal
          transferId={selectedTransferId}
          onClose={() => setSelectedTransferId(null)}
          onActionSuccess={() => {
            setSelectedTransferId(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
