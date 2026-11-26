/**
 * A weapon's numbers in Adventure, and the two separate ways to grow them.
 *
 *  - LEVEL (1-5) is found in the world. The first star or bounty reward that
 *    names a weapon unlocks it; every later one is +1 level. Continuous stats
 *    add `perLevel`; whole-unit stats (`WHOLE_STATS`) use clean integer Lv 1–5
 *    breakpoints (`byLevel`) with zero fractional gambling ([GP-19]).
 *  - TUNING is bought at the Camp Workshop with coins, one track per number:
 *    continuous stats multiply by ×1.1, ×1.2, ×1.35, ×1.5; tunable whole-unit
 *    stats grant a guaranteed +1 whole unit at Tier 2 (×1.2) and +2 whole units
 *    at Tier 4 (×1.5) — zero random fight-start rounding.
 */
import type { PlayerStats, Weapon, WeaponRarity } from '@/types';
import type { AdventureWeapon } from '../types';
import {
  ADVENTURE_TUNING,
  LIFE_LINK_PULSE_EVERY,
  MYSTIC_EVERY,
  ORACLE_WAIT_S,
  WISDOM_COIN_PCT,
  WISDOM_XP_EVERY,
} from './weaponTuning';
import { WEAPON_CADENCE, type LevelBreakpoints, type StatUnit } from './weapons/schema';

export const MAX_WEAPON_LEVEL = 5;
/** Workshop tuning multipliers by tier (tier 0 = untuned) */
export const TUNING_MULTIPLIERS = [1, 1.1, 1.2, 1.35, 1.5] as const;
export const MAX_TUNING_TIER = TUNING_MULTIPLIERS.length - 1;
/** Coins for tuning tier 1, 2, 3, 4 of one number */
export const TUNING_COSTS = [60, 150, 320, 600] as const;

/** How far one Armory weapon has grown: its level and its tuning tier per number. */
export interface WeaponBuild {
  level: number;
  tuning: Readonly<Record<string, number>>;
}
export type WeaponBuilds = Readonly<Record<string, WeaponBuild>>;
export const BASE_BUILD: WeaponBuild = { level: 1, tuning: {} };

type Unit = StatUnit;

/** One number of a weapon (a stat for plain weapons, a rule parameter for rule weapons). */
export interface WeaponStatDef {
  label: string;
  unit: Unit;
  base: number;
  perLevel: number;
  /** Explicit integer/stepped Lv 1–5 breakpoints (overrides `base + perLevel * (lvl - 1)`) */
  byLevel?: LevelBreakpoints;
  /** True when the stat resolves strictly to whole integer units */
  whole?: boolean;
  /** false: levels raise it but the Workshop can't tune it */
  tunable?: boolean;
}

/** A weapon number at a build: base → levelled → tuned. */
export interface StatLine extends WeaponStatDef {
  key: string;
  levelled: number;
  tier: number;
  multiplier: number;
  value: number;
  tunable: boolean;
}

/** Whole-unit stats that always resolve to clean integers (zero fractional gambling). */
export const WHOLE_STATS = ['fieldSize', 'graces', 'maxHealth', 'health', 'maxHints', 'hints', 'startingConnections'] as const;
const WHOLE_STAT_SET = new Set<string>(WHOLE_STATS);

/** Guaranteed integer bonus granted by Workshop tiers on tunable whole-unit stats (+1 at T2, +2 at T4). */
export const wholeStatTuningBonus = (tier: number): number => (tier >= 4 ? 2 : tier >= 2 ? 1 : 0);

const STAT_META: Partial<Record<keyof PlayerStats | 'bridgeChance', { label: string; unit: Unit }>> = {
  explosionChance: { label: 'Blast chance', unit: '%' },
  explosionDamage: { label: 'Damage per blasted card', unit: 'dmg' },
  laserChance: { label: 'Laser chance', unit: '%' },
  laserDamage: { label: 'Damage per lasered card', unit: 'dmg' },
  fireSpreadChance: { label: 'Fire chance', unit: '%' },
  burnDamage: { label: 'Damage per burned card', unit: 'dmg' },
  ricochetChance: { label: 'Ricochet chance', unit: '%' },
  ricochetChainChance: { label: 'Bounce-on chance', unit: '%' },
  ricochetDamage: { label: 'Damage per ricochet hit', unit: 'dmg' },
  echoChance: { label: 'Echo chance', unit: '%' },
  chainReactionChance: { label: 'Double-echo chance', unit: '%' },
  healingChance: { label: 'Heal chance', unit: '%' },
  graceGainChance: { label: 'Grace chance', unit: '%' },
  hintGainChance: { label: 'Hint chance', unit: '%' },
  autoHintChance: { label: 'Auto-hint chance', unit: '%' },
  enhancedHintChance: { label: 'Two-card hint chance', unit: '%' },
  xpGainChance: { label: 'XP chance', unit: '%' },
  coinGainChance: { label: 'Coin chance', unit: '%' },
  timeGainChance: { label: 'Time chance', unit: '%' },
  startingTime: { label: 'Extra seconds', unit: 's' },
  boardGrowthChance: { label: 'Growth chance', unit: '%' },
  fieldSize: { label: 'Extra board cards', unit: 'count' },
  graces: { label: 'Starting graces', unit: 'count' },
  maxHealth: { label: 'Extra hearts', unit: 'count' },
  timeGainAmount: { label: 'Seconds per time gain', unit: 's' },
  maxHints: { label: 'Extra hint slots', unit: 'count' },
  connectionChance: { label: 'Link chance', unit: '%' },
  startingConnections: { label: 'Starting links', unit: 'count' },
  echoTimeBonusPerLink: { label: 'Seconds per linked card', unit: 's' },
  bonusConnectionChance: { label: 'Bonus link chance', unit: '%' },
  linkedFireMultiplier: { label: 'Linked fire', unit: '×' },
  bridgeChance: { label: 'Trigger chance', unit: '%' },
};

/** `health` rides along with `maxHealth`, `hints` with `maxHints`; `luck` and timing knobs are not weapon numbers. */
const HIDDEN_STATS = new Set(['health', 'hints', 'luck', 'autoHintInterval']);

/** The numbers of a weapon and how each one levels. */
export const weaponStatDefs = (w: Weapon): Record<string, WeaponStatDef> => {
  const rule = (w as AdventureWeapon).stats;
  if (rule) return rule;
  const defs: Record<string, WeaponStatDef> = {};
  const per = (w.perLevel ?? {}) as Record<string, number | undefined>;
  const tuning = ADVENTURE_TUNING[w.id];
  const untunable = new Set(tuning?.untunable ?? []);
  for (const [key, v] of Object.entries(w.effects)) {
    if (typeof v !== 'number' || HIDDEN_STATS.has(key)) continue;
    const meta = STAT_META[key as keyof PlayerStats] ?? { label: key, unit: '%' as const };
    const byLevel = tuning?.byLevel?.[key];
    const whole = WHOLE_STAT_SET.has(key);
    defs[key] = {
      ...meta,
      base: byLevel ? byLevel[0] : v,
      perLevel: per[key] ?? 0,
      ...(byLevel ? { byLevel } : {}),
      ...(whole ? { whole: true } : {}),
      ...(untunable.has(key) ? { tunable: false } : {}),
    };
  }
  if (w.bridgeEffect) {
    const byLevel = tuning?.byLevel?.bridgeChance;
    defs.bridgeChance = {
      ...STAT_META.bridgeChance!,
      base: byLevel ? byLevel[0] : w.bridgeEffect.chance,
      perLevel: per.bridgeChance ?? 0,
      ...(byLevel ? { byLevel } : {}),
      ...(untunable.has('bridgeChance') ? { tunable: false } : {}),
    };
  }
  return { ...defs, ...tuning?.extra };
};

const clampLevel = (level: number) => Math.max(1, Math.min(MAX_WEAPON_LEVEL, Math.floor(level) || 1));
const clampTier = (tier: number | undefined) => Math.max(0, Math.min(MAX_TUNING_TIER, Math.floor(tier ?? 0) || 0));
const tidy = (n: number) => Math.round(n * 100) / 100;

/** Every number of a weapon at a build, in authoring order. */
export const weaponStatLines = (w: Weapon, build: WeaponBuild = BASE_BUILD): StatLine[] => {
  const level = clampLevel(build.level);
  return Object.entries(weaponStatDefs(w)).map(([key, def]) => {
    const tunable = def.tunable !== false;
    const tier = tunable ? clampTier(build.tuning[key]) : 0;
    const isWhole = def.whole === true || WHOLE_STAT_SET.has(key);
    const levelled = def.byLevel ? def.byLevel[level - 1] : tidy(def.base + def.perLevel * (level - 1));
    const multiplier = TUNING_MULTIPLIERS[tier];
    const value = isWhole ? Math.round(levelled) + wholeStatTuningBonus(tier) : tidy(levelled * multiplier);
    return { ...def, key, whole: isWhole, tunable, levelled, tier, multiplier, value };
  });
};

/** Numbers by key at a build. */
export const weaponValues = (w: Weapon, build: WeaponBuild = BASE_BUILD): Record<string, number> =>
  Object.fromEntries(weaponStatLines(w, build).map(l => [l.key, l.value]));

// ─── Wording ────────────────────────────────────────────────────────────────

const num = (n: number) => String(tidy(Math.round(n * 10) / 10));
const pct = (n: number) => `${num(n)}%`;
/** Clean integer count (never fractional ranges like "2-3") */
export const count = (n: number) => String(Math.round(tidy(n)));
const plural = (n: number, word: string) => `${word}${Math.round(tidy(n)) === 1 ? '' : 's'}`;

/** A stat line's value as shown in the Workshop ("36%", "+1.5", "2") */
export const formatStat = (unit: Unit, n: number): string =>
  unit === '%' ? pct(n) : unit === 's' ? `${num(n)}s` : unit === 'dmg' ? `+${num(n)}` : unit === '×' ? `×${num(n)}` : num(n);

type Text = { description: string; shortDescription: string };
type V = Record<string, number>;

/**
 * Descriptions of the plain (stat) weapons from their current numbers.
 * Collateral is the base damage per destroyed card (engine/fight.ts), shown
 * as a total with the weapon's bonus.
 */
const STAT_TEXT: Record<string, (v: V) => Text> = {
  'blast-powder': v => ({
    description: `${pct(v.explosionChance)} chance per Set to blast the cards next to it. Each blasted card deals ${num(1 + v.explosionDamage)} damage.`,
    shortDescription: `${pct(v.explosionChance)} blast, ${num(1 + v.explosionDamage)} dmg per card`,
  }),
  'oracle-eye': v => ({
    description: `Idle Radar: after ${ORACLE_WAIT_S}s without a Set, ${pct(v.autoHintChance)} chance to point out a card of a Set. Matching a hinted Set refunds +${num(v.refund)}s on the clock.`,
    shortDescription: `${ORACLE_WAIT_S}s auto-hint (${pct(v.autoHintChance)}); hinted Sets +${num(v.refund)}s`,
  }),
  'mystic-sight': v => ({
    description: `2-Card Precision Sniper: ${pct(v.autoHintChance)} auto-hint chance (${pct(v.enhancedHintChance)} point out 2 cards). Hinted Sets deal +${num(v.snipe)}, and every ${MYSTIC_EVERY}rd hinted Set primes ×1.5 next Set.`,
    shortDescription: `${pct(v.enhancedHintChance)} 2-card hints; hinted Sets +${num(v.snipe)} & ×1.5`,
  }),
  'field-stone': v => ({
    description: `Start every fight with ${count(v.fieldSize)} extra ${plural(v.fieldSize, 'card')} (+${pct(v.catalystBoost)} Catalyst odds). At ${WEAPON_CADENCE.FIELD_OVERFLOW_BOARD}+ cards, waves open and every ${WEAPON_CADENCE.FIELD_OVERFLOW_EVERY}th Set spawns a Power card.`,
    shortDescription: `+${count(v.fieldSize)} cards, +${pct(v.catalystBoost)} Catalysts & overflow Power cards`,
  }),
  'growth-seed': v => ({
    description: `${pct(v.boardGrowthChance)} chance per Set to add a card to the board (or empower the board at max size). Each time it fires, every card on the board deals +1 more when matched.`,
    shortDescription: `${pct(v.boardGrowthChance)} growth, board +1 each time`,
  }),
  'flint-spark': v => ({
    description: `${pct(v.fireSpreadChance)} chance per Set to ignite adjacent cards. Each burned card deals ${num(1 + v.burnDamage)} damage (carrying your Set's multipliers) and may spread fire.`,
    shortDescription: `${pct(v.fireSpreadChance)} fire, ${num(1 + v.burnDamage)} dmg per burned card`,
  }),
  'second-chance': v => ({
    description: `Safety Cushion: start every fight with ${count(v.graces)} extra ${plural(v.graces, 'grace')}, with a ${pct(v.keepChance)} chance a spent grace is spared and stays ready.`,
    shortDescription: `+${count(v.graces)} ${plural(v.graces, 'grace')}, ${pct(v.keepChance)} chance to keep spent graces`,
  }),
  'fortune-token': v => ({
    description: `Grace Generator: ${pct(v.graceGainChance)} chance per Set to gain a grace, and refills +1 grace at the start of every wave.`,
    shortDescription: `${pct(v.graceGainChance)} grace/Set + 1 grace each wave`,
  }),
  'life-vessel': v => ({
    description: `Pure HP Tank: +${count(v.maxHealth)} max ${plural(v.maxHealth, 'heart')} in every fight and heals ${count(v.waveHeal)} ${plural(v.waveHeal, 'heart')} at the start of every wave.`,
    shortDescription: `+${count(v.maxHealth)} max ${plural(v.maxHealth, 'heart')}, heal +${count(v.waveHeal)} each wave`,
  }),
  'mending-charm': v => ({
    description: `${pct(v.healingChance)} chance per Set to heal 1 heart. Overhealing at full hearts grants +1 Over-Shield that absorbs your next mistake.`,
    shortDescription: `${pct(v.healingChance)} heal; overheal grants +1 Over-Shield`,
  }),
  'crystal-orb': v => ({
    description: `Active Hint Bank: +${count(v.maxHints)} filled hint ${plural(v.maxHints, 'slot')} at fight start. Spending a hint freezes the clock and foe for ${num(v.freeze)}s.`,
    shortDescription: `+${count(v.maxHints)} ${plural(v.maxHints, 'hint')}; spending a hint freezes ${num(v.freeze)}s`,
  }),
  'seeker-lens': v => ({
    description: `Hint Hoarder: ${pct(v.hintGainChance)} chance per Set to gain a hint. Every unspent hint you hold adds +${num(v.perHint)} damage to every Set.`,
    shortDescription: `${pct(v.hintGainChance)} hint; +${num(v.perHint)} dmg per unspent hint held`,
  }),
  'scholars-tome': v => ({
    description: `Rapid Level-Up Engine: ${pct(v.xpGainChance)} chance per Set for +1 XP and +2 XP every ${WEAPON_CADENCE.SCHOLAR_XP_EVERY}rd Set${v.extraPicks > 0 ? `, plus +${count(v.extraPicks)} extra level-up choice` : ''}.`,
    shortDescription: `${pct(v.xpGainChance)} XP + steady study${v.extraPicks > 0 ? ` (+${count(v.extraPicks)} pick choice)` : ''}`,
  }),
  'fortunes-favor': v => ({
    description: `Shop & Coin Magnate: ${pct(v.coinGainChance)} chance per Set for +1 coin, +2 coins every 3rd Set, and +${pct(v.coinBonus)} coins from all sources.`,
    shortDescription: `${pct(v.coinGainChance)} coin + +${pct(v.coinBonus)} total coins`,
  }),
  'chrono-shard': v => ({
    description: `+${num(v.startingTime)}s on the clock in timed fights and slows the fight clock by ${pct(v.slow)}.`,
    shortDescription: `+${num(v.startingTime)}s clock, ${pct(v.slow)} slower clock`,
  }),
  'time-drop': v => ({
    description: `${pct(v.timeGainChance)} chance per Set to add ${num(v.timeGainAmount)}s to the clock.`,
    shortDescription: `${pct(v.timeGainChance)} chance of +${num(v.timeGainAmount)}s`,
  }),
  'prismatic-ray': v => ({
    description: `${pct(v.laserChance)} chance per Set to fire a laser through a row or column. Each card hit deals ${num(2 + v.laserDamage)} damage.`,
    shortDescription: `${pct(v.laserChance)} laser, ${num(2 + v.laserDamage)} dmg per card`,
  }),
  'chaos-shard': v => ({
    description: `${pct(v.ricochetChance)} chance per Set to ricochet into a random card, ${pct(v.ricochetChainChance)} to keep bouncing. Each hit deals ${num(1 + v.ricochetDamage)} damage.`,
    shortDescription: `${pct(v.ricochetChance)} ricochet, ${num(1 + v.ricochetDamage)} dmg per hit`,
  }),
  'echo-stone': v => ({
    description: `${pct(v.echoChance)} chance per Set to match another Set for you (an echo). Every echo also hits the foe for ${num(v.strike)}.`,
    shortDescription: `${pct(v.echoChance)} echo, +${num(v.strike)} per echo`,
  }),
  'chain-reaction': v => ({
    description: `${pct(v.echoChance)} chance per Set to echo (match another Set for you). ${pct(v.chainReactionChance)} of echoes match 2 Sets, and every echo hits the foe for ${num(v.strike)}.`,
    shortDescription: `${pct(v.echoChance)} echo, ${pct(v.chainReactionChance)} double, +${num(v.strike)} each`,
  }),
  connector: v => ({
    description: `Active Weaver: ${pct(v.connectionChance)} chance per Set to link two matched spots. Linked cards are destroyed together${v.persist > 0 ? ' and persist across waves' : ''}.`,
    shortDescription: `${pct(v.connectionChance)} link/Set${v.persist > 0 ? ' (persists across waves)' : ''}`,
  }),
  'web-weaver': v => ({
    description: `Opening Web: start every wave with ${count(v.startingConnections)} pre-wired ${plural(v.startingConnections, 'link')}. Linked cards are destroyed together.`,
    shortDescription: `+${count(v.startingConnections)} opening wave ${plural(v.startingConnections, 'link')}`,
  }),
  'echo-chamber': v => ({
    description: `Chrono-Link Conduit: start every fight with ${count(v.startingConnections)} ${plural(v.startingConnections, 'link')}, and gain +${num(v.echoTimeBonusPerLink)}s on the clock per linked card destroyed.`,
    shortDescription: `+${count(v.startingConnections)} ${plural(v.startingConnections, 'link')}, +${num(v.echoTimeBonusPerLink)}s per linked card`,
  }),
  'neural-network': v => ({
    description: `Branching Mesh: ${pct(v.connectionChance)} chance per Set to link two spots, and ${pct(v.bonusConnectionChance)} chance every new link forks into an extra linked pair.`,
    shortDescription: `${pct(v.connectionChance)} link, ${pct(v.bonusConnectionChance)} fork chain`,
  }),
  'chaos-conduit': v => ({
    description: `Blast-to-Grace Bridge: ${pct(v.explosionChance)} blast chance; blasts have a ${pct(v.bridgeChance)} chance to grant a grace, and every grace save blasts a 2×2 block.`,
    shortDescription: `${pct(v.explosionChance)} blast; blasts: ${pct(v.bridgeChance)} grace; saves blast 2×2`,
  }),
  'temporal-rift': v => ({
    description: `${pct(v.timeGainChance)} chance per Set to add ${num(v.timeGainAmount)}s. Every time gain: ${pct(v.bridgeChance)} chance to echo (match another Set for you).`,
    shortDescription: `${pct(v.timeGainChance)} +${num(v.timeGainAmount)}s; time gains: ${pct(v.bridgeChance)} echo`,
  }),
  'soul-harvest': v => ({
    description: `${pct(v.ricochetChance)} chance per Set to ricochet into a random card for ${num(1 + v.ricochetDamage)}. Sets that destroy extra cards have a ${pct(v.bridgeChance)} chance to heal 1 heart, and every heal (even at full hearts) hits the foe for ${num(v.strike)}.`,
    shortDescription: `${pct(v.ricochetChance)} ricochet; destroys: ${pct(v.bridgeChance)} heal; heals hit +${num(v.strike)}`,
  }),
  'cascade-core': v => ({
    description: `${pct(v.echoChance)} chance per Set to echo (match another Set for you). Every echo: ${pct(v.bridgeChance)} chance to set a card on fire. Burned cards deal ${num(1 + v.burnDamage)}.`,
    shortDescription: `${pct(v.echoChance)} echo; echoes: ${pct(v.bridgeChance)} fire`,
  }),
  'fortunes-blessing': v => ({
    description: `Gilded Alchemist: each wave gilds 1 card; matching bonus cards pays +3 extra coins (2× gold) with a ${pct(v.bonusHintChance)} chance for a hint. ${pct(v.coinGainChance)} coin chance; coins have ${pct(v.bridgeChance)} hint chance.`,
    shortDescription: `Wave gold card; 2× gold + ${pct(v.bonusHintChance)} hint; coins: ${pct(v.bridgeChance)} hint`,
  }),
  'wisdom-chain': v => ({
    description: `Dividend Loop: +${WISDOM_COIN_PCT}% coins, ${pct(v.xpGainChance)} XP chance (+2 XP every ${WISDOM_XP_EVERY}th Set), XP has ${pct(v.bridgeChance)} coin chance, and wave openers prime ×${num(v.openerMult)} next Set.`,
    shortDescription: `+${WISDOM_COIN_PCT}% coins, XP→${pct(v.bridgeChance)} coin, wave openers ×${num(v.openerMult)}`,
  }),
  'grace-conduit': v => ({
    description: `Defensive Retaliator: +${count(v.graces)} starting ${plural(v.graces, 'grace')}. Every grace save has a ${pct(v.bridgeChance)} chance to fire a laser (${num(2 + v.laserDamage)} dmg per card).`,
    shortDescription: `+${count(v.graces)} ${plural(v.graces, 'grace')}; saves: ${pct(v.bridgeChance)} laser`,
  }),
  'life-link': v => ({
    description: `+${count(v.maxHealth)} max ${plural(v.maxHealth, 'heart')}, 1 mistake shield each wave, and ${pct(v.explosionChance)} blast chance per Set. Every ${LIFE_LINK_PULSE_EVERY}th Set at full hearts deals +${num(v.strike)} and blasts 2 cards. Losing a heart: ${pct(v.bridgeChance)} chance to blast 4 cards.`,
    shortDescription: `+${count(v.maxHealth)} ${plural(v.maxHealth, 'heart')}, wave shield, full-heart pulse +${num(v.strike)}; hurt: ${pct(v.bridgeChance)} blast`,
  }),
};

/** Level → relic trim (WeaponAvatar art). Not a rarity: just how polished it looks. */
const TRIM: readonly WeaponRarity[] = ['common', 'common', 'rare', 'epic', 'legendary', 'legendary'];
export const trimForLevel = (level: number): WeaponRarity => TRIM[clampLevel(level)];

/**
 * A weapon at a build: its numbers, wording and trim. Rule weapons rebuild
 * their rules from the numbers (`build`); plain weapons get their `effects`
 * and bridge chance replaced. Never mutates the weapon tables. `grown` are
 * numbers gained during a fight, added after level and tuning.
 */
export const buildWeapon = (w: Weapon, build: WeaponBuild = BASE_BUILD, grown?: Readonly<Record<string, number>>): Weapon => {
  const baseV = weaponValues(w, build);
  const v = { ...baseV };
  // What the weapon has gained during this fight is added on top of its level and tuning (data/weaponGrowth.ts)
  if (grown) for (const [k, add] of Object.entries(grown)) if (k in v) v[k] = tidy(v[k] + add);
  const level = clampLevel(build.level);
  const a = w as AdventureWeapon;
  if (a.stats && a.build) {
    const built = a.build(v);
    return { ...w, ...built, rarity: trimForLevel(level), rules: built.rules ?? a.rules, modifiers: built.modifiers ?? a.modifiers } as Weapon;
  }
  const effects: Record<string, number> = { ...(w.effects as Record<string, number>) };
  for (const [k, value] of Object.entries(v)) if (k in effects) effects[k] = value;
  if ('maxHealth' in effects && 'health' in w.effects) effects.health = effects.maxHealth;
  // Starting filled hints match clean integer levelled+tuned maxHints (using baseV so mid-fight growth doesn't double-grant)
  if ('maxHints' in effects && 'hints' in w.effects) effects.hints = Math.round(baseV.maxHints);
  const text = STAT_TEXT[w.id]?.(v);
  return {
    ...w,
    ...(text ?? {}),
    ...ADVENTURE_TUNING[w.id]?.rider?.(v),
    rarity: trimForLevel(level),
    effects: effects as Weapon['effects'],
    ...(w.bridgeEffect && v.bridgeChance !== undefined ? { bridgeEffect: { ...w.bridgeEffect, chance: Math.min(95, v.bridgeChance) } } : {}),
  };
};

/** Whether this weapon has text for every number (checked by tests). */
export const hasWeaponText = (id: string): boolean => id in STAT_TEXT;
