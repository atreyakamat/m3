import {
  palette,
  roleColors,
  malariaStatusColors,
  syncStateColors,
  transferStatusColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
} from '@m3/shared';
import type { Role } from '@m3/shared';

export {
  palette,
  roleColors,
  malariaStatusColors,
  syncStateColors,
  transferStatusColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
};

/** Darken/lighten a hex colour by a percentage (-100..100). */
export function shade(hex: string, percent: number): string {
  const n = hex.replace('#', '');
  const num = parseInt(n, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Role-coloured gradient used for portal headers. */
export function roleGradient(role: Role): string {
  const c = roleColors[role];
  return `linear-gradient(135deg, ${c.base} 0%, ${shade(c.base, -18)} 100%)`;
}
