/**
 * The HP tuner: foe HP is the one knob per level (docs/balance-philosophy.md),
 * so this searches it while tracking heart-death lethality walls, multi-wave
 * clear rates, World 2–5 expert ★★★ achievability, and cross-level / boss HP
 * monotonicity (`validateCampaignHpCurve`).
 *
 *   npm run balance:tune            every level
 *   ONLY=5-2,3-4 npm run balance:tune
 */
import type { LevelDef } from '../types';
import { createFoe } from '../data/foes';
import { BOTS, simulateRun } from '../engine/bot';
import {
  barePlan,
  campaignSave,
  investedPlan,
  PUZZLE_CHARMS,
  starTargets,
  worldOf,
  type BuildPlan,
} from '../engine/botBuilds';

export { PUZZLE_CHARMS, campaignSave };

const withPuzzle = (level: LevelDef, plan: BuildPlan): BuildPlan => ({ ...plan, keepCharms: !!PUZZLE_CHARMS[level.id] });
const clearRate = (dist: number[]) => dist[1] + dist[2] + dist[3];
const knockout = (dist: number[]) => dist[2] + dist[3];
const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export interface Rates {
  scale: number;
  bareClear: number;
  bare: number;
  investedClear: number;
  invested: number;
  investedStar3: number;
  expertStar3: number;
  /** Share of invested runs lost by running out of hearts (not clock) */
  investedHeartLoss: number;
  /** Share of invested runs surviving to timeout (1★) without KO */
  investedTimeout: number;
  /** Mean remaining foe HP share across invested runs (smooth tie-breaker when KO saturates) */
  meanHpLeftShare: number;
  /** P(challengeMet | stars >= 2) for invested runs */
  challengeMetGivenKo: number;
  /** Wave-by-wave clear rate for multi-wave levels (`foes.length > 1`) */
  waveClearRates: number[];
  /** True when heart deaths alone exceed the invested KO error budget (tune hazards/hearts instead of crushing Boss HP!) */
  lethalityWall: boolean;
  /** Multi-star distance across ★1+ clear floor, ★★+ knockout targets, and ★★★ mastery */
  loss: number;
}

const evalDetailed = (level: LevelDef, runs: number, bot: typeof BOTS.average, plan: BuildPlan) => {
  const save = campaignSave(level);
  const dist = [0, 0, 0, 0];
  let heartLoss = 0;
  let timeout = 0;
  let hpLeftSum = 0;
  let koCount = 0;
  let challengeOnKo = 0;
  const totalHp = Math.max(1, level.foes.reduce((s, f) => s + f.hp, 0));
  const waveClears = Array(level.foes.length).fill(0);

  for (let i = 0; i < runs; i++) {
    const r = simulateRun(level, save, bot, 1000 + i * 7919, plan);
    dist[r.stars] += 1;
    const st = r.state;
    if (st.endReason === 'hearts') heartLoss += 1;
    else if (st.endReason === 'survived') timeout += 1;
    if (r.stars >= 2) {
      koCount += 1;
      if (st.challengeMet) challengeOnKo += 1;
    }
    const remainingCurrent = st.status === 'won' && st.endReason === 'defeated' ? 0 : Math.max(0, st.foeHp);
    const remainingLater = level.foes.slice(st.wave + 1).reduce((s, f) => s + f.hp, 0);
    hpLeftSum += Math.min(1, (remainingCurrent + remainingLater) / totalHp);

    const clearedWaves = st.status === 'won' && st.endReason === 'defeated' ? level.foes.length : st.wave;
    for (let w = 0; w < clearedWaves && w < waveClears.length; w++) waveClears[w] += 1;
  }

  return {
    dist: dist.map(n => n / runs),
    heartLoss: heartLoss / runs,
    timeout: timeout / runs,
    meanHpLeftShare: hpLeftSum / runs,
    challengeMetGivenKo: koCount > 0 ? challengeOnKo / koCount : 0,
    waveClearRates: level.foes.length > 1 ? waveClears.map(n => n / runs) : [],
  };
};

/**
 * Full 3-star evaluation (`★1+`, `★★+`, `★★★` + pro `★★★` on World 1, bosses, and low-★★★ levels)
 * at foe HP × `scale`, decomposing heart-deaths vs clock timeouts.
 */
export const ratesAt = (level: LevelDef, scale: number, runs: number): Rates => {
  const scaled: LevelDef = { ...level, foes: level.foes.map(f => ({ ...f, hp: Math.max(1, Math.round(f.hp * scale)) })) };
  const bareRes = evalDetailed(scaled, runs, BOTS.average, withPuzzle(level, barePlan(level)));
  const invRes = evalDetailed(scaled, runs, BOTS.average, withPuzzle(level, investedPlan(level)));
  const bareClear = clearRate(bareRes.dist);
  const bare = knockout(bareRes.dist);
  const investedClear = clearRate(invRes.dist);
  const invested = knockout(invRes.dist);
  const investedStar3 = invRes.dist[3];
  const t = starTargets(level);

  // Activate expertStar3Floor on World 1, all Bosses, and any level where average invested ★★★ falls below floor
  const needsExpert = worldOf(level) === 1 || !!level.isBoss || investedStar3 < t.investedStar3Floor;
  const expertRuns = needsExpert ? Math.max(20, Math.round(runs / 3)) : 0;
  const expertStar3 =
    expertRuns > 0
      ? evalDetailed(scaled, expertRuns, BOTS.expert, withPuzzle(level, investedPlan(level))).dist[3]
      : investedStar3;

  const clearPenalty =
    Math.max(0, t.bareClearFloor - bareClear) * 1.5 + Math.max(0, t.investedClearFloor - investedClear) * 1.5;
  const koLoss = Math.abs(bare - t.bareKo) + Math.abs(invested - t.investedKo);
  const star3Loss =
    (investedStar3 < t.investedStar3Floor
      ? (t.investedStar3Floor - investedStar3) * 1.5
      : Math.abs(investedStar3 - t.investedStar3) * 0.3) +
    (expertRuns > 0 ? Math.max(0, t.expertStar3Floor - expertStar3) * 2 : 0);
  const progressionPenalty = invested < bare ? 1 : invested === bare && bare < 0.95 ? 0.5 : 0;
  // Tiny smooth tie-breaker when KO saturates at 0% or 100% so log search moves monotonically toward the target
  const tieBreak = invested === 0 || invested === 1 ? invRes.meanHpLeftShare * 0.005 : 0;
  const lethalityWall = invRes.heartLoss > Math.max(0.1, 1 - t.investedKo - 0.08);

  return {
    scale,
    bareClear,
    bare,
    investedClear,
    invested,
    investedStar3,
    expertStar3,
    investedHeartLoss: invRes.heartLoss,
    investedTimeout: invRes.timeout,
    meanHpLeftShare: invRes.meanHpLeftShare,
    challengeMetGivenKo: invRes.challengeMetGivenKo,
    waveClearRates: invRes.waveClearRates,
    lethalityWall,
    loss: koLoss + clearPenalty + star3Loss + progressionPenalty + tieBreak,
  };
};

// ─── Effective HP & Monotonic Campaign Curve Guardrails ─────────────────────

/** Total runtime HP of a level normalized by its foe's `pointsMultiplier` (e.g. Scorpion/Porcupine/Reaper 2×). */
export const effectiveLevelHp = (level: LevelDef): number => {
  const totalHp = level.foes.reduce((sum, f) => sum + f.hp, 0);
  const lastFoe = level.foes[level.foes.length - 1];
  const pointsMult = createFoe(lastFoe).foe.getStatModifiers().pointsMultiplier || 1;
  return totalHp / pointsMult;
};

export interface HpCurveValidation {
  ok: boolean;
  violations: string[];
  bossEffHp: Record<number, { id: string; runtimeHp: number; effHp: number }>;
}

/**
 * Cross-level & boss-hierarchy guardrails so single-level HP tuning can never
 * again create an 8× cliff where a final Boss has far less HP than earlier trash.
 */
export const validateCampaignHpCurve = (levels: readonly LevelDef[]): HpCurveValidation => {
  const violations: string[] = [];
  const effById = new Map<string, number>();
  const levelById = new Map<string, LevelDef>();
  for (const l of levels) {
    effById.set(l.id, effectiveLevelHp(l));
    levelById.set(l.id, l);
  }

  const bossEffHp: Record<number, { id: string; runtimeHp: number; effHp: number }> = {};
  for (const w of [1, 2, 3, 4, 5]) {
    const worldMain = levels.filter(l => worldOf(l) === w && !l.branchOf && l.starRule?.kind !== 'accuracy');
    const boss = worldMain.find(l => l.isBoss);
    const nonBoss = worldMain.filter(l => !l.isBoss);
    if (!boss || nonBoss.length === 0) continue;

    const bEff = effById.get(boss.id)!;
    const bRuntime = boss.foes.reduce((s, f) => s + f.hp, 0);
    bossEffHp[w] = { id: boss.id, runtimeHp: bRuntime, effHp: bEff };

    const nonBossEffs = nonBoss.map(l => effById.get(l.id)!);
    const med = median(nonBossEffs);
    const maxNonBoss = Math.max(...nonBossEffs);
    const minNonBoss = Math.min(...nonBossEffs);

    // 1. World Boss Floor vs World Median & Max Non-Boss
    if (bEff < 1.15 * med) {
      violations.push(
        `World ${w} Boss ${boss.id} effHp (${Math.round(bEff)}) < 1.15× world median (${Math.round(med)}, min ${Math.round(1.15 * med)})`
      );
    }
    if (bEff < 0.85 * maxNonBoss) {
      const topLevel = nonBoss.find(l => effById.get(l.id) === maxNonBoss)!;
      violations.push(
        `World ${w} Boss ${boss.id} effHp (${Math.round(bEff)}) < 0.85× max non-boss ${topLevel.id} (${Math.round(maxNonBoss)}, min ${Math.round(0.85 * maxNonBoss)})`
      );
    }
    // 2. Strictly rising Boss progression World 1 -> 5
    if (w > 1 && bossEffHp[w - 1] && bEff <= bossEffHp[w - 1].effHp) {
      violations.push(
        `World ${w} Boss ${boss.id} effHp (${Math.round(bEff)}) <= World ${w - 1} Boss ${bossEffHp[w - 1].id} (${Math.round(bossEffHp[w - 1].effHp)})`
      );
    }
    // 3. Intra-World Outlier Clamp (Worlds 2-5 main non-bosses, and World 1's 3-trait stretch 1-5..1-9)
    const clampPool = w === 1 ? nonBoss.filter(l => l.rules.attributes.length >= 3) : nonBoss;
    if (clampPool.length >= 2) {
      const cEffs = clampPool.map(l => effById.get(l.id)!);
      const cMax = Math.max(...cEffs);
      const cMin = Math.min(...cEffs);
      if (cMax / Math.max(1, cMin) > 3.5) {
        const hi = clampPool.find(l => effById.get(l.id) === cMax)!;
        const lo = clampPool.find(l => effById.get(l.id) === cMin)!;
        violations.push(
          `World ${w} intra-world effHp spread too wide: ${hi.id} (${Math.round(cMax)}) / ${lo.id} (${Math.round(cMin)}) = ${(cMax / Math.max(1, cMin)).toFixed(2)}× (> 3.5×)`
        );
      }
    }
    // World 1 intro guard: no early non-boss should exceed the World 1 Boss
    if (w === 1 && minNonBoss > 0 && maxNonBoss > bEff * 1.15) {
      const hi = nonBoss.find(l => effById.get(l.id) === maxNonBoss)!;
      violations.push(
        `World 1 non-boss ${hi.id} effHp (${Math.round(maxNonBoss)}) exceeds Boss ${boss.id} (${Math.round(bEff)})`
      );
    }
  }

  // 4. Chained elite vs parent guard (no chained elite may collapse below 0.50× its parent)
  for (const l of levels) {
    if (!l.branchOf) continue;
    const parent = levelById.get(l.branchOf);
    if (!parent || !parent.branchOf) continue;
    const lEff = effById.get(l.id)!;
    const pEff = effById.get(parent.id)!;
    if (lEff < 0.5 * pEff) {
      violations.push(
        `Chained elite ${l.id} effHp (${Math.round(lEff)}) < 0.50× parent ${parent.id} (${Math.round(pEff)})`
      );
    }
  }

  return { ok: violations.length === 0, violations, bossEffHp };
};

// ─── Bounded Log-Space Search ───────────────────────────────────────────────

/** A first geometric sweep, for when damage has moved a long way (a new scaling layer, a big rework) */
export const WIDE = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
export const COARSE = [0.7, 0.85, 1, 1.2, 1.45];
export const FINE = [0.92, 1.08];

export interface TuneBounds {
  minScale?: number;
  maxScale?: number;
}

const clampScale = (s: number, bounds?: TuneBounds) => {
  const lo = bounds?.minScale ?? 0.05;
  const hi = bounds?.maxScale ?? 64;
  return +Math.min(hi, Math.max(lo, s)).toFixed(3);
};

/**
 * The HP scale that puts this level closest to its targets. Auto-expands into
 * a geometric sweep if the best coarse point lands on a bracket edge.
 */
export const tuneLevel = (
  level: LevelDef,
  runs = 60,
  wide = false,
  bounds?: TuneBounds
): { best: Rates; tried: Rates[] } => {
  const tried: Rates[] = [];
  const seen = new Map<number, Rates>();
  const evalAt = (rawScale: number, n: number): Rates => {
    const s = clampScale(rawScale, bounds);
    const hit = seen.get(s);
    if (hit && n <= runs) return hit;
    const r = ratesAt(level, s, n);
    tried.push(r);
    if (n >= runs || !hit) seen.set(s, r);
    return r;
  };

  let center = clampScale(1, bounds);
  const runWideSweep = () => {
    const sweepRuns = Math.max(20, Math.round(runs / 3));
    const sweep = WIDE.map(s => evalAt(s, sweepRuns));
    const base = sweep.find(r => r.scale === clampScale(1, bounds)) ?? sweep[0];
    center = sweep.reduce((a, b) => (b.loss < a.loss - 1e-9 ? b : a), base).scale;
  };

  if (wide) runWideSweep();

  let coarse = COARSE.map(s => evalAt(center * s, runs));
  let best = coarse.reduce((a, b) => (b.loss < a.loss - 1e-9 ? b : a), coarse[COARSE.indexOf(1)] ?? coarse[0]);

  // Auto-expand wide bracket if we didn't sweep yet and hit the edge with notable residual loss
  const edgeLo = clampScale(center * COARSE[0], bounds);
  const edgeHi = clampScale(center * COARSE[COARSE.length - 1], bounds);
  if (!wide && best.loss > 0.12 && (best.scale === edgeLo || best.scale === edgeHi)) {
    runWideSweep();
    coarse = COARSE.map(s => evalAt(center * s, runs));
    best = coarse.reduce((a, b) => (b.loss < a.loss - 1e-9 ? b : a), best);
  }

  // Fine log-space bracket refinement around best
  for (const f of FINE) {
    const r = evalAt(best.scale * f, runs);
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
