/**
 * Admin-module input schemas. Validation lives in @m3/shared so the API,
 * web portal and tests share one contract. Every schema here is consumed
 * only by Admin-authorised endpoints (RBAC is still enforced backend-side).
 */
import { z } from 'zod';
import { ADMIN_PROVISIONABLE_ROLES } from '../roles';
import { TRAVEL_REPORT_STATUS } from '../enums';
import { phoneSchema, pinSchema } from './auth';

// ---- construction sites ---------------------------------------------------

export const createAdminSiteSchema = z.object({
  name: z.string().trim().min(2, 'Site name is required').max(140),
  areaId: z.string().uuid('Select the site area'),
  contractorId: z.string().uuid().nullable().optional(),
  address: z.string().trim().max(300).optional(),
  landmark: z.string().trim().max(160).optional(),
  contactPhone: phoneSchema.optional().or(z.literal('')),
});
export type CreateAdminSiteInput = z.infer<typeof createAdminSiteSchema>;

export const updateAdminSiteSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  areaId: z.string().uuid().optional(),
  contractorId: z.string().uuid().nullable().optional(),
  address: z.string().trim().max(300).optional(),
  landmark: z.string().trim().max(160).optional(),
  contactPhone: phoneSchema.optional().or(z.literal('')),
});
export type UpdateAdminSiteInput = z.infer<typeof updateAdminSiteSchema>;

/** Deactivation requires explicit confirmation once the site has active relationships. */
export const deactivateAdminSiteSchema = z.object({
  confirm: z.boolean().optional(),
});

// ---- user management ------------------------------------------------------

export const createAdminUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  phone: phoneSchema,
  role: z.enum(ADMIN_PROVISIONABLE_ROLES),
  tempPin: pinSchema,
  /** Contractors only: sites to assign at creation time. */
  siteIds: z.array(z.string()).max(50).optional(),
});
export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

/** Re-issues a fresh temporary PIN; the account is locked back into the first-login change flow. */
export const resetAdminUserPinSchema = z.object({
  tempPin: pinSchema,
});
export type ResetAdminUserPinInput = z.infer<typeof resetAdminUserPinSchema>;


// ---- travel reports -------------------------------------------------------

export const travelReportReviewSchema = z.object({
  status: z.enum(TRAVEL_REPORT_STATUS.slice(1) as ['REVIEWED', 'RESOLVED']),
  note: z.string().trim().max(2000).optional(),
});
export type TravelReportReviewInput = z.infer<typeof travelReportReviewSchema>;

// ---- contractor travel-report foundation (spec §12) -----------------------

export const submitTravelReportSchema = z.object({
  workerId: z.string().trim().min(1),
  travelRecordId: z.string(),
  comment: z.string().trim().min(1, 'A reason or comment is required').max(2000),
});
export type SubmitTravelReportInput = z.infer<typeof submitTravelReportSchema>;

// ---- worker-side travel cancellation -------------------------------------

export const cancelTravelRecordSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelTravelRecordInput = z.infer<typeof cancelTravelRecordSchema>;

// ---- worker join requests (Contractor decides; Admin observes) -------------

export const createJoinRequestSchema = z.object({
  siteId: z.string().trim().min(1),
});
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;
