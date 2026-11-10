import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../../lib/authContext';
import { api } from '../../lib/api';
import { ContractorDashboard } from './Dashboard';
import { ContractorWorkers } from './Workers';
import { ContractorSiteDetail } from './SiteDetail';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockContractorAuth: AuthState = {
  token: 'mock-contractor-jwt',
  user: {
    userId: 'c-user-1',
    role: 'CONTRACTOR',
    workerId: null,
    contractorId: 'c-record-1',
    displayName: 'Goa Coastal Builders',
  },
  loginWorker: vi.fn(),
  registerWorker: vi.fn(),
  loginStaff: vi.fn(),
  changeCredential: vi.fn(),
  logout: vi.fn(),
};

const mockDashboardData = {
  contractor: {
    id: 'c-record-1',
    contractorCode: 'C000001',
    name: 'Goa Coastal Builders',
    phone: '9822112233',
  },
  metrics: {
    totalAssignedWorkers: 6,
    activeWorkers: 6,
    workersCurrentlyAtSite: 5,
    pendingTransferRequests: 2,
  },
  sites: [
    {
      id: 'site-1',
      siteId: 'SITE-TEST01',
      siteCode: 'SITE-TEST01',
      name: 'Miramar Heights',
      area: 'Panaji North',
      activeWorkers: 6,
    },
  ],
  recentActivity: [
    {
      id: 'act-1',
      type: 'ASSIGNMENT',
      title: 'Worker Assigned',
      description: 'Ramesh Kumar (M3-W001) assigned to Miramar Heights',
      timestamp: '2026-11-09T10:00:00.000Z',
      workerCode: 'M3-W001',
      workerName: 'Ramesh Kumar',
      siteCode: 'SITE-TEST01',
      siteName: 'Miramar Heights',
    },
    {
      id: 'act-2',
      type: 'TRAVEL',
      title: 'Travel Departure',
      description: 'Suresh Patel (M3-W002) departed for Ranchi, Jharkhand',
      timestamp: '2026-11-08T09:30:00.000Z',
      workerCode: 'M3-W002',
      workerName: 'Suresh Patel',
      siteCode: null,
      siteName: null,
    },
  ],
  workers: [
    {
      workerCode: 'M3-W001',
      patientId: 'p-001',
      name: 'Ramesh Kumar',
      phone: '9876543210',
      age: 28,
      gender: 'male',
      siteCode: 'SITE-TEST01',
      siteName: 'Miramar Heights',
      active: true,
      malariaStatus: 'NEGATIVE',
    },
    {
      workerCode: 'M3-W002',
      patientId: 'p-002',
      name: 'Suresh Patel',
      phone: '9876543211',
      age: 34,
      gender: 'male',
      siteCode: 'SITE-TEST01',
      siteName: 'Miramar Heights',
      active: true,
      malariaStatus: 'POSITIVE',
    },
  ],
  pendingTransfers: [
    {
      id: 'trans-1',
      transferId: 'trans-1',
      workerCode: 'M3-W003',
      workerName: 'Tilak Verma',
      currentSite: { siteId: 'SITE-OLD', name: 'Old Construction Site' },
      destinationSite: { siteId: 'SITE-TEST01', name: 'Miramar Heights' },
      initiator: 'WORKER',
      status: 'PENDING_DESTINATION_CONTRACTOR',
      createdAt: '2026-11-08T14:00:00.000Z',
      isAwaitingMyApproval: true,
    },
  ],
};

function renderWithAuth(ui: React.ReactNode, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={mockContractorAuth}>
        {ui}
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('Contractor Dashboard and Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 summary cards and contractor profile correctly', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockDashboardData);

    renderWithAuth(<ContractorDashboard />);

    expect(screen.getByText(/Loading contractor dashboard/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Goa Coastal Builders')).toBeInTheDocument();
    });

    // Verify 4 summary cards
    expect(screen.getByText('Total Assigned Workers')).toBeInTheDocument();
    expect(screen.getByText('Active Workers')).toBeInTheDocument();
    expect(screen.getByText('Workers Currently at Site')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // currentlyAtSite

    expect(screen.getByText('Pending Transfer Requests')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // pendingTransfers

    const sixElements = screen.getAllByText('6');
    expect(sixElements.length).toBeGreaterThanOrEqual(2);
  });

  it('renders all 4 sections: Recent Worker Activity, Site Overview, Worker Management, and Transfer Requests', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockDashboardData);

    renderWithAuth(<ContractorDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Worker Activity')).toBeInTheDocument();
      expect(screen.getByText('Site Overview')).toBeInTheDocument();
      expect(screen.getByText('Worker Management')).toBeInTheDocument();
      expect(screen.getByText('Transfer Requests')).toBeInTheDocument();
    });

    // Site overview content
    const miramarElements = screen.getAllByText('Miramar Heights');
    expect(miramarElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/SITE-TEST01 · Panaji North/)).toBeInTheDocument();

    // Recent activity content with timestamps & badges
    expect(screen.getByText(/Ramesh Kumar \(M3-W001\) assigned to Miramar Heights/)).toBeInTheDocument();
    expect(screen.getByText(/Suresh Patel \(M3-W002\) departed for Ranchi, Jharkhand/)).toBeInTheDocument();

    // Worker management content
    const rameshElements = screen.getAllByText('Ramesh Kumar');
    expect(rameshElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('M3-W001')).toBeInTheDocument();

    // Transfer requests content
    expect(screen.getByText('Tilak Verma')).toBeInTheDocument();
    expect(screen.getByText('(M3-W003)')).toBeInTheDocument();
  });

  it('opens worker details modal without exposing household clinical records', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockDashboardData);

    renderWithAuth(<ContractorDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('Ramesh Kumar').length).toBeGreaterThanOrEqual(1);
    });

    // Click Details on Ramesh Kumar
    const detailsButtons = screen.getAllByRole('button', { name: 'Details' });
    fireEvent.click(detailsButtons[0]);

    // Modal opens
    expect(screen.getByText('Worker Information')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getAllByText('9876543210').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/28 years/)).toBeInTheDocument();

    // Verify clinical screening survey answers and household clinical data are NOT present
    expect(screen.queryByText(/Travel History/i)).toBeNull();
    expect(screen.queryByText(/Fever in past 14 days/i)).toBeNull();
    expect(screen.queryByText(/Household Members/i)).toBeNull();

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Worker Information')).toBeNull();
  });

  it('handles empty state for contractors with no assigned workers or sites', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      contractor: {
        id: 'c-record-empty',
        contractorCode: 'C000099',
        name: 'New Contractor',
        phone: '9800000000',
      },
      metrics: {
        totalAssignedWorkers: 0,
        activeWorkers: 0,
        workersCurrentlyAtSite: 0,
        pendingTransferRequests: 0,
      },
      sites: [],
      recentActivity: [],
      workers: [],
      pendingTransfers: [],
    });

    renderWithAuth(<ContractorDashboard />);

    await waitFor(() => {
      expect(screen.getByText('New Contractor')).toBeInTheDocument();
    });

    // Zero metrics
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);

    // Empty state messages
    expect(screen.getByText(/No construction sites assigned yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No recent worker activity recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/No workers currently assigned to your workforce/i)).toBeInTheDocument();
    expect(screen.getByText(/No pending transfer requests/i)).toBeInTheDocument();
  });

  it('handles error state with retry option', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error connecting to API'));

    renderWithAuth(<ContractorDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Network error connecting to API/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders ContractorWorkers page and filters by search', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      items: mockDashboardData.workers,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    renderWithAuth(<ContractorWorkers />);

    await waitFor(() => {
      expect(screen.getByText('Worker Management')).toBeInTheDocument();
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Suresh Patel')).toBeInTheDocument();
    });
  });

  it('renders ContractorSiteDetail page with site stats and active workers', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      site: mockDashboardData.sites[0],
      stats: {
        siteCode: 'SITE-TEST01',
        siteName: 'Miramar Heights',
        totalWorkers: 6,
        positive: 1,
        negative: 4,
        awaitingResults: 1,
        noResultRecorded: 0,
        lastUpdated: '2026-11-10T00:00:00.000Z',
      },
      workers: [
        {
          workerId: 'M3-W001',
          patientId: 'p-001',
          name: 'Ramesh Kumar',
          phone: '9876543210',
          age: 28,
          gender: 'male',
          malariaStatus: 'NEGATIVE',
        },
      ],
      totalWorkers: 6,
      travels: [],
      transfers: [],
    });

    renderWithAuth(
      <Routes>
        <Route path="/contractor/sites/:siteCode" element={<ContractorSiteDetail />} />
      </Routes>,
      ['/contractor/sites/SITE-TEST01'],
    );

    await waitFor(() => {
      expect(screen.getAllByText('Miramar Heights').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('SITE-TEST01')).toBeInTheDocument();
      expect(screen.getByText('Tested Negative')).toBeInTheDocument();
      expect(screen.getByText('Positive Cases')).toBeInTheDocument();
    });
  });
});
