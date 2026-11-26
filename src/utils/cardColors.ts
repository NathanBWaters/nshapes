/**
 * Mathematically verified, luminance-staggered card shape palettes,
 * WCAG contrast helpers, and end-to-end Colorblind Mode label/code mapping.
 *
 * Every foreground/background pair maintains WCAG >= 3.0:1 graphical contrast,
 * >= 8% grayscale luminance stagger across all 3 colors, and >= 90 Viénot
 * RGB Euclidean separation across Protanopia, Deuteranopia, and Tritanopia.
 */
import { useSyncExternalStore } from 'react';
import type { AttributeName, Background, Color } from '@/types';
import { ColorblindStorage } from '@/utils/storage';

export interface CardColorTriplet {
  readonly red: string;
  readonly green: string;
  readonly purple: string;
}

export const CARD_PALETTES = {
  standard: {
    // Light backgrounds (#FFFFFF white, #F5E8C8 parchment):
    // Green 22.8% lum / Red 13.3% lum / Purple 4.6% lum (>=8.7% step; CR 3.11–10.95)
    light: {
      red: '#C81E1E',
      green: '#0E947E',
      purple: '#4C1D95',
    } as CardColorTriplet,
    // Dark background (#383838 charcoal):
    // Green 74.0% lum / Purple 51.9% lum / Red 36.6% lum (>=15.3% step; CR 4.65–8.83)
    dark: {
      red: '#FF7B72',
      green: '#72F5DC',
      purple: '#C4B5FD',
    } as CardColorTriplet,
  },
  colorblind: {
    // Light backgrounds (#FFFFFF white, #F5E8C8 parchment):
    // Vermilion Orange 22.2% / Okabe-Ito Blue 11.9% / Deep Plum 3.4% (>=8.5% step; CR 3.18–12.52)
    light: {
      red: '#D55E00',
      green: '#0064A8',
      purple: '#5E1742',
    } as CardColorTriplet,
    // Dark background (#383838 charcoal):
    // Pale Rose 74.7% / Amber-Orange 42.0% / Sky Blue 30.1% (>=11.9% step; CR 3.92–8.90)
    dark: {
      red: '#FF922B',
      green: '#339AF0',
      purple: '#F8D7EE',
    } as CardColorTriplet,
  },
} as const;

/** 1:1 Colorblind corner letter codes: Orange (O) / Blue (B) / Plum (P). */
export const COLORBLIND_COLOR_CODES: Readonly<Record<Color, 'O' | 'B' | 'P'>> = {
  red: 'O',
  green: 'B',
  purple: 'P',
};

/** 1:1 Colorblind spoken & HUD color names matching O / B / P corner badges. */
export const COLORBLIND_COLOR_LABELS: Readonly<Record<Color, 'orange' | 'blue' | 'plum'>> = {
  red: 'orange',
  green: 'blue',
  purple: 'plum',
};

const STANDARD_COLOR_LABELS: Readonly<Record<Color, Color>> = {
  red: 'red',
  green: 'green',
  purple: 'purple',
};

const isCardColor = (c: string): c is Color => c === 'red' || c === 'green' || c === 'purple';

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

/** Resolve the verified card shape hex color for a given background & Colorblind state. */
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

/** Spoken / HUD color name ('red'|'green'|'purple' vs Colorblind 'orange'|'blue'|'plum'). */
export const cardColorLabel = (color: Color | string, colorblind = false): string => {
  if (!isCardColor(color)) return String(color);
  return colorblind ? COLORBLIND_COLOR_LABELS[color] : STANDARD_COLOR_LABELS[color];
};

/** Single-letter badge code in Colorblind Mode ('O' | 'B' | 'P'); empty string when disabled. */
export const cardColorCode = (color: Color | string, colorblind = true): string => {
  if (!colorblind || !isCardColor(color)) return '';
  return COLORBLIND_COLOR_CODES[color];
};

export interface CardBgPatternMeta {
  code: 'W' | 'T' | 'D';
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
 * (`W` = White / none, `T` = Tinted parchment / dots, `D` = Dark charcoal / diagonal-hatch).
 */
export const cardBgPatternMeta = (
  background?: Background | string,
  colorblind = false
): CardBgPatternMeta => {
  switch (background) {
    case 'beige':
      return {
        code: 'T',
        word: colorblind ? 'tinted' : 'beige',
        a11yLabel: colorblind ? 'tinted (T)' : 'beige',
        pattern: 'dots',
        badgeBg: 'rgba(245, 232, 200, 0.96)',
        badgeBorder: '#785A28',
        badgeText: '#451A03',
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

/** Format a card trait value for HUD chips / labels with Colorblind awareness. */
export const formatCardTraitValue = (
  attribute: AttributeName,
  value: string | number,
  colorblind = false
): string => {
  if (attribute === 'color') {
    const label = cardColorLabel(String(value), colorblind);
    return colorblind ? `${label} (${cardColorCode(String(value), true)})` : label;
  }
  if (attribute === 'background') {
    const meta = cardBgPatternMeta(String(value), colorblind);
    return colorblind ? `${meta.word} (${meta.code})` : meta.word;
  }
  return String(value);
};

/** Localize color-based challenge copy (e.g. "all-red Set" -> "all-orange (O) Set") when Colorblind Mode is ON. */
export const formatChallengeText = (text: string, colorblind: boolean): string => {
  if (!colorblind) return text;
  return text
    .replace(/\ball-red\b/gi, 'all-orange (O)')
    .replace(/\ball-green\b/gi, 'all-blue (B)')
    .replace(/\ball-purple\b/gi, 'all-plum (P)');
};
