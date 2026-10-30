import { describe, expect, it } from 'vitest';
import {
  canActorDecide,
  computeTransferStatus,
  initialDecisions,
  isTerminal,
  requiredApprovers,
  type TransferDecisions,
} from './transfer';

describe('transfer required approvers', () => {
  it('worker-initiated needs both contractors', () => {
    expect(requiredApprovers('WORKER')).toEqual(['fromContractor', 'toContractor']);
  });
  it('contractor-initiated needs worker + current contractor', () => {
    expect(requiredApprovers('CONTRACTOR')).toEqual(['worker', 'fromContractor']);
  });
});

describe('worker-initiated flow', () => {
  const init = initialDecisions('WORKER');
  it('starts pending current contractor', () => {
    expect(init.worker).toBe('APPROVED');
    expect(computeTransferStatus('WORKER', init)).toBe('PENDING_CURRENT_CONTRACTOR');
  });
  it('moves to destination contractor after current approves', () => {
    const d: TransferDecisions = { ...init, fromContractor: 'APPROVED' };
    expect(computeTransferStatus('WORKER', d)).toBe('PENDING_DESTINATION_CONTRACTOR');
  });
  it('completes only after BOTH contractors approve', () => {
    const d: TransferDecisions = { worker: 'APPROVED', fromContractor: 'APPROVED', toContractor: 'APPROVED' };
    expect(computeTransferStatus('WORKER', d)).toBe('ACCEPTED');
  });
  it('rejects if either contractor rejects', () => {
    expect(computeTransferStatus('WORKER', { ...init, toContractor: 'REJECTED' })).toBe('REJECTED');
    expect(computeTransferStatus('WORKER', { ...init, fromContractor: 'REJECTED' })).toBe('REJECTED');
  });
});

describe('contractor-initiated flow', () => {
  const init = initialDecisions('CONTRACTOR');
  it('starts pending worker response, destination pre-approved', () => {
    expect(init.toContractor).toBe('APPROVED');
    expect(computeTransferStatus('CONTRACTOR', init)).toBe('PENDING_WORKER_RESPONSE');
  });
  it('after worker accepts, needs current contractor', () => {
    const d: TransferDecisions = { ...init, worker: 'APPROVED' };
    expect(computeTransferStatus('CONTRACTOR', d)).toBe('PENDING_CURRENT_CONTRACTOR');
  });
  it('completes after worker + current contractor approve (no extra destination approval)', () => {
    const d: TransferDecisions = { worker: 'APPROVED', fromContractor: 'APPROVED', toContractor: 'APPROVED' };
    expect(computeTransferStatus('CONTRACTOR', d)).toBe('ACCEPTED');
  });
  it('worker rejection kills it', () => {
    expect(computeTransferStatus('CONTRACTOR', { ...init, worker: 'REJECTED' })).toBe('REJECTED');
  });
});

describe('cancellation', () => {
  it('cancelled overrides everything', () => {
    const d: TransferDecisions = { worker: 'APPROVED', fromContractor: 'APPROVED', toContractor: 'APPROVED' };
    expect(computeTransferStatus('WORKER', d, true)).toBe('CANCELLED');
  });
});

describe('canActorDecide sequencing & authorization', () => {
  it('rejects an actor that is not a required approver', () => {
    // worker is not a required approver on a worker-initiated transfer
    expect(canActorDecide('WORKER', initialDecisions('WORKER'), 'worker')).toBe(false);
  });
  it('current contractor cannot act before worker accepts (contractor-initiated)', () => {
    const init = initialDecisions('CONTRACTOR');
    expect(canActorDecide('CONTRACTOR', init, 'fromContractor')).toBe(false);
    const afterWorker: TransferDecisions = { ...init, worker: 'APPROVED' };
    expect(canActorDecide('CONTRACTOR', afterWorker, 'fromContractor')).toBe(true);
  });
  it('cannot decide twice', () => {
    const d: TransferDecisions = { ...initialDecisions('WORKER'), fromContractor: 'APPROVED' };
    expect(canActorDecide('WORKER', d, 'fromContractor')).toBe(false);
  });
});

describe('isTerminal', () => {
  it('flags terminal states', () => {
    expect(isTerminal('ACCEPTED')).toBe(true);
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('PENDING_WORKER_RESPONSE')).toBe(false);
  });
});
