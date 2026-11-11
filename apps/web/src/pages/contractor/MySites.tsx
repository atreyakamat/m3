import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Card, Spinner, Button, Banner, TextField } from '../../components/ui';
import { palette } from '../../lib/tokens';

export interface ContractorSite {
  siteId: string;
  siteCode: string;
  name: string;
  area: string;
  address?: string | null;
  landmark?: string | null;
  contactPhone?: string | null;
  activeWorkers: number;
  active: boolean;
  assignmentStatus?: string;
  isPrimary?: boolean;
}

export function MySites() {
  const [search, setSearch] = useState('');

  const { data, loading, error, reload } = useAsync<ContractorSite[]>(
    () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      return api.get(`/contractor/sites?${params.toString()}`);
    },
    [search],
  );

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Page Header */}
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, color: palette.text }}>Site Operations & Overview</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Construction sites assigned to your contractor account ({data?.length ?? 0} sites)
          </p>
        </div>
        <Link to="/contractor" style={{ textDecoration: 'none' }}>
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>

      {/* Search Bar */}
      <Card>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: '1 1 300px' }}>
            <TextField
              placeholder="Search assigned sites by name, area, address, or site code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <Button variant="secondary" onClick={() => setSearch('')}>
              Clear Search
            </Button>
          )}
        </div>
      </Card>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spinner />
          <p className="muted" style={{ marginTop: 12 }}>Loading construction sites…</p>
        </div>
      ) : error ? (
        <div className="stack" style={{ gap: 16 }}>
          <Banner kind="danger">{error || 'Failed to load sites.'}</Banner>
          <div>
            <Button onClick={reload}>Retry</Button>
          </div>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {data?.map((s) => (
            <Card key={s.siteCode} accent={palette.secondary}>
              {/* Site Card Header */}
              <div className="spread" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: palette.text }}>{s.name}</h3>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.siteCode}</span> · {s.area}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: s.active ? '#ECFDF5' : '#F1F5F9',
                      color: s.active ? '#065F46' : '#64748B',
                    }}
                  >
                    {s.active ? 'Active Site' : 'Inactive'}
                  </span>
                  {s.assignmentStatus && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: s.isPrimary ? '#EFF6FF' : '#F8FAFC',
                        color: s.isPrimary ? '#1D4ED8' : '#64748B',
                      }}
                    >
                      {s.isPrimary ? 'Primary Contractor' : 'Associated Site'}
                    </span>
                  )}
                </div>
              </div>

              {/* Address & Operational Info */}
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  background: '#F8FAFC',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#475569',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div>
                  <strong>Address:</strong> {[s.address, s.landmark].filter(Boolean).join(', ') || 'Address on record'}
                </div>
                {s.contactPhone && (
                  <div>
                    <strong>Contact:</strong> {s.contactPhone}
                  </div>
                )}
              </div>

              {/* Active Workforce Number */}
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#3D5A80' }}>
                  {s.activeWorkers}
                </div>
                <div className="muted small">workers currently assigned</div>
              </div>

              {/* Footer Actions */}
              <div
                className="spread"
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #F1F5F9',
                  alignItems: 'center',
                }}
              >
                <Link
                  to={`/contractor/workers?siteCode=${s.siteCode}`}
                  style={{
                    color: '#64748B',
                    fontSize: 13,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  View Workers ({s.activeWorkers})
                </Link>

                <Link
                  to={`/contractor/sites/${s.siteCode}`}
                  style={{
                    display: 'inline-block',
                    color: '#3D5A80',
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: 'none',
                  }}
                >
                  Site Details →
                </Link>
              </div>
            </Card>
          ))}

          {(data?.length ?? 0) === 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <Card>
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <p className="muted" style={{ margin: 0, fontSize: 16 }}>
                    {search
                      ? `No assigned sites matching "${search}".`
                      : 'No construction sites currently assigned to your account. Please contact the administrator.'}
                  </p>
                  {search && (
                    <div style={{ marginTop: 12 }}>
                      <Button variant="secondary" onClick={() => setSearch('')}>
                        Clear Search
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
