import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

const HIGH_RISK_STATES = [
  'odisha',
  'chhattisgarh',
  'jharkhand',
  'west bengal',
  'assam',
  'tripura',
  'meghalaya',
  'mizoram',
];

export function TravelArrivalsPage() {
  const [facilityName, setFacilityName] = useState<string>('');
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [arrivalFever, setArrivalFever] = useState<'yes' | 'no'>('no');
  const [arrivalTestedOrTreated, setArrivalTestedOrTreated] = useState<'yes' | 'no'>('no');
  const [arrivalReferred, setArrivalReferred] = useState<'yes' | 'no'>('no');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await api.get<any>('/health-worker/me');
      const fid = profile.activeFacilityId || profile.assignedFacilities?.[0]?.facilityId;
      if (!fid) {
        setError('No active facility assigned.');
        setLoading(false);
        return;
      }
      const fac = profile.assignedFacilities?.find((f: any) => f.facilityId === fid);
      setFacilityName(fac?.facility?.name || 'Assigned Facility');

      const data = await api.get<any[]>(`/health-worker/travel-arrivals?facilityId=${fid}`);
      setArrivals(data || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load travel arrivals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openScreeningModal = (item: any) => {
    setSelectedItem(item);
    setArrivalFever(item.arrivalFever ? 'yes' : 'no');
    setArrivalTestedOrTreated(item.arrivalTestedOrTreated ? 'yes' : 'no');
    setArrivalReferred(item.arrivalReferred ? 'yes' : 'no');
    setNotes('');
    setActionError(null);
  };

  const handleScreeningSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/travel/${selectedItem.id}/arrival-screening`, {
        arrivalFever: arrivalFever === 'yes',
        arrivalTestedOrTreated: arrivalTestedOrTreated === 'yes',
        arrivalReferred: arrivalReferred === 'yes',
        notes: notes.trim() || undefined,
      });

      setSelectedItem(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to record arrival screening');
    } finally {
      setSubmitting(false);
    }
  };

  const isHighRiskOrigin = (state?: string) => {
    if (!state) return false;
    return HIGH_RISK_STATES.some((s) => state.toLowerCase().includes(s));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Travel & Arrival Screening</h2>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
            Incoming journeys entering Goa • Surveillance Facility: <strong>{facilityName}</strong>
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="panel" style={{ background: '#FEE2E2', color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          Loading travel arrival journeys...
        </div>
      ) : arrivals.length === 0 ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1F6EB;</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>No Incoming Travel Records</div>
          <div style={{ fontSize: 13 }}>No recent journeys entering Goa found for this facility catchment.</div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Worker Subject</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Origin Location</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Travel Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mode</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Arrival Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {arrivals.map((tr) => {
                const highRisk = isHighRiskOrigin(tr.originState);
                const isCompleted =
                  tr.arrivalFever !== null ||
                  tr.arrivalTestedOrTreated !== null ||
                  tr.arrivalReferred !== null;

                return (
                  <tr key={tr.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link
                        to={`/health-worker/workers/${tr.workerId || tr.worker?.id}`}
                        style={{ fontWeight: 600, color: '#006699', textDecoration: 'none' }}
                      >
                        {tr.worker?.name || 'Worker'}
                      </Link>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Code: {tr.worker?.workerCode || 'N/A'} {tr.worker?.phone ? `• ${tr.worker.phone}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>
                          {tr.originDistrict ? `${tr.originDistrict}, ` : ''}
                          {tr.originState || 'Unknown'}
                        </span>
                        {highRisk && (
                          <span
                            style={{
                              background: '#FEE2E2',
                              color: '#991B1B',
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 700,
                            }}
                          >
                            HIGH RISK
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {tr.travelDate ? new Date(tr.travelDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {tr.transportMode || 'TRAIN'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isCompleted ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: '#DCFCE7',
                              color: '#166534',
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Screened
                          </span>
                          {tr.arrivalFever && (
                            <span
                              style={{
                                background: '#FEE2E2',
                                color: '#991B1B',
                                padding: '3px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              Fever
                            </span>
                          )}
                          {tr.arrivalReferred && (
                            <span
                              style={{
                                background: '#FEF3C7',
                                color: '#92400E',
                                padding: '3px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              Referred
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            background: '#FEF3C7',
                            color: '#92400E',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Pending Screening
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => openScreeningModal(tr)}
                        style={{
                          background: isCompleted ? '#F1F5F9' : '#006699',
                          color: isCompleted ? '#334155' : '#fff',
                          border: isCompleted ? '1px solid #CBD5E1' : 'none',
                          borderRadius: 4,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isCompleted ? 'Edit Screening' : 'Screen on Arrival'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Arrival Screening Modal */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: 540,
              background: '#fff',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Record Arrival Screening
            </h3>
            <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>
              Worker: <strong>{selectedItem.worker?.name || 'Worker'}</strong> ({selectedItem.worker?.workerCode}) • Returning from <strong>{selectedItem.originState || 'Origin'}</strong>
            </p>

            {actionError && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleScreeningSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Does the worker have a fever upon arrival?
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="arrFever"
                      checked={arrivalFever === 'yes'}
                      onChange={() => setArrivalFever('yes')}
                    />
                    Yes (Fever present)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="arrFever"
                      checked={arrivalFever === 'no'}
                      onChange={() => setArrivalFever('no')}
                    />
                    No
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Was the worker tested or treated for malaria during travel or en route?
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="arrTested"
                      checked={arrivalTestedOrTreated === 'yes'}
                      onChange={() => setArrivalTestedOrTreated('yes')}
                    />
                    Yes
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="arrTested"
                      checked={arrivalTestedOrTreated === 'no'}
                      onChange={() => setArrivalTestedOrTreated('no')}
                    />
                    No
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Refer worker to PHC / UHC for diagnostic testing or treatment?
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="arrRef"
                      checked={arrivalReferred === 'yes'}
                      onChange={() => setArrivalReferred('yes')}
                    />
                    Yes (Refer to Facility)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="arrRef"
                      checked={arrivalReferred === 'no'}
                      onChange={() => setArrivalReferred('no')}
                    />
                    No
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Screening Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record travel details, contact with fever cases, advice given..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  style={{
                    background: '#F1F5F9',
                    color: '#334155',
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#006699',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Saving...' : 'Save Arrival Screening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
