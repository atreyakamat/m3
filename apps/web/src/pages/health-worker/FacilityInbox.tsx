import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';

export function FacilityInboxPage() {
  const [facilityName, setFacilityName] = useState<string>('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [filter, setFilter] = useState<'ALL' | 'UNACK' | 'POSITIVE' | 'ARRIVAL'>('ALL');

  // Action Modal State
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const [actionText, setActionText] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await api.get<any>('/health-worker/me');
      const fid = profile.activeFacilityId || profile.assignedFacilities?.[0]?.facilityId;
      if (!fid) {
        setError('No active facility assigned.');
        setLoading(false);
        return;
      }
      const fac = profile.assignedFacilities?.find((f: any) => f.facilityId === fid);
      setFacilityName(fac?.facility?.name || 'Assigned Facility');

      const data = await api.get<{
        notifications: any[];
        unreadCount: number;
        unacknowledgedCount: number;
      }>(`/health-worker/inbox?facilityId=${fid}`);

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setUnacknowledgedCount(data.unacknowledgedCount || 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load facility inbox');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAcknowledge = async (id: string) => {
    try {
      await api.post(`/health-worker/inbox/${id}/acknowledge`, {});
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to acknowledge notification');
    }
  };

  const openActionModal = (notif: any) => {
    setSelectedNotif(notif);
    setActionText('');
    setActionError(null);
  };

  const handleActionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedNotif || !actionText.trim()) return;

    setActionSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/health-worker/inbox/${selectedNotif.id}/action`, {
        actionTaken: actionText.trim(),
      });
      setSelectedNotif(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to save action');
    } finally {
      setActionSubmitting(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNACK') return !n.acknowledgedAt;
    if (filter === 'POSITIVE') return n.type === 'POSITIVE_MALARIA_RESULT';
    if (filter === 'ARRIVAL') return n.type === 'ARRIVAL_SCREENING_FLAG';
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Facility Clinical Inbox</h2>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
            Facility: <strong>{facilityName}</strong> • {unacknowledgedCount} pending acknowledgment ({unreadCount} unread)
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Refresh Inbox
        </button>
      </div>

      {error && (
        <div className="panel" style={{ background: '#FEE2E2', color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter('ALL')}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: filter === 'ALL' ? '2px solid #006699' : '1px solid #CBD5E1',
            background: filter === 'ALL' ? '#F0F9FF' : '#fff',
            color: filter === 'ALL' ? '#0369A1' : '#475569',
            fontWeight: filter === 'ALL' ? 600 : 400,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNACK')}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: filter === 'UNACK' ? '2px solid #D97706' : '1px solid #CBD5E1',
            background: filter === 'UNACK' ? '#FFFBEB' : '#fff',
            color: filter === 'UNACK' ? '#92400E' : '#475569',
            fontWeight: filter === 'UNACK' ? 600 : 400,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Pending Ack ({unacknowledgedCount})
        </button>
        <button
          onClick={() => setFilter('POSITIVE')}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: filter === 'POSITIVE' ? '2px solid #DC2626' : '1px solid #CBD5E1',
            background: filter === 'POSITIVE' ? '#FEF2F2' : '#fff',
            color: filter === 'POSITIVE' ? '#991B1B' : '#475569',
            fontWeight: filter === 'POSITIVE' ? 600 : 400,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Positive Cases
        </button>
        <button
          onClick={() => setFilter('ARRIVAL')}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: filter === 'ARRIVAL' ? '2px solid #4F46E5' : '1px solid #CBD5E1',
            background: filter === 'ARRIVAL' ? '#EEF2FF' : '#fff',
            color: filter === 'ARRIVAL' ? '#3730A3' : '#475569',
            fontWeight: filter === 'ARRIVAL' ? 600 : 400,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Arrival Flags
        </button>
      </div>

      {loading ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          Loading facility notification inbox...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1F4EC;</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>No Notifications Found</div>
          <div style={{ fontSize: 13 }}>No facility notifications match the selected filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredNotifications.map((notif) => {
            const isPos = notif.type === 'POSITIVE_MALARIA_RESULT';
            const isAck = Boolean(notif.acknowledgedAt);
            const hasAction = Boolean(notif.actionTaken);

            return (
              <div
                key={notif.id}
                className="panel"
                style={{
                  borderLeft: isPos ? '4px solid #DC2626' : '4px solid #3B82F6',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        background: isPos ? '#FEE2E2' : '#EFF6FF',
                        color: isPos ? '#991B1B' : '#1E40AF',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {isPos ? 'CONFIRMED POSITIVE' : notif.type.replace(/_/g, ' ')}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{notif.title}</h3>
                  </div>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ''}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
                  {notif.body}
                </p>

                {hasAction && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 13,
                    }}
                  >
                    <strong style={{ color: '#0F172A' }}>Action Taken:</strong> {notif.actionTaken}
                    {notif.actionTakenAt && (
                      <span style={{ color: '#64748B', fontSize: 11, marginLeft: 8 }}>
                        ({new Date(notif.actionTakenAt).toLocaleString()})
                      </span>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 8,
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    {isAck ? (
                      <span style={{ color: '#166534', fontWeight: 600 }}>
                        ✓ Acknowledged {notif.acknowledgedAt ? new Date(notif.acknowledgedAt).toLocaleDateString() : ''}
                      </span>
                    ) : (
                      <span style={{ color: '#D97706', fontWeight: 600 }}>
                        Pending Acknowledgment
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isAck && (
                      <button
                        onClick={() => handleAcknowledge(notif.id)}
                        style={{
                          background: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          borderRadius: 4,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => openActionModal(notif)}
                      style={{
                        background: '#006699',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {hasAction ? 'Update Action' : 'Record Action'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Action Modal */}
      {selectedNotif && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#fff',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Record Clinical Action Taken
            </h3>
            <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>
              Notification: <strong>{selectedNotif.title}</strong>
            </p>

            {actionError && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleActionSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Action Taken / Clinical Intervention Details
                </label>
                <textarea
                  rows={4}
                  required
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  placeholder="e.g. Dispatched field surveillance team; scheduled ACT treatment verification; contacted construction site supervisor..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  style={{
                    background: '#F1F5F9',
                    color: '#334155',
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  style={{
                    background: '#006699',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {actionSubmitting ? 'Saving...' : 'Save Clinical Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
