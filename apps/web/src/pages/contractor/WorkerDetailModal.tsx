import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Spinner, Banner, Button, Chip } from '../../components/ui';
import { palette, radius } from '../../lib/tokens';

export interface WorkerDetailData {
  workerId: string;
  workerCode: string;
  patientId: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  currentSite: {
    siteId: string;
    siteCode: string;
    name: string;
    startedAt: string | null;
  } | null;
  active: boolean;
  assignmentStatus: string;
  startedAt: string | null;
  malariaStatus: null;
  entryHistory: Array<{
    id: string;
    originTown: string | null;
    originDistrict: string | null;
    originState: string | null;
    purpose: string | null;
    arrivalDate: string;
    status: string;
  }>;
  exitHistory: Array<{
    id: string;
    destination: string | null;
    town: string | null;
    state: string | null;
    departureDate: string;
    returnDate: string | null;
    purpose: string | null;
    status: string;
  }>;
  transfers: Array<{
    id: string;
    fromSite: { siteCode: string; name: string } | null;
    toSite: { siteCode: string; name: string };
    initiator: string;
    status: string;
    createdAt: string;
    effectiveAt: string | null;
  }>;
}

export function AssignmentStatusBadge({ status }: { status?: string | null }) {
  const norm = (status || 'ACTIVE').toUpperCase();
  if (norm === 'ACTIVE') {
    return <Chip bg="#ECFDF5" fg="#065F46">Active</Chip>;
  }
  if (norm === 'TRANSFERRED') {
    return <Chip bg="#EFF6FF" fg="#1E40AF">Transferred</Chip>;
  }
  return <Chip bg="#F1F5F9" fg="#475569">Inactive</Chip>;
}

export function WorkerDetailModal({
  workerCode,
  onClose,
}: {
  workerCode: string | null;
  onClose: () => void;
}) {
  const { data, loading, error, reload } = useAsync<WorkerDetailData>(
    () => {
      if (!workerCode) return Promise.reject(new Error('No worker code provided'));
      return api.get(`/contractor/workers/${workerCode}`);
    },
    [workerCode],
  );

  if (!workerCode) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: radius.lg,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="spread"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 20, color: palette.text, fontWeight: 700 }}>
              {data?.name ?? 'Worker Details'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748B', fontWeight: 600 }}>
                {workerCode}
              </span>
              {data && <AssignmentStatusBadge status={data.assignmentStatus} />}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: '#64748B',
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spinner />
              <p className="muted" style={{ marginTop: 12 }}>Loading worker information…</p>
            </div>
          ) : error || !data ? (
            <div className="stack" style={{ gap: 16 }}>
              <Banner kind="danger">{error || 'Failed to load worker details.'}</Banner>
              <div style={{ textAlign: 'center' }}>
                <Button onClick={reload}>Retry</Button>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 24 }}>
              {/* Basic Worker Information */}
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: 8,
                  padding: 16,
                  border: '1px solid #E2E8F0',
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Worker Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div>
                    <div className="muted small">Phone</div>
                    <div style={{ fontWeight: 600, color: palette.text, marginTop: 2 }}>
                      {data.phone || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="muted small">Age</div>
                    <div style={{ fontWeight: 600, color: palette.text, marginTop: 2 }}>
                      {data.age ? `${data.age} years` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="muted small">Gender</div>
                    <div style={{ fontWeight: 600, color: palette.text, marginTop: 2, textTransform: 'capitalize' }}>
                      {data.gender || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Site Assignment */}
              <div
                style={{
                  background: '#F0F9FF',
                  borderRadius: 8,
                  padding: 16,
                  border: '1px solid #BAE6FD',
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0369A1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Current Site Assignment
                </h4>
                {data.currentSite ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                      <div className="muted small" style={{ color: '#0284C7' }}>Site Name</div>
                      <div style={{ fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                        {data.currentSite.name}
                      </div>
                    </div>
                    <div>
                      <div className="muted small" style={{ color: '#0284C7' }}>Site Code</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                        {data.currentSite.siteCode}
                      </div>
                    </div>
                    <div>
                      <div className="muted small" style={{ color: '#0284C7' }}>Assigned Since</div>
                      <div style={{ fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                        {data.startedAt ? new Date(data.startedAt).toLocaleDateString() : '—'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>No active site assignment on record.</p>
                )}
              </div>

              {/* Entry in Goa History */}
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: palette.text, fontWeight: 700 }}>
                  Entry in Goa History
                </h4>
                {data.entryHistory.length === 0 ? (
                  <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 6, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                    No recorded entry travel records for this worker.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                      <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <tr>
                          <th style={{ padding: '8px 12px' }}>Origin</th>
                          <th style={{ padding: '8px 12px' }}>Arrival Date</th>
                          <th style={{ padding: '8px 12px' }}>Purpose</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.entryHistory.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: palette.text }}>
                              {[entry.originTown, entry.originDistrict, entry.originState].filter(Boolean).join(', ') || '—'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {new Date(entry.arrivalDate).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {entry.purpose || 'Work'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#0D9488' }}>
                                {entry.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Exit from Goa History */}
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: palette.text, fontWeight: 700 }}>
                  Exit from Goa History
                </h4>
                {data.exitHistory.length === 0 ? (
                  <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 6, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                    No recorded exit travel records for this worker.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                      <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <tr>
                          <th style={{ padding: '8px 12px' }}>Destination</th>
                          <th style={{ padding: '8px 12px' }}>Departure</th>
                          <th style={{ padding: '8px 12px' }}>Expected Return</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.exitHistory.map((exit) => (
                          <tr key={exit.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: palette.text }}>
                              {[exit.destination || exit.town, exit.state].filter(Boolean).join(', ') || 'Hometown'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {new Date(exit.departureDate).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {exit.returnDate ? new Date(exit.returnDate).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
                                {exit.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Relevant Transfer Status */}
              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: 15, color: palette.text, fontWeight: 700 }}>
                  Relevant Site Transfers
                </h4>
                {data.transfers.length === 0 ? (
                  <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 6, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                    No site transfer requests on record for this worker.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                      <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <tr>
                          <th style={{ padding: '8px 12px' }}>From Site</th>
                          <th style={{ padding: '8px 12px' }}>To Site</th>
                          <th style={{ padding: '8px 12px' }}>Initiator</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px' }}>Requested</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.transfers.map((tr) => (
                          <tr key={tr.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {tr.fromSite?.name ?? '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: palette.text }}>
                              {tr.toSite.name}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {tr.initiator}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: tr.status.includes('REJECTED')
                                    ? '#DC2626'
                                    : tr.status.includes('ACCEPTED')
                                    ? '#16A34A'
                                    : '#D97706',
                                }}
                              >
                                {tr.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {new Date(tr.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            textAlign: 'right',
          }}
        >
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
