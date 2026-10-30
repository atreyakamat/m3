import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import type { WorkerProfile } from '../../lib/types';
import { LANGUAGE_LABELS, type Language } from '@m3/shared';
import { Card, Spinner, Banner } from '../../components/ui';
import { MalariaStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="spread" style={{ borderBottom: `1px solid ${palette.border}`, padding: '8px 0' }}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Profile() {
  const { data, loading, error } = useAsync<WorkerProfile>(() => api.get('/workers/me'));
  if (loading) return <Spinner />;
  if (error || !data) return <Banner kind="danger">{error ?? 'Error'}</Banner>;

  return (
    <div className="stack">
      <Card accent={palette.primary}>
        <h2>Profile</h2>
        <Row label="Name" value={data.name} />
        <Row label="Worker ID" value={data.workerId} />
        <Row label="Phone" value={data.phone} />
        <Row label="Preferred language" value={LANGUAGE_LABELS[data.preferredLanguage as Language] ?? data.preferredLanguage} />
        <Row label="Current site" value={data.currentSite ? `${data.currentSite.name} (${data.currentSite.siteId})` : 'None'} />
        <Row label="Screening" value={data.screening.status} />
      </Card>
      <Card>
        <div className="spread">
          <span className="muted">Malaria status</span>
          <MalariaStatusChip status={data.malariaStatus} />
        </div>
        <Banner kind="info">Official diagnostic results are read-only and cannot be changed here.</Banner>
      </Card>
    </div>
  );
}
