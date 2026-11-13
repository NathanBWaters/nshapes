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
 *  - Side branches (`branchOf`) open at ★★ on their parent and never block the
 *    main path. A branch may hang off another branch (World 3–4 routes).
 *    Fighter trials hang off the level whose ★★ recruits that fighter.
 *  - Foe HP is a first pass; the headless bot in
 *    __tests__/adventureBalance.test.ts retunes it.
 */
import type { AttributeName } from '@/types';
import type { LevelDef, RewardDef } from '../types';

const A2: AttributeName[] = ['shape', 'color'];
const A3: AttributeName[] = ['shape', 'color', 'number'];
const A4: AttributeName[] = ['shape', 'color', 'number', 'shading'];
const A5: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];

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
  // ════════════════════ 1 · SUNNY MEADOW — basics, first evolution, Time Bombs (no clock) ════════════════════
  {
    id: '1-1', biome: 'meadow', name: 'First Light', introduces: 'set_rule',
    // The first level can't be lost: make 5 Sets. Stars are about accuracy.
    rules: { attributes: A2, boardSize: 9, hearts: 0, noGear: true },
    foes: [{ name: 'Dozy Bunny', icon: 'delapouite/rabbit', hp: 15, taunt: 'Zzz… huh? A challenger?' }],
    challenge: { kind: 'noMistakes' }, starRule: { kind: 'accuracy', threeStarMax: 0, twoStarMax: 1 },
    coinMultiplier: 1, difficulty: 1,
    // Coin Drops, then the clearest offense weapon there is
    rewards: {
      star1: { coins: 20, unlockFeature: 'coins' },
      star2: { coins: 30, weapons: ['blast-powder'] },
      star3: { coins: 50 },
    },
  },
  {
    id: '1-2', biome: 'meadow', name: 'Ouch!', introduces: 'hearts',
    // Puzzle: hearts are a resource. Tabby's Scrappy turns missing hearts into damage;
    // Mending Charm (★★) heals you back up so the risky line is safe on a replay.
    rules: { attributes: A2, boardSize: 9, moves: 8, hearts: 3 },
    foes: [{ name: 'Prickle', icon: 'caro-asercion/hedgehog', hp: 36, taunt: 'Careful, I\'m pointy.' }],
    challenge: { kind: 'bigHit', n: 6 }, coinMultiplier: 1, difficulty: 1,
    rewards: { star1: { coins: 10 }, star2: { coins: 20, weapons: ['mending-charm'] }, star3: { coins: 30 } },
    recommended: ['Orange Tabby'],
  },
  {
    id: '1-3', biome: 'meadow', name: 'Counting Acorns', introduces: 'attr_number',
    // The first recipe arrives at ★: Blast Powder + Mending Charm = Phoenix Pyre (taught on 1-4)
    rules: { attributes: A3, boardSize: 12, moves: 8, hearts: 3 },
    foes: [{ name: 'Nutkin', icon: 'delapouite/squirrel', hp: 42, taunt: 'One, two, three… mine!' }],
    challenge: { kind: 'streak', n: 6 }, coinMultiplier: 1, difficulty: 1,
    rewards: { star1: { coins: 15, evolution: 'phoenix-pyre' }, star2: { coins: 25, character: 'Sly Fox' }, star3: { coins: 50 } },
  },
  {
    id: '1-4', biome: 'meadow', name: 'Phoenix Rising', introduces: 'evolutions',
    // Puzzle: equip Blast Powder + Mending Charm, match the Catalyst, then take a hit on purpose:
    // every heal or lost heart blasts a 3×2 block. Catalyst Prism (★★) brings Catalysts twice as often.
    rules: { attributes: A3, boardSize: 12, moves: 12, hearts: 4, evolutionLikelihood: 15 },
    foes: [{ name: 'Cinder Toad', icon: 'lorc/frog', hp: 205, taunt: 'Ribbit. I was born in a bonfire.' }],
    challenge: { kind: 'evolutions', n: 3 }, coinMultiplier: 1.1, difficulty: 2,
    rewards: {
      star1: { coins: 15, weapons: ['flint-spark'] },
      star2: { weapons: ['catalyst-prism'] },
      star3: { coins: 40 },
    },
  },
  {
    id: '1-5', biome: 'meadow', name: 'Star Power', introduces: 'skill_tree',
    // Puzzle: a tough old foe and a ★★★ for one huge hit. Spend your stars on the tree first
    // (Scrappy, Combo). Rally Horn (★★) opens every wave with +6.
    rules: { attributes: A3, boardSize: 12, moves: 9, hearts: 3 },
    foes: [{ name: 'Old Quillback', icon: 'caro-asercion/porcupine', hp: 115, taunt: 'Seen a hundred like you. Hit harder.' }],
    challenge: { kind: 'bigHit', n: 8 }, coinMultiplier: 1.2, difficulty: 2,
    rewards: {
      star1: { coins: 20, unlockFeature: 'workshop' },
      star2: { weapons: ['rally-horn'] },
      star3: { coins: 50 },
    },
    recommended: ['Orange Tabby', 'Sly Fox'],
  },
  {
    id: '1-6', biome: 'meadow', name: 'Rainbow Strike', introduces: 'rainbow',
    // Puzzle: plain Sets can't finish the moth in time. Field Stone (★★) widens the board: more rainbows.
    rules: { attributes: A3, boardSize: 12, moves: 10, hearts: 3 },
    foes: [{ name: 'Prism Moth', icon: 'lorc/evil-bat', hp: 179, taunt: 'Only a rainbow can hurt me.' }],
    challenge: { kind: 'rainbows', n: 5 }, coinMultiplier: 1.3, difficulty: 2,
    rewards: { star1: { coins: 25 }, star2: { weapons: ['field-stone'] }, star3: { coins: 60 } },
  },
  {
    id: '1-7', biome: 'meadow', name: 'Fuse Meadow', introduces: 'time_bombs',
    // Puzzle: fuses tick in real time even without a clock. Build every Set around the bomb card.
    // Clarity Lens (★★) simplifies the board, so far more Sets include the bomb.
    rules: { attributes: A3, boardSize: 12, moves: 10, hearts: 4, hazards: { timeBombs: { every: 8, seconds: 16 } } },
    foes: [{ name: 'Bumble Bomber', icon: 'lorc/bee', hp: 142, taunt: 'Bzz… tick… bzz… tick…' }],
    challenge: { kind: 'defuseTraps', n: 5 }, coinMultiplier: 1.4, difficulty: 2,
    rewards: {
      star1: { coins: 25, weapons: ['pinata'] },
      star2: { weapons: ['clarity-lens'] },
      star3: { coins: 60 },
    },
  },
  {
    id: '1-8', biome: 'meadow', name: 'Shell Shock', introduces: 'triple_card', isBoss: true,
    // Puzzle: break the armored card while bombs tick. Prismatic Ray (★★) lasers chip armor from afar.
    rules: { attributes: A3, boardSize: 12, moves: 12, hearts: 5, hazards: { timeBombs: { every: 12, seconds: 20 } } },
    foes: [{ enemy: 'Iron Shell', hp: 186, taunt: 'Nothing gets through this shell.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.6, difficulty: 3,
    rewards: { star1: { coins: 40 }, star2: { weapons: ['prismatic-ray'] }, star3: { coins: 100, arcana: 'monochrome_pact' } },
    recommended: ['Sly Fox'],
  },

  // ════════════════════ 2 · WHISPERING WOODS — the clock, foe tricks, snares, hints, graces ════════════════════
  {
    id: '2-1', biome: 'woods', name: 'Ticking Clock', introduces: 'timer',
    // Puzzle: the sloth smothers time weapons, so win FAST instead. Chrono Shard (★) starts you with more
    // clock; Flint Spark rare (★★) burns the sloth down quicker.
    rules: { attributes: A3, timer: 60, hearts: 3 },
    foes: [{ enemy: 'Lazy Sloth', hp: 141, taunt: 'Take… your… time…' }],
    challenge: { kind: 'timeLeft', n: 12 }, coinMultiplier: 1.5, difficulty: 2,
    rewards: { star1: { coins: 30, weapons: ['chrono-shard'] }, star2: { weapons: ['flint-spark'] }, star3: { coins: 70, evolution: 'wildfire-echo' } },
    recommended: ['Sly Fox'],
  },
  {
    id: '2-2', biome: 'woods', name: 'Tangled Thicket', introduces: 'snares',
    // Puzzle: never match the snared card; match the card its arrow points at for +4.
    // Growth Seed (★★) grows the board, so the pointed-at card fits a Set more often.
    rules: { attributes: A3, timer: 65, hearts: 4, hazards: { snares: { every: 5 } } },
    foes: [{ name: 'Thicket Spider', icon: 'carl-olsen/spider-face', hp: 164, taunt: 'Step where I point. Or don\'t.' }],
    challenge: { kind: 'defuseTraps', n: 6 }, coinMultiplier: 1.6, difficulty: 3,
    rewards: { star1: { coins: 35, weapons: ['magnet'] }, star2: { weapons: ['growth-seed'] }, star3: { coins: 80, evolution: 'big-bang' } },
  },
  {
    id: '2-3', biome: 'woods', name: 'A Little Help', introduces: 'hints',
    // Puzzle: the bandit kills auto-hints, so the bulb is yours to press. Seeker Lens (★★) refills it.
    rules: { attributes: A3, timer: 60, hearts: 3, startingHints: 3 },
    foes: [{ enemy: 'Masked Bandit', hp: 154, taunt: 'No free peeks in my woods.' }],
    challenge: { kind: 'useHints', n: 3 }, coinMultiplier: 1.6, difficulty: 2,
    rewards: {
      star1: { coins: 35, weapons: ['chaos-shard'] },
      star2: { weapons: ['seeker-lens'] },
      star3: { coins: 80, evolution: 'seeker-swarm' },
    },
  },
  {
    id: '2-4', biome: 'woods', name: 'Power Up', introduces: 'power_cards',
    // Puzzle: the squirrel hoards refills and the board shrinks. Corgi (★★) fetches new power cards
    // and Zoomies re-deals a full board.
    rules: { attributes: A3, timer: 65, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Greedy Squirrel', hp: 192, taunt: 'Two cards for you. The rest? Mine.' }],
    challenge: { kind: 'bonusCards', n: 5 }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 35, weapons: ['war-drum'] }, star2: { character: 'Corgi' }, star3: { coins: 80, weapons: ['chain-gang'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-5', biome: 'woods', name: 'Junk Drawer', introduces: 'duds',
    // Puzzle: duds clog the board; blasts clear them. Blast Powder rare (★★) clears them faster.
    rules: { attributes: A3, timer: 60, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Junk Rat', hp: 151, taunt: 'One rat\'s junk is… still junk.' }],
    challenge: { kind: 'explosions', n: 4 }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 40, weapons: ['snowball'] }, star2: { weapons: ['blast-powder'] }, star3: { coins: 90, weapons: ['connector'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-6', biome: 'woods', name: 'Lights Out', introduces: 'face_down',
    // Puzzle: make Sets to flip hidden cards, then use one. Oracle Eye (★★) points the way.
    rules: { attributes: A3, timer: 60, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Night Owl', hp: 160, taunt: 'Whooo can see in the dark?' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 40, weapons: ['odd-one-out'] }, star2: { weapons: ['oracle-eye'] }, star3: { coins: 90, weapons: ['time-drop'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-7', biome: 'woods', name: 'Near Miss', introduces: 'graces',
    // Puzzle: near misses are free while graces last, so guess boldly. Badger (★★) makes the
    // first mistake each wave free on top.
    rules: { attributes: A3, timer: 65, hearts: 3, startingHints: 1, startingGraces: 2 },
    foes: [{ name: 'Whisker Trickster', icon: 'lorc/mouse', hp: 191, taunt: 'Close enough? Let\'s find out.' }],
    challenge: { kind: 'graceSaves', n: 2 }, coinMultiplier: 1.8, difficulty: 3,
    rewards: {
      star1: { coins: 45, weapons: ['second-chance'] },
      star2: { character: 'Badger' },
      star3: { coins: 100, evolution: 'judgement-beam' },
    },
    recommended: ['Badger'],
  },
  {
    id: '2-8', biome: 'woods', name: 'Prism Rush', introduces: 'purity_chain',
    // Puzzle: climb 1-diff → 2-diff → Rainbow on purpose. Emperor Penguin (★★) pays you to slow down and pick.
    rules: { attributes: A3, timer: 70, hearts: 3, startingHints: 1, startingGraces: 1 },
    foes: [{ name: 'Magpie', icon: 'lorc/raven', hp: 182, taunt: 'Shiny! Shiny! MINE!' }],
    challenge: { kind: 'purityChain', n: 3 }, coinMultiplier: 1.8, difficulty: 3,
    rewards: { star1: { coins: 45, weapons: ['greedy-chest'] }, star2: { character: 'Emperor Penguin' }, star3: { coins: 100, weapons: ['prismatic-ray'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '2-9', biome: 'woods', name: 'The Web', introduces: 'bombs', isBoss: true,
    // Puzzle: one bomb, many snares. Defuse the bomb first; Clarity Lens rare (★★) makes Sets easy to find.
    rules: { attributes: A3, timer: 75, hearts: 5, startingHints: 1, startingGraces: 1, hazards: { snares: { every: 6 } } },
    foes: [{ enemy: 'Trap Weaver', hp: 459, taunt: 'Step lightly. Everything here is wired.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.4, difficulty: 4,
    rewards: { star1: { coins: 70, weapons: ['tightrope'] }, star2: { weapons: ['clarity-lens'] }, star3: { coins: 160, arcana: 'controlled_burn' } },
    recommended: ['Emperor Penguin', 'Badger'],
  },

  // ════════════════════ 3 · EMBER CANYON — shading, charms, waves, shop, XP, Arcana ════════════════════
  {
    id: '3-1', biome: 'canyon', name: 'Fourth Dimension', introduces: 'attr_shading',
    // Puzzle: four traits make rainbows rarer but stronger. Amplifier Coil rare (★★) doubles your weapons.
    rules: { attributes: A4, boardSize: 15, timer: 75, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ name: 'Dusty Mammoth', icon: 'delapouite/mammoth', hp: 312, taunt: 'Solid. Striped. Open. Crushed.' }],
    challenge: { kind: 'rainbows', n: 3 }, coinMultiplier: 2.2, difficulty: 3,
    rewards: { star1: { coins: 60, weapons: ['bounty-poster'] }, star2: { weapons: ['amplifier-coil'] }, star3: { coins: 140, weapons: ['mirror-shard'] } },
  },
  {
    id: '3-2', biome: 'canyon', name: 'Sabotage!', introduces: 'charm_slots',
    // Puzzle: the goblin halves three weapon kinds. Fill every slot with a DIFFERENT kind and trigger
    // three of them. Fortune's Favor (★★) adds a coin effect to the mix.
    rules: { attributes: A4, boardSize: 15, timer: 80, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Goblin Saboteur', hp: 389, taunt: 'Nice gear. Shame if something happened to it.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.3, difficulty: 3,
    rewards: { star1: { coins: 65, weapons: ['devils-bargain'] }, star2: { weapons: ['fortunes-favor'] }, star3: { coins: 150, evolution: 'golden-hour' } },
  },
  {
    id: '3-3', biome: 'canyon', name: 'Marching Ants', introduces: 'waves',
    // Puzzle: three small foes. Open each wave with your biggest Set. Rally Horn rare (★★): +10 on every opener.
    rules: { attributes: A4, boardSize: 15, timer: 90, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [
      { name: 'Scout Ant', icon: 'delapouite/ant', hp: 125 },
      { name: 'Soldier Ant', icon: 'delapouite/ant', hp: 162 },
      { name: 'Queen Ant', icon: 'delapouite/ant', hp: 199, taunt: 'You squashed my children!' },
    ],
    challenge: { kind: 'bigHit', n: 10 }, coinMultiplier: 2.4, difficulty: 3,
    rewards: { star1: { coins: 70, weapons: ['collectors-album'] }, star2: { weapons: ['rally-horn'] }, star3: { coins: 150, weapons: ['life-vessel'] } },
  },
  {
    id: '3-4', biome: 'canyon', name: 'Market Day', introduces: 'shop',
    // Puzzle: spend between waves. Fortune's Favor rare (★★) fills your purse mid-fight.
    rules: { attributes: A4, boardSize: 15, timer: 100, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [
      { name: 'Pickpocket Hyena', icon: 'caro-asercion/hyena-head', hp: 153 },
      { name: 'Haggling Hyena', icon: 'caro-asercion/hyena-head', hp: 189 },
      { name: 'Hyena Boss', icon: 'caro-asercion/hyena-head', hp: 241, taunt: 'Everything has a price!' },
    ],
    challenge: { kind: 'shopBuys', n: 2 }, coinMultiplier: 2.5, difficulty: 3,
    rewards: { star1: { coins: 80, weapons: ['twin-seed'] }, star2: { weapons: ['fortunes-favor'] }, star3: { coins: 170, arcana: 'overkill_harvest' } },
  },
  {
    id: '3-5', biome: 'canyon', name: 'Level Up!', introduces: 'xp',
    // Puzzle: every Set is XP; level twice for ★★★. Pelican (★★) scoops free Sets: free XP.
    rules: { attributes: A4, boardSize: 15, timer: 80, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ name: 'Busy Beaver', icon: 'delapouite/beaver', hp: 529, taunt: 'I\'ve been training all season.' }],
    challenge: { kind: 'levelUps', n: 2 }, coinMultiplier: 2.5, difficulty: 3,
    rewards: {
      star1: { coins: 80, weapons: ['scholars-tome'] },
      star2: { character: 'Pelican' },
      star3: { coins: 180, arcana: 'scholars_gambit' },
    },
    recommended: ['Pelican'],
  },
  {
    id: '3-6', biome: 'canyon', name: 'Fortune\'s Wheel', introduces: 'arcana_slots',
    // Puzzle: stack two Arcana for one enormous hit. Prismatic Fever (★★) makes Rainbows hit ×3.
    rules: { attributes: A4, boardSize: 15, timer: 80, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Wicked Imp', hp: 1718, taunt: 'Double or nothing, little hero?' }],
    challenge: { kind: 'bigHit', n: 15 }, coinMultiplier: 2.6, difficulty: 4,
    rewards: {
      star1: { coins: 80, arcana: 'tempo_surge' },
      star2: { arcana: 'prismatic_fever' },
      star3: { coins: 180, weapons: ['catalyst-prism'] },
    },
  },
  {
    id: '3-7', biome: 'canyon', name: 'Mole Hole', introduces: 'card_removal',
    // Puzzle: the board shrinks every 20 s. Grow it back: Growth Seed rare (★★).
    rules: { attributes: A4, boardSize: 15, timer: 75, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Burrowing Mole', hp: 510, taunt: 'Dig, dig, dig… gone!' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.6, difficulty: 4,
    rewards: { star1: { coins: 80, weapons: ['fog-lantern'] }, star2: { weapons: ['growth-seed'] }, star3: { coins: 180, weapons: ['echo-stone'] } },
    recommended: ['Corgi'],
  },
  {
    id: '3-8', biome: 'canyon', name: 'Color Me Gone', introduces: 'attr_shift',
    // Puzzle: grab Sets before they shift away; two Rainbows for ★★★. Chaos Shard rare (★★) keeps the board churning.
    rules: { attributes: A4, boardSize: 15, timer: 75, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Shifting Chameleon', hp: 575, taunt: 'Now you see me…' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.7, difficulty: 4,
    rewards: { star1: { coins: 90, weapons: ['wild-card'] }, star2: { weapons: ['chaos-shard'] }, star3: { coins: 190, evolution: 'bloodline' } },
    recommended: ['Pelican', 'Sly Fox'],
  },
  {
    id: '3-9', biome: 'canyon', name: 'Sticky Talons', introduces: 'time_steal',
    // Puzzle: every Set costs 5 s, so make few, big ones. Temporal Core (★★) refills the clock.
    rules: { attributes: A4, boardSize: 15, timer: 90, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Thieving Raven', hp: 431, taunt: 'Your seconds look delicious.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.8, difficulty: 4,
    rewards: { star1: { coins: 90, weapons: ['glass-sword'] }, star2: { weapons: ['chrono-shard'] }, star3: { coins: 200, weapons: ['flint-spark'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '3-10', biome: 'canyon', name: 'Stampede', introduces: 'inactivity', isBoss: true,
    // Puzzle: never stop matching, and both traps are back. Fast builds shine.
    rules: {
      attributes: A4, boardSize: 15, timer: 90, hearts: 8, startingHints: 2, startingGraces: 1,
      hazards: { timeBombs: { every: 14, seconds: 24 }, snares: { every: 8 } },
    },
    foes: [{ enemy: 'Charging Boar', hp: 776, taunt: 'Stand still and I\'ll flatten you.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.5, difficulty: 5,
    rewards: { star1: { coins: 130, weapons: ['hot-potato'] }, star2: { weapons: ['mending-charm'] }, star3: { coins: 300, weapons: ['second-chance'] } },
    recommended: ['Sly Fox', 'Pelican'],
  },

  // ════════════════════ 4 · FROZEN PEAKS — five traits, stacked builds ════════════════════
  {
    id: '4-1', biome: 'peaks', name: 'Fifth Element', introduces: 'attr_background',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ name: 'Snow Hare', icon: 'delapouite/rabbit', hp: 585, taunt: 'Five traits. Can you keep up?' }],
    challenge: { kind: 'streak', n: 5 }, coinMultiplier: 3.2, difficulty: 4,
    rewards: { star1: { coins: 120, weapons: ['understudy'] }, star2: { weapons: ['fortune-token'] }, star3: { coins: 260, weapons: ['encore-mask'] } },
    recommended: ['Pelican'],
  },
  {
    id: '4-2', biome: 'peaks', name: 'Buzzing', introduces: 'fast_timer',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Swift Bee', hp: 644, taunt: 'Bzzz! Faster! FASTER!' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.4, difficulty: 4,
    rewards: { star1: { coins: 130, weapons: ['mirror-shard'] }, star2: { weapons: ['time-drop'] }, star3: { coins: 280, weapons: ['echo-stone'] } },
    recommended: ['Sly Fox', 'Emperor Penguin'],
  },
  {
    id: '4-3', biome: 'peaks', name: 'Circling', introduces: 'regen',
    // Puzzle: out-damage the healing with blasts; six explosions for ★★★.
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Circling Vulture', hp: 531, taunt: 'I can wait. I always wait.' }],
    challenge: { kind: 'explosions', n: 6 }, coinMultiplier: 3.5, difficulty: 4,
    rewards: { star1: { coins: 135, weapons: ['bounty-poster'] }, star2: { weapons: ['fortunes-favor'] }, star3: { coins: 290, evolution: 'overclock' } },
  },
  {
    id: '4-4', biome: 'peaks', name: 'Glass Cannon', introduces: 'double_damage',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Stinging Scorpion', hp: 1907, taunt: 'One sting is all it takes.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.6, difficulty: 5,
    rewards: { star1: { coins: 140, weapons: ['odd-one-out'] }, star2: { weapons: ['life-vessel'] }, star3: { coins: 300, weapons: ['life-link'] } },
    recommended: ['Orange Tabby'],
  },
  {
    id: '4-5', biome: 'peaks', name: 'Cold Justice', introduces: 'invalid_punish',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Punishing Ermine', hp: 568, taunt: 'Every mistake will be punished.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.7, difficulty: 5,
    rewards: { star1: { coins: 145, weapons: ['fog-lantern'] }, star2: { weapons: ['second-chance'] }, star3: { coins: 310, weapons: ['grace-conduit'] } },
    recommended: ['Emperor Penguin', 'Pelican'],
  },
  {
    id: '4-6', biome: 'peaks', name: 'Tick Tock', introduces: 'countdown',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 10, startingHints: 3, startingGraces: 2, hazards: { timeBombs: { every: 20, seconds: 30 } } },
    foes: [{ enemy: 'Ticking Viper', hp: 636, taunt: 'Tick… tock… hisss.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.8, difficulty: 5,
    rewards: { star1: { coins: 150, weapons: ['rust'] }, star2: { weapons: ['field-stone'] }, star3: { coins: 320, weapons: ['seeker-lens'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '4-7', biome: 'peaks', name: 'Wild Goose Chase', introduces: 'shuffle',
    rules: { attributes: A5, boardSize: 18, timer: 95, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Wild Goose', hp: 677, taunt: 'HONK! Where\'d your Set go?' }],
    challenge: { kind: 'streak', n: 6 }, coinMultiplier: 3.9, difficulty: 5,
    rewards: { star1: { coins: 155, weapons: ['tar-pit'] }, star2: { weapons: ['growth-seed'] }, star3: { coins: 330, weapons: ['fortunes-blessing'] } },
  },
  {
    id: '4-8', biome: 'peaks', name: 'Polar Night', introduces: 'polar',
    // Puzzle: hits hurt double and lasers fizzle. Win untouched with any other weapon.
    rules: { attributes: A5, boardSize: 18, timer: 95, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Polar Guardian', hp: 2298, taunt: 'The cold forgives nothing.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4, difficulty: 5,
    rewards: { star1: { coins: 160, weapons: ['decoy'] }, star2: { weapons: ['pinata'] }, star3: { coins: 340, weapons: ['connector'] } },
    recommended: ['Pelican', 'Badger'],
  },
  {
    id: '4-9', biome: 'peaks', name: 'The Glare', introduces: 'one_eyed',
    // Puzzle: no hints and shifting traits, with bombs ticking. Keen Eye and Rainbows carry you.
    rules: { attributes: A5, boardSize: 18, timer: 95, hearts: 7, startingGraces: 2, hazards: { timeBombs: { every: 16, seconds: 24 } } },
    foes: [{ enemy: 'One-Eyed Terror', hp: 690, taunt: 'I see everything. You see nothing.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4.1, difficulty: 5,
    rewards: { star1: { coins: 165, weapons: ['long-fuse'] }, star2: { weapons: ['echo-chamber'] }, star3: { coins: 350, weapons: ['chaos-conduit'] } },
    recommended: ['Pelican', 'Emperor Penguin'],
  },
  {
    id: '4-10', biome: 'peaks', name: 'Fang Gully', introduces: 'feral',
    rules: { attributes: A5, boardSize: 18, timer: 95, hearts: 8, startingHints: 3, startingGraces: 2, hazards: { snares: { every: 7 } } },
    foes: [{ enemy: 'Feral Fangs', hp: 690, taunt: 'Duds, armor, and teeth. Pick one.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4.2, difficulty: 5,
    rewards: { star1: { coins: 170, weapons: ['ice-block'] }, star2: { weapons: ['fortune-token'] }, star3: { coins: 360, weapons: ['echo-chamber'] } },
    recommended: ['Corgi'],
  },
  {
    id: '4-11', biome: 'peaks', name: 'Dragon\'s Roost', introduces: 'dragon', isBoss: true,
    rules: {
      attributes: A5, boardSize: 21, timer: 180, hearts: 7, startingHints: 5, startingGraces: 2,
      hazards: { snares: { every: 7 } },
    },
    foes: [{ enemy: 'Ancient Dragon', hp: 3584, taunt: 'I was old when the mountains were young.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 6, difficulty: 5,
    rewards: { star1: { coins: 300, weapons: ['magnet'] }, star2: { weapons: ['second-chance'] }, star3: { coins: 900, weapons: ['prismatic-ray'] } },
    recommended: ['Emperor Penguin', 'Pelican'],
  },

  // ════════════════════ 5 · STARFALL SUMMIT — the gauntlet: every system at once ════════════════════
  {
    id: '5-1', biome: 'summit', name: 'Drowned Gear', introduces: 'kraken',
    // Puzzle: every weapon works half as well. Your passives, skill tree and evolutions do not.
    rules: {
      attributes: A5, boardSize: 18, timer: 110, hearts: 11, startingHints: 3, startingGraces: 2,
      evolutionLikelihood: 30, hazards: { timeBombs: { every: 12, seconds: 18 }, snares: { every: 10 } },
    },
    foes: [{ enemy: 'Kraken\'s Grasp', hp: 1279, taunt: 'Your toys sink. You sink.' }],
    challenge: { kind: 'evolutions', n: 3 }, coinMultiplier: 6, difficulty: 5,
    rewards: { star1: { coins: 300, weapons: ['snowball'] }, star2: { weapons: ['oracle-eye'] }, star3: { coins: 900, weapons: ['blast-powder'] } },
    recommended: ['Emperor Penguin', 'Corgi'],
  },
  {
    id: '5-2', biome: 'summit', name: 'The Devourer', introduces: 'world_eater',
    // Puzzle: the board is being eaten. Grow it, re-deal it, defuse fast.
    rules: {
      attributes: A5, boardSize: 18, timer: 110, hearts: 10, startingHints: 3, startingGraces: 2,
      hazards: { timeBombs: { every: 8, seconds: 16 }, snares: { every: 8 } },
    },
    foes: [{ enemy: 'World Eater', hp: 713, taunt: 'Every card you play, I swallow two.' }],
    challenge: { kind: 'defuseTraps', n: 5 }, coinMultiplier: 6.5, difficulty: 5,
    rewards: { star1: { coins: 320, weapons: ['wild-card'] }, star2: { weapons: ['life-vessel'] }, star3: { coins: 950, weapons: ['growth-seed'] } },
    recommended: ['Corgi'],
  },
  {
    id: '5-3', biome: 'summit', name: 'Last Light', introduces: 'no_mercy',
    rules: {
      attributes: A5, boardSize: 18, timer: 110, hearts: 5, startingGraces: 2,
      hazards: { timeBombs: { every: 40, seconds: 60 }, snares: { every: 20 } },
    },
    foes: [{ enemy: 'The Reaper', hp: 3258, taunt: 'Everyone runs out of time.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 7, difficulty: 5,
    rewards: { star1: { coins: 340, weapons: ['twin-seed'] }, star2: { weapons: ['mending-charm'] }, star3: { coins: 1000, weapons: ['prismatic-ray'] } },
    recommended: ['Orange Tabby', 'Emperor Penguin'],
  },
  {
    id: '5-4', biome: 'summit', name: 'Needle Ridge', introduces: 'porcupine',
    rules: {
      attributes: A5, boardSize: 18, timer: 110, hearts: 11, startingHints: 3, startingGraces: 4,
      hazards: { timeBombs: { every: 12, seconds: 20 }, snares: { every: 12 } },
    },
    foes: [{ enemy: 'Merciless Porcupine', hp: 4160, taunt: 'One wrong move. That\'s all I need.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 7.5, difficulty: 5,
    rewards: { star1: { coins: 360, weapons: ['collectors-album'] }, star2: { weapons: ['echo-stone'] }, star3: { coins: 1100, weapons: ['chain-reaction'] } },
    recommended: ['Emperor Penguin', 'Pelican'],
  },
  {
    id: '5-5', biome: 'summit', name: 'Starfall', introduces: 'final_boss', isBoss: true,
    // The finale: the Hydra brings bombs, countdowns, hidden cards and instant death; snares cover
    // the rest. Everything you own. ★★★ = one 20+ hit.
    rules: {
      attributes: A5, boardSize: 18, timer: 120, hearts: 11, startingHints: 3, startingGraces: 2,
      hazards: { snares: { every: 10 } },
    },
    foes: [{ enemy: 'The Hydra', hp: 999, taunt: 'Cut one head off, two more grow back. Everything you learned, all at once.' }],
    challenge: { kind: 'bigHit', n: 20 }, coinMultiplier: 8, difficulty: 5,
    rewards: { star1: { coins: 400, weapons: ['glass-sword'] }, star2: { weapons: ['chain-reaction'] }, star3: { coins: 1500, weapons: ['mystic-sight'] } },
    recommended: ['Emperor Penguin', 'Orange Tabby', 'Sly Fox'],
  },
];

// ════════════════════ SIDE BRANCHES — fighter trials & elites ════════════════════
// Each opens at ★★ on the level it hangs off (a main level or, in Worlds 3–4,
// another branch). Fighter trials hang off the level that recruits the fighter,
// so you always own the fighter they teach.
export const BRANCH_STAR_REQUIREMENT = 2;

const BRANCHES: LevelInput[] = [
  // World 1
  {
    id: '1-3F', branchOf: '1-3', biome: 'meadow', name: 'Fox Den', introduces: 'fighter_fire',
    // Fighter trial: chain Sets inside 5 s. The wolf punishes standing still. Echo Stone (★★) adds free Sets to the chain.
    rules: { attributes: A3, boardSize: 12, moves: 12, hearts: 3 },
    foes: [{ enemy: 'Stalking Wolf', hp: 99, taunt: 'Too slow, little fox.' }],
    challenge: { kind: 'comboReach', n: 3 }, coinMultiplier: 1.4, difficulty: 2,
    rewards: { star1: { coins: 30 }, star2: { weapons: ['echo-stone'] }, star3: { coins: 70, weapons: ['amplifier-coil'] } },
    recommended: ['Sly Fox'],
  },
  // World 2
  {
    id: '2-4C', branchOf: '2-4', biome: 'woods', name: 'Corgi\'s Yard', introduces: 'fighter_growth',
    // Fighter trial: every bonus card Corgi fetches is another bonus card. Field Stone rare (★★) widens the yard.
    rules: { attributes: A3, timer: 70, hearts: 3, startingHints: 1 },
    foes: [{ name: 'Lazy Tapir', icon: 'delapouite/tapir', hp: 120, taunt: 'Fetch? In this heat?' }],
    challenge: { kind: 'bonusCards', n: 8 }, coinMultiplier: 2, difficulty: 3,
    rewards: { star1: { coins: 50, weapons: ['thorn-bush'] }, star2: { weapons: ['field-stone'] }, star3: { coins: 110, weapons: ['war-drum'] } },
    recommended: ['Corgi'],
  },
  {
    id: '2-7B', branchOf: '2-7', biome: 'woods', name: 'Badger\'s Sett', introduces: 'fighter_grace',
    // Fighter trial: miss on purpose, stack grudges, release one massive Set. Mending Charm rare (★★) keeps you standing.
    rules: { attributes: A3, timer: 70, hearts: 4, startingHints: 1, startingGraces: 1 },
    foes: [{ name: 'Bully Boar', icon: 'caro-asercion/boar', hp: 155, taunt: 'Go on. Take a swing. Miss.' }],
    challenge: { kind: 'bigHit', n: 12 }, coinMultiplier: 2.1, difficulty: 3,
    rewards: { star1: { coins: 55, weapons: ['cursed-idol'] }, star2: { weapons: ['mending-charm'] }, star3: { coins: 120, weapons: ['fortune-token'] } },
    recommended: ['Badger'],
  },
  {
    id: '2-8P', branchOf: '2-8', biome: 'woods', name: 'Ice Floe', introduces: 'fighter_foresight',
    // Fighter trial: the hawk races the clock; every Rainbow freezes it. Time Drop rare (★★) buys more hunting time.
    rules: { attributes: A3, timer: 70, hearts: 3, startingHints: 1, startingGraces: 1 },
    foes: [{ enemy: 'Diving Hawk', hp: 164, taunt: 'The clock is mine. Catch me.' }],
    challenge: { kind: 'rainbows', n: 5 }, coinMultiplier: 2.2, difficulty: 3,
    rewards: { star1: { coins: 55 }, star2: { weapons: ['time-drop'] }, star3: { coins: 120, weapons: ['crystal-orb'] } },
    recommended: ['Emperor Penguin'],
  },
  // World 3
  {
    id: '3-3E', branchOf: '3-3', biome: 'canyon', name: 'The Ant Hill', introduces: 'bomb_swarm',
    rules: { attributes: A4, boardSize: 15, timer: 90, hearts: 13, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Swarming Ants', hp: 558, taunt: 'Tick. Tick. Tick. Tick.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 4, difficulty: 5,
    rewards: { star1: { coins: 150, weapons: ['greedy-chest'] }, star2: { weapons: ['temporal-rift'] }, star3: { coins: 400 } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '3-3E2', branchOf: '3-3E', biome: 'canyon', name: 'Viper Pit', introduces: 'cobra',
    // Chained elite: bombs, snares and shifting traits. Defuse four traps.
    rules: { attributes: A4, boardSize: 15, timer: 95, hearts: 8, startingHints: 2, startingGraces: 1, hazards: { snares: { every: 5 } } },
    foes: [{ enemy: 'Venomous Cobra', hp: 590, taunt: 'Every card a fang. Every fang a fuse.' }],
    challenge: { kind: 'defuseTraps', n: 4 }, coinMultiplier: 4.4, difficulty: 5,
    rewards: { star1: { coins: 170, weapons: ['chain-gang'] }, star2: { weapons: ['blast-powder'] }, star3: { coins: 420, weapons: ['connector'] } },
    recommended: ['Emperor Penguin', 'Badger'],
  },
  {
    id: '3-5P', branchOf: '3-5', biome: 'canyon', name: 'Pelican\'s Wharf', introduces: 'fighter_oracle',
    // Fighter trial: the crab douses fire builds; Pelican does not need any. Seeker Lens rare (★★) keeps hints flowing.
    rules: { attributes: A4, boardSize: 15, timer: 85, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Wet Crab', hp: 258, taunt: 'Bring fire. I dare you.' }],
    challenge: { kind: 'levelUps', n: 3 }, coinMultiplier: 3, difficulty: 4,
    rewards: { star1: { coins: 100, weapons: ['rust'] }, star2: { weapons: ['seeker-lens'] }, star3: { coins: 220, weapons: ['oracle-eye'] } },
    recommended: ['Pelican'],
  },
  {
    id: '3-8E', branchOf: '3-8', biome: 'canyon', name: 'The Deep', introduces: 'deep_dark',
    rules: { attributes: A4, boardSize: 15, timer: 90, hearts: 4, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Nightmare Squid', hp: 810, taunt: 'Down here, you see nothing.' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 4.2, difficulty: 5,
    rewards: { star1: { coins: 160, weapons: ['ice-block'] }, star2: { weapons: ['crystal-orb'] }, star3: { coins: 400, weapons: ['crystal-orb'] } },
    recommended: ['Corgi', 'Pelican'],
  },
  // World 4
  {
    id: '4-2E', branchOf: '4-2', biome: 'peaks', name: 'Bear Country', introduces: 'instant_death',
    rules: { attributes: A5, boardSize: 18, timer: 100, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Raging Bear', hp: 2392, taunt: 'Stop moving and it is over.' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 5, difficulty: 5,
    rewards: { star1: { coins: 200, weapons: ['hot-potato'] }, star2: { weapons: ['soul-harvest'] }, star3: { coins: 600, weapons: ['cascade-core'] } },
    recommended: ['Sly Fox', 'Orange Tabby'],
  },
  {
    id: '4-2E2', branchOf: '4-2E', biome: 'peaks', name: 'Claw Ridge', introduces: 'savage',
    // Chained elite: the clock sprints and every Set costs time. Combo builds only.
    rules: { attributes: A5, boardSize: 18, timer: 110, hearts: 6, startingHints: 3, startingGraces: 2, hazards: { timeBombs: { every: 8, seconds: 12 } } },
    foes: [{ enemy: 'Savage Claws', hp: 442, taunt: 'Faster. FASTER. Still too slow.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5.5, difficulty: 5,
    rewards: { star1: { coins: 230, weapons: ['decoy'] }, star2: { evolution: 'entropy-engine' }, star3: { coins: 700, weapons: ['neural-network'] } },
    recommended: ['Sly Fox'],
  },
  {
    id: '4-5E', branchOf: '4-5', biome: 'peaks', name: 'Sentinel Ruins', introduces: 'double_armor',
    rules: { attributes: A5, boardSize: 18, timer: 100, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Stone Sentinel', hp: 785, taunt: 'Two shields. Zero weaknesses.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5, difficulty: 5,
    rewards: { star1: { coins: 200, weapons: ['tightrope'] }, star2: { weapons: ['revenge-linker'] }, star3: { coins: 600, weapons: ['web-weaver'] } },
    recommended: ['Badger', 'Sly Fox'],
  },
  {
    id: '4-7E', branchOf: '4-7', biome: 'peaks', name: 'Hoarder\'s Den', introduces: 'elite',
    rules: { attributes: A5, boardSize: 18, timer: 100, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Hoarding Beaver', hp: 879, taunt: 'Mine. Mine. Also mine.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5.2, difficulty: 5,
    rewards: { star1: { coins: 210, arcana: 'glass_prism' }, star2: { weapons: ['scholars-tome'] }, star3: { coins: 620, weapons: ['wisdom-chain'] } },
    recommended: ['Corgi'],
  },
  {
    id: '4-7E2', branchOf: '4-7E', biome: 'peaks', name: 'Ink Grotto', introduces: 'abyss',
    // Chained elite: half the board hidden and a 10 s countdown. Corgi re-deals, Pelican scoops.
    rules: { attributes: A5, boardSize: 18, timer: 75, hearts: 15, startingHints: 3, startingGraces: 2, hazards: { snares: { every: 6 } } },
    foes: [{ enemy: 'Abyssal Octopus', hp: 792, taunt: 'Eight arms. Zero light.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 5.8, difficulty: 5,
    rewards: { star1: { coins: 240, weapons: ['cursed-idol'] }, star2: { weapons: ['cascade-core'] }, star3: { coins: 720, weapons: ['mystic-sight'] } },
    recommended: ['Corgi', 'Pelican'],
  },
];

/**
 * From World 2 on, fights run twice as long: foes have double HP and the clock
 * double time. Longer rounds give snowballing builds (stacking weapons,
 * evolutions, combos) room to pay off. Numbers above are authored before this.
 */
const LONG_ROUNDS = { fromWorldAfter: 'meadow' as const, foeHp: 2, timer: 2 };

const withRoundLength = (l: LevelInput): LevelInput =>
  l.biome === LONG_ROUNDS.fromWorldAfter
    ? l
    : {
        ...l,
        foes: l.foes.map(f => ({ ...f, hp: Math.round(f.hp * LONG_ROUNDS.foeHp) })),
        rules: { ...l.rules, ...(l.rules.timer ? { timer: Math.round(l.rules.timer * LONG_ROUNDS.timer) } : {}) },
      };

export const LEVELS: LevelDef[] = [...RAW_LEVELS, ...BRANCHES]
  .map(withRoundLength)
  .map(l => ({ ...l, rewards: normalizeRewards(l) }));

/** The main path, in order (side branches excluded). */
export const MAIN_LEVELS: LevelDef[] = LEVELS.filter(l => !l.branchOf);

/** Side branches hanging directly off this level (a main level or another branch). */
export const branchesOf = (levelId: string): LevelDef[] => LEVELS.filter(l => l.branchOf === levelId);

export const getLevel = (id: string): LevelDef => {
  const l = LEVELS.find(x => x.id === id);
  if (!l) throw new Error(`Unknown level ${id}`);
  return l;
};

/** The main-path level a branch (or a branch of a branch) ultimately hangs off; a main level is its own root. */
export const branchRoot = (level: LevelDef): LevelDef => {
  let at = level;
  for (let guard = 0; at.branchOf && guard < 16; guard++) at = getLevel(at.branchOf);
  return at;
};

/** Position on the main path: a branch sits at its root main level's position. */
/** By id, so a tweaked copy of a level (bots scaling HP, a training dummy) sits where the original does. */
export const mainIndexOf = (level: LevelDef): number => {
  const root = branchRoot(level);
  return MAIN_LEVELS.findIndex(l => l.id === root.id);
};
