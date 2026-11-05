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
  phone: z.string().trim().min(3, 'Phone number or username must be at least 3 characters').max(60),
  pin: z.string().min(4, 'PIN or password must be at least 4 characters').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Non-worker stakeholders sign in with an identifier provisioned by Admin:
 * either a username, or their registered phone number paired with a
 * temporary PIN (first login forces a credential change).
 */
export const staffLoginSchema = z.object({
  // Identifier may be a username OR the registered 10-digit phone number.
  // Password min length is reduced to 4 so the phone+PIN flow passes; actual
  // credential strength is enforced server-side at account creation / change.
  username: z.string().trim().min(3).max(60),
  password: z.string().min(4).max(200),
});
export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

/**
 * First-login / reset flow: the user supplies the new credential twice.
 * Strength rules are enforced per role by the backend:
 *   ADMIN          → password (min 8 chars, upper + lower + digit)
 *   other staff    → 4–6 digit PIN
 * Workers never use this flow (their PIN flow is unchanged).
 */
export const changeCredentialSchema = z
  .object({
    newCredential: z.string().trim().min(4, 'Must be at least 4 characters').max(72),
    confirmCredential: z.string(),
  })
  .refine((v) => v.newCredential === v.confirmCredential, {
    message: 'New credential and confirmation do not match',
    path: ['confirmCredential'],
  });

/** Password rule for the Admin account change (spec §3: validate password strength). */
export const adminPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const authUserSchema = z.object({
  userId: z.string(),
  role: z.enum(ROLES),
  workerId: z.string().nullable().optional(),
  contractorId: z.string().nullable().optional(),
  displayName: z.string(),
  phone: z.string().optional(),
  preferredLanguage: z.enum(LANGUAGES).optional(),
  /** True while a temporary credential must be replaced before protected access. */
  credentialChangeRequired: z.boolean().optional(),
});
export type AuthUser = z.infer<typeof authUserSchema>;
