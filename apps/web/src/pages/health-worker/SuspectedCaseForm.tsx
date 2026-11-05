import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

const COMMON_SYMPTOMS = [
  'fever',
  'chills',
  'headache',
  'sweating',
  'body_ache',
  'nausea_vomiting',
  'fatigue',
  'loss_of_appetite',
];

export function SuspectedCaseFormPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const workerIdParam = params.get('workerId') || '';
  const workerNameParam = params.get('workerName') || '';

  const [workerId, setWorkerId] = useState(workerIdParam);
  const [workerName, setWorkerName] = useState(workerNameParam);

  // Search state if no workerId is prefilled
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Suspected Case fields
  const [feverDurationDays, setFeverDurationDays] = useState('3');
  const [symptomOnsetDate, setSymptomOnsetDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['fever', 'chills']);
  const [travelHistoryDays, setTravelHistoryDays] = useState('0');
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Diagnostic Test Request fields
  const [orderTest, setOrderTest] = useState(true);
  const [testType, setTestType] = useState<'RDT' | 'MICROSCOPY'>('RDT');
  const [sampleType, setSampleType] = useState('WHOLE_BLOOD_FINGERPRICK');
  const [urgency, setUrgency] = useState<'ROUTINE' | 'URGENT' | 'IMMEDIATE'>('URGENT');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    episodeId: string;
    testRequestId?: string;
  } | null>(null);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    );
  };

  const handleWorkerSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get<{ workers: any[] }>(
        `/health-worker/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      setSearchResults(res.workers || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to search workers');
    } finally {
      setSearching(false);
    }
  };

  const selectWorker = (w: any) => {
    setWorkerId(w.id);
    setWorkerName(w.name);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workerId) {
      setError('Please select or identify a worker first.');
      return;
    }
    if (selectedSymptoms.length === 0) {
      setError('Please select at least one presenting symptom.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Record Suspected Malaria Case
      const casePayload = {
        workerId,
        feverDurationDays: Number(feverDurationDays) || 1,
        symptomOnsetDate: new Date(symptomOnsetDate).toISOString(),
        symptoms: selectedSymptoms,
        travelHistoryDays: Number(travelHistoryDays) || 0,
        clinicalNotes: clinicalNotes.trim() || undefined,
      };

      const caseRes = await api.post<{ episode: { id: string } }>(
        '/health-worker/cases',
        casePayload,
      );

      let testRes: { testRequest: { id: string } } | undefined;

      // 2. If test requested, record diagnostic test request
      if (orderTest) {
        const testPayload = {
          workerId,
          episodeId: caseRes.episode.id,
          testType,
          sampleType,
          clinicalNotes: clinicalNotes.trim() || undefined,
          urgency,
        };
        testRes = await api.post<{ testRequest: { id: string } }>(
          '/health-worker/test-requests',
          testPayload,
        );
      }

      setSuccessResult({
        episodeId: caseRes.episode.id,
        testRequestId: testRes?.testRequest?.id,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record suspected case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/health-worker" style={{ color: '#006699', textDecoration: 'none', fontSize: 14 }}>
          &larr; Back to Dashboard
        </Link>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Record Suspected Case & Order Diagnostic Test
      </h2>
      <p style={{ color: '#64748B', marginBottom: 16 }}>
        Initiate a malaria surveillance episode and refer for laboratory verification.
      </p>

      {/* Governance & Role Notice */}
      <div
        className="panel"
        style={{
          background: '#EFF6FF',
          borderLeft: '4px solid #3B82F6',
          padding: 14,
          marginBottom: 20,
          color: '#1E3A8A',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <strong>Clinical Role Notice:</strong> As a Health Worker, you can record suspected malaria
        episodes and initiate diagnostic test requests (RDT / Microscopy). In accordance with
        diagnostic governance, <strong>confirmation of diagnostic test results is strictly restricted to authorized Clinicians and Pathologists</strong>.
      </div>

      {error && (
        <div
          className="panel"
          style={{ background: '#FEE2E2', color: '#991B1B', padding: 14, marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {successResult ? (
        <div
          className="panel"
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>&#x2705;</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
            Suspected Case Recorded Successfully
          </h3>
          <p style={{ color: '#15803D', marginBottom: 6 }}>
            Malaria episode created with ID: <code>{successResult.episodeId}</code>
          </p>
          {successResult.testRequestId && (
            <p style={{ color: '#15803D', marginBottom: 20 }}>
              Diagnostic test request ({testType}) logged with ID:{' '}
              <code>{successResult.testRequestId}</code>
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            <button
              onClick={() => navigate(`/health-worker/workers/${workerId}`)}
              style={{
                background: '#006699',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 6,
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View Worker Record
            </button>
            <button
              onClick={() => {
                setSuccessResult(null);
                setWorkerId('');
                setWorkerName('');
                setClinicalNotes('');
              }}
              style={{
                background: '#F1F5F9',
                color: '#334155',
                padding: '10px 20px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Record Another Case
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Worker Identification Section */}
          <div className="panel" style={{ marginBottom: 20, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>1. Worker Subject</h3>

            {workerId ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#F8FAFC',
                  padding: 14,
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{workerName || 'Selected Worker'}</div>
                  <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>ID: {workerId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWorkerId('');
                    setWorkerName('');
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #CBD5E1',
                    borderRadius: 4,
                    padding: '6px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                    color: '#475569',
                  }}
                >
                  Change Worker
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>
                  Search for the worker by name, worker code (M3-...), or phone number:
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search worker..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleWorkerSearch}
                    disabled={searching}
                    style={{
                      background: '#006699',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {searching ? 'Searching...' : 'Find'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: 6,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {searchResults.map((w) => (
                      <div
                        key={w.id}
                        onClick={() => selectWorker(w)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <strong>{w.name}</strong> ({w.workerCode})
                        </div>
                        <span style={{ color: '#006699', fontSize: 13, fontWeight: 600 }}>Select</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clinical Episode Details */}
          <div className="panel" style={{ marginBottom: 20, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>2. Clinical Presentation</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Symptom Onset Date
                </label>
                <input
                  type="date"
                  value={symptomOnsetDate}
                  onChange={(e) => setSymptomOnsetDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Fever Duration (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={feverDurationDays}
                  onChange={(e) => setFeverDurationDays(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Recent Travel Outside Goa (Days Ago)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={travelHistoryDays}
                onChange={(e) => setTravelHistoryDays(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                }}
              />
              <span style={{ fontSize: 12, color: '#64748B' }}>0 if no recent travel outside Goa</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Presenting Symptoms (Select all that apply)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {COMMON_SYMPTOMS.map((sym) => {
                  const checked = selectedSymptoms.includes(sym);
                  const label = sym.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(sym)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: checked ? '2px solid #006699' : '1px solid #CBD5E1',
                        background: checked ? '#F0F9FF' : '#fff',
                        color: checked ? '#0369A1' : '#334155',
                        fontWeight: checked ? 600 : 400,
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {checked ? '✓ ' : ''}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Clinical Observations & Examination Notes
              </label>
              <textarea
                rows={3}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Observed clinical signs, vitals, contact history..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                }}
              />
            </div>
          </div>

          {/* Diagnostic Test Request Order */}
          <div className="panel" style={{ marginBottom: 24, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>3. Diagnostic Test Request</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={orderTest}
                  onChange={(e) => setOrderTest(e.target.checked)}
                />
                Request Laboratory Test Immediately
              </label>
            </div>

            {orderTest && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Test Modality
                    </label>
                    <select
                      value={testType}
                      onChange={(e) => setTestType(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                      }}
                    >
                      <option value="RDT">Rapid Diagnostic Test (RDT)</option>
                      <option value="MICROSCOPY">Microscopy (Thick & Thin Smear)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Sample Type
                    </label>
                    <select
                      value={sampleType}
                      onChange={(e) => setSampleType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                      }}
                    >
                      <option value="WHOLE_BLOOD_FINGERPRICK">Whole Blood (Fingerprick)</option>
                      <option value="WHOLE_BLOOD_EDTA">Whole Blood (EDTA Tube)</option>
                      <option value="BLOOD_SMEAR">Prepared Blood Smear Slide</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Clinical Urgency
                    </label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                      }}
                    >
                      <option value="ROUTINE">Routine</option>
                      <option value="URGENT">Urgent (Within 4 hours)</option>
                      <option value="IMMEDIATE">Immediate (Critical/Emergency)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/health-worker')}
              style={{
                background: '#F1F5F9',
                color: '#334155',
                padding: '10px 20px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
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
                padding: '10px 24px',
                borderRadius: 6,
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {submitting ? 'Recording...' : 'Submit Suspected Case & Request'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
