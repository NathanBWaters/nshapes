import React from 'react';
import { Svg, Circle, Path, Polygon } from 'react-native-svg';
import { STROKE } from '@/components/illustration/primitives';
import { ELEMENTAL_COMBAT_WEAPON_RELICS } from './illustrations/ElementalCombatWeapons';
import { MYSTIC_NATURE_CHRONO_WEAPON_RELICS } from './illustrations/MysticNatureChronoWeapons';
import { TOMES_COINS_LINKS_RELICS_WEAPON_RELICS } from './illustrations/TomesCoinsLinksRelicsWeapons';
import { WeaponIllustrationProps, WeaponRelic, WeaponTapStyle, getRarityTrimPalette } from './types';

/** The single place a weapon name is tied to its illustration and tap animation. */
const WEAPON_RELICS: Record<string, WeaponRelic> = {
  ...ELEMENTAL_COMBAT_WEAPON_RELICS,
  ...MYSTIC_NATURE_CHRONO_WEAPON_RELICS,
  ...TOMES_COINS_LINKS_RELICS_WEAPON_RELICS,
};

/** Crisp faceted NShapes gem: the look of every weapon without its own illustration. */
const GENERIC_GEM_RELIC: WeaponRelic = {
  tapStyle: 'arcane',
  art: (trim) => (
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
  ),
};

/** Weapons with their own illustration. */
export const ALL_CUSTOM_WEAPON_NAMES: readonly string[] = Object.keys(WEAPON_RELICS);

/**
 * Real weapons knowingly drawn as the generic gem (no bespoke art yet).
 * Any other unregistered name (e.g. a synthetic test weapon) gets the gem too.
 */
export const GENERIC_GEM_WEAPON_NAMES: readonly string[] = [
  'Prism Annihilator',
  'Chrono Singularity',
  "Philosopher's Crown",
  'Solar Cataclysm',
  'Immortal Aegis',
  'Vengeance Dynamo',
  'World Tree Seed',
  'Astral Omniscience',
];

function getWeaponRelic(weaponName: string): WeaponRelic {
  return Object.prototype.hasOwnProperty.call(WEAPON_RELICS, weaponName)
    ? WEAPON_RELICS[weaponName]
    : GENERIC_GEM_RELIC;
}

/**
 * Resolves the single-tap signature animation archetype for a weapon.
 */
export function getWeaponTapStyle(weaponName: string): WeaponTapStyle {
  return getWeaponRelic(weaponName).tapStyle;
}

/**
 * Renders the custom cel-shaded NShapes SVG relic artwork for any weapon.
 */
export const WeaponArtwork: React.FC<WeaponIllustrationProps> = ({ name, rarity = 'common' }) =>
  getWeaponRelic(name).art(getRarityTrimPalette(rarity));
