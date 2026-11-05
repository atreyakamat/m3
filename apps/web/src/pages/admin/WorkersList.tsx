import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MalariaStatus } from '@m3/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { DataTable, FilterRow, ListBody, SectionCard, type Column } from '../../components/admin';
import { MalariaStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

interface WorkerRow {
  workerId: string;
  patientId: string;
  name: string;
  phone: string;
  active?: boolean;
  site: { siteId: string; name: string } | null;
  screening: string;
  malaria: MalariaStatus;
}

interface Paginated<T> { items: T[]; total: number; page: number; totalPages: number }

const screeningChip = (s: string) =>
  s === 'COMPLETE' ? <span style={{ color: '#2E9E5B', fontWeight: 600 }}>Complete</span>
    : s === 'DRAFT' ? <span style={{ color: '#A5741A', fontWeight: 600 }}>Draft</span>
      : <span className="muted">Not started</span>;

export function WorkersList() {
  const [search, setSearch] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [screening, setScreening] = useState('');
  const [malaria, setMalaria] = useState('');
  const sites = useAsync<{ items: Array<{ siteId: string; name: string; active: boolean }> }>(() => api.get('/admin/sites?pageSize=100'), []);
  const list = useAsync<Paginated<WorkerRow>>(
    () => api.get(`/admin/workers?${new URLSearchParams({
      ...(search ? { search } : {}),
      ...(siteCode ? { siteCode } : {}),
      ...(screening ? { screening } : {}),
      ...(malaria ? { malaria } : {}),
    })}`),
    [search, siteCode, screening, malaria],
  );

  const columns: Column<WorkerRow>[] = [
    { header: 'Worker ID', width: '130px', render: (w) => <code style={{ fontSize: 13 }}>{w.workerId}</code> },
    {
      header: 'Name',
      render: (w) => (
        <span>
          <Link to={`/admin/workers/${w.workerId}`} style={{ color: palette.primary, fontWeight: 600 }}>
            {w.name}
          </Link>
          {w.active === false ? (
            <span
              style={{
                marginLeft: 8,
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
              }}
            >
              Deactivated
            </span>
          ) : null}
        </span>
      ),
    },
    { header: 'Mobile', render: (w) => w.phone },
    { header: 'Site', render: (w) => w.site ? `${w.site.name}` : <span className="muted">Unassigned</span> },
    { header: 'Screening', render: (w) => screeningChip(w.screening) },
    { header: 'Malaria status', render: (w) => <MalariaStatusChip status={w.malaria} /> },
  ];

  return (
    <SectionCard title="Workers">
      <FilterRow search={search} onSearch={setSearch} searchPlaceholder="Search by Worker ID, Patient ID, name or mobile…">
        <select value={siteCode} onChange={(e) => setSiteCode(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }}
          aria-label="Construction site filter">
          <option value="">All sites</option>
          {(sites.data?.items ?? []).map((s) => <option key={s.siteId} value={s.siteId}>{s.name}</option>)}
        </select>
        <select value={screening} onChange={(e) => setScreening(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }}
          aria-label="Screening filter">
          <option value="">All screening</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
        </select>
        <select value={malaria} onChange={(e) => setMalaria(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }}
          aria-label="Malaria status filter">
          <option value="">All statuses</option>
          <option value="POSITIVE">Positive</option>
          <option value="NEGATIVE">Negative</option>
          <option value="AWAITING">Awaiting result</option>
          <option value="NO_RESULT">No result recorded</option>
        </select>
      </FilterRow>
      <ListBody
        loading={list.loading}
        error={list.error}
        empty={list.data?.items.length === 0}
        emptyHint="No workers match the filters."
        onRetry={list.reload}
      >
        {list.data && <DataTable columns={columns} rows={list.data.items} rowKey={(w) => w.workerId} />}
      </ListBody>
      {list.data && list.data.totalPages > 1 && (
        <p className="muted small" style={{ marginTop: 10 }}>
          Page {list.data.page} of {list.data.totalPages} · {list.data.total} workers
        </p>
      )}
      <p className="muted small" style={{ marginTop: 10 }}>
        Screening responses are read-only and clinical records remain under the control of authorised clinical roles.
      </p>
    </SectionCard>
  );
}
