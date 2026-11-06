import { z } from 'zod';
import { HOUSEHOLD_RELATIONSHIP, DIAGNOSTIC_RESULT } from '../enums';

export const createHouseholdMemberSchema = z.object({
  fullName: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  ageYears: z.number().int().min(0).max(120).optional().nullable(),
  relationship: z.enum(HOUSEHOLD_RELATIONSHIP),
  isDependent: z.boolean().default(true),
  isRoommate: z.boolean().default(false),
  active: z.boolean().default(true).optional(),
  phone: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type CreateHouseholdMemberInput = z.infer<typeof createHouseholdMemberSchema>;

export const updateHouseholdMemberSchema = createHouseholdMemberSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateHouseholdMemberInput = z.infer<typeof updateHouseholdMemberSchema>;

export const createHouseholdAssessmentSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  hasFever: z.boolean().optional(),
  hadFever: z.boolean().optional(),
  symptoms: z.array(z.string()).default([]),
  temperature: z.number().optional().nullable(),
  suspectedMalaria: z.boolean().default(false),
  rdtPerformed: z.boolean().default(false),
  rdtResult: z.enum(DIAGNOSTIC_RESULT).optional().nullable(),
  microscopyResult: z.string().optional().nullable(),
  species: z.string().optional().nullable(),
  referredForCare: z.boolean().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type CreateHouseholdAssessmentInput = z.infer<typeof createHouseholdAssessmentSchema>;
