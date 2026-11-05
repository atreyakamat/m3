import type { CSSProperties } from 'react';

/** Shared formatting helpers used by the admin pages (kept separate from
 * component exports so fast refresh can treat those files as pure components). */

export function formColumnStyle(): CSSProperties {
  return { display: 'grid', gap: 12, maxWidth: 520 };
}

export function isoDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
