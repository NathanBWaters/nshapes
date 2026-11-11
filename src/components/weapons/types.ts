import { IconName } from '@/components/Icon';
import { WeaponRarity } from '@/types';
import { COLORS } from '@/utils/colors';

/**
 * Single-animation tap choreography archetype for each weapon.
 * Weapons remain 100% static at rest and play one crisp signature motion when tapped.
 */
export type WeaponTapStyle =
  | 'explosive'  // Squash -> fiery blast pop + recoil shake -> spring settle
  | 'arcane'     // Gentle dip -> levitation rise + mystic tilt gleam -> settle
  | 'chrono'     // Crisp mechanical wind-back -> rapid stopwatch tick-snap -> settle
  | 'vitality'   // Warm double-beat heart plump bounce -> settle
  | 'laser'      // Sharp prism lock-in -> beam slash tilt + flash -> settle
  | 'tome'       // Grimoire open-flutter lift + page shimmer -> settle
  | 'coin'       // Metallic sovereign hop + 3D-feel flip-tilt -> settle
  | 'connector'; // Twin-link magnetic snap-in -> elastic ring pulse -> settle

export interface WeaponIllustrationProps {
  /** Exact weapon name (e.g. 'Blast Powder', 'Oracle Eye', 'Fire Mastery') */
  name: string;
  /** Rarity drives subtle trim/gem accents (silver/bronze -> teal/sapphire -> violet -> radiant gold) */
  rarity?: WeaponRarity;
  /** Optional fallback icon name */
  icon?: IconName;
}

export interface RarityTrimPalette {
  metal: string;
  metalHighlight: string;
  gem: string;
  glow: string;
}

export function getRarityTrimPalette(rarity: WeaponRarity = 'common'): RarityTrimPalette {
  switch (rarity) {
    case 'legendary':
      return {
        metal: '#F59E0B',
        metalHighlight: '#FEF08A',
        gem: '#FFDE00',
        glow: '#FDE047',
      };
    case 'epic':
      return {
        metal: '#9333EA',
        metalHighlight: '#E9D5FF',
        gem: '#C084FC',
        glow: '#D8B4FE',
      };
    case 'rare':
      return {
        metal: '#0D9488',
        metalHighlight: '#99F6E4',
        gem: COLORS.logicTeal,
        glow: '#5EEAD4',
      };
    case 'common':
    default:
      return {
        metal: '#94A3B8',
        metalHighlight: '#F1F5F9',
        gem: '#38BDF8',
        glow: '#BAE6FD',
      };
  }
}
