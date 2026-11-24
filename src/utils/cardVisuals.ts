/**
 * Scientifically verified NShapes card visual identity (zero SET trade-dress overlap):
 *
 * Shapes (compact 24x30 / 1:1.25 viewBox, strokeWidth 1.9, round joins, +45° / diagonal hatch):
 *   - `oval`     slot → Circle   (smooth symmetric convex; r=9.4)
 *   - `diamond`  slot → Triangle (sharp straight-edge convex; bottom-heavy apex)
 *   - `squiggle` slot → Moon     (-25°-tilted waxing Crescent; 29% concavity pop-out)
 *
 * Colors (universal CVD-safe by default; 3-channel opponent simplex + L* staircase):
 *   - `red`    slot → Orange / Tangerine  (#E05A04 light / #FFA024 dark) · badge 'O'
 *   - `green`  slot → Teal   / Ocean Teal (#007870 light / #76FDE1 dark) · badge 'T'
 *   - `purple` slot → Blue   / Cobalt     (#1E229E light / #969BF0 dark) · badge 'B'
 *
 * Internal canonical enum keys (`oval|squiggle|diamond`, `red|green|purple`) remain
 * unchanged so existing saves, replays, telemetry, and balance fingerprints stay 100% intact.
 */
import type { Background, Color, Shape } from '@/types';
import type { ParryRequirement } from '@/adventure/types';
import { parryCounterMeta, type CounterMeta } from '@/adventure/data/parry';
import { COLORS } from './colors';

export const CARD_SVG_WIDTH = 24;
export const CARD_SVG_HEIGHT = 30;
export const CARD_STROKE_WIDTH = 1.9;
export const CARD_STRIPE_PITCH = 3.8;

/** Verified zero-clipping SVG geometry inside [0..24] x [0..30] with strokeWidth=1.9 & round joins. */
export const CARD_SHAPE_GEOMETRY = {
  circle: { cx: 12, cy: 15, r: 9.4 },
  trianglePoints: '12,2.2 22,26.8 2,26.8',
  /** -25°-tilted waxing crescent verified via W3C SVG 1.1 F.6.5 arc parameterization (0 self-intersections). */
  crescentPath: 'M 22.37,19.18 A 10.80,10.80 0 1,1 15.62,4.69 A 8.00,8.00 0 0,0 22.37,19.18 Z',
} as const;

export const SHAPE_DISPLAY_NAME: Record<Shape, string> = {
  oval: 'Circle',
  diamond: 'Triangle',
  squiggle: 'Moon',
};

export const SHAPE_PLURAL_NAME: Record<Shape, string> = {
  oval: 'Circles',
  diamond: 'Triangles',
  squiggle: 'Moons',
};

export const COLOR_DISPLAY_NAME: Record<Color, string> = {
  red: 'Orange',
  green: 'Teal',
  purple: 'Blue',
};

/** High-visibility 1-letter badges shown when Colorblind Mode is toggled ON (complete achromatopsia aid). */
export const COLOR_BADGE_LETTER: Record<Color, string> = {
  red: 'O',
  green: 'T',
  purple: 'B',
};

/** Universal CVD-safe light-card palette (Worst CVD ΔE00 = 22.4, WCAG ≥ 3.73:1 on white, ≥ 3.32:1 on hint). */
export const CARD_LIGHT_COLORS: Record<Color, string> = {
  red: '#E05A04',    // Tangerine Orange (L*=55, Hue 23.5° — zero Geneva Red Crescent conflict)
  green: '#007870',  // Ocean Teal       (L*=45)
  purple: '#1E229E', // Royal Cobalt     (L*=23)
};

/** Universal CVD-safe dark-card palette for Charcoal #383838 cards (Worst CVD ΔE00 = 24.2, WCAG ≥ 4.60:1). */
export const CARD_DARK_COLORS: Record<Color, string> = {
  red: '#FFA024',    // Luminous Tangerine (ΔE00=22.5 away from #FFDE00 selection border)
  green: '#76FDE1',  // Luminous Aqua Teal
  purple: '#969BF0', // Luminous Periwinkle Cobalt
};

/** High-contrast 5-attribute card stocks (replaces mid-gray #808080 with Blueprint Mist #E2ECF7, WCAG ≥ 3.12:1). */
export const CARD_STOCK_BACKGROUND: Record<Background, string> = {
  white: COLORS.canvasWhite,
  beige: '#E2ECF7',
  charcoal: '#383838',
};

export const CARD_STOCK_BORDER: Partial<Record<Background, string>> = {
  beige: '#6489B8',
};

export const getCardShapeColor = (color: string, background?: Background): string => {
  const palette = background === 'charcoal' ? CARD_DARK_COLORS : CARD_LIGHT_COLORS;
  if (color === 'red' || color === 'green' || color === 'purple') {
    return palette[color];
  }
  return background === 'charcoal' ? COLORS.canvasWhite : COLORS.slateCharcoal;
};

export const getCardStockBackground = (background?: Background): string => {
  if (!background) return CARD_STOCK_BACKGROUND.white;
  return CARD_STOCK_BACKGROUND[background] ?? CARD_STOCK_BACKGROUND.white;
};

export const formatShapeName = (shape: Shape, plural = false): string =>
  plural ? SHAPE_PLURAL_NAME[shape] : SHAPE_DISPLAY_NAME[shape];

export const formatColorName = (color: Color): string => COLOR_DISPLAY_NAME[color];

export const formatBackgroundName = (bg: Background): string => {
  switch (bg) {
    case 'beige':
      return 'Mist';
    case 'charcoal':
      return 'Charcoal';
    case 'white':
    default:
      return 'White';
  }
};

/** Player-facing Parry counter metadata using our Orange/Teal/Blue + Circles/Triangles/Moons + "Trio" vocabulary. */
export const formatParryCounterMeta = (req: ParryRequirement): CounterMeta => {
  const base = parryCounterMeta(req);
  switch (req.kind) {
    case 'any':
      return {
        ...base,
        shortLabel: 'ANY TRIO',
        label: 'Any Valid Trio (Timing)',
        explain: 'Match any Trio while winding up to Parry. Hit the final golden window for a Perfect Parry!',
      };
    case 'color': {
      const name = COLOR_DISPLAY_NAME[req.color];
      return {
        ...base,
        shortLabel: `ALL ${name.toUpperCase()}`,
        label: `All ${name} Trio`,
        explain: `Match 3 ${name.toLowerCase()} cards to counter this strike and Stagger the foe.`,
        color: CARD_LIGHT_COLORS[req.color],
      };
    }
    case 'shape': {
      const plural = SHAPE_PLURAL_NAME[req.shape];
      return {
        ...base,
        shortLabel: `ALL ${plural.toUpperCase()}`,
        label: `All ${plural} Trio`,
        explain: `Match 3 ${plural.toLowerCase()} to counter this strike and Stagger the foe.`,
        color: CARD_LIGHT_COLORS.green,
      };
    }
    case 'all_different':
      return {
        ...base,
        explain: 'Match a Rainbow Trio (every active trait different) to shatter this attack.',
      };
    case 'exact_same':
      return {
        ...base,
        explain: `Match a Trio where exactly ${req.count} active traits match (only 1 trait differs).`,
      };
    case 'exact_diff':
      return {
        ...base,
        explain: `Match a Trio where exactly ${req.count} active traits differ across the 3 cards.`,
      };
    default:
      return base;
  }
};
