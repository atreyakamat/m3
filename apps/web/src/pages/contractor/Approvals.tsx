import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Spinner, Banner, TextField, Select } from '../../components/ui';
import { TransferStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';
import { TransferDetailModal } from './TransferDetailModal';
import { InitiateTransferModal } from './InitiateTransferModal';

export interface TransferListItem {
  id: string;
  transferId: string;
  workerId: string;
  workerName: string;
  fromSite: { id: string; siteCode: string; name: string } | null;
  toSite: { id: string; siteCode: string; name: string };
  currentSite: { siteId: string; name: string } | null;
  destinationSite: { siteId: string; name: string };
  fromContractor: { id: string; name: string } | null;
  toContractor: { id: string; name: string } | null;
  initiator: 'WORKER' | 'CONTRACTOR';
  initiatorType: 'WORKER' | 'CONTRACTOR';
  status: string;
  workerDecision: string;
  toContractorDecision: string;
  fromContractorDecision: string;
  createdAt: string;
  effectiveAt: string | null;
  cancelledAt: string | null;
  requiredNextAction: string;
  canApproveDestination: boolean;
  canReleaseWorker: boolean;
  canCancel: boolean;
  isActionableByMe: boolean;
}

interface TransfersResponse {
  items: TransferListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All Requests' },
  { value: 'PENDING_APPROVAL', label: 'Pending Destination Approval' },
  { value: 'PENDING_WORKER_RESPONSE', label: 'Pending Worker Response' },
  { value: 'PENDING_CURRENT_RELEASE', label: 'Pending Current Release' },
  { value: 'APPROVED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function Approvals() {
  const [data, setData] = useState<TransfersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [quickActingId, setQuickActingId] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
      });
      if (appliedSearch) {
        q.set('search', appliedSearch);
      }

      const res = await api.get<TransfersResponse>(`/contractor/transfers?${q.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load transfer requests');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, appliedSearch]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function handleClearFilters() {
    setStatusFilter('ALL');
    setSearch('');
    setAppliedSearch('');
    setPage(1);
  }

  async function handleQuickAction(transferId: string, action: 'approve' | 'release') {
    setQuickActingId(transferId);
    setBanner(null);
    try {
      const endpoint =
        action === 'approve'
          ? `/contractor/transfers/${transferId}/approve`
          : `/contractor/transfers/${transferId}/release`;

      await api.post(endpoint, {});
      setBanner({
        kind: 'success',
        text:
          action === 'approve'
            ? 'Destination request approved. Releasing contractor notified.'
            : 'Worker successfully released to destination site.',
      });
      await fetchTransfers();
    } catch (err: any) {
      setBanner({ kind: 'danger', text: err?.message || 'Failed to perform action' });
    } finally {
      setQuickActingId(null);
    }
  }

  const isFiltered = statusFilter !== 'ALL' || appliedSearch !== '';

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Header Card */}
      <Card accent={palette.secondary}>
        <div className="spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color: palette.text }}>Transfer Requests</h1>
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Review inter-site transfer requests, record destination approvals, and release departing workers.
            </p>
          </div>
          <Button onClick={() => setShowInitiateModal(true)}>+ Initiate Transfer</Button>
        </div>
      </Card>

      {banner && <Banner kind={banner.kind}>{banner.text}</Banner>}
      {error && <Banner kind="danger">{error}</Banner>}

      {/* Filter and Search Bar */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {/* Status Filter Dropdown */}
          <div style={{ minWidth: 220 }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Search Form */}
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: 'flex', flex: 1, minWidth: 260, gap: 8 }}
          >
            <TextField
              placeholder="Search by worker name, worker ID, or site code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          {isFiltered && (
            <Button variant="secondary" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Transfers Data Table */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spinner />
            <p className="muted small" style={{ marginTop: 8 }}>Loading transfer requests…</p>
          </div>
        ) : (data?.items?.length ?? 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p className="muted" style={{ fontSize: 16 }}>
              {isFiltered ? 'No transfer requests match your filters.' : 'No transfer requests found.'}
            </p>
            {isFiltered && (
              <Button variant="secondary" onClick={handleClearFilters} style={{ marginTop: 8 }}>
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: 12, textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 10px' }}>Transfer ID</th>
                  <th style={{ padding: '12px 10px' }}>Worker Name</th>
                  <th style={{ padding: '12px 10px' }}>Worker ID</th>
                  <th style={{ padding: '12px 10px' }}>Current Site</th>
                  <th style={{ padding: '12px 10px' }}>Destination Site</th>
                  <th style={{ padding: '12px 10px' }}>Initiator</th>
                  <th style={{ padding: '12px 10px' }}>Request Date</th>
                  <th style={{ padding: '12px 10px' }}>Current Status</th>
                  <th style={{ padding: '12px 10px' }}>Required Next Action</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((t) => {
                  const isQuickActing = quickActingId === t.id;

                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Transfer ID */}
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>
                        {t.id.slice(0, 8)}…
                      </td>

                      {/* Worker Name */}
                      <td style={{ padding: '12px 10px', fontWeight: 600, color: palette.text }}>
                        {t.workerName}
                      </td>

                      {/* Worker ID */}
                      <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontSize: 12, color: '#334155' }}>
                        {t.workerId}
                      </td>

                      {/* Current Site */}
                      <td style={{ padding: '12px 10px', fontSize: 13 }}>
                        <div>{t.fromSite?.name ?? 'No Site Assigned'}</div>
                        <span className="muted small" style={{ fontFamily: 'monospace' }}>
                          {t.fromSite?.siteCode ?? '—'}
                        </span>
                      </td>

                      {/* Destination Site */}
                      <td style={{ padding: '12px 10px', fontSize: 13 }}>
                        <div style={{ fontWeight: 500 }}>{t.toSite.name}</div>
                        <span className="muted small" style={{ fontFamily: 'monospace' }}>
                          {t.toSite.siteCode}
                        </span>
                      </td>

                      {/* Initiator */}
                      <td style={{ padding: '12px 10px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: t.initiatorType === 'WORKER' ? '#EFF6FF' : '#F5F3FF',
                            color: t.initiatorType === 'WORKER' ? '#1D4ED8' : '#6D28D9',
                          }}
                        >
                          {t.initiatorType === 'WORKER' ? 'Worker' : 'Contractor'}
                        </span>
                      </td>

                      {/* Request Date */}
                      <td style={{ padding: '12px 10px', fontSize: 13, color: '#64748B' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>

                      {/* Current Status */}
                      <td style={{ padding: '12px 10px' }}>
                        <TransferStatusChip status={t.status as any} />
                      </td>

                      {/* Required Next Action */}
                      <td style={{ padding: '12px 10px', fontSize: 13 }}>
                        <span
                          style={{
                            fontWeight: t.isActionableByMe ? 600 : 400,
                            color: t.isActionableByMe ? '#B45309' : '#475569',
                          }}
                        >
                          {t.requiredNextAction}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {t.canApproveDestination && (
                            <Button
                              disabled={isQuickActing}
                              onClick={() => handleQuickAction(t.id, 'approve')}
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                background: '#16A34A',
                                borderColor: '#16A34A',
                              }}
                            >
                              Approve
                            </Button>
                          )}

                          {t.canReleaseWorker && (
                            <Button
                              disabled={isQuickActing}
                              onClick={() => handleQuickAction(t.id, 'release')}
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                background: '#2563EB',
                                borderColor: '#2563EB',
                              }}
                            >
                              Release
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            onClick={() => setSelectedTransferId(t.id)}
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            View Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Controls */}
        {data && data.totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid #E2E8F0',
            }}
          >
            <div className="muted small">
              Showing {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.total)} of {data.total} transfer requests
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                variant="secondary"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                ← Previous
              </Button>
              <span className="small" style={{ fontWeight: 600, color: '#475569' }}>
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transfer Detail Modal */}
      <TransferDetailModal
        transferId={selectedTransferId}
        onClose={() => setSelectedTransferId(null)}
        onActionSuccess={() => {
          fetchTransfers();
        }}
      />

      {/* Initiate Transfer Modal */}
      <InitiateTransferModal
        isOpen={showInitiateModal}
        onClose={() => setShowInitiateModal(false)}
        onSuccess={() => {
          setBanner({
            kind: 'success',
            text: 'Transfer request created successfully.',
          });
          fetchTransfers();
        }}
      />
    </div>
  );
}
