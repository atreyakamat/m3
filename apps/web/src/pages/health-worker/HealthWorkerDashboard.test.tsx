import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HealthWorkerDashboard } from './HealthWorkerDashboard';
import * as apiModule from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class extends Error {},
}));

vi.mock('../../lib/authContext', () => ({
  useAuth: () => ({
    user: {
      userId: 'hw-user-1',
      displayName: 'HW Priya Sharma',
      role: 'HEALTH_WORKER',
    },
    logout: vi.fn(),
  }),
}));

const mockProfile = {
  userId: 'hw-user-1',
  displayName: 'HW Priya Sharma',
  staffCode: 'HW000001',
  role: 'HEALTH_WORKER',
  assignedFacilities: [
    {
      id: 'fac-1',
      facilityCode: 'PHC-CAN-01',
      name: 'Candolim Primary Health Centre',
      type: 'PHC',
      district: 'North Goa',
      taluka: 'Bardez',
    },
    {
      id: 'fac-2',
      facilityCode: 'UHC-PAN-01',
      name: 'Panaji Urban Health Centre',
      type: 'UHC',
      district: 'North Goa',
      taluka: 'Tiswadi',
    },
  ],
  activeFacility: {
    id: 'fac-1',
    facilityCode: 'PHC-CAN-01',
    name: 'Candolim Primary Health Centre',
    type: 'PHC',
    district: 'North Goa',
    taluka: 'Bardez',
  },
};

const mockDashboardStats = {
  facility: mockProfile.activeFacility,
  totalAssignedWorkers: 142,
  awaitingScreening: 28,
  screenedCount: 114,
  suspectedCases: 5,
  confirmedPositiveCases: 2,
  confirmedNegativeCases: 8,
  pendingFollowUps: 4,
  newTravelArrivals: 3,
  newFeelingUnwellReports: 6,
};

describe('Health Worker Dashboard (Web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders health worker profile, active facility, and all surveillance metrics', async () => {
    (apiModule.api.get as any).mockImplementation((path: string) => {
      if (path === '/health-worker/me') return Promise.resolve(mockProfile);
      if (path.startsWith('/health-worker/dashboard')) return Promise.resolve(mockDashboardStats);
      return Promise.reject(new Error(`Unhandled path: ${path}`));
    });

    render(
      <MemoryRouter>
        <HealthWorkerDashboard />
      </MemoryRouter>,
    );

    // Verify loading resolution
    await waitFor(() => {
      expect(screen.getByText('Candolim Primary Health Centre')).toBeInTheDocument();
    });

    expect(screen.getByText('HW000001')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument(); // totalAssignedWorkers
    expect(screen.getByText('28')).toBeInTheDocument();  // awaitingScreening
    expect(screen.getByText('114')).toBeInTheDocument(); // screenedCount
    expect(screen.getByText('5')).toBeInTheDocument();   // suspectedCases
    expect(screen.getByText('2')).toBeInTheDocument();   // confirmedPositiveCases
  });

  it('allows switching active facility from the facility selector', async () => {
    (apiModule.api.get as any).mockImplementation((path: string) => {
      if (path === '/health-worker/me') return Promise.resolve(mockProfile);
      if (path.startsWith('/health-worker/dashboard')) return Promise.resolve(mockDashboardStats);
      return Promise.reject(new Error(`Unhandled path: ${path}`));
    });

    (apiModule.api.post as any).mockImplementation((path: string) => {
      if (path === '/health-worker/active-facility') {
        return Promise.resolve({
          activeFacility: mockProfile.assignedFacilities[1],
          switchedAt: new Date().toISOString(),
        });
      }
      return Promise.reject(new Error(`Unhandled path: ${path}`));
    });

    render(
      <MemoryRouter>
        <HealthWorkerDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /active facility/i })).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', { name: /active facility/i });
    fireEvent.change(select, { target: { value: 'fac-2' } });

    await waitFor(() => {
      expect(apiModule.api.post).toHaveBeenCalledWith('/health-worker/active-facility', {
        facilityId: 'fac-2',
      });
    });
  });
});
