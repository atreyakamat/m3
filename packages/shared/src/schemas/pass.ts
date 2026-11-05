import { z } from 'zod';

export const scanWorkerPassSchema = z.object({
  token: z.string().min(1, 'Pass token is required'),
});
export type ScanWorkerPassInput = z.infer<typeof scanWorkerPassSchema>;

export const requestWorkerAssignmentSchema = z.object({
  token: z.string().min(1, 'Pass token is required'),
  siteCode: z.string().min(1, 'Site code is required'),
  note: z.string().max(500).optional(),
});
export type RequestWorkerAssignmentInput = z.infer<typeof requestWorkerAssignmentSchema>;

export const workerPassIdentityConfirmationSchema = z.object({
  workerCode: z.string(),
  name: z.string(),
  currentSite: z
    .object({
      siteId: z.string(),
      name: z.string(),
    })
    .nullable(),
  currentContractor: z
    .object({
      contractorId: z.string(),
      name: z.string(),
    })
    .nullable(),
  hasActiveAssignment: z.boolean(),
  isAssignedToCaller: z.boolean(),
  pendingTransfer: z
    .object({
      id: z.string(),
      status: z.string(),
      fromSite: z.string().nullable(),
      toSite: z.string(),
      initiator: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  canRequest: z.boolean(),
  reason: z.string().optional(),
  token: z.string(),
});
export type WorkerPassIdentityConfirmation = z.infer<typeof workerPassIdentityConfirmationSchema>;
