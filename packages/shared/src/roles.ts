/**
 * Stakeholder roles for the M3 Malaria Surveillance Platform.
 * The Worker role is fully implemented; Contractor has only the transfer
 * functions required by the transfer workflow; the rest are placeholders.
 */
export const ROLES = [
  'WORKER',
  'HEALTH_WORKER',
  'CONTRACTOR',
  'CLINICIAN',
  'PATHOLOGIST',
  'RESEARCH_LAB',
  'ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  WORKER: 'Worker / Labourer',
  HEALTH_WORKER: 'Health Worker',
  CONTRACTOR: 'Contractor',
  CLINICIAN: 'Clinician',
  PATHOLOGIST: 'Pathologist',
  RESEARCH_LAB: 'Research Lab',
  ADMIN: 'Admin',
};

/** Roles that have real operational features in this build. */
export const IMPLEMENTED_ROLES: Role[] = ['WORKER', 'CONTRACTOR'];

/** Roles that are placeholder dashboards only. */
export const PLACEHOLDER_ROLES: Role[] = [
  'HEALTH_WORKER',
  'CLINICIAN',
  'PATHOLOGIST',
  'RESEARCH_LAB',
  'ADMIN',
];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
