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

/**
 * Roles Admin can provision. Workers self-register; Admin accounts are only
 * created through an authorised system-level bootstrap process.
 */
export const ADMIN_PROVISIONABLE_ROLES = [
  'CONTRACTOR',
  'HEALTH_WORKER',
  'CLINICIAN',
  'PATHOLOGIST',
  'RESEARCH_LAB',
] as const;
export type ProvisionableRole = (typeof ADMIN_PROVISIONABLE_ROLES)[number];

/** Human-facing unique-ID prefixes per Admin-created role (spec §7.1). */
export const STAKEHOLDER_ID_PREFIX: Record<ProvisionableRole, string> = {
  CONTRACTOR: 'C',
  HEALTH_WORKER: 'HW',
  CLINICIAN: 'CL',
  PATHOLOGIST: 'P',
  RESEARCH_LAB: 'RL',
};

export const STAKEHOLDER_ID_NUMERIC_WIDTH = 6; // C000001, HW000001, …

export function isProvisionableRole(value: unknown): value is ProvisionableRole {
  return (
    typeof value === 'string' &&
    (ADMIN_PROVISIONABLE_ROLES as readonly string[]).includes(value)
  );
}

/** Formats a numeric sequence into the prefixed ID form (1 → "C000001"). */
export function formatStakeholderId(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(STAKEHOLDER_ID_NUMERIC_WIDTH, '0')}`;
}
