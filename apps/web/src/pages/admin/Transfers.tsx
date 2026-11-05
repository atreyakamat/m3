import { useState } from 'react';
import type { TransferStatus } from '@m3/shared';
import { TRANSFER_STATUS } from '@m3/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { DataTable, FilterRow, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { TransferStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

interface TransferRow {
  transferId: string;
  workerId: string;
  workerName: string;
  currentSite: { siteId: string; name: string } | null;
  destinationSite: { siteId: string; name: string };
  initiator: string;
  contractorApprovals: { from: string; to: string };
  workerAcceptance: string;
  status: TransferStatus;
  createdAt: string;
  effectiveAt: string | null;
}

interface Paginated<T> { items: T[]; total: number; page: number; totalPages: number }

const decisionLabel = (d: string) => (d === 'APPROVED' ? '✓' : d === 'REJECTED' ? '✗' : '…');

export function TransfersPage() {
  const [status, setStatus] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const sites = useAsync<{ items: Array<{ siteId: string; name: string; active: boolean }> }>(() => api.get('/admin/sites?pageSize=100'), []);
  const list = useAsync<Paginated<TransferRow>>(
    () => api.get(`/admin/transfers?${new URLSearchParams({
      ...(status ? { status } : {}),
      ...(siteCode ? { siteCode } : {}),
    })}`),
    [status, siteCode],
  );

  const columns: Column<TransferRow>[] = [
    { header: 'Worker ID', width: '120px', render: (t) => <code style={{ fontSize: 13 }}>{t.workerId}</code> },
    { header: 'Worker name', render: (t) => t.workerName },
    { header: 'Current site', render: (t) => t.currentSite ? `${t.currentSite.name}` : <span className="muted">—</span> },
    { header: 'Destination site', render: (t) => t.destinationSite.name },
    { header: 'Type', render: (t) => <span className="muted">{t.initiator === 'WORKER' ? 'Worker-initiated' : 'Contractor-initiated'}</span> },
    {
      header: 'Contractor approvals',
      render: (t) => (
        <span>
          Current {decisionLabel(t.contractorApprovals.from)} · Destination {decisionLabel(t.contractorApprovals.to)}
        </span>
      ),
    },
    { header: 'Worker acceptance', render: (t) => decisionLabel(t.workerAcceptance) },
    { header: 'Requested', render: (t) => isoDate(t.createdAt) },
    { header: 'Status', render: (t) => <TransferStatusChip status={t.status} /> },
  ];

  return (
    <SectionCard title="Transfers">
      <FilterRow>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }} aria-label="Status filter">
          <option value="">All statuses</option>
          {TRANSFER_STATUS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
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
        emptyHint="No transfer requests yet."
        onRetry={list.reload}
      >
        {list.data && <DataTable columns={columns} rows={list.data.items} rowKey={(t) => t.transferId} />}
      </ListBody>
      <p className="muted small" style={{ marginTop: 8 }}>
        Site assignments change only after all required approvals are recorded (spec §11).
      </p>
    </SectionCard>
  );
}
