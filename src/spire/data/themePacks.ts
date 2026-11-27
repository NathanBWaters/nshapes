/**
 * Starfall Summit — Theme-Pack Pool Curation (`[GP-25]`).
 *
 * Keeps ALL 64 Armory weapons accessible (62 non-XP weapons live in Summit;
 * `scholars-tome` & `wisdom-chain` remain excluded from Summit offers) while
 * curing draft dilution via an 80/20 Focused Draft Pool + Wildcard system:
 *  - Every climb rolls or selects 2 Theme Packs (~26–36 cohesive weapons when
 *    paired with the fighter's starter synergy pack).
 *  - 80% of new weapon offers pull from the climb's Focused Pool so builds
 *    crystallize cleanly into multi-Evolution engines.
 *  - 20% Wildcard slots pull across ALL 62 Summit weapons so surprising pivots
 *    and the entire 64-weapon Armory remain alive on every run!
 */
import type { CharacterName } from '@/types';
import type { IconName } from '@/components/Icon';
import type { Rng } from '@/adventure/engine/rng';
import { STARTER_KITS } from './encounters';

export type SummitThemePackId =
  | 'pyro_blasts'
  | 'webs_echoes'
  | 'board_gambles'
  | 'tempo_clarity'
  | 'tricks_bounty'
  | 'grace_bastion';

export interface SummitThemePack {
  id: SummitThemePackId;
  name: string;
  blurb: string;
  icon: IconName;
  accentColor: string;
  weapons: readonly string[];
}

/** Weight of Focused Pool draws vs Wildcard draws across the full Armory (80% focused / 20% wildcard). */
export const FOCUSED_POOL_WEIGHT = 0.8;

export const SUMMIT_THEME_PACKS: readonly SummitThemePack[] = [
  {
    id: 'pyro_blasts',
    name: 'Pyro & Blasts',
    blurb: 'Explosions, blazing cards, cross-board lasers & fiery sustain.',
    icon: 'lorc/fireball',
    accentColor: '#DF5A00',
    weapons: [
      'blast-powder',
      'flint-spark',
      'cascade-core',
      'prismatic-ray',
      'chaos-shard',
      'war-drum',
      'rally-horn',
      'pinata',
      'amplifier-coil',
      'life-link',
      'mending-charm',
      'soul-harvest',
      'life-vessel',
    ],
  },
  {
    id: 'webs_echoes',
    name: 'Webs & Echoes',
    blurb: 'Chain reactions, card links, mirrors & Understudy copies.',
    icon: 'lorc/spider-web',
    accentColor: '#007ED9',
    weapons: [
      'echo-stone',
      'chain-reaction',
      'cascade-core',
      'connector',
      'web-weaver',
      'neural-network',
      'echo-chamber',
      'revenge-linker',
      'mirror-shard',
      'magnet',
      'understudy',
      'encore-mask',
      'temporal-rift',
    ],
  },
  {
    id: 'board_gambles',
    name: 'Board Gambles',
    blurb: 'High-stakes curses, fuses, thorns & huge risk-reward payouts.',
    icon: 'delapouite/rolling-dices',
    accentColor: '#940E65',
    weapons: [
      'cursed-idol',
      'chain-gang',
      'thorn-bush',
      'rust',
      'tar-pit',
      'decoy',
      'long-fuse',
      'ice-block',
      'greedy-chest',
      'hot-potato',
      'twin-seed',
      'fog-lantern',
      'devils-bargain',
      'glass-sword',
      'tightrope',
    ],
  },
  {
    id: 'tempo_clarity',
    name: 'Tempo & Clarity',
    blurb: 'Extra clock, fast Evolutions, sight lenses & wild board growth.',
    icon: 'lorc/hourglass',
    accentColor: '#0F766E',
    weapons: [
      'chrono-shard',
      'time-drop',
      'temporal-rift',
      'catalyst-prism',
      'encore-mask',
      'field-stone',
      'growth-seed',
      'clarity-lens',
      'wild-card',
      'seeker-lens',
      'crystal-orb',
      'oracle-eye',
      'mystic-sight',
    ],
  },
  {
    id: 'tricks_bounty',
    name: 'Tricks & Bounty',
    blurb: 'Rainbows, snowballs, bounties, coins & precision hunting.',
    icon: 'lorc/crown-coin',
    accentColor: '#B45309',
    weapons: [
      'rainbow-charm',
      'snowball',
      'bounty-poster',
      'odd-one-out',
      'collectors-album',
      'fortunes-favor',
      'fortunes-blessing',
      'magnet',
      'glass-sword',
      'pinata',
      'war-drum',
      'wild-card',
      'mirror-shard',
    ],
  },
  {
    id: 'grace_bastion',
    name: 'Grace & Bastion',
    blurb: 'Hearts, Graces, defensive lasers & counter-punch relics.',
    icon: 'lorc/checked-shield',
    accentColor: '#2563EB',
    weapons: [
      'mending-charm',
      'life-vessel',
      'life-link',
      'soul-harvest',
      'revenge-linker',
      'second-chance',
      'fortune-token',
      'grace-conduit',
      'chaos-conduit',
      'clarity-lens',
      'prismatic-ray',
      'understudy',
    ],
  },
];

const PACK_BY_ID: Record<SummitThemePackId, SummitThemePack> = Object.fromEntries(
  SUMMIT_THEME_PACKS.map(p => [p.id, p])
) as Record<SummitThemePackId, SummitThemePack>;

export const getThemePack = (id: SummitThemePackId): SummitThemePack =>
  PACK_BY_ID[id] ?? SUMMIT_THEME_PACKS[0];

export const isValidThemePackId = (id: unknown): id is SummitThemePackId =>
  typeof id === 'string' && id in PACK_BY_ID;

/** Each climber's natural starter Theme Pack affinity. */
export const FIGHTER_STARTER_PACK: Record<CharacterName, SummitThemePackId> = {
  'Orange Tabby': 'pyro_blasts',
  'Sly Fox': 'tricks_bounty',
  Corgi: 'tempo_clarity',
  Badger: 'grace_bastion',
  'Emperor Penguin': 'tempo_clarity',
  Pelican: 'webs_echoes',
};

/** Roll 2 deterministic Theme Packs for a climb (always pairing cleanly with the climber's kit). */
export const rollSummitThemePacks = (
  fighter: CharacterName,
  rng: Rng,
  forcedPack?: SummitThemePackId
): [SummitThemePackId, SummitThemePackId] => {
  const starterPack = FIGHTER_STARTER_PACK[fighter] ?? 'pyro_blasts';
  const allIds = SUMMIT_THEME_PACKS.map(p => p.id);
  const first: SummitThemePackId = forcedPack && isValidThemePackId(forcedPack) ? forcedPack : starterPack;
  const remaining = allIds.filter(id => id !== first);
  const second = rng.pick(remaining);
  return [first, second];
};

/**
 * Compute the climb's Focused Draft Pool (~26–36 weapons):
 *  - Fighter's starter kit weapons
 *  - Fighter's starter synergy pack
 *  - The climb's 2 active Theme Packs
 */
export const buildFocusedWeaponPool = (
  fighter: CharacterName,
  themePacks?: readonly SummitThemePackId[]
): ReadonlySet<string> => {
  const pool = new Set<string>();
  const kit = STARTER_KITS[fighter];
  if (kit) {
    pool.add(kit.starterWeapon);
    pool.add(kit.bonusWeapon);
  }
  const starterPack = getThemePack(FIGHTER_STARTER_PACK[fighter] ?? 'pyro_blasts');
  for (const id of starterPack.weapons) pool.add(id);

  for (const packId of themePacks ?? []) {
    const pack = PACK_BY_ID[packId];
    if (!pack) continue;
    for (const id of pack.weapons) pool.add(id);
  }
  return pool;
};
