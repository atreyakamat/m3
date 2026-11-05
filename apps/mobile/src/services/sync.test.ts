import { flushOutbox, pendingCount } from './sync';
import { outboxRepo } from '@/db/outbox';
import { recordsApi, screeningApi, travelApi, workerApi } from '@/api';

jest.mock('@/db/outbox', () => ({
  outboxRepo: {
    pendingOrFailed: jest.fn(),
    markSynced: jest.fn(),
    markFailed: jest.fn(),
  },
}));

jest.mock('@/api', () => ({
  recordsApi: {
    submitSymptom: jest.fn(),
    submitTravel: jest.fn(),
  },
  screeningApi: {
    complete: jest.fn(),
    saveDraft: jest.fn(),
  },
  travelApi: {
    leave: jest.fn(),
    enter: jest.fn(),
  },
  workerApi: {
    addHousehold: jest.fn(),
    requestCorrection: jest.fn(),
    consentInstall: jest.fn(),
    consentSubmission: jest.fn(),
  },
  isNetworkError: jest.fn((err: any) => err?.isNetworkError === true),
}));

jest.mock('./screeningLocal', () => ({
  screeningLocalRepo: {
    markSynced: jest.fn(),
  },
}));

describe('Offline Synchronization Service (flushOutbox)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('correctly flushes household_member from outbox', async () => {
    const mockItem = {
      id: 'outbox-1',
      entityType: 'household_member',
      localId: 'hh-local-1',
      payload: JSON.stringify({ fullName: 'Ramesh Kumar', relationship: 'BROTHER', ageYears: 24 }),
      idempotencyKey: 'idem-1',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (workerApi.addHousehold as jest.Mock).mockResolvedValue({ id: 'hh-1', memberCode: 'HH-M01' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(workerApi.addHousehold).toHaveBeenCalledWith('mock-token', {
      fullName: 'Ramesh Kumar',
      relationship: 'BROTHER',
      ageYears: 24,
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('outbox-1');
  });

  it('correctly flushes profile_correction from outbox', async () => {
    const mockItem = {
      id: 'outbox-2',
      entityType: 'profile_correction',
      localId: 'corr-local-1',
      payload: JSON.stringify({ field: 'fullName', proposedValue: 'Suresh Das', reason: 'Spelling error' }),
      idempotencyKey: 'idem-2',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (workerApi.requestCorrection as jest.Mock).mockResolvedValue({ id: 'corr-1', status: 'PENDING' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(workerApi.requestCorrection).toHaveBeenCalledWith('mock-token', {
      field: 'fullName',
      proposedValue: 'Suresh Das',
      reason: 'Spelling error',
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('outbox-2');
  });

  it('correctly flushes travel_leaving from outbox', async () => {
    const mockItem = {
      id: 'outbox-3',
      entityType: 'travel_leaving',
      localId: 'travel-leave-1',
      payload: JSON.stringify({ departureDate: '2026-11-10', destinationState: 'Bihar', destinationDistrict: 'Patna' }),
      idempotencyKey: 'idem-3',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (travelApi.leave as jest.Mock).mockResolvedValue({ id: 'travel-1', status: 'PENDING_CONFIRMATION' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(travelApi.leave).toHaveBeenCalledWith('mock-token', {
      departureDate: '2026-11-10',
      destinationState: 'Bihar',
      destinationDistrict: 'Patna',
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('outbox-3');
  });

  it('correctly flushes travel_entering from outbox', async () => {
    const mockItem = {
      id: 'outbox-4',
      entityType: 'travel_entering',
      localId: 'travel-enter-1',
      payload: JSON.stringify({ arrivalDate: '2026-11-05', originState: 'Odisha', hadFeverOrMalaria: true }),
      idempotencyKey: 'idem-4',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (travelApi.enter as jest.Mock).mockResolvedValue({ id: 'travel-2', status: 'ACTIVE' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(travelApi.enter).toHaveBeenCalledWith('mock-token', {
      arrivalDate: '2026-11-05',
      originState: 'Odisha',
      hadFeverOrMalaria: true,
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('outbox-4');
  });

  it('correctly flushes consent_install from outbox', async () => {
    const mockItem = {
      id: 'outbox-5',
      entityType: 'consent_install',
      localId: 'ci-1',
      payload: JSON.stringify({ consentVersion: '1.0', language: 'hi', status: 'ACCEPTED' }),
      idempotencyKey: 'idem-5',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (workerApi.consentInstall as jest.Mock).mockResolvedValue({ success: true });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(workerApi.consentInstall).toHaveBeenCalledWith('mock-token', {
      consentVersion: '1.0',
      language: 'hi',
      status: 'ACCEPTED',
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('outbox-5');
  });

  it('correctly flushes consent_submission from outbox', async () => {
    const mockItem = {
      id: 'outbox-6',
      entityType: 'consent_submission',
      localId: 'cs-1',
      payload: JSON.stringify({ consentVersion: '1.0', language: 'bn', status: 'ACCEPTED' }),
      idempotencyKey: 'idem-6',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (workerApi.consentSubmission as jest.Mock).mockResolvedValue({ success: true });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(1);
    expect(workerApi.consentSubmission).toHaveBeenCalledWith('mock-token', {
      consentVersion: '1.0',
      language: 'bn',
      status: 'ACCEPTED',
    });
    expect(outboxRepo.markSynced).toHaveBeenCalledWith('outbox-6');
  });

  it('keeps item pending when a network error occurs during flush', async () => {
    const mockItem = {
      id: 'outbox-7',
      entityType: 'household_member',
      localId: 'hh-local-2',
      payload: JSON.stringify({ fullName: 'Offline User' }),
      idempotencyKey: 'idem-7',
      attempts: 0,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (workerApi.addHousehold as jest.Mock).mockRejectedValue({ isNetworkError: true, message: 'Network offline' });

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(0);
    expect(outboxRepo.markSynced).not.toHaveBeenCalled();
    expect(outboxRepo.markFailed).not.toHaveBeenCalled();
  });

  it('marks item as failed when a permanent/server error occurs', async () => {
    const mockItem = {
      id: 'outbox-8',
      entityType: 'profile_correction',
      localId: 'corr-local-2',
      payload: JSON.stringify({ field: 'fullName' }),
      idempotencyKey: 'idem-8',
      attempts: 1,
    };
    (outboxRepo.pendingOrFailed as jest.Mock).mockReturnValue([mockItem]);
    (workerApi.requestCorrection as jest.Mock).mockRejectedValue(new Error('Validation failed'));

    const flushed = await flushOutbox('mock-token');

    expect(flushed).toBe(0);
    expect(outboxRepo.markSynced).not.toHaveBeenCalled();
    expect(outboxRepo.markFailed).toHaveBeenCalledWith('outbox-8', 'Error: Validation failed', 2);
  });
});
