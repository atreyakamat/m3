import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Button, TextField, Select, Banner, Spinner } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface ContractorSite { siteId: string; name: string }
interface Lookup { workerId: string; name: string; currentSite: { siteId: string; name: string } | null }

export function InitiateTransfer() {
  const sites = useAsync<ContractorSite[]>(() => api.get('/stakeholders/contractor/sites'));
  const [workerId, setWorkerId] = useState('');
  const [found, setFound] = useState<Lookup | null>(null);
  const [toSiteId, setToSiteId] = useState('');
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  async function lookup() {
    setMsg(null);
    setFound(null);
    try {
      setFound(await api.get<Lookup>(`/workers/lookup/${encodeURIComponent(workerId)}`));
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof Error ? e.message : 'Not found' });
    }
  }

  async function send() {
    setMsg(null);
    try {
      await api.post('/transfers/contractor', { workerId: found!.workerId, toSiteId });
      setMsg({ kind: 'success', text: 'Transfer request sent. The worker and current-site contractor must approve.' });
      setFound(null);
      setWorkerId('');
      setToSiteId('');
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof Error ? e.message : 'Error' });
    }
  }

  if (sites.loading) return <Spinner />;

  return (
    <div className="stack">
      <Card accent={palette.secondary}>
        <h2>Initiate a transfer by Worker ID</h2>
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
        <div className="row" style={{ marginTop: 8 }}>
          <TextField placeholder="Worker ID (e.g. M3-ABC123)" value={workerId} onChange={(e) => setWorkerId(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <Button variant="secondary" onClick={lookup} disabled={!workerId}>Look up</Button>
        </div>
      </Card>

      {found && (
        <Card>
          <h3>Confirm worker</h3>
          <div><strong>{found.name}</strong> <span className="muted small">({found.workerId})</span></div>
          <div className="muted small">Current site: {found.currentSite ? found.currentSite.name : 'None'}</div>
          <div style={{ marginTop: 12 }}>
            <Select label="Destination site (yours)" value={toSiteId} onChange={(e) => setToSiteId(e.target.value)}>
              <option value="">—</option>
              {sites.data?.map((s) => <option key={s.siteId} value={s.siteId}>{s.name} ({s.siteId})</option>)}
            </Select>
          </div>
          <Button style={{ marginTop: 12 }} disabled={!toSiteId} onClick={send}>Send transfer request</Button>
        </Card>
      )}
    </div>
  );
}
