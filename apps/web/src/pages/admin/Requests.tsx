import { useState } from 'react';
import type { JoinRequestStatus } from '@m3/shared';
import { JOIN_REQUEST_STATUS } from '@m3/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, DataTable, FilterRow, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { palette } from '../../lib/tokens';

interface JoinRequestRow {
  joinRequestId: string;
  workerId: string;
  workerName: string;
  site: { siteId: string; name: string };
  contractor: { contractorId: string; name: string } | null;
  status: JoinRequestStatus;
  createdAt: string;
  decidedAt: string | null;
}

interface Paginated<T> { items: T[]; total: number; page: number; totalPages: number }

const statusChip = (s: JoinRequestStatus) => {
  const map: Record<JoinRequestStatus, { kind: 'green' | 'amber' | 'red' | 'grey'; label: string }> = {
    PENDING: { kind: 'amber', label: 'Pending' },
    ACCEPTED: { kind: 'green', label: 'Accepted' },
    DECLINED: { kind: 'red', label: 'Declined' },
    CANCELLED: { kind: 'grey', label: 'Cancelled' },
  };
  return <AdminChip kind={map[s].kind}>{map[s].label}</AdminChip>;
};

export function RequestsPage() {
  const [status, setStatus] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [search, setSearch] = useState('');
  const sites = useAsync<{ items: Array<{ siteId: string; name: string; active: boolean }> }>(() => api.get('/admin/sites?pageSize=100'), []);
  const list = useAsync<Paginated<JoinRequestRow>>(
    () => api.get(`/admin/requests?${new URLSearchParams({
      ...(status ? { status } : {}),
      ...(siteCode ? { siteCode } : {}),
      ...(search ? { search } : {}),
    })}`),
    [status, siteCode, search],
  );

  const columns: Column<JoinRequestRow>[] = [
    { header: 'Worker ID', width: '130px', render: (r) => <code style={{ fontSize: 13 }}>{r.workerId}</code> },
    { header: 'Worker name', render: (r) => r.workerName },
    { header: 'Requested site', render: (r) => `${r.site.name} (${r.site.siteId})` },
    { header: 'Current site', render: () => <span className="muted">—</span> },
    { header: 'Contractor', render: (r) => r.contractor?.name ?? <span className="muted">None</span> },
    { header: 'Requested', render: (r) => isoDate(r.createdAt) },
    { header: 'Status', render: (r) => statusChip(r.status) },
    { header: 'Decided', render: (r) => r.decidedAt ? isoDate(r.decidedAt) : <span className="muted">Awaiting contractor</span> },
  ];

  return (
    <SectionCard title="Worker requests">
      <FilterRow search={search} onSearch={setSearch} searchPlaceholder="Search by Worker ID or name…">
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }} aria-label="Status filter">
          <option value="">All statuses</option>
          {JOIN_REQUEST_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={siteCode} onChange={(e) => setSiteCode(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }} aria-label="Site filter">
          <option value="">All sites</option>
          {(sites.data?.items ?? []).map((s) => <option key={s.siteId} value={s.siteId}>{s.name}</option>)}
        </select>
      </FilterRow>
      <ListBody
        loading={list.loading}
        error={list.error}
        empty={list.data?.items.length === 0}
        emptyHint="New workers request to join a site here; the site Contractor accepts or declines."
        onRetry={list.reload}
      >
        {list.data && <DataTable columns={columns} rows={list.data.items} rowKey={(r) => r.joinRequestId} />}
      </ListBody>
      <p className="muted small" style={{ marginTop: 8 }}>
        Admin observes the workflow and is notified of each Contractor decision — decisions are never bypassed.
      </p>
    </SectionCard>
  );
}
