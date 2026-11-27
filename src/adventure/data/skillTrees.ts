/**
 * Skill trees, Clair Obscur style: every fighter has a web of nodes with its
 * own silhouette, grown from the fighter's two passives (data/fighters.ts).
 * A node can be bought once ANY node it links to is owned, or straight away
 * if it hangs off a passive root. Branches fork and rejoin, so most nodes can
 * be reached more than one way. Every node is a RuleSource: rules and
 * modifiers in the shared vocabulary (rules/types.ts).
 *
 * Design rules (keep these true when editing):
 *  - Each tree has its passives' themes as clusters (like Lune's elements):
 *    nodes of one flavour sit together. "Crossroads" nodes (`x-*`) sit where
 *    the two halves meet and use both passives. Capstones (`cap-*`) sit at the
 *    tips; one per fighter is sealed until World 4's star gate (SEALED_AT).
 *  - Costs are authored as WEIGHTS that follow the node's role, not its
 *    distance: 1 next to a root, 2-4 in the body, 5-6 for build-defining tips.
 *    The real star costs are those weights scaled so every fighter's full tree
 *    costs exactly TREE_BUDGET (see the star budget below).
 *  - `text` is exact and short (≤ 90 chars) and true in ANY buying order:
 *    passive tuning nodes say "+1 more", never "was X".
 *  - No bare "+1 heart" nodes.
 *  - Ids are `<fighter slug>-<key>`. Keys `0-n`/`1-n` are the old two-branch
 *    ids, kept so saves keep what they own; never rename a key.
 */
import type { CharacterName } from '@/types';
import type { IconName } from '@/components/Icon';
import type { PassiveId, SkillNode, TreePos } from '../types';
import type { Area, Condition, Effect, Modifiers, Rule, Trigger } from '../rules/types';
import { FIGHTERS } from './fighters';
import { LEVELS } from './levels';
import { getBiome } from './biomes';

// ─── Star budget ────────────────────────────────────────────────────────────
//
// Stars are earned once (3 per level) and EVERY fighter may spend all of them:
// each fighter's tree has its own pool of "stars earned" (progress.ts
// availableStars). A full tree costs the whole campaign minus a little slack,
// so maxing a fighter takes (almost) every star, and you can grow every fighter
// at once without refunding one to fund another.
//
// The budget is derived from the level list. Adding levels (or elite
// branches) adds 3 stars each and every tree's node costs scale up with it,
// keeping "a full tree ≈ a full campaign". If you'd rather new levels give
// headroom instead, raise TREE_SLACK. __tests__/adventureProgressionSystems
// checks every tree sums to TREE_BUDGET and fits inside CAMPAIGN_STARS.

/** Every star the campaign can award: 3 per level, elite branches included (168 with 56 levels). */
export const CAMPAIGN_STARS = LEVELS.length * 3;
/** Stars a fully bought tree leaves unspent, so the last few stars aren't required to finish a tree. */
export const TREE_SLACK = 8;
/** What one fighter's whole tree costs (160 with 168 campaign stars). */
export const TREE_BUDGET = CAMPAIGN_STARS - TREE_SLACK;
/**
 * Active Star Capacity ([GP-13]): each fighter may equip at most 65% of their
 * tree's total star cost at once (free respecs let you swap builds anytime).
 */
export const ACTIVE_TREE_CAP_RATIO = 0.65;
export const ACTIVE_TREE_CAP = Math.round(TREE_BUDGET * ACTIVE_TREE_CAP_RATIO);

/** Stars a player must have earned before a sealed capstone opens (World 4's gate). */
export const SEALED_AT = getBiome('peaks').starGate;

/**
 * Scale authored weights to whole star costs that sum to exactly `budget`
 * (largest remainder; every node costs at least 1).
 */
export const scaleCosts = (weights: readonly number[], budget: number = TREE_BUDGET): number[] => {
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => (w / total) * budget);
  const costs = raw.map(r => Math.max(1, Math.floor(r)));
  let left = budget - costs.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) costs[order[k][1]] += 1;
  return costs;
};

const SLUG: Record<CharacterName, string> = {
  'Orange Tabby': 'tabby',
  'Sly Fox': 'fox',
  Badger: 'badger',
  'Emperor Penguin': 'penguin',
  Corgi: 'corgi',
  Pelican: 'pelican',
};

// ─── Tiny authoring helpers ─────────────────────────────────────────────────

type Body = { rules?: Rule[]; modifiers?: Modifiers };
type Spot = [col: number, row: number];
/** name, icon, text, body, cost weight (scaled to stars by scaleCosts), where it sits, and whether it is sealed until SEALED_AT stars */
type Row = [name: string, icon: IconName, text: string, body: Body, cost: number, at: Spot, sealed?: 'sealed'];

interface TreeSpec {
  /** Where the fighter's first and second passive sit */
  roots: [Spot, Spot];
  nodes: Record<string, Row>;
  /** Paths through the tree; consecutive keys are linked. `P1`/`P2` are the passives. */
  paths: string[][];
  /** Mutually exclusive capstone choice pairs (`[keyA, keyB]`) for build identity ([GP-13]). */
  exclusivePairs?: readonly (readonly [string, string])[];
}

const on = (trigger: Trigger, effects: Effect[], when?: Condition[], callout?: string): Rule => ({
  trigger,
  effects,
  ...(when ? { when } : {}),
  ...(callout ? { callout } : {}),
});
const rule = (...args: Parameters<typeof on>): Body => ({ rules: [on(...args)] });
const tune = (key: string, delta: number): Body => ({ modifiers: { passiveTuning: { [key]: delta } } });

const T = {
  set: { on: 'set' } as Trigger,
  firstSetOfWave: { on: 'firstSetOfWave' } as Trigger,
  rainbow: { on: 'rainbow' } as Trigger,
  mistake: { on: 'mistake' } as Trigger,
  healed: { on: 'healed' } as Trigger,
  hurt: { on: 'hurt' } as Trigger,
  fightStart: { on: 'fightStart' } as Trigger,
  waveStart: { on: 'waveStart' } as Trigger,
  evolutionStart: { on: 'evolutionStart' } as Trigger,
  bonusCard: { on: 'bonusCardMatched' } as Trigger,
  hintUsed: { on: 'hintUsed' } as Trigger,
  graceUsed: { on: 'graceUsed' } as Trigger,
  grudgeRelease: { on: 'grudgeRelease' } as Trigger,
  nth: (n: number): Trigger => ({ on: 'everyNthSet', n }),
  within: (count: number, withinMs: number): Trigger => ({ on: 'setsWithin', count, withinMs }),
  idle: (ms: number): Trigger => ({ on: 'idle', ms }),
  weapon: (kind: Extract<Trigger, { on: 'weapon' }>['kind']): Trigger => ({ on: 'weapon', kind }),
};

const C = {
  chance: (pct: number): Condition => ({ kind: 'chance', pct }),
  heartsAtMost: (n: number): Condition => ({ kind: 'heartsAtMost', n }),
  heartsFull: { kind: 'heartsFull' } as Condition,
  combo: (n: number): Condition => ({ kind: 'comboAtLeast', n }),
  rainbowSet: { kind: 'rainbowSet' } as Condition,
  evolutionActive: { kind: 'evolutionActive' } as Condition,
  board: (n: number): Condition => ({ kind: 'boardAtLeast', n }),
  /** A Patience Set (Emperor Penguin's window, which grows with the trait count) */
  patient: { kind: 'patient' } as Condition,
  /** Caps mistake-setup nodes to at most once between valid Sets ([GP-06]) */
  firstMistakeSinceSet: { kind: 'firstMistakeSinceSet' } as Condition,
  /** True while the clock & foe are frozen (Deep Freeze / Aurora / Icicle) */
  frozen: { kind: 'frozen' } as Condition,
};

const A = {
  block: (cols: number, rows: number): Area => ({ shape: 'block', cols, rows }),
  row: { shape: 'row' } as Area,
  column: { shape: 'column' } as Area,
  random: (count: number): Area => ({ shape: 'random', count }),
};

const E = {
  damage: (amount: number): Effect => ({ do: 'damage', amount }),
  explode: (area: Area): Effect => ({ do: 'explode', area }),
  laser: (area: Area): Effect => ({ do: 'laser', area }),
  ignite: (count: number): Effect => ({ do: 'ignite', count }),
  heal: (amount: number): Effect => ({ do: 'heal', amount }),
  coins: (amount: number): Effect => ({ do: 'coins', amount }),
  time: (seconds: number): Effect => ({ do: 'time', seconds }),
  hint: (amount: number): Effect => ({ do: 'hint', amount }),
  grace: (amount: number): Effect => ({ do: 'grace', amount }),
  growBoard: (count: number): Effect => ({ do: 'growBoard', count }),
  empower: (amount: number): Effect => ({ do: 'empowerBoard', amount }),
  convert: (to: 'power' | 'gold' | 'holo', count: number): Effect => ({ do: 'convert', to, count }),
  shield: (count: number): Effect => ({ do: 'shield', count }),
  cleanse: { do: 'cleanse' } as Effect,
  simplify: (ms: number): Effect => ({ do: 'simplify', ms }),
  freeze: (ms: number): Effect => ({ do: 'freeze', ms }),
  extend: (ms: number): Effect => ({ do: 'extendEvolutions', ms }),
  combo: (amount: number): Effect => ({ do: 'comboStep', amount }),
  times: (times: number): Effect => ({ do: 'nextSetMultiplier', times }),
  doubleNext: { do: 'doubleNext' } as Effect,
  ricochet: (count: number): Effect => ({ do: 'ricochet', count }),
  redeal: { do: 'redeal' } as Effect,
  autoSet: { do: 'autoSet' } as Effect,
  chargeEvo: (target: 'all' | 'other' | 'self', amount: number): Effect => ({ do: 'chargeEvolution', target, amount }),
};

// ─── The trees ──────────────────────────────────────────────────────────────

const TREES: Record<CharacterName, TreeSpec> = {
  // Orange Tabby: a cat's paw print. The main pad holds both passives (Nine
  // Lives left, Scrappy right) with crossroads in the middle; four toes are
  // clusters: heal-into-blast (outer left), heal-into-power (inner left),
  // rage (inner right), 1-heart wrecking ball (outer right). The sealed claw
  // tip joins the two inner toes; the heel is the healer's capstone.
  'Orange Tabby': {
    roots: [[2, 6], [4, 6]],
    nodes: {
      '0-2': ['Warm Lap', 'lorc/shining-heart', 'The first Set of each wave heals 1 heart.', rule(T.firstSetOfWave, [E.heal(1)]), 1, [2, 5]],
      '0-1': ['Purr Punch', 'lorc/fist', 'Every heal also deals 4 damage to the foe.', rule(T.healed, [E.damage(4)]), 1, [1, 6]],
      '0-3': ['Spare Life', 'lorc/cat', 'Nine Lives works 1 more time per fight.', tune('nineLives.charges', 1), 2, [2, 7]],
      '1-2': ['Lick Wounds', 'lorc/heart-inside', 'Every 4th Set heals 1 heart.', rule(T.nth(4), [E.heal(1)]), 2, [1, 7]],
      '0-7': ['Extra Life', 'lorc/heart-bottle', 'Nine Lives gains 1 more charge per fight.', tune('nineLives.charges', 1), 3, [2, 8]],
      '0-5': ['Catnip', 'lorc/clover', 'Every explosion has a 25% chance to heal 1 heart.', rule(T.weapon('explosion'), [E.heal(1)], [C.chance(25)]), 2, [0, 4]],
      '0-9': ['Sunbeam', 'lorc/shining-heart', 'Every heal empowers the board (+2) and grants 1 mistake shield.', rule(T.healed, [E.empower(2), E.shield(1)], undefined, 'Sunbeam!'), 4, [0, 3]],
      '1-5': ['Rebound', 'lorc/bright-explosion', 'Every heal explodes 2 random cards.', rule(T.healed, [E.explode(A.random(2))]), 3, [2, 2]],
      '1-6': ['Second Helping', 'lorc/crossed-swords', 'Every heal: 50% chance to hit +8 damage and make your next Set deal ×1.3.', rule(T.healed, [E.times(1.3), E.damage(8)], [C.chance(50)]), 3, [2, 1]],
      '1-3': ['Hot-Blooded', 'lorc/campfire', 'Every mistake sets 2 cards on fire.', rule(T.mistake, [E.ignite(2)]), 2, [3, 5]],
      'x-1': [
        'Ninth Life Scrap',
        'lorc/chained-heart',
        'Nine Lives works 1 more time per fight, and Scrappy deals +1 more per missing heart.',
        { modifiers: { passiveTuning: { 'nineLives.charges': 1, 'scrappy.perHeart': 1 } } },
        4,
        [3, 6],
      ],
      '0-6': ['Last Breath', 'lorc/snowflake-1', 'Dropping to 1 heart freezes the clock and the foe for 3s.', rule(T.hurt, [E.freeze(3000)], [C.heartsAtMost(1)]), 3, [3, 7]],
      'x-2': ['Shake It Off', 'lorc/broken-heart-zone', 'Losing a heart has a 25% chance to heal it right back.', rule(T.hurt, [E.heal(1)], [C.chance(25)], 'Shake it off!'), 3, [3, 8]],
      'cap-2': ['Purrfect Storm', 'lorc/comet-spark', 'Every heal makes your next weapon trigger fire twice.', rule(T.healed, [E.doubleNext], undefined, 'Purrfect!'), 5, [3, 9]],
      '1-1': ['Scuffle', 'lorc/claw-slashes', 'Losing a heart deals 6 damage to the foe.', rule(T.hurt, [E.damage(6)]), 1, [5, 6]],
      '0-4': ['Hiss', 'lorc/bright-explosion', 'Losing a heart explodes 3 random cards.', rule(T.hurt, [E.explode(A.random(3))], undefined, 'Hiss!'), 2, [4, 5]],
      '1-4': ['Street Smarts', 'lorc/fist', 'Scrappy deals +1 more damage per missing heart.', tune('scrappy.perHeart', 1), 2, [4, 7]],
      '1-9': ['Cornered', 'lorc/broken-heart', 'While at 2 hearts or fewer, every Set deals +5.', { modifiers: { conditionalDamage: [{ when: [C.heartsAtMost(2)], amount: 5 }] } }, 4, [5, 7]],
      '1-7': ['Alley Cat', 'lorc/wolverine-claws', 'Scrappy deals +1 more damage per missing heart.', tune('scrappy.perHeart', 1), 3, [4, 8]],
      '1-8': ['Blood Rage', 'lorc/wolverine-claws', 'Every heart lost deals 12 feral damage and empowers the board (+2).', rule(T.hurt, [E.damage(12), E.empower(2)], undefined, 'Blood Rage!'), 4, [4, 2]],
      '0-10': ['Ninth Life Fury', 'lorc/skull-crack', 'Every heart lost deals 14 damage and makes your next Set deal ×1.5.', rule(T.hurt, [E.times(1.5), E.damage(14)], undefined, 'Fury ×1.5!'), 5, [4, 1]],
      '0-8': ['Kamikaze Kitty', 'lorc/bright-explosion', 'While at 2 hearts or fewer, every Set explodes a 2×2 block.', rule(T.set, [E.explode(A.block(2, 2))], [C.heartsAtMost(2)], 'Kamikaze!'), 4, [6, 4]],
      '1-10': ['Feral Frenzy', 'lorc/lightning-helix', 'While at 2 hearts or fewer, every Set makes your next weapon trigger fire twice.', rule(T.set, [E.doubleNext], [C.heartsAtMost(2)], 'Frenzy!'), 5, [6, 3]],
      'cap-1': ['Nine Claws', 'lorc/time-bomb', 'Dropping to 1 heart shatters a 3×3 block of cards.', rule(T.hurt, [E.explode(A.block(3, 3))], [C.heartsAtMost(1)], 'Nine Claws!'), 6, [3, 0], 'sealed'],
    },
    paths: [
      ['P1', '0-2', '1-3', '0-4', 'P2'],
      ['P1', '0-1', '1-2', '0-3', 'P1'],
      ['0-3', '0-7', 'x-2', '1-7', '1-4', 'P2'],
      ['P2', '1-1', '1-9', '1-4', '0-6', '0-3'],
      ['1-3', 'x-1', '0-6', 'x-2', 'cap-2'],
      ['0-1', '0-5', '0-9'],
      ['0-2', '1-5', '1-6', 'cap-1', '0-10', '1-8', '0-4'],
      ['1-1', '0-8', '1-10'],
    ],
    exclusivePairs: [
      ['cap-1', 'cap-2'],
      ['0-9', '1-10'],
    ],
  },

  // Sly Fox: two zigzag lightning bolts (a forked tail) running down from
  // Combo (left: speed, coins, time) and Hot Streak (right: fire, echoes,
  // multipliers). Sparks fly off each bend, the bolts cross-link at two
  // crossroads and fuse into one tail tip.
  'Sly Fox': {
    roots: [[2, 0], [4, 0]],
    nodes: {
      '0-3': ['Sniff Out', 'lorc/light-bulb', 'Start each wave with +1 grace; going 5s without a Set gives a hint.', { rules: [on(T.waveStart, [E.grace(1)]), on(T.idle(5000), [E.hint(1)])] }, 1, [1, 0]],
      '0-1': ['Quick Paws', 'lorc/stopwatch', 'Combo window +1s.', tune('combo.windowMs', 1000), 1, [1, 1]],
      '0-2': ['Tailwind', 'lorc/hourglass', 'Every Set at Combo 2+ adds +1s to the clock.', rule(T.set, [E.time(1)], [C.combo(2)]), 2, [2, 2]],
      '0-4': ['Long Tail', 'lorc/lightning-branches', 'Combo goes 2 steps higher.', tune('combo.max', 2), 3, [1, 3]],
      '0-5': ['Coin Trick', 'lorc/crown-coin', 'Every Set at Combo 3+ drops a coin; every 8th Set heals 1 heart.', { rules: [on(T.set, [E.coins(1)], [C.combo(3)]), on(T.nth(8), [E.heal(1)])] }, 2, [0, 4]],
      '0-7': ['Fleet Foot', 'lorc/feather', 'Combo window +1s.', tune('combo.windowMs', 1000), 3, [2, 4]],
      '0-9': ['Fox Trot', 'lorc/stopwatch', '3 Sets within 6s add +3s to the clock and +2 Combo steps.', rule(T.within(3, 6000), [E.time(3), E.combo(2)], undefined, 'Fox Trot!'), 4, [1, 5]],
      '0-6': ['Spark Step', 'lorc/campfire', 'Every fire has a 50% chance to add a Combo step.', rule(T.weapon('fire'), [E.combo(1)], [C.chance(50)]), 2, [0, 6]],
      '0-8': ['Chain Lightning', 'lorc/lightning-branches', 'At Combo 4+, every Set ricochets 2 cards and adds +1s.', rule(T.set, [E.ricochet(2), E.time(1)], [C.combo(4)], 'Zap!'), 4, [2, 6]],
      '0-10': ['Foxfire', 'lorc/fireball', 'At Combo 4+, every Set ignites 3 cards and deals +6 damage.', rule(T.set, [E.ignite(3), E.damage(6)], [C.combo(4)], 'Foxfire!'), 5, [1, 7]],
      '1-1': ['Warm Up', 'lorc/sword-clash', 'The first Set of each wave adds 2 Combo steps and grants 1 mistake shield.', rule(T.firstSetOfWave, [E.combo(2), E.shield(1)]), 1, [5, 0]],
      '1-3': ['Prism Dash', 'lorc/rainbow-star', 'Rainbow Strikes add 1 Combo step and grant 1 grace.', rule(T.rainbow, [E.combo(1), E.grace(1)]), 1, [5, 1]],
      '1-2': ['Blaze', 'lorc/campfire', 'At Combo 4+, every Set ignites a card.', rule(T.set, [E.ignite(1)], [C.combo(4)]), 2, [4, 2]],
      '1-4': ['Scorcher', 'lorc/fireball', "Hot Streak's multiplier +0.15×, and Sets at Combo 3+ deal +3 base damage.", { modifiers: { passiveTuning: { 'hotStreak.multiplier': 0.15 }, conditionalDamage: [{ when: [C.combo(3)], amount: 3 }] } }, 3, [5, 3]],
      '1-6': ['Echo Step', 'lorc/echo-ripples', 'Every echo adds a Combo step.', rule(T.weapon('echo'), [E.combo(1)]), 2, [6, 4]],
      '1-5': ['Overdrive', 'lorc/lightning-helix', '3 Sets within 4s: your next weapon trigger fires twice.', rule(T.within(3, 4000), [E.doubleNext], undefined, 'Overdrive!'), 3, [4, 4]],
      '1-9': ['Afterburn', 'lorc/bright-explosion', 'Every explosion has a 50% chance to add a Combo step.', rule(T.weapon('explosion'), [E.combo(1)], [C.chance(50)]), 3, [5, 5]],
      '1-8': ['Flash Fire', 'lorc/fire-ring', 'At Combo 5+, every Set makes your next weapon trigger fire twice.', rule(T.set, [E.doubleNext], [C.combo(5)]), 4, [6, 6]],
      '1-7': ['Showstopper', 'lorc/flat-star', 'Hot Streak gains +0.15× multiplier and +6 extra base damage.', { modifiers: { passiveTuning: { 'hotStreak.multiplier': 0.15, 'hotStreak.damage': 6 } } }, 4, [4, 6]],
      '1-10': ['Blaze of Glory', 'lorc/trophy', 'At Combo 5+, Sets have a 35% chance to hit +8 and charge ×1.3 next Set.', rule(T.set, [E.times(1.3), E.damage(8)], [C.combo(5), C.chance(35)], 'Glory!'), 5, [5, 7]],
      'x-1': [
        'Hot Pursuit',
        'lorc/comet-spark',
        "Combo goes 1 step higher, and Hot Streak's multiplier +0.15×.",
        { modifiers: { passiveTuning: { 'combo.max': 1, 'hotStreak.multiplier': 0.15 } } },
        3,
        [3, 3],
      ],
      'x-2': ['Double Time', 'lorc/cycle', 'Every Set has a 25% chance to add an extra Combo step.', rule(T.set, [E.combo(1)], [C.chance(25)]), 4, [3, 5]],
      'cap-1': ['Kitsune', 'caro-asercion/fox', 'At Combo 4+, Rainbows deal +10, ignite 3 cards, and charge ×1.3 next Set.', rule(T.rainbow, [E.times(1.3), E.ignite(3), E.damage(10)], [C.combo(4)], 'Kitsune!'), 5, [3, 8]],
      'cap-2': ['Nine-Tailed Storm', 'lorc/chained-arrow-heads', 'At Combo 4+, every Set ricochets into a card.', rule(T.set, [E.ricochet(1)], [C.combo(4)], 'Storm!'), 6, [3, 9], 'sealed'],
    },
    paths: [
      ['P1', '0-3', '0-1', 'P1'],
      ['0-1', '0-2', '0-4', '0-7', '0-9', '0-8', '0-10', 'cap-1', '1-10', '1-7', '1-9', '1-5', '1-4', '1-2', '1-3', 'P2', '1-1', '1-3'],
      ['0-4', '0-5', '0-9', '0-6', '0-10'],
      ['1-4', '1-6', '1-9', '1-8', '1-10'],
      ['0-2', 'x-1', '1-2'],
      ['0-7', 'x-2', '1-5'],
      ['0-8', 'x-2', '1-7'],
      ['cap-1', 'cap-2'],
    ],
    exclusivePairs: [
      ['0-10', '1-10'],
      ['0-8', '1-8'],
    ],
  },

  // Badger: burrows dug down from the surface. Grudge's tunnel (left) is
  // ammo from mistakes; Thick Hide's (right) makes them cheap and lucky. Two
  // galleries cross between the tunnels, and both end in a deep den.
  Badger: {
    roots: [[1, 0], [5, 0]],
    nodes: {
      '0-2': ['Snarl', 'lorc/bestial-fangs', 'Sets deal +2 damage; releasing Grudge bites the foe for +10 more.', { modifiers: { setDamage: 2 }, rules: [on(T.grudgeRelease, [E.damage(10)], undefined, 'Snarl!')] }, 1, [1, 1]],
      '0-1': ['Bad Temper', 'lorc/fist', 'Each grudge releases +1 more damage.', tune('grudge.damage', 1), 2, [1, 2]],
      '0-7': ['Hard Lesson', 'lorc/light-bulb', 'Your first mistake between Sets gives you a hint.', rule(T.mistake, [E.hint(1)], [C.firstMistakeSinceSet]), 2, [2, 2]],
      '0-3': ['Seething', 'lorc/skull-crack', 'Hold 1 more grudge.', tune('grudge.max', 1), 2, [0, 3]],
      '0-4': ['Lash Out', 'lorc/bright-explosion', 'Releasing Grudge explodes 3 random cards; every 3rd Set explodes 2.', { rules: [on(T.grudgeRelease, [E.explode(A.random(3))], undefined, 'Lash Out!'), on(T.nth(3), [E.explode(A.random(2))], undefined, 'Lash Out!')] }, 3, [0, 4]],
      '0-6': ['Vendetta', 'lorc/claw-slashes', 'Each grudge releases +2 more damage.', tune('grudge.damage', 2), 3, [1, 5]],
      '0-8': ['Rage Slam', 'lorc/bright-explosion', 'Releasing Grudge deals +8/stack + 2 blasts; every 4th Set deals +6.', { rules: [on(T.grudgeRelease, [{ do: 'damage', amount: 8, per: 'grudgeReleased' }, E.explode(A.random(2))], undefined, 'Rage Slam!'), on(T.nth(4), [E.damage(6)], undefined, 'Slam!')] }, 4, [1, 6]],
      '0-9': ['Payback', 'lorc/crossed-swords', 'First mistake between Sets deals 8 damage and makes your next Set ×1.3.', rule(T.mistake, [E.times(1.3), E.damage(8)], [C.firstMistakeSinceSet], 'Payback!'), 4, [2, 7]],
      '0-10': [
        'Badger Rampage',
        'lorc/wolverine-claws',
        'Hold 3 more grudges; Grudge release hits +12, blasts 2×2, and charges ×1.3.',
        { modifiers: { passiveTuning: { 'grudge.max': 3 } }, rules: [on(T.grudgeRelease, [E.explode(A.block(2, 2)), E.times(1.3), E.damage(12)], undefined, 'Rampage!')] },
        5,
        [1, 8],
      ],
      '0-5': ['Lucky Miss', 'lorc/clover', 'First mistake between Sets has a 50% chance to give a grace.', rule(T.mistake, [E.grace(1)], [C.firstMistakeSinceSet, C.chance(50)]), 2, [2, 4]],
      '1-6': ['Wild Guess', 'lorc/lightning-helix', 'First mistake between Sets has a 50% chance to double your next trigger.', rule(T.mistake, [E.doubleNext], [C.firstMistakeSinceSet, C.chance(50)]), 3, [4, 4]],
      '1-1': ['Burrow', 'lorc/clover', 'Start every wave with +2 graces and +3 damage on every Set.', { modifiers: { setDamage: 3 }, rules: [on(T.waveStart, [E.grace(2)])] }, 1, [5, 1]],
      '1-3': ['Hunker Down', 'lorc/checked-shield', 'Losing a heart gives a grace and explodes 2 random cards.', rule(T.hurt, [E.grace(1), E.explode(A.random(2))], undefined, 'Hunker!'), 2, [5, 2]],
      '1-2': ['Scavenger', 'lorc/crown-coin', 'First mistake between Sets drops 2 coins.', rule(T.mistake, [E.coins(2)], [C.firstMistakeSinceSet]), 2, [4, 2]],
      '1-4': ['Thicker Hide', 'lorc/turtle-shell', '1 more mistake each wave costs no heart.', tune('thickHide.perWave', 1), 2, [6, 3]],
      '1-5': ['Lucky Dig', 'lorc/cycle', 'Every 3rd Set grants a grace (50%) and every grace gained deals 10 damage.', { rules: [on(T.nth(3), [E.grace(1)], [C.chance(50)]), on(T.weapon('grace'), [E.damage(10)])] }, 3, [6, 4]],
      '1-7': ['Armored Hide', 'lorc/turtle', '1 more mistake each wave costs no heart.', tune('thickHide.perWave', 1), 3, [5, 5]],
      '1-8': ['Grace Strike', 'lorc/angel-outfit', 'Every grace save deals 10 shockwave damage and grants 1 mistake shield.', rule(T.graceUsed, [E.damage(10), E.shield(1)], undefined, 'Saved!'), 4, [5, 6]],
      '1-9': [
        'Stubborn',
        'lorc/diamond-hard',
        '2 more mistakes per fight cost no heart, and Sets deal +2 per grace held.',
        { modifiers: { freeMistakes: 2 }, rules: [on(T.set, [{ do: 'damage', amount: 2, per: 'grace' }])] },
        4,
        [4, 7],
      ],
      '1-10': ['Jackpot', 'delapouite/coins-pile', 'Releasing Grudge scoops a free Set + 4 coins; every 5th Set scoops 1.', { rules: [on(T.grudgeRelease, [E.autoSet, E.coins(4)], undefined, 'Jackpot!'), on(T.nth(5), [E.autoSet], undefined, 'Jackpot!')] }, 5, [5, 8]],
      'x-1': [
        'Grudge Match',
        'caro-asercion/badger',
        'Hold 1 more grudge, and 1 more mistake each wave costs no heart.',
        { modifiers: { passiveTuning: { 'grudge.max': 1, 'thickHide.perWave': 1 } } },
        3,
        [3, 4],
      ],
      'x-2': ['Bite Back', 'lorc/wolverine-claws', 'Grace save or hurt deals +8, charges ×1.3 next Set, and hurt heals 1 (40%).', { rules: [on(T.graceUsed, [E.times(1.3), E.damage(8)], undefined, 'Bite back!'), on(T.hurt, [E.times(1.3), E.damage(8)], undefined, 'Bite back!'), on(T.hurt, [E.heal(1)], [C.chance(40)])] }, 4, [3, 6]],
      'cap-1': ['Honey Badger', 'lorc/shining-heart', 'Releasing Grudge heals 1 + shield; every 4th Set heals 1 and deals +6.', { rules: [on(T.grudgeRelease, [E.heal(1), E.shield(1)], undefined, 'Tough!'), on(T.nth(4), [E.heal(1), E.damage(6)], undefined, 'Tough!')] }, 5, [3, 8]],
      'cap-2': ['Deep Sett', 'lorc/stone-block', 'Releasing Grudge caves in a 3×2 block of cards.', rule(T.grudgeRelease, [E.explode(A.block(3, 2))], undefined, 'Sett!'), 6, [3, 9], 'sealed'],
    },
    paths: [
      ['P1', '0-2', '0-1', '0-3', '0-4', '0-6', '0-8', '0-9', '0-10'],
      ['0-1', '0-7', '0-5', '0-4'],
      ['0-5', 'x-1', '1-6', '1-5'],
      ['P2', '1-1', '1-3', '1-4', '1-5', '1-7', '1-8', '1-9', '1-10'],
      ['1-3', '1-2', '1-6'],
      ['0-8', 'x-2', '1-8'],
      ['0-9', 'cap-1', '1-9'],
      ['cap-1', 'cap-2'],
    ],
    exclusivePairs: [
      ['0-10', '1-10'],
      ['0-9', '1-9'],
    ],
  },

  // Emperor Penguin: a snowflake. Patience (left) and Deep Freeze (right)
  // are the core; six arms radiate out. The left arms are slow heavy hits,
  // the right arms Rainbow hunting; the vertical arms are crossroads, power
  // upward (to the sealed crown) and evolutions downward. Twigs off the
  // vertical arms close the flake into rings.
  'Emperor Penguin': {
    roots: [[2, 4], [4, 4]],
    nodes: {
      '0-1': ['Cold Focus', 'lorc/snowflake-1', 'Patience triggers 0.2s/trait sooner and Patience Sets deal +2 more.', { modifiers: { passiveTuning: { 'patience.msPerTrait': -200, 'patience.damage': 2 } } }, 1, [1, 4]],
      '0-6': ['Glacier', 'lorc/stone-block', 'Patience Sets deal +2 more.', tune('patience.damage', 2), 3, [0, 4]],
      '0-2': ['Ice Fishing', 'lorc/crown-coin', 'Patience Sets drop 2 coins.', rule(T.set, [E.coins(2)], [C.patient]), 1, [1, 3]],
      '0-4': ['Icicle', 'lorc/snowflake-1', 'Patience Sets pierce the foe for +6 bonus sniper damage.', rule(T.set, [E.damage(6)], [C.patient], 'Icicle!'), 3, [0, 2]],
      '0-3': ['Thaw', 'lorc/hourglass', 'Patience Sets add +1s to the clock and heal 1 heart (50% chance).', { rules: [on(T.set, [E.time(1)], [C.patient]), on(T.set, [E.heal(1)], [C.patient, C.chance(50)])] }, 1, [1, 5]],
      '0-7': ['Cold Read', 'lorc/light-bulb', 'Patience Sets give you a hint.', rule(T.set, [E.hint(1)], [C.patient]), 2, [0, 6]],
      '1-1': ['Frostbite', 'lorc/snowflake-1', 'Deep Freeze lasts 1s longer.', tune('deepFreeze.ms', 1000), 1, [5, 4]],
      '1-6': ['Long Winter', 'lorc/hourglass', 'Deep Freeze lasts 1s longer.', tune('deepFreeze.ms', 1000), 3, [6, 4]],
      '1-2': ['Prism Eye', 'lorc/light-bulb', 'Rainbow Strikes give you a hint.', rule(T.rainbow, [E.hint(1)]), 1, [5, 3]],
      '1-5': ['Hailstorm', 'lorc/snowflake-1', 'Sets during Deep Freeze deal ×1.25; Rainbow Strikes deal +12 damage.', { modifiers: { conditionalMultiplier: [{ when: [C.frozen], multiplier: 1.25 }] }, rules: [on(T.rainbow, [E.damage(12)], undefined, 'Hail!')] }, 3, [6, 2]],
      '1-3': ['Cold Snap', 'lorc/stopwatch', 'Rainbow Strikes add +1s to the clock and clear all board traps.', rule(T.rainbow, [E.time(1), E.cleanse], undefined, 'Cold Snap!'), 1, [5, 5]],
      '1-4': ['Rainbow Hunter', 'lorc/rainbow-star', 'All-different Sets gain +0.15× multiplier and +6 base damage.', { modifiers: { rainbowMultiplierBonus: 0.15, conditionalDamage: [{ when: [C.rainbowSet], amount: 6 }] } }, 3, [6, 6]],
      '0-8': [
        'Perfect Strike',
        'lorc/rainbow-star',
        'A Rainbow Strike that is also a Patience Set deals +8.',
        { modifiers: { conditionalDamage: [{ when: [C.patient, C.rainbowSet], amount: 8 }] } },
        4,
        [3, 2],
      ],
      '0-10': ['Absolute Zero', 'delapouite/penguin', 'Patience Sets have a 50% chance to make a free Set for you.', rule(T.set, [E.autoSet], [C.patient, C.chance(50)], 'Absolute Zero!'), 6, [3, 1]],
      '0-9': ['Avalanche', 'lorc/crossed-swords', 'Patience Sets have a 60% chance to hit +10 and make your next Set ×1.3.', rule(T.set, [E.times(1.3), E.damage(10)], [C.patient, C.chance(60)], 'Avalanche!'), 5, [2, 1]],
      '1-10': ['Glacier Calving', 'lorc/diamond-hard', 'Rainbows gain +0.15× mult, +6 base damage, and empower the board (+3).', { modifiers: { rainbowMultiplierBonus: 0.15, conditionalDamage: [{ when: [C.rainbowSet], amount: 6 }] }, rules: [on(T.rainbow, [E.empower(3)], undefined, 'Calving!')] }, 5, [4, 1]],
      '1-7': ['Ice Mirror', 'lorc/mirror-mirror', 'Rainbow Strikes make your next weapon trigger fire twice.', rule(T.rainbow, [E.doubleNext]), 3, [3, 6]],
      '1-8': ['Frozen Prism', 'lorc/crystal-shine', 'Rainbow Strikes charge all evolutions +1 tick and turn 1 card Holo.', rule(T.rainbow, [E.chargeEvo('all', 1), E.convert('holo', 1)], undefined, 'Holo Charge!'), 4, [3, 7]],
      '0-5': ['Ice Shelf', 'lorc/lightning-helix', 'Patience Sets make your next weapon trigger fire twice.', rule(T.set, [E.doubleNext], [C.patient]), 3, [2, 7]],
      '1-9': ['Permafrost', 'lorc/time-trap', 'Rainbows during an evolution extend it by 4s.', rule(T.rainbow, [E.extend(4000)], [C.evolutionActive], '+4s Evo!'), 4, [4, 7]],
      'x-1': [
        'Still Waters',
        'lorc/floating-crystal',
        'Patience Sets deal +2 more, and Deep Freeze lasts 1s longer.',
        { modifiers: { passiveTuning: { 'patience.damage': 2, 'deepFreeze.ms': 1000 } } },
        3,
        [3, 3],
      ],
      'x-2': ['Huddle', 'lorc/heart-inside', 'Every Rainbow Strike hits +8, charges ×1.3 next Set, and grants 1 shield.', rule(T.rainbow, [E.times(1.3), E.shield(1), E.damage(8)], undefined, 'Huddle!'), 3, [3, 5]],
      'cap-1': ["Emperor's Crown", 'lorc/trophy', 'Patience Sets deal +6 more.', { modifiers: { conditionalDamage: [{ when: [C.patient], amount: 6 }] } }, 6, [3, 0], 'sealed'],
      'cap-2': ['Aurora', 'delapouite/falling-star', 'Every evolution starts with a 4s freeze of the clock and the foe.', rule(T.evolutionStart, [E.freeze(4000)], undefined, 'Aurora!'), 5, [3, 8]],
    },
    paths: [
      ['P1', '0-1', '0-6'],
      ['P1', '0-2', '0-4', '0-9', '0-10', '1-10', '1-5', '1-2', 'P2'],
      ['P1', '0-3', '0-7', '0-5', '1-8', '1-9', '1-4', '1-3', 'P2'],
      ['P2', '1-1', '1-6'],
      ['P1', 'x-1', 'P2'],
      ['x-1', '0-8', '0-10', 'cap-1'],
      ['P1', 'x-2', 'P2'],
      ['x-2', '1-7', '1-8', 'cap-2'],
    ],
    exclusivePairs: [
      ['cap-1', 'cap-2'],
      ['0-9', '1-10'],
    ],
  },

  // Corgi: a dog bone. Zoomies sits between the top knobs (board size on the
  // left knob, re-deals on the right), Fetch between the bottom knobs (rewards
  // left, fetch count right). Each knob is a little loop; the shaft is a
  // ladder of crossroads with the sealed Best Friend in the middle.
  Corgi: {
    roots: [[3, 1], [3, 8]],
    nodes: {
      '0-2': ['Big Yard', 'lorc/field', 'Every fight starts with 3 extra cards on the board.', rule(T.fightStart, [E.growBoard(3)]), 1, [2, 1]],
      '0-4': ['Wide Run', 'delapouite/card-exchange', 'While the board has 15+ cards, every Set deals +2.', { modifiers: { conditionalDamage: [{ when: [C.board(15)], amount: 2 }] } }, 2, [1, 0]],
      '0-7': ['Muddy Paws', 'lorc/fist', 'Whenever the board grows: 50% chance every card deals +1 more when matched.', rule(T.weapon('growth'), [E.empower(1)], [C.chance(50)]), 3, [1, 2]],
      '0-9': ['Stampede', 'caro-asercion/boar', 'While the board has 18+ cards, every Set deals +8 base damage and ×1.25.', { modifiers: { conditionalMultiplier: [{ when: [C.board(18)], multiplier: 1.25 }], conditionalDamage: [{ when: [C.board(18)], amount: 8 }] } }, 5, [0, 1]],
      '0-1': ['Eager', 'delapouite/jumping-dog', 'Zoomies come 1 Set sooner.', tune('zoomies.every', -1), 1, [4, 1]],
      '0-3': ['Dig', 'caro-asercion/mole', '10s without a Set: Corgi re-deals the board.', rule(T.idle(10000), [E.redeal], undefined, 'Dig!'), 2, [5, 0]],
      '0-5': ['Speedy', 'lorc/feather', 'Zoomies come 1 Set sooner.', tune('zoomies.every', -1), 3, [5, 2]],
      '0-6': ['Tail Chase', 'lorc/cycle', '3 Sets within 5s: re-deal the board clean.', rule(T.within(3, 5000), [E.redeal], undefined, 'Zoom!'), 4, [6, 1]],
      '0-8': ['Puppy Power', 'lorc/flat-star', 'Every Zoomies re-deal turns 2 cards into power cards.', tune('zoomies.powerCards', 2), 4, [3, 2]],
      '0-10': ['Top Dog', 'lorc/trophy', 'Board growth: 50% chance to hit +8 and make your next Set deal ×1.3.', rule(T.weapon('growth'), [E.times(1.3), E.damage(8)], [C.chance(50)], 'Top Dog!'), 4, [2, 3]],
      '1-8': ['Power Fetch', 'lorc/fist', 'Matching a power or gold card: 25% chance every card deals +1 more when matched.', rule(T.bonusCard, [E.empower(1)], [C.chance(25)], 'Power!'), 4, [4, 3]],
      'x-1': ['Good Boy', 'delapouite/sitting-dog', 'Matching a power or gold card grows the board by 1 card.', rule(T.bonusCard, [E.growBoard(1)]), 3, [3, 4]],
      'x-2': [
        'Herding',
        'lorc/crossed-swords',
        'With 15+ cards on the board, matching a power or gold card deals 4 more.',
        rule(T.bonusCard, [E.damage(4)], [C.board(15)]),
        3,
        [2, 5],
      ],
      'cap-1': ['Frisbee Frenzy', 'lorc/cracked-ball-dunk', '3 Sets within 5s: deal 8 damage and turn 1 card into a power card.', rule(T.within(3, 5000), [E.damage(8), E.convert('power', 1)], undefined, 'Frisbee!'), 5, [4, 5]],
      'cap-2': ['Best Friend', 'lorc/shining-heart', 'Every 5th Set: Corgi makes a free Set and deals 6 bonus damage.', rule(T.nth(5), [E.autoSet, E.damage(6)], undefined, 'Best Friend!'), 6, [3, 6], 'sealed'],
      '1-7': ['Jackpot Pup', 'lorc/lightning-helix', 'Matching a power or gold card makes your next weapon trigger fire twice.', rule(T.bonusCard, [E.doubleNext]), 3, [3, 7]],
      '1-1': ['Treat', 'lorc/shining-heart', 'Matching a power or gold card has a 50% chance to heal 1.', rule(T.bonusCard, [E.heal(1)], [C.chance(50)]), 1, [2, 8]],
      '1-3': ['Shiny!', 'lorc/stopwatch', 'Matching a power or gold card adds +2s to the clock.', rule(T.bonusCard, [E.time(2)]), 2, [1, 7]],
      '1-4': ['Good Nose', 'lorc/light-bulb', 'Matching a power or gold card gives you a hint.', rule(T.bonusCard, [E.hint(1)]), 2, [1, 9]],
      '1-9': ['Lucky Find', 'lorc/crystal-shine', 'Matching a bonus card: 30% chance to turn 1 card Holo & charge evos +1.', rule(T.bonusCard, [E.convert('holo', 1), E.chargeEvo('all', 1)], [C.chance(30)], 'Lucky Holo!'), 4, [0, 8]],
      '1-2': ['Fetch Two', 'delapouite/sitting-dog', 'Fetch brings 1 more bonus card.', tune('fetch.count', 1), 2, [4, 8]],
      '1-5': ['Dig Up', 'lorc/crown-coin', 'Matching a bonus card turns 2 cards into Power and drops 2 coins.', rule(T.bonusCard, [E.convert('power', 2), E.coins(2)], undefined, 'Dig Up!'), 2, [5, 9]],
      '1-6': ['Fetch Three', 'delapouite/token', 'Fetch brings 1 more bonus card.', tune('fetch.count', 1), 3, [5, 7]],
      '1-10': ['Best in Show', 'lorc/trophy', 'Matching a bonus card empowers the board (+2) and spawns 2 Power cards.', rule(T.bonusCard, [E.empower(2), E.convert('power', 2)], undefined, 'Best in Show!'), 5, [6, 8]],
    },
    paths: [
      ['P1', '0-2', '0-4', '0-9', '0-7', '0-2'],
      ['P1', '0-1', '0-3', '0-6', '0-5', '0-1'],
      ['P1', '0-8', '0-10', 'x-1', '1-8', '0-8'],
      ['0-7', '0-10'],
      ['0-5', '1-8'],
      ['x-1', 'x-2', 'cap-2', 'cap-1', 'x-1'],
      ['cap-2', '1-7', 'P2'],
      ['P2', '1-1', '1-3', '1-9', '1-4', '1-1'],
      ['P2', '1-2', '1-6', '1-10', '1-5', '1-2'],
      ['1-3', 'x-2'],
      ['1-6', 'cap-1'],
    ],
    exclusivePairs: [
      ['0-9', '1-10'],
      ['0-10', '1-9'],
    ],
  },

  // Pelican: two waves braided together. Big Scoop's strand (free Sets)
  // starts top left, Keen Eye's (hints) top right; they swap sides at the
  // Riptide crossing, curl back and meet again at High Tide, with the sealed
  // Tidal Wave breaking below.
  Pelican: {
    roots: [[1, 0], [5, 0]],
    nodes: {
      '0-2': ['Full Belly', 'lorc/shining-heart', 'Sets at full hearts deal +4, and the first Set of each wave heals 1 heart.', { modifiers: { conditionalDamage: [{ when: [C.heartsFull], amount: 4 }] }, rules: [on(T.firstSetOfWave, [E.heal(1)])] }, 1, [0, 1]],
      '0-1': ['Deep Pouch', 'delapouite/eating-pelican', 'Big Scoop comes 1 Set sooner.', tune('scoop.every', -1), 2, [0, 2]],
      '0-3': ['Tide Pool', 'lorc/echo-ripples', 'The first Set of each wave scoops a bonus Set.', rule(T.firstSetOfWave, [E.autoSet]), 2, [1, 2]],
      '0-5': ['Splash', 'lorc/crown-coin', 'Every 4th Set turns 2 cards to Gold and has a 50% chance to heal 1.', { rules: [on(T.nth(4), [E.convert('gold', 2)], undefined, 'Splash!'), on(T.nth(4), [E.heal(1)], [C.chance(50)])] }, 2, [1, 3]],
      '0-6': ['Gulp', 'lorc/hourglass', 'Every 6th Set clears all traps and scoops a free Set.', rule(T.nth(6), [E.cleanse, E.autoSet], undefined, 'Gulp!'), 3, [2, 4]],
      '0-4': ['Bigger Bill', 'lorc/feather', 'Big Scoop comes 1 Set sooner.', tune('scoop.every', -1), 3, [4, 6]],
      '0-7': ["Fisherman's Luck", 'lorc/rainbow-star', 'Rainbow Strikes scoop a bonus Set.', rule(T.rainbow, [E.autoSet]), 3, [5, 7]],
      '0-9': ['Pelican Dive', 'lorc/hawk-emblem', '3 Sets within 8s scoop a 4th for free and deal 4 damage.', rule(T.within(3, 8000), [E.autoSet, E.damage(4)], undefined, 'Dive!'), 4, [6, 8]],
      '0-8': ['Feeding Frenzy', 'lorc/crystal-shine', 'Every evolution starts by scooping 2 free Sets.', rule(T.evolutionStart, [E.autoSet, E.autoSet], undefined, 'Frenzy!'), 4, [5, 9]],
      '0-10': ['Bottomless Pouch', 'lorc/gems', 'Big Scoop Sets trigger every weapon you hold once.', tune('scoop.weaponTriggers', 1), 5, [4, 10]],
      '1-2': ['Sea Breeze', 'lorc/light-bulb', 'Start every wave with a free hint.', rule(T.waveStart, [E.hint(1)]), 1, [6, 1]],
      '1-1': ['Sharp Eye', 'lorc/sheikah-eye', 'Keen Eye glows 2s sooner.', tune('keenEye.ms', -2000), 2, [6, 2]],
      '1-3': ['Spotter', 'lorc/archery-target', 'Every hint you use deals 4 damage and grants a grace.', rule(T.hintUsed, [E.damage(4), E.grace(1)]), 2, [5, 2]],
      '1-5': ['Lighthouse', 'lorc/stopwatch', 'Every hint you use adds +2s to the clock.', rule(T.hintUsed, [E.time(2)]), 2, [5, 3]],
      '1-6': ['Calm Waters', 'lorc/heart-bottle', 'Losing a heart gives a hint and has a 35% chance to heal 1 heart back.', { rules: [on(T.hurt, [E.hint(1)]), on(T.hurt, [E.heal(1)], [C.chance(35)], 'Calm!')] }, 3, [4, 4]],
      '1-4': ['Eagle Eye', 'lorc/third-eye', 'Keen Eye glows 2s sooner.', tune('keenEye.ms', -2000), 3, [2, 6]],
      '1-7': ['Hint Hoard', 'lorc/floating-crystal', 'Every 3rd Set gives you a hint.', rule(T.nth(3), [E.hint(1)]), 3, [1, 7]],
      '1-8': ['Beacon', 'lorc/light-bulb', 'Using a hint has a 50% chance to scoop a free Set and drop 3 coins.', rule(T.hintUsed, [E.autoSet, E.coins(3)], [C.chance(50)], 'Beacon!'), 4, [0, 8]],
      '1-9': ['Clear Skies', 'lorc/mirror-mirror', 'Every hint you use has a 1-in-3 chance to simplify the board for 8s.', rule(T.hintUsed, [E.simplify(8000)], [C.chance(33)], 'Clear!'), 4, [1, 9]],
      '1-10': ['All-Seeing', 'lorc/brainstorm', 'Every hint you use deals 10 damage and makes your next Set deal ×1.3.', rule(T.hintUsed, [E.times(1.3), E.damage(10)], undefined, 'Seen it!'), 5, [2, 10]],
      'x-1': [
        'Riptide',
        'lorc/cycle',
        'Big Scoop comes 1 Set sooner, and Keen Eye glows 1s sooner.',
        { modifiers: { passiveTuning: { 'scoop.every': -1, 'keenEye.ms': -1000 } } },
        4,
        [3, 5],
      ],
      'x-2': ['High Tide', 'lorc/echo-ripples', 'Every hint you use has a 25% chance to scoop a free Set.', rule(T.hintUsed, [E.autoSet], [C.chance(25)], 'High Tide!'), 5, [3, 11]],
      'cap-1': ['Tidal Wave', 'lorc/echo-ripples', 'Rainbow Strikes scoop 2 free Sets and turn 2 cards to Gold.', rule(T.rainbow, [E.autoSet, E.autoSet, E.convert('gold', 2)], undefined, 'Tidal Wave!'), 6, [3, 12], 'sealed'],
    },
    paths: [
      ['P1', '0-2', '0-1', '0-5', '0-6', 'x-1', '0-4', '0-7', '0-9', '0-8', '0-10', 'x-2', 'cap-1'],
      ['0-2', '0-3', '0-5'],
      ['0-9', '0-10'],
      ['P2', '1-2', '1-1', '1-5', '1-6', 'x-1', '1-4', '1-7', '1-8', '1-9', '1-10', 'x-2'],
      ['1-2', '1-3', '1-5'],
      ['1-7', '1-9'],
    ],
    exclusivePairs: [
      ['0-10', '1-10'],
      ['0-8', '1-8'],
    ],
  },
};

// ─── Build the node list ────────────────────────────────────────────────────

const ROOT_KEYS = ['P1', 'P2'] as const;

const buildTree = (fighter: CharacterName): SkillNode[] => {
  const spec = TREES[fighter];
  const passives = FIGHTERS.find(f => f.name === fighter)!.passives;
  const idOf = (key: string) => `${SLUG[fighter]}-${key}`;
  const links = new Map<string, Set<string>>(Object.keys(spec.nodes).map(k => [k, new Set<string>()]));
  const roots = new Map<string, Set<PassiveId>>(Object.keys(spec.nodes).map(k => [k, new Set<PassiveId>()]));
  for (const path of spec.paths) {
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1], path[i]];
      const ra = ROOT_KEYS.indexOf(a as 'P1'), rb = ROOT_KEYS.indexOf(b as 'P1');
      if (ra >= 0 && rb >= 0) continue;
      if (ra >= 0) roots.get(b)?.add(passives[ra]);
      else if (rb >= 0) roots.get(a)?.add(passives[rb]);
      else {
        links.get(a)?.add(b);
        links.get(b)?.add(a);
      }
    }
  }
  const exclusive = new Map<string, string>();
  for (const [a, b] of spec.exclusivePairs ?? []) {
    exclusive.set(a, idOf(b));
    exclusive.set(b, idOf(a));
  }
  const costs = scaleCosts(Object.values(spec.nodes).map(row => row[4]));
  return Object.entries(spec.nodes).map(([key, [name, icon, text, body, , [col, row], sealed]], i): SkillNode => ({
    id: idOf(key),
    fighter,
    name,
    text,
    cost: costs[i],
    icon,
    pos: { col, row },
    links: [...(links.get(key) ?? [])].map(idOf),
    roots: [...(roots.get(key) ?? [])],
    ...(sealed ? { requires: { starsEarned: SEALED_AT } } : {}),
    ...(exclusive.has(key) ? { exclusiveWith: exclusive.get(key) } : {}),
    ...body,
  }));
};

export const SKILL_NODES: SkillNode[] = (Object.keys(TREES) as CharacterName[]).flatMap(buildTree);

const BY_ID = new Map(SKILL_NODES.map(n => [n.id, n]));

/** A fighter's nodes, in authoring order. */
export const skillTreeOf = (fighter: CharacterName): SkillNode[] => SKILL_NODES.filter(n => n.fighter === fighter);

export const getSkillNode = (id: string): SkillNode | undefined => BY_ID.get(id);

/** Maximum active stars a fighter can equip at once (capped at 65% of TREE_BUDGET). */
export const fighterActiveStarCap = (earnedStars: number): number => Math.min(earnedStars, ACTIVE_TREE_CAP);

/** If `nodeId` is mutually exclusive with an already-owned node, returns that conflicting node. */
export const exclusiveConflictFor = (ownedNodeIds: readonly string[], nodeId: string): SkillNode | undefined => {
  const node = BY_ID.get(nodeId);
  if (!node?.exclusiveWith) return undefined;
  return ownedNodeIds.includes(node.exclusiveWith) ? BY_ID.get(node.exclusiveWith) : undefined;
};

/** Where a fighter's two passive roots sit on its tree map (same order as `passives`). */
export const skillTreeRoots = (fighter: CharacterName): { passive: PassiveId; pos: TreePos }[] => {
  const passives = FIGHTERS.find(f => f.name === fighter)!.passives;
  return TREES[fighter].roots.map(([col, row], i) => ({ passive: passives[i], pos: { col, row } }));
};
