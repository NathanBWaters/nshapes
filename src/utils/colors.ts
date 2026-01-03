/**
 * NShapes Colors - Re-exports from centralized theme
 * @deprecated Import directly from '@/theme' instead
 */

// Re-export everything from theme for backwards compatibility
export {
  COLORS,
  RADIUS,
  BORDERS,
  FONT_WEIGHTS,
  RARITY,
  getRarityColor,
  getRarityBackground,
} from '../theme';

// Type exports
export type { RarityType } from '../theme';
