import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Button, Spinner, Banner } from '../../components/ui';
import { TransferStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

interface ApprovalRow {
  id: string;
  status: string;
  initiatorType: string;
  toSiteId: string;
  worker?: { workerCode: string; name: string };
  createdAt: string;
}

export function Approvals() {
  const { data, loading, reload } = useAsync<ApprovalRow[]>(() => api.get('/transfers/approvals'));
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  async function act(id: string, approve: boolean) {
    setMsg(null);
    try {
      await api.post(`/transfers/${id}/contractor/${approve ? 'approve' : 'reject'}`);
      setMsg({ kind: 'success', text: approve ? 'Approved.' : 'Rejected.' });
      await reload();
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof Error ? e.message : 'Error' });
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <Card accent={palette.secondary}><h2>Transfers awaiting your approval</h2></Card>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {(data?.length ?? 0) === 0 && <Card><p className="muted">Nothing awaiting your approval.</p></Card>}
      {data?.map((t) => (
        <Card key={t.id}>
          <div className="spread">
            <div>
              <strong>{t.worker?.name ?? 'Worker'}</strong> <span className="muted small">({t.worker?.workerCode})</span>
              <div className="muted small">Initiated by {t.initiatorType === 'WORKER' ? 'worker' : 'contractor'} · {new Date(t.createdAt).toLocaleDateString()}</div>
            </div>
            <TransferStatusChip status={t.status as never} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <Button onClick={() => act(t.id, true)}>Approve</Button>
            <Button variant="danger" onClick={() => act(t.id, false)}>Reject</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
