/**
 * Arcana — toggleable tarot wildcards that rewrite the rules of a fight.
 *
 * Unlike Camp Workshop upgrades (which only add flat numbers), every Arcana is
 * a qualitative kiss-curse rule twist: you equip at most ONE before a run (or
 * leave the slot empty for standard rules).
 */
import type { ArcanaDef, ArcanaId, ArcanaRules } from '../types';
import { BASE_RULES } from './rules';

const percentMore = (scale: number) => Math.round((scale - 1) * 100);

const monochromePact = { singleTraitBonusDamage: 3, rainbowMultiplier: 1 } satisfies ArcanaRules;
const prismaticFever = { rainbowMultiplier: 3, rainbowTimeBonus: 4, nonRainbowDamageDelta: -1 } satisfies ArcanaRules;
const controlledBurn = { mistakeBurn: { cooldownMs: 12000, cards: 2 }, startingGraces: 0 } satisfies ArcanaRules;
const glassPrism = { specialCardChanceScale: 3, maxHeartsLock: 1 } satisfies ArcanaRules;
const overkillHarvest = { overkillCoinsPerDamage: 2, waveClearHeal: 1, foeHpScale: 1.15 } satisfies ArcanaRules;
const scholarsGambit = { xpScale: 2, pickOptions: 4, maxHeartsDelta: -1 } satisfies ArcanaRules;
const catalystResonance = {
  catalystChanceScale: 2,
  catalystRespawns: 1,
  evolutionBurstBonus: { damage: 8, time: 8 },
  foeHpScale: 1.1,
} satisfies ArcanaRules;
const tempoSurge = {
  damageScale: 1.25,
  setTimeBonus: 2,
  timerSpeedScale: 1.2,
  untimedMoves: { delta: -1, min: 4 },
} satisfies ArcanaRules;

export const ARCANA: ArcanaDef[] = [
  {
    id: 'monochrome_pact',
    rules: monochromePact,
    numeral: 'I',
    name: 'Monochrome Pact',
    icon: 'lorc/stone-block',
    tagline: 'Simple Sets hit like boulders; Rainbows lose their shine.',
    upside: `Sets with only 1 different trait deal +${monochromePact.singleTraitBonusDamage} bonus damage.`,
    tradeoff: `Rainbow Strikes deal ${monochromePact.rainbowMultiplier}× damage instead of ${BASE_RULES.rainbowMultiplier}×.`,
  },
  {
    id: 'prismatic_fever',
    rules: prismaticFever,
    numeral: 'II',
    name: 'Prismatic Fever',
    icon: 'lorc/rainbow-star',
    tagline: 'All-in on Rainbow Strikes.',
    upside: `Rainbow Strikes deal ${prismaticFever.rainbowMultiplier}× damage and restore +${prismaticFever.rainbowTimeBonus}s on timed fights.`,
    tradeoff: `Non-Rainbow Sets deal −${-prismaticFever.nonRainbowDamageDelta} base damage (min 1).`,
  },
  {
    id: 'controlled_burn',
    rules: controlledBurn,
    numeral: 'III',
    name: 'Controlled Burn',
    icon: 'lorc/fire-ring',
    tagline: 'Mistakes spark wildfire instead of costing hearts.',
    upside: `Every ${controlledBurn.mistakeBurn.cooldownMs / 1000}s, a wrong Set ignites ${controlledBurn.mistakeBurn.cards} board cards instead of costing a heart.`,
    tradeoff: `You start each fight with ${controlledBurn.startingGraces} Graces.`,
  },
  {
    id: 'glass_prism',
    rules: glassPrism,
    numeral: 'IV',
    name: 'Glass Prism',
    icon: 'lorc/diamond-hard',
    tagline: 'One fragile heart, flooded with treasure and power.',
    upside: `Power (+${BASE_RULES.powerCardBonus} dmg) and Gold (+${BASE_RULES.coinCardValue}¢) cards appear ${glassPrism.specialCardChanceScale}× as often.`,
    tradeoff: `Your maximum Hearts are locked to ${glassPrism.maxHeartsLock}.`,
  },
  {
    id: 'overkill_harvest',
    rules: overkillHarvest,
    numeral: 'V',
    name: 'Overkill Harvest',
    icon: 'lorc/crown-coin',
    tagline: 'Finishing blows shower the arena in gold.',
    upside: `Every point of overkill damage past 0 HP pays +${overkillHarvest.overkillCoinsPerDamage} coins; wave clears heal +${overkillHarvest.waveClearHeal} Heart.`,
    tradeoff: `Foes enter the arena with +${percentMore(overkillHarvest.foeHpScale)}% HP.`,
  },
  {
    id: 'scholars_gambit',
    rules: scholarsGambit,
    numeral: 'VI',
    name: "Scholar's Gambit",
    icon: 'lorc/open-book',
    tagline: 'Level up twice as fast with wider weapon drafts.',
    upside: `${scholarsGambit.xpScale}× XP gained and ${scholarsGambit.pickOptions} weapon choices per level-up instead of ${BASE_RULES.pickOptions}.`,
    tradeoff: `−${-scholarsGambit.maxHeartsDelta} max Heart (minimum 1).`,
  },
  {
    id: 'catalyst_resonance',
    rules: catalystResonance,
    numeral: 'VII',
    name: 'Catalyst Resonance',
    icon: 'lorc/crystal-wand',
    tagline: 'Attuned to hidden Evolution Catalysts.',
    upside: `Catalysts appear twice as fast, respawn once if lost, and Evolutions burst ${catalystResonance.evolutionBurstBonus.damage} damage + ${catalystResonance.evolutionBurstBonus.time}s.`,
    tradeoff: `Foes enter the arena with +${percentMore(catalystResonance.foeHpScale)}% HP.`,
  },
  {
    id: 'tempo_surge',
    rules: tempoSurge,
    numeral: 'VIII',
    name: 'Tempo Surge',
    icon: 'lorc/hourglass',
    tagline: 'A faster clock that rewards relentless momentum.',
    upside: `Every valid Set deals +${percentMore(tempoSurge.damageScale)}% damage and refunds +${tempoSurge.setTimeBonus}s on timed fights.`,
    tradeoff: `Timed clocks tick ${percentMore(tempoSurge.timerSpeedScale)}% faster (or −${-tempoSurge.untimedMoves.delta} move on move-limited fights, min ${tempoSurge.untimedMoves.min}).`,
  },
];

const NO_RULES: ArcanaRules = {};

export const arcanaRules = (id: ArcanaId | null): ArcanaRules => (id ? getArcana(id).rules : NO_RULES);

export const getArcana = (id: ArcanaId): ArcanaDef => {
  const found = ARCANA.find(a => a.id === id);
  if (!found) throw new Error(`Unknown Arcana: ${id}`);
  return found;
};
