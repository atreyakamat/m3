import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Banner, TextField, Button, Select } from '../../components/ui';
import { palette } from '../../lib/tokens';
import { WorkerDetailModal, AssignmentStatusBadge } from './WorkerDetailModal';

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
  assignmentStatus: string;
  startedAt: string | null;
}

interface WorkersResponse {
  items: WorkerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface SiteOption {
  siteCode: string;
  name: string;
}

export function ContractorWorkers() {
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [selectedWorkerCode, setSelectedWorkerCode] = useState<string | null>(null);

  // Load sites for the site dropdown filter
  const { data: sitesData } = useAsync<SiteOption[]>(() => api.get('/contractor/sites'), []);

  // Load workers with search, filters, and pagination
  const { data, loading, error, reload } = useAsync<WorkersResponse>(
    () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (siteFilter !== 'ALL') params.set('siteCode', siteFilter);
      if (statusFilter !== 'ALL') params.set('assignmentStatus', statusFilter);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      return api.get(`/contractor/workers?${params.toString()}`);
    },
    [search, siteFilter, statusFilter, page],
  );

  const isFiltered = Boolean(search.trim() || siteFilter !== 'ALL' || statusFilter !== 'ALL');

  const clearFilters = () => {
    setSearch('');
    setSiteFilter('ALL');
    setStatusFilter('ALL');
    setPage(1);
  };

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
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <TextField
              placeholder="Search by worker name, ID or phone…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ width: 220 }}>
            <Select
              value={siteFilter}
              onChange={(e) => {
                setSiteFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Construction Sites</option>
              {sitesData?.map((s) => (
                <option key={s.siteCode} value={s.siteCode}>
                  {s.name} ({s.siteCode})
                </option>
              ))}
            </Select>
          </div>

          <div style={{ width: 180 }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Workers</option>
              <option value="INACTIVE">Inactive / Ended</option>
              <option value="TRANSFERRED">Transferred</option>
            </Select>
          </div>

          {isFiltered && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear Filters
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
        <div className="stack" style={{ gap: 16 }}>
          <Banner kind="danger">{error || 'Failed to load workers.'}</Banner>
          <div>
            <Button onClick={reload}>Retry</Button>
          </div>
        </div>
      ) : (
        <Card>
          <div className="spread" style={{ marginBottom: 16 }}>
            <span className="muted small">
              Showing{' '}
              <strong>
                {data?.total === 0 ? 0 : (data?.page ?? 1 - 1) * pageSize + 1}–
                {Math.min((data?.page ?? 1) * pageSize, data?.total ?? 0)}
              </strong>{' '}
              of <strong>{data?.total ?? 0}</strong> assigned workers
            </span>
          </div>

          {(data?.items.length ?? 0) === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center' }}>
              <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                {isFiltered
                  ? 'No workers match the selected search or filter criteria.'
                  : 'No workers currently assigned to your workforce.'}
              </p>
              {isFiltered && (
                <div style={{ marginTop: 12 }}>
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 13 }}>
                      <th style={{ padding: '10px 12px' }}>Worker Name</th>
                      <th style={{ padding: '10px 12px' }}>Worker ID</th>
                      <th style={{ padding: '10px 12px' }}>Demographics</th>
                      <th style={{ padding: '10px 12px' }}>Assigned Site</th>
                      <th style={{ padding: '10px 12px' }}>Assignment Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((w) => (
                      <tr key={w.workerCode} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px' }}>
                          <strong style={{ color: palette.text }}>{w.name}</strong>
                          {w.phone && (
                            <div className="muted small" style={{ marginTop: 2 }}>
                              {w.phone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 13 }}>
                          {w.workerCode}
                        </td>
                        <td style={{ padding: '12px', color: '#64748B', fontSize: 13 }}>
                          {w.age ? `${w.age} yrs` : '—'} · {w.gender || '—'}
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
                          <AssignmentStatusBadge status={w.assignmentStatus} />
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedWorkerCode(w.workerCode)}
                            style={{
                              background: 'none',
                              border: '1px solid #CBD5E1',
                              borderRadius: 6,
                              padding: '5px 12px',
                              fontSize: 13,
                              cursor: 'pointer',
                              color: '#3D5A80',
                              fontWeight: 600,
                            }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(data?.totalPages ?? 1) > 1 && (
                <div
                  className="spread"
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid #F1F5F9',
                    alignItems: 'center',
                  }}
                >
                  <span className="muted small">
                    Page <strong>{data?.page}</strong> of <strong>{data?.totalPages}</strong>
                  </span>
                  <div className="row" style={{ gap: 8 }}>
                    <Button
                      variant="secondary"
                      disabled={(data?.page ?? 1) <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ← Previous
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={(data?.page ?? 1) >= (data?.totalPages ?? 1)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Reusable Worker Detail Modal */}
      {selectedWorkerCode && (
        <WorkerDetailModal
          workerCode={selectedWorkerCode}
          onClose={() => setSelectedWorkerCode(null)}
        />
      )}
    </div>
  );
}
