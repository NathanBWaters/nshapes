/**
 * Power: the fight-wide damage multiplier driven transparently by weapon
 * triggers, skill feats, and Evolution ignitions.
 *
 * Every Armory weapon declares an explicit `powerYield` tied strictly to its
 * own mechanic in one of 4 authored tiers:
 *   - frequent  (+0.10 Lv1 -> +0.20 Lv5)
 *   - tactical  (+0.25 Lv1 -> +0.50 Lv5)
 *   - feat      (+0.60 Lv1 -> +1.20 Lv5)
 *   - amplifier (Amplifier Coil +0.25 -> +0.50 + doubled trigger Power; Understudy copies left neighbor)
 *
 * Level scaling (Lv 1–5): 1.00× / 1.25× / 1.50× / 1.75× / 2.00×.
 * No hidden `powerShare` dilution for equipping a full belt.
 *
 * C¹-smooth square-root curve (`powerMultiplier(P)`):
 *   P <= 3: 1 + P               (P=0 → ×1.0, P=1 → ×2.0, P=3 → ×4.0, slope = 1)
 *   P >  3: 2 + 2 * sqrt(P - 2) (P=6 → ×6.0, P=11 → ×8.0, P=18 → ×10.0, slope at P=3 = 1)
 */
import type { GrowthWatch } from './weaponGrowth';

export const POWER_KNEE = 3;
/** Slope factor of the square-root tail (kept as named export for balanceFingerprints). */
export const POWER_TAIL = 2;

export const powerMultiplier = (points: number): number => {
  if (points <= 0) return 1;
  if (points <= POWER_KNEE) return 1 + points;
  return 2 + POWER_TAIL * Math.sqrt(points - 2);
};

/** Zero hidden penalty for equipping more charms (kept for compatibility). */
export const POWER_SHARE = 0;
export const powerShare = (_feeding: number): number => 1;

/** Weapon level scaling for Power yield: Lv1 1.00×, Lv2 1.25×, Lv3 1.50×, Lv4 1.75×, Lv5 2.00×. */
export const POWER_LEVEL_FLOOR = 1;
export const POWER_LEVEL_STEP = 0.25;
export const powerLevelFactor = (level: number): number =>
  POWER_LEVEL_FLOOR + POWER_LEVEL_STEP * (Math.max(1, Math.min(5, Math.round(level))) - 1);

export type PowerTier = 'frequent' | 'tactical' | 'feat' | 'amplifier';

/** Base Power added per weapon trigger at Lv1 (doubles cleanly to Lv5 via powerLevelFactor). */
export const POWER_TIER_BASE: Readonly<Record<PowerTier, number>> = {
  frequent: 0.1,
  tactical: 0.25,
  feat: 0.6,
  amplifier: 0.25,
};

/** Skill-feat Power surges that reward execution even with zero charms equipped. */
export const SKILL_FEAT_POWER = {
  perfectParry: 0.3,
  counterParry: 0.15,
  purityChain3: 0.25,
  clutchBomb: 0.25,
} as const;

/**
 * What a weapon watches to generate Power. Superset of `GrowthWatch` with
 * dedicated mechanic-specific checks (never generic plain `{ on: 'set' }`).
 */
export type PowerWatch =
  | GrowthWatch
  /** Set contained a Power card (+bonusPoints) or Charged/Empowered card (+charge) */
  | { on: 'empoweredMatch' }
  /** Set completed within `withinMs` of the previous Set (tempo play) */
  | { on: 'quickSet'; withinMs: number }
  /** Every `every` unbroken valid Sets (resets on mistake) */
  | { on: 'unbrokenSets'; every: number }
  /** Valid Set scored while at <= `maxHearts` */
  | { on: 'lowHeartsSet'; maxHearts: number }
  /** Every `every` Sets made while at full hearts */
  | { on: 'fullHeartsStreak'; every: number }
  /** `every` Rainbow Sets in a row */
  | { on: 'rainbowStreak'; every: number }
  /** Dynamically copies the left neighbor's `PowerYieldDef` (Understudy) */
  | { on: 'copyLeft' };

export interface PowerYieldDef {
  watches: readonly PowerWatch[];
  tier: PowerTier;
  /** Lowercase trigger phrase for player-facing UI ("explosion", "wanted card matched", etc.) */
  label: string;
}

const y = (tier: PowerTier, label: string, ...watches: PowerWatch[]): PowerYieldDef => ({
  tier,
  label,
  watches,
});

/**
 * Authored Power yields covering ALL 64 Armory weapons (19 frequent + 33 tactical + 10 feat + 2 amplifier = 64).
 * Zero generic `{ on: 'set' }` fallbacks, zero bot-fitted fudge factors.
 */
export const POWER_YIELD: Readonly<Record<string, PowerYieldDef>> = {
  // ── Frequent (+0.10 Lv1 -> +0.20 Lv5, 19 weapons) ─────────────────────────
  'blast-powder': y('frequent', 'explosion', { on: 'weapon', kind: 'explosion' }),
  'flint-spark': y('frequent', 'card burned', { on: 'cardBurned' }),
  'prismatic-ray': y('frequent', 'laser', { on: 'weapon', kind: 'laser' }),
  'chaos-shard': y('frequent', 'ricochet', { on: 'weapon', kind: 'ricochet' }),
  'echo-stone': y('frequent', 'echo', { on: 'weapon', kind: 'echo' }),
  'chain-reaction': y('frequent', 'echo', { on: 'weapon', kind: 'echo' }),
  'cascade-core': y('frequent', 'echo', { on: 'weapon', kind: 'echo' }),
  connector: y('frequent', 'linked card destroyed', { on: 'linkDestroyed' }),
  'web-weaver': y('frequent', 'linked card destroyed', { on: 'linkDestroyed' }),
  'neural-network': y('frequent', 'linked card destroyed', { on: 'linkDestroyed' }),
  'echo-chamber': y('frequent', 'linked card destroyed', { on: 'linkDestroyed' }),
  magnet: y('frequent', 'marked card matched', { on: 'trick', kind: 'magnet' }),
  'mirror-shard': y('frequent', 'Mirror Set', { on: 'trick', kind: 'mirror' }),
  'odd-one-out': y('frequent', 'Odd One Out Set', { on: 'trick', kind: 'odd' }),
  tightrope: y('frequent', 'Tightrope Set', { on: 'trick', kind: 'tightrope' }),
  'tar-pit': y('frequent', 'Tar Pit Set', { on: 'trick', kind: 'tar' }),
  'twin-seed': y('frequent', 'twin destroyed', { on: 'trick', kind: 'twin' }),
  'field-stone': y('frequent', 'empowered card matched', { on: 'empoweredMatch' }),
  'growth-seed': y('frequent', 'board growth or empowered card', { on: 'weapon', kind: 'growth' }, { on: 'empoweredMatch' }),

  // ── Tactical (+0.25 Lv1 -> +0.50 Lv5, 33 weapons) ─────────────────────────
  'war-drum': y('tactical', 'drumbeat', { on: 'own' }),
  'rally-horn': y('tactical', 'Rally', { on: 'own' }),
  pinata: y('tactical', 'piñata break', { on: 'cardBroken' }),
  'rainbow-charm': y('tactical', 'Rainbow Set', { on: 'set', test: 'rainbow' }),
  'clarity-lens': y('tactical', 'Clarity', { on: 'own' }),
  'revenge-linker': y('tactical', 'tripwire or revenge', { on: 'own' }),
  'bounty-poster': y('tactical', 'wanted card matched', { on: 'trick', kind: 'bounty' }),
  'thorn-bush': y('tactical', 'thorn cleared', { on: 'trick', kind: 'thorn' }),
  'hot-potato': y('tactical', 'Hot Potato cleared', { on: 'trick', kind: 'potato' }),
  'long-fuse': y('tactical', 'short fuse matched', { on: 'trick', kind: 'fuse' }),
  'cursed-idol': y('tactical', '×2 cursed card matched', { on: 'trick', kind: 'curse' }),
  'chain-gang': y('tactical', 'chained pair matched', { on: 'trick', kind: 'chain' }),
  decoy: y('tactical', 'decoy pair caught', { on: 'trick', kind: 'decoy' }),
  'fog-lantern': y('tactical', 'fog lifted', { on: 'trick', kind: 'fog' }),
  'wild-card': y('tactical', 'wild card matched', { on: 'trick', kind: 'wild' }),
  'mending-charm': y('tactical', 'heal or full-heart pulse', { on: 'healed' }),
  'soul-harvest': y('tactical', 'heal or full-heart pulse', { on: 'healed' }),
  'life-link': y('tactical', 'heal or full-heart pulse', { on: 'healed' }),
  'second-chance': y('tactical', 'grace save or gain', { on: 'graceUsed' }, { on: 'weapon', kind: 'grace' }),
  'fortune-token': y('tactical', 'grace gain or save', { on: 'weapon', kind: 'grace' }, { on: 'graceUsed' }),
  'grace-conduit': y('tactical', 'grace save or gain', { on: 'graceUsed' }, { on: 'weapon', kind: 'grace' }),
  'chaos-conduit': y('tactical', 'grace gain or save', { on: 'weapon', kind: 'grace' }, { on: 'graceUsed' }),
  'seeker-lens': y('tactical', 'hinted Set or hint gained', { on: 'set', test: 'hinted' }, { on: 'weapon', kind: 'hint' }),
  'crystal-orb': y('tactical', 'hint used or hinted Set', { on: 'hintUsed' }, { on: 'set', test: 'hinted' }),
  'oracle-eye': y('tactical', 'hinted Set', { on: 'set', test: 'hinted' }),
  'mystic-sight': y('tactical', 'Third Eye or hinted Set', { on: 'own' }, { on: 'set', test: 'hinted' }),
  'fortunes-favor': y('tactical', 'bonus coin proc', { on: 'weapon', kind: 'coin' }),
  'fortunes-blessing': y('tactical', 'bonus coin or hint proc', { on: 'weapon', kind: 'coin' }, { on: 'weapon', kind: 'hint' }),
  'scholars-tome': y('tactical', 'bonus XP proc', { on: 'weapon', kind: 'xp' }),
  'wisdom-chain': y('tactical', 'bonus XP or coin proc', { on: 'weapon', kind: 'xp' }, { on: 'weapon', kind: 'coin' }),
  'chrono-shard': y('tactical', 'time gain or quick Set', { on: 'weapon', kind: 'time' }, { on: 'quickSet', withinMs: 5000 }),
  'time-drop': y('tactical', 'time gain', { on: 'weapon', kind: 'time' }),
  'temporal-rift': y('tactical', 'time gain or rift echo', { on: 'weapon', kind: 'time' }, { on: 'weapon', kind: 'echo' }),

  // ── Feat (+0.60 Lv1 -> +1.20 Lv5, 10 weapons) ─────────────────────────────
  'collectors-album': y('feat', 'completed Album', { on: 'feat', name: 'albumDone' }),
  'ice-block': y('feat', 'thawed card matched', { on: 'trick', kind: 'ice' }),
  'greedy-chest': y('feat', 'chest cash-in', { on: 'trick', kind: 'chest' }),
  rust: y('feat', 'golden card matched', { on: 'trick', kind: 'rust' }),
  snowball: y('feat', 'full Snowball', { on: 'feat', name: 'fullSnowball' }),
  'glass-sword': y('feat', '5 unbroken Sets', { on: 'unbrokenSets', every: 5 }),
  'devils-bargain': y('feat', 'Set at ≤2 ♥ or last heart', { on: 'lowHeartsSet', maxHearts: 2 }, { on: 'feat', name: 'lastHeart' }),
  'life-vessel': y('feat', '3 full-HP Sets or 2 Rainbows in a row', { on: 'fullHeartsStreak', every: 3 }, { on: 'rainbowStreak', every: 2 }),
  'catalyst-prism': y('feat', 'Catalyst matched', { on: 'catalyst' }),
  'encore-mask': y('feat', 'evolution finale', { on: 'evolutionEnd' }),

  // ── Amplifier (2 weapons: total 19 + 33 + 10 + 2 = 64 Armory weapons) ─────
  'amplifier-coil': y('amplifier', 'doubled trigger (plus 2× Power on that trigger)', { on: 'doubled' }),
  understudy: y('amplifier', 'copied left charm trigger', { on: 'copyLeft' }),
};

/** Every Armory weapon now feeds Power (Understudy copies its left neighbor). */
export const NO_POWER = new Set<string>();

export const DEFAULT_PER = POWER_TIER_BASE.tactical;

/** Derived base Lv1 Power yield map (no bot fudge table; kept for analytics & fingerprints). */
export const PER: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(POWER_YIELD).map(([id, def]) => [id, id === 'understudy' ? 0 : POWER_TIER_BASE[def.tier]])
);

export const powerYieldOf = (weaponId: string): PowerYieldDef | undefined => POWER_YIELD[weaponId];

export const powerWatches = (weaponId: string): readonly PowerWatch[] => POWER_YIELD[weaponId]?.watches ?? [];

/** Lv1 base Power yield per trigger for `weaponId`. */
export const powerPer = (weaponId: string): number => {
  const def = POWER_YIELD[weaponId];
  if (!def) return DEFAULT_PER;
  if (weaponId === 'understudy') return 0;
  return POWER_TIER_BASE[def.tier];
};

/** Exact Power points gained per trigger at `level` (1..5). */
export const powerGainAtLevel = (weaponId: string, level = 1): number =>
  Math.round(powerPer(weaponId) * powerLevelFactor(level) * 1000) / 1000;

/** Format a per-trigger Power delta ("+0.10", "+0.15", "+0.25", "+1.20"). */
export const formatPowerGain = (gain: number): string => {
  const rounded = Math.round(gain * 100) / 100;
  return `+${rounded.toFixed(2)}`;
};

/** Lowercase noun phrase for what feeds Power ("every explosion", "every 5 unbroken Sets", etc.). */
export const powerWatchPhrase = (weaponId: string): string | null => {
  const def = POWER_YIELD[weaponId];
  if (!def) return null;
  if (weaponId === 'understudy') return 'its left charm’s trigger';
  return `every ${def.label}`;
};

/** Player-facing Power line for WeaponExplainer / PowerExplainer, printing exact per-trigger gain. */
export const powerText = (weaponId: string, level?: number): string | null => {
  const def = POWER_YIELD[weaponId];
  if (!def) return null;
  if (weaponId === 'understudy') {
    return 'Copies its left charm’s Power trigger and tier at the higher level, which raises your Power multiplier and never stops climbing.';
  }
  const lv1 = formatPowerGain(powerGainAtLevel(weaponId, 1));
  const lv5 = formatPowerGain(powerGainAtLevel(weaponId, 5));
  if (level !== undefined) {
    const lv = Math.max(1, Math.min(5, Math.round(level)));
    const gain = formatPowerGain(powerGainAtLevel(weaponId, lv));
    return `Every ${def.label} adds ${gain} Power (Lv ${lv}), which raises your Power multiplier and never stops climbing.`;
  }
  return `Every ${def.label} adds ${lv1} Power (Lv 1 → ${lv5} at Lv 5), which raises your Power multiplier and never stops climbing.`;
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
