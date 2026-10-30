import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import type { WorkerProfile } from '../../lib/types';
import { Card, Spinner, Banner } from '../../components/ui';
import { MalariaStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

const actions = [
  { to: '/worker/screening', label: 'Initial screening', desc: 'Complete your one-time screening' },
  { to: '/worker/transfer', label: 'Transfer', desc: 'Request or review a site transfer' },
  { to: '/worker/unwell', label: 'Feeling unwell', desc: 'Report how you feel' },
  { to: '/worker/malaria', label: 'Malaria status', desc: 'View authorized results' },
  { to: '/worker/prescriptions', label: 'Prescriptions', desc: 'Current & history' },
  { to: '/worker/followups', label: 'Follow-ups', desc: 'Respond to check-ins' },
];

export function WorkerDashboard() {
  const { data, loading, error } = useAsync<WorkerProfile>(() => api.get('/workers/me'));

  if (loading) return <Spinner />;
  if (error || !data) return <Banner kind="danger">{error ?? 'Could not load profile'}</Banner>;

  return (
    <div className="stack">
      <Card accent={palette.primary}>
        <div className="spread">
          <div>
            <div className="muted small">Worker ID</div>
            <h2 style={{ margin: '2px 0' }}>{data.name}</h2>
            <div className="muted">{data.workerId}</div>
          </div>
          <MalariaStatusChip status={data.malariaStatus} />
        </div>
        <div style={{ marginTop: 12 }}>
          {data.currentSite ? (
            <div className="small">
              <strong>Current site:</strong> {data.currentSite.name} · {data.currentSite.area}
            </div>
          ) : (
            <Banner kind="warning">
              No construction site selected. <Link to="/worker/site">Select your site →</Link>
            </Banner>
          )}
        </div>
      </Card>

      {data.screening.status !== 'COMPLETE' && (
        <Banner kind="info">
          Your initial screening is {data.screening.status === 'DRAFT' ? 'in progress' : 'not started'}.{' '}
          <Link to="/worker/screening">Continue →</Link>
        </Banner>
      )}

      <div className="grid">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
            <Card style={{ height: '100%' }}>
              <h3 style={{ color: palette.primaryDark, margin: 0 }}>{a.label}</h3>
              <p className="muted small" style={{ margin: '6px 0 0' }}>{a.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
