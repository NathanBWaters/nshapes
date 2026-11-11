/**
 * Fighters (characters) — each one introduces a signature mechanic and can be
 * levelled 1→10 at Camp. Levelling upgrades the starting gear.
 */
import type { CharacterName, PlayerStats } from '@/types';
import type { FighterDef } from '../types';
import type { IconName } from '@/components/Icon';

export const MAX_FIGHTER_LEVEL = 10;

/** Coins to go from level N to N+1 (index = current level - 1). */
export const FIGHTER_LEVEL_COSTS = [60, 120, 200, 320, 480, 700, 1000, 1400, 1900];

interface Kit {
  name: CharacterName;
  icon: IconName;
  signature: string;
  blurb: string;
  a: string;       // weapon family A (id prefix without rarity)
  b: string;       // weapon family B
  epic: string;    // weapon id granted at level 8
  capstone: string; // weapon id granted at level 10
}

const withRarity = (family: string, rarity: 'common' | 'rare') => `${family}-${rarity}`;

/** Shared growth curve so every fighter feels the same way to level up. */
const buildLoadouts = (k: Kit): string[][] => {
  const A = (r: 'common' | 'rare') => withRarity(k.a, r);
  const B = (r: 'common' | 'rare') => withRarity(k.b, r);
  return [
    /* 1 */ [A('common'), B('common')],
    /* 2 */ [A('common'), B('common')],
    /* 3 */ [A('rare'), B('common')],
    /* 4 */ [A('rare'), B('common')],
    /* 5 */ [A('rare'), B('rare')],
    /* 6 */ [A('rare'), B('rare')],
    /* 7 */ [A('rare'), B('rare'), A('common')],
    /* 8 */ [A('rare'), B('rare'), A('common'), k.epic],
    /* 9 */ [A('rare'), B('rare'), A('common'), k.epic],
    /* 10 */ [A('rare'), B('rare'), A('rare'), k.epic, k.capstone],
  ];
};

const PERKS: Array<Partial<PlayerStats> | null> = [
  null,
  { maxHealth: 1, health: 1 },
  null,
  { coinGainChance: 15 },
  null,
  { maxHealth: 1, health: 1 },
  null,
  null,
  { graces: 1, hints: 1 },
  null,
];

const PERK_TEXT: Array<string | null> = [
  null, '+1 heart', null, '+15% coin chance', null, '+1 heart', null, null, '+1 grace & hint', null,
];

const KITS: Kit[] = [
  { name: 'Orange Tabby', icon: 'lorc/cat', signature: 'fighter_healing', blurb: 'Nine Lives: shrugs off one knockout per fight.', a: 'mending-charm', b: 'life-vessel', epic: 'restoration-aura', capstone: 'vital-core' },
  { name: 'Sly Fox', icon: 'caro-asercion/fox', signature: 'fighter_fire', blurb: 'Combo: fast Sets chain into bonus damage.', a: 'flint-spark', b: 'blast-powder', epic: 'ember-heart', capstone: 'inferno-charge' },
  { name: 'Badger', icon: 'caro-asercion/badger', signature: 'fighter_grace', blurb: 'Grudge: mistakes power up the next hit.', a: 'fortune-token', b: 'second-chance', epic: 'lucky-charm', capstone: 'fortunes-shield' },
  { name: 'Emperor Penguin', icon: 'delapouite/penguin', signature: 'fighter_foresight', blurb: 'Deep Freeze: charge up, then stop time.', a: 'seeker-lens', b: 'crystal-orb', epic: 'clairvoyant-sphere', capstone: 'enlightened-eye' },
  { name: 'Corgi', icon: 'delapouite/sitting-dog', signature: 'fighter_growth', blurb: 'Zoomies: charge up, then re-deal the board.', a: 'growth-seed', b: 'field-stone', epic: 'life-bloom', capstone: 'terra-foundation' },
  { name: 'Pelican', icon: 'delapouite/eating-pelican', signature: 'fighter_oracle', blurb: 'Big Scoop: charge up, then grab a free Set.', a: 'oracle-eye', b: 'oracle-eye', epic: 'prophets-vision', capstone: 'mystic-sight-legendary' },
];

export const FIGHTERS: FighterDef[] = KITS.map(k => ({
  name: k.name,
  icon: k.icon,
  signature: k.signature,
  blurb: k.blurb,
  loadouts: buildLoadouts(k),
  perks: PERKS,
  perkText: PERK_TEXT,
}));

export const STARTING_FIGHTERS: CharacterName[] = ['Orange Tabby'];

export const getFighter = (name: string): FighterDef => {
  const f = FIGHTERS.find(x => x.name === name);
  if (!f) throw new Error(`Unknown fighter ${name}`);
  return f;
};

export const getLoadout = (name: string, level: number): string[] => {
  const f = getFighter(name);
  const i = Math.max(1, Math.min(MAX_FIGHTER_LEVEL, level)) - 1;
  return f.loadouts[i];
};

/** Sum of perks up to and including `level`. */
export const getPerkStats = (name: string, level: number): Partial<PlayerStats> => {
  const f = getFighter(name);
  const out: Record<string, number> = {};
  for (let i = 0; i < Math.min(level, f.perks.length); i++) {
    const p = f.perks[i];
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number') out[k] = (out[k] ?? 0) + v;
    }
  }
  return out as Partial<PlayerStats>;
};

export const getLevelUpCost = (currentLevel: number): number | null =>
  currentLevel >= MAX_FIGHTER_LEVEL ? null : FIGHTER_LEVEL_COSTS[currentLevel - 1];
