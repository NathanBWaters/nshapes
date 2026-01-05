/**
 * Spacing tokens for consistent UI spacing throughout the app.
 * Based on an 8px grid system.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export type SpacingKey = keyof typeof SPACING;
