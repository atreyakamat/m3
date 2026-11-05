import { z } from 'zod';
import { TEST_TYPE } from '../enums';

export const selectActiveFacilitySchema = z.object({
  facilityId: z.string().uuid('Invalid facility ID format'),
});
export type SelectActiveFacilityInput = z.infer<typeof selectActiveFacilitySchema>;

export const healthWorkerSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required'),
  facilityId: z.string().uuid().optional(),
});
export type HealthWorkerSearchQueryInput = z.infer<typeof healthWorkerSearchQuerySchema>;

export const suspectedCaseInputSchema = z.object({
  workerId: z.string().uuid('Valid worker ID required'),
  facilityId: z.string().uuid('Valid facility ID required'),
  onsetDate: z.string().optional().nullable(),
  symptoms: z.array(z.string()).default([]),
  clinicalObservations: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type SuspectedCaseInput = z.infer<typeof suspectedCaseInputSchema>;

export const testRequestInputSchema = z.object({
  episodeId: z.string().uuid('Valid episode ID required'),
  workerId: z.string().uuid('Valid worker ID required'),
  facilityId: z.string().uuid('Valid facility ID required'),
  testType: z.enum(TEST_TYPE),
  sampleDetails: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  labReferralRequired: z.boolean().default(false),
  referralFacilityId: z.string().uuid().optional().nullable(),
});
export type TestRequestInput = z.infer<typeof testRequestInputSchema>;

export const healthWorkerFollowUpInputSchema = z.object({
  followUpId: z.string().uuid().optional().nullable(),
  workerId: z.string().uuid('Valid worker ID required'),
  episodeId: z.string().uuid().optional().nullable(),
  question: z.string().default('Follow-up contact/visit'),
  response: z.string().trim().min(1, 'A follow-up response is required'),
  note: z.string().max(1000).optional().nullable(),
  attendedReferral: z.boolean().optional().nullable(),
  referralFacilityId: z.string().uuid().optional().nullable(),
  status: z.string().default('COMPLETED'),
});
export type HealthWorkerFollowUpInput = z.infer<typeof healthWorkerFollowUpInputSchema>;

export const healthWorkerScreeningInputSchema = z.object({
  workerId: z.string().uuid('Valid worker ID required'),
  facilityId: z.string().uuid('Valid facility ID required'),
  answers: z.record(z.unknown()),
  clinicalObservations: z.string().max(2000).optional().nullable(),
  isAssisted: z.boolean().default(true),
});
export type HealthWorkerScreeningInput = z.infer<typeof healthWorkerScreeningInputSchema>;

export const healthWorkerHouseholdScreeningInputSchema = z.object({
  memberId: z.string().uuid('Valid household member ID required'),
  facilityId: z.string().uuid('Valid facility ID required'),
  symptoms: z.array(z.string()).default([]),
  clinicalHistory: z.string().max(2000).optional().nullable(),
  examinationFindings: z.string().max(2000).optional().nullable(),
  testRequested: z.boolean().default(false),
  testType: z.enum(TEST_TYPE).optional().nullable(),
  diagnosis: z.string().max(1000).optional().nullable(),
  treatment: z.string().max(1000).optional().nullable(),
  referralInfo: z.string().max(1000).optional().nullable(),
  followUpRequired: z.boolean().default(false),
  nextFollowUpDate: z.string().optional().nullable(),
  clinicalNotes: z.string().max(2000).optional().nullable(),
});
export type HealthWorkerHouseholdScreeningInput = z.infer<typeof healthWorkerHouseholdScreeningInputSchema>;
