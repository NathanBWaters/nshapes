/**
 * The campaign. Edit this table to rebalance or reorder the adventure.
 *
 * Design rules (keep these true when editing):
 *  - Every level `introduces` exactly one mechanic, in a sensible order.
 *  - ★ = survive (moves used up / clock runs out with hearts left)
 *  - ★★ = knock out every foe
 *  - ★★★ = knock out every foe AND meet the challenge
 *  - Foe HP is tuned so ★★ needs decent play, and ★★★ often needs a stronger
 *    fighter or a return visit. See __tests__/adventureBalance.test.ts for
 *    the headless bot that checks this.
 */
import type { AttributeName } from '@/types';
import type { LevelDef } from '../types';

const A2: AttributeName[] = ['shape', 'color'];
const A3: AttributeName[] = ['shape', 'color', 'number'];
const A4: AttributeName[] = ['shape', 'color', 'number', 'shading'];
const A5: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];

type LevelInput = Omit<LevelDef, 'index'>;

const RAW_LEVELS: LevelInput[] = [
  // ════════════════════ SUNNY MEADOW — no clock, no shop ════════════════════
  {
    id: '1-1', biome: 'meadow', name: 'First Light', introduces: 'set_rule',
    rules: { attributes: A2, boardSize: 9, moves: 6, hearts: 0 },
    foes: [{ name: 'Dozy Bunny', icon: 'delapouite/rabbit', hp: 12, taunt: 'Zzz… huh? A challenger?' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 1, difficulty: 1,
    rewards: { star1: { coins: 10 }, star2: { coins: 15 }, star3: { coins: 25 } },
  },
  {
    id: '1-2', biome: 'meadow', name: 'Ouch!', introduces: 'hearts',
    rules: { attributes: A2, boardSize: 9, moves: 7, hearts: 3 },
    foes: [{ name: 'Prickle', icon: 'caro-asercion/hedgehog', hp: 18, taunt: 'Careful, I\'m pointy.' }],
    challenge: { kind: 'fullHearts' }, coinMultiplier: 1, difficulty: 1,
    rewards: { star1: { coins: 10 }, star2: { coins: 20 }, star3: { coins: 30 } },
  },
  {
    id: '1-3', biome: 'meadow', name: 'Counting Acorns', introduces: 'attr_number',
    rules: { attributes: A3, boardSize: 12, moves: 8, hearts: 3 },
    foes: [{ name: 'Nutkin', icon: 'delapouite/squirrel', hp: 21, taunt: 'One, two, three… mine!' }],
    challenge: { kind: 'streak', n: 4 }, coinMultiplier: 1, difficulty: 1,
    rewards: { star1: { coins: 15 }, star2: { coins: 25 }, star3: { weapons: ['mending-charm-rare'] } },
  },
  {
    id: '1-4', biome: 'meadow', name: 'Gear Up', introduces: 'gear',
    rules: { attributes: A3, boardSize: 12, moves: 8, hearts: 3 },
    foes: [{ name: 'Bramble Frog', icon: 'lorc/frog', hp: 24, taunt: 'Ribbit. Nice gear. Shame about you.' }],
    challenge: { kind: 'movesLeft', n: 1 }, coinMultiplier: 1.1, difficulty: 2,
    rewards: { star1: { coins: 15 }, star2: { weapons: ['life-vessel-rare'] }, star3: { coins: 40 } },
  },
  {
    id: '1-5', biome: 'meadow', name: 'Rainbow Strike', introduces: 'rainbow',
    rules: { attributes: A3, boardSize: 12, moves: 7, hearts: 3 },
    foes: [{ name: 'Prism Moth', icon: 'lorc/evil-bat', hp: 27, taunt: 'Only a rainbow can hurt me.' }],
    challenge: { kind: 'movesLeft', n: 1 }, coinMultiplier: 1.1, difficulty: 2,
    rewards: { star1: { coins: 20 }, star2: { coins: 30 }, star3: { weapons: ['echo-stone-common'] } },
  },
  {
    id: '1-6', biome: 'meadow', name: 'Gold Rush', introduces: 'coins',
    rules: { attributes: A3, boardSize: 12, moves: 9, hearts: 3 },
    foes: [{ name: 'Magpie', icon: 'lorc/raven', hp: 30, taunt: 'Shiny! Shiny! MINE!' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 1.5, difficulty: 2,
    rewards: { star1: { coins: 30 }, star2: { weapons: ['fortunes-favor-common'] }, star3: { coins: 60 } },
  },
  {
    id: '1-7', biome: 'meadow', name: 'Ticking Clock', introduces: 'timer',
    rules: { attributes: A3, boardSize: 12, timer: 50, hearts: 3 },
    foes: [{ enemy: 'Lazy Sloth', hp: 26, taunt: 'Take… your… time…' }],
    challenge: { kind: 'timeLeft', n: 10 }, coinMultiplier: 1.2, difficulty: 2,
    rewards: { star1: { coins: 25 }, star2: { weapons: ['chrono-shard-common'] }, star3: { coins: 50 } },
  },
  {
    id: '1-8', biome: 'meadow', name: 'Shell Shock', introduces: 'triple_card', isBoss: true,
    rules: { attributes: A3, boardSize: 12, timer: 60, hearts: 3 },
    foes: [{ enemy: 'Iron Shell', hp: 30, taunt: 'Nothing gets through this shell.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.6, difficulty: 3,
    rewards: { star1: { coins: 40 }, star2: { character: 'Sly Fox', weapons: ['flint-spark-common', 'blast-powder-common'] }, star3: { coins: 100 } },
    recommended: ['Sly Fox'],
  },

  // ════════════════════ WHISPERING WOODS — foe tricks ════════════════════
  {
    id: '2-1', biome: 'woods', name: 'A Little Help', introduces: 'hints',
    rules: { attributes: A3, timer: 60, hearts: 3, startingHints: 2 },
    foes: [{ enemy: 'Foggy Frog', hp: 36, taunt: 'Hints? In this fog? Good luck.' }],
    challenge: { kind: 'hintsLeft', n: 2 }, coinMultiplier: 1.5, difficulty: 2,
    rewards: { star1: { coins: 30 }, star2: { weapons: ['seeker-lens-common', 'crystal-orb-common'] }, star3: { coins: 70 } },
  },
  {
    id: '2-2', biome: 'woods', name: 'Junk Drawer', introduces: 'duds',
    rules: { attributes: A3, timer: 60, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Junk Rat', hp: 38, taunt: 'One rat\'s junk is… still junk.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.6, difficulty: 3,
    rewards: { star1: { coins: 35 }, star2: { weapons: ['blast-powder-rare'] }, star3: { coins: 80 } },
    recommended: ['Corgi', 'Sly Fox'],
  },
  {
    id: '2-3', biome: 'woods', name: 'Lights Out', introduces: 'face_down',
    rules: { attributes: A3, timer: 60, hearts: 3, startingHints: 1 },
    foes: [{ enemy: 'Night Owl', hp: 36, taunt: 'Whooo can see in the dark?' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.6, difficulty: 3,
    rewards: { star1: { coins: 35 }, star2: { weapons: ['oracle-eye-common'] }, star3: { coins: 80 } },
    recommended: ['Corgi'],
  },
  {
    id: '2-4', biome: 'woods', name: 'Near Miss', introduces: 'graces',
    rules: { attributes: A3, timer: 60, hearts: 3, startingHints: 1, startingGraces: 2 },
    foes: [{ enemy: 'Sneaky Mouse', hp: 38, taunt: 'Close only counts in horseshoes!' }],
    challenge: { kind: 'noGrace' }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 40 }, star2: { character: 'Badger', weapons: ['second-chance-common', 'fortune-token-common'] }, star3: { coins: 90 } },
    recommended: ['Badger'],
  },
  {
    id: '2-5', biome: 'woods', name: 'Level Up!', introduces: 'xp',
    rules: { attributes: A3, timer: 70, hearts: 3, startingHints: 1, startingGraces: 1 },
    foes: [{ name: 'Busy Beaver', icon: 'delapouite/beaver', hp: 40, taunt: 'I\'ve been training all season.' }],
    challenge: { kind: 'fullHearts' }, coinMultiplier: 1.7, difficulty: 3,
    rewards: { star1: { coins: 40 }, star2: { weapons: ['scholars-tome-common', 'growth-seed-common'] }, star3: { coins: 100 } },
  },
  {
    id: '2-6', biome: 'woods', name: 'Tick Tock', introduces: 'countdown',
    rules: { attributes: A3, timer: 60, hearts: 4, startingHints: 1, startingGraces: 1 },
    foes: [{ enemy: 'Ticking Viper', hp: 38, taunt: 'Tick… tock… hisss.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 1.8, difficulty: 3,
    rewards: { star1: { coins: 45 }, star2: { weapons: ['time-drop-common'] }, star3: { coins: 100 } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '2-7', biome: 'woods', name: 'Wild Goose Chase', introduces: 'shuffle',
    rules: { attributes: A3, timer: 65, hearts: 3, startingHints: 1, startingGraces: 1 },
    foes: [{ enemy: 'Wild Goose', hp: 42, taunt: 'HONK! Where\'d your Set go?' }],
    challenge: { kind: 'streak', n: 5 }, coinMultiplier: 1.8, difficulty: 3,
    rewards: { star1: { coins: 45 }, star2: { weapons: ['chaos-shard-common'] }, star3: { weapons: ['fortunes-favor-rare'] } },
  },
  {
    id: '2-8', biome: 'woods', name: 'The Web', introduces: 'bombs', isBoss: true,
    rules: { attributes: A3, timer: 70, hearts: 3, startingHints: 1, startingGraces: 1 },
    foes: [{ enemy: 'Trap Weaver', hp: 44, taunt: 'Step lightly. Everything here is wired.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.4, difficulty: 4,
    rewards: { star1: { coins: 70 }, star2: { character: 'Emperor Penguin', weapons: ['crystal-orb-rare', 'seeker-lens-rare'] }, star3: { coins: 160 } },
    recommended: ['Emperor Penguin'],
  },

  // ════════════════════ EMBER CANYON — shading, waves, shop ════════════════════
  {
    id: '3-1', biome: 'canyon', name: 'Fourth Dimension', introduces: 'attr_shading',
    rules: { attributes: A4, boardSize: 15, timer: 75, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ name: 'Dusty Mammoth', icon: 'delapouite/mammoth', hp: 30, taunt: 'Solid. Striped. Open. Crushed.' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 2.2, difficulty: 3,
    rewards: { star1: { coins: 60 }, star2: { weapons: ['prismatic-ray-common'] }, star3: { coins: 140 } },
  },
  {
    id: '3-2', biome: 'canyon', name: 'Marching Ants', introduces: 'waves',
    rules: { attributes: A4, boardSize: 15, timer: 90, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [
      { name: 'Scout Ant', icon: 'delapouite/ant', hp: 9 },
      { name: 'Soldier Ant', icon: 'delapouite/ant', hp: 11 },
      { name: 'Queen Ant', icon: 'delapouite/ant', hp: 13, taunt: 'You squashed my children!' },
    ],
    challenge: { kind: 'timeLeft', n: 10 }, coinMultiplier: 2.4, difficulty: 3,
    rewards: { star1: { coins: 70 }, star2: { weapons: ['growth-seed-rare', 'field-stone-common'] }, star3: { coins: 150 } },
  },
  {
    id: '3-3', biome: 'canyon', name: 'Market Day', introduces: 'shop',
    rules: { attributes: A4, boardSize: 15, timer: 100, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [
      { name: 'Pickpocket Hyena', icon: 'caro-asercion/hyena-head', hp: 10 },
      { name: 'Haggling Hyena', icon: 'caro-asercion/hyena-head', hp: 12 },
      { name: 'Hyena Boss', icon: 'caro-asercion/hyena-head', hp: 15, taunt: 'Everything has a price!' },
    ],
    challenge: { kind: 'fullHearts' }, coinMultiplier: 2.5, difficulty: 3,
    rewards: { star1: { coins: 80 }, star2: { weapons: ['flint-spark-rare', 'time-drop-rare'] }, star3: { coins: 170 } },
  },
  {
    id: '3-4', biome: 'canyon', name: 'Mole Hole', introduces: 'card_removal',
    rules: { attributes: A4, boardSize: 15, timer: 75, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Burrowing Mole', hp: 32, taunt: 'Dig, dig, dig… gone!' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.6, difficulty: 4,
    rewards: { star1: { coins: 80 }, star2: { weapons: ['echo-stone-rare'] }, star3: { coins: 180 } },
    recommended: ['Corgi'],
  },
  {
    id: '3-5', biome: 'canyon', name: 'Color Me Gone', introduces: 'attr_shift',
    rules: { attributes: A4, boardSize: 15, timer: 75, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Shifting Chameleon', hp: 32, taunt: 'Now you see me…' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 2.6, difficulty: 4,
    rewards: { star1: { coins: 80 }, star2: { character: 'Corgi', weapons: ['field-stone-rare'] }, star3: { coins: 180 } },
    recommended: ['Pelican', 'Corgi'],
  },
  {
    id: '3-6', biome: 'canyon', name: 'Sticky Talons', introduces: 'time_steal',
    rules: { attributes: A4, boardSize: 15, timer: 90, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Thieving Raven', hp: 27, taunt: 'Your seconds look delicious.' }],
    challenge: { kind: 'rainbows', n: 2 }, coinMultiplier: 2.7, difficulty: 4,
    rewards: { star1: { coins: 90 }, star2: { weapons: ['chrono-shard-rare'] }, star3: { weapons: ['prismatic-ray-rare'] } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '3-7', biome: 'canyon', name: 'Circling', introduces: 'regen',
    rules: { attributes: A4, boardSize: 15, timer: 80, hearts: 3, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Circling Vulture', hp: 26, taunt: 'I can wait. I always wait.' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 2.8, difficulty: 4,
    rewards: { star1: { coins: 90 }, star2: { weapons: ['mending-charm-rare', 'scholars-tome-rare'] }, star3: { coins: 200 } },
    recommended: ['Sly Fox'],
  },
  {
    id: '3-8', biome: 'canyon', name: 'Stampede', introduces: 'inactivity', isBoss: true,
    rules: { attributes: A4, boardSize: 15, timer: 90, hearts: 4, startingHints: 2, startingGraces: 1 },
    foes: [{ enemy: 'Charging Boar', hp: 42, taunt: 'Stand still and I\'ll flatten you.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.5, difficulty: 5,
    rewards: { star1: { coins: 130 }, star2: { character: 'Pelican', weapons: ['oracle-eye-rare', 'mystic-sight-legendary'] }, star3: { coins: 300 } },
    recommended: ['Sly Fox', 'Pelican'],
  },

  // ════════════════════ FROZEN PEAKS — all five traits ════════════════════
  {
    id: '4-1', biome: 'peaks', name: 'Fifth Element', introduces: 'attr_background',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ name: 'Snow Hare', icon: 'delapouite/rabbit', hp: 24, taunt: 'Five traits. Can you keep up?' }],
    challenge: { kind: 'noMistakes' }, coinMultiplier: 3.2, difficulty: 4,
    rewards: { star1: { coins: 120 }, star2: { weapons: ['ember-heart'] }, star3: { coins: 260 } },
    recommended: ['Pelican'],
  },
  {
    id: '4-2', biome: 'peaks', name: 'Buzzing', introduces: 'fast_timer',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Swift Bee', hp: 26, taunt: 'Bzzz! Faster! FASTER!' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.4, difficulty: 4,
    rewards: { star1: { coins: 130 }, star2: { weapons: ['temporal-core'] }, star3: { coins: 280 } },
    recommended: ['Emperor Penguin'],
  },
  {
    id: '4-3', biome: 'peaks', name: 'Glass Cannon', introduces: 'double_damage',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Stinging Scorpion', hp: 72, taunt: 'One sting is all it takes.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.6, difficulty: 5,
    rewards: { star1: { coins: 140 }, star2: { weapons: ['restoration-aura', 'inferno-charge'] }, star3: { coins: 300 } },
    recommended: ['Orange Tabby'],
  },
  {
    id: '4-4', biome: 'peaks', name: 'Cold Justice', introduces: 'invalid_punish',
    rules: { attributes: A5, boardSize: 18, timer: 90, hearts: 4, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'Punishing Ermine', hp: 24, taunt: 'Every mistake will be punished.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 3.8, difficulty: 5,
    rewards: { star1: { coins: 150 }, star2: { weapons: ['terra-foundation', 'lucky-charm'] }, star3: { coins: 320 } },
    recommended: ['Badger'],
  },
  {
    id: '4-5', biome: 'peaks', name: 'Many Heads', introduces: 'final_boss', isBoss: true,
    rules: { attributes: A5, boardSize: 18, timer: 120, hearts: 6, startingHints: 3, startingGraces: 2 },
    foes: [{ enemy: 'The Hydra', hp: 40, taunt: 'Cut one head off, two more grow back.' }],
    challenge: { kind: 'enemy' }, coinMultiplier: 6, difficulty: 5,
    rewards: { star1: { coins: 300 }, star2: { weapons: ['chain-reaction-legendary', 'spectrum-annihilator'] }, star3: { coins: 800 } },
    recommended: ['Emperor Penguin', 'Orange Tabby'],
  },
];

export const LEVELS: LevelDef[] = RAW_LEVELS.map((l, index) => ({ ...l, index }));

export const getLevel = (id: string): LevelDef => {
  const l = LEVELS.find(x => x.id === id);
  if (!l) throw new Error(`Unknown level ${id}`);
  return l;
};

export const levelsInBiome = (biome: string): LevelDef[] => LEVELS.filter(l => l.biome === biome);
