import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, DataTable, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { MalariaStatusChip } from '../../components/StatusChip';
import { Card } from '../../components/ui';

interface WorkerDetail {
  workerId: string;
  patientId: string;
  name: string;
  phone: string;
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
    </div>
  );
}
