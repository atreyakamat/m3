import { z } from 'zod';
import { CORRECTION_STATUS } from '../enums';

export const ALLOWED_CORRECTION_FIELDS = [
  'fullName',
  'phone',
  'dateOfBirth',
  'gender',
  'permanentAddressPincode',
  'permanentAddressDistrict',
  'permanentAddressState',
  'permanentAddressDetails',
] as const;
export type AllowedCorrectionField = (typeof ALLOWED_CORRECTION_FIELDS)[number];

export const profileCorrectionSchema = z.object({
  fieldName: z.enum(ALLOWED_CORRECTION_FIELDS).optional(),
  field: z.string().optional(),
  oldValue: z.string().optional().nullable(),
  currentValue: z.string().optional().nullable(),
  requestedValue: z.string().optional(),
  proposedValue: z.string().optional(),
  reason: z.string().max(1000).optional().nullable(),
});
export type ProfileCorrectionInput = z.infer<typeof profileCorrectionSchema>;

export const reviewCorrectionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().max(1000).optional().nullable(),
  adminNote: z.string().max(1000).optional().nullable(),
});
export type ReviewCorrectionInput = z.infer<typeof reviewCorrectionSchema>;
