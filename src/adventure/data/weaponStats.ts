/**
 * A weapon's numbers in Adventure, and the two separate ways to grow them.
 *
 *  - LEVEL (1-5) is found in the world. The first star or bounty reward that
 *    names a weapon unlocks it; every later one is +1 level. Each level adds
 *    the weapon's flat `perLevel` gain to EVERY number it has (Blast Powder:
 *    +6% blast chance and +0.5 damage per blasted card).
 *  - TUNING is bought at the Camp Workshop with coins, one track per number:
 *    ×1.1, ×1.2, ×1.35, ×1.5 on the levelled value. Tuning never raises the
 *    level, and levels never cost coins.
 *
 * Every weapon starts solid at level 1 and gets good through both. There are no
 * rarities in Adventure: `rarity` on a built weapon is only the trim colour of
 * its relic art, and follows its level.
 *
 * Whole-number stats (hearts, graces, board cards, hint slots, links) can end
 * up fractional after tuning. A fight rounds each one by chance: 2.4 extra
 * cards is 2, with a 40% chance of a third (loadout.ts resolveWholeStats).
 */
import type { PlayerStats, Weapon, WeaponRarity } from '@/types';
import type { AdventureWeapon } from '../types';
import { ADVENTURE_TUNING, MYSTIC_EVERY, ORACLE_PATIENCE_MS } from './weaponTuning';

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

type Unit = '%' | 's' | 'count' | 'dmg' | '×';

/** One number of a weapon (a stat for plain weapons, a rule parameter for rule weapons). */
export interface WeaponStatDef {
  label: string;
  unit: Unit;
  base: number;
  perLevel: number;
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

/** Stats a fight resolves to whole numbers by chance. */
export const WHOLE_STATS = ['fieldSize', 'graces', 'maxHealth', 'health', 'maxHints', 'startingConnections'] as const;

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

/** `health` rides along with `maxHealth`; `luck` and timing knobs are not weapon numbers. */
const HIDDEN_STATS = new Set(['health', 'luck', 'autoHintInterval']);

/** The numbers of a weapon and how each one levels. */
export const weaponStatDefs = (w: Weapon): Record<string, WeaponStatDef> => {
  const rule = (w as AdventureWeapon).stats;
  if (rule) return rule;
  const defs: Record<string, WeaponStatDef> = {};
  const per = (w.perLevel ?? {}) as Record<string, number | undefined>;
  for (const [key, v] of Object.entries(w.effects)) {
    if (typeof v !== 'number' || HIDDEN_STATS.has(key)) continue;
    const meta = STAT_META[key as keyof PlayerStats] ?? { label: key, unit: '%' as const };
    defs[key] = { ...meta, base: v, perLevel: per[key] ?? 0 };
  }
  if (w.bridgeEffect) defs.bridgeChance = { ...STAT_META.bridgeChance!, base: w.bridgeEffect.chance, perLevel: per.bridgeChance ?? 0 };
  return { ...defs, ...ADVENTURE_TUNING[w.id]?.extra };
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
    const levelled = tidy(def.base + def.perLevel * (level - 1));
    const multiplier = TUNING_MULTIPLIERS[tier];
    return { ...def, key, tunable, levelled, tier, multiplier, value: tidy(levelled * multiplier) };
  });
};

/** Numbers by key at a build. */
export const weaponValues = (w: Weapon, build: WeaponBuild = BASE_BUILD): Record<string, number> =>
  Object.fromEntries(weaponStatLines(w, build).map(l => [l.key, l.value]));

// ─── Wording ────────────────────────────────────────────────────────────────

const num = (n: number) => String(tidy(Math.round(n * 10) / 10));
const pct = (n: number) => `${num(n)}%`;
/** "2" or, when a fight rounds it by chance, "2-3" */
export const count = (n: number) => (Number.isInteger(tidy(n)) ? String(tidy(n)) : `${Math.floor(n)}-${Math.ceil(n)}`);
const plural = (n: number, word: string) => `${word}${tidy(n) === 1 ? '' : 's'}`;

/** A stat line's value as shown in the Workshop ("36%", "+1.5", "2.4") */
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
    description: `${pct(v.autoHintChance)} chance to point out a card of a Set when you go quiet. Sets made ${ORACLE_PATIENCE_MS / 1000}s or more after the last deal +${num(v.patience)}.`,
    shortDescription: `${pct(v.autoHintChance)} auto-hint, slow Sets +${num(v.patience)}`,
  }),
  'mystic-sight': v => ({
    description: `Every ${MYSTIC_EVERY}rd Set hits the foe for ${num(v.third)} more. ${pct(v.autoHintChance)} auto-hint chance, and ${pct(v.enhancedHintChance)} of auto-hints point out 2 cards.`,
    shortDescription: `Every ${MYSTIC_EVERY}rd Set +${num(v.third)}, 2-card hints`,
  }),
  'field-stone': v => ({
    description: `Every fight starts with ${count(v.fieldSize)} extra ${plural(v.fieldSize, 'card')}. Every card on a wave's opening board deals +${Math.max(1, Math.round(v.charge))} when matched.`,
    shortDescription: `+${count(v.fieldSize)} cards, opening board +${Math.max(1, Math.round(v.charge))}`,
  }),
  'growth-seed': v => ({
    description: `${pct(v.boardGrowthChance)} chance per Set to add a card to the board. Each time it does, every card on the board deals +1 more when matched.`,
    shortDescription: `${pct(v.boardGrowthChance)} growth, board +1 each time`,
  }),
  'flint-spark': v => ({
    description: `${pct(v.fireSpreadChance)} chance per Set to set the cards next to it on fire. Each burned card deals ${num(1 + v.burnDamage)} damage.`,
    shortDescription: `${pct(v.fireSpreadChance)} fire, ${num(1 + v.burnDamage)} dmg per card`,
  }),
  'second-chance': v => ({
    description: `Start every fight with ${count(v.graces)} extra ${plural(v.graces, 'grace')}. Every grace save hits the foe for ${num(v.strike)}.`,
    shortDescription: `+${count(v.graces)} ${plural(v.graces, 'grace')}, saves hit for ${num(v.strike)}`,
  }),
  'fortune-token': v => ({
    description: `${pct(v.graceGainChance)} chance per Set to gain a grace and hit the foe for ${num(v.strike)}.`,
    shortDescription: `${pct(v.graceGainChance)} grace + ${num(v.strike)} dmg`,
  }),
  'life-vessel': v => ({
    description: `+${count(v.maxHealth)} max ${plural(v.maxHealth, 'heart')} in every fight. While at full hearts, every Set deals +${num(v.vigor)}.`,
    shortDescription: `+${count(v.maxHealth)} ${plural(v.maxHealth, 'heart')}, full hearts +${num(v.vigor)}`,
  }),
  'mending-charm': v => ({
    description: `${pct(v.healingChance)} chance per Set to heal 1 heart. While at full hearts, it also hits the foe for ${num(v.overheal)}.`,
    shortDescription: `${pct(v.healingChance)} heal, overheal hits for ${num(v.overheal)}`,
  }),
  'crystal-orb': v => ({
    description: `+${count(v.maxHints)} hint ${plural(v.maxHints, 'slot')}, filled when the fight starts. Every hint you use hits the foe for ${num(v.strike)}.`,
    shortDescription: `+${count(v.maxHints)} ${plural(v.maxHints, 'hint')}, each use hits for ${num(v.strike)}`,
  }),
  'seeker-lens': v => ({
    description: `${pct(v.hintGainChance)} chance per Set to gain a hint and hit the foe for ${num(v.strike)}.`,
    shortDescription: `${pct(v.hintGainChance)} hint + ${num(v.strike)} dmg`,
  }),
  'scholars-tome': v => ({
    description: `${pct(v.xpGainChance)} chance per Set to gain +1 XP and hit the foe for ${num(v.strike)}.`,
    shortDescription: `${pct(v.xpGainChance)} bonus XP + ${num(v.strike)} dmg`,
  }),
  'fortunes-favor': v => ({
    description: `${pct(v.coinGainChance)} chance per Set to gain +1 coin and hit the foe for ${num(v.strike)}.`,
    shortDescription: `${pct(v.coinGainChance)} bonus coin + ${num(v.strike)} dmg`,
  }),
  'chrono-shard': v => ({
    description: `+${num(v.startingTime)}s on the clock in timed fights.`,
    shortDescription: `+${num(v.startingTime)}s clock`,
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
    description: `${pct(v.connectionChance)} chance per Set to link two of its spots. Linked cards are destroyed together.`,
    shortDescription: `${pct(v.connectionChance)} link per Set`,
  }),
  'web-weaver': v => ({
    description: `Start every fight with ${count(v.startingConnections)} ${plural(v.startingConnections, 'link')} already placed. Linked cards are destroyed together.`,
    shortDescription: `+${count(v.startingConnections)} starting links`,
  }),
  'echo-chamber': v => ({
    description: `Start every fight with ${count(v.startingConnections)} ${plural(v.startingConnections, 'link')}. +${num(v.echoTimeBonusPerLink)}s on the clock for every card destroyed through a link.`,
    shortDescription: `+${count(v.startingConnections)} ${plural(v.startingConnections, 'link')}, +${num(v.echoTimeBonusPerLink)}s per linked card`,
  }),
  'neural-network': v => ({
    description: `${pct(v.connectionChance)} chance per Set to link two of its spots, and ${pct(v.bonusConnectionChance)} chance that a new link makes a second one.`,
    shortDescription: `${pct(v.connectionChance)} link, ${pct(v.bonusConnectionChance)} bonus link`,
  }),
  'chaos-conduit': v => ({
    description: `${pct(v.explosionChance)} chance per Set to blast the cards next to it. Every explosion: ${pct(v.bridgeChance)} chance to gain a grace.`,
    shortDescription: `${pct(v.explosionChance)} blast; blasts: ${pct(v.bridgeChance)} grace`,
  }),
  'temporal-rift': v => ({
    description: `${pct(v.timeGainChance)} chance per Set to add ${num(v.timeGainAmount)}s. Every time gain: ${pct(v.bridgeChance)} chance to echo (match another Set for you).`,
    shortDescription: `${pct(v.timeGainChance)} +${num(v.timeGainAmount)}s; time gains: ${pct(v.bridgeChance)} echo`,
  }),
  'soul-harvest': v => ({
    description: `${pct(v.ricochetChance)} chance per Set to ricochet into a random card for ${num(1 + v.ricochetDamage)}. Every card you destroy: ${pct(v.bridgeChance)} chance to heal 1 heart.`,
    shortDescription: `${pct(v.ricochetChance)} ricochet; destroyed cards: ${pct(v.bridgeChance)} heal`,
  }),
  'cascade-core': v => ({
    description: `${pct(v.echoChance)} chance per Set to echo (match another Set for you). Every echo: ${pct(v.bridgeChance)} chance to set a card on fire. Burned cards deal ${num(1 + v.burnDamage)}.`,
    shortDescription: `${pct(v.echoChance)} echo; echoes: ${pct(v.bridgeChance)} fire`,
  }),
  'fortunes-blessing': v => ({
    description: `${pct(v.coinGainChance)} chance per Set to gain +1 coin and hit the foe for ${num(v.strike)}. Every coin you gain: ${pct(v.bridgeChance)} chance to gain a hint.`,
    shortDescription: `${pct(v.coinGainChance)} coin + ${num(v.strike)} dmg; coins: ${pct(v.bridgeChance)} hint`,
  }),
  'wisdom-chain': v => ({
    description: `${pct(v.xpGainChance)} chance per Set to gain +1 XP and hit the foe for ${num(v.strike)}. Every XP you gain: ${pct(v.bridgeChance)} chance to gain a coin.`,
    shortDescription: `${pct(v.xpGainChance)} XP + ${num(v.strike)} dmg; XP: ${pct(v.bridgeChance)} coin`,
  }),
  'grace-conduit': v => ({
    description: `Start every fight with ${count(v.graces)} extra ${plural(v.graces, 'grace')}. Every grace used: ${pct(v.bridgeChance)} chance to fire a laser (${num(2 + v.laserDamage)} per card).`,
    shortDescription: `+${count(v.graces)} ${plural(v.graces, 'grace')}; graces: ${pct(v.bridgeChance)} laser`,
  }),
  'life-link': v => ({
    description: `+${count(v.maxHealth)} max ${plural(v.maxHealth, 'heart')} and a ${pct(v.explosionChance)} chance per Set to blast the cards next to it. Every heart you lose: ${pct(v.bridgeChance)} chance to blast 4 cards.`,
    shortDescription: `+${count(v.maxHealth)} heart; lost hearts: ${pct(v.bridgeChance)} blast`,
  }),
};

/** Level → relic trim (WeaponAvatar art). Not a rarity: just how polished it looks. */
const TRIM: readonly WeaponRarity[] = ['common', 'common', 'rare', 'epic', 'legendary', 'legendary'];
export const trimForLevel = (level: number): WeaponRarity => TRIM[clampLevel(level)];

/**
 * A weapon at a build: its numbers, wording and trim. Rule weapons rebuild
 * their rules from the numbers (`build`); plain weapons get their `effects`
 * and bridge chance replaced. Never mutates the weapon tables.
 */
export const buildWeapon = (w: Weapon, build: WeaponBuild = BASE_BUILD): Weapon => {
  const v = weaponValues(w, build);
  const level = clampLevel(build.level);
  const a = w as AdventureWeapon;
  if (a.stats && a.build) {
    const built = a.build(v);
    return { ...w, ...built, rarity: trimForLevel(level), rules: built.rules ?? a.rules, modifiers: built.modifiers ?? a.modifiers } as Weapon;
  }
  const effects: Record<string, number> = { ...(w.effects as Record<string, number>) };
  for (const [k, value] of Object.entries(v)) if (k in effects) effects[k] = value;
  if ('maxHealth' in effects && 'health' in w.effects) effects.health = effects.maxHealth;
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
