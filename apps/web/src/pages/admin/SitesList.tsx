import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { ActiveChip, DataTable, FilterRow, ListBody, SectionCard, type Column } from '../../components/admin';
import { Button } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface SiteRow {
  siteId: string;
  name: string;
  district: string | null;
  area: string;
  contractor: { contractorId: string; name: string } | null;
  activeWorkers: number;
  active: boolean;
}

interface Paginated<T> { items: T[]; total: number; page: number; totalPages: number }

export function SitesList() {
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const list = useAsync<Paginated<SiteRow>>(
    () => api.get(`/admin/sites?${new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}) })}`),
    [search, status],
  );

  const columns: Column<SiteRow>[] = [
    { header: 'Site ID', width: '140px', render: (s) => <code style={{ fontSize: 13 }}>{s.siteId}</code> },
    {
      header: 'Site name',
      render: (s) => (
        <Link to={`/admin/sites/${s.siteId}`} style={{ color: palette.primary, fontWeight: 600 }}>{s.name}</Link>
      ),
    },
    { header: 'District / Area', render: (s) => <span>{s.district ?? '—'} · {s.area}</span> },
    { header: 'Contractor', render: (s) => s.contractor?.name ?? <span className="muted">—</span> },
    { header: 'Workers', render: (s) => s.activeWorkers },
    { header: 'Status', render: (s) => <ActiveChip active={s.active} /> },
    {
      header: '',
      render: (s) => (
        <Button variant="ghost" onClick={() => nav(`/admin/sites/${s.siteId}/edit`)}>Edit</Button>
      ),
    },
  ];

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <SectionCard
        title="Construction sites"
        actions={<Button onClick={() => nav('/admin/sites/new')}>Create site</Button>}
      >
        <FilterRow
          search={search}
          onSearch={(v) => setSearch(v)}
          searchPlaceholder="Search by site name or ID…"
        >
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }}
            aria-label="Site status filter"
          >
            <option value="">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </FilterRow>
        <ListBody
          loading={list.loading}
          error={list.error}
          empty={list.data?.items.length === 0}
          emptyHint="Create the first construction site to get started."
          onRetry={list.reload}
        >
          {list.data && <DataTable columns={columns} rows={list.data.items} rowKey={(s) => s.siteId} />}
        </ListBody>
        {list.data && list.data.totalPages > 1 && (
          <p className="muted small" style={{ marginTop: 10 }}>
            Page {list.data.page} of {list.data.totalPages} · {list.data.total} sites
          </p>
        )}
      </SectionCard>
    </div>
  );
}
