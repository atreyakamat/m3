import { z } from 'zod';
import { LANGUAGES } from '../enums';
import { ROLES } from '../roles';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{10}$/, 'Phone number must be 10 digits');

export const pinSchema = z
  .string()
  .regex(/^[0-9]{4,6}$/, 'PIN must be 4–6 digits');

/** Worker self-registration (restricted distribution; no open public sign-up). */
export const workerRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  phone: phoneSchema,
  pin: pinSchema,
  preferredLanguage: z.enum(LANGUAGES).default('en'),
});
export type WorkerRegisterInput = z.infer<typeof workerRegisterSchema>;

export const loginSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Non-worker stakeholders sign in with a username provisioned by admin. */
export const staffLoginSchema = z.object({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(6).max(200),
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

export const authUserSchema = z.object({
  userId: z.string(),
  role: z.enum(ROLES),
  workerId: z.string().nullable().optional(),
  contractorId: z.string().nullable().optional(),
  displayName: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;
