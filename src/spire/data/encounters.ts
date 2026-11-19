/**
 * Starfall Spire — starter kits, full shared weapon pool, Act themes, and
 * encounter generators using NShapes' real enemies and Set-Parry system.
 *
 * HP curves are designed to be empirically validated & tuned via the headless
 * Spire simulator (`__tests__/spireBalance.test.ts`).
 */
import type { CharacterName } from '@/types';
import type { IconName } from '@/components/Icon';
import type { BiomeId, LevelHazards, ParryRequirement, ParrySpec } from '@/adventure/types';
import { PARRY_RULES } from '@/adventure/data/parry';
import { WEAPON_ROLES, weaponRole } from '@/adventure/data/weaponRoles';
import { ADVENTURE_WEAPONS } from '@/adventure/data/adventureWeapons';
import { FREE_PLAY_ONLY_WEAPONS, getArmoryWeapon } from '@/adventure/data/armory';
import { WEAPONS } from '@/utils/gameDefinitions';
import type { Rng } from '@/adventure/engine/rng';
import type { SpireEncounter } from '../types';
import { ascensionModifiers } from './ascensions';

/** Every valid Armory weapon id shared between Adventure Mode and Starfall Spire. */
export const SPIRE_WEAPON_POOL: readonly string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...WEAPONS, ...ADVENTURE_WEAPONS]) {
    if (FREE_PLAY_ONLY_WEAPONS.includes(w.id) || seen.has(w.id)) continue;
    if (!getArmoryWeapon(w.id)) continue;
    seen.add(w.id);
    out.push(w.id);
  }
  return out;
})();

/** Every fighter brings a thematic starter charm & crisp opening kit to the Spire. */
export interface FighterStarterKit {
  fighter: CharacterName;
  starterWeapon: string;
  bonusWeapon: string;
  maxHearts: number;
  startingCoins: number;
  startingHints: number;
  startingGraces: number;
  tagline: string;
}

export const STARTER_KITS: Record<CharacterName, FighterStarterKit> = {
  'Orange Tabby': {
    fighter: 'Orange Tabby',
    starterWeapon: 'blast-powder',
    bonusWeapon: 'mending-charm',
    maxHearts: 6,
    startingCoins: 65,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Starts armed for Phoenix Pyre — brawls hard and heals through blasts.',
  },
  'Sly Fox': {
    fighter: 'Sly Fox',
    starterWeapon: 'rally-horn',
    bonusWeapon: 'flint-spark',
    maxHearts: 5,
    startingCoins: 70,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Blistering combo speed with opening fire & rhythm bursts.',
  },
  Corgi: {
    fighter: 'Corgi',
    starterWeapon: 'field-stone',
    bonusWeapon: 'growth-seed',
    maxHearts: 6,
    startingCoins: 75,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Wide boards, Fetch power cards, and clean Zoomies sweeps.',
  },
  Badger: {
    fighter: 'Badger',
    starterWeapon: 'second-chance',
    bonusWeapon: 'prismatic-ray',
    maxHearts: 6,
    startingCoins: 65,
    startingHints: 2,
    startingGraces: 2,
    tagline: 'Starts armed for Judgement Beam — turns graces & grudges into lasers.',
  },
  'Emperor Penguin': {
    fighter: 'Emperor Penguin',
    starterWeapon: 'catalyst-prism',
    bonusWeapon: 'clarity-lens',
    maxHearts: 5,
    startingCoins: 70,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Rainbow precision, Deep Freeze locks, and rapid Catalyst surges.',
  },
  Pelican: {
    fighter: 'Pelican',
    starterWeapon: 'echo-stone',
    bonusWeapon: 'cascade-core',
    maxHearts: 6,
    startingCoins: 75,
    startingHints: 3,
    startingGraces: 1,
    tagline: 'Starts armed for Wildfire Echo — free Big Scoops and blazing echo chains.',
  },
};

export interface ActTheme {
  title: string;
  subtitle: string;
  biome: BiomeId;
}

export const actThemeFor = (act: number): ActTheme => {
  if (act === 1) return { title: 'Act I · Sunlit Foothills', subtitle: 'Warm up your engine and forge your first Evolution.', biome: 'woods' };
  if (act === 2) return { title: 'Act II · Ember Canyon', subtitle: 'Counter-Parries intensify and builds catch fire.', biome: 'canyon' };
  if (act === 3) return { title: 'Act III · Starfall Summit', subtitle: 'Shading Surge & Summit Titans stand at the peak.', biome: 'summit' };
  const endlessBiomes: BiomeId[] = ['peaks', 'canyon', 'summit'];
  return {
    title: `Endless Act ${act} · Astral Rift`,
    subtitle: 'Infinite Starfall scaling — push your build past all limits!',
    biome: endlessBiomes[(act - 4) % endlessBiomes.length],
  };
};

interface FoeBlueprint {
  enemy: string;
  taunt: string;
  attackName: string;
  attackIcon: IconName;
  counter: ParryRequirement;
  penalty?: 'heart' | 'time';
  hazards?: LevelHazards;
  /** HP factor relative to the act/floor baseline */
  hpFactor?: number;
}

const ACT1_SKIRMISHES: readonly FoeBlueprint[] = [
  { enemy: 'Lazy Sloth', taunt: 'Take… your… time…', attackName: 'Heavy Yawn', attackIcon: 'lorc/sword-clash', counter: { kind: 'any' }, penalty: 'time', hpFactor: 0.92 },
  { enemy: 'Masked Bandit', taunt: 'Hands off the shine!', attackName: 'Quick Slash', attackIcon: 'lorc/claw-slashes', counter: { kind: 'any' }, hpFactor: 0.96 },
  { enemy: 'Greedy Squirrel', taunt: 'Mine, mine, ALL mine!', attackName: 'Acorn Barrage', attackIcon: 'lorc/sword-clash', counter: { kind: 'any' }, hpFactor: 1.0 },
  { enemy: 'Junk Rat', taunt: 'One rat’s junk is your headache.', attackName: 'Scrap Toss', attackIcon: 'lorc/stone-block', counter: { kind: 'any' }, hpFactor: 0.95 },
  { enemy: 'Spiny Hedgehog', taunt: 'Watch the quills!', attackName: 'Quill Roll', attackIcon: 'caro-asercion/hedgehog', counter: { kind: 'color', color: 'red' }, hpFactor: 1.02 },
  { enemy: 'Night Owl', taunt: 'Whooo sees in the dark?', attackName: 'Moon Dive', attackIcon: 'lorc/moon', counter: { kind: 'shape', shape: 'oval' }, hpFactor: 0.95 },
];

const ACT1_ELITES: readonly FoeBlueprint[] = [
  { enemy: 'Iron Shell', taunt: 'Crack this shell if you can.', attackName: 'Shell Slam', attackIcon: 'lorc/turtle-shell', counter: { kind: 'exact_same', count: 2 }, hazards: { timeBombs: { every: 12, seconds: 18 } }, hpFactor: 1.05 },
  { enemy: 'Trap Weaver', taunt: 'Step carefully in my web.', attackName: 'Venom Fang', attackIcon: 'carl-olsen/spider-face', counter: { kind: 'shape', shape: 'squiggle' }, hazards: { snares: { every: 7 } }, hpFactor: 1.0 },
  { enemy: 'Burrowing Mole', taunt: 'Catch me before I dig!', attackName: 'Tunnel Quake', attackIcon: 'caro-asercion/mole', counter: { kind: 'color', color: 'red' }, hpFactor: 1.02 },
];

const ACT1_BOSSES: readonly FoeBlueprint[] = [
  { enemy: 'Armored Tusks', taunt: 'Charge right into my horns!', attackName: 'Tusk Gore', attackIcon: 'lorc/boar-tusks', counter: { kind: 'exact_same', count: 2 }, hazards: { timeBombs: { every: 11, seconds: 18 } }, hpFactor: 1.0 },
  { enemy: 'Trap Weaver', taunt: 'Every thread pulls tighter!', attackName: 'Silk Fang', attackIcon: 'carl-olsen/spider-face', counter: { kind: 'shape', shape: 'oval' }, hazards: { snares: { every: 6 } }, hpFactor: 0.96 },
];

const ACT2_SKIRMISHES: readonly FoeBlueprint[] = [
  { enemy: 'Goblin Saboteur', taunt: 'Nice toys. Mind if I break one?', attackName: 'Wrench Throw', attackIcon: 'caro-asercion/goblin', counter: { kind: 'exact_diff', count: 2 }, hpFactor: 0.96 },
  { enemy: 'Shifting Chameleon', taunt: 'Red? Green? Look again!', attackName: 'Chroma Lash', attackIcon: 'darkzaitzev/chameleon-glyph', counter: { kind: 'color', color: 'purple' }, hpFactor: 0.95 },
  { enemy: 'Thieving Raven', taunt: 'Seconds taste so sweet!', attackName: 'Chrono Pluck', attackIcon: 'lorc/raven', counter: { kind: 'same_number' }, penalty: 'time', hpFactor: 0.94 },
  { enemy: 'Wet Crab', taunt: 'Bring fire. I dare you.', attackName: 'Riptide Pinch', attackIcon: 'lorc/crab', counter: { kind: 'color', color: 'green' }, hpFactor: 1.0 },
  { enemy: 'Diving Hawk', taunt: 'Eyes up, slowpoke!', attackName: 'Talon Drop', attackIcon: 'lorc/hawk-emblem', counter: { kind: 'shape', shape: 'diamond' }, hpFactor: 0.98 },
  { enemy: 'Cackling Hyena', taunt: 'Hahaha! Missed again?', attackName: 'Pack Snarl', attackIcon: 'caro-asercion/hyena-head', counter: { kind: 'diff_number' }, hpFactor: 1.0 },
];

const ACT2_ELITES: readonly FoeBlueprint[] = [
  { enemy: 'Swarming Ants', taunt: 'Tick. Tick. Tick. Tick.', attackName: 'Swarm Bite', attackIcon: 'delapouite/ant', counter: { kind: 'diff_number' }, hazards: { timeBombs: { every: 10, seconds: 16 } }, hpFactor: 1.0 },
  { enemy: 'Venomous Cobra', taunt: 'Every card a fang.', attackName: 'Cobra Strike', attackIcon: 'skoll/cobra', counter: { kind: 'shape', shape: 'squiggle' }, hazards: { snares: { every: 6 } }, hpFactor: 1.0 },
  { enemy: 'Polar Guardian', taunt: 'Stand firm against the frost.', attackName: 'Glacier Crush', attackIcon: 'sparker/bear-face', counter: { kind: 'exact_same', count: 2 }, hpFactor: 1.04 },
];

const ACT2_BOSSES: readonly FoeBlueprint[] = [
  { enemy: 'Charging Boar', taunt: 'Never stop moving!', attackName: 'Crimson Gore', attackIcon: 'caro-asercion/boar', counter: { kind: 'color', color: 'red' }, hazards: { timeBombs: { every: 10, seconds: 16 } }, hpFactor: 1.0 },
  { enemy: 'Stone Sentinel', taunt: 'Two shields. Zero mercy.', attackName: 'Monolith Slam', attackIcon: 'delapouite/golem-head', counter: { kind: 'shape', shape: 'diamond' }, hazards: { snares: { every: 6 } }, hpFactor: 1.02 },
];

const ACT3_SKIRMISHES: readonly FoeBlueprint[] = [
  { enemy: 'One-Eyed Terror', taunt: 'I see every mistake.', attackName: 'Cyclops Beam', attackIcon: 'lorc/cyclops', counter: { kind: 'shape', shape: 'oval' }, hpFactor: 0.98 },
  { enemy: 'Feral Fangs', taunt: 'Bleed for the Summit!', attackName: 'Feral Rend', attackIcon: 'lorc/bestial-fangs', counter: { kind: 'color', color: 'red' }, hpFactor: 1.0 },
  { enemy: 'Nightmare Squid', taunt: 'Down here, you see nothing.', attackName: 'Abyssal Ink', attackIcon: 'delapouite/giant-squid', counter: { kind: 'color', color: 'purple' }, hpFactor: 0.96 },
  { enemy: 'Hoarding Beaver', taunt: 'Mine. Mine. Also mine.', attackName: 'Dam Break', attackIcon: 'delapouite/beaver', counter: { kind: 'same_number' }, hpFactor: 1.0 },
  { enemy: 'Merciless Porcupine', taunt: 'Every slip costs double.', attackName: 'Quill Tempest', attackIcon: 'caro-asercion/porcupine', counter: { kind: 'exact_diff', count: 2 }, hpFactor: 1.02 },
];

const ACT3_ELITES: readonly FoeBlueprint[] = [
  { enemy: 'Raging Bear', taunt: 'Stop moving and it is over.', attackName: 'Maul Charge', attackIcon: 'sparker/bear-face', counter: { kind: 'exact_diff', count: 2 }, hazards: { timeBombs: { every: 9, seconds: 15 } }, hpFactor: 1.04 },
  { enemy: 'Abyssal Octopus', taunt: 'Eight arms. Zero light.', attackName: 'Tentacle Whip', attackIcon: 'lorc/octopus', counter: { kind: 'color', color: 'purple' }, hazards: { snares: { every: 6 } }, hpFactor: 1.0 },
  { enemy: 'The Reaper', taunt: 'Your clock is mine.', attackName: 'Soul Scythe', attackIcon: 'lorc/grim-reaper', counter: { kind: 'shape', shape: 'diamond' }, hazards: { timeBombs: { every: 9, seconds: 15 } }, hpFactor: 1.02 },
];

const ACT3_BOSSES: readonly FoeBlueprint[] = [
  { enemy: 'Ancient Dragon', taunt: 'Burn in Starfall fire!', attackName: 'Prismatic Inferno', attackIcon: 'lorc/dragon-head', counter: { kind: 'all_different' }, hazards: { snares: { every: 6 } }, hpFactor: 1.0 },
  { enemy: 'World Eater', taunt: 'All stars return to the void.', attackName: 'Void Rift', attackIcon: 'lorc/daemon-skull', counter: { kind: 'exact_diff', count: 2 }, hazards: { timeBombs: { every: 9, seconds: 15 } }, hpFactor: 1.04 },
  { enemy: 'The Hydra', taunt: 'Cut one head, face three!', attackName: 'Hydra Apocalypse', attackIcon: 'lorc/hydra', counter: { kind: 'all_different' }, hazards: { snares: { every: 6 } }, hpFactor: 1.02 },
];

/**
 * Calibrated base HP curve per Act and row (row 0..5 = floors, row 6 = Boss).
 * Accounts for NShapes' real Power ×N snowball (1–2 weapons in Act 1 → 4–6+
 * weapons + Evolutions + Skill Nodes + Shading Surge in Act 3 → Endless!).
 */
const BASE_ACT_HP: Record<number, { start: number; end: number; eliteMult: number; boss: number; timer: number }> = {
  1: { start: 320, end: 1200, eliteMult: 1.32, boss: 2050, timer: 104 },
  2: { start: 2250, end: 7400, eliteMult: 1.38, boss: 12200, timer: 116 },
  3: { start: 13000, end: 35000, eliteMult: 1.42, boss: 60000, timer: 126 },
};

const actCurve = (act: number) => {
  if (act <= 3) return BASE_ACT_HP[act] ?? BASE_ACT_HP[3];
  const endlessStep = act - 3;
  const scale = Math.pow(3.4, endlessStep);
  return {
    start: Math.round(BASE_ACT_HP[3].end * 0.95 * scale),
    end: Math.round(BASE_ACT_HP[3].boss * 1.25 * scale),
    eliteMult: 1.48,
    boss: Math.round(BASE_ACT_HP[3].boss * 2.0 * scale),
    timer: Math.max(85, 118 - endlessStep * 6),
  };
};

export const generateSpireEncounter = (o: {
  act: number;
  row: number;
  kind: 'skirmish' | 'elite' | 'boss';
  ascension: number;
  rng: Rng;
  id: string;
}): SpireEncounter => {
  const { act, row, kind, ascension, rng, id } = o;
  const theme = actThemeFor(act);
  const asc = ascensionModifiers(ascension);
  const curve = actCurve(act);

  const pool =
    act === 1
      ? kind === 'boss' ? ACT1_BOSSES : kind === 'elite' ? ACT1_ELITES : ACT1_SKIRMISHES
      : act === 2
        ? kind === 'boss' ? ACT2_BOSSES : kind === 'elite' ? ACT2_ELITES : ACT2_SKIRMISHES
        : kind === 'boss' ? ACT3_BOSSES : kind === 'elite' ? ACT3_ELITES : ACT3_SKIRMISHES;

  const bp = rng.pick(pool);
  const rowFrac = Math.max(0, Math.min(1, row / 5));
  let baseHp =
    kind === 'boss'
      ? curve.boss
      : Math.round((curve.start + (curve.end - curve.start) * rowFrac) * (kind === 'elite' ? curve.eliteMult : 1));
  baseHp = Math.round(
    baseHp * (bp.hpFactor ?? 1) * asc.foeHpScale * (kind === 'skirmish' ? 1 : asc.bossHpScale)
  );

  const timerBase = kind === 'boss' ? curve.timer + 20 : kind === 'elite' ? curve.timer + 10 : curve.timer;
  const timer = Math.max(60, Math.round(timerBase * asc.timerScale));

  // Early Act 1 Skirmishes default to timing-based parry unless Ascension 5+ or late Act 1!
  const useDefaultTiming =
    act === 1 && kind === 'skirmish' && row <= 2 && !asc.earlySpecificCounters;
  const counter: ParryRequirement = useDefaultTiming ? { kind: 'any' } : bp.counter;
  const baseCooldown = kind === 'boss' ? 12000 : kind === 'elite' ? 12500 : 13500;
  const baseWindup = counter.kind === 'any' ? 15000 : 15500;
  const parry: ParrySpec = {
    attackName: bp.attackName,
    icon: bp.attackIcon,
    counter,
    cooldownMs: Math.max(8000, Math.round(baseCooldown * asc.parrySpeedScale)),
    windupMs: Math.max(10500, Math.round(baseWindup * asc.parrySpeedScale)),
    perfectWindowMs: PARRY_RULES.perfectWindowMs,
    penalty: bp.penalty ?? 'heart',
  };

  let hazards: LevelHazards | undefined = bp.hazards ? { ...bp.hazards } : undefined;
  if (asc.extraHazards && kind !== 'skirmish' && !hazards) {
    hazards = { timeBombs: { every: 11, seconds: 16 } };
  }

  const shadingSurge = act >= 3 || (act === 2 && kind === 'boss');

  const coinReward =
    kind === 'boss'
      ? 95 + act * 30
      : kind === 'elite'
        ? 65 + act * 22
        : 36 + act * 14 + row * 4;

  const difficulty = Math.min(
    5,
    Math.max(1, act + (kind === 'boss' ? 2 : kind === 'elite' ? 1 : row >= 4 ? 1 : 0))
  ) as 1 | 2 | 3 | 4 | 5;

  return {
    id,
    name: bp.enemy,
    kind,
    biome: theme.biome,
    foes: [{ enemy: bp.enemy, hp: baseHp, taunt: bp.taunt, parry }],
    timer,
    boardSize: act >= 2 || kind !== 'skirmish' ? 15 : 12,
    shadingSurge,
    ...(hazards ? { hazards } : {}),
    coinReward,
    difficulty,
    parry,
  };
};

/** Helper to check if a weapon belongs to a given role shelf (useful for Spire draft diversity). */
export const spireRoleLabel = (weaponId: string): string => {
  const role = weaponRole(weaponId);
  return WEAPON_ROLES.find(r => r.id === role)?.label ?? 'Damage';
};
