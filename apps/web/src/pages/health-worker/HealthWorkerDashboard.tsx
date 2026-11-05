import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

export interface HealthWorkerFacility {
  id: string;
  facilityCode: string;
  name: string;
  type: string;
  district: string;
  taluka: string;
}

export interface HealthWorkerProfile {
  userId: string;
  displayName: string;
  staffCode: string | null;
  phone: string | null;
  role: string;
  assignedFacilities: HealthWorkerFacility[];
  activeFacility: HealthWorkerFacility | null;
}

export interface HealthWorkerDashboardDto {
  facility: HealthWorkerFacility;
  totalAssignedWorkers: number;
  awaitingScreening: number;
  screenedCount: number;
  suspectedCases: number;
  confirmedPositiveCases: number;
  confirmedNegativeCases: number;
  pendingFollowUps: number;
  newTravelArrivals: number;
  newFeelingUnwellReports: number;
}

export function HealthWorkerDashboard() {
  const [profile, setProfile] = useState<HealthWorkerProfile | null>(null);
  const [stats, setStats] = useState<HealthWorkerDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (facilityId?: string) => {
    try {
      const prof = await api.get<HealthWorkerProfile>('/health-worker/me');
      setProfile(prof);

      const targetFacId = facilityId || prof.activeFacility?.id;
      const data = await api.get<HealthWorkerDashboardDto>(
        targetFacId ? `/health-worker/dashboard?facilityId=${targetFacId}` : '/health-worker/dashboard',
      );
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setSwitching(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleFacilityChange = async (newFacId: string) => {
    if (!newFacId) return;
    setSwitching(true);
    try {
      await api.post('/health-worker/active-facility', { facilityId: newFacId });
      await loadData(newFacId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not switch active facility');
      setSwitching(false);
    }
  };

  if (loading && !profile) {
    return <div className="panel" style={{ padding: 32, textAlign: 'center' }}>Loading surveillance metrics...</div>;
  }

  const activeFac = stats?.facility || profile?.activeFacility;

  return (
    <div>
      {error && (
        <div className="panel" style={{ background: '#FEE2E2', borderColor: '#EF4444', color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Facility Header & Switcher */}
      <div className="panel spread" style={{ marginBottom: 20, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                background: '#E0F2FE',
                color: '#0369A1',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {activeFac?.type || 'PHC'}
            </span>
            <h2 style={{ margin: 0, fontSize: 20 }}>{activeFac?.name || 'General Health Centre'}</h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {activeFac?.taluka ? `${activeFac.taluka}, ${activeFac.district}` : 'Goa Directorate of Health Services'} ·{' '}
            Staff ID: <strong>{profile?.staffCode || 'HW000001'}</strong> ({profile?.displayName})
          </div>
        </div>

        {profile && profile.assignedFacilities.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor="active-fac-select" style={{ fontSize: 13, fontWeight: 600 }}>
              Active Facility:
            </label>
            <select
              id="active-fac-select"
              aria-label="Active Facility"
              value={activeFac?.id || ''}
              onChange={(e) => void handleFacilityChange(e.target.value)}
              disabled={switching}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#fff',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {profile.assignedFacilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} ({fac.type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Surveillance Metrics Grid */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Surveillance Overview</h3>
      <div className="grid-3" style={{ marginBottom: 24, gap: 14 }}>
        <div className="panel stat-box" style={{ borderLeft: '4px solid var(--primary, #0E7C86)' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{stats?.totalAssignedWorkers ?? 0}</div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Assigned Workers</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{stats?.awaitingScreening ?? 0}</div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Awaiting Screening</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{stats?.screenedCount ?? 0}</div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Workers Screened</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{stats?.suspectedCases ?? 0}</div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Suspected Malaria Cases</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #EF4444' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800, color: '#EF4444' }}>
            {stats?.confirmedPositiveCases ?? 0}
          </div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Confirmed Positive Cases</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800, color: '#10B981' }}>
            {stats?.confirmedNegativeCases ?? 0}
          </div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Confirmed Negative Cases</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{stats?.pendingFollowUps ?? 0}</div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending Follow-ups</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #0284C7' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{stats?.newTravelArrivals ?? 0}</div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>New Travel Arrivals</div>
        </div>
        <div className="panel stat-box" style={{ borderLeft: '4px solid #E11D48' }}>
          <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>{stats?.newFeelingUnwellReports ?? 0}</div>
          <div className="stat-label" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Feeling Unwell Reports</div>
        </div>
      </div>

      {/* Action Modules */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Surveillance Care Workflows</h3>
      <div className="grid-3" style={{ gap: 14 }}>
        <Link to="/health-worker/search" className="panel action-link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Worker & Household Search</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Find workers by name, Worker ID, mobile number, or QR code token.
          </div>
        </Link>
        <Link to="/health-worker/screening" className="panel action-link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Assisted Health Screening</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Administer baseline health questionnaires and clinical observations.
          </div>
        </Link>
        <Link to="/health-worker/cases" className="panel action-link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🤒</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Record Suspected Case & RDT</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Record high-fever episodes and initiate RDT or microscopy requests.
          </div>
        </Link>
        <Link to="/health-worker/follow-ups" className="panel action-link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🩺</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Follow-up Management</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Check treatment adherence, recovery, and referral hospital attendance.
          </div>
        </Link>
        <Link to="/health-worker/travel-arrivals" className="panel action-link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>✈️</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Travel Arrivals Screening</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Screen workers entering Goa on their recorded travel journey.
          </div>
        </Link>
        <Link to="/health-worker/inbox" className="panel action-link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📬</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Facility Inbox & Alerts</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Review positive malaria result notifications and clinical alerts.
          </div>
        </Link>
      </div>
    </div>
  );
}
