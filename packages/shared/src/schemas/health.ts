import { z } from 'zod';
import {
  DIAGNOSTIC_RESULT,
  EPISODE_STATUS,
  PLASMODIUM_SPECIES,
  TEST_TYPE,
} from '../enums';

/** Worker "Feeling unwell" symptom report — never a diagnosis. */
export const symptomReportSchema = z.object({
  symptoms: z.array(z.string()).default([]),
  note: z.string().max(1000).optional(),
  episodeId: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type SymptomReportInput = z.infer<typeof symptomReportSchema>;

/** Worker follow-up response — tap-based options plus optional text. */
export const followUpResponseSchema = z.object({
  followUpId: z.string().min(1),
  response: z.string().min(1, 'A response is required'),
  note: z.string().max(1000).optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type FollowUpResponseInput = z.infer<typeof followUpResponseSchema>;

/** Authorized diagnostic result (clinician/pathologist only — not worker). */
export const diagnosticResultSchema = z.object({
  episodeId: z.string().min(1),
  testType: z.enum(TEST_TYPE),
  result: z.enum(DIAGNOSTIC_RESULT),
  species: z.enum(PLASMODIUM_SPECIES).optional(),
  testDate: z.string(),
});
export type DiagnosticResultInput = z.infer<typeof diagnosticResultSchema>;

export const episodeSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  status: z.enum(EPISODE_STATUS),
  onsetDate: z.string().nullable(),
  createdAt: z.string(),
});
export type EpisodeDto = z.infer<typeof episodeSchema>;
