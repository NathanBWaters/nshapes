/**
 * NShapes Design System
 * Centralized design tokens for world-class UI consistency
 */

import { Platform } from 'react-native';

// =============================================================================
// COLORS
// =============================================================================

export const COLORS = {
  // Primary Colors
  actionYellow: '#FFDE00',
  slateCharcoal: '#383838',
  deepOnyx: '#121212',
  canvasWhite: '#FFFFFF',

  // Secondary & Accent Colors
  paperBeige: '#F4EFEA',
  logicTeal: '#16AA98',
  impactOrange: '#FF9538',
  impactRed: '#FF7169',

  // Tutorial & UI Colors
  tutorialBlue: '#3B82F6',

  // Semantic Colors
  success: '#16AA98',
  error: '#FF7169',
  warning: '#FF9538',
  info: '#383838',
} as const;

// =============================================================================
// RARITY SYSTEM (Unified across all screens)
// =============================================================================

export const RARITY = {
  common: {
    color: COLORS.slateCharcoal,
    background: COLORS.paperBeige,
    label: 'Common',
  },
  rare: {
    color: '#1976D2',
    background: '#E3F2FD',
    label: 'Rare',
  },
  legendary: {
    color: '#D97706',
    background: '#FEF3C7',
    label: 'Legendary',
  },
} as const;

export type RarityType = keyof typeof RARITY;

export function getRarityColor(rarity: string): string {
  const r = rarity.toLowerCase() as RarityType;
  return RARITY[r]?.color ?? COLORS.slateCharcoal;
}

export function getRarityBackground(rarity: string): string {
  const r = rarity.toLowerCase() as RarityType;
  return RARITY[r]?.background ?? COLORS.paperBeige;
}

// =============================================================================
// SPACING (4px base unit)
// =============================================================================

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const RADIUS = {
  none: 0,
  xs: 2,
  sm: 4,      // Buttons
  md: 8,
  lg: 12,    // Cards, modules
  xl: 16,
  xxl: 24,   // Containers
  full: 9999,
} as const;

// =============================================================================
// BORDERS
// =============================================================================

export const BORDERS = {
  thin: 1,
  standard: 2,
  thick: 3,
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const FONT_WEIGHTS = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
} as const;

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  display: 32,
} as const;

export const LINE_HEIGHTS = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// =============================================================================
// SHADOWS (Platform-aware)
// =============================================================================

const createShadow = (
  offsetY: number,
  radius: number,
  opacity: number,
  elevation: number
) => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: radius,
  ...(Platform.OS === 'android' && { elevation }),
});

export const SHADOWS = {
  none: createShadow(0, 0, 0, 0),
  sm: createShadow(1, 2, 0.08, 2),
  md: createShadow(2, 4, 0.12, 4),
  lg: createShadow(4, 8, 0.16, 8),
  xl: createShadow(8, 16, 0.20, 12),
} as const;

// =============================================================================
// Z-INDEX
// =============================================================================

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  notification: 80,
} as const;

// =============================================================================
// BREAKPOINTS (for responsive design)
// =============================================================================

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// =============================================================================
// OPACITY
// =============================================================================

export const OPACITY = {
  disabled: 0.4,
  muted: 0.6,
  subtle: 0.7,
  hover: 0.8,
  active: 0.9,
  full: 1,
} as const;
