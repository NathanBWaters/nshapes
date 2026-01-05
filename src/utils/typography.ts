/**
 * Typography tokens for consistent text styling throughout the app.
 * Uses Inter as the primary font family.
 */
export const TEXT_STYLES = {
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 13 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyLg: { fontSize: 17, fontWeight: '400' as const, lineHeight: 25 },
  h4: { fontSize: 19, fontWeight: '600' as const, lineHeight: 25 },
  h3: { fontSize: 22, fontWeight: '600' as const, lineHeight: 29 },
  h2: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h1: { fontSize: 36, fontWeight: '700' as const, lineHeight: 40 },
  display: { fontSize: 48, fontWeight: '900' as const, lineHeight: 48 },
} as const;

export type TextStyleKey = keyof typeof TEXT_STYLES;
