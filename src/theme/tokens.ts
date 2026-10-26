import { buildVars } from '../buildVars';

/** Sizes of the shell (spec section 7). */
export const LAYOUT = {
  siderWidth: 240,
  headerHeight: 56,
  contentPadding: 24,
  fontSize: 14,
} as const;

/** Corner radius: 12 for most things, 16 for large cards, 8 for small ones. */
export const RADIUS = { base: 12, large: 16, small: 8 } as const;

/** The system font stack: no font is loaded from outside. */
export const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Noto Sans Thai", "Noto Sans Arabic", "PingFang SC", "Microsoft YaHei", sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

/** The primary colour and its hover and active shades come from the build variables. */
export const PRIMARY = {
  base: buildVars.primary,
  hover: buildVars.primaryHover,
  active: buildVars.primaryActive,
} as const;

/** Chart colours, the primary colour first (spec section 7). */
export const CHART_PALETTE = [
  '#0ABAB5',
  '#3B82F6',
  '#A78BFA',
  '#F59E0B',
  '#EC4899',
  '#94A3B8',
] as const;

/** Up and down in statistics. */
export const RISE_COLOR = '#22C55E';
export const FALL_COLOR = '#EF4444';
