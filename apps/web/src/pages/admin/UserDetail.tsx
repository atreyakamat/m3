import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, ConfirmDialog, DataTable, ListBody, RoleChip, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { Button, Card, TextField, Banner } from '../../components/ui';

interface UserDetail {
  id: string;
  stakeholderId: string | null;
  name: string;
  phone: string | null;
  username: string | null;
  role: string;
  active: boolean;
  mustChangeCredential: boolean;
  createdAt: string;
  contractor: { contractorId: string; name: string; sites: Array<{ siteId: string; name: string; active: boolean }> } | null;
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useAsync<UserDetail>(() => api.get(`/admin/users/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { action: 'deactivate' | 'activate' | 'resetPin'; pin?: string }>(null);
  const [tempPin, setTempPin] = useState('');

  async function runAction(action: 'activate' | 'deactivate' | 'resetPin', pin?: string) {
    setBusy(true);
    setActionError(null);
    try {
      if (action === 'resetPin') {
        if (!pin) throw new Error('Enter a temporary PIN first');
        await api.post(`/admin/users/${id}/reset-pin`, { tempPin: pin });
        setNote('A new temporary PIN has been set. The account must change it at next login.');
      } else {
        await api.post(`/admin/users/${id}/${action}`, {});
        if (action === 'deactivate') setNote('Account deactivated. It can no longer sign in.');
        if (action === 'activate') setNote('Account activated.');
      }
      setConfirm(null);
      setTempPin('');
      reload();
    } catch (e) {
      setConfirm(null);
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const siteColumns: Column<{ siteId: string; name: string; active: boolean }>[] = [
    { header: 'Site ID', width: '130px', render: (s) => <code style={{ fontSize: 13 }}>{s.siteId}</code> },
    {
      header: 'Site name',
      render: (s) => <Link to={`/admin/sites/${s.siteId}`} style={{ color: '#0E7C86' }}>{s.name}</Link>,
    },
    { header: 'Status', render: (s) => <AdminChip kind={s.active ? 'green' : 'grey'}>{s.active ? 'Active' : 'Inactive'}</AdminChip> },
  ];

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <Card>
        <ListBody loading={loading} error={error} empty={false} onRetry={reload}>
          {data && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, flex: 1 }}>{data.name}</h2>
                <RoleChip role={data.role} />
                <AdminChip kind={data.active ? 'green' : 'grey'}>{data.active ? 'Active' : 'Deactivated'}</AdminChip>
                <AdminChip kind={data.mustChangeCredential ? 'amber' : 'blue'}>
                  {data.mustChangeCredential ? 'First login pending' : 'Credential change complete'}
                </AdminChip>
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Unique ID</div><code>{data.stakeholderId ?? data.username ?? '—'}</code></div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Phone</div>{data.phone ?? '—'}</div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Created</div>{isoDate(data.createdAt)}</div>
              </div>
              {actionError && <div style={{ marginTop: 12 }}><Banner kind="danger">{actionError}</Banner></div>}
              {note && <div style={{ marginTop: 12 }}><Banner kind="success">{note}</Banner></div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <TextField
                  label="New temporary PIN"
                  type="password"
                  value={tempPin}
                  inputMode="numeric"
                  placeholder="4–6 digits"
                  style={{ width: 220 }}
                  onChange={(e) => setTempPin(e.target.value)}
                />
                <Button variant="secondary" style={{ alignSelf: 'flex-end' }} disabled={busy || !data.active}
                  onClick={() => setConfirm({ action: 'resetPin', pin: tempPin })}>
                  Reset PIN
                </Button>
                {data.active ? (
                  <Button variant="danger" style={{ alignSelf: 'flex-end' }} disabled={busy || data.role === 'ADMIN'}
                    onClick={() => setConfirm({ action: 'deactivate' })}>
                    Deactivate account
                  </Button>
                ) : (
                  <Button variant="primary" style={{ alignSelf: 'flex-end' }} disabled={busy}
                    onClick={() => setConfirm({ action: 'activate' })}>
                    Activate account
                  </Button>
                )}
              </div>
            </>
          )}
        </ListBody>
      </Card>

      {data?.contractor && (
        <SectionCard title={`Assigned sites (${data.contractor.sites.length})`}>
          <ListBody loading={false} error={null} empty={data.contractor.sites.length === 0}
            emptyHint="No sites assigned yet; assign them from site edit pages.">
            <DataTable columns={siteColumns} rows={data.contractor.sites} rowKey={(s) => s.siteId} />
          </ListBody>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Site assignment is managed independently of the contractor profile.
          </p>
        </SectionCard>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.action === 'resetPin' ? 'Reset temporary PIN?' : confirm?.action === 'deactivate' ? 'Deactivate this account?' : 'Activate this account?'}
        tone={confirm?.action === 'deactivate' ? 'danger' : 'warning'}
        confirmLabel={confirm?.action === 'resetPin' ? 'Reset PIN' : confirm?.action === 'deactivate' ? 'Deactivate' : 'Activate'}
        busy={busy}
        onConfirm={() => { if (confirm) void runAction(confirm.action, confirm.pin); }}
        onCancel={() => setConfirm(null)}
        body={
          confirm?.action === 'resetPin' ? (
            <>The account will be locked back into the first-login flow and must set a new PIN before accessing any dashboard.</>
          ) : confirm?.action === 'deactivate' ? (
            <>The account will no longer be able to sign in. Records are never deleted.</>
          ) : (
            <>The account will be able to sign in again.</>
          )
        }
      />
    </div>
  );
}
