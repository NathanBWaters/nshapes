// NShapes Style Guide Colors — "Tactile Tabletop Storybook"
// Warm ivory cardstock, bold #383838 ink strokes, tactile depth ledges, and WCAG-AA accents

import type { WeaponRarity } from '../types';

export const COLORS = {
  // Primary Storybook & Ink Tokens
  actionYellow: '#FFDE00',    // Primary CTA, notifications, eyebrow banners
  slateCharcoal: '#383838',   // Primary ink, text, headers, borders, strokes
  deepOnyx: '#121212',        // High-contrast plates, cut-ins, silhouette fills
  canvasWhite: '#FFFFFF',     // Active card backgrounds, crisp light text
  ivoryCard: '#FFFDF7',       // Warm storybook cardstock panels & modals

  // Tabletop Surfaces & Secondary Accents
  paperBeige: '#F4EFEA',      // Warm tabletop canvas, inset panels, tracks
  walnutFrame: '#322E2B',     // Warm lantern-lit slate-walnut hub backdrop (Camp, Bounties)
  walnutSurface: '#3E3833',   // Recessed tray inside walnut tabletop hubs
  walnutBorder: '#6E6257',    // Subtle border inside walnut tabletop hubs
  logicTeal: '#16AA98',       // Positive fills, progress indicators
  impactOrange: '#FF9538',    // Campfire glow, secondary highlights
  impactRed: '#FF7169',       // Hearts, damage indicators

  // Tutorial & UI Colors
  tutorialBlue: '#3B82F6',    // Tutorial highlight, new/unviewed state

  // Semantic Colors (derived from palette)
  success: '#16AA98',         // Logic Teal
  error: '#FF7169',           // Impact Red variant
  warning: '#FF9538',         // Impact Orange
  info: '#383838',            // Slate Charcoal

  // WCAG-AA Accent Surface Tokens (>=4.5:1 contrast with #FFFFFF text)
  tealSurface: '#0F766E',     // 5.47:1 with #FFFFFF
  redSurface: '#DC2626',      // 4.83:1 with #FFFFFF
  orangeSurface: '#C2410C',   // 5.18:1 with #FFFFFF

  // Weapon Rarity Colors
  rarityCommon: '#383838',    // Slate Charcoal - common items
  rarityRare: '#3B82F6',      // Blue - rare items
  rarityEpic: '#9333EA',      // Purple - epic items
  rarityLegendary: '#FFD700', // Gold - legendary items
};

// Helper function to get color for weapon rarity
export const getRarityColor = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'legendary':
      return COLORS.rarityLegendary;
    case 'epic':
      return COLORS.rarityEpic;
    case 'rare':
      return COLORS.rarityRare;
    case 'common':
    default:
      return COLORS.rarityCommon;
  }
};

// Border radius standards (Tactile Tabletop Storybook)
export const RADIUS = {
  button: 6,      // Tactile CTA buttons
  module: 12,     // Cards, modules
  sheet: 18,      // Bottom sheets & modals
  container: 24,  // Top-level screen containers
};

export {
  CARD_PALETTES,
  COLORBLIND_COLOR_CODES,
  COLORBLIND_COLOR_LABELS,
  cardBgPatternMeta,
  cardColorCode,
  cardColorHex,
  cardColorLabel,
  formatCardTraitValue,
  formatChallengeText,
  getColorblindMode,
  subscribeColorblindMode,
  useColorblind,
} from './cardColors';
export type { CardBgPatternMeta, CardColorTriplet } from './cardColors';

