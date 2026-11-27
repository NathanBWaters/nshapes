/**
 * The campaign. Edit this table to rebalance or reorder the adventure.
 *
 * Design rules (keep these true when editing):
 *  - Every level `introduces` exactly one mechanic, in a sensible order.
 *  - Teach it, then reward USING it: the ★★★ challenge of an introduction
 *    level asks you to use the new thing, and its ★★ reward makes that easier.
 *  - Every level is a small puzzle: rules + foe + hazard + challenge point at
 *    a tactic the player's current tools can solve.
 *  - Every star pays coins; some stars also unlock a weapon, fighter, Arcana,
 *    evolution recipe or campaign system. Weapon rewards alternate offense and
 *    support, clearest and most useful first.
 *  - ★ = survive (moves used up / clock runs out with hearts left)
 *  - ★★ = knock out every foe
 *  - ★★★ = knock out every foe AND meet the challenge
 *  - Side branches (`branchOf`) are SECRET: they are not on the map until they
 *    open (★★ on their parent, or `opensAt`), and they never block the main
 *    path. A branch may hang off another branch (World 3–4 routes).
 *    Fighter trials hang off the level whose ★★ recruits that fighter.
 *  - Practice levels (`rules.sandbox`) are secret paths too, but earn nothing:
 *    they live in PRACTICE_LEVELS, outside the campaign's LEVELS.
 *  - [GP-09] Non-boss & standard levels enforce a ≤2 simultaneous external
 *    pressure budget (Shading Surge, Specific Counter-Parry, Board Hazards,
 *    Active Foe Board-Disruption Tick), reserving 3 exclusively for `5-5`.
 *  - [GP-01] & [GP-17] Campaign HPs are calibrated for elevated base damage,
 *    the 15-node Synergy Graph, per-weapon timed evolutions, and
 *    `LONG_ROUNDS = { foeHp: 1.25, timer: 1.25 }` (75–110s W2–5 fights;
 *    160s `4-11`, 180s `5-5`).
 */
import type { AttributeName } from '@/types';
import type { AdventureSave, LevelDef, RewardDef } from '../types';
import { resolveParrySpec } from './parry';

const A2: AttributeName[] = ['shape', 'color'];
const A3: AttributeName[] = ['shape', 'color', 'number'];
// Worlds 3-5 play on A3 too: shading only switches on during a Shading Surge (rules.shadingSurge)

/** Authoring shape: coins may be omitted on a star and are filled in by `normalizeRewards`. */
type RewardInput = Partial<RewardDef>;
type LevelInput = Omit<LevelDef, 'rewards'> & {
  rewards: { star1: RewardInput; star2: RewardInput; star3: RewardInput };
};

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Every star pays coins. Missing amounts are derived so they always rise ★ → ★★ → ★★★. */
const normalizeRewards = (l: LevelInput): LevelDef['rewards'] => {
  const c1 = l.rewards.star1.coins ?? round5(20 * l.coinMultiplier);
  const c3 = l.rewards.star3.coins ?? round5(Math.max(50 * l.coinMultiplier, c1 * 2));
  const c2 = l.rewards.star2.coins ?? round5((c1 + c3) / 2);
  return {
    star1: { ...l.rewards.star1, coins: c1 },
    star2: { ...l.rewards.star2, coins: c2 },
    star3: { ...l.rewards.star3, coins: c3 },
  };
};

const RAW_LEVELS: LevelInput[] = [
  // ════════════════════ 1 · SUNNY MEADOW — gentle flow, early powers, bite-sized goals (no clock) ════════════════════
  {
    id: '1-1', biome: 'meadow', name: 'First Light', introduces: 'set_rule',
    // The first level can't be lost: make 5 Sets (5 × 6 base = 30 HP). Stars are about accuracy, and ★1 grants Blast Powder!
    rules: { attributes: A2, boardSize: 9, hearts: 0, noGear: true },
    foes: [{ name: 'Dozy Bunny', icon: 'delapouite/rabbit', hp: 30, taunt: 'Zzz… huh? A challenger?' }],
    challenge: { kind: 'noMistakes' }, starRule: { kind: 'accuracy', threeStarMax: 0, twoStarMax: 2 },
    coinMultiplier: 1, difficulty: 1,
    rewards: {
      star1: { coins: 20, weapons: ['blast-powder'] },
      star2: { coins: 30 },
      star3: { coins: 50 },
    },
  },
  {
    id: '1-2', biome: 'meadow', name: 'Red Clover', introduces: 'hearts',
    // Gentle 2-trait flow with Blast Powder already firing! Spot 2 all-orange Sets for ★★★.
    // ★★ unlocks Rainbow Charm — the intro hunt weapon that powers up all-different Sets right before 1-3!
    rules: { attributes: A2, boardSize: 9, moves: 8, hearts: 5 },
    foes: [{ name: 'Prickle', icon: 'caro-asercion/hedgehog', hp: 95, taunt: 'Careful, I\'m pointy.' }],
    challenge: { kind: 'colorSets', color: 'red', n: 2 }, coinMultiplier: 1, difficulty: 1,
    rewards: { star1: { coins: 10 }, star2: { coins: 20, weapons: ['rainbow-charm'] }, star3: { coins: 35 } },
    recommended: ['Orange Tabby'],
  },
  {
    id: '1-3', biome: 'meadow', name: 'All Kinds', introduces: 'all_different',
    // Practice spotting 3 different shapes + 3 different colors on the friendly 9-card board — Rainbow Charm powers up each one!
    rules: { attributes: A2, boardSize: 9, moves: 8, hearts: 5 },
    foes: [{ name: 'Clover Frog', icon: 'lorc/frog', hp: 200, taunt: 'Ribbit! Can you mix all three?' }],
    challenge: { kind: 'allDiffSets', n: 2 }, coinMultiplier: 1, difficulty: 1,
    rewards: { star1: { coins: 15 }, star2: { coins: 25, weapons: ['mending-charm'] }, star3: { coins: 40 } },
  },
  {
    id: '1-4', biome: 'meadow', name: 'Boom Practice', introduces: 'charm',
    // [GP-16] Sunny Gecko lightweight visual sight gag: hops onto 1 card for 3s every 3 Sets.
    // All 3 charm slots are now full (Blast Powder + Rainbow Charm + Mending Charm)!
    rules: { attributes: A2, boardSize: 9, moves: 9, hearts: 5 },
    foes: [{ enemy: 'Sunny Gecko', hp: 320, taunt: 'Whoa — watch where you point that powder!' }],
    challenge: { kind: 'explosions', n: 2 }, coinMultiplier: 1.1, difficulty: 1,
    rewards: {
      star1: { coins: 15 },
      star2: { weapons: ['rally-horn'] },
      star3: { coins: 45 },
    },
  },
  {
    id: '1-5', biome: 'meadow', name: 'Counting Acorns', introduces: 'attr_number',
    // First 3-trait (12-card) board! Scanning one color at a time makes 12 cards feel effortless.
    rules: { attributes: A3, boardSize: 12, moves: 9, hearts: 5 },
    foes: [{ name: 'Nutkin', icon: 'delapouite/squirrel', hp: 230, taunt: 'One, two, three… mine!' }],
    challenge: { kind: 'sameColorSets', n: 2 }, coinMultiplier: 1.1, difficulty: 1,
    rewards: { star1: { coins: 15 }, star2: { coins: 25 }, star3: { coins: 50 } },
  },
  {
    id: '1-6', biome: 'meadow', name: 'Rainbow Hunt', introduces: 'rainbow',
    // First 3-trait all-different hunt! Equip Rainbow Charm to amplify every Rainbow Set; ★★★ levels Rainbow Charm up.
    rules: { attributes: A3, boardSize: 12, moves: 10, hearts: 4 },
    foes: [{ name: 'Prism Moth', icon: 'lorc/evil-bat', hp: 310, taunt: 'Every color of the sky!' }],
    challenge: { kind: 'rainbows', n: 2 }, coinMultiplier: 1.2, difficulty: 2,
    rewards: { star1: { coins: 20 }, star2: { weapons: ['field-stone'] }, star3: { coins: 55, weapons: ['rainbow-charm'] } },
  },
  {
    id: '1-7', biome: 'meadow', name: 'Star Power', introduces: 'skill_tree',
    // Spend earned stars in Camp on your fighter's skill tree and land a 12+ damage Set!
    rules: { attributes: A3, boardSize: 12, moves: 10, hearts: 4 },
    foes: [{ name: 'Old Quillback', icon: 'caro-asercion/porcupine', hp: 295, taunt: 'Seen a hundred like you. Hit harder.' }],
    challenge: { kind: 'bigHit', n: 12 }, coinMultiplier: 1.2, difficulty: 2,
    rewards: {
      star1: { coins: 20 },
      star2: { weapons: ['pinata'] },
      star3: { coins: 55 },
    },
    recommended: ['Orange Tabby', 'Sly Fox'],
  },
  {
    id: '1-8', biome: 'meadow', name: 'Shiny Loot', introduces: 'coins',
    // [GP-16] Golden Mole playful 1-rule flair: gleams over 1 random card as a +2¢ Gold card!
    // Introduces Coin Drops and bursts open any pre-1-8 hidden purse!
    rules: { attributes: A3, boardSize: 12, moves: 10, hearts: 4 },
    foes: [{ enemy: 'Golden Mole', hp: 300, taunt: 'Hands off my shiny stash!' }],
    challenge: { kind: 'streak', n: 4 }, coinMultiplier: 1.3, difficulty: 2,
    rewards: {
      star1: { coins: 25, unlockFeature: 'coins' },
      star2: { weapons: ['clarity-lens'] },
      star3: { coins: 60 },
    },
  },
  {
    id: '1-9', biome: 'meadow', name: 'Fuse Meadow', introduces: 'time_bombs',
    // Gentle 20s fuses and 3 defuses for ★★★; ★1 opens the Workshop so players can spend their coin stash!
    rules: { attributes: A3, boardSize: 12, moves: 10, hearts: 4, hazards: { timeBombs: { every: 7, seconds: 20 } } },
    foes: [{ name: 'Bumble Bomber', icon: 'lorc/bee', hp: 340, taunt: 'Bzz… tick… bzz… tick…' }],
    challenge: { kind: 'defuseTraps', n: 3 }, coinMultiplier: 1.4, difficulty: 2,
    rewards: {
      star1: { coins: 25, unlockFeature: 'workshop' },
      star2: { weapons: ['prismatic-ray'] },
      star3: { coins: 65 },
    },
  },
  {
    id: '1-10', biome: 'meadow', name: 'Shell Shock', introduces: 'triple_card', isBoss: true,
    // World 1 Boss (290 HP): break the armored card while generous fuses tick.
    // ★1 awards Blast Powder's starter evolution (`blast-powder:cluster-charge`), unlocks the 4th Weapon Slot, & opens Bounties!
    rules: { attributes: A3, boardSize: 15, moves: 12, hearts: 5, hazards: { timeBombs: { every: 14, seconds: 22 } } },
    foes: [{ enemy: 'Iron Shell', hp: 450, taunt: 'Nothing gets through this shell.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.6, difficulty: 3,
    rewards: {
      star1: { coins: 40, evolution: 'blast-powder:cluster-charge' },
      star2: { weapons: ['war-drum'] },
      star3: { coins: 100, arcana: 'monochrome_pact' },
    },
    recommended: ['Sly Fox'],
  },

  // ════════════════════ 2 · WHISPERING WOODS — the clock, first evolution, snares, hints, graces (4 slots!) ════════════════════
  {
    id: '2-1', biome: 'woods', name: 'Ticking Clock', introduces: 'timer',
    // Puzzle: the sloth smothers time weapons, so win FAST instead. Chrono Shard (★) starts you with more
    // clock; Flint Spark (★★) introduces fire ignition right as Whispering Woods begins.
    rules: { attributes: A3, timer: 64, hearts: 4 },
    foes: [{ enemy: 'Lazy Sloth', hp: 656, taunt: 'Take… your… time…' }],
    challenge: { kind: 'timeLeft', n: 12 }, coinMultiplier: 1.5, difficulty: 2,
    rewards: { star1: { coins: 30, weapons: ['chrono-shard'] }, star2: { weapons: ['flint-spark'] }, star3: { coins: 120 } },
    recommended: ['Sly Fox'],
  },
  {
    id: '2-2', biome: 'woods', name: 'Evolution Rising', introduces: 'evolutions',
    // Timed round gives per-weapon timed evolutions room to shine! Equip Blast Powder (Cluster Charge)
    // and trigger ONE Evolution for ★★★ (never penalizing fast play!).
    rules: { attributes: A3, timer: 68, hearts: 4, extraEvolutionDurationMs: 4000 },
    foes: [{ name: 'Cinder Toad', icon: 'lorc/frog', hp: 1000, taunt: 'Ribbit. I was born in a bonfire.' }],
    challenge: { kind: 'evolutions', n: 1 }, coinMultiplier: 1.5, difficulty: 2,
    rewards: {
      star1: { coins: 30, weapons: ['life-vessel'] },
      star2: { weapons: ['catalyst-prism'] },
      star3: { coins: 75, weapons: ['flint-spark'] },
    },
  },
  {
    id: '2-3', biome: 'woods', name: 'Tangled Thicket', introduces: 'snares',
    // Puzzle: never match the snared card; match the card its arrow points at for +8.
    rules: { attributes: A3, timer: 68, hearts: 4, hazards: { snares: { every: 5 } } },
    foes: [{ name: 'Thicket Spider', icon: 'carl-olsen/spider-face', hp: 1040, taunt: 'Step where I point. Or don\'t.' }],
    challenge: { kind: 'defuseTraps', n: 4 }, coinMultiplier: 1.6, difficulty: 3,
    rewards: { star1: { coins: 35, weapons: ['magnet'] }, star2: { weapons: ['growth-seed'] }, star3: { coins: 140 } },
  },
  {
    id: '2-4', biome: 'woods', name: 'A Little Help', introduces: 'hints',
    // Puzzle: the bandit kills auto-hints, so the bulb is yours to press. Seeker Lens (★★) refills it.
    rules: { attributes: A3, timer: 64, hearts: 3, startingHints: 3 },
    foes: [{ enemy: 'Masked Bandit', hp: 1136, taunt: 'No free peeks in my woods.' }],
    challenge: { kind: 'useHints', n: 2 }, coinMultiplier: 1.6, difficulty: 2,
    rewards: {
      star1: { coins: 35, weapons: ['chaos-shard'] },
      star2: { weapons: ['seeker-lens'] },
      star3: { coins: 140 },
    },
  },
  {
    id: '2-5', biome: 'woods', name: 'Power Up', introduces: 'power_cards',
    // Puzzle: the squirrel hoards refills and the board shrinks. Corgi (★★) fetches new power cards
    // and Zoomies re-deals a full board.
    rules: { attributes: A3, timer: 68, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Greedy Squirrel', hp: 1400, taunt: 'Two cards for you. The rest? Mine.' }],
    challenge: { kind: 'bonusCards', n: 4 }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 35, weapons: ['war-drum'] }, star2: {}, star3: { coins: 80, weapons: ['chain-gang'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-6', biome: 'woods', name: 'Junk Drawer', introduces: 'duds',
    // Puzzle: duds clog the board; blasts clear them. Blast Powder (★★) levels up to clear them faster.
    rules: { attributes: A3, timer: 64, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Junk Rat', hp: 1240, taunt: 'One rat\'s junk is… still junk.' }],
    challenge: { kind: 'explosions', n: 3 }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 40, weapons: ['snowball'] }, star2: { weapons: ['blast-powder'] }, star3: { coins: 90, weapons: ['connector'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-7', biome: 'woods', name: 'Lights Out', introduces: 'face_down',
    // Puzzle: make Sets to flip hidden cards, then use one. Oracle Eye (★★) points the way.
    rules: { attributes: A3, timer: 64, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Night Owl', hp: 1080, taunt: 'Whooo can see in the dark?' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 40, weapons: ['odd-one-out'] }, star2: { weapons: ['oracle-eye'] }, star3: { coins: 90, weapons: ['time-drop'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-8', biome: 'woods', name: 'Near Miss', introduces: 'graces',
    // Puzzle: near misses save your heart while graces last. Badger makes the first mistake each wave free.
    rules: { attributes: A3, timer: 68, hearts: 3, startingHints: 1, startingGraces: 2 },
    foes: [{ name: 'Whisker Trickster', icon: 'lorc/mouse', hp: 1120, taunt: 'Close enough? Let\'s find out.' }],
    challenge: { kind: 'graceSaves', n: 1 }, coinMultiplier: 1.8, difficulty: 3,
    rewards: {
      star1: { coins: 45, weapons: ['second-chance'] },
      star2: {},
      star3: { coins: 160 },
    },
    recommended: ['Badger'],
  },
  {
    id: '2-9', biome: 'woods', name: 'Prism Rush', introduces: 'purity_chain',
    // Puzzle: climb 1-diff → 2-diff on purpose. Emperor Penguin pays you to slow down and pick.
    rules: { attributes: A3, timer: 72, hearts: 3, startingHints: 1, startingGraces: 1 },
    foes: [{ name: 'Magpie', icon: 'lorc/raven', hp: 1120, taunt: 'Shiny! Shiny! MINE!' }],
    challenge: { kind: 'purityChain', n: 2 }, coinMultiplier: 1.8, difficulty: 3,
    rewards: { star1: { coins: 45, weapons: ['greedy-chest'] }, star2: {}, star3: { coins: 100, weapons: ['prismatic-ray'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '2-10', biome: 'woods', name: 'The Web', introduces: 'bombs', isBoss: true,
    // World 2 Boss (920 runtime HP): Trap Weaver bombs + Counter-Parry (≤2 pressures cleanly!). ★1 unlocks the 5th Weapon Slot!
    rules: { attributes: A3, timer: 76, hearts: 5, startingHints: 1, startingGraces: 1 },
    foes: [{ enemy: 'Trap Weaver', hp: 1880, taunt: 'Step lightly. Everything here is wired.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.4, difficulty: 4,
    rewards: { star1: { coins: 70, weapons: ['tightrope'] }, star2: { weapons: ['clarity-lens'] }, star3: { coins: 160, arcana: 'controlled_burn' } },
    recommended: ['Emperor Penguin', 'Badger'],
  },

  // ════════════════════ 3 · EMBER CANYON — shading, charms, waves, shop, XP, Arcana (5 slots!) ════════════════════
  {
    id: '3-1', biome: 'canyon', name: 'Fourth Dimension', introduces: 'attr_shading',
    // Puzzle: shading switches on for 15s and every Set gets +12 base & ×1.8. Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 72, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ name: 'Dusty Mammoth', icon: 'delapouite/mammoth', hp: 2800, taunt: 'Solid. Striped. Open. Crushed.' }],
    challenge: { kind: 'surgeSets', n: 1 }, coinMultiplier: 2.2, difficulty: 3,
    rewards: { star1: { coins: 60, weapons: ['bounty-poster'] }, star2: { weapons: ['amplifier-coil'] }, star3: { coins: 140, weapons: ['mirror-shard'] } },
  },
  {
    id: '3-2', biome: 'canyon', name: 'Sabotage!', introduces: 'charm_slots',
    // Puzzle: the goblin halves three weapon kinds. Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 84, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Goblin Saboteur', hp: 2880, taunt: 'Nice gear. Shame if something happened to it.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.3, difficulty: 3,
    rewards: { star1: { coins: 65, weapons: ['devils-bargain'] }, star2: { weapons: ['fortunes-favor'] }, star3: { coins: 230 } },
  },
  {
    id: '3-3', biome: 'canyon', name: 'Marching Ants', introduces: 'waves',
    // Puzzle: three small foes. Open each wave with your biggest Set. Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 80, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [
      { name: 'Scout Ant', icon: 'delapouite/ant', hp: 1536 },
      { name: 'Soldier Ant', icon: 'delapouite/ant', hp: 2018 },
      { name: 'Queen Ant', icon: 'delapouite/ant', hp: 2687, taunt: 'You squashed my children!' },
    ],
    challenge: { kind: 'bigHit', n: 60 }, coinMultiplier: 2.4, difficulty: 3,
    rewards: { star1: { coins: 70, weapons: ['collectors-album'] }, star2: { weapons: ['rally-horn'] }, star3: { coins: 150, weapons: ['life-vessel'] } },
  },
  {
    id: '3-4', biome: 'canyon', name: 'Market Day', introduces: 'shop',
    // [GP-18] Breather / recovery node: generous timer (105s), lighter HP, high coin payout!
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 84, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [
      { name: 'Pickpocket Hyena', icon: 'caro-asercion/hyena-head', hp: 2211 },
      { name: 'Haggling Hyena', icon: 'caro-asercion/hyena-head', hp: 2800 },
      { name: 'Hyena Boss', icon: 'caro-asercion/hyena-head', hp: 3389, taunt: 'Everything has a price!' },
    ],
    challenge: { kind: 'shopBuys', n: 2 }, coinMultiplier: 2.6, difficulty: 3,
    rewards: { star1: { coins: 80, weapons: ['twin-seed'] }, star2: { weapons: ['fortunes-favor'] }, star3: { coins: 170, arcana: 'overkill_harvest' } },
  },
  {
    id: '3-5', biome: 'canyon', name: 'Level Up!', introduces: 'xp',
    // Puzzle: every Set is XP; level thrice for ★★★. Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 76, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ name: 'Busy Beaver', icon: 'delapouite/beaver', hp: 3600, taunt: 'I\'ve been training all season.' }],
    challenge: { kind: 'levelUps', n: 3 }, coinMultiplier: 2.5, difficulty: 3,
    rewards: {
      star1: { coins: 80, weapons: ['scholars-tome'] },
      star2: {},
      star3: { coins: 180, arcana: 'scholars_gambit' },
    },
    recommended: ['Pelican'],
  },
  {
    id: '3-6', biome: 'canyon', name: 'Fortune\'s Wheel', introduces: 'arcana_slots',
    // Puzzle: stack two Arcana for one enormous hit. Surge + Counter-Parry = 2 pressures. (Wicked Imp 2× pts → effHp 1750)
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 76, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Wicked Imp', hp: 19040, taunt: 'Double or nothing, little hero?' }],
    challenge: { kind: 'bigHit', n: 90 }, coinMultiplier: 2.6, difficulty: 4,
    rewards: {
      star1: { coins: 80, arcana: 'tempo_surge' },
      star2: { arcana: 'prismatic_fever' },
      star3: { coins: 180, weapons: ['catalyst-prism'] },
    },
  },
  {
    id: '3-7', biome: 'canyon', name: 'Mole Hole', introduces: 'card_removal',
    // [GP-09] & [GP-18] Breather showcase: drop Surge so Burrowing Mole + Counter-Parry = 2 clean pressures.
    rules: { attributes: A3, boardSize: 15, timer: 80, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Burrowing Mole', hp: 8640, taunt: 'Dig, dig, dig… gone!' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.7, difficulty: 4,
    rewards: { star1: { coins: 80, weapons: ['fog-lantern'] }, star2: { weapons: ['growth-seed'] }, star3: { coins: 180, weapons: ['echo-stone'] } },
    recommended: ['Corgi'],
  },
  {
    id: '3-8', biome: 'canyon', name: 'Color Me Gone', introduces: 'attr_shift',
    // [GP-09] Drop Surge so Shifting Chameleon + Counter-Parry = 2 clean pressures.
    rules: { attributes: A3, boardSize: 15, timer: 76, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Shifting Chameleon', hp: 3360, taunt: 'Now you see me…' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.7, difficulty: 4,
    rewards: { star1: { coins: 90, weapons: ['wild-card'] }, star2: { weapons: ['chaos-shard'] }, star3: { coins: 280 } },
    recommended: ['Pelican', 'Sly Fox'],
  },
  {
    id: '3-9', biome: 'canyon', name: 'Sticky Talons', introduces: 'time_steal',
    // Puzzle: every Set costs 5s, so make few, big ones. Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 84, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Thieving Raven', hp: 4160, taunt: 'Your seconds look delicious.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.8, difficulty: 4,
    rewards: { star1: { coins: 90, weapons: ['glass-sword'] }, star2: { weapons: ['chrono-shard'] }, star3: { coins: 200, weapons: ['flint-spark'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '3-10', biome: 'canyon', name: 'Stampede', introduces: 'inactivity', isBoss: true,
    // World 3 Boss (2,600 runtime HP): [GP-09] Counter-Parry + Charging Boar Inactivity = 2 sharp pressures!
    rules: {
      attributes: A3, boardSize: 15, timer: 88, hearts: 8, startingHints: 2, startingGraces: 1,
    },
    foes: [{ enemy: 'Charging Boar', hp: 11600, taunt: 'Stand still and I\'ll flatten you.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.5, difficulty: 5,
    rewards: { star1: { coins: 130, weapons: ['hot-potato'] }, star2: { weapons: ['mending-charm'] }, star3: { coins: 300, weapons: ['second-chance'] } },
    recommended: ['Sly Fox', 'Pelican'],
  },

  // ════════════════════ 4 · FROZEN PEAKS — surge stacking, stacked builds ════════════════════
  {
    id: '4-1', biome: 'peaks', name: 'Ride the Wave', introduces: 'surge_stack',
    // Puzzle: stack elevated bases, Synergy hooks, and Evolutions with the surge's +12 & ×1.8. Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 76, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ name: 'Snow Hare', icon: 'delapouite/rabbit', hp: 9200, taunt: 'Here comes the wave. Can you surf it?' }],
    challenge: { kind: 'bigHit', n: 40 }, coinMultiplier: 3.2, difficulty: 4,
    rewards: { star1: { coins: 120, weapons: ['understudy'] }, star2: { weapons: ['fortune-token'] }, star3: { coins: 260, weapons: ['encore-mask'] } },
    recommended: ['Pelican'],
  },
  {
    id: '4-2', biome: 'peaks', name: 'Buzzing', introduces: 'fast_timer',
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 76, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Swift Bee', hp: 8160, taunt: 'Bzzz! Faster! FASTER!' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.4, difficulty: 4,
    rewards: { star1: { coins: 130, weapons: ['mirror-shard'] }, star2: { weapons: ['time-drop'] }, star3: { coins: 280, weapons: ['echo-stone'] } },
    recommended: ['Sly Fox', 'Emperor Penguin'],
  },
  {
    id: '4-3', biome: 'peaks', name: 'Circling', introduces: 'regen',
    // [GP-18] Breather / recovery node: generous timer (105s), lighter HP, high coins; 6 explosions for ★★★.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 84, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Circling Vulture', hp: 9600, taunt: 'I can wait. I always wait.' }],
    challenge: { kind: 'explosions', n: 6 }, coinMultiplier: 3.6, difficulty: 4,
    rewards: { star1: { coins: 135, weapons: ['bounty-poster'] }, star2: { weapons: ['fortunes-favor'] }, star3: { coins: 390 } },
  },
  {
    id: '4-4', biome: 'peaks', name: 'Glass Cannon', introduces: 'double_damage',
    // Stinging Scorpion (2× pts → effHp 2600); Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 76, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Stinging Scorpion', hp: 38400, taunt: 'One sting is all it takes.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.6, difficulty: 5,
    rewards: { star1: { coins: 140, weapons: ['odd-one-out', 'devils-bargain'] }, star2: { weapons: ['life-vessel'] }, star3: { coins: 300, weapons: ['clarity-lens'] } },
    recommended: ['Orange Tabby'],
  },
  {
    id: '4-5', biome: 'peaks', name: 'Cold Justice', introduces: 'invalid_punish',
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 76, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Punishing Ermine', hp: 9600, taunt: 'Every mistake will be punished.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.7, difficulty: 5,
    rewards: { star1: { coins: 145, weapons: ['fog-lantern'] }, star2: { weapons: ['second-chance'] }, star3: { coins: 310, weapons: ['chrono-shard'] } },
    recommended: ['Emperor Penguin', 'Pelican'],
  },
  {
    id: '4-6', biome: 'peaks', name: 'Tick Tock', introduces: 'countdown',
    // [GP-09] Drop Surge & redundant timeBombs so Ticking Viper's countdown + Counter-Parry = 2 clean pressures!
    rules: { attributes: A3, boardSize: 15, timer: 80, hearts: 10, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Ticking Viper', hp: 9600, taunt: 'Tick… tock… hisss.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.8, difficulty: 5,
    rewards: { star1: { coins: 150, weapons: ['rust'] }, star2: { weapons: ['field-stone'] }, star3: { coins: 320, weapons: ['seeker-lens'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '4-7', biome: 'peaks', name: 'Wild Goose Chase', introduces: 'shuffle',
    // [GP-09] & [GP-18] Breather / recovery node: drop Surge, generous 110s timer, lighter HP!
    rules: { attributes: A3, boardSize: 15, timer: 88, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Wild Goose', hp: 14000, taunt: 'HONK! Where\'d your Set go?' }],
    challenge: { kind: 'streak', n: 6 }, coinMultiplier: 4.0, difficulty: 5,
    rewards: { star1: { coins: 155, weapons: ['tar-pit'] }, star2: { weapons: ['growth-seed'] }, star3: { coins: 330, weapons: ['pinata'] } },
  },
  {
    id: '4-8', biome: 'peaks', name: 'Polar Night', introduces: 'polar',
    // Polar Guardian (2× pts → effHp 3000); Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 80, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Polar Guardian', hp: 36000, taunt: 'The cold forgives nothing.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4, difficulty: 5,
    rewards: { star1: { coins: 160, weapons: ['decoy'] }, star2: { weapons: ['pinata'] }, star3: { coins: 340, weapons: ['connector'] } },
    recommended: ['Pelican', 'Badger'],
  },
  {
    id: '4-9', biome: 'peaks', name: 'The Glare', introduces: 'one_eyed',
    // [GP-09] & [GP-16] Drop Surge & redundant timeBombs; One-Eyed Terror's Gaze Drain + Counter-Parry = 2 pressures (manual hints open!).
    rules: { attributes: A3, boardSize: 15, timer: 80, hearts: 7, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'One-Eyed Terror', hp: 10000, taunt: 'Meet my gaze — if you dare!' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4.1, difficulty: 5,
    rewards: { star1: { coins: 165, weapons: ['long-fuse'] }, star2: { weapons: ['magnet'] }, star3: { coins: 350, weapons: ['chaos-shard'] } },
    recommended: ['Pelican', 'Emperor Penguin'],
  },
  {
    id: '4-10', biome: 'peaks', name: 'Fang Gully', introduces: 'feral',
    // [GP-09] Drop Surge & redundant snares so Feral Fangs + Counter-Parry = 2 pressures!
    rules: { attributes: A3, boardSize: 15, timer: 84, hearts: 8, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Feral Fangs', hp: 17200, taunt: 'Duds, armor, and teeth. Pick one.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4.2, difficulty: 5,
    rewards: { star1: { coins: 170, weapons: ['ice-block'] }, star2: { weapons: ['fortune-token'] }, star3: { coins: 360, weapons: ['snowball'] } },
    recommended: ['Corgi'],
  },
  {
    id: '4-11', biome: 'peaks', name: 'Dragon\'s Roost', introduces: 'dragon', isBoss: true,
    // World 4 Boss (8,400 runtime HP, 2× pts → effHp 4,200; 160s timer):
    // [GP-16] Focused Ancient Dragon (2 Dragon Scales + 1.35× clock + Dragonfire Surge) + Rainbow Counter-Parry!
    rules: {
      attributes: A3, shadingSurge: true, boardSize: 18, timer: 128, hearts: 7, startingHints: 5, startingGraces: 2,
    },
    foes: [{ enemy: 'Ancient Dragon', hp: 73600, taunt: 'I was old when the mountains were young.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 6, difficulty: 5,
    rewards: { star1: { coins: 300, weapons: ['magnet'] }, star2: { weapons: ['second-chance'] }, star3: { coins: 900, weapons: ['prismatic-ray'] } },
    recommended: ['Emperor Penguin', 'Pelican'],
  },

  // ════════════════════ 5 · STARFALL SUMMIT — crisp 2-pressure gauntlet + 3-head final boss ════════════════════
  {
    id: '5-1', biome: 'summit', name: 'Drowned Gear', introduces: 'kraken',
    // [GP-09] & [GP-16] Kraken Tentacle Lock + Counter-Parry = 2 sharp pressures (zero blanket -50% negation!).
    rules: {
      attributes: A3, boardSize: 15, timer: 84, hearts: 11, startingHints: 3, startingGraces: 2,
    },
    foes: [{ enemy: 'Kraken\'s Grasp', hp: 17200, taunt: 'Snap my tentacles — if you can!' }],
    challenge: { kind: 'evolutions', n: 3 }, coinMultiplier: 6, difficulty: 5,
    rewards: { star1: { coins: 300, weapons: ['snowball'] }, star2: { weapons: ['oracle-eye'] }, star3: { coins: 900, weapons: ['blast-powder'] } },
    recommended: ['Emperor Penguin', 'Corgi'],
  },
  {
    id: '5-2', biome: 'summit', name: 'The Devourer', introduces: 'world_eater',
    // [GP-09] & [GP-18] Breather valley: World Eater (25s Heavy Slam −2♥) + Void Rift Counter-Parry = 2 pressures (no extra Time Bombs).
    rules: {
      attributes: A3, boardSize: 15, timer: 88, hearts: 10, startingHints: 3, startingGraces: 2,
    },
    foes: [{ enemy: 'World Eater', hp: 16000, taunt: 'Every card you play, I swallow two.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 6.5, difficulty: 5,
    rewards: { star1: { coins: 320, weapons: ['wild-card'] }, star2: { weapons: ['life-vessel', 'twin-seed'] }, star3: { coins: 950, weapons: ['growth-seed'] } },
    recommended: ['Corgi'],
  },
  {
    id: '5-3', biome: 'summit', name: 'Last Light', introduces: 'no_mercy',
    // [GP-09] & [GP-16] Shading Surge + Counter-Parry = 2 pressures; native Adventure timeLeft challenge! (Reaper 2× pts → effHp 4100)
    rules: {
      attributes: A3, shadingSurge: true, boardSize: 15, timer: 88, hearts: 5, startingGraces: 4,
    },
    foes: [{ enemy: 'The Reaper', hp: 34400, taunt: 'Everyone runs out of time.' }],
    challenge: { kind: 'timeLeft', n: 15 }, coinMultiplier: 7, difficulty: 5,
    rewards: { star1: { coins: 340, weapons: ['twin-seed', 'tar-pit'] }, star2: { weapons: ['mending-charm', 'fog-lantern'] }, star3: { coins: 1000, weapons: ['prismatic-ray'] } },
    recommended: ['Orange Tabby', 'Emperor Penguin'],
  },
  {
    id: '5-4', biome: 'summit', name: 'Needle Ridge', introduces: 'porcupine',
    // [GP-09] & [GP-17] Counter-Parry + Merciless Porcupine (Heavy Slam −2♥) = 2 sharp pressures. (2× pts → effHp 4600)
    rules: {
      attributes: A3, boardSize: 15, timer: 88, hearts: 11, startingHints: 3, startingGraces: 4,
    },
    foes: [{ enemy: 'Merciless Porcupine', hp: 84000, taunt: 'One wrong move. That\'s all I need.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 7.5, difficulty: 5,
    rewards: { star1: { coins: 360, weapons: ['collectors-album', 'long-fuse'] }, star2: { weapons: ['echo-stone', 'scholars-tome'] }, star3: { coins: 1100, weapons: ['hot-potato'] } },
    recommended: ['Emperor Penguin', 'Pelican'],
  },
  {
    id: '5-5', biome: 'summit', name: 'Starfall', introduces: 'final_boss', isBoss: true,
    // [GP-16] & [GP-17] The Finale (11,200 total runtime HP across 3 Phased Hydra Heads; 180s timer):
    //   Head I  (2,800 HP): Shifting Scales + Countdowns
    //   Head II (3,600 HP): Bombs + Rapid Parry
    //   Head III (4,800 HP): Shading Surge + Rainbow Counter + telegraphed Heavy Slam (−2♥)
    // Only stage allowed 3 external pressures (Surge + Counter-Parry + Phased Hydra).
    rules: {
      attributes: A3, shadingSurge: true, boardSize: 18, timer: 144, hearts: 14, startingHints: 5, startingGraces: 3,
    },
    foes: [
      {
        enemy: 'The Hydra',
        hydraPhase: 1,
        name: 'The Hydra',
        hp: 13600,
        taunt: 'Head I rises — shifting scales and ticking countdowns!',
      },
      {
        enemy: 'The Hydra',
        hydraPhase: 2,
        name: 'The Hydra',
        hp: 17486,
        parry: {
          attackName: 'Hydra Snap',
          icon: 'lorc/hydra',
          counter: { kind: 'diff_number' },
          cooldownMs: 9500,
          windupMs: 12000,
          perfectWindowMs: 2800,
          penalty: 'time',
          penaltyAmount: 4,
        },
        taunt: 'Head II strikes — bombs and snapping jaws!',
      },
      {
        enemy: 'The Hydra',
        hydraPhase: 3,
        name: 'The Hydra',
        hp: 23314,
        taunt: 'Cut one head off, another rises. Everything you learned, all at once!',
      },
    ],
    challenge: { kind: 'bigHit', n: 20 }, coinMultiplier: 8, difficulty: 5,
    rewards: { star1: { coins: 400, weapons: ['glass-sword', 'rust'] }, star2: { weapons: ['ice-block'] }, star3: { coins: 1500, weapons: ['mystic-sight'] } },
    recommended: ['Emperor Penguin', 'Orange Tabby', 'Sly Fox'],
  },
];

// ════════════════════ SIDE BRANCHES — fighter trials & elites ════════════════════
// Secret until they open: ★★ on the level they hang off (a main level or, in
// Worlds 3–4, another branch). Fighter trials hang off the level that recruits
// the fighter, so you always own the fighter they teach.
export const BRANCH_STAR_REQUIREMENT = 2;

const BRANCHES: LevelInput[] = [
  // World 1
  {
    id: '1-5F', branchOf: '1-5', biome: 'meadow', name: 'Fox Den', introduces: 'fighter_fire',
    // Fighter trial: chain Sets inside 5 s. The wolf punishes standing still. Echo Stone (★★) adds free Sets to the chain.
    rules: { attributes: A3, boardSize: 12, moves: 12, hearts: 4 },
    foes: [{ enemy: 'Stalking Wolf', hp: 620, taunt: 'Too slow, little fox.' }],
    challenge: { kind: 'comboReach', n: 2 }, coinMultiplier: 1.4, difficulty: 2,
    rewards: { star1: { coins: 30 }, star2: { weapons: ['echo-stone'] }, star3: { coins: 70, weapons: ['amplifier-coil'] } },
    recommended: ['Sly Fox'],
  },
  // World 2
  {
    id: '2-5C', branchOf: '2-5', biome: 'woods', name: 'Corgi\'s Yard', introduces: 'fighter_growth',
    // Fighter trial: every bonus card Corgi fetches is another bonus card. Field Stone (★★) widens the yard.
    rules: { attributes: A3, timer: 68, hearts: 3, startingHints: 1 },
    foes: [{ name: 'Lazy Tapir', icon: 'delapouite/tapir', hp: 760, taunt: 'Fetch? In this heat?' }],
    challenge: { kind: 'bonusCards', n: 8 }, coinMultiplier: 2, difficulty: 3,
    rewards: { star1: { coins: 50, weapons: ['chain-gang'] }, star2: { weapons: ['field-stone'] }, star3: { coins: 110, weapons: ['war-drum'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-8B', branchOf: '2-8', biome: 'woods', name: 'Badger\'s Sett', introduces: 'fighter_grace',
    // Fighter trial: miss on purpose, stack grudges, release one massive Set. Mending Charm (★★) keeps you standing.
    rules: { attributes: A3, timer: 68, hearts: 4, startingHints: 1, startingGraces: 1 },
    foes: [{ name: 'Bully Boar', icon: 'caro-asercion/boar', hp: 880, taunt: 'Go on. Take a swing. Miss.' }],
    challenge: { kind: 'bigHit', n: 18 }, coinMultiplier: 2.1, difficulty: 3,
    rewards: { star1: { coins: 55, weapons: ['tightrope'] }, star2: { weapons: ['mending-charm'] }, star3: { coins: 120, weapons: ['fortune-token'] } },
    recommended: ['Badger'],
  },
  {
    id: '2-9P', branchOf: '2-9', biome: 'woods', name: 'Ice Floe', introduces: 'fighter_foresight',
    // Fighter trial: the hawk races the clock; every Rainbow freezes it. Time Drop (★★) buys more hunting time.
    rules: { attributes: A3, timer: 68, hearts: 3, startingHints: 1, startingGraces: 1 },
    foes: [{ enemy: 'Diving Hawk', hp: 1240, taunt: 'The clock is mine. Catch me.' }],
    challenge: { kind: 'rainbows', n: 4 }, coinMultiplier: 2.2, difficulty: 3,
    rewards: { star1: { coins: 55, weapons: ['rainbow-charm'] }, star2: { weapons: ['time-drop'] }, star3: { coins: 120, weapons: ['bounty-poster'] } },
    recommended: ['Emperor Penguin'],
  },
  // World 3
  {
    id: '3-3E', branchOf: '3-3', biome: 'canyon', name: 'The Ant Hill', introduces: 'bomb_swarm',
    // [GP-09] Drop Surge so Swarming Ants + Counter-Parry = 2 pressures.
    rules: { attributes: A3, boardSize: 15, timer: 80, hearts: 13, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Swarming Ants', hp: 6240, taunt: 'Tick. Tick. Tick. Tick.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4, difficulty: 5,
    rewards: { star1: { coins: 150, weapons: ['greedy-chest'] }, star2: { weapons: ['rally-horn'] }, star3: { coins: 400, weapons: ['long-fuse'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '3-3E2', branchOf: '3-3E', biome: 'canyon', name: 'Viper Pit', introduces: 'cobra',
    // [GP-09] Chained elite: snares + Venomous Cobra (any-parry Stalker) = 2 pressures; defuse 4 traps.
    rules: { attributes: A3, boardSize: 15, timer: 84, hearts: 8, startingHints: 2, startingGraces: 1, hazards: { snares: { every: 5 } } },
    foes: [{ enemy: 'Venomous Cobra', hp: 6400, taunt: 'Every card a fang. Every fang a fuse.' }],
    challenge: { kind: 'defuseTraps', n: 4 }, coinMultiplier: 4.4, difficulty: 5,
    rewards: { star1: { coins: 170, weapons: ['chain-gang'] }, star2: { weapons: ['blast-powder'] }, star3: { coins: 420, weapons: ['connector'] } },
    recommended: ['Emperor Penguin', 'Badger'],
  },
  {
    id: '3-5P', branchOf: '3-5', biome: 'canyon', name: 'Pelican\'s Wharf', introduces: 'fighter_oracle',
    // Fighter trial: the crab douses fire builds; Pelican does not need any. Surge + Counter-Parry = 2 pressures.
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 80, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Wet Crab', hp: 3520, taunt: 'Bring fire. I dare you.' }],
    challenge: { kind: 'levelUps', n: 3 }, coinMultiplier: 3, difficulty: 4,
    rewards: { star1: { coins: 100, weapons: ['rust'] }, star2: { weapons: ['seeker-lens'] }, star3: { coins: 220, weapons: ['oracle-eye'] } },
    recommended: ['Pelican'],
  },
  {
    id: '3-8E', branchOf: '3-8', biome: 'canyon', name: 'The Deep', introduces: 'deep_dark',
    // [GP-09] Drop Surge so Nightmare Squid + Counter-Parry = 2 pressures.
    rules: { attributes: A3, boardSize: 15, timer: 80, hearts: 4, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Nightmare Squid', hp: 14400, taunt: 'Down here, you see nothing.' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 4.2, difficulty: 5,
    rewards: { star1: { coins: 160, weapons: ['ice-block'] }, star2: { weapons: ['catalyst-prism'] }, star3: { coins: 400, weapons: ['amplifier-coil'] } },
    recommended: ['Corgi', 'Pelican'],
  },
  // World 4
  {
    id: '4-2E', branchOf: '4-2', biome: 'peaks', name: 'Bear Country', introduces: 'instant_death',
    // [GP-09] & [GP-17] Drop Surge; Raging Bear Heavy Slam (−2♥) + Counter-Parry = 2 pressures! (2× pts → effHp 9500)
    rules: { attributes: A3, boardSize: 15, moves: 14, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Raging Bear', hp: 15200, taunt: 'Stop moving and feel my heavy slam!' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 5, difficulty: 5,
    rewards: { star1: { coins: 200, weapons: ['hot-potato'] }, star2: { weapons: ['mirror-shard'] }, star3: { coins: 600, weapons: ['devils-bargain'] } },
    recommended: ['Sly Fox', 'Orange Tabby'],
  },
  {
    id: '4-2E2', branchOf: '4-2E', biome: 'peaks', name: 'Claw Ridge', introduces: 'savage',
    // [GP-09] Chained elite: drop Surge; Counter-Parry + Time Bombs = 2 pressures.
    rules: { attributes: A3, boardSize: 15, timer: 88, hearts: 8, startingHints: 3, startingGraces: 2, hazards: { timeBombs: { every: 12, seconds: 16 } } },
    foes: [{ enemy: 'Savage Claws', hp: 3840, taunt: 'Faster. FASTER. Still too slow.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5.5, difficulty: 5,
    rewards: { star1: { coins: 230, weapons: ['decoy', 'collectors-album'] }, star2: { coins: 480, weapons: ['odd-one-out'] }, star3: { coins: 700, weapons: ['greedy-chest'] } },
    recommended: ['Sly Fox'],
  },
  {
    id: '4-5E', branchOf: '4-5', biome: 'peaks', name: 'Sentinel Ruins', introduces: 'double_armor',
    rules: { attributes: A3, shadingSurge: true, boardSize: 15, timer: 84, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Stone Sentinel', hp: 13600, taunt: 'Two shields. Zero weaknesses.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5, difficulty: 5,
    rewards: { star1: { coins: 200, weapons: ['tightrope', 'wild-card'] }, star2: { weapons: ['glass-sword'] }, star3: { coins: 600, weapons: ['tar-pit'] } },
    recommended: ['Badger', 'Sly Fox'],
  },
  {
    id: '4-7E', branchOf: '4-7', biome: 'peaks', name: 'Hoarder\'s Den', introduces: 'elite',
    // [GP-09] Drop Surge so Hoarding Beaver + Counter-Parry = 2 pressures.
    rules: { attributes: A3, boardSize: 15, timer: 84, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Hoarding Beaver', hp: 18400, taunt: 'Mine. Mine. Also mine.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5.2, difficulty: 5,
    rewards: { star1: { coins: 210, arcana: 'glass_prism' }, star2: { weapons: ['scholars-tome', 'decoy'] }, star3: { coins: 620, weapons: ['mystic-sight'] } },
    recommended: ['Corgi'],
  },
  {
    id: '4-7E2', branchOf: '4-7E', biome: 'peaks', name: 'Ink Grotto', introduces: 'abyss',
    // [GP-09] Chained elite: drop Surge & redundant snares so Abyssal Octopus + Counter-Parry = 2 pressures.
    rules: { attributes: A3, boardSize: 15, timer: 84, hearts: 15, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Abyssal Octopus', hp: 14400, taunt: 'Eight arms. Zero light.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5.8, difficulty: 5,
    rewards: { star1: { coins: 240, weapons: ['understudy', 'encore-mask'] }, star2: { weapons: ['flint-spark', 'war-drum'] }, star3: { coins: 720, weapons: ['mystic-sight', 'connector'] } },
    recommended: ['Corgi', 'Pelican'],
  },
];

/**
 * [GP-17] From World 2 on, rounds scale gently (`1.25×` foe HP and `1.25×` timer)
 * instead of `2×`, keeping World 2–5 mobile fights crisp at 75–110s (bosses 160–180s).
 */
export const LONG_ROUNDS = { fromWorldAfter: 'meadow' as const, foeHp: 1.25, timer: 1.25 } as const;

const withRoundLength = (l: LevelInput): LevelInput =>
  l.biome === LONG_ROUNDS.fromWorldAfter
    ? l
    : {
        ...l,
        foes: l.foes.map(f => ({ ...f, hp: Math.round(f.hp * LONG_ROUNDS.foeHp) })),
        rules: { ...l.rules, ...(l.rules.timer ? { timer: Math.round(l.rules.timer * LONG_ROUNDS.timer) } : {}) },
      };

// ════════════════════ PRACTICE — nothing to win, nothing to lose ════════════════════
// Secret paths like the branches above, but not part of the campaign: no stars
// and nothing banked, so they stay out of LEVELS (star totals, bots, bounties).
const NOTHING: LevelInput['rewards'] = { star1: { coins: 0 }, star2: { coins: 0 }, star3: { coins: 0 } };

const PRACTICE: LevelInput[] = [
  {
    id: '1-4D', branchOf: '1-4', opensAt: 1, biome: 'meadow', name: 'The Back Field', introduces: 'practice',
    // The surprise behind 1-4: a dummy that cannot be knocked out, with no clock and no move limit.
    // It opens on any clear of 1-4, right after evolutions are taught, so there is somewhere to try them.
    rules: { attributes: A3, boardSize: 12, hearts: 4, sandbox: true, startingHints: 3, startingGraces: 2, extraEvolutionDurationMs: 4000 },
    foes: [{ name: 'Training Dummy', icon: 'lorc/target-dummy', hp: 100, taunt: '…' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 1, difficulty: 1,
    rewards: NOTHING,
  },
];

const build = (levels: LevelInput[]): LevelDef[] =>
  levels.map(withRoundLength).map(l => ({ ...l, rewards: normalizeRewards(l) }));

/** The campaign: every level that earns stars (the main path and its side branches). */
export const LEVELS: LevelDef[] = build([...RAW_LEVELS, ...BRANCHES]);

/** Practice fights: on the map, but outside the campaign. */
export const PRACTICE_LEVELS: LevelDef[] = build(PRACTICE);

const EVERY_LEVEL: LevelDef[] = [...LEVELS, ...PRACTICE_LEVELS];

/** The main path, in order (side branches excluded). */
export const MAIN_LEVELS: LevelDef[] = LEVELS.filter(l => !l.branchOf);

/** Every secret side path: campaign branches and practice levels. */
export const SIDE_PATHS: LevelDef[] = EVERY_LEVEL.filter(l => l.branchOf);

/** Side paths hanging directly off this level (a main level or another branch). */
export const branchesOf = (levelId: string): LevelDef[] => SIDE_PATHS.filter(l => l.branchOf === levelId);

/** Stars on its parent that open (and reveal) a side path. */
export const branchStars = (level: LevelDef): number => level.opensAt ?? BRANCH_STAR_REQUIREMENT;

/** A side path the player has not opened yet: it is not on the map, and nothing should name it. */
export const isPathHidden = (level: LevelDef, save: Pick<AdventureSave, 'stars'>): boolean =>
  !!level.branchOf && (save.stars[level.branchOf] ?? 0) < branchStars(level);

export const getLevel = (id: string): LevelDef => {
  const l = EVERY_LEVEL.find(x => x.id === id);
  if (!l) throw new Error(`Unknown level ${id}`);
  return l;
};

/** The main-path level a branch (or a branch of a branch) ultimately hangs off; a main level is its own root. */
export const branchRoot = (level: LevelDef): LevelDef => {
  let at = level;
  for (let guard = 0; at.branchOf && guard < 16; guard++) {
    const parent = EVERY_LEVEL.find(x => x.id === at.branchOf);
    if (!parent) break;
    at = parent;
  }
  return at;
};

/** Position on the main path: a branch sits at its root main level's position. */
/** By id, so a tweaked copy of a level (bots scaling HP, a training dummy) sits where the original does. */
export const mainIndexOf = (level: LevelDef): number => {
  const root = branchRoot(level);
  return MAIN_LEVELS.findIndex(l => l.id === root.id);
};

// ─── [GP-09] Simultaneous External Pressure Budget Audit Helper ──────────────

/** Maximum simultaneous external fight pressures allowed outside the 5-5 finale. */
export const MAX_EXTERNAL_PRESSURES = 2;

/** Foes whose kit actively mutates/disrupts the board or ticks periodic hazards/slams. */
export const ACTIVE_BOARD_DISRUPTION_ENEMIES: ReadonlySet<string> = new Set([
  'Junk Rat',
  'Night Owl',
  'Trap Weaver',
  'Stalking Wolf',
  'Burrowing Mole',
  'Shifting Chameleon',
  'Charging Boar',
  'Swarming Ants',
  'Venomous Cobra',
  'Nightmare Squid',
  'Ticking Viper',
  'Wild Goose',
  'One-Eyed Terror',
  'Feral Fangs',
  'Raging Bear',
  'Hoarding Beaver',
  'Abyssal Octopus',
  "Kraken's Grasp",
  'World Eater',
  'Merciless Porcupine',
  'The Hydra',
  'The Hydra#1',
  'The Hydra#2',
  'The Hydra#3',
]);

export type ExternalPressureKind = 'shadingSurge' | 'counterParry' | 'boardHazards' | 'activeFoeTick';

/** List the active external board-pressure subsystems on a level (capped at ≤2 outside `5-5`). */
export const externalPressuresOf = (level: LevelDef): ExternalPressureKind[] => {
  const out: ExternalPressureKind[] = [];
  if (level.rules.shadingSurge) out.push('shadingSurge');
  const lastFoe = level.foes[level.foes.length - 1];
  const parry = resolveParrySpec(level, lastFoe);
  if (parry && parry.counter.kind !== 'any') out.push('counterParry');
  if (level.rules.hazards?.timeBombs || level.rules.hazards?.snares) out.push('boardHazards');
  if (level.foes.some(f => Boolean(f.enemy && ACTIVE_BOARD_DISRUPTION_ENEMIES.has(f.enemy)))) {
    out.push('activeFoeTick');
  }
  return out;
};
