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
import { TRICK_RULES } from './rules';

const T = TRICK_RULES;
const FOG_MS = TRICK_RULES.fogMs;
const BOUNTY_CARDS = TRICK_RULES.bountyCards;

const r = Math.round;
const num = (n: number) => String(Math.round(n * 10) / 10);

/** Clarity Lens fires on every Nth Set */
const CLARITY_EVERY = 5;
/** War Drum counts this many Sets inside its window */
const DRUM_SETS = 3;
/** Rally Horn sounds again on every Nth Set */
const RALLY_EVERY = 4;

const clarity = (ms: number, amount: number): Rule[] => [
  { trigger: { on: 'everyNthSet', n: CLARITY_EVERY }, effects: [{ do: 'simplify', ms }, { do: 'damage', amount }], callout: 'Clarity!' },
];
const warDrum = (withinMs: number, amount: number): Rule[] => [
  { trigger: { on: 'setsWithin', count: DRUM_SETS, withinMs }, effects: [{ do: 'empowerBoard', amount }], callout: 'War Drum!' },
];
const amplifier = (pct: number, amount: number): Rule[] => [
  { trigger: { on: 'set' }, when: [{ kind: 'chance', pct }], effects: [{ do: 'damage', amount }, { do: 'doubleNext' }], callout: 'Amplified!' },
];
const pinata = (pct: number, bounty: number): Rule[] => [
  { trigger: { on: 'set' }, when: [{ kind: 'chance', pct }], effects: [{ do: 'armorCard', extraHealth: 1, bounty }], callout: 'Piñata!' },
];
const rallyHorn = (amount: number): Rule[] => [
  { trigger: { on: 'firstSetOfWave' }, effects: [{ do: 'damage', amount }], callout: 'Rally!' },
  { trigger: { on: 'everyNthSet', n: RALLY_EVERY }, effects: [{ do: 'damage', amount }], callout: 'Rally!' },
];
const revenge = (pct: number, amount: number): Rule[] => [
  { trigger: { on: 'hurt' }, effects: [{ do: 'damage', amount }], callout: 'Revenge!' },
  ...[0, 1, 2].map(() => ({ trigger: { on: 'hurt' }, when: [{ kind: 'chance', pct }], effects: [{ do: 'link', count: 1 }] }) as Rule),
];

export const ADVENTURE_WEAPONS: AdventureWeapon[] = [
  // ── Clarity Lens (utility): a steady beat of easier boards ────────────────
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
      seconds: { label: 'Simplify seconds', unit: 's', base: 10, perLevel: 2 },
      strike: { label: 'Clarity damage', unit: 'dmg', base: 5, perLevel: 2.5 },
    },
    build: v => ({
      rules: clarity(r(v.seconds * 1000), r(v.strike)),
      description: `Every ${CLARITY_EVERY}th Set hits the foe for ${r(v.strike)} and simplifies the board for ${r(v.seconds)}s: one trait becomes the same on every card.`,
      shortDescription: `Every ${CLARITY_EVERY}th Set: +${r(v.strike)} and simplify`,
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
      window: { label: `Seconds for ${DRUM_SETS} Sets`, unit: 's', base: 15, perLevel: 1.5 },
      power: { label: 'Power per card', unit: 'dmg', base: 1, perLevel: 0.25 },
    },
    build: v => ({
      rules: warDrum(r(v.window * 1000), Math.max(1, r(v.power))),
      description: `${DRUM_SETS} Sets within ${r(v.window)}s: every card on the board deals +${r(v.power)} more when matched.`,
      shortDescription: `${DRUM_SETS} Sets in ${r(v.window)}s: board +${r(v.power)} damage`,
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
    stats: {
      chance: { label: 'Amplify chance', unit: '%', base: 25, perLevel: 6 },
      shock: { label: 'Shock damage', unit: 'dmg', base: 2, perLevel: 0.5 },
    },
    build: v => ({
      rules: amplifier(r(v.chance), r(v.shock)),
      description: `Each Set: ${r(v.chance)}% chance to shock the foe for ${r(v.shock)} and make the next weapon trigger (blast, heal, laser, fire...) happen twice.`,
      shortDescription: `${r(v.chance)}%: +${r(v.shock)} and next trigger ×2`,
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
      bounty: { label: 'Piñata damage', unit: 'dmg', base: 8, perLevel: 3 },
    },
    build: v => ({
      rules: pinata(r(v.chance), r(v.bounty)),
      description: `Each Set has a ${r(v.chance)}% chance to give a random card +1 hit. Breaking that card deals +${r(v.bounty)} damage.`,
      shortDescription: `Sets may hang a +${r(v.bounty)} piñata`,
    }),
  },

  // ── Catalyst Prism (evolution): Rainbows hit harder and bring Catalysts ───
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
      strike: { label: 'Rainbow Strike damage', unit: 'dmg', base: 4, perLevel: 2 },
    },
    build: v => ({
      rules: [{ trigger: { on: 'rainbow' }, effects: [{ do: 'damage', amount: r(v.strike) }], callout: 'Prism!' }],
      modifiers: { evolutionLikelihood: r(v.likelihood), rainbowEvolutionLikelihood: r(v.rainbow) },
      description: `Rainbow Strikes hit for ${r(v.strike)} more. +${r(v.likelihood)}% Catalyst chance on every refill, and +${r(v.rainbow)}% more on refills after a Rainbow Strike.`,
      shortDescription: `Rainbows +${r(v.strike)}, +${r(v.likelihood)}% Catalysts`,
    }),
  },

  // ── Rally Horn (offense): a haymaker on a steady beat ─────────────────────
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
    stats: { damage: { label: 'Rally damage', unit: 'dmg', base: 5, perLevel: 2.5 } },
    build: v => ({
      rules: rallyHorn(r(v.damage)),
      description: `The first Set of each wave, and every ${RALLY_EVERY}th Set of the fight, deals +${r(v.damage)} damage.`,
      shortDescription: `Wave openers and every ${RALLY_EVERY}th Set +${r(v.damage)}`,
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
    stats: {
      strike: { label: 'Revenge damage', unit: 'dmg', base: 4, perLevel: 2 },
      chance: { label: 'Link chance per roll', unit: '%', base: 30, perLevel: 7 },
    },
    build: v => ({
      rules: revenge(r(v.chance), r(v.strike)),
      description: `Losing a heart hits the foe for ${r(v.strike)}, with 3 rolls at ${r(v.chance)}% each to link a pair of cards. Linked cards are destroyed together.`,
      shortDescription: `Lost hearts: ${r(v.strike)} dmg, 3× ${r(v.chance)}% link`,
    }),
  },

  // ═══ Trick weapons: something to hunt for or keep up (engine/gear.ts) ═════

  // ── Magnet: one marked card to build your next Set around
  {
    id: 'magnet',
    name: 'Magnet',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'It always points at one card. Trust it.',
    icon: 'lorc/magnet',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Magnet damage', unit: 'dmg', base: 5, perLevel: 1.5 } },
    build: v => ({
      modifiers: { magnetDamage: r(v.damage) },
      description: `One card on the board is always marked. A Set that includes it deals +${r(v.damage)}, then the mark moves.`,
      shortDescription: `Sets with the marked card +${r(v.damage)}`,
    }),
  },

  // ── Bounty Poster: a wanted value that keeps changing
  {
    id: 'bounty-poster',
    name: 'Bounty Poster',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'WANTED: anything purple. Reward: pain, for someone else.',
    icon: 'delapouite/wanted-reward',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Damage per wanted card', unit: 'dmg', base: 1.5, perLevel: 0.5 } },
    build: v => ({
      modifiers: { bountyDamage: v.damage },
      description: `One trait value is wanted (say, purple). Every wanted card you match deals +${num(v.damage)}. The poster changes after ${BOUNTY_CARDS} wanted cards.`,
      shortDescription: `Wanted cards +${num(v.damage)} each`,
    }),
  },

  // ── Mirror Shard: play where the new cards just landed
  {
    id: 'mirror-shard',
    name: 'Mirror Shard',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Look where you just were. Something new is standing there.',
    icon: 'lorc/mirror-mirror',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Mirror damage', unit: 'dmg', base: 4, perLevel: 1 } },
    build: v => ({
      modifiers: { mirrorDamage: r(v.damage) },
      description: `A Set that uses a spot from your last Set deals +${r(v.damage)}.`,
      shortDescription: `Reuse a spot from your last Set: +${r(v.damage)}`,
    }),
  },

  // ── Odd One Out: the extreme Sets, not the middle ones
  {
    id: 'odd-one-out',
    name: 'Odd One Out',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Nearly identical. Nearly.',
    icon: 'delapouite/puzzle',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Odd-one-out damage', unit: 'dmg', base: 4, perLevel: 1 } },
    build: v => ({
      modifiers: { oddOneOutDamage: r(v.damage) },
      description: `Sets with exactly 1 trait different deal +${r(v.damage)}. With 4 or more traits, so do Sets with exactly 1 trait the same.`,
      shortDescription: `Exactly 1 trait different (or the same): +${r(v.damage)}`,
    }),
  },

  // ── Devil's Bargain: a heart for damage
  {
    id: 'devils-bargain',
    name: "Devil's Bargain",
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Sign here. And here. And in blood, here.',
    icon: 'delapouite/devil-mask',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Damage per missing heart', unit: 'dmg', base: 1, perLevel: 0.5 } },
    build: v => ({
      modifiers: { maxHearts: -1, missingHeartDamage: v.damage },
      description: `Start every fight with 1 heart fewer. Every Set deals +${num(v.damage)} for that heart and for every other heart you are missing.`,
      shortDescription: `-1 heart; +${num(v.damage)} per missing heart`,
    }),
  },

  // ── Snowball: clean streaks stack up over a wave
  {
    id: 'snowball',
    name: 'Snowball',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Small at the top of the hill. Not small at the bottom.',
    icon: 'lorc/snowman',
    effects: {},
    maxCount: 1,
    stats: { max: { label: 'Most stacks', unit: 'count', base: 3, perLevel: 1 } },
    build: v => ({
      modifiers: { snowballStep: 1, snowballMax: r(v.max) },
      description: `Every Set you make adds +1 damage to all your later Sets this wave, up to +${r(v.max)}. A mistake halves it.`,
      shortDescription: `Each Set: later Sets +1 (max +${r(v.max)}); mistakes halve it`,
    }),
  },

  // ── Collector's Album: one page per trait, then a big hit
  {
    id: 'collectors-album',
    name: "Collector's Album",
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Three empty pages. You know what to do.',
    icon: 'delapouite/post-stamp',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Album damage', unit: 'dmg', base: 15, perLevel: 3 } },
    build: v => ({
      modifiers: { albumDamage: r(v.damage) },
      description: `Fill one page per trait: a Set where everything is the same except the number, one except the shape, one except the color (and the shading, when it is in play). With 4 or more traits, one other trait may differ too. The Set that fills the last page deals +${r(v.damage)}, then the album starts over.`,
      shortDescription: `One "all the same but X" Set per trait: +${r(v.damage)}`,
    }),
  },

  // ── Wild Card: a card that completes any Set
  {
    id: 'wild-card',
    name: 'Wild Card',
    rarity: 'common',
    level: 1,
    price: 12,
    description: '',
    shortDescription: '',
    flavorText: 'It is whatever you need it to be.',
    icon: 'delapouite/card-joker',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Wild card chance', unit: '%', base: 10, perLevel: 2 } },
    build: v => ({
      modifiers: { wildChance: r(v.chance) },
      description: `${r(v.chance)}% chance that a new card is a wild card: it makes a Set with any two other cards. One on the board at a time.`,
      shortDescription: `${r(v.chance)}% of new cards are wild`,
    }),
  },

  // ── Twin Seed: a harder board that pays when you clear it
  {
    id: 'twin-seed',
    name: 'Twin Seed',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Two of a kind is a problem. Until it is a plan.',
    icon: 'delapouite/gemini',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Twin chance', unit: '%', base: 15, perLevel: 2 }, damage: { label: 'Twin damage', unit: 'dmg', base: 5, perLevel: 1.5 } },
    build: v => ({
      modifiers: { twinChance: r(v.chance), twinDamage: r(v.damage) },
      description: `${r(v.chance)}% chance that a new card is an exact twin of a card on the board. Twins can never share a Set, but matching one destroys the other for ${r(v.damage)}.`,
      shortDescription: `${r(v.chance)}% twins; match one, the other hits for ${r(v.damage)}`,
    }),
  },

  // ── Glass Sword: fast and flawless, or nothing
  {
    id: 'glass-sword',
    name: 'Glass Sword',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'The sharpest thing you will ever drop.',
    icon: 'lorc/shard-sword',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Glass Sword damage', unit: 'dmg', base: 6, perLevel: 0.4 }, window: { label: 'Seconds between Sets', unit: 's', base: 6, perLevel: 0.25 } },
    build: v => ({
      modifiers: { glassDamage: r(v.damage), glassWindowMs: r(v.window * 1000) },
      description: `Every Set deals +${r(v.damage)}. The sword shatters for the rest of the wave on your first mistake, or if ${num(v.window)}s pass without a Set.`,
      shortDescription: `Sets +${r(v.damage)} until a mistake or ${num(v.window)}s without a Set`,
    }),
  },

  // ── Fog Lantern: fewer cards now, stronger cards soon
  {
    id: 'fog-lantern',
    name: 'Fog Lantern',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'What comes out of the fog is never what went in.',
    icon: 'lorc/lantern-flame',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Fog chance', unit: '%', base: 10, perLevel: 1 }, bonus: { label: 'Damage when the fog lifts', unit: 'dmg', base: 7, perLevel: 1 } },
    build: v => ({
      modifiers: { fogChance: r(v.chance), fogBonus: r(v.bonus) },
      description: `${r(v.chance)}% chance that a new card arrives face-down. After ${FOG_MS / 1000}s it flips up as a power card worth +${r(v.bonus)}.`,
      shortDescription: `${r(v.chance)}% face-down cards flip up at +${r(v.bonus)}`,
    }),
  },

  // ── Understudy: a second copy of your favourite weapon (data/armory.ts fills it in)
  {
    id: 'understudy',
    name: 'Understudy',
    rarity: 'common',
    level: 1,
    price: 12,
    description: '',
    shortDescription: '',
    flavorText: 'Knows every line. Has never once been asked.',
    icon: 'lorc/two-shadows',
    effects: {},
    maxCount: 1,
    stats: { level: { label: 'Level it copies at', unit: 'count', base: 1, perLevel: 1, tunable: false } },
    build: v => ({
      modifiers: {},
      description: `Copies the charm to its left, at level ${r(v.level)} and untuned. Does nothing in the first slot.`,
      shortDescription: `Copies the charm to its left (level ${r(v.level)})`,
    }),
  },

  // ── Encore Mask: evolutions go out the way they came in
  {
    id: 'encore-mask',
    name: 'Encore Mask',
    rarity: 'common',
    level: 1,
    price: 12,
    description: '',
    shortDescription: '',
    flavorText: 'The show is over. The show is never over.',
    icon: 'delapouite/theater-curtains',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Encore damage', unit: 'dmg', base: 10, perLevel: 3 } },
    build: v => ({
      modifiers: { encoreDamage: r(v.damage) },
      description: `When an evolution ends, it hits the foe for ${r(v.damage)} and its opening effect happens again.`,
      shortDescription: `Evolutions end with +${r(v.damage)} and replay their opening`,
    }),
  },

  // ═══ Board tricks: a harder board for a bigger payoff (engine/gear.ts) ════

  // ── Cursed Idol: locked cards that may come back doubled
  {
    id: 'cursed-idol',
    name: 'Cursed Idol',
    rarity: 'common',
    level: 1,
    price: 12,
    description: '',
    shortDescription: '',
    flavorText: 'Do not look at it. Do not match it. Wait.',
    icon: 'lorc/totem-head',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Curse chance', unit: '%', base: 5, perLevel: 1 } },
    build: v => ({
      modifiers: { curseChance: r(v.chance) },
      description: `${r(v.chance)}% chance that a new card arrives cursed: it can't be matched for ${T.curseMs / 1000}s. Then it is a coin flip: the card becomes a ×${T.curseMultiplier} card (a Set that includes it deals ×${T.curseMultiplier}), or the curse moves to the card next to it.`,
      shortDescription: `${r(v.chance)}% cursed cards: wait ${T.curseMs / 1000}s for ×${T.curseMultiplier}, or the curse spreads`,
    }),
  },

  // ── Chain Gang: two cards that want to leave together
  {
    id: 'chain-gang',
    name: 'Chain Gang',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Where one goes, the other goes. That is the deal.',
    icon: 'lorc/crossed-chains',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Chain damage', unit: 'dmg', base: 8, perLevel: 1.5 } },
    build: v => ({
      modifiers: { chainDamage: r(v.damage) },
      description: `Two cards on the board are chained together. Match both in the same Set for +${r(v.damage)}. A chained card matched alone stays on the board.`,
      shortDescription: `Match both chained cards together: +${r(v.damage)}`,
    }),
  },

  // ── Thorn Bush: cards on a deadline
  {
    id: 'thorn-bush',
    name: 'Thorn Bush',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Pretty. Pick it quickly.',
    icon: 'lorc/thorny-vine',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Thorn chance', unit: '%', base: 10, perLevel: 0.5 }, damage: { label: 'Thorn damage', unit: 'dmg', base: 8, perLevel: 1.5 } },
    build: v => ({
      modifiers: { thornChance: r(v.chance), thornDamage: r(v.damage) },
      description: `${r(v.chance)}% chance that a new card has thorns. Match it within ${T.thornMs / 1000}s (+${T.thornMsPerExtraTrait / 1000}s per trait beyond 3) for +${r(v.damage)}; leave it and it costs a heart. One at a time.`,
      shortDescription: `${r(v.chance)}% thorn cards: +${r(v.damage)} in time, a heart if not`,
    }),
  },

  // ── Rust: old cards fade, then turn to gold
  {
    id: 'rust',
    name: 'Rust',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Everything you leave lying around gets worse. Then, suddenly, much better.',
    icon: 'delapouite/rusty-sword',
    effects: {},
    maxCount: 1,
    stats: { gold: { label: 'Golden card damage', unit: 'dmg', base: 15, perLevel: 0.5 } },
    build: v => ({
      modifiers: { rustGold: r(v.gold) },
      description: `Every card loses 1 damage for each Set it sits through (never below 0). The card that has sat longest, once it has sat through ${T.rustSets} Sets, turns golden: +${r(v.gold)} damage and +${T.rustCoins} coins when matched.`,
      shortDescription: `Cards rust by 1 per Set; after ${T.rustSets} they turn golden (+${r(v.gold)})`,
    }),
  },

  // ── Tar Pit: a row that pays every time you wade in
  {
    id: 'tar-pit',
    name: 'Tar Pit',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'You can leave any time you like. Twice.',
    icon: 'delapouite/sticky-boot',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Tar Pit damage', unit: 'dmg', base: 5, perLevel: 1 } },
    build: v => ({
      modifiers: { tarDamage: r(v.damage) },
      description: `One row of the board is sticky each wave: its cards take two matches to clear. Every Set that uses a card in that row deals +${r(v.damage)}.`,
      shortDescription: `A sticky row: two matches per card, +${r(v.damage)} per Set there`,
    }),
  },

  // ── Decoy: a secret pair to spot
  {
    id: 'decoy',
    name: 'Decoy',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'One of these is not quite like the other.',
    icon: 'delapouite/plastic-duck',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Decoy chance', unit: '%', base: 15, perLevel: 2 }, damage: { label: 'Decoy damage', unit: 'dmg', base: 15, perLevel: 4 } },
    build: v => ({
      modifiers: { decoyChance: r(v.chance), decoyDamage: r(v.damage) },
      description: `${r(v.chance)}% chance that a new card is a decoy: a copy of a card on the board with one trait changed. Nothing marks it. Match a decoy and its original in the same Set for +${r(v.damage)}.`,
      shortDescription: `${r(v.chance)}% unmarked near-copies; match one with its original: +${r(v.damage)}`,
    }),
  },

  // ── Long Fuse: cards worth more the longer you dare
  {
    id: 'long-fuse',
    name: 'Long Fuse',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Wait for it. Not that long.',
    icon: 'delapouite/time-dynamite',
    effects: {},
    maxCount: 1,
    stats: { chance: { label: 'Fuse chance', unit: '%', base: 20, perLevel: 2 }, damage: { label: 'Short-fuse damage', unit: 'dmg', base: 6, perLevel: 1.5 } },
    build: v => ({
      modifiers: { fuseChance: r(v.chance), fuseDamage: r(v.damage) },
      description: `${r(v.chance)}% chance that a new card carries a ${T.fuseMs / 1000}s fuse. Matched in its last ${T.fuseHotMs / 1000}s it deals +${r(v.damage)}. If it burns out it becomes a dud.`,
      shortDescription: `${r(v.chance)}% fused cards: +${r(v.damage)} in the last ${T.fuseHotMs / 1000}s, a dud after`,
    }),
  },

  // ── Ice Block: one card out of play, then a big hit
  {
    id: 'ice-block',
    name: 'Ice Block',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Something is in there. Keep chipping.',
    icon: 'lorc/frozen-block',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Thawed card damage', unit: 'dmg', base: 25, perLevel: 5 } },
    build: v => ({
      modifiers: { frozenDamage: r(v.damage) },
      description: `One card on the board is frozen and can't be matched. It thaws after ${T.iceSets} of your Sets, worth +${r(v.damage)} when you match it. Then another card freezes.`,
      shortDescription: `A frozen card thaws after ${T.iceSets} Sets: +${r(v.damage)}`,
    }),
  },

  // ── Greedy Chest: cash in now, or one more Set?
  {
    id: 'greedy-chest',
    name: 'Greedy Chest',
    rarity: 'common',
    level: 1,
    price: 12,
    description: '',
    shortDescription: '',
    flavorText: 'It gets heavier every time you walk past. So do you.',
    icon: 'delapouite/mimic-chest',
    effects: {},
    maxCount: 1,
    stats: { start: { label: 'Chest starts at', unit: 'dmg', base: 10, perLevel: 2 }, growth: { label: 'Growth per Set', unit: 'dmg', base: 2, perLevel: 0.5 } },
    build: v => ({
      modifiers: { chestStart: r(v.start), chestGrowth: v.growth },
      description: `One card is a chest holding ${r(v.start)} damage. It grows by ${num(v.growth)} every Set you leave it, and pays out when you match it. A mistake empties it.`,
      shortDescription: `A chest card: ${r(v.start)} damage, +${num(v.growth)} per Set you wait; mistakes empty it`,
    }),
  },

  // ── Tightrope: every Set next to the last
  {
    id: 'tightrope',
    name: 'Tightrope',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'One foot in front of the other. Do not look at the rest of the board.',
    icon: 'delapouite/tightrope',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Tightrope damage', unit: 'dmg', base: 4, perLevel: 0.5 } },
    build: v => ({
      modifiers: { tightropeDamage: r(v.damage) },
      description: `A Set that uses a spot from your last Set, or one next to it, deals +${r(v.damage)}. Any other Set deals half damage.`,
      shortDescription: `Sets touching your last Set +${r(v.damage)}; others deal half`,
    }),
  },

  // ── Hot Potato: a moving target with a price
  {
    id: 'hot-potato',
    name: 'Hot Potato',
    rarity: 'common',
    level: 1,
    price: 10,
    description: '',
    shortDescription: '',
    flavorText: 'Whatever you do, do not be holding it when you slip.',
    icon: 'delapouite/potato',
    effects: {},
    maxCount: 1,
    stats: { damage: { label: 'Hot Potato damage', unit: 'dmg', base: 8, perLevel: 2 } },
    build: v => ({
      modifiers: { potatoDamage: r(v.damage) },
      description: `One card is hot and jumps to a neighbour every ${T.potatoMs / 1000}s. Matching it deals +${r(v.damage)}. While it is out, a mistake costs an extra heart.`,
      shortDescription: `A hot card: +${r(v.damage)} when matched; mistakes cost an extra heart`,
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

/** The trick weapons (engine/gear.ts). */
export const TRICK_WEAPON_IDS: readonly string[] = [
  'magnet', 'bounty-poster', 'mirror-shard', 'odd-one-out', 'devils-bargain', 'snowball', 'collectors-album',
  'wild-card', 'twin-seed', 'glass-sword', 'fog-lantern', 'understudy', 'encore-mask',
  'cursed-idol', 'chain-gang', 'thorn-bush', 'rust', 'tar-pit', 'decoy', 'long-fuse', 'ice-block', 'greedy-chest', 'tightrope', 'hot-potato',
];
export const UNDERSTUDY_ID = 'understudy';
