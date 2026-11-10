import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../../lib/authContext';
import { api } from '../../lib/api';
import { ContractorDashboard } from './Dashboard';
import { ContractorWorkers } from './Workers';
import { MySites } from './MySites';
import { ContractorSiteDetail } from './SiteDetail';
import { Approvals } from './Approvals';

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
      assignmentStatus: 'ACTIVE',
      malariaStatus: null,
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
      assignmentStatus: 'ACTIVE',
      malariaStatus: null,
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

const mockWorkerDetailResponse = {
  workerId: 'M3-W001',
  workerCode: 'M3-W001',
  patientId: 'p-001',
  name: 'Ramesh Kumar',
  phone: '9876543210',
  age: 28,
  gender: 'male',
  currentSite: {
    siteId: 'SITE-TEST01',
    siteCode: 'SITE-TEST01',
    name: 'Miramar Heights',
    startedAt: '2026-09-01T00:00:00.000Z',
  },
  active: true,
  assignmentStatus: 'ACTIVE',
  startedAt: '2026-09-01T00:00:00.000Z',
  malariaStatus: null,
  entryHistory: [
    {
      id: 'entry-1',
      originTown: 'Ranchi',
      originDistrict: 'Ranchi',
      originState: 'Jharkhand',
      purpose: 'Work',
      arrivalDate: '2026-08-25T10:00:00.000Z',
      status: 'SUBMITTED',
    },
  ],
  exitHistory: [
    {
      id: 'exit-1',
      destination: 'Ranchi',
      town: 'Ranchi',
      state: 'Jharkhand',
      departureDate: '2026-11-20T08:00:00.000Z',
      returnDate: '2026-12-05T20:00:00.000Z',
      purpose: 'Vacation',
      status: 'SUBMITTED',
    },
  ],
  transfers: [
    {
      id: 'tr-1',
      fromSite: { siteCode: 'SITE-OLD', name: 'Old Construction Site' },
      toSite: { siteCode: 'SITE-TEST01', name: 'Miramar Heights' },
      initiator: 'WORKER',
      status: 'ACCEPTED',
      createdAt: '2026-08-28T10:00:00.000Z',
      effectiveAt: '2026-09-01T00:00:00.000Z',
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

describe('Contractor Application — Iteration 1 & 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 summary cards and contractor profile correctly', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockDashboardData);

    renderWithAuth(<ContractorDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Goa Coastal Builders')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Assigned Workers')).toBeInTheDocument();
    expect(screen.getByText('Active Workers')).toBeInTheDocument();
    expect(screen.getByText('Workers Currently at Site')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Pending Transfer Requests')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
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

    expect(screen.getByText(/SITE-TEST01 · Panaji North/)).toBeInTheDocument();
    expect(screen.getByText(/Ramesh Kumar \(M3-W001\) assigned to Miramar Heights/)).toBeInTheDocument();
  });

  it('opens worker details modal with authorized information, entry/exit travel history, and transfer status', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes('/contractor/dashboard')) return mockDashboardData;
      if (url.includes('/contractor/workers/M3-W001')) return mockWorkerDetailResponse;
      return {};
    });

    renderWithAuth(<ContractorDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('Ramesh Kumar').length).toBeGreaterThanOrEqual(1);
    });

    // Click Details button
    const detailsButtons = screen.getAllByRole('button', { name: 'Details' });
    fireEvent.click(detailsButtons[0]);

    // Worker Detail Modal opens
    await waitFor(() => {
      expect(screen.getByText('Current Site Assignment')).toBeInTheDocument();
      expect(screen.getByText('Entry in Goa History')).toBeInTheDocument();
      expect(screen.getByText('Exit from Goa History')).toBeInTheDocument();
      expect(screen.getByText('Relevant Site Transfers')).toBeInTheDocument();
    });

    // Authorised data verified
    expect(screen.getByText('Ranchi, Ranchi, Jharkhand')).toBeInTheDocument();
    expect(screen.getByText('Ranchi, Jharkhand')).toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();

    // Verify clinical screening questions and symptoms are NOT exposed
    expect(screen.queryByText(/Fever in past 14 days/i)).toBeNull();
    expect(screen.queryByText(/Voice Recording/i)).toBeNull();
    expect(screen.queryByText(/Household Members/i)).toBeNull();

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Current Site Assignment')).toBeNull();
  });

  it('renders Worker Management page with search, site filter, assignment status filter, and pagination', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes('/contractor/sites')) {
        return [
          { siteCode: 'SITE-TEST01', name: 'Miramar Heights' },
        ];
      }
      if (url.includes('/contractor/workers')) {
        return {
          items: mockDashboardData.workers,
          total: 2,
          page: 1,
          pageSize: 15,
          totalPages: 1,
        };
      }
      return {};
    });

    renderWithAuth(<ContractorWorkers />);

    await waitFor(() => {
      expect(screen.getByText('Worker Management')).toBeInTheDocument();
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Suresh Patel')).toBeInTheDocument();
      expect(screen.getByText('M3-W001')).toBeInTheDocument();
      expect(screen.getByText('M3-W002')).toBeInTheDocument();
    });

    // Verify assignment status badges
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);

    // Verify column headers
    expect(screen.getByText('Worker Name')).toBeInTheDocument();
    expect(screen.getByText('Worker ID')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Current Assigned Site')).toBeInTheDocument();
    expect(screen.getByText('Assignment Status')).toBeInTheDocument();

    // Verify filter elements exist
    expect(screen.getByPlaceholderText(/Search by worker name/i)).toBeInTheDocument();
    expect(screen.getByText('All Construction Sites')).toBeInTheDocument();
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
  });

  it('renders Site Operations (MySites) page and filters sites by search', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      {
        siteId: 'SITE-TEST01',
        siteCode: 'SITE-TEST01',
        name: 'Miramar Heights',
        area: 'Panaji North',
        activeWorkers: 6,
        active: true,
      },
    ]);

    renderWithAuth(<MySites />);

    await waitFor(() => {
      expect(screen.getByText('Site Operations & Overview')).toBeInTheDocument();
      expect(screen.getByText('Miramar Heights')).toBeInTheDocument();
      expect(screen.getByText('SITE-TEST01')).toBeInTheDocument();
      expect(screen.getByText(/Panaji North/)).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
    });
  });

  it('renders ContractorSiteDetail page with assigned workers and site statistics', async () => {
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
          workerCode: 'M3-W001',
          patientId: 'p-001',
          name: 'Ramesh Kumar',
          phone: '9876543210',
          age: 28,
          gender: 'male',
          assignmentStatus: 'ACTIVE',
          malariaStatus: null,
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
      expect(screen.getAllByText('SITE-TEST01').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Tested Negative')).toBeInTheDocument();
      expect(screen.getByText('Positive Cases')).toBeInTheDocument();
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('renders Transfer Requests page with all columns, filters, and actions', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      items: [
        {
          id: 'trans-001-xyz',
          transferId: 'trans-001-xyz',
          workerId: 'M3-W001',
          workerName: 'Ramesh Kumar',
          fromSite: { id: 's-old', siteCode: 'SITE-OLD', name: 'Old Candolim Site' },
          toSite: { id: 's-new', siteCode: 'SITE-TEST01', name: 'Miramar Heights' },
          currentSite: { siteId: 'SITE-OLD', name: 'Old Candolim Site' },
          destinationSite: { siteId: 'SITE-TEST01', name: 'Miramar Heights' },
          fromContractor: { id: 'c-prev', name: 'Previous Builder' },
          toContractor: { id: 'c-record-1', name: 'Goa Coastal Builders' },
          initiator: 'WORKER',
          initiatorType: 'WORKER',
          status: 'PENDING_DESTINATION_CONTRACTOR',
          workerDecision: 'APPROVED',
          toContractorDecision: 'PENDING',
          fromContractorDecision: 'PENDING',
          createdAt: '2026-11-09T10:00:00.000Z',
          effectiveAt: null,
          cancelledAt: null,
          requiredNextAction: 'Awaiting your destination approval',
          canApproveDestination: true,
          canReleaseWorker: false,
          canCancel: false,
          isActionableByMe: true,
        },
        {
          id: 'trans-002-abc',
          transferId: 'trans-002-abc',
          workerId: 'M3-W002',
          workerName: 'Suresh Patel',
          fromSite: { id: 's-curr', siteCode: 'SITE-TEST01', name: 'Miramar Heights' },
          toSite: { id: 's-dest', siteCode: 'SITE-SOUTH', name: 'South Infra' },
          currentSite: { siteId: 'SITE-TEST01', name: 'Miramar Heights' },
          destinationSite: { siteId: 'SITE-SOUTH', name: 'South Infra' },
          fromContractor: { id: 'c-record-1', name: 'Goa Coastal Builders' },
          toContractor: { id: 'c-next', name: 'South Infra Corp' },
          initiator: 'WORKER',
          initiatorType: 'WORKER',
          status: 'PENDING_CURRENT_CONTRACTOR',
          workerDecision: 'APPROVED',
          toContractorDecision: 'APPROVED',
          fromContractorDecision: 'PENDING',
          createdAt: '2026-11-08T09:00:00.000Z',
          effectiveAt: null,
          cancelledAt: null,
          requiredNextAction: 'Awaiting your release approval',
          canApproveDestination: false,
          canReleaseWorker: true,
          canCancel: false,
          isActionableByMe: true,
        },
      ],
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });

    renderWithAuth(
      <Routes>
        <Route path="/contractor/transfers" element={<Approvals />} />
      </Routes>,
      ['/contractor/transfers'],
    );

    await waitFor(() => {
      expect(screen.getByText('Transfer Requests')).toBeInTheDocument();
      expect(screen.getByText('+ Initiate Transfer')).toBeInTheDocument();

      // Check column headers
      expect(screen.getByText('Transfer ID')).toBeInTheDocument();
      expect(screen.getByText('Worker Name')).toBeInTheDocument();
      expect(screen.getByText('Worker ID')).toBeInTheDocument();
      expect(screen.getByText('Current Site')).toBeInTheDocument();
      expect(screen.getByText('Destination Site')).toBeInTheDocument();
      expect(screen.getByText('Initiator')).toBeInTheDocument();
      expect(screen.getByText('Request Date')).toBeInTheDocument();
      expect(screen.getByText('Current Status')).toBeInTheDocument();
      expect(screen.getByText('Required Next Action')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check rows & actions
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('M3-W001')).toBeInTheDocument();
      expect(screen.getByText('Awaiting your destination approval')).toBeInTheDocument();
      expect(screen.getByText('Approve')).toBeInTheDocument();

      expect(screen.getByText('Suresh Patel')).toBeInTheDocument();
      expect(screen.getByText('M3-W002')).toBeInTheDocument();
      expect(screen.getByText('Awaiting your release approval')).toBeInTheDocument();
      expect(screen.getByText('Release')).toBeInTheDocument();

      expect(screen.getAllByText('View Details')).toHaveLength(2);
    });
  });

  it('opens TransferDetailModal with timeline, route, authorized worker info, and records decision', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/contractor/transfers?')) {
        return Promise.resolve({
          items: [
            {
              id: 'trans-001',
              transferId: 'trans-001',
              workerId: 'M3-W001',
              workerName: 'Ramesh Kumar',
              fromSite: { id: 's-old', siteCode: 'SITE-OLD', name: 'Old Candolim Site' },
              toSite: { id: 's-new', siteCode: 'SITE-TEST01', name: 'Miramar Heights' },
              currentSite: { siteId: 'SITE-OLD', name: 'Old Candolim Site' },
              destinationSite: { siteId: 'SITE-TEST01', name: 'Miramar Heights' },
              fromContractor: { id: 'c-prev', name: 'Previous Builder' },
              toContractor: { id: 'c-record-1', name: 'Goa Coastal Builders' },
              initiator: 'WORKER',
              initiatorType: 'WORKER',
              status: 'PENDING_DESTINATION_CONTRACTOR',
              workerDecision: 'APPROVED',
              toContractorDecision: 'PENDING',
              fromContractorDecision: 'PENDING',
              createdAt: '2026-11-09T10:00:00.000Z',
              effectiveAt: null,
              cancelledAt: null,
              requiredNextAction: 'Awaiting your destination approval',
              canApproveDestination: true,
              canReleaseWorker: false,
              canCancel: false,
              isActionableByMe: true,
            },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        });
      }
      if (url.includes('/contractor/transfers/trans-001')) {
        return Promise.resolve({
          id: 'trans-001',
          transferId: 'trans-001',
          workerId: 'M3-W001',
          workerName: 'Ramesh Kumar',
          worker: {
            id: 'w-001',
            workerCode: 'M3-W001',
            name: 'Ramesh Kumar',
            phone: '9876543210',
            age: 28,
            gender: 'male',
            malariaStatus: null,
          },
          fromSite: { id: 's-old', siteCode: 'SITE-OLD', name: 'Old Candolim Site', area: 'Candolim' },
          toSite: { id: 's-new', siteCode: 'SITE-TEST01', name: 'Miramar Heights', area: 'Panaji North' },
          currentSite: { siteId: 'SITE-OLD', name: 'Old Candolim Site' },
          destinationSite: { siteId: 'SITE-TEST01', name: 'Miramar Heights' },
          fromContractor: { id: 'c-prev', name: 'Previous Builder' },
          toContractor: { id: 'c-record-1', name: 'Goa Coastal Builders' },
          initiator: 'WORKER',
          initiatorType: 'WORKER',
          status: 'PENDING_DESTINATION_CONTRACTOR',
          workerDecision: 'APPROVED',
          workerDecisionAt: '2026-11-09T10:00:00.000Z',
          toContractorDecision: 'PENDING',
          toContractorDecisionAt: null,
          fromContractorDecision: 'PENDING',
          fromContractorDecisionAt: null,
          note: 'Relocating to Panaji site.',
          createdAt: '2026-11-09T10:00:00.000Z',
          effectiveAt: null,
          cancelledAt: null,
          myRole: 'DESTINATION_CONTRACTOR',
          isDestinationContractor: true,
          isCurrentContractor: false,
          canApproveDestination: true,
          canReleaseWorker: false,
          canCancel: false,
          isActionableByMe: true,
          requiredNextAction: 'Awaiting your destination approval',
          timeline: [
            {
              id: 'step-1',
              step: 'INITIATED',
              status: 'DONE',
              title: 'Transfer requested by worker',
              description: 'Transfer request submitted.',
              timestamp: '2026-11-09T10:00:00.000Z',
            },
            {
              id: 'step-2',
              step: 'DESTINATION_APPROVAL',
              status: 'PENDING',
              title: 'Destination contractor review pending',
              description: 'Action required: Review and approve or reject this destination request.',
              timestamp: '2026-11-09T10:00:00.000Z',
            },
          ],
        });
      }
      return Promise.reject(new Error(`Unhandled GET url: ${url}`));
    });

    vi.mocked(api.post).mockResolvedValueOnce({
      id: 'trans-001',
      status: 'PENDING_CURRENT_CONTRACTOR',
    });

    renderWithAuth(
      <Routes>
        <Route path="/contractor/transfers" element={<Approvals />} />
      </Routes>,
      ['/contractor/transfers'],
    );

    await waitFor(() => {
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    });

    // Click "View Details"
    fireEvent.click(screen.getByText('View Details'));

    await waitFor(() => {
      expect(screen.getByText('Transfer Request Details')).toBeInTheDocument();
      expect(screen.getByText('Site Transfer Route')).toBeInTheDocument();
      expect(screen.getAllByText('Old Candolim Site').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Worker Demographics')).toBeInTheDocument();
      expect(screen.getByText('28 yrs · male')).toBeInTheDocument();
      expect(screen.getByText(/diagnostic results and clinical surveys are strictly confidential/i)).toBeInTheDocument();
      expect(screen.getByText('Transfer Milestones & Timeline')).toBeInTheDocument();
      expect(screen.getByText('Transfer requested by worker')).toBeInTheDocument();
      expect(screen.getByText('✓ Approve Destination Request')).toBeInTheDocument();
      expect(screen.getByText('✕ Reject Request')).toBeInTheDocument();
    });

    // Approve destination request
    fireEvent.click(screen.getByText('✓ Approve Destination Request'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/contractor/transfers/trans-001/approve',
        expect.anything(),
      );
    });
  });
});
