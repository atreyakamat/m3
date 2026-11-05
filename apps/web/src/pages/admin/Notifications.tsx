import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, DataTable, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { Button } from '../../components/ui';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

interface Paginated { items: NotificationRow[]; total: number; page: number; totalPages: number; unread: number }

const typeLabel = (t: string) =>
  t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useAsync<Paginated>(() => api.get(`/admin/notifications?${unreadOnly ? 'unreadOnly=true&' : ''}`), [unreadOnly]);

  async function ack(id: string) {
    await api.post(`/admin/notifications/${id}/ack`, {});
    list.reload();
  }

  const columns: Column<NotificationRow>[] = [
    { header: '', width: '40px', render: (n) => (n.read ? null : <AdminChip kind="amber">New</AdminChip>) },
    { header: 'Event', render: (n) => <b>{typeLabel(n.type)}</b> },
    { header: 'Title', render: (n) => n.title },
    { header: 'Detail', render: (n) => <span style={{ color: '#5A6B74' }}>{n.body}</span> },
    { header: 'Received', render: (n) => isoDate(n.createdAt) },
    {
      header: '',
      render: (n) => (n.read
        ? <span className="muted small">Acknowledged</span>
        : <Button variant="ghost" onClick={() => void ack(n.id)}>Acknowledge</Button>),
    },
  ];

  return (
    <SectionCard
      title="Notifications"
      actions={
        <label className="muted small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
      }
    >
      {list.data && list.data.unread > 0 && (
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          {list.data.unread} unacknowledged notification(s). Events are deduplicated — each event appears once.
        </p>
      )}
      <ListBody
        loading={list.loading}
        error={list.error}
        empty={list.data ? list.data.items.length === 0 : false}
        emptyHint="Contractor decisions, transfer stages, travel reports and account events appear here."
        onRetry={list.reload}
      >
        {list.data && <DataTable columns={columns} rows={list.data.items} rowKey={(n) => n.id} />}
      </ListBody>
      {list.data && list.data.totalPages > 1 && (
        <p className="muted small" style={{ marginTop: 10 }}>
          Page {list.data.page} of {list.data.totalPages} · showing newest first
        </p>
      )}
    </SectionCard>
  );
}
