import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, DataTable, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { MalariaStatusChip } from '../../components/StatusChip';
import { Button, Card, TextField } from '../../components/ui';

interface WorkerDetail {
  workerId: string;
  patientId: string;
  name: string;
  phone: string;
  active?: boolean;
  preferredLanguage: string;
  createdAt: string;
  site: { siteId: string; name: string; since: string } | null;
  screening: { status: string; completedAt: string | null; consentGiven: boolean };
  malaria: string;
  episodes: Array<{
    id: string; status: string; onsetDate: string | null; createdAt: string;
    diagnostics: Array<{ id: string; testType: string; result: string; species: string | null; testDate: string }>;
  }>;
  assignments: Array<{ siteId: string; siteName: string; active: boolean; startedAt: string; endedAt: string | null }>;
}

export function WorkerDetailPage() {
  const { workerCode = '' } = useParams();
  const { data, loading, error, reload } = useAsync<WorkerDetail>(() => api.get(`/admin/workers/${workerCode}`), [workerCode]);

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [removeConfirmName, setRemoveConfirmName] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleRemoveWorker = async () => {
    if (!data) return;
    if (removeConfirmName.trim() !== data.name.trim()) {
      setRemoveError(`Please type "${data.name}" exactly to confirm deactivation.`);
      return;
    }
    try {
      setRemoving(true);
      setRemoveError(null);
      await api.post(`/admin/workers/${data.workerId}/remove`, { confirm: true, reason: removeReason });
      setShowRemoveModal(false);
      reload();
    } catch (err: any) {
      setRemoveError(err?.message || 'Failed to remove worker.');
    } finally {
      setRemoving(false);
    }
  };

  const episodeColumns: Column<WorkerDetail['episodes'][number]>[] = [
    { header: 'Episode', width: '130px', render: (e) => <code style={{ fontSize: 12 }}>{e.id.slice(0, 8)}…</code> },
    { header: 'Status', render: (e) => <AdminChip kind={e.status === 'CONFIRMED' ? 'red' : e.status === 'RESOLVED' ? 'green' : 'amber'}>{e.status}</AdminChip> },
    { header: 'Onset', render: (e) => e.onsetDate ?? '—' },
    { header: 'Diagnostics', render: (e) => e.diagnostics.length ? e.diagnostics.map((d) => `${d.result} (${d.testType})`).join(', ') : 'No authorised result' },
    { header: 'Opened', render: (e) => isoDate(e.createdAt) },
  ];

  const assignmentColumns: Column<WorkerDetail['assignments'][number]>[] = [
    {
      header: 'Site',
      render: (a) => <Link to={`/admin/sites/${a.siteId}`} style={{ color: '#0E7C86' }}>{a.siteName}</Link>,
    },
    { header: 'Active', render: (a) => <AdminChip kind={a.active ? 'green' : 'grey'}>{a.active ? 'Current' : 'Historical'}</AdminChip> },
    { header: 'From', render: (a) => isoDate(a.startedAt) },
    { header: 'To', render: (a) => a.endedAt ? isoDate(a.endedAt) : '—' },
  ];

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <Card>
        <ListBody loading={loading} error={error} empty={false} onRetry={reload}>
          {data && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, flex: 1 }}>{data.name}</h2>
                {data.active === false ? (
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                    }}
                  >
                    Account Deactivated
                  </span>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setRemoveConfirmName('');
                      setRemoveReason('');
                      setRemoveError(null);
                      setShowRemoveModal(true);
                    }}
                  >
                    Remove / Deactivate Worker
                  </Button>
                )}
                <MalariaStatusChip status={data.malaria as never} />
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Worker ID</div><code>{data.workerId}</code></div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Patient ID</div><code style={{ fontSize: 12 }}>{data.patientId}</code></div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Mobile</div>{data.phone}</div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Language</div>{data.preferredLanguage}</div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Registered</div>{isoDate(data.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="muted small" style={{ fontWeight: 700 }}>Current site</div>
                  {data.site
                    ? <Link to={`/admin/sites/${data.site.siteId}`} style={{ color: '#0E7C86' }}>{data.site.name}</Link>
                    : <span className="muted">Unassigned</span>}
                </div>
                <div>
                  <div className="muted small" style={{ fontWeight: 700 }}>Initial screening</div>
                  {data.screening.status === 'COMPLETE'
                    ? <span style={{ color: '#2E9E5B', fontWeight: 600 }}>Completed{data.screening.completedAt ? ` · ${isoDate(data.screening.completedAt)}` : ''}</span>
                    : <span className="muted">Incomplete</span>}
                </div>
              </div>
            </>
          )}
        </ListBody>
      </Card>

      {data && (
        <>
          <SectionCard title="Site assignment history">
            <DataTable columns={assignmentColumns} rows={data.assignments} rowKey={(a) => `${a.siteId}-${a.startedAt}`} />
          </SectionCard>
          <SectionCard title="Malaria episodes (surveillance view — read-only)">
            <ListBody loading={false} error={null} empty={data.episodes.length === 0}
              emptyHint="No episodes recorded for this worker.">
              <DataTable columns={episodeColumns} rows={data.episodes} rowKey={(e) => e.id} />
            </ListBody>
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              Submitted screening answers and clinical records cannot be changed here.
            </p>
          </SectionCard>
        </>
      )}

      {/* Remove / Deactivate Worker Confirmation Modal */}
      {showRemoveModal && data && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 500,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'grid',
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: '#991B1B' }}>Confirm Worker Deactivation</h3>
              <p className="muted small" style={{ marginTop: 4 }}>
                This action deactivates worker access and terminates active assignments.
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#FEF2F2',
                borderLeft: '4px solid #DC2626',
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                color: '#991B1B',
                lineHeight: 1.5,
              }}
            >
              <strong>Impact Summary:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                <li>Worker <strong>{data.name}</strong> ({data.workerId}) will be blocked from logging in.</li>
                <li>Current active site assignment will be terminated immediately.</li>
                <li>Any pending QR passes, transfers, or join requests will be revoked.</li>
                <li><strong>All historical malaria episodes, diagnostic results, and prescriptions are strictly preserved.</strong></li>
              </ul>
            </div>

            <TextField
              label="Reason for Deactivation (Optional)"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="e.g. Left state, seasonal departure, duplicate registration"
            />

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Type worker name <code>{data.name}</code> to confirm:
              </label>
              <input
                type="text"
                value={removeConfirmName}
                onChange={(e) => setRemoveConfirmName(e.target.value)}
                placeholder={data.name}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #D1D5DB',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {removeError && (
              <div style={{ color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
                {removeError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRemoveModal(false);
                  setRemoveError(null);
                }}
                disabled={removing}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRemoveWorker}
                disabled={removing || removeConfirmName.trim() !== data.name.trim()}
              >
                {removing ? 'Deactivating…' : 'Confirm Deactivation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
