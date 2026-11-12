/**
 * Adventure-only weapons. Each one is a plain Weapon (so the Armory, shop,
 * picks and inventory treat it like any other) whose behaviour lives in its
 * rules and modifiers (rules/types.ts). `effects` stays empty: nothing here
 * touches PlayerStats.
 *
 * Every weapon is one item. Its numbers are `stats`: levels (found as star and
 * bounty rewards) add `perLevel`, Workshop tuning multiplies the result, and
 * `build` turns the numbers into rules and wording (data/weaponStats.ts).
 */
import type { AdventureWeapon } from '../types';
import type { Rule } from '../rules/types';

const r = Math.round;

const clarity = (pct: number, ms: number): Rule[] => [
  { trigger: { on: 'setsWithin', count: 3, withinMs: 10000 }, when: [{ kind: 'chance', pct }], effects: [{ do: 'simplify', ms }], callout: 'Clarity!' },
];
const warDrum = (withinMs: number, amount: number): Rule[] => [
  { trigger: { on: 'setsWithin', count: 5, withinMs }, effects: [{ do: 'empowerBoard', amount }], callout: 'War Drum!' },
];
const amplifier = (pct: number): Rule[] => [
  { trigger: { on: 'set' }, when: [{ kind: 'chance', pct }], effects: [{ do: 'doubleNext' }], callout: 'Amplified!' },
];
const pinata = (pct: number, bounty: number): Rule[] => [
  { trigger: { on: 'set' }, when: [{ kind: 'chance', pct }], effects: [{ do: 'armorCard', extraHealth: 2, bounty }], callout: 'Piñata!' },
];
const rallyHorn = (amount: number): Rule[] => [
  { trigger: { on: 'firstSetOfWave' }, effects: [{ do: 'damage', amount }], callout: 'Rally!' },
];
const revenge = (pct: number): Rule[] =>
  [0, 1, 2].map(() => ({ trigger: { on: 'hurt' }, when: [{ kind: 'chance', pct }], effects: [{ do: 'link', count: 1 }], callout: 'Revenge!' }) as Rule);

export const ADVENTURE_WEAPONS: AdventureWeapon[] = [
  // ── Clarity Lens (utility): fast play makes the board easier ──────────────
  {
    id: 'clarity-lens',
    name: 'Clarity Lens',
    rarity: 'common',
    level: 1,
    price: 9,
    description: '',
    shortDescription: '',
    flavorText: 'Squint through it and half the noise just... goes away.',
    icon: 'lorc/magnifying-glass',
    specialEffect: 'enhancedHint',
    effects: {},
    maxCount: 1,
    stats: {
      chance: { label: 'Simplify chance', unit: '%', base: 33, perLevel: 9 },
      seconds: { label: 'Simplify seconds', unit: 's', base: 15, perLevel: 2 },
    },
    build: v => ({
      rules: clarity(r(v.chance), r(v.seconds * 1000)),
      description: `3 Sets within 10s: ${r(v.chance)}% chance to simplify the board for ${r(v.seconds)}s. One trait becomes the same on every card.`,
      shortDescription: `3 quick Sets: ${r(v.chance)}% simplify`,
    }),
  },

  // ── War Drum (offense): keep the beat and the whole board gets heavier ─────
  {
    id: 'war-drum',
    name: 'War Drum',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'BOOM. BOOM. BOOM. Every card on the table stands up straighter.',
    icon: 'delapouite/drum',
    specialEffect: 'bridge',
    effects: {},
    maxCount: 1,
    stats: {
      window: { label: 'Seconds for 5 Sets', unit: 's', base: 20, perLevel: 2 },
      power: { label: 'Power per card', unit: 'dmg', base: 2, perLevel: 0.5 },
    },
    build: v => ({
      rules: warDrum(r(v.window * 1000), r(v.power)),
      description: `5 Sets within ${r(v.window)}s: every card on the board deals +${r(v.power)} more when matched.`,
      shortDescription: `5 Sets in ${r(v.window)}s: board +${r(v.power)} damage`,
    }),
  },

  // ── Amplifier Coil (combo): sometimes the next weapon fires twice ─────────
  {
    id: 'amplifier-coil',
    name: 'Amplifier Coil',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Whatever goes in comes out twice as loud.',
    icon: 'lorc/tesla-coil',
    specialEffect: 'chainReaction',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Amplify chance', unit: '%', base: 20, perLevel: 6 } },
    build: v => ({
      rules: amplifier(r(v.chance)),
      description: `Each Set: ${r(v.chance)}% chance that the next weapon trigger (blast, heal, laser, fire...) happens twice.`,
      shortDescription: `${r(v.chance)}% next trigger ×2`,
    }),
  },

  // ── Piñata (offense): armor a card, then smash it for a bounty ────────────
  {
    id: 'pinata',
    name: 'Piñata',
    rarity: 'common',
    level: 1,
    price: 9,
    description: '',
    shortDescription: '',
    flavorText: 'Whack it. Whack it again. CANDY! (The candy is damage.)',
    icon: 'delapouite/pinata',
    specialEffect: 'bridge',
    effects: {},
    maxCount: 1,
    stats: {
      chance: { label: 'Piñata chance', unit: '%', base: 20, perLevel: 6 },
      bounty: { label: 'Piñata damage', unit: 'dmg', base: 10, perLevel: 3 },
    },
    build: v => ({
      rules: pinata(r(v.chance), r(v.bounty)),
      description: `Each Set has a ${r(v.chance)}% chance to give a random card +2 hits. Breaking that card deals +${r(v.bounty)} damage.`,
      shortDescription: `Sets may hang a +${r(v.bounty)} piñata`,
    }),
  },

  // ── Catalyst Prism (evolution): Catalysts show up far more often ──────────
  {
    id: 'catalyst-prism',
    name: 'Catalyst Prism',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Light bends through it and lands on exactly the card you need.',
    icon: 'delapouite/prism',
    effects: {},
    maxCount: 1,
    stats: {
      likelihood: { label: 'Catalyst chance', unit: '%', base: 6, perLevel: 3 },
      rainbow: { label: 'Extra after a Rainbow', unit: '%', base: 25, perLevel: 3 },
    },
    build: v => ({
      modifiers: { evolutionLikelihood: r(v.likelihood), rainbowEvolutionLikelihood: r(v.rainbow) },
      description: `+${r(v.likelihood)}% evolution likelihood on every refill, and +${r(v.rainbow)}% more on refills after a Rainbow Strike.`,
      shortDescription: `+${r(v.likelihood)}% Catalysts, more on Rainbows`,
    }),
  },

  // ── Rally Horn (offense): open every wave with a haymaker ─────────────────
  {
    id: 'rally-horn',
    name: 'Rally Horn',
    rarity: 'common',
    level: 1,
    price: 8,
    description: '',
    shortDescription: '',
    flavorText: 'One blast and the whole meadow knows the fight has started.',
    icon: 'lorc/hunting-horn',
    specialEffect: 'bridge',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Opening damage', unit: 'dmg', base: 6, perLevel: 3 } },
    build: v => ({
      rules: rallyHorn(r(v.damage)),
      description: `The first Set of each wave deals +${r(v.damage)} damage.`,
      shortDescription: `First Set each wave +${r(v.damage)}`,
    }),
  },

  // ── Revenge Linker (Adventure version): getting hurt wires up the board ───
  {
    id: 'revenge-linker',
    name: 'Revenge Linker',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Every scratch you take is another thread in the web.',
    icon: 'lorc/linked-rings',
    specialEffect: 'revengeLinker',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Link chance per roll', unit: '%', base: 20, perLevel: 5 } },
    build: v => ({
      rules: revenge(r(v.chance)),
      description: `Losing a heart: 3 rolls at ${r(v.chance)}% each to link a pair of cards. Linked cards are destroyed together.`,
      shortDescription: `Lost hearts: 3× ${r(v.chance)}% link`,
    }),
  },
];

// Authored descriptions are the level-1 wording (Free Play, tests, guides)
for (const w of ADVENTURE_WEAPONS) {
  if (!w.stats || !w.build) continue;
  const built = w.build(Object.fromEntries(Object.entries(w.stats).map(([k, d]) => [k, d.base])));
  w.description = built.description;
  w.shortDescription = built.shortDescription;
  if (built.rules) w.rules = built.rules;
  if (built.modifiers) w.modifiers = built.modifiers;
}

/**
 * Ids of the old common/rare copies. Each rare copy is now a level of its one
 * weapon, so an old save holding it gets that upgrade tier (save migration).
 */
export const LEGACY_ADVENTURE_WEAPON_IDS: Record<string, { id: string; tier: number }> = Object.fromEntries(
  ADVENTURE_WEAPONS.filter(w => w.id !== 'revenge-linker').flatMap(w => [
    [`${w.id}-common`, { id: w.id, tier: 0 }],
    [`${w.id}-rare`, { id: w.id, tier: 1 }],
  ])
);
