/**
 * Set-Parrying specifications (data-driven).
 *
 * Early fights use default timing-based parrying (ANY valid Trio during the
 * wind-up parries with a 2.5s micro-Stagger; hitting the final golden window
 * triggers a PERFECT PARRY + 8s 2× Stagger). Later foes, Elites, and Bosses
 * require specific Counter-Sets across 5 distinct foe Parry archetypes
 * (Sluggish Heavy Slam, Hyper Swarm, Stalker Ambush, Tactical Standard, and
 * Boss Escalation) — always shown up front on the pre-battle preview.
 */
import type { IconName } from '@/components/Icon';
import { cardColorCode, cardColorHex, cardColorLabel, getColorblindMode } from '@/utils/cardColors';
import type { FoeDef, LevelDef, ParryPenalty, ParryRequirement, ParrySpec } from '../types';

export const PARRY_RULES = {
  /** Final golden window of any wind-up that scores a PERFECT PARRY */
  perfectWindowMs: 3500,
  /** Generous Perfect Parry window for telegraphed Sluggish/Heavy Slam foes */
  heavyPerfectWindowMs: 4000,
  /** Snappy Perfect Parry window for Hyper/Swarm foes */
  swarmPerfectWindowMs: 2800,
  /** Damage multiplier on the Set that lands a default (any-Set) Parry */
  anyParryMult: 1.25,
  /** Damage multiplier on the Set that lands a specific Counter-Set Parry */
  counterParryMult: 1.4,
  /** Damage multiplier on the Set that lands a PERFECT PARRY */
  perfectParryMult: 1.75,
  /** Damage multiplier on ALL Sets while the foe is Staggered */
  staggerDamageMult: 2,
  /** Micro-Stagger duration for a default (any-Set) timing Parry (ms) — lets beginners feel Tension → Release! */
  anyStaggerMs: 2500,
  /** Stagger duration for a specific Counter Parry (ms) */
  counterStaggerMs: 5000,
  /** Stagger duration for a PERFECT PARRY (ms) */
  perfectStaggerMs: 8000,
  /** Extended Stagger duration when countering a Heavy Slam juggernaut (ms) */
  heavyStaggerMs: 9000,
  /** Bonus coins for a normal Parry vs Perfect Parry */
  parryCoins: 2,
  perfectParryCoins: 5,
  /** Fairness stall (ms) pushed back when a specific counter is not currently on the board */
  fairnessStallMs: 3000,
  /** Maximum fairness stalls per single wind-up */
  maxFairnessStalls: 2,
  /** Default seconds stolen when penalty === 'time' */
  timePenaltySeconds: 6,
  /** Lighter time penalty for Hyper/Swarm foes */
  swarmTimePenaltySeconds: 4,
  /** Heavier time penalty for Sluggish/Heavy World 3–5 foes */
  heavyTimePenaltySeconds: 10,
  /** Heavy Slam heart penalty on World 3–5 juggernauts */
  heavyHeartPenalty: 2,
  /** Boss escalation cooldown reduction (ms) below 50% foe HP */
  bossEnrageCooldownDeltaMs: 2000,
  /** HP ratio below which boss escalation tightens cooldown */
  bossEnrageHpThreshold: 0.5,
} as const;

/** 5 distinct foe Parry cadence archetypes matching creature personalities ([GP-07]). */
export type ParryArchetype = 'heavy' | 'swarm' | 'stalker' | 'tactical' | 'boss_enrage';

export interface CounterMeta {
  /** Compact uppercase pill for HUD & preview ("ALL ORANGE", "ANY SET") */
  shortLabel: string;
  /** Full readable name ("All Orange Trio", "Any Valid Set (Timing)") */
  label: string;
  /** One-sentence explanation shown on preview & inspector */
  explain: string;
  /** Accent tint for the counter pill */
  color: string;
  icon: IconName;
}

export const parryCounterMeta = (req: ParryRequirement, colorblind?: boolean): CounterMeta => {
  const cb = colorblind ?? getColorblindMode();
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
      const name = cardColorLabel(req.color, cb);
      const cap = name.charAt(0).toUpperCase() + name.slice(1);
      const code = cb ? cardColorCode(req.color, true) : '';
      const color = cardColorHex(req.color, 'white', cb);
      return {
        shortLabel: cb ? `ALL ${name.toUpperCase()} (${code})` : `ALL ${name.toUpperCase()}`,
        label: cb ? `All ${cap} (${code}) Trio` : `All ${cap} Trio`,
        explain: cb
          ? `Match 3 ${name} (${code}) cards to counter this strike and Stagger the foe.`
          : `Match 3 ${name} cards to counter this strike and Stagger the foe.`,
        color,
        icon: 'lorc/crystal-shine',
      };
    }
    case 'shape': {
      const plural = req.shape === 'oval' ? 'Circles' : req.shape === 'diamond' ? 'Triangles' : 'Bolts';
      return {
        shortLabel: `ALL ${plural.toUpperCase()}`,
        label: `All ${plural} Trio`,
        explain: `Match 3 ${plural.toLowerCase()} to counter this strike and Stagger the foe.`,
        color: '#007ED9',
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

export const parryPenaltyText = (penalty: ParryPenalty, amount?: number): string => {
  switch (penalty) {
    case 'heart':
      return `Unparried: −${amount ?? 1} ♥`;
    case 'glancing':
      return 'Unparried: −1 ♥ (non-lethal)';
    case 'time':
      return `Unparried: −${amount ?? PARRY_RULES.timePenaltySeconds}s`;
  }
};

interface SpecExtras {
  staggerMs?: number;
  penaltyAmount?: number;
  bossEnrageDeltaMs?: number;
}

const spec = (
  attackName: string,
  icon: IconName,
  counter: ParryRequirement,
  cooldownMs: number,
  windupMs: number,
  penalty: ParryPenalty = 'heart',
  perfectWindowMs: number = PARRY_RULES.perfectWindowMs,
  extras?: SpecExtras
): ParrySpec => ({
  attackName,
  icon,
  counter,
  cooldownMs,
  windupMs,
  perfectWindowMs,
  penalty,
  ...(extras?.staggerMs !== undefined ? { staggerMs: extras.staggerMs } : {}),
  ...(extras?.penaltyAmount !== undefined ? { penaltyAmount: extras.penaltyAmount } : {}),
  ...(extras?.bossEnrageDeltaMs !== undefined ? { bossEnrageDeltaMs: extras.bossEnrageDeltaMs } : {}),
});

/** Archetype builders so every foe's parry cadence mirrors its personality. */
const heavySpec = (
  attackName: string,
  icon: IconName,
  counter: ParryRequirement,
  cooldownMs: number,
  windupMs: number,
  penalty: ParryPenalty = 'heart',
  penaltyAmount: number = penalty === 'time' ? PARRY_RULES.heavyTimePenaltySeconds : PARRY_RULES.heavyHeartPenalty
): ParrySpec =>
  spec(attackName, icon, counter, cooldownMs, windupMs, penalty, PARRY_RULES.heavyPerfectWindowMs, {
    staggerMs: PARRY_RULES.heavyStaggerMs,
    penaltyAmount,
  });

const swarmSpec = (
  attackName: string,
  icon: IconName,
  counter: ParryRequirement,
  cooldownMs: number,
  windupMs: number,
  penalty: ParryPenalty = 'time',
  penaltyAmount: number | undefined = penalty === 'time' ? PARRY_RULES.swarmTimePenaltySeconds : undefined
): ParrySpec =>
  spec(attackName, icon, counter, cooldownMs, windupMs, penalty, PARRY_RULES.swarmPerfectWindowMs, {
    penaltyAmount,
  });

const stalkerSpec = (
  attackName: string,
  icon: IconName,
  counter: ParryRequirement,
  penalty: ParryPenalty = 'heart',
  cooldownMs = 15000,
  windupMs = 12000
): ParrySpec => spec(attackName, icon, counter, cooldownMs, windupMs, penalty, PARRY_RULES.perfectWindowMs);

const tacticalSpec = (
  attackName: string,
  icon: IconName,
  counter: ParryRequirement,
  penalty: ParryPenalty = 'heart',
  cooldownMs = 13000,
  windupMs = 15000
): ParrySpec => spec(attackName, icon, counter, cooldownMs, windupMs, penalty, PARRY_RULES.perfectWindowMs);

const bossEnrageSpec = (
  attackName: string,
  icon: IconName,
  counter: ParryRequirement,
  cooldownMs: number,
  windupMs: number,
  penalty: ParryPenalty = 'heart'
): ParrySpec =>
  spec(attackName, icon, counter, cooldownMs, windupMs, penalty, PARRY_RULES.perfectWindowMs, {
    bossEnrageDeltaMs: PARRY_RULES.bossEnrageCooldownDeltaMs,
  });

/** Early levels kept completely clean for zero-friction onboarding. */
const NO_PARRY_LEVELS = new Set(['1-1', '1-2', '1-3', '1-4']);

/** Explicit Adventure Mode level parry profiles across the 5 creature archetypes. */
const LEVEL_PARRIES: Record<string, { archetype: ParryArchetype; spec: ParrySpec }> = {
  // World 1 — gentle default timing parries (2.5s micro-Stagger on any parry!), then Heavy Slam boss!
  '1-5': { archetype: 'tactical', spec: tacticalSpec('Acorn Toss', 'lorc/sword-clash', { kind: 'any' }, 'glancing', 13500, 15500) },
  '1-6': { archetype: 'tactical', spec: tacticalSpec('Prism Dive', 'lorc/sword-clash', { kind: 'any' }, 'glancing', 13500, 15500) },
  '1-7': { archetype: 'tactical', spec: tacticalSpec('Quill Jab', 'lorc/sword-clash', { kind: 'any' }, 'glancing', 13000, 15000) },
  '1-8': { archetype: 'tactical', spec: tacticalSpec('Coin Swipe', 'lorc/sword-clash', { kind: 'any' }, 'glancing', 13000, 15000) },
  '1-9': { archetype: 'swarm', spec: swarmSpec('Bumble Sting', 'lorc/sword-clash', { kind: 'any' }, 9000, 11500, 'glancing') },
  '1-10': { archetype: 'heavy', spec: heavySpec('Shell Slam', 'lorc/turtle-shell', { kind: 'exact_same', count: 2 }, 20000, 12000, 'heart', 1) },
  '1-5F': { archetype: 'swarm', spec: swarmSpec('Quick Pounce', 'lorc/sword-clash', { kind: 'any' }, 9000, 11500, 'glancing') },

  // World 2 — archetypes shine clearly (Sloth Heavy Slam, Bandit/Owl Stalker, mid-speed Tactical)
  '2-1': { archetype: 'heavy', spec: heavySpec('Slow Swipe', 'lorc/sword-clash', { kind: 'any' }, 22000, 12000, 'time', 8) },
  '2-2': { archetype: 'tactical', spec: tacticalSpec('Ember Leap', 'lorc/fireball', { kind: 'any' }, 'heart') },
  '2-3': { archetype: 'tactical', spec: tacticalSpec('Silk Lash', 'lorc/cobweb', { kind: 'any' }, 'heart') },
  '2-4': { archetype: 'stalker', spec: stalkerSpec('Crimson Ambush', 'lorc/claw-slashes', { kind: 'color', color: 'red' }, 'heart') },
  '2-5': { archetype: 'tactical', spec: tacticalSpec('Acorn Barrage', 'lorc/sword-clash', { kind: 'shape', shape: 'oval' }, 'heart') },
  '2-6': { archetype: 'tactical', spec: tacticalSpec('Scrap Hurl', 'lorc/stone-block', { kind: 'exact_same', count: 2 }, 'heart') },
  '2-7': { archetype: 'stalker', spec: stalkerSpec('Shadow Swoop', 'lorc/moon', { kind: 'color', color: 'purple' }, 'heart') },
  '2-8': { archetype: 'tactical', spec: tacticalSpec('Trickster Feint', 'lorc/sword-clash', { kind: 'same_number' }, 'heart') },
  '2-9': { archetype: 'tactical', spec: tacticalSpec('Prism Burst', 'lorc/rainbow-star', { kind: 'color', color: 'green' }, 'heart') },
  '2-10': { archetype: 'stalker', spec: stalkerSpec('Venom Fang', 'carl-olsen/spider-face', { kind: 'shape', shape: 'squiggle' }, 'heart') },
  '2-5C': { archetype: 'tactical', spec: tacticalSpec('Bark Charge', 'lorc/sword-clash', { kind: 'any' }, 'heart') },
  '2-8B': { archetype: 'tactical', spec: tacticalSpec('Claw Maul', 'lorc/claw-slashes', { kind: 'exact_same', count: 2 }, 'heart') },
  '2-9P': { archetype: 'tactical', spec: tacticalSpec('Frost Gust', 'lorc/snowflake-1', { kind: 'all_different' }, 'heart', 13500, 15500) },

  // World 3 — Ember Canyon (Mammoth Heavy Slam, Ants Swarm, Cobra/Boar Stalker)
  '3-1': { archetype: 'heavy', spec: heavySpec('Cinder Wave', 'lorc/fireball', { kind: 'color', color: 'red' }, 21000, 12000, 'heart', 2) },
  '3-2': { archetype: 'tactical', spec: tacticalSpec('Sabotage Strike', 'caro-asercion/goblin', { kind: 'exact_diff', count: 2 }, 'heart') },
  '3-3': { archetype: 'swarm', spec: swarmSpec('Pack Rush', 'lorc/claw-slashes', { kind: 'shape', shape: 'diamond' }, 8500, 11000, 'time', 4) },
  '3-4': { archetype: 'tactical', spec: tacticalSpec('Bazaar Tax', 'lorc/crown-coin', { kind: 'diff_number' }, 'heart') },
  '3-5': { archetype: 'tactical', spec: tacticalSpec('Tidal Snap', 'lorc/big-wave', { kind: 'shape', shape: 'oval' }, 'heart') },
  '3-6': { archetype: 'tactical', spec: tacticalSpec('Arcane Flare', 'lorc/crystal-wand', { kind: 'all_different' }, 'heart') },
  '3-7': { archetype: 'tactical', spec: tacticalSpec('Earthquake Dig', 'caro-asercion/mole', { kind: 'exact_same', count: 2 }, 'heart') },
  '3-8': { archetype: 'tactical', spec: tacticalSpec('Chroma Shift', 'darkzaitzev/chameleon-glyph', { kind: 'color', color: 'purple' }, 'heart') },
  '3-9': { archetype: 'tactical', spec: tacticalSpec('Chrono Pluck', 'lorc/raven', { kind: 'same_number' }, 'time') },
  '3-10': { archetype: 'stalker', spec: stalkerSpec('Crimson Gore', 'caro-asercion/boar', { kind: 'color', color: 'red' }, 'heart') },
  '3-3E': { archetype: 'swarm', spec: swarmSpec('Swarm Bite', 'delapouite/ant', { kind: 'diff_number' }, 8500, 11000, 'time', 4) },
  '3-3E2': { archetype: 'stalker', spec: stalkerSpec('Cobra Strike', 'skoll/cobra', { kind: 'any' }, 'heart') },
  '3-5P': { archetype: 'tactical', spec: tacticalSpec('Riptide Pinch', 'lorc/crab', { kind: 'color', color: 'green' }, 'heart') },
  '3-8E': { archetype: 'stalker', spec: stalkerSpec('Abyssal Ink', 'delapouite/giant-squid', { kind: 'color', color: 'purple' }, 'heart') },

  // World 4 — Frozen Peaks (Bee/Claws Swarm, Sentinel/Polar Heavy, Bear/Cyclops/Fangs Stalker, Dragon Boss Escalation)
  '4-1': { archetype: 'tactical', spec: tacticalSpec('Glacier Slam', 'lorc/snowflake-1', { kind: 'exact_diff', count: 2 }, 'heart') },
  '4-2': { archetype: 'swarm', spec: swarmSpec('Hyper Sting', 'lorc/bee', { kind: 'diff_number' }, 8000, 10500, 'time', 4) },
  '4-3': { archetype: 'tactical', spec: tacticalSpec('Frost Mend', 'lorc/snowflake-1', { kind: 'shape', shape: 'diamond' }, 'heart') },
  '4-4': { archetype: 'tactical', spec: tacticalSpec('Shatter Fang', 'lorc/shard-sword', { kind: 'all_different' }, 'heart') },
  '4-5': { archetype: 'tactical', spec: tacticalSpec('Punish Cleave', 'lorc/claw-slashes', { kind: 'exact_same', count: 2 }, 'heart') },
  '4-6': { archetype: 'stalker', spec: stalkerSpec('Venom Tick', 'lorc/snake', { kind: 'shape', shape: 'oval' }, 'heart') },
  '4-7': { archetype: 'tactical', spec: tacticalSpec('Blizzard Whirl', 'lorc/vortex', { kind: 'same_number' }, 'heart') },
  '4-8': { archetype: 'heavy', spec: heavySpec('Polar Crush', 'sparker/bear-face', { kind: 'color', color: 'green' }, 20500, 11500, 'heart', 2) },
  '4-9': { archetype: 'stalker', spec: stalkerSpec('Cyclops Gaze', 'lorc/cyclops', { kind: 'shape', shape: 'squiggle' }, 'heart') },
  '4-10': { archetype: 'stalker', spec: stalkerSpec('Feral Rend', 'lorc/bestial-fangs', { kind: 'color', color: 'red' }, 'heart') },
  '4-11': { archetype: 'boss_enrage', spec: bossEnrageSpec('Prismatic Inferno', 'lorc/dragon-head', { kind: 'all_different' }, 11500, 13000, 'heart') },
  '4-2E': { archetype: 'stalker', spec: stalkerSpec('Maul Charge', 'sparker/bear-face', { kind: 'exact_diff', count: 2 }, 'heart') },
  '4-2E2': { archetype: 'swarm', spec: swarmSpec('Savage Flurry', 'lorc/wolverine-claws', { kind: 'color', color: 'red' }, 8500, 10500, 'time', 4) },
  '4-5E': { archetype: 'heavy', spec: heavySpec('Monolith Drop', 'delapouite/golem-head', { kind: 'shape', shape: 'diamond' }, 21000, 11500, 'heart', 2) },
  '4-7E': { archetype: 'tactical', spec: tacticalSpec('Dam Collapse', 'delapouite/beaver', { kind: 'same_number' }, 'heart') },
  '4-7E2': { archetype: 'stalker', spec: stalkerSpec('Tentacle Whip', 'lorc/octopus', { kind: 'color', color: 'purple' }, 'heart') },

  // World 5 — Starfall Summit Gauntlet
  '5-1': { archetype: 'stalker', spec: stalkerSpec('Abyssal Crush', 'delapouite/kraken-tentacle', { kind: 'color', color: 'purple' }, 'heart', 14000, 11500) },
  '5-2': { archetype: 'heavy', spec: heavySpec('Void Rift', 'lorc/daemon-skull', { kind: 'exact_diff', count: 2 }, 18500, 11000, 'heart', 2) },
  '5-3': { archetype: 'stalker', spec: stalkerSpec('Soul Scythe', 'lorc/grim-reaper', { kind: 'shape', shape: 'diamond' }, 'time') },
  '5-4': { archetype: 'swarm', spec: swarmSpec('Quill Tempest', 'caro-asercion/porcupine', { kind: 'same_number' }, 9000, 11000, 'time', 4) },
  '5-5': { archetype: 'boss_enrage', spec: bossEnrageSpec('Hydra Apocalypse', 'lorc/hydra', { kind: 'all_different' }, 11000, 12500, 'heart') },
};

/** Archetype label for a campaign level's foe parry profile (null on no-parry levels). */
export const getParryArchetype = (levelId: string): ParryArchetype | null =>
  LEVEL_PARRIES[levelId]?.archetype ?? null;

/**
 * Effective parry cooldown (ms), applying Boss Escalation tightening
 * (`-bossEnrageDeltaMs`, default `-2,000ms`) once the boss drops below 50% HP.
 */
export const effectiveParryCooldownMs = (parrySpec: ParrySpec, foeHpRatio: number): number => {
  const enrageDelta =
    parrySpec.bossEnrageDeltaMs && foeHpRatio < PARRY_RULES.bossEnrageHpThreshold
      ? parrySpec.bossEnrageDeltaMs
      : 0;
  return Math.max(4000, parrySpec.cooldownMs - enrageDelta);
};

/**
 * Resolve the telegraphed attack & Set-Parry specification for a level's foe.
 * Explicit `foe.parry` wins (null disables parry); otherwise uses the campaign
 * table so every level from 1-5 onward has an archetype-tailored parry cadence.
 */
export const resolveParrySpec = (level: LevelDef, foe?: FoeDef): ParrySpec | null => {
  if (level.rules.noGear || level.rules.sandbox || NO_PARRY_LEVELS.has(level.id)) return null;
  if (foe && foe.parry !== undefined) return foe.parry;
  const fromTable = LEVEL_PARRIES[level.id]?.spec;
  if (fromTable) return fromTable;
  // Any non-table level with a registered enemy gets default timing-based Set-Parry;
  // synthetic sparring dummies in unit tests opt in via explicit `foe.parry`.
  if (foe?.enemy) return tacticalSpec('Wild Lunge', 'lorc/sword-clash', { kind: 'any' }, 'heart');
  return null;
};
