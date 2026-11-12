/**
 * Adventure-only weapons. Each one is a plain Weapon (so the Armory, shop,
 * picks and inventory treat it like any other) whose behaviour lives in its
 * rules and modifiers (rules/types.ts). `effects` stays empty: nothing here
 * touches PlayerStats.
 *
 * Every weapon is one item that grows through levels 2-4 (`levels`): Workshop
 * tiers and free upgrades from star and bounty rewards (data/armory.ts).
 */
import type { AdventureWeapon } from '../types';
import type { Rule } from '../rules/types';

const clarity = (pct: number, ms: number): Rule[] => [
  { trigger: { on: 'setsWithin', count: 3, withinMs: 10000 }, when: [{ kind: 'chance', pct }], effects: [{ do: 'simplify', ms }], callout: 'Clarity!' },
];
const warDrum = (count: number, amount: number): Rule[] => [
  { trigger: { on: 'setsWithin', count, withinMs: 20000 }, effects: [{ do: 'empowerBoard', amount }], callout: 'War Drum!' },
];
const amplifier = (n: number): Rule => ({ trigger: { on: 'everyNthSet', n }, effects: [{ do: 'doubleNext' }], callout: 'Amplified!' });
const amplifiedRainbow: Rule = { trigger: { on: 'rainbow' }, effects: [{ do: 'doubleNext' }], callout: 'Amplified!' };
const pinata = (pct: number, bounty: number): Rule[] => [
  { trigger: { on: 'set' }, when: [{ kind: 'chance', pct }], effects: [{ do: 'armorCard', extraHealth: 2, bounty }], callout: 'Piñata!' },
];
const rallyHorn = (amount: number): Rule[] => [
  { trigger: { on: 'firstSetOfWave' }, effects: [{ do: 'damage', amount }], callout: 'Rally!' },
];

export const ADVENTURE_WEAPONS: AdventureWeapon[] = [
  // ── Clarity Lens (utility): fast play makes the board easier ──────────────
  {
    id: 'clarity-lens',
    name: 'Clarity Lens',
    rarity: 'common',
    level: 1,
    price: 9,
    description: '3 Sets within 10s: 33% chance to simplify the board for 15s. One trait becomes the same on every card.',
    shortDescription: '3 quick Sets may simplify the board',
    flavorText: 'Squint through it and half the noise just... goes away.',
    icon: 'lorc/magnifying-glass',
    specialEffect: 'enhancedHint',
    effects: {},
    maxCount: 1,
    rules: clarity(33, 15000),
    levels: [
      { rules: clarity(50, 15000), text: '50% chance' },
      { rules: clarity(60, 17000), text: '60% chance, 17s' },
      { rules: clarity(70, 20000), text: '70% chance, 20s' },
    ],
  },

  // ── War Drum (offense): keep the beat and the whole board gets heavier ─────
  {
    id: 'war-drum',
    name: 'War Drum',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '5 Sets within 20s: every card on the board gains +2 power (+2 damage when matched).',
    shortDescription: '5 Sets in 20s: board +2 power',
    flavorText: 'BOOM. BOOM. BOOM. Every card on the table stands up straighter.',
    icon: 'delapouite/drum',
    specialEffect: 'bridge',
    effects: {},
    maxCount: 1,
    rules: warDrum(5, 2),
    levels: [
      { rules: warDrum(4, 2), text: 'only 4 Sets' },
      { rules: warDrum(4, 3), text: '4 Sets, board +3 power' },
      { rules: warDrum(4, 4), text: '4 Sets, board +4 power' },
    ],
  },

  // ── Amplifier Coil (combo): every few Sets, the next weapon fires twice ────
  {
    id: 'amplifier-coil',
    name: 'Amplifier Coil',
    rarity: 'common',
    level: 1,
    price: 10,
    description: 'Every 4th Set: the next weapon trigger (blast, heal, laser, fire...) happens twice.',
    shortDescription: 'Every 4th Set: next trigger ×2',
    flavorText: 'Whatever goes in comes out twice as loud.',
    icon: 'lorc/tesla-coil',
    specialEffect: 'chainReaction',
    effects: {},
    maxCount: 1,
    rules: [amplifier(4)],
    levels: [
      { rules: [amplifier(3)], text: 'every 3rd Set' },
      { rules: [amplifier(3), amplifiedRainbow], text: 'every 3rd Set and every Rainbow' },
      { rules: [amplifier(2), amplifiedRainbow], text: 'every 2nd Set and every Rainbow' },
    ],
  },

  // ── Piñata (offense): armor a card, then smash it for a bounty ────────────
  {
    id: 'pinata',
    name: 'Piñata',
    rarity: 'common',
    level: 1,
    price: 9,
    description: 'Each Set has a 20% chance to give a random card +2 hits. Breaking that card deals +10 damage.',
    shortDescription: 'Sets may hang a +10 piñata',
    flavorText: 'Whack it. Whack it again. CANDY! (The candy is damage.)',
    icon: 'delapouite/pinata',
    specialEffect: 'bridge',
    effects: {},
    maxCount: 1,
    rules: pinata(20, 10),
    levels: [
      { rules: pinata(35, 10), text: '35% chance' },
      { rules: pinata(40, 14), text: '40% chance, +14 damage' },
      { rules: pinata(50, 18), text: '50% chance, +18 damage' },
    ],
  },

  // ── Catalyst Prism (evolution): Catalysts show up far more often ──────────
  {
    id: 'catalyst-prism',
    name: 'Catalyst Prism',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '+6% evolution likelihood on every refill, and +25% more on refills after a Rainbow Strike.',
    shortDescription: '+6% Catalysts, more on Rainbows',
    flavorText: 'Light bends through it and lands on exactly the card you need.',
    icon: 'delapouite/prism',
    effects: {},
    maxCount: 1,
    modifiers: { evolutionLikelihood: 6, rainbowEvolutionLikelihood: 25 },
    levels: [
      { modifiers: { evolutionLikelihood: 10, rainbowEvolutionLikelihood: 25 }, text: '+10% Catalysts' },
      { modifiers: { evolutionLikelihood: 14, rainbowEvolutionLikelihood: 30 }, text: '+14% Catalysts, +30% on Rainbows' },
      { modifiers: { evolutionLikelihood: 18, rainbowEvolutionLikelihood: 35 }, text: '+18% Catalysts, +35% on Rainbows' },
    ],
  },

  // ── Rally Horn (offense): open every wave with a haymaker ─────────────────
  {
    id: 'rally-horn',
    name: 'Rally Horn',
    rarity: 'common',
    level: 1,
    price: 8,
    description: 'The first Set of each wave deals +6 damage.',
    shortDescription: 'First Set each wave +6',
    flavorText: 'One blast and the whole meadow knows the fight has started.',
    icon: 'lorc/hunting-horn',
    specialEffect: 'bridge',
    effects: {},
    maxCount: 1,
    rules: rallyHorn(6),
    levels: [
      { rules: rallyHorn(10), text: '+10 damage' },
      { rules: rallyHorn(14), text: '+14 damage' },
      { rules: rallyHorn(18), text: '+18 damage' },
    ],
  },
];

/**
 * Ids of the old common/rare copies. Each rare copy is now a level of its one
 * weapon, so an old save holding it gets that upgrade tier (save migration).
 */
export const LEGACY_ADVENTURE_WEAPON_IDS: Record<string, { id: string; tier: number }> = Object.fromEntries(
  ADVENTURE_WEAPONS.flatMap(w => [
    [`${w.id}-common`, { id: w.id, tier: 0 }],
    [`${w.id}-rare`, { id: w.id, tier: 1 }],
  ])
);
