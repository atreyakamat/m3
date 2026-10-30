import { z } from 'zod';
import { SCREENING_STATUS } from '../enums';

/** Free-form answers keyed by questionnaire field id. Validated structurally;
 *  completeness (required fields + consent) is enforced by shared logic. */
export const screeningAnswersSchema = z.record(z.string(), z.unknown());
export type ScreeningAnswers = z.infer<typeof screeningAnswersSchema>;

export const saveScreeningDraftSchema = z.object({
  answers: screeningAnswersSchema,
  consentGiven: z.boolean().default(false),
  /** client-generated idempotency key so retried syncs don't duplicate. */
  idempotencyKey: z.string().uuid().optional(),
});
export type SaveScreeningDraftInput = z.infer<typeof saveScreeningDraftSchema>;

export const completeScreeningSchema = z.object({
  answers: screeningAnswersSchema,
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'Consent is required to complete screening' }),
  }),
  idempotencyKey: z.string().uuid().optional(),
});
export type CompleteScreeningInput = z.infer<typeof completeScreeningSchema>;

export const screeningSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  status: z.enum(SCREENING_STATUS),
  version: z.string(),
  consentGiven: z.boolean(),
  answers: screeningAnswersSchema,
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Screening = z.infer<typeof screeningSchema>;
