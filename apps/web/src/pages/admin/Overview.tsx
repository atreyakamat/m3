import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { ListBody, SectionCard, StatCard } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import type { MalariaStatus } from '@m3/shared';

interface Overview {
  sites: { total: number; active: number; inactive: number };
  contractors: { total: number };
  workers: { total: number; screeningComplete: number; screeningIncomplete: number };
  malaria: Record<MalariaStatus, number>;
  requests: { pendingJoin: number; pendingTransfers: number };
  travel: { upcomingPositiveTravelReports: number; unacknowledgedTravelReports: number };
}

const malariaCategories: Array<{ key: MalariaStatus; note: string; accent: string }> = [
  { key: 'POSITIVE', note: 'Positive', accent: '#DC2626' },
  { key: 'NEGATIVE', note: 'Negative', accent: '#16A34A' },
  { key: 'AWAITING', note: 'Awaiting result', accent: '#D97706' },
  { key: 'NO_RESULT', note: 'No result recorded', accent: '#64748B' },
];

export function AdminOverview() {
  const { data, loading, error, reload } = useAsync<Overview>(() => api.get('/admin/overview'), []);

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <ListBody loading={loading} error={error} empty={false} onRetry={reload}>
        {data && (
          <>
            <SectionCard title="Infrastructure & Stakeholders">
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <StatCard label="Total construction sites" value={data.sites.total} accent="#0E7C86" to="/admin/sites" />
                <StatCard label="Active sites" value={data.sites.active} accent="#2E9E5B" to="/admin/sites?status=active" />
                <StatCard label="Inactive sites" value={data.sites.inactive} accent="#5A6B74" to="/admin/sites?status=inactive" />
                <StatCard label="Total contractors" value={data.contractors.total} accent="#3D5A80" to="/admin/users?role=CONTRACTOR" />
              </div>
            </SectionCard>

            <SectionCard title="Workers">
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <StatCard label="Total registered workers" value={data.workers.total} to="/admin/workers" />
                <StatCard label="Screening complete" value={data.workers.screeningComplete} accent="#2E9E5B" to="/admin/workers" />
                <StatCard label="Screening incomplete" value={data.workers.screeningIncomplete} accent="#E8A32C" to="/admin/workers" />
              </div>
            </SectionCard>

            <SectionCard title="Malaria status (verified diagnostic results only)">
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                {malariaCategories.map((c) => (
                  <StatCard key={c.key} label={c.note} value={data.malaria[c.key]} accent={c.accent} to="/admin/workers" />
                ))}
              </div>
              <p className="muted small" style={{ margin: '10px 0 0' }}>
                Awaiting result and No result recorded are kept strictly separate; missing diagnostics are never inferred as negative.
              </p>
            </SectionCard>

            <SectionCard title="Pending Requests">
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <StatCard label="Pending worker join requests" value={data.requests.pendingJoin} accent="#E8A32C" to="/admin/requests" />
                <StatCard label="Pending transfer requests" value={data.requests.pendingTransfers} accent="#E8A32C" to="/admin/requests" />
              </div>
            </SectionCard>

            <SectionCard title="Travel Surveillance & Alerts">
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <StatCard
                  label="Upcoming positive-worker travels (7-day alert)"
                  value={data.travel.upcomingPositiveTravelReports}
                  accent="#F26457"
                  to="/admin/travel-reports"
                />
                <StatCard label="Unacknowledged reports" value={data.travel.unacknowledgedTravelReports} accent="#F26457" to="/admin/travel-reports" />
              </div>
              <p className="muted small" style={{ margin: '10px 0 0' }}>
                Manage surveillance alerts from <Link to="/admin/travel-reports">Travel Reports</Link>.
              </p>
            </SectionCard>
          </>
        )}
      </ListBody>
      <p className="muted small">Last refreshed {isoDate(new Date().toISOString())}</p>
    </div>
  );
}
