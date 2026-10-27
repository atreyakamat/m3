/** Dashboard metric-card navigation mapping (report §24).
 *  Pure module so the card → list-screen decisions are unit-testable in
 *  `metricNav.test.ts` without React Native.
 *
 *  Rule: a count card becomes tappable ONLY when the signed-in role can open
 *  the matching record list with the server's authorization intact (the list
 *  screens never widen access; a refetched list just re-reads the same
 *  role-scoped endpoint the dashboard already uses):
 *   - GET /workers: authorized for every surveillance role (scope is filtered
 *     server-side per role). A worker-only session lists only the worker's own
 *     record there, so that card stays inert (their own-record view lives in
 *     registration / My cases already).
 *   - GET /samples: authorized for pathologist/pathology and research_lab
 *     only (services/api). Clinicians, admin, health workers and contractors
 *     get 403, so the Diagnostics card stays inert for them.
 *   - /followup: clinicians schedule + see the queue; health workers see
 *     their assigned follow-up queue (server-enforced). Admin has the
 *     read-only view too, but the dashboard card follows the existing
 *     action-card rule (health worker + clinician only).
 */

export type MetricKey = 'workers' | 'pathology' | 'followups'
export type MetricDestination = '/workers' | '/samples' | '/followup' | null

/** Roles that can list diagnostic samples (GET /samples require_roles). */
export const SAMPLE_LIST_ROLES = ['pathologist', 'pathology', 'research_lab']

/** Roles for which GET /workers returns an authorized, meaningful list. */
export const WORKER_LIST_ROLES = [
  'contractor',
  'clinician',
  'pathologist',
  'pathology',
  'health_worker',
  'research_lab',
  'admin',
]

export function isWorkerOnlyRole(roles: string[]): boolean {
  return Array.isArray(roles) && roles.length === 1 && roles[0] === 'worker'
}

export function canListWorkers(roles: string[]): boolean {
  if (isWorkerOnlyRole(roles)) return false
  return roles.some((r) => WORKER_LIST_ROLES.includes(r))
}

export function canListSamples(roles: string[]): boolean {
  return roles.some((r) => SAMPLE_LIST_ROLES.includes(r))
}

export function canOpenFollowups(roles: string[]): boolean {
  return roles.includes('health_worker') || roles.includes('clinician')
}

/** Destination route for a metric card, or null when the card must remain
 *  inert (no authorized list destination for this role). */
export function metricDestination(key: MetricKey, roles: string[]): MetricDestination {
  if (!Array.isArray(roles)) return null
  if (key === 'workers') return canListWorkers(roles) ? '/workers' : null
  if (key === 'pathology') return canListSamples(roles) ? '/samples' : null
  if (key === 'followups') return canOpenFollowups(roles) ? '/followup' : null
  return null
}

/** English accessibility hint describing the DESTINATION (report §2 req 9). */
export function destinationHint(key: MetricKey): string {
  switch (key) {
    case 'workers':
      return 'Opens the worker records list'
    case 'pathology':
      return 'Opens the diagnostic samples list'
    case 'followups':
      return 'Opens the follow-up queue'
  }
}
