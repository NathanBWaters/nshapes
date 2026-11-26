/**
 * Arcana — tarot wildcards that rewrite the rules of a fight ([GP-15]).
 *
 * Every Arcana is a genuine structural kiss-curse rule twist with ZERO flat
 * `damageScale` padding and ZERO generic `foeHpScale` curses. One slot to
 * start, up to three with the Tarot Deck; equipped Arcana combine through
 * `arcanaRules`.
 */
import type { ArcanaDef, ArcanaId, ArcanaRules } from '../types';
import { BASE_RULES } from './rules';

/**
 * Extended structural Kiss-Curse Arcana flags introduced by [GP-15].
 * Extends `ArcanaRules` directly so every existing caller remains type-safe
 * while `loadout.ts`, `combineArcana`, and the engine read the rich rules.
 */
export interface ExtendedArcanaRules extends ArcanaRules {
  /** Monochrome Pact: Power points added on 1-diff Sets */
  singleTraitPowerBonus?: number;
  /** Monochrome Pact: damage scale applied to 3+ diff Sets */
  highDiffDamageScale?: number;
  /** Controlled Burn: multiplier applied to burn damage from mistake burns */
  mistakeBurnDamageScale?: number;
  /** Controlled Burn: Power points added when mistake burn triggers */
  mistakeBurnPowerBonus?: number;
  /** Controlled Burn: hearts lost on mistakes while burn is on cooldown */
  cooldownMistakeHearts?: number;
  /** Glass Prism: disables all healing while active */
  noHeal?: boolean;
  /** Glass Prism: Power card bonus damage override (+4 = double base +2) */
  powerCardBonusOverride?: number;
  /** Overkill Harvest: normal Sets drop 0 base coins (only Overkill, Gold cards & Parries pay) */
  zeroBaseSetCoins?: boolean;
  /** Overkill Harvest: fraction of overkill damage carried into the next wave */
  overkillCarryPct?: number;
  /** Scholar's Gambit: delta to equipped charm slots (-1 = enter with 1 fewer charm) */
  charmSlotDelta?: number;
  /** Scholar's Gambit: Power points granted on each mid-fight level-up */
  levelUpPowerBonus?: number;
  /** Catalyst Resonance: damage multiplier on Sets made while no Evolution is active */
  nonEvolvedDamageScale?: number;
  /** Tempo Surge: extra Combo steps granted on every valid Set */
  setComboBonus?: number;
}

const percentMore = (scale: number) => Math.round((scale - 1) * 100);

const monochromePact: ExtendedArcanaRules = {
  singleTraitBonusDamage: 8,
  singleTraitPowerBonus: 0.15,
  rainbowMultiplier: 0.5,
  highDiffDamageScale: 0.5,
};
const prismaticFever: ExtendedArcanaRules = {
  rainbowMultiplier: 3.5,
  rainbowTimeBonus: 1.5,
  nonRainbowDamageDelta: -2,
};
const controlledBurn: ExtendedArcanaRules = {
  mistakeBurn: { cooldownMs: 5000, cards: 4 },
  mistakeBurnDamageScale: 1.5,
  mistakeBurnPowerBonus: 0.2,
  startingGraces: 0,
  cooldownMistakeHearts: 2,
};
const glassPrism: ExtendedArcanaRules = {
  specialCardChanceScale: 4,
  powerCardBonusOverride: 4,
  maxHeartsLock: 3,
  noHeal: true,
};
const overkillHarvest: ExtendedArcanaRules = {
  overkillCoinsPerDamage: 3,
  overkillCarryPct: 0.5,
  waveClearHeal: 1,
  zeroBaseSetCoins: true,
};
const scholarsGambit: ExtendedArcanaRules = {
  xpScale: 2,
  pickOptions: 4,
  levelUpPowerBonus: 0.3,
  charmSlotDelta: -1,
};
const catalystResonance: ExtendedArcanaRules = {
  catalystChanceScale: 2.5,
  catalystRespawns: 2,
  evolutionBurstBonus: { damage: 20, time: 6 },
  nonEvolvedDamageScale: 0.75,
};
const tempoSurge: ExtendedArcanaRules = {
  setTimeBonus: 1.5,
  setComboBonus: 1,
  timerSpeedScale: 1.4,
  untimedMoves: { delta: -2, min: 4 },
};

export const ARCANA: ArcanaDef[] = [
  {
    id: 'monochrome_pact',
    rules: monochromePact,
    numeral: 'I',
    name: 'Monochrome Pact',
    icon: 'lorc/stone-block',
    tagline: 'Simple Sets hit like boulders; complex Sets lose their edge.',
    upside: `1-diff Sets deal +${monochromePact.singleTraitBonusDamage} flat damage and add +${monochromePact.singleTraitPowerBonus} Power.`,
    tradeoff: `Rainbows and 3+ diff Sets deal ×${monochromePact.rainbowMultiplier} damage.`,
  },
  {
    id: 'prismatic_fever',
    rules: prismaticFever,
    numeral: 'II',
    name: 'Prismatic Fever',
    icon: 'lorc/rainbow-star',
    tagline: 'All-in on Rainbow Sets.',
    upside: `Rainbow Sets deal ×${prismaticFever.rainbowMultiplier} damage and restore +${prismaticFever.rainbowTimeBonus}s on timed fights.`,
    tradeoff: `Non-Rainbow Sets deal −${-prismaticFever.nonRainbowDamageDelta!} base damage (min 1).`,
  },
  {
    id: 'controlled_burn',
    rules: controlledBurn,
    numeral: 'III',
    name: 'Controlled Burn',
    icon: 'lorc/fire-ring',
    tagline: 'Timed mistakes spark wildfire; reckless misses sear twice as hard.',
    upside: `Every ${controlledBurn.mistakeBurn!.cooldownMs / 1000}s, a wrong Set ignites ${controlledBurn.mistakeBurn!.cards} cards (×${controlledBurn.mistakeBurnDamageScale} burn dmg) and adds +${controlledBurn.mistakeBurnPowerBonus} Power instead of costing a heart.`,
    tradeoff: `Start with ${controlledBurn.startingGraces} Graces, and mistakes while on cooldown cost ${controlledBurn.cooldownMistakeHearts} Hearts.`,
  },
  {
    id: 'glass_prism',
    rules: glassPrism,
    numeral: 'IV',
    name: 'Glass Prism',
    icon: 'lorc/diamond-hard',
    tagline: 'Flood the board with lethal Power and Gold on a razor-thin life bar.',
    upside: `Power (+${glassPrism.powerCardBonusOverride} dmg, doubled) and Gold (+${BASE_RULES.coinCardValue}¢) cards spawn ${glassPrism.specialCardChanceScale}× as often.`,
    tradeoff: `Maximum Hearts are locked to ${glassPrism.maxHeartsLock} and all healing is disabled.`,
  },
  {
    id: 'overkill_harvest',
    rules: overkillHarvest,
    numeral: 'V',
    name: 'Overkill Harvest',
    icon: 'lorc/crown-coin',
    tagline: 'Merciless finishing blows bank gold and spill straight into the next wave.',
    upside: `Overkill pays ${overkillHarvest.overkillCoinsPerDamage}¢/dmg, carries ${Math.round(overkillHarvest.overkillCarryPct! * 100)}% damage into the next wave, and heals +${overkillHarvest.waveClearHeal} Heart on wave clear.`,
    tradeoff: 'Normal Sets drop 0 base coins (only Overkill, Gold cards, and Parries pay coins).',
  },
  {
    id: 'scholars_gambit',
    rules: scholarsGambit,
    numeral: 'VI',
    name: "Scholar's Gambit",
    icon: 'lorc/open-book',
    tagline: 'Travel light and forge your arsenal mid-battle.',
    upside: `${scholarsGambit.xpScale}× XP, ${scholarsGambit.pickOptions} weapon choices per level-up, and +${scholarsGambit.levelUpPowerBonus} Power on every level-up.`,
    tradeoff: `Enter the fight with ${-scholarsGambit.charmSlotDelta!} fewer equipped Charm slot.`,
  },
  {
    id: 'catalyst_resonance',
    rules: catalystResonance,
    numeral: 'VII',
    name: 'Catalyst Resonance',
    icon: 'lorc/crystal-wand',
    tagline: 'Live for Evolutions; starve without them.',
    upside: `${catalystResonance.catalystChanceScale}× Catalyst chance, +${catalystResonance.catalystRespawns} Evolutions/fight, and every Evolution bursts for +${catalystResonance.evolutionBurstBonus!.damage} dmg / +${catalystResonance.evolutionBurstBonus!.time}s.`,
    tradeoff: `Non-evolved Sets deal ×${catalystResonance.nonEvolvedDamageScale} damage.`,
  },
  {
    id: 'tempo_surge',
    rules: tempoSurge,
    numeral: 'VIII',
    name: 'Tempo Surge',
    icon: 'lorc/hourglass',
    tagline: 'A racing clock that feeds relentless streak momentum.',
    upside: `Every valid Set refunds +${tempoSurge.setTimeBonus}s and grants +${tempoSurge.setComboBonus} bonus Combo step.`,
    tradeoff: `Timed clocks tick ${tempoSurge.timerSpeedScale}× faster (${percentMore(tempoSurge.timerSpeedScale!)}% quicker), or −${-tempoSurge.untimedMoves!.delta} moves on untimed fights (min ${tempoSurge.untimedMoves!.min}).`,
  },
];

const NO_RULES: ExtendedArcanaRules = {};

const ADDITIVE = [
  'maxHeartsDelta',
  'nonRainbowDamageDelta',
  'singleTraitBonusDamage',
  'singleTraitPowerBonus',
  'mistakeBurnPowerBonus',
  'levelUpPowerBonus',
  'setTimeBonus',
  'setComboBonus',
  'rainbowTimeBonus',
  'overkillCoinsPerDamage',
  'overkillCarryPct',
  'waveClearHeal',
  'catalystRespawns',
  'charmSlotDelta',
] as const;

const SCALES = [
  'foeHpScale',
  'specialCardChanceScale',
  'damageScale',
  'timerSpeedScale',
  'xpScale',
  'catalystChanceScale',
  'nonEvolvedDamageScale',
  'highDiffDamageScale',
  'mistakeBurnDamageScale',
] as const;

const BOOL_OR = ['noHeal', 'zeroBaseSetCoins'] as const;

const minDefined = (a: number | undefined, b: number | undefined) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));
const maxDefined = (a: number | undefined, b: number | undefined) => (a === undefined ? b : b === undefined ? a : Math.max(a, b));

/**
 * Several equipped Arcana as one rule set: additive fields add, `*Scale`
 * fields multiply, `maxHeartsLock` and `startingGraces` take the lowest,
 * `mistakeBurn` takes the shortest cooldown, `pickOptions` / `powerCardBonusOverride` /
 * `cooldownMistakeHearts` take the highest, booleans OR.
 * Rainbow multipliers combine relative to `BASE_RULES.rainbowMultiplier`.
 */
export const combineArcana = (list: ExtendedArcanaRules[]): ExtendedArcanaRules => {
  if (list.length === 0) return NO_RULES;
  if (list.length === 1) return list[0];
  const out: ExtendedArcanaRules = {};
  const num = out as Record<string, number | undefined>;
  const flags = out as Record<string, boolean | undefined>;
  for (const r of list) {
    const src = r as Record<string, unknown>;
    for (const k of ADDITIVE) if (typeof src[k] === 'number') num[k] = (num[k] ?? 0) + (src[k] as number);
    for (const k of SCALES) if (typeof src[k] === 'number') num[k] = (num[k] ?? 1) * (src[k] as number);
    for (const k of BOOL_OR) if (src[k] === true) flags[k] = true;
    out.maxHeartsLock = minDefined(out.maxHeartsLock, r.maxHeartsLock);
    out.startingGraces = minDefined(out.startingGraces, r.startingGraces);
    out.pickOptions = maxDefined(out.pickOptions, r.pickOptions);
    out.powerCardBonusOverride = maxDefined(out.powerCardBonusOverride, r.powerCardBonusOverride);
    out.cooldownMistakeHearts = maxDefined(out.cooldownMistakeHearts, r.cooldownMistakeHearts);
    if (out.overkillCarryPct !== undefined && out.overkillCarryPct > 1) out.overkillCarryPct = 1;
    if (r.rainbowMultiplier !== undefined) {
      const base = BASE_RULES.rainbowMultiplier;
      out.rainbowMultiplier = (out.rainbowMultiplier ?? base) * (r.rainbowMultiplier / base);
    }
    if (r.mistakeBurn && (!out.mistakeBurn || r.mistakeBurn.cooldownMs < out.mistakeBurn.cooldownMs)) out.mistakeBurn = r.mistakeBurn;
    if (r.untimedMoves) {
      out.untimedMoves = {
        delta: (out.untimedMoves?.delta ?? 0) + r.untimedMoves.delta,
        min: Math.max(out.untimedMoves?.min ?? 0, r.untimedMoves.min),
      };
    }
    if (r.evolutionBurstBonus) {
      out.evolutionBurstBonus = {
        damage: (out.evolutionBurstBonus?.damage ?? 0) + r.evolutionBurstBonus.damage,
        time: (out.evolutionBurstBonus?.time ?? 0) + r.evolutionBurstBonus.time,
      };
    }
  }
  return out;
};

/** The rules of one Arcana, or of several equipped together. */
export const arcanaRules = (ids: ArcanaId | readonly ArcanaId[] | null | undefined): ExtendedArcanaRules => {
  if (!ids) return NO_RULES;
  if (typeof ids === 'string') return getArcana(ids).rules as ExtendedArcanaRules;
  return combineArcana(ids.map(id => getArcana(id).rules as ExtendedArcanaRules));
};

export const getArcana = (id: ArcanaId): ArcanaDef => {
  const found = ARCANA.find(a => a.id === id);
  if (!found) throw new Error(`Unknown Arcana: ${id}`);
  return found;
};
