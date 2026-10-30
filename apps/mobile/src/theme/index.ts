/**
 * Mobile theme = the shared colour-based design tokens, re-exported with a few
 * React Native helpers. The palette/role/status colours are the single source
 * of truth in @m3/shared so mobile and web stay visually identical.
 */
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
  shadow,
  tokens,
} from '@m3/shared';

import { palette } from '@m3/shared';

/** Convenience named colours used across screens. */
export const colors = {
  primary: palette.primary,
  primaryDark: palette.primaryDark,
  accent: palette.accent,
  bg: palette.bg,
  surface: palette.surface,
  border: palette.border,
  text: palette.text,
  textMuted: palette.textMuted,
  danger: palette.danger,
  success: palette.success,
  warning: palette.warning,
};
