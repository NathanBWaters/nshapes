import React from 'react';
import { Svg, Circle, Path, Polygon } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import {
  ELEMENTAL_COMBAT_WEAPON_NAMES,
  ElementalCombatWeaponIllustration,
} from './illustrations/ElementalCombatWeapons';
import {
  MYSTIC_NATURE_CHRONO_WEAPON_NAMES,
  MysticNatureChronoWeaponIllustration,
} from './illustrations/MysticNatureChronoWeapons';
import {
  TOMES_COINS_LINKS_RELICS_WEAPON_NAMES,
  TomesCoinsLinksRelicsWeaponIllustration,
} from './illustrations/TomesCoinsLinksRelicsWeapons';
import { WeaponIllustrationProps, WeaponTapStyle, getRarityTrimPalette } from './types';

const STROKE = COLORS.slateCharcoal;

const ELEMENTAL_SET = new Set<string>(ELEMENTAL_COMBAT_WEAPON_NAMES);
const MYSTIC_SET = new Set<string>(MYSTIC_NATURE_CHRONO_WEAPON_NAMES);
const TOMES_SET = new Set<string>(TOMES_COINS_LINKS_RELICS_WEAPON_NAMES);

export const ALL_CUSTOM_WEAPON_NAMES: readonly string[] = [
  ...ELEMENTAL_COMBAT_WEAPON_NAMES,
  ...MYSTIC_NATURE_CHRONO_WEAPON_NAMES,
  ...TOMES_COINS_LINKS_RELICS_WEAPON_NAMES,
];

const EXPLOSIVE_WEAPONS = new Set<string>([
  'Blast Powder',
  'Inferno Charge',
  'Flint Spark',
  'Ember Heart',
  'Cascade Core',
  'Sympathetic Flames',
  'Chaos Shard',
  'Entropy Engine',
  'Chaos Conduit',
  'Chain Reaction',
  'Desperate Measures',
]);

const LASER_WEAPONS = new Set<string>([
  'Prismatic Ray',
  'Spectrum Annihilator',
  'Prismatic Perfection',
  'Soul Harvest',
]);

const CHRONO_WEAPONS = new Set<string>([
  'Chrono Shard',
  'Temporal Core',
  'Hourglass of Ages',
  'Time Drop',
  'Temporal Rift',
  'Tabula Rasa',
]);

const VITALITY_WEAPONS = new Set<string>([
  'Field Stone',
  'Terra Foundation',
  'Growth Seed',
  'Life Bloom',
  'Second Chance',
  'Lucky Charm',
  "Fortune's Shield",
  'Fortune Token',
  'Snowball',
  'Life Vessel',
  'Mending Charm',
  'Restoration Aura',
  'Vital Core',
  'Grace Conduit',
  'Life Link',
]);

const TOME_WEAPONS = new Set<string>([
  "Scholar's Tome",
  'Arcane Codex',
  'Echo Mastery',
  'Laser Mastery',
  'Grace Mastery',
  'Explosion Mastery',
  'Hint Mastery',
  'Time Mastery',
  'Healing Mastery',
  'Fire Mastery',
  'Ricochet Mastery',
  'Growth Mastery',
  'Coin Mastery',
  'Time Trigger Mastery',
]);

const COIN_WEAPONS = new Set<string>([
  "Fortune's Favor",
  'Golden Touch',
  "Fortune's Blessing",
]);

const CONNECTOR_WEAPONS = new Set<string>([
  'Wisdom Chain',
  'Link Stone',
  'Link Chain',
  'Soul Link',
  'Revenge Linker',
  'Web Spinner',
  'Web Master',
  'Echo Chamber',
  'Resonance Core',
  'Neural Network',
]);

/**
 * Resolves the single-tap signature animation archetype for a weapon.
 */
export function getWeaponTapStyle(weaponName: string): WeaponTapStyle {
  if (EXPLOSIVE_WEAPONS.has(weaponName)) return 'explosive';
  if (LASER_WEAPONS.has(weaponName)) return 'laser';
  if (CHRONO_WEAPONS.has(weaponName)) return 'chrono';
  if (VITALITY_WEAPONS.has(weaponName)) return 'vitality';
  if (TOME_WEAPONS.has(weaponName)) return 'tome';
  if (COIN_WEAPONS.has(weaponName)) return 'coin';
  if (CONNECTOR_WEAPONS.has(weaponName)) return 'connector';
  return 'arcane';
}

/**
 * Renders the custom cel-shaded NShapes SVG relic artwork for any weapon.
 */
export const WeaponArtwork: React.FC<WeaponIllustrationProps> = (props) => {
  const { name, rarity = 'common' } = props;

  if (ELEMENTAL_SET.has(name)) {
    return <ElementalCombatWeaponIllustration {...props} />;
  }
  if (MYSTIC_SET.has(name)) {
    return <MysticNatureChronoWeaponIllustration {...props} />;
  }
  if (TOMES_SET.has(name)) {
    return <TomesCoinsLinksRelicsWeaponIllustration {...props} />;
  }

  // Crisp faceted NShapes gem fallback for synthetic test weapons
  const trim = getRarityTrimPalette(rarity);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Circle cx={50} cy={52} r={34} fill={trim.glow} opacity={0.22} />
      <Polygon
        points="50,14 80,40 68,82 32,82 20,40"
        fill={trim.metal}
        stroke={STROKE}
        strokeWidth={3.2}
        strokeLinejoin="round"
      />
      <Polygon
        points="50,22 72,42 62,74 38,74 28,42"
        fill={trim.gem}
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Polygon
        points="50,22 72,42 50,48 28,42"
        fill={trim.metalHighlight}
        opacity={0.75}
      />
      <Path
        d="M 38 35 L 47 28"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
};
