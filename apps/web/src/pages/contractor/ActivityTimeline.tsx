import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, Button, TextField } from '../../components/ui';
import { palette } from '../../lib/tokens';
import { WorkerDetailModal } from './WorkerDetailModal';

interface ActivityItem {
  id: string;
  eventType: string;
  title: string;
  description: string;
  timestamp: string;
  workerId: string;
  workerName: string;
  siteCode: string | null;
  siteName: string | null;
  status: string;
  details?: {
    direction?: string;
    route?: string;
    fromSite?: string;
    toSite?: string;
    assignmentId?: string;
    transferId?: string;
  };
}

interface ActivityResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ContractorSiteOption {
  siteCode: string;
  name: string;
}

export function ActivityTimeline() {
  const [selectedWorkerCode, setSelectedWorkerCode] = useState<string | null>(null);

  // Filters
  const [eventType, setEventType] = useState('ALL');
  const [siteCode, setSiteCode] = useState('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Load sites for filter
  const { data: rawSites } = useAsync<any>(
    () => api.get('/contractor/sites'),
    [],
  );
  const sitesList: ContractorSiteOption[] = Array.isArray(rawSites)
    ? rawSites
    : Array.isArray(rawSites?.sites)
    ? rawSites.sites
    : [];

  // Load activity timeline
  const { data, loading, error, reload } = useAsync<ActivityResponse>(
    () => {
      const q = new URLSearchParams();
      if (eventType !== 'ALL') q.set('type', eventType);
      if (siteCode !== 'ALL') q.set('siteCode', siteCode);
      if (search.trim()) q.set('search', search.trim());
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);
      q.set('page', String(page));
      q.set('pageSize', String(pageSize));
      return api.get(`/contractor/activity?${q.toString()}`);
    },
    [eventType, siteCode, search, startDate, endDate, page],
  );

  function resetFilters() {
    setEventType('ALL');
    setSiteCode('ALL');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  const hasActiveFilters = eventType !== 'ALL' || siteCode !== 'ALL' || search || startDate || endDate;

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Page Header */}
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: palette.text }}>Worker Activity Timeline</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Authorised operational movements, workforce assignments, and transfer milestones for your workforce
          </p>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <Link to="/contractor/alerts" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Operational Alerts</Button>
          </Link>
          <Link to="/contractor" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar Card */}
      <Card>
        <div className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            {/* Search */}
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Worker Search
              </label>
              <TextField
                placeholder="Worker name or ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Event Type Filter */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Event Category / Type
              </label>
              <select
                aria-label="Event Category / Type"
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                  background: '#FFF',
                }}
              >
                <option value="ALL">All Event Types</option>
                <option value="TRAVEL">All Travel Movements</option>
                <option value="ENTRY_GOA">↘ Entry into Goa</option>
                <option value="EXIT_GOA">↗ Exit from Goa</option>
                <option value="ASSIGNMENT">Workforce Assignments</option>
                <option value="ASSIGNMENT_STARTED">Assignment Started</option>
                <option value="ASSIGNMENT_ENDED">Assignment Ended</option>
                <option value="TRANSFER">Site Transfers (All)</option>
                <option value="TRANSFER_REQUESTED">Transfer Requested</option>
                <option value="TRANSFER_WORKER_RESPONSE">Worker Response</option>
                <option value="TRANSFER_APPROVED">Transfer Approved</option>
                <option value="TRANSFER_COMPLETED">Transfer Completed</option>
              </select>
            </div>

            {/* Site Filter */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Construction Site
              </label>
              <select
                value={siteCode}
                onChange={(e) => {
                  setSiteCode(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                  background: '#FFF',
                }}
              >
                <option value="ALL">All Assigned Sites</option>
                {sitesList.map((s) => (
                  <option key={s.siteCode} value={s.siteCode}>
                    {s.name} ({s.siteCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range: From */}
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Date Range: To */}
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {hasActiveFilters && (
              <div style={{ alignSelf: 'flex-end' }}>
                <Button variant="secondary" onClick={resetFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Main Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spinner />
          <p className="muted" style={{ marginTop: 12 }}>Loading worker activity timeline…</p>
        </div>
      ) : error ? (
        <div className="stack" style={{ gap: 16 }}>
          <Banner kind="danger">{error || 'Failed to load activity timeline.'}</Banner>
          <div>
            <Button onClick={reload}>Retry</Button>
          </div>
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <p className="muted" style={{ fontSize: 15, margin: 0 }}>
              {hasActiveFilters
                ? 'No worker activities matched your filter criteria.'
                : 'No worker activities logged yet for your managed workforce.'}
            </p>
            {hasActiveFilters && (
              <Button variant="secondary" onClick={resetFilters} style={{ marginTop: 16 }}>
                Reset All Filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {/* Timeline Feed Card */}
          <Card>
            <div className="spread" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>
                Activity Stream ({data.total} recorded events)
              </h3>
              <span className="muted small">
                Page {data.page} of {data.totalPages}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                    <th style={{ padding: '10px 12px' }}>Event Type</th>
                    <th style={{ padding: '10px 12px' }}>Worker</th>
                    <th style={{ padding: '10px 12px' }}>Description / Route</th>
                    <th style={{ padding: '10px 12px' }}>Relevant Site</th>
                    <th style={{ padding: '10px 12px' }}>Date & Time</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      {/* Event Type Badge */}
                      <td style={{ padding: '12px' }}>
                        <EventTypeBadge eventType={item.eventType} />
                      </td>

                      {/* Worker */}
                      <td style={{ padding: '12px' }}>
                        <strong style={{ color: palette.text }}>{item.workerName}</strong>
                        <div className="muted small" style={{ fontFamily: 'monospace' }}>
                          {item.workerId}
                        </div>
                      </td>

                      {/* Description / Route */}
                      <td style={{ padding: '12px', maxWidth: 300 }}>
                        <div style={{ color: palette.text, fontSize: 14 }}>{item.description}</div>
                        {item.details?.route && (
                          <div className="muted small" style={{ marginTop: 2 }}>
                            Route: <strong>{item.details.route}</strong>
                          </div>
                        )}
                      </td>

                      {/* Site */}
                      <td style={{ padding: '12px' }}>
                        {item.siteName ? (
                          <div>
                            <span style={{ fontWeight: 600, color: palette.text }}>{item.siteName}</span>
                            <div className="muted small" style={{ fontFamily: 'monospace' }}>
                              {item.siteCode}
                            </div>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: '12px', color: '#64748B', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {new Date(item.timestamp).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: item.status.includes('REJECT')
                              ? '#FEE2E2'
                              : item.status.includes('ACCEPT') || item.status === 'COMPLETED' || item.status === 'ACTIVE'
                              ? '#ECFDF5'
                              : '#F1F5F9',
                            color: item.status.includes('REJECT')
                              ? '#DC2626'
                              : item.status.includes('ACCEPT') || item.status === 'COMPLETED' || item.status === 'ACTIVE'
                              ? '#065F46'
                              : '#475569',
                          }}
                        >
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedWorkerCode(item.workerId)}
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
                          View Worker
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data.totalPages > 1 && (
              <div className="spread" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                <Button
                  variant="secondary"
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </Button>
                <span className="muted small">
                  Page {data.page} of {data.totalPages} ({data.total} total events)
                </span>
                <Button
                  variant="secondary"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                >
                  Next →
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Authorized Worker Details Modal */}
      {selectedWorkerCode && (
        <WorkerDetailModal
          workerCode={selectedWorkerCode}
          onClose={() => setSelectedWorkerCode(null)}
        />
      )}
    </div>
  );
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  switch (eventType) {
    case 'ENTRY_GOA':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#DCFCE7',
            color: '#15803D',
          }}
        >
          ↘ Entered Goa
        </span>
      );
    case 'EXIT_GOA':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#FEF3C7',
            color: '#B45309',
          }}
        >
          ↗ Exited Goa
        </span>
      );
    case 'ASSIGNMENT_STARTED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#EEF2FF',
            color: '#4338CA',
          }}
        >
          ✓ Assigned to Site
        </span>
      );
    case 'ASSIGNMENT_ENDED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#F1F5F9',
            color: '#475569',
          }}
        >
          ✕ Assignment Ended
        </span>
      );
    case 'TRANSFER_REQUESTED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#F3E8FF',
            color: '#7E22CE',
          }}
        >
          ⇄ Transfer Requested
        </span>
      );
    case 'TRANSFER_WORKER_RESPONSE':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#E0E7FF',
            color: '#3730A3',
          }}
        >
          👤 Worker Response
        </span>
      );
    case 'TRANSFER_APPROVED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#ECFDF5',
            color: '#065F46',
          }}
        >
          ✓ Transfer Approved
        </span>
      );
    case 'TRANSFER_REJECTED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          ✕ Transfer Declined
        </span>
      );
    case 'TRANSFER_COMPLETED':
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            background: '#CCFBF1',
            color: '#0F766E',
          }}
        >
          ★ Transfer Completed
        </span>
      );
    default:
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: '#F1F5F9',
            color: '#475569',
          }}
        >
          {eventType.replace(/_/g, ' ')}
        </span>
      );
  }
}
