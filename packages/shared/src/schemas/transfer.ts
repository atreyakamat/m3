import { z } from 'zod';
import { TRANSFER_INITIATOR, TRANSFER_STATUS } from '../enums';

export const createWorkerTransferSchema = z.object({
  toSiteId: z.string().min(1, 'Destination site is required'),
  note: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateWorkerTransferInput = z.infer<typeof createWorkerTransferSchema>;

export const createContractorTransferSchema = z.object({
  workerId: z.string().min(1, 'Worker ID is required'),
  toSiteId: z.string().min(1, 'Destination site is required'),
  note: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateContractorTransferInput = z.infer<typeof createContractorTransferSchema>;

export const transferDecisionSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type TransferDecisionInput = z.infer<typeof transferDecisionSchema>;

export const transferRequestSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  fromSiteId: z.string().nullable(),
  toSiteId: z.string(),
  initiatorType: z.enum(TRANSFER_INITIATOR),
  initiatorId: z.string(),
  status: z.enum(TRANSFER_STATUS),
  workerDecision: z.string(),
  workerDecisionAt: z.string().nullable(),
  fromContractorDecision: z.string(),
  fromContractorDecisionAt: z.string().nullable(),
  toContractorDecision: z.string(),
  toContractorDecisionAt: z.string().nullable(),
  cancelledById: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  effectiveAt: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TransferRequestDto = z.infer<typeof transferRequestSchema>;
