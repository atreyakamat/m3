import { z } from 'zod';
import { FACILITY_TYPE, ESCALATION_ALERT_STATUS } from '../enums';

export const createFacilitySchema = z.object({
  facilityCode: z.string().min(1, 'Facility code is required'),
  name: z.string().min(1, 'Facility name is required'),
  type: z.enum(FACILITY_TYPE),
  state: z.string().default('Goa'),
  district: z.string().min(1, 'District is required'),
  taluka: z.string().min(1, 'Taluka is required'),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;

export const assignStaffSchema = z.object({
  facilityId: z.string().min(1, 'Facility is required'),
  userId: z.string().min(1, 'User is required'),
  role: z.enum(['HEALTH_WORKER', 'CLINICIAN']),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;

export const createEscalationAlertSchema = z.object({
  facilityId: z.string().min(1, 'Facility is required'),
  diagnosticResultId: z.string().min(1, 'Diagnostic result is required'),
  screeningId: z.string().optional().nullable(),
  workerId: z.string().optional().nullable(),
  clinicianUserIds: z.array(z.string()).min(1, 'At least one clinician must be selected'),
  urgency: z.enum(['NORMAL', 'HIGH', 'CRITICAL']).default('HIGH'),
  notes: z.string().max(1000).optional().nullable(),
});
export type CreateEscalationAlertInput = z.infer<typeof createEscalationAlertSchema>;

export const acknowledgeEscalationSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
});
export type AcknowledgeEscalationInput = z.infer<typeof acknowledgeEscalationSchema>;

export const actionEscalationSchema = z.object({
  actionTaken: z.string().min(1, 'Action description is required'),
});
export type ActionEscalationInput = z.infer<typeof actionEscalationSchema>;
