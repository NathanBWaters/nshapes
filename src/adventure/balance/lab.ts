/**
 * The balance lab: seeded measurements of every weapon, recipe and build,
 * taken by headless bots through the real fight reducer.
 *
 * Every measurement is a counterfactual: the same bot plays the same seeds
 * with and without the thing, and we report the ratio. Nothing here knows
 * what "good" is (targets.ts does); nothing here writes files (report.ts
 * renders, the tests assert).
 *
 *   benches      three stages of the game, on a foe that can't fall
 *   solo         a weapon alone vs no weapon, per stage and skill tier
 *   inBuild      a weapon in random real builds vs those builds without it
 *   recipe       an evolution vs its two weapons with evolutions off
 *   pair         two weapons together vs what they add separately (synergy)
 */
import type { AttributeName } from '@/types';
import type { AdventureSave, LevelDef } from '../types';
import { getLevel } from '../data/levels';
import { createMaxedSave } from '../progress';
import { BOTS, simulateRun } from '../engine/bot';
import { armableRecipes } from '../engine/botBuilds';
import { createRng } from '../engine/rng';
import { getArmoryWeapon } from '../data/armory';
import { MAX_TUNING_TIER, MAX_WEAPON_LEVEL, weaponStatLines } from '../data/weaponStats';
import type { Tier } from './targets';

export type BenchId = 'early' | 'mid' | 'late';

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
 * The bench pins its trait count and has no Shading Surge, so its numbers stay comparable over time.
 */
const dummy = (from: string, timer: number, hearts: number, traits: number): LevelDef => {
  const ref = getLevel(from);
  return {
    ...ref,
    foes: [{ name: 'Training Dummy', icon: ref.foes[0].icon, hp: 1e7 }],
    rules: { ...ref.rules, attributes: TRAITS.slice(0, traits), boardSize: BOARD[traits], shadingSurge: undefined, hazards: undefined, moves: undefined, timer, hearts },
    challenge: { kind: 'noMistakes' },
  };
};

const gearAt = (level: number, tuned: boolean): Pick<AdventureSave, 'stars' | 'completedBounties' | 'legacyWeaponTiers' | 'weaponTuning'> => {
  const armory = createMaxedSave().armory;
  return {
    // Levels are derived from earned rewards, so clear those and set the floor instead
    stars: {},
    completedBounties: [],
    legacyWeaponTiers: Object.fromEntries(armory.map(id => [id, level - 1])),
    weaponTuning: tuned
      ? Object.fromEntries(
          armory.map(id => {
            const lines = weaponStatLines(getArmoryWeapon(id)!, { level, tuning: {} });
            return [id, Object.fromEntries(lines.filter(l => l.tunable).map(l => [l.key, MAX_TUNING_TIER]))];
          })
        )
      : {},
  };
};

let cached: Record<BenchId, Bench> | null = null;

/** Three stages of the campaign: 3 traits with fresh gear, 4 traits half-grown, 5 traits with everything maxed. */
export const benches = (): Record<BenchId, Bench> => {
  if (cached) return cached;
  // Six charm slots (so a five-charm build fits) and nothing else from the Workshop
  const base = { ...createMaxedSave(), upgrades: { charm_belt: 3 }, skillNodes: {}, charms: [], equippedArcana: [] } as AdventureSave;
  cached = {
    early: { id: 'early', label: '3 traits, level-1 gear', level: dummy('2-6', 120, 3, 3), save: { ...base, ...gearAt(1, false) } },
    mid: { id: 'mid', label: '4 traits, level-3 gear', level: dummy('3-5', 150, 4, 4), save: { ...base, ...gearAt(3, false) } },
    late: { id: 'late', label: '5 traits, level-5 tuned gear', level: dummy('4-4', 180, 5, 5), save: { ...base, ...gearAt(MAX_WEAPON_LEVEL, true) } },
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
}

const seedOf = (i: number) => 1000 + i * 7919;

/** Play `runs` seeded fights on a bench with these charms. Level-up picks and shops are skipped: only what was brought counts. */
export const play = (bench: Bench, charms: readonly string[], tier: Tier, runs: number, over: Partial<AdventureSave> = {}): Sample => {
  const save = { ...bench.save, ...over, charms: [...charms] };
  const out: Sample = { damage: [], events: [], evolutions: [] };
  for (let i = 0; i < runs; i++) {
    // Offers are rolled on their own random stream (run.ts rollPickOptions), so "the same fight" means the weapon did nothing
    const { state } = simulateRun(bench.level, save, BOTS[tier], seedOf(i), undefined, { skipPicks: true });
    out.damage.push(state.totalDamage);
    out.events.push(state.log.reduce((n, e) => n + e.lines.length, 0));
    out.evolutions.push(state.evolutionsTriggered);
  }
  return out;
};

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export interface Lift {
  /** Mean damage with ÷ mean damage without */
  ratio: number;
  /** Share of seeds that played out exactly the same with and without: the thing did nothing */
  dead: number;
  /** Spread of the per-seed ratio (standard deviation): how swingy it is */
  swing: number;
  /** Extra fight-log lines per fight: how much more happens */
  events: number;
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
  };
};

/** A weapon alone vs no weapon. */
export const solo = (bench: Bench, id: string, tier: Tier, runs: number, none: Sample = play(bench, [], tier, runs)): Lift =>
  lift(play(bench, [id], tier, runs), none);

/** Random real builds: `size` different charms from the Armory. */
export const randomBuilds = (armory: readonly string[], size: number, count: number, seed = 99): string[][] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.shuffle([...armory]).slice(0, size));
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
    const rest = rng.shuffle(others.filter(o => o !== id)).slice(0, size - 1);
    // In the middle of the build, so a weapon that copies its neighbour has one
    const build = [...rest.slice(0, 1), id, ...rest.slice(1)];
    lifts.push(lift(play(bench, build, tier, runs), play(bench, rest, tier, runs)));
  }
  return { ratio: mean(lifts.map(l => l.ratio)), dead: mean(lifts.map(l => l.dead)), swing: mean(lifts.map(l => l.swing)), events: mean(lifts.map(l => l.events)) };
};

export interface RecipeLift extends Lift {
  id: string;
  pair: [string, string];
  /** Evolutions started per fight */
  starts: number;
}

/** Every recipe the Armory can arm: its pair with evolutions on vs the same pair with them off. */
export const recipeLifts = (bench: Bench, tier: Tier, runs: number, only?: readonly string[]): RecipeLift[] =>
  armableRecipes(bench.save)
    .filter(r => !only || only.includes(r.id))
    .map(r => {
      const pair: [string, string] = [r.options[0][0], r.options[1][0]];
      const on = play(bench, pair, tier, runs);
      const off = play(bench, pair, tier, runs, { unlockedEvolutions: [] });
      return { id: r.id, pair, starts: mean(on.evolutions), ...lift(on, off) };
    });

/**
 * Synergy of two weapons: what they add together ÷ what they add apart
 * (1 = they simply add up, above = they feed each other, below = they clash).
 */
export const synergy = (bench: Bench, a: string, b: string, tier: Tier, runs: number, none: Sample = play(bench, [], tier, runs)): number => {
  const base = mean(none.damage);
  const gainA = mean(play(bench, [a], tier, runs).damage) - base;
  const gainB = mean(play(bench, [b], tier, runs).damage) - base;
  const both = mean(play(bench, [a, b], tier, runs).damage) - base;
  return both / Math.max(1, gainA + gainB);
};
