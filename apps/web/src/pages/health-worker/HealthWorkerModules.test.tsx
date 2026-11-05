import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkerSearchPage } from './WorkerSearch';
import { SuspectedCaseFormPage } from './SuspectedCaseForm';
import { FollowUpsPage } from './FollowUps';
import { TravelArrivalsPage } from './TravelArrivals';
import { FacilityInboxPage } from './FacilityInbox';
import * as apiModule from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class extends Error {},
}));

const mockProfile = {
  userId: 'hw-user-1',
  displayName: 'HW Priya Sharma',
  staffCode: 'HW000001',
  role: 'HEALTH_WORKER',
  assignedFacilities: [
    {
      facilityId: 'fac-1',
      facility: {
        id: 'fac-1',
        facilityCode: 'PHC-CAN-01',
        name: 'Candolim Primary Health Centre',
      },
    },
  ],
  activeFacilityId: 'fac-1',
};

describe('Health Worker Web Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkerSearchPage', () => {
    it('searches for workers and household members', async () => {
      (apiModule.api.get as any).mockResolvedValueOnce({
        workers: [
          {
            id: 'w-1',
            workerCode: 'M3-GOA-0001',
            name: 'Ramesh Patel',
            phone: '+919876543210',
            site: { name: 'Candolim Resort' },
          },
        ],
        householdMembers: [
          {
            id: 'hm-1',
            memberCode: 'M3-GOA-0001-H01',
            fullName: 'Sunita Patel',
            relationship: 'SPOUSE',
            worker: { name: 'Ramesh Patel', workerCode: 'M3-GOA-0001' },
          },
        ],
      });

      render(
        <MemoryRouter>
          <WorkerSearchPage />
        </MemoryRouter>,
      );

      const input = screen.getByPlaceholderText(/Search by Worker ID/i);
      fireEvent.change(input, { target: { value: 'Ramesh' } });
      fireEvent.click(screen.getByRole('button', { name: /search/i }));

      await waitFor(() => {
        expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
        expect(screen.getByText('Sunita Patel')).toBeInTheDocument();
      });
      expect(screen.getByText('M3-GOA-0001')).toBeInTheDocument();
      expect(screen.getByText('M3-GOA-0001-H01')).toBeInTheDocument();
    });
  });

  describe('SuspectedCaseFormPage', () => {
    it('renders clinical governance notice and submits suspected case', async () => {
      (apiModule.api.post as any)
        .mockResolvedValueOnce({ episode: { id: 'ep-123' } })
        .mockResolvedValueOnce({ testRequest: { id: 'req-456' } });

      render(
        <MemoryRouter initialEntries={['/health-worker/cases?workerId=w-1&workerName=Ramesh+Patel']}>
          <SuspectedCaseFormPage />
        </MemoryRouter>,
      );

      // Verify clinical role banner
      expect(screen.getByText(/Clinical Role Notice/i)).toBeInTheDocument();
      expect(
        screen.getByText(/confirmation of diagnostic test results is strictly restricted to authorized Clinicians and Pathologists/i),
      ).toBeInTheDocument();
      expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /Submit Suspected Case & Request/i }));

      await waitFor(() => {
        expect(screen.getByText(/Suspected Case Recorded Successfully/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/ep-123/)).toBeInTheDocument();
      expect(screen.getByText(/req-456/)).toBeInTheDocument();
    });
  });

  describe('FollowUpsPage', () => {
    it('renders pending follow-ups and records visit outcome', async () => {
      (apiModule.api.get as any).mockImplementation((path: string) => {
        if (path === '/health-worker/me') return Promise.resolve(mockProfile);
        if (path.startsWith('/health-worker/follow-ups')) {
          return Promise.resolve([
            {
              id: 'fu-1',
              workerId: 'w-1',
              worker: { id: 'w-1', name: 'Ramesh Patel', workerCode: 'M3-GOA-0001' },
              scheduledDate: new Date().toISOString(),
              type: 'Day 3 Medication Check',
              status: 'SCHEDULED',
            },
          ]);
        }
        return Promise.reject(new Error(`Unhandled path: ${path}`));
      });

      (apiModule.api.post as any).mockResolvedValueOnce({ success: true });

      render(
        <MemoryRouter>
          <FollowUpsPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
      });
      expect(screen.getByText('Day 3 Medication Check')).toBeInTheDocument();

      // Open Modal
      fireEvent.click(screen.getByRole('button', { name: /Record Outcome/i }));
      expect(screen.getByText(/Record Follow-Up Outcome/i)).toBeInTheDocument();

      // Submit modal
      fireEvent.click(screen.getByRole('button', { name: /Confirm & Save Outcome/i }));

      await waitFor(() => {
        expect(apiModule.api.post).toHaveBeenCalledWith(
          '/health-worker/follow-ups',
          expect.objectContaining({
            followUpId: 'fu-1',
            visitOutcome: 'COMPLETED',
            referralAttended: true,
            adherenceConfirmed: true,
          }),
        );
      });
    });
  });

  describe('TravelArrivalsPage', () => {
    it('renders incoming travel records, flags high-risk states, and records arrival screening', async () => {
      (apiModule.api.get as any).mockImplementation((path: string) => {
        if (path === '/health-worker/me') return Promise.resolve(mockProfile);
        if (path.startsWith('/health-worker/travel-arrivals')) {
          return Promise.resolve([
            {
              id: 'tr-1',
              workerId: 'w-1',
              worker: { id: 'w-1', name: 'Ramesh Patel', workerCode: 'M3-GOA-0001' },
              originState: 'Odisha',
              originDistrict: 'Sundargarh',
              travelDate: new Date().toISOString(),
              transportMode: 'TRAIN',
              arrivalFever: null,
              arrivalTestedOrTreated: null,
              arrivalReferred: null,
            },
          ]);
        }
        return Promise.reject(new Error(`Unhandled path: ${path}`));
      });

      (apiModule.api.post as any).mockResolvedValueOnce({ success: true });

      render(
        <MemoryRouter>
          <TravelArrivalsPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Ramesh Patel')).toBeInTheDocument();
      });
      // High risk state flag
      expect(screen.getByText('HIGH RISK')).toBeInTheDocument();
      expect(screen.getByText('Pending Screening')).toBeInTheDocument();

      // Open screening modal
      fireEvent.click(screen.getByRole('button', { name: /Screen on Arrival/i }));
      expect(screen.getByText(/Record Arrival Screening/i)).toBeInTheDocument();

      // Submit screening
      fireEvent.click(screen.getByRole('button', { name: /Save Arrival Screening/i }));

      await waitFor(() => {
        expect(apiModule.api.post).toHaveBeenCalledWith(
          '/travel/tr-1/arrival-screening',
          expect.objectContaining({
            arrivalFever: false,
            arrivalTestedOrTreated: false,
            arrivalReferred: false,
          }),
        );
      });
    });
  });

  describe('FacilityInboxPage', () => {
    it('renders facility notifications and supports acknowledging and recording actions', async () => {
      (apiModule.api.get as any).mockImplementation((path: string) => {
        if (path === '/health-worker/me') return Promise.resolve(mockProfile);
        if (path.startsWith('/health-worker/inbox')) {
          return Promise.resolve({
            notifications: [
              {
                id: 'notif-1',
                type: 'POSITIVE_MALARIA_RESULT',
                title: 'Confirmed Positive Malaria Result',
                body: 'Worker M3-GOA-0001 tested POSITIVE (RDT).',
                createdAt: new Date().toISOString(),
                acknowledgedAt: null,
                actionTaken: null,
              },
            ],
            unreadCount: 1,
            unacknowledgedCount: 1,
          });
        }
        return Promise.reject(new Error(`Unhandled path: ${path}`));
      });

      (apiModule.api.post as any).mockResolvedValueOnce({ success: true });

      render(
        <MemoryRouter>
          <FacilityInboxPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Confirmed Positive Malaria Result')).toBeInTheDocument();
      });
      expect(screen.getByText('CONFIRMED POSITIVE')).toBeInTheDocument();
      expect(screen.getByText('Pending Acknowledgment')).toBeInTheDocument();

      // Acknowledge
      fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
      await waitFor(() => {
        expect(apiModule.api.post).toHaveBeenCalledWith('/health-worker/inbox/notif-1/acknowledge', {});
      });

      // Open action modal
      fireEvent.click(screen.getByRole('button', { name: 'Record Action' }));
      expect(screen.getByText('Record Clinical Action Taken')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Dispatched field surveillance team/i);
      fireEvent.change(textarea, { target: { value: 'Dispatched community health worker.' } });

      fireEvent.click(screen.getByRole('button', { name: 'Save Clinical Action' }));
      await waitFor(() => {
        expect(apiModule.api.post).toHaveBeenCalledWith('/health-worker/inbox/notif-1/action', {
          actionTaken: 'Dispatched community health worker.',
        });
      });
    });
  });
});
