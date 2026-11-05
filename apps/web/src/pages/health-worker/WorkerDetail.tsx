import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

export function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get<any>(`/health-worker/workers/${id}`);
      setWorker(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load worker details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return <div className="panel" style={{ padding: 32, textAlign: 'center' }}>Loading worker record...</div>;
  }

  if (error || !worker) {
    return (
      <div className="panel" style={{ background: '#FEE2E2', color: '#991B1B' }}>
        {error || 'Worker not found'}
      </div>
    );
  }

  const site = worker.assignments?.[0]?.site;
  const screening = worker.screening;
  const episodes = worker.episodes || [];
  const household = worker.householdMembers || [];
  const travels = worker.travelRecords || [];

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16, alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>{worker.name}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Worker Code: <strong style={{ color: 'var(--primary)' }}>{worker.workerCode}</strong> · 📱 {worker.phone} · 🌐 {(worker.preferredLanguage || 'en').toUpperCase()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate(`/health-worker/screening?workerId=${worker.id}&workerName=${encodeURIComponent(worker.name)}`)}
            style={{
              background: 'var(--primary, #0E7C86)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📋 Screen Worker
          </button>
          <button
            onClick={() => navigate(`/health-worker/cases?workerId=${worker.id}&workerName=${encodeURIComponent(worker.name)}`)}
            style={{
              background: '#F59E0B',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🤒 Record Suspected Case
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Registration & Screening Summary */}
        <div className="panel">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Registration & Baseline Screening</h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-muted)', padding: '6px 0' }}>Current Site:</td>
                <td style={{ fontWeight: 600 }}>{site?.name || 'Unassigned'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)', padding: '6px 0' }}>Screening Status:</td>
                <td>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      background: screening?.status === 'COMPLETE' ? '#DCFCE7' : '#FEF3C7',
                      color: screening?.status === 'COMPLETE' ? '#166534' : '#92400E',
                    }}
                  >
                    {screening?.status || 'Awaiting Screening'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)', padding: '6px 0' }}>Screening Facility:</td>
                <td style={{ fontWeight: 600 }}>{screening?.facility?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)', padding: '6px 0' }}>Screened By:</td>
                <td style={{ fontWeight: 600 }}>{screening?.screenedBy?.displayName || 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)', padding: '6px 0' }}>Completed Date:</td>
                <td style={{ fontWeight: 600 }}>
                  {screening?.completedAt ? new Date(screening.completedAt).toLocaleString() : 'N/A'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Registered Household Members */}
        <div className="panel">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Registered Family & Roommates ({household.length})
          </h3>
          {household.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No registered family members.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {household.map((hh: any) => (
                <div key={hh.id} className="spread" style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{hh.fullName || 'Family Member'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {hh.memberCode} · {hh.relationship} {hh.isDependent ? '(Dependent)' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/health-worker/screening?memberId=${hh.id}&memberName=${encodeURIComponent(hh.fullName || '')}`)}
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Screen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clinical Episodes & Diagnostic Results */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Malaria Surveillance Episodes & Diagnostic Results ({episodes.length})
        </h3>
        {episodes.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recorded malaria episodes for this worker.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {episodes.map((ep: any) => (
              <div key={ep.id} style={{ border: '1px solid #E2E8F0', borderRadius: 6, padding: 12 }}>
                <div className="spread" style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    Episode Status: <span style={{ color: ep.status === 'CONFIRMED' ? '#EF4444' : '#F59E0B' }}>{ep.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Recorded: {new Date(ep.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {ep.diagnostics?.length > 0 ? (
                  <div style={{ fontSize: 13, background: '#F8FAFC', padding: 8, borderRadius: 4 }}>
                    {ep.diagnostics.map((diag: any) => (
                      <div key={diag.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span>🔬 <strong>{diag.testType}</strong></span>
                        <span style={{ fontWeight: 700, color: diag.result === 'POSITIVE' ? '#EF4444' : '#10B981' }}>
                          Result: {diag.result}
                        </span>
                        {diag.species && <span>Species: {diag.species}</span>}
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          Date: {new Date(diag.testDate).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Test requested — awaiting laboratory confirmation.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Travel Records */}
      <div className="panel">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Recent Travel Journeys ({travels.length})</h3>
        {travels.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No travel records submitted.</div>
        ) : (
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Direction</th>
                <th style={{ padding: '8px 10px' }}>Origin / Destination</th>
                <th style={{ padding: '8px 10px' }}>Fever / Treatment</th>
                <th style={{ padding: '8px 10px' }}>Arrival Screening</th>
              </tr>
            </thead>
            <tbody>
              {travels.map((tr: any) => (
                <tr key={tr.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                    {tr.direction === 'ENTERING_GOA' ? '📥 Entering Goa' : '📤 Leaving Goa'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>{tr.originState || tr.state || 'N/A'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {tr.hadFeverOrMalaria ? <span style={{ color: '#EF4444', fontWeight: 600 }}>⚠️ Had Fever</span> : 'No fever'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {tr.arrivalFacilityId ? (
                      <span style={{ color: '#166534', fontWeight: 600 }}>✓ Screened</span>
                    ) : (
                      <span style={{ color: '#F59E0B' }}>Pending Arrival Screening</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
