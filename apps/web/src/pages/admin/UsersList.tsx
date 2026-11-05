import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, DataTable, FilterRow, ListBody, RoleChip, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { Button } from '../../components/ui';
import { palette } from '../../lib/tokens';
import { ADMIN_PROVISIONABLE_ROLES, ROLE_LABELS } from '@m3/shared';

interface UserRow {
  id: string;
  stakeholderId: string | null;
  name: string;
  phone: string | null;
  username: string | null;
  role: string;
  active: boolean;
  mustChangeCredential: boolean;
  createdAt: string;
}

interface Paginated<T> { items: T[]; total: number; page: number; totalPages: number }

export function UsersList() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const list = useAsync<Paginated<UserRow>>(
    () => api.get(`/admin/users?${new URLSearchParams({ ...(search ? { search } : {}), ...(role ? { role } : {}) })}`),
    [search, role],
  );

  const columns: Column<UserRow>[] = [
    {
      header: 'ID',
      width: '120px',
      render: (u) => <code style={{ fontSize: 13 }}>{u.stakeholderId ?? u.username ?? '—'}</code>,
    },
    {
      header: 'Name',
      render: (u) => <Link to={`/admin/users/${u.id}`} style={{ color: palette.primary, fontWeight: 600 }}>{u.name}</Link>,
    },
    { header: 'Phone', render: (u) => u.phone ?? '—' },
    { header: 'Role', render: (u) => <RoleChip role={u.role} /> },
    { header: 'Status', render: (u) => <AdminChip kind={u.active ? 'green' : 'grey'}>{u.active ? 'Active' : 'Deactivated'}</AdminChip> },
    {
      header: 'First login',
      render: (u) => (u.mustChangeCredential
        ? <AdminChip kind="amber">{u.active ? 'PIN change pending' : 'Not completed'}</AdminChip>
        : <AdminChip kind="blue">Completed</AdminChip>),
    },
    { header: 'Created', render: (u) => isoDate(u.createdAt) },
  ];

  return (
    <SectionCard title="User management" actions={<Link to="/admin/users/new"><Button>Create user</Button></Link>}>
      <FilterRow search={search} onSearch={setSearch} searchPlaceholder="Search by name, phone, ID or role…">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${palette.border}` }}
          aria-label="Role filter"
        >
          <option value="">All roles</option>
          {ADMIN_PROVISIONABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </FilterRow>
      <ListBody
        loading={list.loading}
        error={list.error}
        empty={list.data?.items.length === 0}
        emptyHint="Admin creates all non-worker accounts; workers self-register."
        onRetry={list.reload}
      >
        {list.data && <DataTable columns={columns} rows={list.data.items} rowKey={(u) => u.id} />}
      </ListBody>
      {list.data && list.data.totalPages > 1 && (
        <p className="muted small" style={{ marginTop: 10 }}>
          Page {list.data.page} of {list.data.totalPages} · {list.data.total} accounts
        </p>
      )}
    </SectionCard>
  );
}
