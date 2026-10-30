import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface ContractorSite {
  siteId: string;
  name: string;
  area: string;
  activeWorkers: number;
}

export function MySites() {
  const { data, loading } = useAsync<ContractorSite[]>(() => api.get('/stakeholders/contractor/sites'));
  if (loading) return <Spinner />;
  return (
    <div className="stack">
      <Card accent={palette.secondary}><h2>My construction sites</h2></Card>
      <div className="grid">
        {data?.map((s) => (
          <Card key={s.siteId}>
            <h3 style={{ margin: 0 }}>{s.name}</h3>
            <div className="muted small">{s.siteId} · {s.area}</div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: palette.secondary }}>{s.activeWorkers}</div>
            <div className="muted small">active workers</div>
          </Card>
        ))}
        {(data?.length ?? 0) === 0 && <Card><p className="muted">No sites assigned.</p></Card>}
      </div>
    </div>
  );
}
