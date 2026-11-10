import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, TextField, Button, Select } from '../../components/ui';
import { palette, radius } from '../../lib/tokens';
import { MalariaStatusChip } from '../../components/StatusChip';

interface WorkerRow {
  workerCode: string;
  patientId: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  siteCode: string;
  siteName: string;
  active: boolean;
  malariaStatus: 'POSITIVE' | 'NEGATIVE' | null;
}

interface WorkersResponse {
  items: WorkerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function ContractorWorkers() {
  const [search, setSearch] = useState('');
  const [malariaFilter, setMalariaFilter] = useState('ALL');
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(null);

  const { data, loading, error, reload } = useAsync<WorkersResponse>(
    () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (malariaFilter !== 'ALL') params.set('malaria', malariaFilter);
      params.set('pageSize', '50');
      return api.get(`/contractor/workers?${params.toString()}`);
    },
    [search, malariaFilter],
  );

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Page Header */}
      <div className="spread">
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: palette.text }}>Worker Management</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Workforce roster assigned across all your active construction sites
          </p>
        </div>
        <Link to="/contractor/initiate" style={{ textDecoration: 'none' }}>
          <Button variant="secondary">+ Initiate Transfer</Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: '1 1 240px' }}>
            <TextField
              placeholder="Search by worker name, phone or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ width: 180 }}>
            <Select
              value={malariaFilter}
              onChange={(e) => setMalariaFilter(e.target.value)}
            >
              <option value="ALL">All Malaria Statuses</option>
              <option value="NEGATIVE">Negative</option>
              <option value="POSITIVE">Positive</option>
            </Select>
          </div>
          {(search || malariaFilter !== 'ALL') && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setMalariaFilter('ALL');
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </Card>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spinner />
          <p className="muted" style={{ marginTop: 12 }}>Loading workforce…</p>
        </div>
      ) : error ? (
        <div className="stack">
          <Banner kind="danger">{error || 'Failed to load workers.'}</Banner>
          <div>
            <Button onClick={reload}>Retry</Button>
          </div>
        </div>
      ) : (
        <Card>
          <div className="spread" style={{ marginBottom: 16 }}>
            <span className="muted small">
              Showing <strong>{data?.items.length ?? 0}</strong> of <strong>{data?.total ?? 0}</strong> assigned workers
            </span>
          </div>

          {(data?.items.length ?? 0) === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center' }}>
              <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                {search || malariaFilter !== 'ALL'
                  ? 'No workers match the search criteria.'
                  : 'No workers currently assigned to your workforce.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                    <th style={{ padding: '10px 12px' }}>Worker Name</th>
                    <th style={{ padding: '10px 12px' }}>Worker ID</th>
                    <th style={{ padding: '10px 12px' }}>Phone</th>
                    <th style={{ padding: '10px 12px' }}>Assigned Site</th>
                    <th style={{ padding: '10px 12px' }}>Malaria Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((w) => (
                    <tr key={w.workerCode} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px' }}>
                        <strong style={{ color: palette.text }}>{w.name}</strong>
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 13 }}>
                        {w.workerCode}
                      </td>
                      <td style={{ padding: '12px', color: '#64748B' }}>
                        {w.phone ?? '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Link
                          to={`/contractor/sites/${w.siteCode}`}
                          style={{ color: '#3D5A80', textDecoration: 'none', fontWeight: 600 }}
                        >
                          {w.siteName}
                        </Link>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <MalariaStatusChip status={w.malariaStatus ?? 'NO_RESULT'} />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedWorker(w)}
                          style={{
                            background: 'none',
                            border: '1px solid #CBD5E1',
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontSize: 13,
                            cursor: 'pointer',
                            color: '#3D5A80',
                            fontWeight: 600,
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Worker Detail Modal */}
      {selectedWorker && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setSelectedWorker(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: radius.lg,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spread" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, color: palette.text }}>Worker Details</h3>
              <button
                onClick={() => setSelectedWorker(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Full Name</span>
                <strong>{selectedWorker.name}</strong>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Worker ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedWorker.workerCode}</span>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Phone</span>
                <span>{selectedWorker.phone ?? 'Not provided'}</span>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Current Construction Site</span>
                <strong>{selectedWorker.siteName}</strong>
              </div>
              <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="muted">Malaria Status</span>
                <MalariaStatusChip status={selectedWorker.malariaStatus ?? 'NO_RESULT'} />
              </div>
              {selectedWorker.age && (
                <div className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <span className="muted">Demographics</span>
                  <span>{selectedWorker.age} years · {selectedWorker.gender ?? '—'}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <Button onClick={() => setSelectedWorker(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
