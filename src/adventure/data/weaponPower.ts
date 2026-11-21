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
 * knee (3 points = ×4), then bending gently via log tail so a single weapon
 * reaches ×10, a recipe pair reaches ×50, and a full 6-charm build with
 * unified multipliers, fighter tree, and Arcana lands
 * cleanly near ×300 instead of overflowing into the thousands.
 */
export const POWER_KNEE = 3;
export const POWER_TAIL = 0.45;

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
export const POWER_SHARE = 0.65;
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
  'amplifier-coil': 0.538,
  'blast-powder': 0.117,
  'bounty-poster': 0.234,
  'cascade-core': 40,
  'catalyst-prism': 0.177,
  'chain-gang': 0.265,
  'chain-reaction': 40,
  'chaos-conduit': 2.964,
  'chaos-shard': 0.187,
  'chrono-shard': 39.767,
  'clarity-lens': 0.792,
  'collectors-album': 0.553,
  'connector': 0.0407,
  'crystal-orb': 0.434,
  'cursed-idol': 3.036,
  'decoy': 0.207,
  'devils-bargain': 0.133,
  'echo-chamber': 1.986,
  'echo-stone': 13.829,
  'encore-mask': 40,
  'field-stone': 16.039,
  'flint-spark': 0.0452,
  'fog-lantern': 0.428,
  'fortune-token': 0.464,
  'fortunes-blessing': 0.124,
  'fortunes-favor': 2.051,
  'glass-sword': 0.106,
  'grace-conduit': 0.233,
  'greedy-chest': 0.157,
  'growth-seed': 0.207,
  'hot-potato': 0.289,
  'ice-block': 1.419,
  'life-link': 0.163,
  'life-vessel': 40,
  'long-fuse': 1.312,
  'magnet': 0.432,
  'mending-charm': 0.099,
  'mirror-shard': 0.149,
  'mystic-sight': 1.233,
  'neural-network': 0.0471,
  'odd-one-out': 0.457,
  'oracle-eye': 0.142,
  'pinata': 0.405,
  'prismatic-ray': 0.699,
  'rainbow-charm': 0.486,
  'rally-horn': 0.693,
  'revenge-linker': 0.133,
  'rust': 0.267,
  'scholars-tome': 0.653,
  'second-chance': 0.316,
  'seeker-lens': 1.101,
  'snowball': 0.086,
  'soul-harvest': 2.53,
  'tar-pit': 0.147,
  'temporal-rift': 18.603,
  'thorn-bush': 1.354,
  'tightrope': 0.112,
  'time-drop': 37.789,
  'twin-seed': 0.205,
  'war-drum': 2.139,
  'web-weaver': 0.0204,
  'wild-card': 9.486,
  'wisdom-chain': 0.135,
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
