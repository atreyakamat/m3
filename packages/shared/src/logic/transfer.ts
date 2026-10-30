import type { Decision, TransferInitiator, TransferStatus } from '../enums';

/**
 * Transfer state machine — the single source of truth for the approval rules
 * in worker_architecture.md §17. The API is authoritative (it resolves which
 * contractor is current/destination from the site records); the frontends use
 * these same pure functions only for display. Business logic lives here, never
 * duplicated in controllers or screens.
 *
 * Worker-initiated:        worker implicitly accepts; needs BOTH the current
 *                          (from-site) AND destination (to-site) contractor.
 * Contractor-initiated:    initiated by the destination contractor (implicit
 *                          acceptance); needs the WORKER to accept AND the
 *                          current (from-site) contractor to approve. No extra
 *                          destination approval.
 */

export interface TransferDecisions {
  worker: Decision;
  fromContractor: Decision;
  toContractor: Decision;
}

export type TransferActor = 'worker' | 'fromContractor' | 'toContractor';

/** Decision slots that must be APPROVED for the transfer to complete. */
export function requiredApprovers(initiator: TransferInitiator): TransferActor[] {
  return initiator === 'WORKER'
    ? ['fromContractor', 'toContractor']
    : ['worker', 'fromContractor'];
}

/** Initial decisions: the initiator's slot is pre-approved. */
export function initialDecisions(initiator: TransferInitiator): TransferDecisions {
  if (initiator === 'WORKER') {
    return { worker: 'APPROVED', fromContractor: 'PENDING', toContractor: 'PENDING' };
  }
  return { worker: 'PENDING', fromContractor: 'PENDING', toContractor: 'APPROVED' };
}

export function computeTransferStatus(
  initiator: TransferInitiator,
  decisions: TransferDecisions,
  cancelled = false,
): TransferStatus {
  if (cancelled) return 'CANCELLED';

  const required = requiredApprovers(initiator);

  // Any required approver that rejected kills the request.
  if (required.some((a) => decisions[a] === 'REJECTED')) return 'REJECTED';

  // All required approvers approved -> completed.
  if (required.every((a) => decisions[a] === 'APPROVED')) return 'ACCEPTED';

  // Otherwise report the next pending slot in sequence.
  if (initiator === 'WORKER') {
    if (decisions.fromContractor === 'PENDING') return 'PENDING_CURRENT_CONTRACTOR';
    return 'PENDING_DESTINATION_CONTRACTOR';
  }
  // Contractor-initiated: worker first, then current contractor.
  if (decisions.worker === 'PENDING') return 'PENDING_WORKER_RESPONSE';
  return 'PENDING_CURRENT_CONTRACTOR';
}

/**
 * Whether `actor` is allowed to record a decision right now. Enforces both the
 * "only a required approver may act" rule and the sequencing rule (the current
 * contractor acts only after the worker has accepted a contractor-initiated
 * request). The API additionally verifies the actor's identity against the
 * authoritative site→contractor mapping.
 */
export function canActorDecide(
  initiator: TransferInitiator,
  decisions: TransferDecisions,
  actor: TransferActor,
): boolean {
  if (!requiredApprovers(initiator).includes(actor)) return false;
  if (decisions[actor] !== 'PENDING') return false; // already decided

  if (initiator === 'CONTRACTOR' && actor === 'fromContractor') {
    // current contractor can only approve once the worker has accepted
    return decisions.worker === 'APPROVED';
  }
  return true;
}

export function isTerminal(status: TransferStatus): boolean {
  return status === 'ACCEPTED' || status === 'REJECTED' || status === 'CANCELLED';
}
