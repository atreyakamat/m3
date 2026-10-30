import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import type { PrescriptionDto } from '../../lib/types';
import { Card, Spinner, Banner } from '../../components/ui';
import { palette } from '../../lib/tokens';

export function Prescriptions() {
  const [tab, setTab] = useState<'current' | 'history'>('current');
  const current = useAsync<PrescriptionDto | null>(() => api.get('/records/me/prescriptions/current'));
  const history = useAsync<PrescriptionDto[]>(() => api.get('/records/me/prescriptions/history'));

  return (
    <div className="stack">
      <div className="nav-tabs">
        <button className="nav-tab" onClick={() => setTab('current')} style={tabStyle(tab === 'current')}>Current</button>
        <button className="nav-tab" onClick={() => setTab('history')} style={tabStyle(tab === 'history')}>History</button>
      </div>

      {tab === 'current' ? (
        current.loading ? <Spinner /> : (
          <Card accent={palette.primary}>
            <h2>Current prescription</h2>
            {current.data ? (
              <>
                <p style={{ fontSize: 17 }}>{current.data.details}</p>
                <div className="muted small">Issued {new Date(current.data.issuedAt).toLocaleDateString()}</div>
                <Banner kind="info">Show this at a physical pharmacy. The app does not dispense medication.</Banner>
              </>
            ) : (
              <p className="muted">No current prescription.</p>
            )}
          </Card>
        )
      ) : history.loading ? <Spinner /> : (
        <Card>
          <h2>Prescription history</h2>
          {(history.data?.length ?? 0) === 0 && <p className="muted">No prescriptions on record.</p>}
          <div className="stack">
            {history.data?.map((p) => (
              <div key={p.id} style={{ borderBottom: `1px solid ${palette.border}`, paddingBottom: 10 }}>
                <div>{p.details}</div>
                <div className="muted small">Issued {new Date(p.issuedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function tabStyle(active: boolean) {
  return active ? { background: palette.primary, color: '#fff', borderColor: 'transparent' } : {};
}
