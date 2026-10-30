import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import type { DiagnosticDto, WorkerProfile } from '../../lib/types';
import { Card, Spinner, Banner } from '../../components/ui';
import { MalariaStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

const SPECIES: Record<string, string> = {
  P_FALCIPARUM: 'P. falciparum',
  P_VIVAX: 'P. vivax',
  MIXED: 'Mixed',
  OTHER: 'Other',
  UNKNOWN: 'Unknown',
};

export function MalariaStatus() {
  const profile = useAsync<WorkerProfile>(() => api.get('/workers/me'));
  const diagnostics = useAsync<DiagnosticDto[]>(() => api.get('/records/me/diagnostics'));

  if (profile.loading || diagnostics.loading) return <Spinner />;

  return (
    <div className="stack">
      <Card accent={palette.primary}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>Malaria status</h2>
          {profile.data && <MalariaStatusChip status={profile.data.malariaStatus} />}
        </div>
        <Banner kind="info">Only authorized clinical/laboratory results determine your status. No symptoms does not mean negative.</Banner>
      </Card>

      <Card>
        <h3>Diagnostic results</h3>
        {(diagnostics.data?.length ?? 0) === 0 && <p className="muted">No authorized results recorded yet.</p>}
        <div className="stack">
          {diagnostics.data?.map((d) => (
            <div key={d.id} className="spread" style={{ borderBottom: `1px solid ${palette.border}`, paddingBottom: 10 }}>
              <div>
                <strong>{d.testType}</strong> · {d.result}
                {d.species && <span className="muted small"> · {SPECIES[d.species] ?? d.species}</span>}
              </div>
              <span className="muted small">{new Date(d.testDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
