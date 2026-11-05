import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

export function FollowUpsPage() {
  const [facilityName, setFacilityName] = useState<string>('');
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [visitOutcome, setVisitOutcome] = useState<'COMPLETED' | 'PATIENT_UNAVAILABLE' | 'REFUSED' | 'RESCHEDULED'>('COMPLETED');
  const [referralAttended, setReferralAttended] = useState<'yes' | 'no'>('yes');
  const [adherenceConfirmed, setAdherenceConfirmed] = useState<'yes' | 'no'>('yes');
  const [temperature, setTemperature] = useState('37.0');
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

      const data = await api.get<any[]>(`/health-worker/follow-ups?facilityId=${fid}`);
      setFollowUps(data || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load follow-up schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openOutcomeModal = (fu: any) => {
    setSelectedItem(fu);
    setVisitOutcome('COMPLETED');
    setReferralAttended('yes');
    setAdherenceConfirmed('yes');
    setTemperature('37.0');
    setNotes('');
    setActionError(null);
  };

  const handleOutcomeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setSubmitting(true);
    setActionError(null);
    try {
      await api.post('/health-worker/follow-ups', {
        followUpId: selectedItem.id,
        visitOutcome,
        referralAttended: referralAttended === 'yes',
        adherenceConfirmed: adherenceConfirmed === 'yes',
        temperature: temperature ? parseFloat(temperature) : undefined,
        notes: notes.trim() || undefined,
      });

      setSelectedItem(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to record visit outcome');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Follow-Up & Referral Management</h2>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
            Facility: <strong>{facilityName}</strong>
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
          Refresh List
        </button>
      </div>

      {error && (
        <div className="panel" style={{ background: '#FEE2E2', color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          Loading pending follow-ups...
        </div>
      ) : followUps.length === 0 ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#x2714;&#xFE0F;</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>No Pending Follow-ups</div>
          <div style={{ fontSize: 13 }}>All registered workers in this facility surveillance area are up to date.</div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Worker Subject</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Scheduled Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Purpose / Type</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map((fu) => {
                const isPending = fu.status === 'SCHEDULED' || fu.status === 'PENDING';
                return (
                  <tr key={fu.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link
                        to={`/health-worker/workers/${fu.workerId || fu.worker?.id}`}
                        style={{ fontWeight: 600, color: '#006699', textDecoration: 'none' }}
                      >
                        {fu.worker?.name || 'Worker'}
                      </Link>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Code: {fu.worker?.workerCode || 'N/A'} {fu.worker?.phone ? `• ${fu.worker.phone}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {fu.scheduledDate ? new Date(fu.scheduledDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          background: '#EFF6FF',
                          color: '#1E40AF',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {fu.type || 'Post-Screening Check'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          background: isPending ? '#FEF3C7' : '#DCFCE7',
                          color: isPending ? '#92400E' : '#166534',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {fu.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {isPending ? (
                        <button
                          onClick={() => openOutcomeModal(fu)}
                          style={{
                            background: '#006699',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Record Outcome
                        </button>
                      ) : (
                        <span style={{ color: '#166534', fontSize: 12, fontWeight: 500 }}>Completed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Outcome Recording Modal */}
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
              Record Follow-Up Outcome
            </h3>
            <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>
              Worker: <strong>{selectedItem.worker?.name || 'Worker'}</strong> ({selectedItem.worker?.workerCode})
            </p>

            {actionError && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleOutcomeSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Visit Outcome
                </label>
                <select
                  value={visitOutcome}
                  onChange={(e) => setVisitOutcome(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                >
                  <option value="COMPLETED">Completed (Worker Evaluated)</option>
                  <option value="PATIENT_UNAVAILABLE">Patient Unavailable / Not Found</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="REFUSED">Refused Visit / Evaluation</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Referral Attended?
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="radio"
                        name="refAttended"
                        checked={referralAttended === 'yes'}
                        onChange={() => setReferralAttended('yes')}
                      />
                      Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="radio"
                        name="refAttended"
                        checked={referralAttended === 'no'}
                        onChange={() => setReferralAttended('no')}
                      />
                      No
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Treatment Adherence?
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="radio"
                        name="adhConfirmed"
                        checked={adherenceConfirmed === 'yes'}
                        onChange={() => setAdherenceConfirmed('yes')}
                      />
                      Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="radio"
                        name="adhConfirmed"
                        checked={adherenceConfirmed === 'no'}
                        onChange={() => setAdherenceConfirmed('no')}
                      />
                      No
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Current Body Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="34"
                  max="43"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Clinical & Follow-up Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record symptoms observed, advice given, medication check..."
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
                  {submitting ? 'Saving...' : 'Confirm & Save Outcome'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
