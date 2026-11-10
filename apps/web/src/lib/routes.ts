import type { Role } from '@m3/shared';

/** Landing route for each role once authenticated (and credential change completed). */
export function homeFor(role: Role): string {
  if (role === 'WORKER') return '/login';
  if (role === 'CONTRACTOR') return '/contractor';
  if (role === 'ADMIN') return '/admin';
  if (role === 'HEALTH_WORKER') return '/health-worker';
  return '/portal';
}
