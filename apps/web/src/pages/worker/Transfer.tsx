import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Paginated, SiteDto, TransferDto, WorkerProfile } from '../../lib/types';
import { Card, Button, Banner, Spinner, TextField } from '../../components/ui';
import { TransferStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

export function Transfer() {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [transfers, setTransfers] = useState<TransferDto[]>([]);
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [search, setSearch] = useState('');
  const [toSite, setToSite] = useState<SiteDto | null>(null);
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () =>
    Promise.all([api.get<WorkerProfile>('/workers/me'), api.get<TransferDto[]>('/transfers/me')]).then(([p, t]) => {
      setProfile(p);
      setTransfers(t);
    });

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const pending = transfers.find((t) => !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(t.status));

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      await reload();
      setMsg({ kind: 'success', text: ok });
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof Error ? e.message : 'Error' });
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <Card accent={palette.secondary}>
        <h2>Site Transfer</h2>
        <div className="small">
          <strong>From (current site):</strong> {profile?.currentSite ? `${profile.currentSite.name} (${profile.currentSite.siteId})` : 'None'}
        </div>
      </Card>

      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      {!pending && profile?.currentSite && (
        <Card>
          <h3>Request a transfer</h3>
          <div className="row">
            <TextField placeholder="Search destination site…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
            <Button variant="secondary" onClick={() => api.get<Paginated<SiteDto>>(`/sites?search=${encodeURIComponent(search)}`).then((p) => setSites(p.items))}>Search</Button>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {sites.map((s) => (
              <label key={s.siteId} className="row">
                <input type="radio" name="tosite" checked={toSite?.siteId === s.siteId} onChange={() => setToSite(s)} />
                <span>{s.name} <span className="muted small">({s.siteId})</span></span>
              </label>
            ))}
          </div>
          <Button
            style={{ marginTop: 12 }}
            disabled={!toSite}
            onClick={() => act(() => api.post('/transfers/worker', { toSiteId: toSite!.siteId }), 'Transfer requested — awaiting contractor approvals.')}
          >
            Request transfer to {toSite?.name ?? '…'}
          </Button>
        </Card>
      )}

      <Card>
        <h3>My transfer requests</h3>
        {transfers.length === 0 && <p className="muted">No transfer requests yet.</p>}
        <div className="stack">
          {transfers.map((t) => (
            <div key={t.id} className="spread" style={{ borderBottom: `1px solid ${palette.border}`, paddingBottom: 10 }}>
              <div>
                <div className="small">
                  {(t.fromSite?.name ?? 'No site')} → <strong>{t.toSite?.name ?? t.toSiteId}</strong>
                </div>
                <div className="muted small">
                  Initiated by {t.initiatorType === 'WORKER' ? 'you' : 'contractor'} · {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="row">
                <TransferStatusChip status={t.status} />
                {t.status === 'PENDING_WORKER_RESPONSE' && t.initiatorType === 'CONTRACTOR' && (
                  <>
                    <Button onClick={() => act(() => api.post(`/transfers/${t.id}/worker/accept`), 'Accepted.')}>Accept</Button>
                    <Button variant="danger" onClick={() => act(() => api.post(`/transfers/${t.id}/worker/reject`), 'Rejected.')}>Reject</Button>
                  </>
                )}
                {t.initiatorType === 'WORKER' && !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(t.status) && (
                  <Button variant="secondary" onClick={() => act(() => api.post(`/transfers/${t.id}/cancel`), 'Cancelled.')}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
