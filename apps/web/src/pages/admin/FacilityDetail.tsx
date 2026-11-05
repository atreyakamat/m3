import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import {
  ActiveChip,
  AdminChip,
  DataTable,
  ListBody,
  SectionCard,
  type Column,
} from '../../components/admin';
import { Button, Card, Modal } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface StaffAssignment {
  id: string;
  facilityId: string;
  userId: string;
  role: 'HEALTH_WORKER' | 'CLINICIAN';
  active: boolean;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    phone: string;
    email: string | null;
    role: string;
  };
}

interface FacilityNotification {
  id: string;
  notificationId: string;
  title: string;
  body: string;
  priority: string;
  status: string;
  acknowledgedAt: string | null;
  actionTaken: string | null;
  createdAt: string;
}

interface NearbyClinician {
  clinicianId: string;
  name: string;
  phone: string;
  facilityName?: string;
  taluka?: string;
  activeAssignments?: Array<{
    facilityId: string;
    facilityName: string;
    type: string;
    taluka: string;
  }>;
  distanceKm: number | null;
  isSameTaluka?: boolean;
}

interface FacilityDetail {
  id: string;
  facilityCode: string;
  name: string;
  facilityType: 'PHC' | 'UHC';
  state: string;
  district: string;
  taluka: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  staffAssignments: StaffAssignment[];
  inboxNotifications?: FacilityNotification[];
}

interface AdminUserOption {
  id: string;
  displayName: string;
  phone: string;
  role: string;
  active: boolean;
}

export function FacilityDetailPage() {
  const { id = '' } = useParams<{ id: string }>();

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'HEALTH_WORKER' | 'CLINICIAN'>('HEALTH_WORKER');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Facility Action Modal
  const [actionNotificationId, setActionNotificationId] = useState<string | null>(null);
  const [actionText, setActionText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const facility = useAsync<FacilityDetail>(() => api.get(`/facilities/${id}`), [id]);
  const staffUsers = useAsync<{ items: AdminUserOption[] }>(
    () => api.get('/admin/users?pageSize=100'),
    [],
  );
  const nearbyClinicians = useAsync<NearbyClinician[]>(
    () => api.get(`/facilities/${id}/nearby-clinicians`),
    [id],
  );
  const inbox = useAsync<FacilityNotification[]>(
    () => api.get(`/facilities/${id}/inbox`),
    [id],
  );

  async function handleAssignStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setAssignError('Please select a staff member');
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      await api.post('/facilities/staff', {
        facilityId: id,
        userId: selectedUserId,
        role: selectedRole,
        startDate: new Date(startDate).toISOString(),
      });

      setShowAssignModal(false);
      setSelectedUserId('');
      facility.reload();
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign staff member');
    } finally {
      setAssigning(false);
    }
  }

  async function handleEndAssignment(assignmentId: string) {
    if (!window.confirm('Are you sure you want to end this staff assignment?')) return;
    try {
      await api.delete(`/facilities/staff/${assignmentId}`);
      facility.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to end assignment');
    }
  }

  async function handleAckNotification(notificationId: string) {
    try {
      await api.post(`/facilities/inbox/${notificationId}/acknowledge`, {});
      inbox.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge notification');
    }
  }

  async function handleRecordAction(e: React.FormEvent) {
    e.preventDefault();
    if (!actionNotificationId || !actionText.trim()) return;

    setSubmittingAction(true);
    try {
      await api.post(`/facilities/inbox/${actionNotificationId}/action`, {
        actionTaken: actionText.trim(),
      });
      setActionNotificationId(null);
      setActionText('');
      inbox.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to record action');
    } finally {
      setSubmittingAction(false);
    }
  }

  if (facility.loading) return <Card>Loading facility details…</Card>;
  if (facility.error || !facility.data) {
    return <Card style={{ color: palette.danger }}>Error: {facility.error || 'Facility not found'}</Card>;
  }

  const f = facility.data;
  const eligibleUsers = (staffUsers.data?.items || []).filter(
    (u) => u.active && (u.role === 'HEALTH_WORKER' || u.role === 'CLINICIAN'),
  );

  const staffColumns: Column<StaffAssignment>[] = [
    {
      header: 'Staff Name',
      render: (s) => (
        <div>
          <span style={{ fontWeight: 600, color: palette.text }}>{s.user.displayName}</span>
          <div style={{ fontSize: 12, color: palette.textMuted }}>{s.user.phone}</div>
        </div>
      ),
    },
    {
      header: 'Role',
      render: (s) => (
        <AdminChip kind={s.role === 'HEALTH_WORKER' ? 'green' : 'amber'}>
          {s.role === 'HEALTH_WORKER' ? 'Health Worker' : 'Clinician'}
        </AdminChip>
      ),
    },
    {
      header: 'Start Date',
      render: (s) => new Date(s.startDate).toLocaleDateString(),
    },
    {
      header: 'End Date',
      render: (s) => (s.endDate ? new Date(s.endDate).toLocaleDateString() : '— (Active)'),
    },
    {
      header: 'Status',
      render: (s) => <ActiveChip active={s.active} />,
    },
    {
      header: '',
      render: (s) =>
        s.active ? (
          <Button
            variant="ghost"
            style={{ color: palette.danger }}
            onClick={() => handleEndAssignment(s.id)}
          >
            End assignment
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="stack" style={{ display: 'grid', gap: 20 }}>
      {/* Header and Back Link */}
      <div>
        <Link to="/admin/facilities" style={{ color: palette.primary, fontSize: 13, fontWeight: 600 }}>
          ← Back to Facilities
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{f.name}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <AdminChip kind={f.facilityType === 'PHC' ? 'green' : 'blue'}>
              {f.facilityType}
            </AdminChip>
            <ActiveChip active={f.active} />
          </div>
        </div>
      </div>

      {/* Facility Overview Card */}
      <SectionCard title="Facility Details">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>Facility Code</div>
            <code style={{ fontSize: 14 }}>{f.facilityCode}</code>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>Facility Type</div>
            <div>{f.facilityType === 'PHC' ? 'Primary Health Centre (PHC)' : 'Urban Health Centre (UHC)'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>Taluka / District</div>
            <div>{f.taluka}, {f.district}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>State</div>
            <div>{f.state}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>Address</div>
            <div>{f.address}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>Coordinates</div>
            <div>
              {typeof f.latitude === 'number' && typeof f.longitude === 'number'
                ? `${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}`
                : 'Not recorded'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>Phone</div>
            <div>{f.phone || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: palette.textMuted }}>Email</div>
            <div>{f.email || '—'}</div>
          </div>
        </div>
      </SectionCard>

      {/* Staff Assignments Section */}
      <SectionCard
        title="Assigned Staff (Health Workers & Clinicians)"
        actions={<Button onClick={() => setShowAssignModal(true)}>Assign Staff Member</Button>}
      >
        <DataTable
          columns={staffColumns}
          rows={f.staffAssignments}
          rowKey={(s) => s.id}
        />
        {f.staffAssignments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: palette.textMuted }}>
            No staff assigned to this facility yet. Click Assign Staff Member to assign a Health Worker or Clinician.
          </div>
        )}
      </SectionCard>

      {/* Facility Notifications Inbox */}
      <SectionCard title="Facility Case Notification Inbox">
        <ListBody
          loading={inbox.loading}
          error={inbox.error}
          empty={!inbox.data || inbox.data.length === 0}
          emptyHint="No clinical case notifications dispatched to this facility inbox."
          onRetry={inbox.reload}
        >
          {inbox.data && (
            <div style={{ display: 'grid', gap: 10 }}>
              {inbox.data.map((n) => (
                <div
                  key={n.id}
                  style={{
                    backgroundColor: palette.surface,
                    padding: 14,
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    borderLeft: `4px solid ${n.priority === 'CRITICAL' ? palette.danger : palette.primary}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: palette.text }}>{n.title}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <AdminChip kind={n.status === 'ACTIONED' ? 'green' : 'amber'}>
                        {n.status}
                      </AdminChip>
                      <span style={{ fontSize: 12, color: palette.textMuted }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: '6px 0', fontSize: 13, color: palette.text }}>{n.body}</p>

                  {n.actionTaken && (
                    <div style={{ margin: '6px 0', padding: 8, backgroundColor: '#F0FDF4', borderRadius: 6, fontSize: 12, color: '#166534' }}>
                      ✓ Action Taken: {n.actionTaken}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {!n.acknowledgedAt && (
                      <Button variant="secondary" onClick={() => handleAckNotification(n.notificationId)}>
                        Acknowledge
                      </Button>
                    )}
                    {n.status !== 'ACTIONED' && (
                      <Button
                        variant="primary"
                        onClick={() => {
                          setActionNotificationId(n.notificationId);
                          setActionText('');
                        }}
                      >
                        Record Action
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListBody>
      </SectionCard>

      {/* Nearby Clinicians (Haversine Distance) */}
      <SectionCard title="Nearby Clinicians (Haversine Distance Calculation)">
        <ListBody
          loading={nearbyClinicians.loading}
          error={nearbyClinicians.error}
          empty={!nearbyClinicians.data || nearbyClinicians.data.length === 0}
          emptyHint="No clinicians registered within range of this facility."
          onRetry={nearbyClinicians.reload}
        >
          {nearbyClinicians.data && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {nearbyClinicians.data.map((c) => (
                <div
                  key={c.clinicianId}
                  style={{
                    backgroundColor: palette.surface,
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: palette.text }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: palette.textMuted }}>📞 {c.phone}</div>
                  <div style={{ fontSize: 12, color: palette.textMuted }}>
                    🏥 {c.facilityName || c.activeAssignments?.[0]?.facilityName || 'Assigned to other facility'}
                    {c.taluka || c.activeAssignments?.[0]?.taluka ? ` · ${c.taluka || c.activeAssignments?.[0]?.taluka}` : ''}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: palette.primary }}>
                    {typeof c.distanceKm === 'number'
                      ? `📍 ${c.distanceKm.toFixed(1)} km away`
                      : '📍 Distance not available (unassigned)'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListBody>
      </SectionCard>

      {/* Assign Staff Modal */}
      {showAssignModal && (
        <Modal
          title={`Assign Staff Member to ${f.name}`}
          onClose={() => setShowAssignModal(false)}
        >
          <form onSubmit={handleAssignStaff} style={{ display: 'grid', gap: 14 }}>
            {assignError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {assignError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Select User *
              </label>
              <select
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                }}
                value={selectedUserId}
                onChange={(e) => {
                  const uid = e.target.value;
                  setSelectedUserId(uid);
                  const found = eligibleUsers.find((u) => u.id === uid);
                  if (found) {
                    setSelectedRole(found.role as 'HEALTH_WORKER' | 'CLINICIAN');
                  }
                }}
              >
                <option value="">-- Choose staff member --</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.role === 'HEALTH_WORKER' ? 'Health Worker' : 'Clinician'}) · {u.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Assigned Role *
              </label>
              <select
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                }}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'HEALTH_WORKER' | 'CLINICIAN')}
              >
                <option value="HEALTH_WORKER">Health Worker</option>
                <option value="CLINICIAN">Clinician</option>
              </select>
              <span style={{ fontSize: 11, color: palette.textMuted }}>
                Note: Role must match the user's registered role in M3.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Assignment Start Date *
              </label>
              <input
                type="date"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button variant="ghost" type="button" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={assigning}>
                {assigning ? 'Assigning…' : 'Confirm Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Action Modal */}
      {actionNotificationId && (
        <Modal
          title="Record Clinical / Facility Action"
          onClose={() => setActionNotificationId(null)}
        >
          <form onSubmit={handleRecordAction} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Action Details *
              </label>
              <textarea
                required
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                }}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="e.g. Dispatched Health Worker to site; worker attended PHC; medications prescribed."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button variant="ghost" type="button" onClick={() => setActionNotificationId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingAction}>
                {submittingAction ? 'Saving…' : 'Save Action'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
