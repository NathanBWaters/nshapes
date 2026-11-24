/**
 * Scientifically verified NShapes card visual identity (zero SET trade-dress overlap):
 *
 * Shapes (compact 24x30 / 1:1.25 viewBox, strokeWidth 1.9, round joins, -45° \ diagonal hatch):
 *   - `oval`     slot → Circle   (smooth symmetric convex; r=9.4)
 *   - `diamond`  slot → Triangle (sharp straight-edge convex; bottom-heavy apex)
 *   - `squiggle` slot → Bolt     (chunky 8-vertex lightning bolt; crisp V1 diagonal pop-out)
 *
 * Colors (universal CVD-safe by default; 3-way warm/cool/magenta split + L* staircase):
 *   - `red`    slot → Orange / Tangerine   (#DF5A00 light / #FFAC24 dark) · badge 'O'
 *   - `green`  slot → Blue   / Electric Sky (#007ED9 light / #7CE4FF dark) · badge 'B'
 *   - `purple` slot → Pink   / Berry Rose   (#940E65 light / #E6459E dark) · badge 'P'
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
  /** Chunky 8-vertex Bolt (5.22u clear waist, 52.6% clear interior, 5 diagonal stripes, zero clip). */
  boltPoints: '12,1.8 21.5,1.8 14.8,12.8 22,12.8 12,28.2 2.5,28.2 9.2,17.2 2,17.2',
} as const;

export const SHAPE_DISPLAY_NAME: Record<Shape, string> = {
  oval: 'Circle',
  diamond: 'Triangle',
  squiggle: 'Bolt',
};

export const SHAPE_PLURAL_NAME: Record<Shape, string> = {
  oval: 'Circles',
  diamond: 'Triangles',
  squiggle: 'Bolts',
};

export const COLOR_DISPLAY_NAME: Record<Color, string> = {
  red: 'Orange',
  green: 'Blue',
  purple: 'Pink',
};

/** High-visibility 1-letter badges shown when Colorblind Mode is toggled ON (complete achromatopsia aid). */
export const COLOR_BADGE_LETTER: Record<Color, string> = {
  red: 'O',
  green: 'B',
  purple: 'P',
};

/** Universal CVD-safe light-card palette (Norm ΔE00=43.3, Worst CVD ΔE00=21.7, WCAG ≥ 3.75:1 white / ≥ 3.34:1 hint / ≥ 3.14:1 mist). */
export const CARD_LIGHT_COLORS: Record<Color, string> = {
  red: '#DF5A00',    // Tangerine Orange (L*=55.1)
  green: '#007ED9',  // Electric Sky Blue (L*=51.8)
  purple: '#940E65', // Berry Magenta Pink (L*=33.0)
};

/** Universal CVD-safe dark-card palette for Charcoal #383838 cards (Norm ΔE00=47.4, Worst CVD ΔE00=17.7, WCAG ≥ 3.19:1). */
export const CARD_DARK_COLORS: Record<Color, string> = {
  red: '#FFAC24',    // Luminous Tangerine (ΔE00=18.0 away from #FFDE00 selection border)
  green: '#7CE4FF',  // Luminous Ice Sky Blue
  purple: '#E6459E', // Luminous Berry Pink
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

/** Player-facing Parry counter metadata using our Orange/Blue/Pink + Circles/Triangles/Bolts + "Trio" vocabulary. */
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
