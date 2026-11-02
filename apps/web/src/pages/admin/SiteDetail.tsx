import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { ActiveChip, AdminChip, ConfirmDialog, DataTable, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { Button, Card, Banner } from '../../components/ui';
import { ROLE_LABELS } from '@m3/shared';

interface SiteDetail {
  siteId: string;
  name: string;
  active: boolean;
  address: string | null;
  landmark: string | null;
  contactPhone: string | null;
  area: string;
  taluka: string | null;
  district: string | null;
  state: string | null;
  contractor: { contractorId: string; name: string } | null;
  linkedWorkers: Array<{ workerId: string; name: string; phone: string; since: string }>;
  pendingJoinRequests: Array<{ joinRequestId: string; workerId: string; workerName: string; createdAt: string }>;
  totals: { assignments: number; transfersFrom: number; transfersTo: number };
}

export function SiteDetailPage() {
  const { siteCode = '' } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync<SiteDetail>(() => api.get(`/admin/sites/${siteCode}`), [siteCode]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const workerColumns: Column<{ workerId: string; name: string; since: string }>[] = [
    { header: 'Worker ID', width: '140px', render: (w) => <code style={{ fontSize: 13 }}>{w.workerId}</code> },
    {
      header: 'Name',
      render: (w) => <Link to={`/admin/workers/${w.workerId}`} style={{ color: '#0E7C86' }}>{w.name}</Link>,
    },
    { header: 'Linked since', render: (w) => isoDate(w.since) },
  ];

  async function deactivate() {
    setActionBusy(true);
    setActionError(null);
    try {
      await api.post(`/admin/sites/${siteCode}/deactivate`, { confirm: true });
      setConfirmOpen(false);
      reload();
    } catch (e) {
      setConfirmOpen(false);
      setActionError(e instanceof Error ? e.message : 'Could not deactivate the site');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <Card>
        <ListBody loading={loading} error={error} empty={false} onRetry={reload}>
          {data && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, flex: 1 }}>{data.name}</h2>
                <ActiveChip active={data.active} />
                <Button variant="secondary" onClick={() => nav(`/admin/sites/${siteCode}/edit`)}>Edit</Button>
                {data.active && (
                  <Button variant="danger" onClick={() => setConfirmOpen(true)}>Deactivate</Button>
                )}
              </div>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                <code style={{ fontSize: 13 }}>{data.siteId}</code> · {data.state ?? 'Goa'} → {data.district ?? '—'} → {data.taluka ?? '—'} → {data.area}
                {data.address ? ` · ${data.address}` : ''}
                {data.landmark ? ` (Landmark: ${data.landmark})` : ''}
                {data.contactPhone ? ` · Contact: ${data.contactPhone}` : ''}
              </p>
              {actionError && <div style={{ marginTop: 12 }}><Banner kind="danger">{actionError}</Banner></div>}
              <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
                <div>
                  <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Assigned Contractor</div>
                  {data.contractor
                    ? <Link to={`/admin/users/${data.contractor.contractorId}`} style={{ color: '#3D5A80', fontWeight: 600 }}>{data.contractor.name}</Link>
                    : <span className="muted">None assigned</span>}
                </div>
                <div>
                  <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Linked workers</div>
                  <b>{data.linkedWorkers.length}</b>
                </div>
                <div>
                  <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Historical records</div>
                  <span>{data.totals.assignments} assignments · {data.totals.transfersFrom + data.totals.transfersTo} transfers</span>
                </div>
              </div>
            </>
          )}
        </ListBody>
      </Card>

      {data && data.pendingJoinRequests.length > 0 && (
        <SectionCard title="Pending join requests">
          <DataTable
            columns={
              [
                { header: 'Worker ID', render: (r) => <code style={{ fontSize: 13 }}>{r.workerId}</code> },
                { header: 'Name', render: (r) => r.workerName },
                { header: 'Requested', render: (r) => isoDate(r.createdAt) },
                { header: 'Status', render: () => <AdminChip kind="amber">Pending</AdminChip> },
              ] as Column<SiteDetail['pendingJoinRequests'][number]>[]
            }
            rows={data.pendingJoinRequests}
            rowKey={(r) => r.joinRequestId}
          />
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Decision belongs to the site {ROLE_LABELS.CONTRACTOR.toLowerCase()}; Admin observes only.
          </p>
        </SectionCard>
      )}

      <SectionCard title="Linked workers">
        <ListBody
          loading={false}
          error={null}
          empty={Boolean(data && data.linkedWorkers.length === 0)}
          emptyHint="No workers are currently assigned to this site."
        >
          {data && <DataTable columns={workerColumns} rows={data.linkedWorkers} rowKey={(w) => w.workerId} />}
        </ListBody>
      </SectionCard>

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate construction site?"
        tone="danger"
        confirmLabel="Deactivate"
        busy={actionBusy}
        onConfirm={deactivate}
        onCancel={() => setConfirmOpen(false)}
        body={
          <>
            <p style={{ marginTop: 0 }}>
              {data?.linkedWorkers.length
                ? `${data.linkedWorkers.length} worker(s) are currently linked,${data?.contractor ? ' a contractor is assigned,' : ''} and historical records exist.`
                : data?.contractor
                  ? 'A contractor is currently assigned to this site.'
                  : 'No active relationships found.'}
            </p>
            <p style={{ marginBottom: 0 }}>
              Sites are never permanently deleted — deactivation keeps all historical relationships and records safe.
            </p>
          </>
        }
      />
    </div>
  );
}
