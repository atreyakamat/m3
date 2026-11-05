import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

export function ScreeningFormPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const workerId = params.get('workerId');
  const workerName = params.get('workerName');
  const memberId = params.get('memberId');
  const memberName = params.get('memberName');

  const isHousehold = Boolean(memberId);
  const subjectName = isHousehold ? memberName : workerName;

  const [activeFacilityId, setActiveFacilityId] = useState('');
  const [facilities, setFacilities] = useState<any[]>([]);
  const [feverToday, setFeverToday] = useState<'yes' | 'no'>('no');
  const [chills, setChills] = useState<'yes' | 'no'>('no');
  const [headache, setHeadache] = useState<'yes' | 'no'>('no');
  const [antimalarialTaken, setAntimalarialTaken] = useState<'yes' | 'no'>('no');
  const [temperature, setTemperature] = useState('');
  const [observations, setObservations] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<any>('/health-worker/me')
      .then((p) => {
        setFacilities(p.assignedFacilities);
        setActiveFacilityId(p.activeFacility?.id || p.assignedFacilities[0]?.id || '');
      })
      .catch(() => undefined);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeFacilityId) {
      setError('Please select an active facility for this screening record.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isHousehold && memberId) {
        const symptoms: string[] = [];
        if (feverToday === 'yes') symptoms.push('fever');
        if (chills === 'yes') symptoms.push('chills');
        if (headache === 'yes') symptoms.push('headache');

        await api.post('/health-worker/household-screening', {
          memberId,
          facilityId: activeFacilityId,
          symptoms,
          examinationFindings: `Temp: ${temperature || 'Normal'}. ${observations}`.trim(),
          testRequested: feverToday === 'yes' || chills === 'yes',
          clinicalHistory: antimalarialTaken === 'yes' ? 'Reported antimalarials in past 28 days' : 'None',
        });
      } else if (workerId) {
        await api.post('/health-worker/screening', {
          workerId,
          facilityId: activeFacilityId,
          answers: {
            fever_today: feverToday,
            chills,
            headache,
            antimalarial_past_28_days: antimalarialTaken,
            temperature: temperature || null,
          },
          clinicalObservations: observations.trim() || null,
          isAssisted: true,
        });
      }
      navigate('/health-worker');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save screening');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        {isHousehold ? 'Household Member Clinical Screening' : 'Assisted Health Worker Screening'}
      </h2>

      {error && (
        <div className="panel" style={{ background: '#FEE2E2', color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Subject for Screening
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>
            {subjectName || 'Patient Subject'}
          </div>
        </div>

        {/* Screening Facility Selector */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Attributed Screening Facility *
          </label>
          <select
            value={activeFacilityId}
            onChange={(e) => setActiveFacilityId(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14 }}
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.type}) · {f.taluka}
              </option>
            ))}
          </select>
        </div>

        {/* Question 1: Fever */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            1. Does the patient currently have fever or high body temperature?
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setFeverToday('yes')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: feverToday === 'yes' ? '2px solid #EF4444' : '1px solid #CBD5E1',
                background: feverToday === 'yes' ? '#FEF2F2' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔥 Yes, Fever Present
            </button>
            <button
              type="button"
              onClick={() => setFeverToday('no')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: feverToday === 'no' ? '2px solid #10B981' : '1px solid #CBD5E1',
                background: feverToday === 'no' ? '#F0FDF4' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ❄️ No Fever
            </button>
          </div>
        </div>

        {/* Question 2: Chills */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            2. Is the patient experiencing chills or shivering?
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setChills('yes')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: chills === 'yes' ? '2px solid #EF4444' : '1px solid #CBD5E1',
                background: chills === 'yes' ? '#FEF2F2' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🥶 Yes, Chills / Rigors
            </button>
            <button
              type="button"
              onClick={() => setChills('no')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: chills === 'no' ? '2px solid #10B981' : '1px solid #CBD5E1',
                background: chills === 'no' ? '#F0FDF4' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              👍 No Chills
            </button>
          </div>
        </div>

        {/* Question 3: Headache */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            3. Is the patient suffering from headache or body ache?
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setHeadache('yes')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: headache === 'yes' ? '2px solid #EF4444' : '1px solid #CBD5E1',
                background: headache === 'yes' ? '#FEF2F2' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🤕 Yes, Headache
            </button>
            <button
              type="button"
              onClick={() => setHeadache('no')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: headache === 'no' ? '2px solid #10B981' : '1px solid #CBD5E1',
                background: headache === 'no' ? '#F0FDF4' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              👌 No Headache
            </button>
          </div>
        </div>

        {/* Question 4: Prior Antimalarial */}
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            4. Has the patient taken antimalarial medication in the past 28 days?
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setAntimalarialTaken('yes')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: antimalarialTaken === 'yes' ? '2px solid #EF4444' : '1px solid #CBD5E1',
                background: antimalarialTaken === 'yes' ? '#FEF2F2' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              💊 Yes, Antimalarial Taken
            </button>
            <button
              type="button"
              onClick={() => setAntimalarialTaken('no')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 6,
                border: antimalarialTaken === 'no' ? '2px solid #10B981' : '1px solid #CBD5E1',
                background: antimalarialTaken === 'no' ? '#F0FDF4' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ❌ No Antimalarials
            </button>
          </div>
        </div>

        {/* Temperature & Observations */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Body Temperature (°F)
          </label>
          <input
            type="text"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="e.g. 98.6 or 101.4"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Clinical Observations & Field Remarks
          </label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Field observations, general condition, pallor..."
            rows={3}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              background: 'var(--primary, #0E7C86)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '12px',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {submitting ? 'Submitting Screening...' : 'Save & Submit Screening'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 20px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              background: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
