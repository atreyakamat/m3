/**
 * Shared transport vocabulary (single source of truth for the transport contract;
 * UI components remain platform-specific).
 *
 * Kept in sync with services/api/app/permissions.py::ROLES and
 * services/api/app/schemas.py vocabulary lists by
 * services/api/tests/test_shared_contract.py — that test are the compile-time
 * and CI guard against drift between this package and the backend.
 */
export const roles = [
  'worker',
  'contractor',
  'pathologist',
  'clinician',
  'health_worker',
  'research_lab',
  'admin',
  // Legacy alias found in pre-existing deployments; the backend maps it to
  // `pathologist` via permissions.effective_roles(). Keep last for readability.
  'pathology',
] as const
export type Role = typeof roles[number]

export const diagnosticStatuses = ['pending', 'positive', 'negative', 'indeterminate', 'cancelled'] as const
export type DiagnosticStatus = typeof diagnosticStatuses[number]

export const species = ['pf', 'pv', 'mixed', 'other', 'undetermined'] as const
export type Species = typeof species[number]

export const researchStatuses = ['not_tested', 'pending', 'inconclusive', 'detected', 'not_detected'] as const
export type ResearchStatus = typeof researchStatuses[number]

export const diagnosticMethods = ['rdt', 'microscopy', 'smp', 'other'] as const
export type DiagnosticMethod = typeof diagnosticMethods[number]
