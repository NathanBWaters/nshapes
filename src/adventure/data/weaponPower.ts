/**
 * Power: the fight-wide damage multiplier that weapon scaling feeds.
 *
 * Every held weapon watches for something during a fight (its Scaling line,
 * data/weaponGrowth.ts). Each time that happens the weapon also adds Power,
 * and Power multiplies every point of damage dealt for the rest of the fight.
 * A weapon's unique effect stops at its limit; its Power never does.
 *
 * Targets on a 3-minute endgame fight, measured against a player with no gear
 * (docs/adventure-design.md, "Power"):
 *   one weapon                         about ×10 by the last 30 seconds
 *   a well-chosen pair (an evolution)  about ×50
 *   a full build, fighter tree, Arcana and Workshop  about ×300
 *
 * Each weapon's `per` is tuned so that weapon alone reaches the first target
 * (POWER_TUNE=1 npx jest __tests__/adventurePowerTuner.test.ts rewrites the
 * PER table below). More weapons feed the same meter, and the curve bends so a
 * full belt lands near the third target instead of exploding (powerShare and
 * the knee in powerMultiplier).
 */
import type { GrowthWatch } from './weaponGrowth';
import { WEAPON_GROWTH } from './weaponGrowth';

/**
 * How Power points turn into the damage multiplier: one-for-one up to the
 * knee (12 points = ×13), then bending hard, so a full belt tops out near ×15
 * and the rest of a big build's strength comes from combos, the fighter's
 * tree and Arcana.
 */
export const POWER_KNEE = 12;
export const POWER_TAIL = 2;

export const powerMultiplier = (points: number): number => {
  if (points <= 0) return 1;
  if (points <= POWER_KNEE) return 1 + points;
  return 1 + POWER_KNEE + POWER_TAIL * Math.log(1 + (points - POWER_KNEE) / POWER_KNEE);
};

/**
 * A pair feeds the meter in full; from the third weapon on they share it:
 * each one's Power is scaled by (weapons feeding it - 1)^-POWER_SHARE, so a
 * full belt fills it in about a minute instead of seconds, and still faster
 * than one weapon or a pair does.
 */
export const POWER_SHARE = 0.4;
export const powerShare = (feeding: number): number => Math.pow(Math.max(1, feeding - 1), -POWER_SHARE);

/** A weapon's level makes its Power gain bigger: level 1 gives this share of level 5's. */
export const POWER_LEVEL_FLOOR = 0.6;
export const powerLevelFactor = (level: number): number =>
  POWER_LEVEL_FLOOR + ((1 - POWER_LEVEL_FLOOR) * (Math.max(1, Math.min(5, level)) - 1)) / 4;

/**
 * What feeds Power for weapons whose Scaling watch is too rare to fuel it
 * (a finished poster, the last heart) or that have no Scaling line. Every
 * other weapon is fed by its own Scaling watches.
 */
const FEED_OVERRIDES: Record<string, GrowthWatch[]> = {
  'blast-powder': [{ on: 'weapon', kind: 'explosion' }],
  'field-stone': [{ on: 'set' }],
  'growth-seed': [{ on: 'weapon', kind: 'growth' }],
  'bounty-poster': [{ on: 'trick', kind: 'bounty' }],
  'mirror-shard': [{ on: 'trick', kind: 'mirror' }],
  'devils-bargain': [{ on: 'set' }],
  snowball: [{ on: 'set' }],
  'collectors-album': [{ on: 'trick', kind: 'album' }],
  'greedy-chest': [{ on: 'set' }],
  'revenge-linker': [{ on: 'set' }],
  'soul-harvest': [{ on: 'set' }],
  'catalyst-prism': [{ on: 'set' }],
  'encore-mask': [{ on: 'set' }],
  'echo-stone': [{ on: 'weapon', kind: 'echo' }],
  decoy: [{ on: 'set' }],
  'grace-conduit': [{ on: 'set' }],
  'amplifier-coil': [{ on: 'set' }],
};

/** How the explainer names an override's watch ("every explosion raises your Power") */
const OVERRIDE_WORDS: Record<string, string> = {
  'blast-powder': 'explosion',
  'field-stone': 'Set you make',
  'growth-seed': 'card it adds',
  'bounty-poster': 'wanted card you match',
  'mirror-shard': 'Mirror',
  'devils-bargain': 'Set you make',
  snowball: 'Set you make',
  'collectors-album': 'Album page',
  'greedy-chest': 'Set you make',
  'revenge-linker': 'Set you make',
  'soul-harvest': 'Set you make',
  'catalyst-prism': 'Set you make',
  'encore-mask': 'Set you make',
  'echo-stone': 'echo',
  decoy: 'Set you make',
  'grace-conduit': 'Set you make',
  'amplifier-coil': 'Set you make',
};

/** Weapons that never feed Power: the Understudy grows with the weapon it copies. */
export const NO_POWER = new Set(['understudy']);

/** What a weapon's Power watches for: its override, else every watch of its Scaling line. */
export const powerWatches = (weaponId: string): GrowthWatch[] => {
  if (NO_POWER.has(weaponId)) return [];
  return FEED_OVERRIDES[weaponId] ?? (WEAPON_GROWTH[weaponId] ?? []).map(def => def.watch);
};

/**
 * Power points a weapon adds each time one of its watches happens, at level 5.
 * Tuned by the Power tuner; a weapon missing here uses DEFAULT_PER.
 */
export const DEFAULT_PER = 0.5;
// POWER-TUNER:BEGIN
export const PER: Readonly<Record<string, number>> = {
  'amplifier-coil': 0.362,
  'blast-powder': 0.177,
  'bounty-poster': 0.288,
  'cascade-core': 1.717,
  'catalyst-prism': 0.34,
  'chain-gang': 0.263,
  'chain-reaction': 2.95,
  'chaos-conduit': 0.405,
  'chaos-shard': 0.235,
  'chrono-shard': 3.653,
  'clarity-lens': 1.02,
  'collectors-album': 0.65,
  'connector': 0.064,
  'crystal-orb': 0.606,
  'cursed-idol': 0.414,
  'decoy': 0.284,
  'devils-bargain': 0.101,
  'echo-chamber': 0.413,
  'echo-stone': 1.341,
  'encore-mask': 0.542,
  'field-stone': 0.454,
  'flint-spark': 0.029,
  'fog-lantern': 0.256,
  'fortune-token': 0.622,
  'fortunes-blessing': 0.118,
  'fortunes-favor': 0.55,
  'glass-sword': 0.175,
  'grace-conduit': 0.28,
  'greedy-chest': 0.352,
  'growth-seed': 0.326,
  'hot-potato': 1.364,
  'ice-block': 1.419,
  'life-link': 0.287,
  'life-vessel': 2.144,
  'long-fuse': 0.71,
  'magnet': 0.56,
  'mending-charm': 0.221,
  'mirror-shard': 0.266,
  'mystic-sight': 0.723,
  'neural-network': 0.083,
  'odd-one-out': 1.111,
  'oracle-eye': 0.081,
  'pinata': 0.539,
  'prismatic-ray': 0.659,
  'rainbow-charm': 1.345,
  'rally-horn': 0.811,
  'revenge-linker': 0.121,
  'rust': 0.253,
  'scholars-tome': 0.292,
  'second-chance': 0.306,
  'seeker-lens': 0.558,
  'snowball': 0.127,
  'soul-harvest': 0.47,
  'tar-pit': 0.282,
  'temporal-rift': 2.102,
  'thorn-bush': 2.122,
  'tightrope': 0.167,
  'time-drop': 1.775,
  'twin-seed': 0.219,
  'war-drum': 1.241,
  'web-weaver': 0.028,
  'wild-card': 0.402,
  'wisdom-chain': 0.146,
};
// POWER-TUNER:END

/** The Power tuner tries values here before writing them into PER ('*' applies to every weapon). */
export const PER_TRIAL = new Map<string, number>();

export const powerPer = (weaponId: string): number => PER_TRIAL.get(weaponId) ?? PER_TRIAL.get('*') ?? PER[weaponId] ?? DEFAULT_PER;

/** What a weapon watches to feed Power, as a lowercase noun phrase ("every explosion", "every card cleared", etc.). */
export const powerWatchPhrase = (weaponId: string): string | null => {
  if (powerWatches(weaponId).length === 0) return null;
  if (FEED_OVERRIDES[weaponId]) return `every ${OVERRIDE_WORDS[weaponId] ?? 'Set you make'}`;
  const def = (WEAPON_GROWTH[weaponId] ?? [])[0];
  if (!def?.look) return 'using it';
  return def.every && def.every > 1 ? `every ${def.every} ${def.look}` : `every ${def.look}`;
};

/** The explainer's Power sentence for a weapon, or null if it does not feed Power. */
export const powerText = (weaponId: string): string | null => {
  if (powerWatches(weaponId).length === 0) return null;
  const tail = 'raises your Power, which multiplies all your damage and never stops climbing.';
  return FEED_OVERRIDES[weaponId] ? `Every ${OVERRIDE_WORDS[weaponId] ?? 'Set you make'} ${tail}` : `Each one also ${tail}`;
};

/** The balance lab and the build sweeps judge weapons without Power (it has its own test). */
let enabled = true;
export const setPowerEnabled = (on: boolean) => {
  enabled = on;
};
export const isPowerEnabled = () => enabled;

/** The multiplier a fight with these points deals damage at (1 while Power is switched off). */
export const damageMultiplier = (points: number): number => (enabled ? powerMultiplier(points) : 1);

/** "×4.2" */
export const formatPower = (points: number): string => {
  const m = powerMultiplier(points);
  return `×${m >= 100 ? Math.round(m) : m >= 10 ? m.toFixed(1).replace(/\.0$/, '') : m.toFixed(1)}`;
};
