import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, Button } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface AlertItem {
  id: string;
  type: string;
  category: 'HEALTH_REPORT' | 'TRANSFER_REQUEST' | 'WORKFORCE_ASSIGNMENT' | 'TRAVEL_SURVEILLANCE' | 'GENERAL';
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  workerId: string | null;
  workerName: string | null;
  siteCode: string | null;
  siteName: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  actionUrl: string;
  healthCoordination?: {
    facilityName: string;
    facilityCode: string;
    contactPhone: string;
    taluka?: string;
    actionNotice: string;
  };
}

interface AlertsResponse {
  items: AlertItem[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function AlertsCenter() {
  const nav = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const pageSize = 12;

  const { data, loading, error, reload } = useAsync<AlertsResponse>(
    () => {
      const q = new URLSearchParams();
      if (statusFilter !== 'ALL') q.set('status', statusFilter);
      if (categoryFilter !== 'ALL') q.set('category', categoryFilter);
      q.set('page', String(page));
      q.set('pageSize', String(pageSize));
      return api.get(`/contractor/alerts?${q.toString()}`);
    },
    [statusFilter, categoryFilter, page],
  );

  async function handleMarkRead(alertId: string) {
    try {
      await api.post(`/contractor/alerts/${alertId}/read`);
      setActionSuccess('Alert marked as read.');
      reload();
    } catch (err: any) {
      console.error('Failed to mark alert as read:', err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.post('/contractor/alerts/read-all');
      setActionSuccess('All alerts marked as read.');
      reload();
    } catch (err: any) {
      console.error('Failed to mark all alerts as read:', err);
    }
  }

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Page Header */}
      <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 24, color: palette.text }}>
              Operational Alerts & Surveillance Notices
            </h2>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#DC2626',
                  color: '#FFF',
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Real-time health alerts, transfer requirements, and workforce assignment updates
          </p>
        </div>

        <div className="row" style={{ gap: 12 }}>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              onClick={handleMarkAllRead}
              style={{ fontWeight: 600 }}
            >
              ✓ Mark All as Read
            </Button>
          )}
          <Link to="/contractor/activity" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Worker Activity</Button>
          </Link>
          <Link to="/contractor" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <Banner kind="success">
          {actionSuccess}
        </Banner>
      )}

      {/* Filter Tabs & Categories */}
      <Card>
        <div className="stack" style={{ gap: 14 }}>
          {/* Status Tabs (All, Unread, Read) */}
          <div className="spread" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setPage(1);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: statusFilter === 'ALL' ? palette.primary : '#CBD5E1',
                  background: statusFilter === 'ALL' ? palette.primary : '#FFF',
                  color: statusFilter === 'ALL' ? '#FFF' : '#475569',
                  cursor: 'pointer',
                }}
              >
                All Alerts ({data?.total ?? 0})
              </button>
              <button
                onClick={() => {
                  setStatusFilter('UNREAD');
                  setPage(1);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: statusFilter === 'UNREAD' ? '#DC2626' : '#CBD5E1',
                  background: statusFilter === 'UNREAD' ? '#DC2626' : '#FFF',
                  color: statusFilter === 'UNREAD' ? '#FFF' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => {
                  setStatusFilter('READ');
                  setPage(1);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: statusFilter === 'READ' ? '#64748B' : '#CBD5E1',
                  background: statusFilter === 'READ' ? '#64748B' : '#FFF',
                  color: statusFilter === 'READ' ? '#FFF' : '#475569',
                  cursor: 'pointer',
                }}
              >
                Read
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
            <span className="muted small" style={{ alignSelf: 'center', marginRight: 4, fontWeight: 600 }}>
              Category:
            </span>
            {[
              { id: 'ALL', label: 'All Categories' },
              { id: 'HEALTH_REPORT', label: '⚠️ Health & Unwell Alerts' },
              { id: 'TRANSFER_REQUEST', label: '⇄ Transfer Requests' },
              { id: 'WORKFORCE_ASSIGNMENT', label: '👥 Workforce Assignments' },
              { id: 'TRAVEL_SURVEILLANCE', label: '✈️ Travel Movements' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategoryFilter(cat.id);
                  setPage(1);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: categoryFilter === cat.id ? '#3D5A80' : '#E2E8F0',
                  background: categoryFilter === cat.id ? '#3D5A80' : '#F8FAFC',
                  color: categoryFilter === cat.id ? '#FFF' : '#64748B',
                  cursor: 'pointer',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Alerts List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spinner />
          <p className="muted" style={{ marginTop: 12 }}>Loading operational alerts…</p>
        </div>
      ) : error ? (
        <div className="stack" style={{ gap: 16 }}>
          <Banner kind="danger">{error || 'Failed to load operational alerts.'}</Banner>
          <div>
            <Button onClick={reload}>Retry</Button>
          </div>
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>No Operational Alerts</h3>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              {statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'No alerts match your selected filters.'
                : 'Your operational notification inbox is clear.'}
            </p>
            {(statusFilter !== 'ALL' || categoryFilter !== 'ALL') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setPage(1);
                }}
                style={{ marginTop: 14 }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {data.items.map((alert) => {
            const isHealthAlert = alert.category === 'HEALTH_REPORT';
            const isTransferAlert = alert.category === 'TRANSFER_REQUEST';
            const isUnread = !alert.read;

            return (
              <div
                key={alert.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                  border: '1px solid',
                  borderColor: isHealthAlert
                    ? '#FCA5A5'
                    : isUnread
                    ? '#CBD5E1'
                    : '#E2E8F0',
                  borderLeftWidth: 6,
                  borderLeftColor: isHealthAlert
                    ? '#DC2626'
                    : isTransferAlert
                    ? '#7E22CE'
                    : alert.category === 'WORKFORCE_ASSIGNMENT'
                    ? '#2563EB'
                    : '#64748B',
                  padding: '18px 20px',
                  position: 'relative',
                }}
              >
                {/* Header row */}
                <div className="spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <CategoryBadge category={alert.category} />
                    {isUnread && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#DC2626',
                          display: 'inline-block',
                        }}
                      />
                    )}
                    <h3 style={{ margin: 0, fontSize: 16, color: palette.text }}>
                      {alert.title}
                    </h3>
                  </div>

                  <span className="muted small" style={{ fontSize: 12 }}>
                    {new Date(alert.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Worker & Site Meta */}
                {(alert.workerName || alert.siteName) && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginTop: 8,
                      fontSize: 13,
                      color: '#475569',
                      flexWrap: 'wrap',
                    }}
                  >
                    {alert.workerName && (
                      <div>
                        Worker: <strong style={{ color: palette.text }}>{alert.workerName}</strong>
                        {alert.workerId && (
                          <span className="muted small" style={{ fontFamily: 'monospace', marginLeft: 4 }}>
                            ({alert.workerId})
                          </span>
                        )}
                      </div>
                    )}
                    {alert.siteName && (
                      <div>
                        Site: <strong style={{ color: palette.text }}>{alert.siteName}</strong>
                        {alert.siteCode && (
                          <span className="muted small" style={{ fontFamily: 'monospace', marginLeft: 4 }}>
                            [{alert.siteCode}]
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Alert Body */}
                <p style={{ margin: '8px 0 0', color: palette.text, fontSize: 14, lineHeight: 1.5 }}>
                  {alert.body}
                </p>

                {/* Health Coordination Guidance (for Symptom Reports) */}
                {isHealthAlert && alert.healthCoordination && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 16px',
                      background: '#FEF2F2',
                      borderRadius: 8,
                      border: '1px solid #FECDD3',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#991B1B', fontSize: 13, marginBottom: 4 }}>
                      🏥 Health Team Coordination Action Required
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#7F1D1D' }}>
                      {alert.healthCoordination.actionNotice}
                    </p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: '#991B1B' }}>
                        Local Facility: <strong>{alert.healthCoordination.facilityName}</strong>
                        {alert.healthCoordination.taluka && ` (${alert.healthCoordination.taluka})`}
                      </div>
                      <div style={{ fontSize: 13, color: '#991B1B' }}>
                        Surveillance Phone: <strong>{alert.healthCoordination.contactPhone}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid #F1F5F9',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    {isHealthAlert && alert.healthCoordination?.contactPhone && (
                      <a
                        href={`tel:${alert.healthCoordination.contactPhone}`}
                        style={{
                          textDecoration: 'none',
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: '#DC2626',
                          color: '#FFF',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        📞 Call Health Facility
                      </a>
                    )}
                    {alert.actionUrl && (
                      <Button
                        variant="secondary"
                        onClick={() => nav(alert.actionUrl)}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        {isHealthAlert
                          ? 'View Site Workforce →'
                          : isTransferAlert
                          ? 'Review Transfer Requests →'
                          : 'View Record →'}
                      </Button>
                    )}
                  </div>

                  <div>
                    {isUnread ? (
                      <button
                        onClick={() => handleMarkRead(alert.id)}
                        style={{
                          background: 'none',
                          border: '1px solid #CBD5E1',
                          borderRadius: 6,
                          padding: '5px 12px',
                          fontSize: 12,
                          color: '#475569',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Mark as Read
                      </button>
                    ) : (
                      <span className="muted small">
                        ✓ Read {alert.readAt ? new Date(alert.readAt).toLocaleDateString() : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="spread" style={{ marginTop: 12 }}>
              <Button
                variant="secondary"
                disabled={data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </Button>
              <span className="muted small">
                Page {data.page} of {data.totalPages}
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
        </div>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  switch (category) {
    case 'HEALTH_REPORT':
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: '#FEE2E2',
            color: '#DC2626',
          }}
        >
          HEALTH ALERT
        </span>
      );
    case 'TRANSFER_REQUEST':
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: '#F3E8FF',
            color: '#7E22CE',
          }}
        >
          TRANSFER REQUEST
        </span>
      );
    case 'WORKFORCE_ASSIGNMENT':
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: '#DBEAFE',
            color: '#1D4ED8',
          }}
        >
          ASSIGNMENT
        </span>
      );
    case 'TRAVEL_SURVEILLANCE':
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            background: '#FEF3C7',
            color: '#D97706',
          }}
        >
          TRAVEL MOVEMENT
        </span>
      );
    default:
      return (
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: '#F1F5F9',
            color: '#475569',
          }}
        >
          OPERATIONAL
        </span>
      );
  }
}
