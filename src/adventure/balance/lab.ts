/**
 * The balance lab: seeded measurements of every weapon, recipe and build,
 * taken by headless bots through the real fight reducer.
 *
 * Every measurement is a counterfactual: the same bot plays the same seeds
 * with and without the thing, and we report the ratio. Nothing here knows
 * what "good" is (targets.ts does); nothing here writes files (report.ts
 * renders, the tests assert).
 *
 *   benches      four stages of the game (early, mid, late, campaign Surge Lv1-2), on a foe that can't fall
 *   solo         a weapon alone vs no weapon, per stage and skill tier
 *   inBuild      a weapon in random real builds vs those builds without it
 *   recipe       an evolution vs its two weapons with evolutions off AND vs a blank evolution shell (`ruleLift`)
 *   pair         two weapons together vs what they add separately (synergy)
 */
import type { AttributeName } from '@/types';
import type { AdventureSave, LevelDef } from '../types';
import type { Rule } from '../rules/types';
import { getLevel } from '../data/levels';
import { createMaxedSave } from '../progress';
import { BOTS, simulateRun } from '../engine/bot';
import { armableRecipes, fixUnderstudyOrder } from '../engine/botBuilds';
import { createRng } from '../engine/rng';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '../data/armory';
import { getRecipe } from '../engine/sources';
import type { RunOverrides } from '../engine/run';
import { MAX_TUNING_TIER, MAX_WEAPON_LEVEL, weaponStatLines } from '../data/weaponStats';
import { weaponLevelsInWorld } from '../weaponLevels';
import { PARTNER_WEAPONS, type Tier } from './targets';
import { isPowerEnabled, powerMultiplier, setPowerEnabled } from '../data/weaponPower';

export type BenchId = 'early' | 'mid' | 'late' | 'campaign';

export interface Bench {
  id: BenchId;
  label: string;
  level: LevelDef;
  /** The save every measurement on this bench starts from (no charms, nodes, Arcana or Workshop) */
  save: AdventureSave;
}

const TRAITS: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];
const BOARD: Record<number, number | undefined> = { 4: 15, 5: 18 };

/**
 * A fight against a foe that can't fall and never hits back: what is measured is what the player brings.
 * Explicit `parry: null` prevents inheriting `LEVEL_PARRIES` from the reference campaign level!
 */
const dummy = (
  from: string,
  timer: number,
  hearts: number,
  traits: number,
  opts?: { shadingSurge?: boolean; boardSize?: number }
): LevelDef => {
  const ref = getLevel(from);
  return {
    ...ref,
    foes: [{ name: 'Training Dummy', icon: ref.foes[0].icon, hp: 1e7, parry: null }],
    rules: {
      ...ref.rules,
      attributes: TRAITS.slice(0, traits),
      boardSize: opts?.boardSize ?? BOARD[traits],
      shadingSurge: opts?.shadingSurge,
      hazards: undefined,
      moves: undefined,
      timer,
      hearts,
    },
    challenge: { kind: 'noMistakes' },
  };
};

const gearAt = (
  levelFor: number | ((id: string) => number),
  tuned: boolean
): Pick<AdventureSave, 'armory' | 'stars' | 'completedBounties' | 'legacyWeaponTiers' | 'weaponTuning'> => {
  const armory = [...ALL_ARMORY_WEAPON_IDS];
  const lvOf = typeof levelFor === 'function' ? levelFor : () => levelFor;
  return {
    armory,
    // Levels are derived from earned rewards, so clear those and set the floor instead
    stars: {},
    completedBounties: [],
    legacyWeaponTiers: Object.fromEntries(armory.map(id => [id, Math.max(0, lvOf(id) - 1)])),
    weaponTuning: tuned
      ? Object.fromEntries(
          armory.map(id => {
            const lv = lvOf(id);
            const lines = weaponStatLines(getArmoryWeapon(id)!, { level: lv, tuning: {} });
            return [id, Object.fromEntries(lines.filter(l => l.tunable).map(l => [l.key, MAX_TUNING_TIER]))];
          })
        )
      : {},
  };
};

let cached: Record<BenchId, Bench> | null = null;

/** Four stages: early (3-trait Lv1), mid (4-trait Lv3), late (5-trait Lv5 tuned), and realistic campaign (3-trait Shading Surge, Lv1-2 untuned). */
export const benches = (): Record<BenchId, Bench> => {
  if (cached) return cached;
  // Six charm slots (so a five- or six-charm build fits) and nothing else from the Workshop
  const base = {
    ...createMaxedSave(),
    armory: [...ALL_ARMORY_WEAPON_IDS],
    upgrades: { charm_belt: 3 },
    skillNodes: {},
    charms: [],
    equippedArcana: [],
  } as AdventureSave;
  cached = {
    early: { id: 'early', label: '3 traits, level-1 gear', level: dummy('2-6', 120, 3, 3), save: { ...base, ...gearAt(1, false) } },
    mid: { id: 'mid', label: '4 traits, level-3 gear', level: dummy('3-5', 150, 4, 4), save: { ...base, ...gearAt(3, false) } },
    late: { id: 'late', label: '5 traits, level-5 tuned gear', level: dummy('4-4', 180, 5, 5), save: { ...base, ...gearAt(MAX_WEAPON_LEVEL, true) } },
    campaign: {
      id: 'campaign',
      label: '3 traits + Shading Surge (15 cards), realistic Lv 1–2 gear',
      level: dummy('4-4', 150, 5, 3, { shadingSurge: true, boardSize: 15 }),
      save: { ...base, ...gearAt(id => Math.min(2, weaponLevelsInWorld(id)), false) },
    },
  };
  return cached;
};

export interface Sample {
  /** Total damage per seed */
  damage: number[];
  /** Fight-log entries per seed (how much happened) */
  events: number[];
  /** Evolutions started per seed */
  evolutions: number[];
  /** Share of runs that survived without losing all hearts (0..1) */
  survival: number;
  /** Total firings per rule key summed across all seeds in this sample */
  ruleFirings: Record<string, number>;
  /** Total zero-op firings per rule key summed across all seeds in this sample */
  ruleZeroOps: Record<string, number>;
}

const seedOf = (i: number) => 1000 + i * 7919;

/** Run with Power switched on or off, and put it back after. */
const withPower = <T,>(on: boolean, run: () => T): T => {
  const was = isPowerEnabled();
  setPowerEnabled(on);
  try {
    return run();
  } finally {
    setPowerEnabled(was);
  }
};

const addCounts = (dst: Record<string, number>, src?: Record<string, number>) => {
  if (!src) return;
  for (const [k, v] of Object.entries(src)) dst[k] = (dst[k] ?? 0) + v;
};

/**
 * Play `runs` seeded fights on a bench with these charms. Level-up picks and shops are skipped: only what was brought counts.
 * Power is off: the lab judges what weapons do, and Power has its own targets (`pace` below, BALANCE_TARGETS.power).
 */
export const play = (
  bench: Bench,
  charms: readonly string[],
  tier: Tier,
  runs: number,
  over: Partial<AdventureSave> = {},
  overrides?: RunOverrides
): Sample => withPower(false, () => playRaw(bench, charms, tier, runs, over, overrides));

const playRaw = (
  bench: Bench,
  charms: readonly string[],
  tier: Tier,
  runs: number,
  over: Partial<AdventureSave>,
  overrides?: RunOverrides
): Sample => {
  const save = { ...bench.save, ...over, charms: [...charms] };
  const out: Sample = { damage: [], events: [], evolutions: [], survival: 1, ruleFirings: {}, ruleZeroOps: {} };
  let survived = 0;
  for (let i = 0; i < runs; i++) {
    // Offers are rolled on their own random stream (run.ts rollPickOptions), so "the same fight" means the weapon did nothing
    const { state } = simulateRun(bench.level, save, BOTS[tier], seedOf(i), undefined, {
      skipPicks: true,
      trackRuleFirings: true,
      ...(overrides ? { overrides } : {}),
    });
    out.damage.push(state.totalDamage);
    out.events.push(state.log.reduce((n, e) => n + e.lines.length, 0));
    out.evolutions.push(state.evolutionsTriggered);
    if (state.endReason !== 'hearts') survived += 1;
    addCounts(out.ruleFirings, state.ruleFirings);
    addCounts(out.ruleZeroOps, state.ruleZeroOps);
  }
  out.survival = runs > 0 ? survived / runs : 1;
  return out;
};

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** True when a rule's trigger or conditions cannot realistically fire on a calm, infinite-HP, no-hitback dummy. */
export const isDummyUnreachableRule = (rule: Rule): boolean => {
  const on = rule.trigger.on;
  if (on === 'hurt' || on === 'trapDefused' || on === 'foeBelow') return true;
  if (rule.when?.some(c => c.kind === 'heartsAtMost' || c.kind === 'foeHpBelow')) return true;
  return false;
};

/** Effective firings for a rule key (firings that produced non-zero work). */
export const effectiveRuleFirings = (
  firings: Readonly<Record<string, number>>,
  zeroOps: Readonly<Record<string, number>>,
  key: string
): number => Math.max(0, (firings[key] ?? 0) - (zeroOps[key] ?? 0));

export interface Lift {
  /** Mean damage with ÷ mean damage without */
  ratio: number;
  /** Share of seeds that played out exactly the same with and without: the thing did nothing */
  dead: number;
  /** Spread of the per-seed ratio (standard deviation): how swingy it is */
  swing: number;
  /** Extra fight-log lines per fight: how much more happens */
  events: number;
  /** Share of runs with the thing that survived without losing all hearts */
  survival: number;
}

/** Compare two samples played on the same seeds. */
export const lift = (withIt: Sample, without: Sample): Lift => {
  const per = withIt.damage.map((d, i) => d / Math.max(1, without.damage[i]));
  const m = mean(per);
  return {
    ratio: mean(withIt.damage) / Math.max(1, mean(without.damage)),
    dead: mean(withIt.damage.map((d, i) => (d === without.damage[i] && withIt.events[i] === without.events[i] ? 1 : 0))),
    swing: Math.sqrt(mean(per.map(x => (x - m) ** 2))),
    events: mean(withIt.events) - mean(without.events),
    survival: withIt.survival,
  };
};

/** A weapon alone vs no weapon, optionally returning its raw sample for rule-firing inspection. */
export const soloSample = (bench: Bench, id: string, tier: Tier, runs: number, none: Sample = play(bench, [], tier, runs)) => {
  const sample = play(bench, [id], tier, runs);
  return { lift: lift(sample, none), sample };
};

/** A weapon alone vs no weapon. */
export const solo = (bench: Bench, id: string, tier: Tier, runs: number, none: Sample = play(bench, [], tier, runs)): Lift =>
  soloSample(bench, id, tier, runs, none).lift;

/** Random real builds: `size` different charms from the Armory. */
export const randomBuilds = (armory: readonly string[], size: number, count: number, seed = 99): string[][] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => fixUnderstudyOrder(rng.shuffle([...armory]).slice(0, size)));
};

/**
 * Restricted play: what a weapon is worth inside real builds. For each build
 * that holds it, the same seeds are played without it; the mean of those
 * ratios is its "improvement when held".
 */
export const inBuild = (bench: Bench, id: string, tier: Tier, runs: number, others: readonly string[], size: number, count: number): Lift => {
  const rng = createRng(id.length * 131 + id.charCodeAt(0));
  const lifts: Lift[] = [];
  for (let b = 0; b < count; b++) {
    const rest = fixUnderstudyOrder(rng.shuffle(others.filter(o => o !== id)).slice(0, size - 1));
    // In slot 1 (after rest[0]), so a weapon that copies its neighbour (Understudy) always has a real partner
    const build = [...rest.slice(0, 1), id, ...rest.slice(1)];
    lifts.push(lift(play(bench, build, tier, runs), play(bench, rest, tier, runs)));
  }
  return {
    ratio: mean(lifts.map(l => l.ratio)),
    dead: mean(lifts.map(l => l.dead)),
    swing: mean(lifts.map(l => l.swing)),
    events: mean(lifts.map(l => l.events)),
    survival: mean(lifts.map(l => l.survival)),
  };
};

export interface RecipeLift extends Lift {
  id: string;
  pair: [string, string];
  /** Evolutions started per fight */
  starts: number;
  /** Incremental bespoke rule/modifier lift: real evolution ÷ blank evolution shell (+10/+2/×1.5 chassis only) */
  ruleLift: number;
  /** Mean effective `evo:<id>#*` rule firings per fight */
  ruleFirings: number;
  /** Authored rule keys (`evo:<id>#i`) that had 0 effective firings across the batch */
  deadRules: string[];
}

/** Normalize a recipe pair so `understudy` always sits in slot 1 (copying its partner). */
export const normalizeRecipePair = (a: string, b: string): [string, string] =>
  a === 'understudy' ? [b, a] : [a, b];

/** Every recipe the Armory can arm: total lift (`on ÷ off`), incremental bespoke lift (`on ÷ blank shell`), and dead-rule check. */
export const recipeLifts = (bench: Bench, tier: Tier, runs: number, only?: readonly string[]): RecipeLift[] =>
  armableRecipes(bench.save)
    .filter(r => !only || only.includes(r.id))
    .map(r => {
      const pair = normalizeRecipePair(r.options[0][0], r.options[1][0]);
      const on = play(bench, pair, tier, runs);
      const shell = play(bench, pair, tier, runs, {}, { blankEvolutionRules: true });
      const off = play(bench, pair, tier, runs, { unlockedEvolutions: [] });
      const recipeDef = getRecipe(r.id);
      const rules = recipeDef?.source.rules ?? [];
      let totalEffective = 0;
      const deadRules: string[] = [];
      rules.forEach((rule, idx) => {
        const key = `evo:${r.id}#${idx}`;
        const eff = effectiveRuleFirings(on.ruleFirings, on.ruleZeroOps, key);
        totalEffective += eff;
        if (eff <= 0 && !isDummyUnreachableRule(rule)) deadRules.push(key);
      });
      return {
        id: r.id,
        pair,
        starts: mean(on.evolutions),
        ...lift(on, off),
        ruleLift: mean(on.damage) / Math.max(1, mean(shell.damage)),
        ruleFirings: runs > 0 ? totalEffective / runs : 0,
        deadRules,
      };
    });

/**
 * Synergy of two weapons: what they add together ÷ what they add apart
 * (1 = they simply add up, above = they feed each other, below = they clash).
 */
export const synergy = (bench: Bench, a: string, b: string, tier: Tier, runs: number, none: Sample = play(bench, [], tier, runs)): number => {
  const base = mean(none.damage);
  const gainA = mean(play(bench, [a], tier, runs).damage) - base;
  const gainB = mean(play(bench, [b], tier, runs).damage) - base;
  const both = mean(play(bench, normalizeRecipePair(a, b), tier, runs).damage) - base;
  return both / Math.max(1, gainA + gainB);
};

// ─── Power scaling (data/weaponPower.ts) ─────────────────────────────────────

/** The fight that Power is tuned on: 3 minutes, five traits, a foe that can't fall, endgame gear. */
export const SCALE_FIGHT_MS = 180000;
/** Power is judged on the damage rate in the last half minute of that fight. */
export const SCALE_WINDOW_MS = 30000;

let scaleCached: { level: LevelDef; save: AdventureSave } | null = null;
export const scaleBench = () => {
  if (scaleCached) return scaleCached;
  const level = dummy('4-4', SCALE_FIGHT_MS / 1000, 5, 5);
  const base = {
    ...createMaxedSave(),
    armory: [...ALL_ARMORY_WEAPON_IDS],
    upgrades: { charm_belt: 3 },
    skillNodes: {},
    charms: [],
    equippedArcana: [],
  } as AdventureSave;
  scaleCached = { level, save: { ...base, ...gearAt(MAX_WEAPON_LEVEL, true) } };
  return scaleCached;
};

export interface Pace {
  /** Mean total damage */
  total: number;
  /** Mean damage per minute in the last half minute */
  end: number;
  /** Mean damage per minute in the first half minute */
  start: number;
  /** Mean Power multiplier at the end */
  power: number;
  /** Share of runs that survived to the timer without losing all hearts */
  survival: number;
}

/** Play `runs` seeded scaling fights with this save (charms, tree, Arcana and all). */
export const pace = (save: AdventureSave, runs: number, tier: Tier = 'average', level: LevelDef = scaleBench().level): Pace =>
  withPower(true, () => paceRaw(save, runs, tier, level));

const paceRaw = (save: AdventureSave, runs: number, tier: Tier, level: LevelDef): Pace => {
  const out = { total: 0, end: 0, start: 0, power: 0, survived: 0 };
  for (let i = 0; i < runs; i++) {
    const { state } = simulateRun(level, save, BOTS[tier], seedOf(i), undefined, { skipPicks: true });
    // Guard early heart-deaths: divide damage in the real trailing window by actual window duration
    const endFrom = Math.max(0, state.elapsedMs - SCALE_WINDOW_MS);
    const endWinMs = Math.max(1000, state.elapsedMs - endFrom);
    const startWinMs = Math.max(1000, Math.min(SCALE_WINDOW_MS, state.elapsedMs));
    out.total += state.totalDamage;
    out.end += state.log.filter(e => e.t >= endFrom).reduce((a, e) => a + e.damage, 0) * (60000 / endWinMs);
    out.start += state.log.filter(e => e.t < SCALE_WINDOW_MS).reduce((a, e) => a + e.damage, 0) * (60000 / startWinMs);
    out.power += powerMultiplier(state.power);
    if (state.endReason !== 'hearts') out.survived += 1;
  }
  return {
    total: out.total / runs,
    end: out.end / runs,
    start: out.start / runs,
    power: out.power / runs,
    survival: out.survived / runs,
  };
};
