import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Button, Banner } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface ContractorSite {
  siteId: string;
  name: string;
  area: string;
  activeWorkers: number;
}

export function MySites() {
  const { data, loading, error, reload } = useAsync<ContractorSite[]>(() => api.get('/stakeholders/contractor/sites'));

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spinner />
        <p className="muted" style={{ marginTop: 12 }}>Loading construction sites…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stack">
        <Banner kind="danger">{error || 'Failed to load sites.'}</Banner>
        <div>
          <Button onClick={reload}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="spread">
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: palette.text }}>My Construction Sites</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Active sites assigned to your contractor account ({data?.length ?? 0})
          </p>
        </div>
        <Link to="/contractor" style={{ textDecoration: 'none' }}>
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {data?.map((s) => (
          <Card key={s.siteId} accent={palette.secondary}>
            <div className="spread" style={{ alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>{s.name}</h3>
                <div className="muted small" style={{ marginTop: 2 }}>
                  {s.siteId} · {s.area}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#3D5A80' }}>
                {s.activeWorkers}
              </div>
              <div className="muted small">active workers</div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
              <Link
                to={`/contractor/sites/${s.siteId}`}
                style={{
                  display: 'inline-block',
                  color: '#3D5A80',
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                View Site Details →
              </Link>
            </div>
          </Card>
        ))}

        {(data?.length ?? 0) === 0 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p className="muted" style={{ margin: 0 }}>
                No construction sites currently assigned to your account. Please contact the administrator.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
