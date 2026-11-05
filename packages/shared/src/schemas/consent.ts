import { z } from 'zod';
import { CONSENT_STATUS } from '../enums';

export const appInstallConsentSchema = z.object({
  consentVersion: z.string().min(1, 'Consent version is required'),
  language: z.string().min(2, 'Language is required'),
  status: z.enum(CONSENT_STATUS),
  deviceInfo: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type AppInstallConsentInput = z.infer<typeof appInstallConsentSchema>;

export const dataSubmissionConsentSchema = z.object({
  consentVersion: z.string().min(1, 'Consent version is required'),
  language: z.string().min(2, 'Language is required'),
  status: z.enum(CONSENT_STATUS),
  screeningId: z.string().optional().nullable(),
  deviceInfo: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type DataSubmissionConsentInput = z.infer<typeof dataSubmissionConsentSchema>;
