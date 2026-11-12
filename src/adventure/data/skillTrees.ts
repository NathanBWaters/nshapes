/**
 * Skill trees: 20 nodes per fighter, two branches of 10. Branch 0 grows from
 * the fighter's first passive, branch 1 from the second (data/fighters.ts).
 * Nodes are bought with stars, in order (depth 1 → 10), and every node is a
 * RuleSource: rules and modifiers in the shared vocabulary (rules/types.ts).
 *
 * Design rules (keep these true when editing):
 *  - Costs by depth: 1, 1, 1, 2, 2, 3, 3, 4, 5, 6 (28 per branch).
 *  - About a third of the nodes tune the passive (`passiveTuning` deltas, keys
 *    from data/passives.ts); the rest chain systems together, nudge a play
 *    pattern or change how weapons behave. Depths 8–10 define a build.
 *  - `text` is exact and short (≤ 90 chars) and says what the data does,
 *    assuming the earlier nodes of the branch are owned.
 *  - No bare "+1 heart" nodes.
 */
import type { CharacterName } from '@/types';
import type { IconName } from '@/components/Icon';
import type { SkillNode } from '../types';
import type { Area, Condition, Effect, Modifiers, Rule, Trigger } from '../rules/types';

export const SKILL_NODE_COSTS = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6] as const;

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
type Row = [name: string, icon: IconName, text: string, body: Body];

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
  /** Emperor Penguin's Patience window (6 s, the passive's default `patience.ms`) */
  patient: { kind: 'timeSinceLastSetAtLeast', ms: 6000 } as Condition,
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
  simplify: (ms: number): Effect => ({ do: 'simplify', ms }),
  freeze: (ms: number): Effect => ({ do: 'freeze', ms }),
  extend: (ms: number): Effect => ({ do: 'extendEvolutions', ms }),
  combo: (amount: number): Effect => ({ do: 'comboStep', amount }),
  times: (times: number): Effect => ({ do: 'nextSetMultiplier', times }),
  doubleNext: { do: 'doubleNext' } as Effect,
  redeal: { do: 'redeal' } as Effect,
  autoSet: { do: 'autoSet' } as Effect,
  catalyst: { do: 'spawnCatalyst' } as Effect,
};

// ─── The trees ──────────────────────────────────────────────────────────────

const TREES: Record<CharacterName, [Row[], Row[]]> = {
  // Orange Tabby — risky brawler. Branch 0: Nine Lives (survive, heal into power). Branch 1: Scrappy (low hearts hit hard).
  'Orange Tabby': [
    [
      ['Purr Punch', 'lorc/fist', 'Every heal also deals 2 damage to the foe.', rule(T.healed, [E.damage(2)])],
      ['Warm Lap', 'lorc/shining-heart', 'The first Set of each wave heals 1 heart.', rule(T.firstSetOfWave, [E.heal(1)])],
      ['Spare Life', 'lorc/cat', 'Nine Lives works twice per fight.', tune('nineLives.charges', 1)],
      ['Hiss', 'lorc/bright-explosion', 'Losing a heart explodes 2 random cards.', rule(T.hurt, [E.explode(A.random(2))], undefined, 'Hiss!')],
      ['Catnip', 'lorc/clover', 'Every explosion has a 25% chance to heal 1 heart.', rule(T.weapon('explosion'), [E.heal(1)], [C.chance(25)])],
      ['Last Breath', 'lorc/snowflake-1', 'Dropping to 1 heart freezes the clock and the foe for 3s.', rule(T.hurt, [E.freeze(3000)], [C.heartsAtMost(1)])],
      ['Extra Life', 'lorc/heart-bottle', 'Nine Lives gains another charge (3 per fight).', tune('nineLives.charges', 1)],
      ['Kamikaze Kitty', 'lorc/bright-explosion', 'While at 1 heart, every Set explodes a 2×2 block.', rule(T.set, [E.explode(A.block(2, 2))], [C.heartsAtMost(1)], 'Kamikaze!')],
      ['Sunbeam', 'lorc/laser-warning', 'Every heal fires a row laser.', rule(T.healed, [E.laser(A.row)], undefined, 'Sunbeam!')],
      ['Ninth Life Fury', 'lorc/skull-crack', 'Every heart you lose makes your next Set deal ×3.', rule(T.hurt, [E.times(3)], undefined, 'Fury ×3!')],
    ],
    [
      ['Scuffle', 'lorc/claw-slashes', 'Losing a heart deals 3 damage to the foe.', rule(T.hurt, [E.damage(3)])],
      ['Lick Wounds', 'lorc/heart-inside', 'Every 4th Set heals 1 heart.', rule(T.nth(4), [E.heal(1)])],
      ['Hot-Blooded', 'lorc/campfire', 'Every mistake sets 2 cards on fire.', rule(T.mistake, [E.ignite(2)])],
      ['Street Smarts', 'lorc/fist', 'Scrappy: +2 damage per missing heart (was +1).', tune('scrappy.perHeart', 1)],
      ['Rebound', 'lorc/bright-explosion', 'Every heal explodes 2 random cards.', rule(T.healed, [E.explode(A.random(2))])],
      ['Second Helping', 'lorc/crossed-swords', 'After every heal, your next Set deals ×2.', rule(T.healed, [E.times(2)])],
      ['Alley Cat', 'lorc/wolverine-claws', 'Scrappy: +3 damage per missing heart.', tune('scrappy.perHeart', 1)],
      ['Blood Rage', 'lorc/laser-blast', 'Every heart you lose fires a row laser and a column laser.', rule(T.hurt, [E.laser(A.row), E.laser(A.column)], undefined, 'Blood Rage!')],
      ['Cornered', 'lorc/broken-heart', 'While at 1 heart, every Set deals +5.', { modifiers: { conditionalDamage: [{ when: [C.heartsAtMost(1)], amount: 5 }] } }],
      ['Feral Frenzy', 'lorc/lightning-helix', 'While at 1 heart, every Set makes your next weapon trigger fire twice.', rule(T.set, [E.doubleNext], [C.heartsAtMost(1)], 'Frenzy!')],
    ],
  ],

  // Sly Fox — speed. Branch 0: Combo (stretch it, cash it into lasers and blasts). Branch 1: Hot Streak (keep it maxed, double everything).
  'Sly Fox': [
    [
      ['Quick Paws', 'lorc/stopwatch', 'Combo window +1s (Sets within 6s chain).', tune('combo.windowMs', 1000)],
      ['Tailwind', 'lorc/hourglass', 'Every Set at Combo 2+ adds +1s to the clock.', rule(T.set, [E.time(1)], [C.combo(2)])],
      ['Sniff Out', 'lorc/light-bulb', 'Going 5s without a Set gives you a hint.', rule(T.idle(5000), [E.hint(1)])],
      ['Long Tail', 'lorc/lightning-branches', 'Combo goes up to +6 (was +4).', tune('combo.max', 2)],
      ['Coin Trick', 'lorc/crown-coin', 'Every Set at Combo 3+ drops a coin.', rule(T.set, [E.coins(1)], [C.combo(3)])],
      ['Spark Step', 'lorc/campfire', 'Every card set on fire adds a Combo step.', rule(T.weapon('fire'), [E.combo(1)])],
      ['Fleet Foot', 'lorc/feather', 'Combo window +1s more (Sets within 7s chain).', tune('combo.windowMs', 1000)],
      ['Chain Lightning', 'lorc/laser-warning', 'At Combo 4+, every Set fires a column laser.', rule(T.set, [E.laser(A.column)], [C.combo(4)], 'Zap!')],
      ['Fox Trot', 'lorc/laser-blast', '3 Sets within 6s fire a row laser.', rule(T.within(3, 6000), [E.laser(A.row)], undefined, 'Fox Trot!')],
      ['Foxfire', 'lorc/fireball', 'At Combo 4+, every Set explodes a 3×2 block.', rule(T.set, [E.explode(A.block(3, 2))], [C.combo(4)], 'Foxfire!')],
    ],
    [
      ['Warm Up', 'lorc/sword-clash', 'The first Set of each wave adds 2 Combo steps.', rule(T.firstSetOfWave, [E.combo(2)])],
      ['Blaze', 'lorc/campfire', 'At Combo 4+, every Set ignites 2 cards.', rule(T.set, [E.ignite(2)], [C.combo(4)])],
      ['Prism Dash', 'lorc/rainbow-star', 'Rainbow Strikes add 2 Combo steps.', rule(T.rainbow, [E.combo(2)])],
      ['Scorcher', 'lorc/fireball', 'Hot Streak hits ×3 (was ×2).', tune('hotStreak.multiplier', 1)],
      ['Overdrive', 'lorc/lightning-helix', '3 Sets within 4s: your next weapon trigger fires twice.', rule(T.within(3, 4000), [E.doubleNext], undefined, 'Overdrive!')],
      ['Echo Step', 'lorc/echo-ripples', 'Every echo adds a Combo step.', rule(T.weapon('echo'), [E.combo(1)])],
      ['Showstopper', 'lorc/flat-star', 'Hot Streak hits ×4.', tune('hotStreak.multiplier', 1)],
      ['Flash Fire', 'lorc/fire-ring', 'At Combo 4+, every Set makes your next weapon trigger fire twice.', rule(T.set, [E.doubleNext], [C.combo(4)])],
      ['Afterburn', 'lorc/bright-explosion', 'Every explosion adds a Combo step.', rule(T.weapon('explosion'), [E.combo(1)])],
      ['Blaze of Glory', 'lorc/trophy', 'At Combo 4+, every Set also makes your next Set deal ×2.', rule(T.set, [E.times(2)], [C.combo(4)], 'Glory!')],
    ],
  ],

  // Badger — gambler. Branch 0: Grudge (mistakes are ammo). Branch 1: Thick Hide (mistakes are cheap, sometimes free money).
  Badger: [
    [
      ['Bad Temper', 'lorc/fist', 'Each grudge releases +4 damage (was +3).', tune('grudge.damage', 1)],
      ['Snarl', 'lorc/bestial-fangs', 'Every mistake also bites the foe for 2.', rule(T.mistake, [E.damage(2)])],
      ['Seething', 'lorc/skull-crack', 'Hold up to 4 grudges (was 3).', tune('grudge.max', 1)],
      ['Lash Out', 'lorc/bright-explosion', 'Every mistake explodes 2 random cards.', rule(T.mistake, [E.explode(A.random(2))])],
      ['Lucky Miss', 'lorc/clover', 'Each mistake has a 50% chance to give you a grace.', rule(T.mistake, [E.grace(1)], [C.chance(50)])],
      ['Vendetta', 'lorc/claw-slashes', 'Each grudge releases +6 damage.', tune('grudge.damage', 2)],
      ['Hard Lesson', 'lorc/light-bulb', 'Every mistake gives you a hint.', rule(T.mistake, [E.hint(1)])],
      ['Rage Beam', 'lorc/laser-warning', 'Every mistake fires a row laser.', rule(T.mistake, [E.laser(A.row)], undefined, 'Rage!')],
      ['Payback', 'lorc/crossed-swords', 'Every mistake makes your next Set deal ×2.', rule(T.mistake, [E.times(2)], undefined, 'Payback!')],
      [
        'Badger Rampage',
        'lorc/laser-blast',
        'Hold 3 more grudges, and every mistake fires a column laser.',
        { modifiers: { passiveTuning: { 'grudge.max': 3 } }, rules: [on(T.mistake, [E.laser(A.column)], undefined, 'Rampage!')] },
      ],
    ],
    [
      ['Burrow', 'lorc/clover', 'Start every wave with +1 grace.', rule(T.waveStart, [E.grace(1)])],
      ['Scavenger', 'lorc/crown-coin', 'Every mistake drops 2 coins.', rule(T.mistake, [E.coins(2)])],
      ['Hunker Down', 'lorc/checked-shield', 'Losing a heart gives you a grace.', rule(T.hurt, [E.grace(1)])],
      ['Thicker Hide', 'lorc/turtle-shell', 'Your first 2 mistakes each wave cost no heart.', tune('thickHide.perWave', 1)],
      ['Lucky Dig', 'lorc/cycle', 'Every grace you gain deals 3 damage.', rule(T.weapon('grace'), [E.damage(3)])],
      ['Wild Guess', 'lorc/lightning-helix', 'Each mistake has a 50% chance to make your next weapon trigger fire twice.', rule(T.mistake, [E.doubleNext], [C.chance(50)])],
      ['Armored Hide', 'lorc/turtle', 'Your first 3 mistakes each wave cost no heart.', tune('thickHide.perWave', 1)],
      ['Grace Strike', 'lorc/angel-outfit', 'Every grace save fires a column laser.', rule(T.graceUsed, [E.laser(A.column)], undefined, 'Saved!')],
      ['Stubborn', 'lorc/diamond-hard', '2 more mistakes per fight cost no heart.', { modifiers: { freeMistakes: 2 } }],
      ['Jackpot', 'delapouite/coins-pile', 'Every mistake has a 1-in-3 chance to make a free Set for you.', rule(T.mistake, [E.autoSet], [C.chance(33)], 'Jackpot!')],
    ],
  ],

  // Emperor Penguin — precision. Branch 0: Patience (slow Sets, 6s+ apart, hit like freight trains). Branch 1: Deep Freeze (Rainbow hunter).
  'Emperor Penguin': [
    [
      ['Cold Focus', 'lorc/snowflake-1', 'Patience Sets deal +4 (was +3).', tune('patience.damage', 1)],
      ['Ice Fishing', 'lorc/crown-coin', 'Patience Sets drop 2 coins.', rule(T.set, [E.coins(2)], [C.patient])],
      ['Thaw', 'lorc/hourglass', 'Patience Sets add +2s to the clock.', rule(T.set, [E.time(2)], [C.patient])],
      ['Icicle', 'lorc/laser-warning', 'Patience Sets fire a column laser.', rule(T.set, [E.laser(A.column)], [C.patient], 'Icicle!')],
      ['Ice Shelf', 'lorc/lightning-helix', 'Patience Sets make your next weapon trigger fire twice.', rule(T.set, [E.doubleNext], [C.patient])],
      ['Glacier', 'lorc/stone-block', 'Patience Sets deal +6.', tune('patience.damage', 2)],
      ['Cold Read', 'lorc/light-bulb', 'Patience Sets give you a hint.', rule(T.set, [E.hint(1)], [C.patient])],
      [
        'Perfect Strike',
        'lorc/rainbow-star',
        'A Rainbow Strike that is also a Patience Set deals +8.',
        { modifiers: { conditionalDamage: [{ when: [C.patient, C.rainbowSet], amount: 8 }] } },
      ],
      ['Avalanche', 'lorc/bright-explosion', 'Patience Sets explode a 3×2 block.', rule(T.set, [E.explode(A.block(3, 2))], [C.patient], 'Avalanche!')],
      ['Absolute Zero', 'delapouite/penguin', 'Every Patience Set also makes a free Set for you.', rule(T.set, [E.autoSet], [C.patient], 'Absolute Zero!')],
    ],
    [
      ['Frostbite', 'lorc/snowflake-1', 'Deep Freeze lasts 5s (was 4s).', tune('deepFreeze.ms', 1000)],
      ['Prism Eye', 'lorc/light-bulb', 'Rainbow Strikes give you a hint.', rule(T.rainbow, [E.hint(1)])],
      ['Cold Snap', 'lorc/stopwatch', 'Rainbow Strikes add +3s to the clock.', rule(T.rainbow, [E.time(3)])],
      ['Rainbow Hunter', 'lorc/rainbow-star', 'Rainbow Strikes deal ×2.5 (was ×2).', { modifiers: { rainbowMultiplierBonus: 0.5 } }],
      ['Hailstorm', 'lorc/laser-warning', 'Rainbow Strikes fire a row laser.', rule(T.rainbow, [E.laser(A.row)], undefined, 'Hail!')],
      ['Long Winter', 'lorc/hourglass', 'Deep Freeze lasts 7s.', tune('deepFreeze.ms', 2000)],
      ['Ice Mirror', 'lorc/mirror-mirror', 'Rainbow Strikes make your next weapon trigger fire twice.', rule(T.rainbow, [E.doubleNext])],
      ['Frozen Catalyst', 'lorc/crystal-shine', 'Rainbow Strikes put an Evolution Catalyst on the board.', rule(T.rainbow, [E.catalyst], undefined, 'Catalyst!')],
      ['Permafrost', 'lorc/time-trap', 'Rainbows during an evolution extend it by 4s.', rule(T.rainbow, [E.extend(4000)], [C.evolutionActive], '+4s Evo!')],
      ['Glacier Calving', 'lorc/diamond-hard', 'Rainbow Strikes shatter a 3×3 block of cards.', rule(T.rainbow, [E.explode(A.block(3, 3))], undefined, 'Calving!')],
    ],
  ],

  // Corgi — board shaper. Branch 0: Zoomies (big, clean, fast-changing boards). Branch 1: Fetch (bonus cards breed bonus cards).
  Corgi: [
    [
      ['Eager', 'delapouite/jumping-dog', 'Zoomies every 4th Set (was every 5th).', tune('zoomies.every', -1)],
      ['Big Yard', 'lorc/field', 'Every fight starts with 3 extra cards on the board.', rule(T.fightStart, [E.growBoard(3)])],
      ['Dig', 'caro-asercion/mole', '10s without a Set: Corgi re-deals the board.', rule(T.idle(10000), [E.redeal], undefined, 'Dig!')],
      ['Wide Run', 'delapouite/card-exchange', 'While the board has 15+ cards, every Set deals +2.', { modifiers: { conditionalDamage: [{ when: [C.board(15)], amount: 2 }] } }],
      ['Speedy', 'lorc/feather', 'Zoomies every 3rd Set.', tune('zoomies.every', -1)],
      ['Tail Chase', 'lorc/cycle', '3 Sets within 5s: re-deal the board clean.', rule(T.within(3, 5000), [E.redeal], undefined, 'Zoom!')],
      ['Muddy Paws', 'lorc/fist', 'Whenever the board grows, every card gains +1 power.', rule(T.weapon('growth'), [E.empower(1)])],
      ['Puppy Power', 'lorc/flat-star', 'Every Zoomies re-deal turns 3 cards into power cards.', tune('zoomies.powerCards', 3)],
      ['Stampede', 'caro-asercion/boar', 'While the board has 18+ cards, every Set explodes a 2×2 block.', rule(T.set, [E.explode(A.block(2, 2))], [C.board(18)], 'Stampede!')],
      ['Top Dog', 'lorc/trophy', 'Every time the board grows, your next Set deals ×2.', rule(T.weapon('growth'), [E.times(2)], undefined, 'Top Dog!')],
    ],
    [
      ['Treat', 'lorc/shining-heart', 'Matching a power or gold card has a 50% chance to heal 1.', rule(T.bonusCard, [E.heal(1)], [C.chance(50)])],
      ['Fetch Two', 'delapouite/sitting-dog', 'Fetch brings 2 new bonus cards (was 1).', tune('fetch.count', 1)],
      ['Shiny!', 'lorc/stopwatch', 'Matching a power or gold card adds +2s to the clock.', rule(T.bonusCard, [E.time(2)])],
      ['Good Nose', 'lorc/light-bulb', 'Matching a power or gold card gives you a hint.', rule(T.bonusCard, [E.hint(1)])],
      ['Dig Up', 'lorc/bright-explosion', 'Matching a power or gold card explodes 2 random cards.', rule(T.bonusCard, [E.explode(A.random(2))])],
      ['Fetch Three', 'delapouite/token', 'Fetch brings 3 new bonus cards.', tune('fetch.count', 1)],
      ['Jackpot Pup', 'lorc/lightning-helix', 'Matching a power or gold card makes your next weapon trigger fire twice.', rule(T.bonusCard, [E.doubleNext])],
      ['Power Fetch', 'lorc/fist', 'Matching a power or gold card has a 50% chance to give every card +1 power.', rule(T.bonusCard, [E.empower(1)], [C.chance(50)], 'Power!')],
      ['Lucky Find', 'lorc/crystal-shine', 'Matching a power or gold card has a 25% chance to spawn a Catalyst.', rule(T.bonusCard, [E.catalyst], [C.chance(25)], 'Catalyst!')],
      ['Best in Show', 'lorc/laser-blast', 'Matching a power or gold card fires a column laser and doubles your next Set.', rule(T.bonusCard, [E.laser(A.column), E.times(2)], undefined, 'Best in Show!')],
    ],
  ],

  // Pelican — relaxed. Branch 0: Big Scoop (free Sets everywhere). Branch 1: Keen Eye (hints become weapons).
  Pelican: [
    [
      ['Deep Pouch', 'delapouite/eating-pelican', 'Big Scoop every 5th Set (was every 6th).', tune('scoop.every', -1)],
      ['Full Belly', 'lorc/shining-heart', 'Sets made at full hearts deal +2.', { modifiers: { conditionalDamage: [{ when: [C.heartsFull], amount: 2 }] } }],
      ['Tide Pool', 'lorc/echo-ripples', 'The first Set of each wave scoops a bonus Set.', rule(T.firstSetOfWave, [E.autoSet])],
      ['Bigger Bill', 'lorc/feather', 'Big Scoop every 4th Set.', tune('scoop.every', -1)],
      ['Splash', 'lorc/bright-explosion', 'Every 4th Set explodes 2 random cards.', rule(T.nth(4), [E.explode(A.random(2))], undefined, 'Splash!')],
      ['Gulp', 'lorc/hourglass', '12s without a Set: Pelican scoops one for you.', rule(T.idle(12000), [E.autoSet], undefined, 'Gulp!')],
      ["Fisherman's Luck", 'lorc/rainbow-star', 'Rainbow Strikes scoop a bonus Set.', rule(T.rainbow, [E.autoSet])],
      ['Feeding Frenzy', 'lorc/crystal-shine', 'Every evolution starts by scooping 2 free Sets.', rule(T.evolutionStart, [E.autoSet, E.autoSet], undefined, 'Frenzy!')],
      ['Pelican Dive', 'lorc/hawk-emblem', '3 Sets within 8s scoop a 4th for free.', rule(T.within(3, 8000), [E.autoSet], undefined, 'Dive!')],
      ['Bottomless Pouch', 'lorc/gems', 'Big Scoop Sets trigger every weapon you hold once.', tune('scoop.weaponTriggers', 1)],
    ],
    [
      ['Sharp Eye', 'lorc/sheikah-eye', 'Keen Eye glows after 6s (was 8s).', tune('keenEye.ms', -2000)],
      ['Sea Breeze', 'lorc/light-bulb', 'Start every wave with a free hint.', rule(T.waveStart, [E.hint(1)])],
      ['Spotter', 'lorc/archery-target', 'Every hint you use deals 2 damage.', rule(T.hintUsed, [E.damage(2)])],
      ['Eagle Eye', 'lorc/third-eye', 'Keen Eye glows after 4s.', tune('keenEye.ms', -2000)],
      ['Lighthouse', 'lorc/stopwatch', 'Every hint you use adds +2s to the clock.', rule(T.hintUsed, [E.time(2)])],
      ['Calm Waters', 'lorc/heart-bottle', '10s without a Set heals 1 heart.', rule(T.idle(10000), [E.heal(1)])],
      ['Hint Hoard', 'lorc/floating-crystal', 'Every 3rd Set gives you a hint.', rule(T.nth(3), [E.hint(1)])],
      ['Beacon', 'lorc/laser-warning', 'Every hint you use fires a column laser.', rule(T.hintUsed, [E.laser(A.column)], undefined, 'Beacon!')],
      ['Clear Skies', 'lorc/mirror-mirror', 'Every hint you use has a 1-in-3 chance to simplify the board for 8s.', rule(T.hintUsed, [E.simplify(8000)], [C.chance(33)], 'Clear!')],
      ['All-Seeing', 'lorc/brainstorm', 'Every hint you use makes your next Set deal ×2.', rule(T.hintUsed, [E.times(2)], undefined, 'Seen it!')],
    ],
  ],
};

export const SKILL_NODES: SkillNode[] = (Object.keys(TREES) as CharacterName[]).flatMap(fighter =>
  TREES[fighter].flatMap((rows, b) =>
    rows.map(([name, icon, text, body], i): SkillNode => ({
      id: `${SLUG[fighter]}-${b}-${i + 1}`,
      fighter,
      branch: b as 0 | 1,
      depth: i + 1,
      name,
      text,
      cost: SKILL_NODE_COSTS[i],
      icon,
      ...body,
    }))
  )
);

const BY_ID = new Map(SKILL_NODES.map(n => [n.id, n]));

/** A fighter's 20 nodes, branch 0 then branch 1, each by depth. */
export const skillTreeOf = (fighter: CharacterName): SkillNode[] => SKILL_NODES.filter(n => n.fighter === fighter);

export const getSkillNode = (id: string): SkillNode | undefined => BY_ID.get(id);
