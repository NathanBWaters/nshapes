/**
 * Set-Parrying specifications (data-driven).
 *
 * Early fights use default timing-based parrying (ANY valid Set during the
 * wind-up parries; hitting the final golden window triggers a PERFECT PARRY +
 * 2× Stagger). Later foes, Elites, and Bosses require specific Counter-Sets
 * (All Red, All Ovals, All Traits Different, 2 Traits the Same, etc.) — always
 * shown up front on the pre-battle preview.
 */
import type { IconName } from '@/components/Icon';
import type { FoeDef, LevelDef, ParryPenalty, ParryRequirement, ParrySpec } from '../types';

export const PARRY_RULES = {
  /** Final golden window of any wind-up that scores a PERFECT PARRY */
  perfectWindowMs: 3500,
  /** Damage multiplier on the Set that lands a default (any-Set) Parry */
  anyParryMult: 1.25,
  /** Damage multiplier on the Set that lands a specific Counter-Set Parry */
  counterParryMult: 1.4,
  /** Damage multiplier on the Set that lands a PERFECT PARRY */
  perfectParryMult: 1.75,
  /** Damage multiplier on ALL Sets while the foe is Staggered */
  staggerDamageMult: 2,
  /** Stagger duration for a specific Counter Parry (ms) */
  counterStaggerMs: 4500,
  /** Stagger duration for a PERFECT PARRY (ms) */
  perfectStaggerMs: 8000,
  /** Bonus coins for a normal Parry vs Perfect Parry */
  parryCoins: 2,
  perfectParryCoins: 5,
  /** Fairness stall (ms) pushed back when a specific counter is not currently on the board */
  fairnessStallMs: 3000,
  /** Maximum fairness stalls per single wind-up */
  maxFairnessStalls: 2,
  /** Seconds stolen when penalty === 'time' */
  timePenaltySeconds: 6,
} as const;

export interface CounterMeta {
  /** Compact uppercase pill for HUD & preview ("ALL RED", "ANY SET") */
  shortLabel: string;
  /** Full readable name ("All Red Set", "Any Valid Set (Timing)") */
  label: string;
  /** One-sentence explanation shown on preview & inspector */
  explain: string;
  /** Accent tint for the counter pill */
  color: string;
  icon: IconName;
}

export const parryCounterMeta = (req: ParryRequirement): CounterMeta => {
  switch (req.kind) {
    case 'any':
      return {
        shortLabel: 'ANY SET',
        label: 'Any Valid Set (Timing)',
        explain: 'Match any Set while winding up to Parry. Hit the final golden window for a Perfect Parry!',
        color: '#D97706',
        icon: 'lorc/sword-clash',
      };
    case 'color': {
      const cap = req.color.charAt(0).toUpperCase() + req.color.slice(1);
      const color = req.color === 'red' ? '#DC2626' : req.color === 'green' ? '#15803D' : '#7C3AED';
      return {
        shortLabel: `ALL ${req.color.toUpperCase()}`,
        label: `All ${cap} Set`,
        explain: `Match 3 ${req.color} cards to counter this strike and Stagger the foe.`,
        color,
        icon: 'lorc/crystal-shine',
      };
    }
    case 'shape': {
      const plural = req.shape === 'oval' ? 'Ovals' : req.shape === 'diamond' ? 'Diamonds' : 'Squiggles';
      return {
        shortLabel: `ALL ${plural.toUpperCase()}`,
        label: `All ${plural} Set`,
        explain: `Match 3 ${plural.toLowerCase()} to counter this strike and Stagger the foe.`,
        color: '#0F766E',
        icon: 'lorc/diamond-hard',
      };
    }
    case 'all_different':
      return {
        shortLabel: 'ALL DIFFERENT',
        label: 'All Traits Different (Rainbow)',
        explain: 'Match a Rainbow Set (every active trait different) to shatter this attack.',
        color: '#9333EA',
        icon: 'lorc/rainbow-star',
      };
    case 'exact_same':
      return {
        shortLabel: `${req.count} TRAITS SAME`,
        label: `${req.count} Traits the Same`,
        explain: `Match a Set where exactly ${req.count} active traits match (only 1 trait differs).`,
        color: '#2563EB',
        icon: 'lorc/checked-shield',
      };
    case 'exact_diff':
      return {
        shortLabel: `${req.count} TRAITS DIFF`,
        label: `${req.count} Traits Different`,
        explain: `Match a Set where exactly ${req.count} active traits differ across the 3 cards.`,
        color: '#C2410C',
        icon: 'lorc/lightning-branches',
      };
    case 'same_number':
      return {
        shortLabel: 'SAME NUMBER',
        label: 'All Same Number',
        explain: 'Match 3 cards with the same count (three 1s, three 2s, or three 3s).',
        color: '#0369A1',
        icon: 'lorc/cycle',
      };
    case 'diff_number':
      return {
        shortLabel: '1-2-3 NUMBERS',
        label: 'All Different Numbers (1-2-3)',
        explain: 'Match 3 cards showing 1, 2, and 3 shapes to counter this attack.',
        color: '#B45309',
        icon: 'lorc/cycle',
      };
  }
};

export const parryPenaltyText = (penalty: ParryPenalty): string => {
  switch (penalty) {
    case 'heart':
      return 'Unparried: −1 ♥';
    case 'glancing':
      return 'Unparried: −1 ♥ (non-lethal)';
    case 'time':
      return `Unparried: −${PARRY_RULES.timePenaltySeconds}s`;
  }
};

const spec = (
  attackName: string,
  icon: IconName,
  counter: ParryRequirement,
  cooldownMs: number,
  windupMs: number,
  penalty: ParryPenalty = 'heart',
  perfectWindowMs: number = PARRY_RULES.perfectWindowMs
): ParrySpec => ({
  attackName,
  icon,
  counter,
  cooldownMs,
  windupMs,
  perfectWindowMs,
  penalty,
});

/** Early levels kept completely clean for zero-friction onboarding. */
const NO_PARRY_LEVELS = new Set(['1-1', '1-2', '1-3', '1-4']);

/** Explicit Adventure Mode level parry profiles (specific counters from 1-10 onward). */
const LEVEL_PARRIES: Record<string, ParrySpec> = {
  // World 1 — gentle default timing parries (non-lethal) to build muscle memory, then Boss introduces specific counters!
  '1-5': spec('Acorn Toss', 'lorc/sword-clash', { kind: 'any' }, 13000, 16000, 'glancing'),
  '1-6': spec('Prism Dive', 'lorc/sword-clash', { kind: 'any' }, 13000, 16000, 'glancing'),
  '1-7': spec('Quill Jab', 'lorc/sword-clash', { kind: 'any' }, 12500, 15500, 'glancing'),
  '1-8': spec('Coin Swipe', 'lorc/sword-clash', { kind: 'any' }, 12500, 15500, 'glancing'),
  '1-9': spec('Bumble Sting', 'lorc/sword-clash', { kind: 'any' }, 12000, 15000, 'glancing'),
  '1-10': spec('Shell Slam', 'lorc/turtle-shell', { kind: 'exact_same', count: 2 }, 13000, 16000, 'heart'),
  '1-3F': spec('Quick Pounce', 'lorc/sword-clash', { kind: 'any' }, 12000, 15000, 'glancing'),

  // World 2 — timed default parries, then color/shape/number counters!
  '2-1': spec('Slow Swipe', 'lorc/sword-clash', { kind: 'any' }, 14000, 16000, 'time'),
  '2-2': spec('Ember Leap', 'lorc/fireball', { kind: 'any' }, 14000, 15500, 'heart'),
  '2-3': spec('Silk Lash', 'lorc/cobweb', { kind: 'any' }, 14000, 15500, 'heart'),
  '2-4': spec('Crimson Ambush', 'lorc/claw-slashes', { kind: 'color', color: 'red' }, 13500, 16000, 'heart'),
  '2-5': spec('Acorn Barrage', 'lorc/sword-clash', { kind: 'shape', shape: 'oval' }, 13500, 16000, 'heart'),
  '2-6': spec('Scrap Hurl', 'lorc/stone-block', { kind: 'exact_same', count: 2 }, 13500, 15500, 'heart'),
  '2-7': spec('Shadow Swoop', 'lorc/moon', { kind: 'color', color: 'purple' }, 13500, 16000, 'heart'),
  '2-8': spec('Trickster Feint', 'lorc/sword-clash', { kind: 'same_number' }, 13500, 16000, 'heart'),
  '2-9': spec('Prism Burst', 'lorc/rainbow-star', { kind: 'color', color: 'green' }, 13000, 15500, 'heart'),
  '2-10': spec('Venom Fang', 'carl-olsen/spider-face', { kind: 'shape', shape: 'squiggle' }, 13000, 16000, 'heart'),
  '2-4C': spec('Bark Charge', 'lorc/sword-clash', { kind: 'any' }, 14000, 15500, 'heart'),
  '2-7B': spec('Claw Maul', 'lorc/claw-slashes', { kind: 'exact_same', count: 2 }, 13500, 15500, 'heart'),
  '2-8P': spec('Frost Gust', 'lorc/snowflake-1', { kind: 'all_different' }, 14000, 16500, 'heart'),

  // World 3 — Canyon escalation
  '3-1': spec('Cinder Wave', 'lorc/fireball', { kind: 'color', color: 'red' }, 14000, 15500, 'heart'),
  '3-2': spec('Sabotage Strike', 'caro-asercion/goblin', { kind: 'exact_diff', count: 2 }, 14000, 15500, 'heart'),
  '3-3': spec('Pack Rush', 'lorc/claw-slashes', { kind: 'shape', shape: 'diamond' }, 13500, 15500, 'heart'),
  '3-4': spec('Bazaar Tax', 'lorc/crown-coin', { kind: 'diff_number' }, 14000, 15500, 'heart'),
  '3-5': spec('Tidal Snap', 'lorc/big-wave', { kind: 'shape', shape: 'oval' }, 13500, 15500, 'heart'),
  '3-6': spec('Arcane Flare', 'lorc/crystal-wand', { kind: 'all_different' }, 14000, 16000, 'heart'),
  '3-7': spec('Earthquake Dig', 'caro-asercion/mole', { kind: 'exact_same', count: 2 }, 13500, 15500, 'heart'),
  '3-8': spec('Chroma Shift', 'darkzaitzev/chameleon-glyph', { kind: 'color', color: 'purple' }, 13500, 15500, 'heart'),
  '3-9': spec('Chrono Pluck', 'lorc/raven', { kind: 'same_number' }, 13500, 15500, 'time'),
  '3-10': spec('Crimson Gore', 'caro-asercion/boar', { kind: 'color', color: 'red' }, 12500, 15000, 'heart'),
  '3-3E': spec('Swarm Bite', 'delapouite/ant', { kind: 'diff_number' }, 13000, 15000, 'heart'),
  '3-3E2': spec('Cobra Strike', 'skoll/cobra', { kind: 'shape', shape: 'squiggle' }, 12500, 15000, 'heart'),
  '3-5P': spec('Riptide Pinch', 'lorc/crab', { kind: 'color', color: 'green' }, 14000, 15500, 'heart'),
  '3-8E': spec('Abyssal Ink', 'delapouite/giant-squid', { kind: 'color', color: 'purple' }, 13000, 15500, 'heart'),

  // World 4 — Frozen Peaks
  '4-1': spec('Glacier Slam', 'lorc/snowflake-1', { kind: 'exact_diff', count: 2 }, 13500, 15500, 'heart'),
  '4-2': spec('Hyper Sting', 'lorc/bee', { kind: 'diff_number' }, 13000, 15000, 'time'),
  '4-3': spec('Frost Mend', 'lorc/snowflake-1', { kind: 'shape', shape: 'diamond' }, 13500, 15500, 'heart'),
  '4-4': spec('Shatter Fang', 'lorc/shard-sword', { kind: 'all_different' }, 13500, 16000, 'heart'),
  '4-5': spec('Punish Cleave', 'lorc/claw-slashes', { kind: 'exact_same', count: 2 }, 13000, 15000, 'heart'),
  '4-6': spec('Venom Tick', 'lorc/snake', { kind: 'shape', shape: 'oval' }, 13000, 15000, 'heart'),
  '4-7': spec('Blizzard Whirl', 'lorc/vortex', { kind: 'same_number' }, 13000, 15000, 'heart'),
  '4-8': spec('Polar Crush', 'sparker/bear-face', { kind: 'color', color: 'green' }, 13000, 15000, 'heart'),
  '4-9': spec('Cyclops Gaze', 'lorc/cyclops', { kind: 'shape', shape: 'squiggle' }, 13000, 15000, 'heart'),
  '4-10': spec('Feral Rend', 'lorc/bestial-fangs', { kind: 'color', color: 'red' }, 12500, 15000, 'heart'),
  '4-11': spec('Prismatic Inferno', 'lorc/dragon-head', { kind: 'all_different' }, 12500, 15500, 'heart'),
  '4-2E': spec('Maul Charge', 'sparker/bear-face', { kind: 'exact_diff', count: 2 }, 13000, 15000, 'heart'),
  '4-2E2': spec('Savage Flurry', 'lorc/wolverine-claws', { kind: 'color', color: 'red' }, 12500, 15000, 'heart'),
  '4-5E': spec('Monolith Drop', 'delapouite/golem-head', { kind: 'shape', shape: 'diamond' }, 13000, 15000, 'heart'),
  '4-7E': spec('Dam Collapse', 'delapouite/beaver', { kind: 'same_number' }, 13000, 15000, 'heart'),
  '4-7E2': spec('Tentacle Whip', 'lorc/octopus', { kind: 'color', color: 'purple' }, 13000, 15500, 'heart'),

  // World 5 — Starfall Summit Gauntlet
  '5-1': spec('Abyssal Crush', 'delapouite/kraken-tentacle', { kind: 'color', color: 'purple' }, 12500, 15000, 'heart'),
  '5-2': spec('Void Rift', 'lorc/daemon-skull', { kind: 'exact_diff', count: 2 }, 12500, 15000, 'heart'),
  '5-3': spec('Soul Scythe', 'lorc/grim-reaper', { kind: 'shape', shape: 'diamond' }, 12500, 15000, 'heart'),
  '5-4': spec('Quill Tempest', 'caro-asercion/porcupine', { kind: 'same_number' }, 12500, 15000, 'heart'),
  '5-5': spec('Hydra Apocalypse', 'lorc/hydra', { kind: 'all_different' }, 12000, 15500, 'heart'),
};

/**
 * Resolve the telegraphed attack & Set-Parry specification for a level's foe.
 * Explicit `foe.parry` wins (null disables parry); otherwise uses the campaign
 * table so every level from 1-5 onward has a tailored timing or counter parry.
 */
export const resolveParrySpec = (level: LevelDef, foe?: FoeDef): ParrySpec | null => {
  if (level.rules.noGear || level.rules.sandbox || NO_PARRY_LEVELS.has(level.id)) return null;
  if (foe && foe.parry !== undefined) return foe.parry;
  const fromTable = LEVEL_PARRIES[level.id];
  if (fromTable) return fromTable;
  // Any non-table level with a registered enemy gets default timing-based Set-Parry;
  // synthetic sparring dummies in unit tests opt in via explicit `foe.parry`.
  if (foe?.enemy) return spec('Wild Lunge', 'lorc/sword-clash', { kind: 'any' }, 13500, 15500, 'heart');
  return null;
};
