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
import { barePlan, investedPlan, levelsBefore, winTargets, type BuildPlan } from '../engine/botBuilds';

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
const knockout = (dist: number[]) => dist[2] + dist[3];

export interface Rates {
  scale: number;
  bare: number;
  invested: number;
  /** Distance from both targets (plus a penalty if progression doesn't pay) */
  loss: number;
}

/** Both players' knockout rates on this level with every foe's HP multiplied by `scale`. */
export const ratesAt = (level: LevelDef, scale: number, runs: number): Rates => {
  const save = campaignSave(level);
  const scaled: LevelDef = { ...level, foes: level.foes.map(f => ({ ...f, hp: Math.max(1, Math.round(f.hp * scale)) })) };
  const bare = knockout(starDistribution(scaled, save, BOTS.average, runs, withPuzzle(level, barePlan(level))).dist);
  const invested = knockout(starDistribution(scaled, save, BOTS.average, runs, withPuzzle(level, investedPlan(level))).dist);
  const t = winTargets(level);
  return { scale, bare, invested, loss: Math.abs(bare - t.bare) + Math.abs(invested - t.invested) + (invested <= bare ? 1 : 0) };
};

export const COARSE = [0.7, 0.85, 1, 1.2, 1.45];
export const FINE = [0.92, 1.08];

/** The HP scale that puts this level closest to its targets. Returns 1 when nothing beats the current HP. */
export const tuneLevel = (level: LevelDef, runs = 60): { best: Rates; tried: Rates[] } => {
  const tried = COARSE.map(s => ratesAt(level, s, runs));
  let best = tried.reduce((a, b) => (b.loss < a.loss - 1e-9 ? b : a), tried[COARSE.indexOf(1)]);
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
