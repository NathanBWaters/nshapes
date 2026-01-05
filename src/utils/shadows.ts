/**
 * Shadow tokens for consistent elevation and glow effects.
 * Provides elevation levels and rarity-based glow effects.
 */
export const SHADOWS = {
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowColor: '#000000',
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowColor: '#000000',
  },
  lg: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowColor: '#000000',
  },
  xl: {
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    shadowColor: '#000000',
  },
} as const;

export const GLOWS = {
  common: {
    shadowColor: '#383838',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  rare: {
    shadowColor: '#1976D2',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  legendary: {
    shadowColor: '#FF9538',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  selection: {
    shadowColor: '#FFDE00',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
} as const;

export type ShadowKey = keyof typeof SHADOWS;
export type GlowKey = keyof typeof GLOWS;
