import { flushOutbox } from './sync';
import { outboxRepo } from '@/db/outbox';
import { healthWorkerApi } from '@/api';

jest.mock('@/db/outbox', () => ({
  outboxRepo: {
    pendingOrFailed: jest.fn(),
    markSynced: jest.fn(),
    markFailed: jest.fn(),
  },
}));

jest.mock('@/api', () => ({
  recordsApi: { submitSymptom: jest.fn(), submitTravel: jest.fn() },
  screeningApi: { complete: jest.fn(), saveDraft: jest.fn() },
  travelApi: { leave: jest.fn(), enter: jest.fn() },
  workerApi: {
    addHousehold: jest.fn(),
    requestCorrection: jest.fn(),
    consentInstall: jest.fn(),
    consentSubmission: jest.fn(),
  },
  healthWorkerApi: {
    recordScreening: jest.fn(),
    recordHouseholdScreening: jest.fn(),
    recordSuspectedCase: jest.fn(),
    recordTestRequest: jest.fn(),
    recordFollowUp: jest.fn(),
    arrivalScreening: jest.fn(),
  },
  isNetworkError: jest.fn((err: any) => err?.isNetworkError === true),
}));

jest.mock('./screeningLocal', () => ({
  screeningLocalRepo: { markSynced: jest.fn() },
}));

describe('Health Worker Offline Synchronization Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('correctly flushes hw_screening from outbox', async () => {
    const mockItem = {
      id: 'hw-outbox-1',
      entityType: 'hw_screening',
      localId: 'hw-scr-1',
      payload: JSON.stringify({ workerId: 'w-1', facilityId: 'fac-1', answers: { fever: 'no' } }),
      idempotencyKey: 'idem-hw-1',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (healthWorkerApi.recordScreening as jest.Mock).mockResolvedValue({ id: 'scr-1', status: 'COMPLETE' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(healthWorkerApi.recordScreening).toHaveBeenCalledWith('mock-token', {
      workerId: 'w-1',
      facilityId: 'fac-1',
      answers: { fever: 'no' },
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('hw-outbox-1');
  });

  it('correctly flushes hw_suspected_case from outbox', async () => {
    const mockItem = {
      id: 'hw-outbox-2',
      entityType: 'hw_suspected_case',
      localId: 'hw-case-1',
      payload: JSON.stringify({ workerId: 'w-1', facilityId: 'fac-1', symptoms: ['chills'] }),
      idempotencyKey: 'idem-hw-2',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (healthWorkerApi.recordSuspectedCase as jest.Mock).mockResolvedValue({ id: 'ep-1', status: 'SUSPECTED' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(healthWorkerApi.recordSuspectedCase).toHaveBeenCalledWith('mock-token', {
      workerId: 'w-1',
      facilityId: 'fac-1',
      symptoms: ['chills'],
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('hw-outbox-2');
  });

  it('correctly flushes hw_test_request from outbox', async () => {
    const mockItem = {
      id: 'hw-outbox-3',
      entityType: 'hw_test_request',
      localId: 'hw-test-1',
      payload: JSON.stringify({ episodeId: 'ep-1', workerId: 'w-1', facilityId: 'fac-1', testType: 'RDT' }),
      idempotencyKey: 'idem-hw-3',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (healthWorkerApi.recordTestRequest as jest.Mock).mockResolvedValue({ episodeId: 'ep-1', status: 'TEST_REQUESTED' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(healthWorkerApi.recordTestRequest).toHaveBeenCalledWith('mock-token', {
      episodeId: 'ep-1',
      workerId: 'w-1',
      facilityId: 'fac-1',
      testType: 'RDT',
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('hw-outbox-3');
  });

  it('correctly flushes hw_follow_up from outbox', async () => {
    const mockItem = {
      id: 'hw-outbox-4',
      entityType: 'hw_follow_up',
      localId: 'hw-fu-1',
      payload: JSON.stringify({ workerId: 'w-1', response: 'Patient recovered', attendedReferral: true }),
      idempotencyKey: 'idem-hw-4',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (healthWorkerApi.recordFollowUp as jest.Mock).mockResolvedValue({ id: 'fu-1' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(healthWorkerApi.recordFollowUp).toHaveBeenCalledWith('mock-token', {
      workerId: 'w-1',
      response: 'Patient recovered',
      attendedReferral: true,
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('hw-outbox-4');
  });

  it('correctly flushes hw_household_assessment from outbox', async () => {
    const mockItem = {
      id: 'hw-outbox-5',
      entityType: 'hw_household_assessment',
      localId: 'hw-ha-1',
      payload: JSON.stringify({ memberId: 'm-1', facilityId: 'fac-1', symptoms: ['headache'] }),
      idempotencyKey: 'idem-hw-5',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (healthWorkerApi.recordHouseholdScreening as jest.Mock).mockResolvedValue({ id: 'ha-1' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(healthWorkerApi.recordHouseholdScreening).toHaveBeenCalledWith('mock-token', {
      memberId: 'm-1',
      facilityId: 'fac-1',
      symptoms: ['headache'],
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('hw-outbox-5');
  });

  it('correctly flushes hw_arrival_screening from outbox', async () => {
    const mockItem = {
      id: 'hw-outbox-6',
      entityType: 'hw_arrival_screening',
      localId: 'hw-arr-1',
      payload: JSON.stringify({
        travelId: 'travel-1',
        arrivalFacilityId: 'fac-1',
        arrivalFever: true,
      }),
      idempotencyKey: 'idem-hw-6',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (healthWorkerApi.arrivalScreening as jest.Mock).mockResolvedValue({ id: 'travel-1', arrivalScreened: true });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(healthWorkerApi.arrivalScreening).toHaveBeenCalledWith('mock-token', 'travel-1', {
      travelId: 'travel-1',
      arrivalFacilityId: 'fac-1',
      arrivalFever: true,
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('hw-outbox-6');
  });
});
