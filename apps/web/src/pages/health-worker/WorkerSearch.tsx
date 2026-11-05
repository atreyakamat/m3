import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

export function WorkerSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    workers: any[];
    householdMembers: any[];
  } | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ workers: any[]; householdMembers: any[] }>(
        `/health-worker/search?q=${encodeURIComponent(q)}`,
      );
      setResults(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Worker & Household Identification</h2>

      {error && (
        <div className="panel" style={{ background: '#FEE2E2', color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleSearch} className="panel" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by Worker ID (M3-...), Name, Mobile Phone, or QR code..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'var(--primary, #0E7C86)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 6,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Search Results */}
      {results && (
        <div>
          {/* Household Members */}
          {results.householdMembers.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
                Registered Family Members & Roommates ({results.householdMembers.length})
              </h3>
              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 13 }}>
                      <th style={{ padding: '10px 14px' }}>Member Code</th>
                      <th style={{ padding: '10px 14px' }}>Name</th>
                      <th style={{ padding: '10px 14px' }}>Relationship</th>
                      <th style={{ padding: '10px 14px' }}>Primary Worker</th>
                      <th style={{ padding: '10px 14px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.householdMembers.map((hh) => (
                      <tr key={hh.id} style={{ borderBottom: '1px solid #E2E8F0', fontSize: 14 }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary)' }}>{hh.memberCode}</td>
                        <td style={{ padding: '10px 14px' }}>{hh.fullName || 'Family Member'}</td>
                        <td style={{ padding: '10px 14px' }}>{hh.relationship}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {(hh.worker || hh.primaryWorker)?.name || 'Worker'} ({(hh.worker || hh.primaryWorker)?.workerCode || ''})
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button
                            onClick={() => navigate(`/health-worker/screening?memberId=${hh.id}&memberName=${encodeURIComponent(hh.fullName || '')}`)}
                            style={{
                              background: 'var(--primary)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Screen Member
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Workers */}
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            Migrant Workers ({results.workers.length})
          </h3>
          {results.workers.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
              No worker records match your search criteria.
            </div>
          ) : (
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 13 }}>
                    <th style={{ padding: '10px 14px' }}>Worker ID</th>
                    <th style={{ padding: '10px 14px' }}>Name</th>
                    <th style={{ padding: '10px 14px' }}>Phone</th>
                    <th style={{ padding: '10px 14px' }}>Current Site</th>
                    <th style={{ padding: '10px 14px' }}>Screening Status</th>
                    <th style={{ padding: '10px 14px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.workers.map((w) => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #E2E8F0', fontSize: 14 }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary)' }}>{w.workerCode}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{w.name}</td>
                      <td style={{ padding: '10px 14px' }}>{w.phone}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{w.currentSite || 'Unassigned'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            background: w.screeningStatus === 'COMPLETE' ? '#DCFCE7' : '#FEF3C7',
                            color: w.screeningStatus === 'COMPLETE' ? '#166534' : '#92400E',
                          }}
                        >
                          {w.screeningStatus === 'COMPLETE' ? 'Screened' : 'Awaiting Screening'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                        <Link
                          to={`/health-worker/workers/${w.id}`}
                          style={{
                            background: '#F1F5F9',
                            color: 'var(--text)',
                            textDecoration: 'none',
                            borderRadius: 4,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => navigate(`/health-worker/screening?workerId=${w.id}&workerName=${encodeURIComponent(w.name)}`)}
                          style={{
                            background: 'var(--primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Screen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
