/**
 * M3 design tokens — a single colour-based design system shared by the Expo
 * mobile app and the React web app. Plain data (hex strings / numbers) so it
 * works in React Native StyleSheet, inline styles and CSS variables alike.
 */
import type { Role } from '../roles';
import type { MalariaStatus, SyncState, TransferStatus } from '../enums';

/** Core brand + semantic palette. */
export const palette = {
  // Brand — medical teal conveys trust/health
  primary: '#0E7C86',
  primaryDark: '#0A5A62',
  primaryLight: '#3FA9B2',
  primarySoft: '#E2F2F3',

  // Secondary — deep indigo
  secondary: '#3D5A80',
  secondarySoft: '#E7ECF3',

  // Accent — warm coral for highlights / CTAs
  accent: '#F26457',
  accentSoft: '#FCE4E1',

  // Semantic
  success: '#2E9E5B',
  successSoft: '#E3F5EA',
  warning: '#E8A32C',
  warningSoft: '#FCF2DD',
  danger: '#D64545',
  dangerSoft: '#FBE4E4',
  info: '#3B82C4',
  infoSoft: '#E3EEF8',

  // Neutrals
  bg: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F5',
  border: '#D9E1E7',
  borderStrong: '#B8C4CC',
  text: '#13232B',
  textMuted: '#5A6B74',
  textOnColor: '#FFFFFF',
  overlay: 'rgba(14, 34, 43, 0.45)',
  shadow: 'rgba(14, 34, 43, 0.12)',
} as const;

/** Each stakeholder dashboard has a signature colour for instant recognition. */
export const roleColors: Record<Role, { base: string; soft: string; on: string }> = {
  WORKER: { base: '#0E7C86', soft: '#E2F2F3', on: '#FFFFFF' },
  HEALTH_WORKER: { base: '#2E9E5B', soft: '#E3F5EA', on: '#FFFFFF' },
  CONTRACTOR: { base: '#3D5A80', soft: '#E7ECF3', on: '#FFFFFF' },
  CLINICIAN: { base: '#2E6FB7', soft: '#E3EEF8', on: '#FFFFFF' },
  PATHOLOGIST: { base: '#7A4FBF', soft: '#EEE7F8', on: '#FFFFFF' },
  RESEARCH_LAB: { base: '#B5478C', soft: '#F7E4F0', on: '#FFFFFF' },
  ADMIN: { base: '#475569', soft: '#E8EBEF', on: '#FFFFFF' },
};

/** Malaria status chip colours. "No symptoms" is NEVER shown as negative. */
export const malariaStatusColors: Record<MalariaStatus, { fg: string; bg: string; label: string }> = {
  NO_RESULT: { fg: '#475569', bg: '#E8EBEF', label: 'No result recorded' },
  AWAITING: { fg: '#A5741A', bg: '#FCF2DD', label: 'Awaiting result' },
  POSITIVE: { fg: '#A62828', bg: '#FBE4E4', label: 'Positive' },
  NEGATIVE: { fg: '#1F7A45', bg: '#E3F5EA', label: 'Negative' },
};

/** Sync-state indicator colours for offline-first records. */
export const syncStateColors: Record<SyncState, { fg: string; bg: string; label: string }> = {
  LOCAL: { fg: '#475569', bg: '#E8EBEF', label: 'Saved on device' },
  PENDING: { fg: '#A5741A', bg: '#FCF2DD', label: 'Pending sync' },
  SYNCED: { fg: '#1F7A45', bg: '#E3F5EA', label: 'Synced' },
  FAILED: { fg: '#A62828', bg: '#FBE4E4', label: 'Sync failed' },
};

/** Transfer status chip colours. */
export const transferStatusColors: Record<TransferStatus, { fg: string; bg: string; label: string }> = {
  PENDING_WORKER_RESPONSE: { fg: '#A5741A', bg: '#FCF2DD', label: 'Pending your response' },
  PENDING_CURRENT_CONTRACTOR: { fg: '#2E5A8A', bg: '#E3EEF8', label: 'Pending current contractor' },
  PENDING_DESTINATION_CONTRACTOR: { fg: '#2E5A8A', bg: '#E3EEF8', label: 'Pending destination contractor' },
  ACCEPTED: { fg: '#1F7A45', bg: '#E3F5EA', label: 'Completed' },
  REJECTED: { fg: '#A62828', bg: '#FBE4E4', label: 'Rejected' },
  CANCELLED: { fg: '#475569', bg: '#E8EBEF', label: 'Cancelled' },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const shadow = {
  card: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  raised: {
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const tokens = {
  palette,
  roleColors,
  malariaStatusColors,
  syncStateColors,
  transferStatusColors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  shadow,
} as const;

export type Tokens = typeof tokens;
