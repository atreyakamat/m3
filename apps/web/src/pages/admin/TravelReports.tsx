import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TravelReportStatus } from '@m3/shared';
import { TRAVEL_REPORT_STATUS } from '@m3/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, DataTable, FilterRow, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { palette } from '../../lib/tokens';

interface ReportRow {
  id: string;
  workerId: string;
  workerName: string;
  travelRecordId: string;
  departureDate: string | null;
  destinationState: string | null;
  status: TravelReportStatus;
  createdAt: string;
}

interface Paginated<T> { items: T[]; total: number; page: number; totalPages: number }

const chip = (s: TravelReportStatus) => {
  const map: Record<TravelReportStatus, { kind: 'amber' | 'blue' | 'green'; label: string }> = {
    OPEN: { kind: 'amber', label: 'Awaiting review' },
    REVIEWED: { kind: 'blue', label: 'Reviewed' },
    RESOLVED: { kind: 'green', label: 'Resolved' },
  };
  return <AdminChip kind={map[s].kind}>{map[s].label}</AdminChip>;
};

export function TravelReportsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const sites = useAsync<{ items: Array<{ siteId: string; name: string; active: boolean }> }>(() => api.get('/admin/sites?pageSize=100'), []);
  const list = useAsync<Paginated<ReportRow>>(
    () => api.get(`/admin/travel-reports?${new URLSearchParams({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(siteCode ? { siteCode } : {}),
    })}`),
    [search, status, from, to, siteCode],
  );

  const columns: Column<ReportRow>[] = [
    {
      header: 'Report',
      width: '130px',
      render: (r) => <Link to={`/admin/travel-reports/${r.id}`} style={{ color: palette.primary, fontWeight: 600 }}>Open</Link>,
    },
    { header: 'Worker ID', render: (r) => <code style={{ fontSize: 13 }}>{r.workerId}</code> },
    { header: 'Worker name', render: (r) => r.workerName },
    { header: 'Departure', render: (r) => (r.departureDate ? isoDate(r.departureDate) : '—') },
    { header: 'Destination state', render: (r) => r.destinationState ?? '—' },
    { header: 'Submitted', render: (r) => isoDate(r.createdAt) },
    { header: 'Status', render: (r) => chip(r.status) },
  ];

  return (
    <SectionCard title="Travel reports">
      <FilterRow search={search} onSearch={setSearch} searchPlaceholder="Search by worker, ID or travel record…">
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }} aria-label="Status filter">
          <option value="">All statuses</option>
          {TRAVEL_REPORT_STATUS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={siteCode} onChange={(e) => setSiteCode(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }} aria-label="Site filter">
          <option value="">All sites</option>
          {(sites.data?.items ?? []).map((s) => <option key={s.siteId} value={s.siteId}>{s.name}</option>)}
        </select>
        <label className="muted small">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          style={{ marginLeft: 4, padding: '8px 10px', borderRadius: 8, border: `1px solid ${palette.border}` }} /></label>
        <label className="muted small">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          style={{ marginLeft: 4, padding: '8px 10px', borderRadius: 8, border: `1px solid ${palette.border}` }} /></label>
      </FilterRow>
      <ListBody
        loading={list.loading}
        error={list.error}
        empty={list.data?.items.length === 0}
        emptyHint="Reports from the Contractor travel workflow will appear here (positive cases departing within 7 days)."
        onRetry={list.reload}
      >
        {list.data && <DataTable columns={columns} rows={list.data.items} rowKey={(r) => r.id} />}
      </ListBody>
    </SectionCard>
  );
}
