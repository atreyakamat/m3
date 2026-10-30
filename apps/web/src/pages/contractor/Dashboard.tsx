import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface ContractorSite { siteId: string; activeWorkers: number }

export function ContractorDashboard() {
  const sites = useAsync<ContractorSite[]>(() => api.get('/stakeholders/contractor/sites'));
  const approvals = useAsync<unknown[]>(() => api.get('/transfers/approvals'));
  if (sites.loading || approvals.loading) return <Spinner />;

  const workers = sites.data?.reduce((n, s) => n + s.activeWorkers, 0) ?? 0;

  return (
    <div className="stack">
      <div className="grid">
        <Card accent={palette.secondary}><div className="muted small">Sites</div><div style={{ fontSize: 30, fontWeight: 700 }}>{sites.data?.length ?? 0}</div></Card>
        <Card accent={palette.primary}><div className="muted small">Active workers</div><div style={{ fontSize: 30, fontWeight: 700 }}>{workers}</div></Card>
        <Link to="/contractor/approvals" style={{ textDecoration: 'none' }}>
          <Card accent={palette.warning}><div className="muted small">Pending approvals</div><div style={{ fontSize: 30, fontWeight: 700, color: palette.warning }}>{approvals.data?.length ?? 0}</div></Card>
        </Link>
      </div>
      <Card>
        <h3>Quick actions</h3>
        <div className="row">
          <Link className="nav-tab active" style={{ background: palette.secondary }} to="/contractor/initiate">Initiate a transfer</Link>
          <Link className="nav-tab" to="/contractor/approvals">Review approvals</Link>
          <Link className="nav-tab" to="/contractor/sites">My sites</Link>
        </div>
      </Card>
    </div>
  );
}
