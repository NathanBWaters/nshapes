/**
 * Arcana — toggleable tarot wildcards that rewrite the rules of a fight.
 *
 * Unlike Camp Workshop upgrades (which only add flat numbers), every Arcana is
 * a qualitative kiss-curse rule twist: you equip at most ONE before a run (or
 * leave the slot empty for standard rules).
 */
import type { ArcanaDef, ArcanaId } from '../types';

export const ARCANA: ArcanaDef[] = [
  {
    id: 'monochrome_pact',
    numeral: 'I',
    name: 'Monochrome Pact',
    icon: 'lorc/stone-block',
    tagline: 'Simple Sets hit like boulders; Rainbows lose their shine.',
    upside: 'Sets with only 1 different trait deal +3 bonus damage.',
    tradeoff: 'Rainbow Strikes deal 1× damage instead of 2×.',
    unlockHint: 'Earn ★★★ on 1-8 Shell Shock',
  },
  {
    id: 'prismatic_fever',
    numeral: 'II',
    name: 'Prismatic Fever',
    icon: 'lorc/rainbow-star',
    tagline: 'All-in on Rainbow Strikes.',
    upside: 'Rainbow Strikes deal 3× damage and restore +4s on timed fights.',
    tradeoff: 'Non-Rainbow Sets deal −1 base damage (min 1).',
    unlockHint: 'Complete the Spectrum Seeker bounty',
  },
  {
    id: 'controlled_burn',
    numeral: 'III',
    name: 'Controlled Burn',
    icon: 'lorc/fire-ring',
    tagline: 'Mistakes spark wildfire instead of costing hearts.',
    upside: 'Every 12s, a wrong Set ignites 2 board cards instead of costing a heart.',
    tradeoff: 'You start each fight with 0 Graces.',
    unlockHint: 'Earn ★★★ on 2-8 The Web',
  },
  {
    id: 'glass_prism',
    numeral: 'IV',
    name: 'Glass Prism',
    icon: 'lorc/diamond-hard',
    tagline: 'One fragile heart, flooded with treasure and power.',
    upside: 'Power (+2 dmg) and Gold (+3¢) cards appear 3× as often.',
    tradeoff: 'Your maximum Hearts are locked to 1.',
    unlockHint: 'Complete the Untouchable bounty',
  },
  {
    id: 'overkill_harvest',
    numeral: 'V',
    name: 'Overkill Harvest',
    icon: 'lorc/crown-coin',
    tagline: 'Finishing blows shower the arena in gold.',
    upside: 'Every point of overkill damage past 0 HP pays +2 coins; wave clears heal +1 Heart.',
    tradeoff: 'Foes enter the arena with +15% HP.',
    unlockHint: "Earn ★ on 1-5E Hoarder's Den",
  },
  {
    id: 'scholars_gambit',
    numeral: 'VI',
    name: "Scholar's Gambit",
    icon: 'lorc/open-book',
    tagline: 'Level up twice as fast with wider weapon drafts.',
    upside: '2× XP gained and 4 weapon choices per level-up instead of 3.',
    tradeoff: '−1 max Heart (minimum 1).',
    unlockHint: 'Earn ★★★ on 2-5 Level Up!',
  },
  {
    id: 'catalyst_resonance',
    numeral: 'VII',
    name: 'Catalyst Resonance',
    icon: 'lorc/crystal-wand',
    tagline: 'Attuned to hidden Evolution Catalysts.',
    upside: 'Catalysts appear twice as fast, respawn once if lost, and Evolutions burst 8 damage + 8s.',
    tradeoff: 'Foes enter the arena with +10% HP.',
    unlockHint: 'Complete the Relic Alchemist bounty',
  },
  {
    id: 'tempo_surge',
    numeral: 'VIII',
    name: 'Tempo Surge',
    icon: 'lorc/hourglass',
    tagline: 'A faster clock that rewards relentless momentum.',
    upside: 'Every valid Set deals +25% damage and refunds +2s on timed fights.',
    tradeoff: 'Timed clocks tick 20% faster (or −1 move on move-limited fights, min 4).',
    unlockHint: 'Earn ★★★ on 3-8 Stampede',
  },
];

export const getArcana = (id: ArcanaId): ArcanaDef => {
  const found = ARCANA.find(a => a.id === id);
  if (!found) throw new Error(`Unknown Arcana: ${id}`);
  return found;
};
