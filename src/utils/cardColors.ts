/**
 * Universal CVD-safe card shape palettes (synchronized 1:1 with `src/utils/cardVisuals.ts`),
 * WCAG contrast helpers, and end-to-end Colorblind Mode label/code propagation
 * (Orange (O) / Blue (B) / Pink (P) & 5th-attribute W / M / D).
 *
 * Every foreground/background pair maintains WCAG >= 3.14:1 graphical contrast across
 * White (#FFFFFF), Blueprint Mist (#E2ECF7), and Charcoal (#383838), plus >= 100 Viénot
 * RGB Euclidean separation across Protanopia, Deuteranopia, and Tritanopia.
 */
import { useSyncExternalStore } from 'react';
import type { AttributeName, Background, Color, Shape } from '@/types';
import { ColorblindStorage } from '@/utils/storage';

export interface CardColorTriplet {
  readonly red: string;
  readonly green: string;
  readonly purple: string;
}

const UNIVERSAL_LIGHT: CardColorTriplet = {
  red: '#DF5A00',    // Tangerine Orange (WCAG 3.75:1 white / 3.14:1 mist)
  green: '#007ED9',  // Electric Sky Blue (WCAG 4.21:1 white / 3.52:1 mist)
  purple: '#940E65', // Berry Magenta Pink (WCAG 8.37:1 white / 7.00:1 mist)
};

const UNIVERSAL_DARK: CardColorTriplet = {
  red: '#FFAC24',    // Luminous Tangerine (WCAG 6.24:1 charcoal)
  green: '#7CE4FF',  // Luminous Ice Sky Blue (WCAG 8.04:1 charcoal)
  purple: '#E6459E', // Luminous Berry Pink (WCAG 3.19:1 charcoal)
};

export const CARD_PALETTES = {
  standard: {
    light: UNIVERSAL_LIGHT,
    dark: UNIVERSAL_DARK,
  },
  colorblind: {
    light: UNIVERSAL_LIGHT,
    dark: UNIVERSAL_DARK,
  },
} as const;

/** 1:1 Colorblind corner letter codes: Orange (O) / Blue (B) / Pink (P). */
export const COLORBLIND_COLOR_CODES: Readonly<Record<Color, 'O' | 'B' | 'P'>> = {
  red: 'O',
  green: 'B',
  purple: 'P',
};

/** 1:1 spoken & HUD color names matching O / B / P corner badges. */
export const COLORBLIND_COLOR_LABELS: Readonly<Record<Color, 'orange' | 'blue' | 'pink'>> = {
  red: 'orange',
  green: 'blue',
  purple: 'pink',
};

const SHAPE_SINGULAR_LOWER: Readonly<Record<Shape, string>> = {
  oval: 'circle',
  diamond: 'triangle',
  squiggle: 'bolt',
};

const isCardColor = (c: string): c is Color => c === 'red' || c === 'green' || c === 'purple';
const isCardShape = (s: string): s is Shape => s === 'oval' || s === 'diamond' || s === 'squiggle';

/** Safe getter for ColorblindStorage (works cleanly in mocked test environments). */
export const getColorblindMode = (): boolean =>
  typeof ColorblindStorage?.get === 'function' ? ColorblindStorage.get() : false;

/** Safe subscriber for ColorblindStorage. */
export const subscribeColorblindMode = (onStoreChange: () => void): (() => void) =>
  typeof ColorblindStorage?.subscribe === 'function'
    ? ColorblindStorage.subscribe(() => onStoreChange())
    : () => {};

/** Reactive hook subscribing to global Colorblind Mode preference. */
export const useColorblind = (): boolean =>
  useSyncExternalStore(subscribeColorblindMode, getColorblindMode, getColorblindMode);

/** Resolve the verified universal CVD-safe card shape hex color for a given stock background. */
export const cardColorHex = (
  color: Color | string,
  background?: Background,
  colorblind = false
): string => {
  const dark = background === 'charcoal';
  const palette = colorblind
    ? dark
      ? CARD_PALETTES.colorblind.dark
      : CARD_PALETTES.colorblind.light
    : dark
      ? CARD_PALETTES.standard.dark
      : CARD_PALETTES.standard.light;
  if (isCardColor(color)) return palette[color];
  return dark ? '#FFFFFF' : '#383838';
};

/** Spoken / HUD color name ('orange' | 'blue' | 'pink'), consistent 1:1 in standard & Colorblind Mode. */
export const cardColorLabel = (color: Color | string, _colorblind = false): string => {
  if (!isCardColor(color)) return String(color);
  return COLORBLIND_COLOR_LABELS[color];
};

/** Single-letter badge code in Colorblind Mode ('O' | 'B' | 'P'); empty string when disabled. */
export const cardColorCode = (color: Color | string, colorblind = true): string => {
  if (!colorblind || !isCardColor(color)) return '';
  return COLORBLIND_COLOR_CODES[color];
};

export interface CardBgPatternMeta {
  code: 'W' | 'M' | 'D';
  /** Short word used in coach / HUD phrases */
  word: string;
  /** Accessible spoken description */
  a11yLabel: string;
  pattern: 'none' | 'dots' | 'diagonal-hatch';
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

/**
 * 5th-attribute (`background`) pattern + micro-tag metadata for Colorblind Mode
 * (`W` = White / none, `M` = Blueprint Mist / dots, `D` = Dark charcoal / diagonal-hatch).
 */
export const cardBgPatternMeta = (
  background?: Background | string,
  colorblind = false
): CardBgPatternMeta => {
  switch (background) {
    case 'beige':
      return {
        code: 'M',
        word: 'mist',
        a11yLabel: colorblind ? 'mist (M)' : 'mist',
        pattern: 'dots',
        badgeBg: 'rgba(226, 236, 247, 0.96)',
        badgeBorder: '#3B669B',
        badgeText: '#1E3A5F',
      };
    case 'charcoal':
      return {
        code: 'D',
        word: colorblind ? 'dark' : 'charcoal',
        a11yLabel: colorblind ? 'dark (D)' : 'charcoal',
        pattern: 'diagonal-hatch',
        badgeBg: 'rgba(18, 18, 18, 0.92)',
        badgeBorder: '#E5E7EB',
        badgeText: '#FFFFFF',
      };
    case 'white':
    default:
      return {
        code: 'W',
        word: 'white',
        a11yLabel: colorblind ? 'white (W)' : 'white',
        pattern: 'none',
        badgeBg: 'rgba(255, 255, 255, 0.96)',
        badgeBorder: '#383838',
        badgeText: '#121212',
      };
  }
};

/** Format a card trait value for HUD chips / labels with Colorblind & v0.1.173 vocabulary awareness. */
export const formatCardTraitValue = (
  attribute: AttributeName,
  value: string | number,
  colorblind = false
): string => {
  if (attribute === 'color') {
    const label = cardColorLabel(String(value), colorblind);
    return colorblind ? `${label} (${cardColorCode(String(value), true)})` : label;
  }
  if (attribute === 'shape') {
    const s = String(value);
    return isCardShape(s) ? SHAPE_SINGULAR_LOWER[s] : s;
  }
  if (attribute === 'background') {
    const meta = cardBgPatternMeta(String(value), colorblind);
    return colorblind ? `${meta.word} (${meta.code})` : meta.word;
  }
  return String(value);
};

/** Localize color-based challenge copy (e.g. "all-orange Set" -> "all-orange (O) Set") when Colorblind Mode is ON. */
export const formatChallengeText = (text: string, colorblind: boolean): string => {
  if (!colorblind) return text;
  return text
    .replace(/\ball-(?:orange|red)\b/gi, 'all-orange (O)')
    .replace(/\ball-(?:blue|green)\b/gi, 'all-blue (B)')
    .replace(/\ball-(?:pink|purple)\b/gi, 'all-pink (P)');
};
