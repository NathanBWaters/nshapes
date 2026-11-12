/**
 * Animation tokens for consistent motion throughout the app.
 * Provides duration and easing constants for a cohesive feel.
 */
export const DURATION = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
} as const;

export const EASING = {
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
  easeOutBack: [0.34, 1.56, 0.64, 1] as const,
  spring: { tension: 120, friction: 6 },
  bounce: { tension: 180, friction: 12 },
} as const;
