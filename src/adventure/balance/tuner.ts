/**
 * The HP tuner: foe HP is the one knob per level (docs/balance-philosophy.md),
 * so this searches it. For each level it plays the bare and the invested
 * player at several HP scales and keeps the scale whose knockout rates sit
 * closest to that level's targets (engine/botBuilds.ts winTargets).
 *
 *   npm run balance:tune            every level
 *   ONLY=5-2,3-4 npm run balance:tune
 *
 * The search is coarse then fine around the best coarse scale. The numbers are
 * seeded, so the result is exactly what __tests__/adventureBalance.test.ts
 * will then measure.
 */
import type { AdventureSave, LevelDef } from '../types';
import { applyLevelResult, createNewSave } from '../progress';
import { BOTS, starDistribution } from '../engine/bot';
import { barePlan, investedPlan, levelsBefore, starTargets, worldOf, type BuildPlan } from '../engine/botBuilds';

/** Levels whose puzzle names its charms (kept in step with __tests__/adventureBalance.test.ts) */
export const PUZZLE_CHARMS: Record<string, string[]> = { '3-2': ['blast-powder', 'flint-spark', 'prismatic-ray'] };

const saves = new Map<string, AdventureSave>();
/** What the player owns on reaching a level: 3★ on every level before it, through the real reward pipeline. */
export const campaignSave = (level: LevelDef): AdventureSave => {
  const hit = saves.get(level.id);
  if (hit) return hit;
  let save = createNewSave();
  for (const l of levelsBefore(level)) save = applyLevelResult(save, l, 3, 0).save;
  if (PUZZLE_CHARMS[level.id]) save = { ...save, charms: PUZZLE_CHARMS[level.id] };
  saves.set(level.id, save);
  return save;
};

const withPuzzle = (level: LevelDef, plan: BuildPlan): BuildPlan => ({ ...plan, keepCharms: !!PUZZLE_CHARMS[level.id] });
const clearRate = (dist: number[]) => dist[1] + dist[2] + dist[3];
const knockout = (dist: number[]) => dist[2] + dist[3];

export interface Rates {
  scale: number;
  bareClear: number;
  bare: number;
  investedClear: number;
  invested: number;
  investedStar3: number;
  expertStar3: number;
  /** Multi-star distance across ★1+ clear floor, ★★+ knockout targets, and ★★★ mastery */
  loss: number;
}

/**
 * Full 3-star evaluation (`★1+`, `★★+`, `★★★` + World 1 pro `★★★`) at foe HP × `scale`.
 * Prevents both over-tuning HP (crushing ★★/★★★) and under-tuning HP (killing the foe before
 * in-fight ★★★ objectives like bombs, explosions or Catalysts have time to trigger).
 */
export const ratesAt = (level: LevelDef, scale: number, runs: number): Rates => {
  const save = campaignSave(level);
  const scaled: LevelDef = { ...level, foes: level.foes.map(f => ({ ...f, hp: Math.max(1, Math.round(f.hp * scale)) })) };
  const bareDist = starDistribution(scaled, save, BOTS.average, runs, withPuzzle(level, barePlan(level))).dist;
  const invDist = starDistribution(scaled, save, BOTS.average, runs, withPuzzle(level, investedPlan(level))).dist;
  const bareClear = clearRate(bareDist);
  const bare = knockout(bareDist);
  const investedClear = clearRate(invDist);
  const invested = knockout(invDist);
  const investedStar3 = invDist[3];
  const expertRuns = worldOf(level) === 1 ? Math.max(20, Math.round(runs / 2)) : 0;
  const expertStar3 =
    expertRuns > 0
      ? starDistribution(scaled, save, BOTS.expert, expertRuns, withPuzzle(level, investedPlan(level))).dist[3]
      : investedStar3;
  const t = starTargets(level);
  const clearPenalty =
    Math.max(0, t.bareClearFloor - bareClear) * 1.5 + Math.max(0, t.investedClearFloor - investedClear) * 1.5;
  const koLoss = Math.abs(bare - t.bareKo) + Math.abs(invested - t.investedKo);
  const star3Loss =
    (investedStar3 < t.investedStar3Floor
      ? (t.investedStar3Floor - investedStar3) * 1.5
      : Math.abs(investedStar3 - t.investedStar3) * 0.3) +
    (expertRuns > 0 ? Math.max(0, t.expertStar3Floor - expertStar3) * 2 : 0);
  const progressionPenalty = invested < bare ? 1 : invested === bare && bare < 0.95 ? 0.5 : 0;
  return {
    scale,
    bareClear,
    bare,
    investedClear,
    invested,
    investedStar3,
    expertStar3,
    loss: koLoss + clearPenalty + star3Loss + progressionPenalty,
  };
};

/** A first geometric sweep, for when damage has moved a long way (a new scaling layer, a big rework) */
export const WIDE = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
export const COARSE = [0.7, 0.85, 1, 1.2, 1.45];
export const FINE = [0.92, 1.08];

/**
 * The HP scale that puts this level closest to its targets. Returns 1 when nothing beats the current HP.
 * `wide`: start with a geometric sweep from ×0.25 to ×32 (fewer runs each), then search around its best.
 */
export const tuneLevel = (level: LevelDef, runs = 60, wide = false): { best: Rates; tried: Rates[] } => {
  const tried: Rates[] = [];
  let center = 1;
  if (wide) {
    const sweep = WIDE.map(s => ratesAt(level, s, Math.max(20, Math.round(runs / 3))));
    tried.push(...sweep);
    center = sweep.reduce((a, b) => (b.loss < a.loss - 1e-9 ? b : a), sweep[WIDE.indexOf(1)]).scale;
  }
  const coarse = COARSE.map(s => ratesAt(level, +(center * s).toFixed(3), runs));
  tried.push(...coarse);
  let best = coarse.reduce((a, b) => (b.loss < a.loss - 1e-9 ? b : a), coarse[COARSE.indexOf(1)]);
  for (const f of FINE) {
    const r = ratesAt(level, +(best.scale * f).toFixed(3), runs);
    tried.push(r);
    if (r.loss < best.loss - 1e-9) best = r;
  }
  return { best, tried };
};

/** Multiply every `hp:` of one level in the text of data/levels.ts. */
export const scaleLevelHp = (source: string, levelId: string, scale: number): string => {
  const start = source.indexOf(`id: '${levelId}',`);
  if (start < 0) throw new Error(`Level ${levelId} not found in levels.ts`);
  const next = source.indexOf("id: '", start + 5);
  const end = next < 0 ? source.length : next;
  const chunk = source.slice(start, end).replace(/\bhp: (\d+)/g, (_m, hp: string) => `hp: ${Math.max(1, Math.round(Number(hp) * scale))}`);
  return source.slice(0, start) + chunk + source.slice(end);
};
