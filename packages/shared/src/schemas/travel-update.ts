import { z } from 'zod';
import { INDIAN_STATES, DEPARTURE_CONFIRMATION_STATUS } from '../enums';

export const travelLeaveSchema = z.object({
  departureDate: z.string().min(1, 'Departure date is required'),
  destinationState: z.enum(INDIAN_STATES),
  destinationDistrict: z.string().optional().nullable(),
  destinationTown: z.string().optional().nullable(),
  expectedReturnDate: z.string().optional().nullable(),
  returnDate: z.string().optional().nullable(),
  purpose: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  idempotencyKey: z.string().uuid().optional(),
});
export type TravelLeaveInput = z.infer<typeof travelLeaveSchema>;

export const travelEnterSchema = z.object({
  travelRecordId: z.string().optional().nullable(),
  arrivalDate: z.string().min(1, 'Arrival date is required'),
  originState: z.enum(INDIAN_STATES).optional().nullable(),
  originDistrict: z.string().optional().nullable(),
  originTown: z.string().optional().nullable(),
  hadFeverOrMalaria: z.boolean().default(false),
  treatmentGiven: z.boolean().default(false),
  completedCourse: z.boolean().default(false),
  treatmentPlace: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  idempotencyKey: z.string().uuid().optional(),
});
export type TravelEnterInput = z.infer<typeof travelEnterSchema>;

export const arrivalScreeningSchema = z.object({
  arrivalFacilityId: z.string().optional().nullable(),
  arrivalFever: z.boolean().optional().nullable(),
  hadFever: z.boolean().optional().nullable(),
  arrivalTestedOrTreated: z.boolean().optional().nullable(),
  testedOrTreated: z.boolean().optional().nullable(),
  arrivalReferred: z.boolean().optional().nullable(),
  referredForClinicalCare: z.boolean().optional().nullable(),
  screeningNotes: z.string().max(1000).optional().nullable(),
  clinicalNotes: z.string().max(1000).optional().nullable(),
});
export type ArrivalScreeningInput = z.infer<typeof arrivalScreeningSchema>;

export const confirmDepartureSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'REJECTED']),
  notes: z.string().max(1000).optional().nullable(),
});
export type ConfirmDepartureInput = z.infer<typeof confirmDepartureSchema>;
