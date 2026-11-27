/**
 * Extended balance analytics, Synergy Graph combo discovery & fun/uniqueness telemetry.
 *
 * Complements `lab.ts` (fast guardrails) with deep multi-factor measurements:
 *  - `pressureBench`: real World 4–5 combat conditions (Shading Surge + Bombs + Snares + Set-Parry)
 *  - `measureWeaponsExtended`: 64 weapons across stages, Pressure lift, 6-window
 *    endgame DPM trajectories, Base-vs-Mult damage share (target >= 60% base),
 *    Synergy Graph score, Set-hit skewness (γ₁), pop-off multiples,
 *    8D behavioral fingerprints, cosine nearest neighbors & MAP-Elites 6×6 niche grid
 *  - `measurePairSynergyMatrix`: all C(64,2) = 2,016 Synergy Graph weapon pairs
 *    + complete 192-evolution Per-Weapon 3-Evolution Suite (`withinWeaponRank` 1..3)
 *  - `measureFighterMatrix`: all 6 fighters across star budgets (0★ / 60★ / 160★)
 *    and the complete 6 × 64 fighter-weapon affinity & anti-synergy matrix
 *  - `measureArcanaMatrix`: all 8 kiss-curse Arcana solo, 6 × 8 fighter-Arcana,
 *    and all C(8,2) = 28 dual-Arcana loadouts (accounting for foeHpScale, XP & shop)
 *  - `measureCoveringArrayShapley`: stratified 5-weapon + tree + dual-Arcana endgame
 *    builds (no Power scaling), Ridge-regression Shapley attribution & Base-vs-Mult fan curves
 *  - `measureCampaignSuspense`: campaign-wide Bare vs Invested knockout curves, timer/heart
 *    margins & Bayesian outcome-entropy suspense
 */
import type { AttributeName, CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, LevelDef, SynergyAttrId } from '../types';
import { LEVELS, getLevel } from '../data/levels';
import { FIGHTERS } from '../data/fighters';
import { ARCANA, arcanaRules } from '../data/arcana';
import { WEAPON_EVOLUTIONS } from '../data/evolutions';
import { TREE_BUDGET } from '../data/skillTrees';
import { WEAPON_ROLES, weaponRole, type WeaponRole } from '../data/weaponRoles';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '../data/armory';
import { PARRY_RULES } from '../data/parry';
import { beltSynergyOverlap, getWeaponSynergyProfile } from '../data/synergy';
import { SPIRE_CLASH_PAIRS } from '@/spire/engine/bridge';
import { MAX_TUNING_TIER, MAX_WEAPON_LEVEL, weaponStatLines } from '../data/weaponStats';
import { WEAPON_GROWTH } from '../data/weaponGrowth';
import { createMaxedSave } from '../progress';
import { BOTS, simulateRun } from '../engine/bot';
import {
  barePlan,
  buyTree,
  campaignSave,
  investedPlan,
  isTrial,
  PUZZLE_CHARMS,
  starTargets,
  winTargets,
  worldOf,
  type BuildPlan,
} from '../engine/botBuilds';
import { createRng } from '../engine/rng';
import {
  benches,
  evolutionLifts,
  inBuild,
  mean,
  median,
  normalizeWeaponPair,
  play,
  scaleBench,
  solo,
  type Bench,
  type EvolutionLift,
} from './lab';
import { BALANCE_TARGETS, PARTNER_WEAPONS, TIERS, type Tier } from './targets';
import pkg from '../../../package.json';

const seedOf = (i: number) => 1000 + i * 7919;

const maxGearFields = (): Pick<
  AdventureSave,
  'armory' | 'stars' | 'completedBounties' | 'legacyWeaponTiers' | 'weaponTuning' | 'upgrades'
> => {
  const armory = [...ALL_ARMORY_WEAPON_IDS];
  return {
    armory,
    // World 1 & World 2 boss clears unlock 4th & 5th weapon slots; charm_belt: 1 adds optional 6th slot
    stars: { '1-10': 1, '2-10': 1 },
    completedBounties: [],
    upgrades: { charm_belt: 1 },
    legacyWeaponTiers: Object.fromEntries(armory.map(id => [id, MAX_WEAPON_LEVEL - 1])),
    weaponTuning: Object.fromEntries(
      armory.map(id => {
        const lines = weaponStatLines(getArmoryWeapon(id)!, { level: MAX_WEAPON_LEVEL, tuning: {} });
        return [id, Object.fromEntries(lines.filter(l => l.tunable).map(l => [l.key, MAX_TUNING_TIER]))];
      })
    ),
  };
};

const BASE_TRAITS: AttributeName[] = ['shape', 'color', 'number'];

let pressureCached: Bench | null = null;

/**
 * Real World 4–5 pressure bench: 3 base traits + Shading Surge (45s calm → 15s 4-trait ×1.8 +12 base surge)
 * + active level hazards (time bombs & snares) + explicit representative Set-Parry + 8 hearts + 150s timer
 * on an unkillable foe. Captures survival, grace, heal, hazard-clearing, parry, and surge-window burst value
 * that a calm 5-trait dummy bench cannot see.
 */
export const pressureBench = (): Bench => {
  if (pressureCached) return pressureCached;
  const ref = getLevel('4-4');
  const level: LevelDef = {
    ...ref,
    foes: [
      {
        name: 'Pressure Dummy',
        icon: ref.foes[0].icon,
        hp: 1e7,
        parry: {
          attackName: 'Pressure Strike',
          icon: 'lorc/sword-clash',
          counter: { kind: 'exact_same', count: 2 },
          cooldownMs: 14000,
          windupMs: 16000,
          perfectWindowMs: PARRY_RULES.perfectWindowMs,
          penalty: 'heart',
        },
      },
    ],
    rules: {
      ...ref.rules,
      attributes: [...BASE_TRAITS],
      boardSize: undefined,
      shadingSurge: true,
      hazards: { timeBombs: { every: 9, seconds: 14 }, snares: { every: 7 } },
      moves: undefined,
      timer: 150,
      hearts: 8,
    },
    challenge: { kind: 'noMistakes' },
  };
  const base = {
    ...createMaxedSave(),
    armory: [...ALL_ARMORY_WEAPON_IDS],
    skillNodes: {},
    charms: [],
    equippedArcana: [],
  } as AdventureSave;
  pressureCached = {
    id: 'late',
    label: '3 traits + Shading Surge + Bombs/Snares + Set-Parry, level-5 tuned gear',
    level,
    save: { ...base, ...maxGearFields() },
  };
  return pressureCached;
};

// ─── Statistical & Linear Algebra Helpers ───────────────────────────────────

const percentile = (xs: readonly number[], p: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor((s.length - 1) * p)));
  return s[idx];
};

const stdDev = (xs: readonly number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
};

/** Fisher-Pearson standardized third central moment (γ₁): positive = thrilling pop-off tail. */
export const skewness = (xs: readonly number[]): number => {
  if (xs.length < 3) return 0;
  const m = mean(xs);
  const sd = stdDev(xs);
  if (sd < 1e-9) return 0;
  return mean(xs.map(x => ((x - m) / sd) ** 3));
};

/** Solve (XᵀX + λI)β = Xᵀy via Gaussian elimination with partial pivoting (intercept unpenalized at col 0). */
export const solveRidge = (X: readonly (readonly number[])[], y: readonly number[], lambda: number): number[] => {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (!n || !p) return [];
  const A: number[][] = Array.from({ length: p }, () => Array(p + 1).fill(0));
  for (let r = 0; r < n; r++) {
    const row = X[r];
    const yr = y[r];
    for (let i = 0; i < p; i++) {
      const xi = row[i];
      if (xi === 0) continue;
      A[i][p] += xi * yr;
      for (let j = i; j < p; j++) {
        if (row[j] !== 0) A[i][j] += xi * row[j];
      }
    }
  }
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < i; j++) A[i][j] = A[j][i];
    if (i > 0) A[i][i] += lambda;
  }
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (pivot !== col) [A[col], A[pivot]] = [A[pivot], A[col]];
    const diag = Math.abs(A[col][col]) < 1e-12 ? 1e-12 : A[col][col];
    for (let j = col; j <= p; j++) A[col][j] /= diag;
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= p; j++) A[r][j] -= factor * A[col][j];
    }
  }
  return A.map(row => row[p]);
};

// ─── 1. Extended 64-Weapon Telemetry + 8D Fingerprints + MAP-Elites ─────────

export const SNOWBALL_WINDOWS_MS = [30000, 60000, 90000, 120000, 150000, 180000] as const;

export interface BehaviorVector8D {
  /** Share of bonus damage coming from direct weapon/rule strikes vs card points */
  directShare: number;
  /** Collateral cards destroyed per Set (explosions, lasers, fire, ricochet, links) */
  collateralRate: number;
  /** Clock extension + freeze shift relative to unarmed fight duration */
  tempoShift: number;
  /** Survival & heart preservation delta under Pressure hazards */
  safetyLift: number;
  /** Set cadence speedup (Sets/min vs unarmed baseline) */
  cadenceSpeedup: number;
  /** Pop-off burstiness (log(1 + max(0, γ₁)) + biggestHit share) */
  burstSkew: number;
  /** Late-fight vs opening-window acceleration + growth stacks */
  rampSlope: number;
  /** Skill expression slope: log(expertLate / noviceLate) */
  skillLean: number;
}

export interface WeaponExtendedRow {
  id: string;
  name: string;
  role: WeaponRole;
  partner: boolean;
  growthWhat: string;
  growthGives: string;
  synergyProduces: readonly SynergyAttrId[];
  synergyConsumes: readonly SynergyAttrId[];
  /** Dummy solo lifts across stages & skill tiers */
  earlyAvg: number;
  earlyMin: number;
  earlyMax: number;
  midAvg: number;
  lateNovice: number;
  lateAvg: number;
  lateExpert: number;
  audienceLean: number;
  deadShare: number;
  /** Restricted-play value inside 5-weapon builds */
  inBuildLift: number;
  /** Realistic World 4–5 Pressure + Shading Surge + Hazards lift & survival */
  pressureNovice: number;
  pressureAvg: number;
  pressureSurvivalGain: number;
  /** 3-minute endgame DPM trajectory (6 × 30s buckets normalized to unarmed start DPM) */
  snowballCurve: number[];
  /** Last-30s DPM ÷ Unarmed Last-30s DPM (Synergy + Evolution scaling, no Power) */
  endDpmMultiple: number;
  /** Weapon's own Last-30s DPM ÷ First-30s DPM */
  snowballAccel: number;
  /** Share of Set damage coming from pre-multiplier additive base (target >= 0.60) */
  baseDamageShare: number;
  /** Mean total Synergy Graph score accumulated over a 3-minute fight */
  meanSynergyScore: number;
  meanGrowthStacks: number;
  meanEvosTriggered: number;
  /** Fun & excitement distribution metrics */
  setSkewness: number;
  popOffMultiple: number;
  p95ToMedianHit: number;
  /** 8D behavioral uniqueness & MAP-Elites coordinates */
  behavior: BehaviorVector8D;
  nearestNeighborId: string;
  nearestNeighborName: string;
  nearestNeighborDist: number;
  uniquenessScore: number;
  /** [-1..1] Sustained Control (-) ↔ Spike/Collateral Burst (+) */
  styleAxis: number;
  /** [-1..1] Passive Comfort/Safety (-) ↔ Active Hunt/Skill Scaling (+) */
  agencyAxis: number;
  nicheCell: [number, number];
}

export interface NicheCellSummary {
  col: number;
  row: number;
  styleLabel: string;
  agencyLabel: string;
  weapons: { id: string; name: string; role: WeaponRole; score: number }[];
  eliteId: string | null;
}

export interface WeaponExtendedSuite {
  baselineStartDpm: number;
  baselineEndDpm: number;
  baselineSnowballCurve: number[];
  meanBaseDamageShare: number;
  weapons: WeaponExtendedRow[];
  nicheGrid: NicheCellSummary[];
  nicheCoverage: number;
}

interface RawTraceStats {
  dpmBuckets: number[];
  startDpm: number;
  endDpm: number;
  baseDamageShare: number;
  synergyScore: number;
  evosTriggered: number;
  growthStacks: number;
  elapsedMs: number;
  matches: number;
  setDamages: number[];
  biggestHit: number;
  totalDamage: number;
  collateralPerSet: number;
  directShare: number;
}

const traceScaleFight = (
  charms: readonly string[],
  runs: number,
  tier: Tier = 'average',
  extraSave: Partial<AdventureSave> = {}
): RawTraceStats => {
  const sb = scaleBench();
  const save: AdventureSave = { ...sb.save, ...extraSave, charms: [...charms] };
  const bucketSums = Array(SNOWBALL_WINDOWS_MS.length).fill(0);
  let startSum = 0;
  let endSum = 0;
  let synergySum = 0;
  let evoSum = 0;
  let growthSum = 0;
  let elapsedSum = 0;
  let matchSum = 0;
  let bigSum = 0;
  let totalSum = 0;
  let collateralSum = 0;
  let directDmgSum = 0;
  let bonusDmgSum = 0;
  let baseDmgTotal = 0;
  let setDmgTotal = 0;
  const allSetHits: number[] = [];

  for (let i = 0; i < runs; i++) {
    const { state } = simulateRun(sb.level, save, BOTS[tier], seedOf(i), undefined, { skipPicks: true });
    for (let b = 0; b < SNOWBALL_WINDOWS_MS.length; b++) {
      const lo = b === 0 ? 0 : SNOWBALL_WINDOWS_MS[b - 1];
      const hi = SNOWBALL_WINDOWS_MS[b];
      const dmg = state.log.filter(e => e.t >= lo && e.t < hi).reduce((a, e) => a + e.damage, 0);
      bucketSums[b] += dmg * 2; // 30s -> per minute
    }
    const endFrom = Math.max(0, state.elapsedMs - 30000);
    const endWinMs = Math.max(1000, state.elapsedMs - endFrom);
    const startWinMs = Math.max(1000, Math.min(30000, state.elapsedMs));
    startSum += state.log.filter(e => e.t < 30000).reduce((a, e) => a + e.damage, 0) * (60000 / startWinMs);
    endSum += state.log.filter(e => e.t >= endFrom).reduce((a, e) => a + e.damage, 0) * (60000 / endWinMs);
    synergySum += Object.values(state.synergy ?? {}).reduce((a, b) => a + b, 0);
    evoSum += state.evolutionsTriggered;
    growthSum += Object.values(state.growth).reduce((a, v) => a + v.stacks, 0);
    elapsedSum += state.elapsedMs;
    matchSum += state.matches;
    bigSum += state.biggestHit;
    totalSum += state.totalDamage;

    let runCollateral = 0;
    for (const e of state.log) {
      if (e.kind === 'set' && e.damage > 0) {
        allSetHits.push(e.damage);
        if (e.set) {
          const preMult = Math.max(0, e.set.baseDamageBeforeMult ?? e.set.cards + e.set.flatBonus);
          if (e.setDamage > 0) {
            baseDmgTotal += Math.min(e.setDamage, preMult);
            setDmgTotal += e.setDamage;
          }
          const col = Object.values(e.set.collateral).reduce((a, v) => a + (v ?? 0), 0);
          runCollateral += col;
          const triggered = Math.max(0, e.damage - e.setDamage) + Math.max(0, e.set.flatBonus);
          directDmgSum += triggered;
          bonusDmgSum += triggered + col;
        }
      }
    }
    collateralSum += runCollateral / Math.max(1, state.matches);
  }

  const denom = Math.max(1, runs);
  return {
    dpmBuckets: bucketSums.map(v => v / denom),
    startDpm: startSum / denom,
    endDpm: endSum / denom,
    baseDamageShare: setDmgTotal > 0 ? baseDmgTotal / setDmgTotal : 1,
    synergyScore: synergySum / denom,
    evosTriggered: evoSum / denom,
    growthStacks: growthSum / denom,
    elapsedMs: elapsedSum / denom,
    matches: matchSum / denom,
    setDamages: allSetHits,
    biggestHit: bigSum / denom,
    totalDamage: totalSum / denom,
    collateralPerSet: collateralSum / denom,
    directShare: bonusDmgSum > 0 ? directDmgSum / bonusDmgSum : 0.5,
  };
};

const pressureSample = (charms: readonly string[], tier: Tier, runs: number, over: Partial<AdventureSave> = {}) => {
  const pb = pressureBench();
  const save: AdventureSave = { ...pb.save, ...over, charms: [...charms] };
  const damages: number[] = [];
  let survived = 0;
  let endHearts = 0;
  for (let i = 0; i < runs; i++) {
    const { state } = simulateRun(pb.level, save, BOTS[tier], seedOf(i), undefined, { skipPicks: true });
    damages.push(state.totalDamage);
    if (state.endReason !== 'hearts') survived++;
    endHearts += state.hearts ?? 0;
  }
  const denom = Math.max(1, runs);
  return { meanDamage: mean(damages), survivalRate: survived / denom, meanHearts: endHearts / denom };
};

const STYLE_LABELS = ['Pure Tempo', 'Cadence', 'Balanced Control', 'Hybrid Payoff', 'Heavy Strike', 'Explosive Gamble'];
const AGENCY_LABELS = ['Comfort / Auto', 'Safety Anchor', 'Steady Passive', 'Tactical Read', 'Active Hunt', 'High-Skill Mastery'];

export const measureWeaponsExtended = (runs = 10, buildCount = 10): WeaponExtendedSuite => {
  const bs = benches();
  const armory = bs.late.save.armory;
  const nonPartner = armory.filter(id => !PARTNER_WEAPONS.includes(id));

  const noneEarly = Object.fromEntries(TIERS.map(t => [t, play(bs.early, [], t, runs)])) as Record<Tier, ReturnType<typeof play>>;
  const noneMid = play(bs.mid, [], 'average', runs);
  const noneLate = Object.fromEntries(TIERS.map(t => [t, play(bs.late, [], t, runs)])) as Record<Tier, ReturnType<typeof play>>;

  const pBaseNovice = pressureSample([], 'novice', runs);
  const pBaseAvg = pressureSample([], 'average', runs);
  const baseTrace = traceScaleFight([], runs, 'average');
  const normDpm = Math.max(1, baseTrace.startDpm);

  const prelim: Omit<
    WeaponExtendedRow,
    'nearestNeighborId' | 'nearestNeighborName' | 'nearestNeighborDist' | 'uniquenessScore' | 'styleAxis' | 'agencyAxis' | 'nicheCell'
  >[] = armory.map(id => {
    const w = getArmoryWeapon(id)!;
    const g = WEAPON_GROWTH[id];
    const synProfile = getWeaponSynergyProfile(id);
    const earlyByTier = TIERS.map(t => solo(bs.early, id, t, runs, noneEarly[t]));
    const midLift = solo(bs.mid, id, 'average', runs, noneMid);
    const lateByTier = Object.fromEntries(TIERS.map(t => [t, solo(bs.late, id, t, runs, noneLate[t])])) as Record<Tier, ReturnType<typeof solo>>;
    const buildLift = inBuild(bs.late, id, 'average', Math.max(4, Math.floor(runs / 2)), nonPartner, 5, buildCount);

    const pNovice = pressureSample([id], 'novice', runs);
    const pAvg = pressureSample([id], 'average', runs);
    const trace = traceScaleFight([id], runs, 'average');

    const medHit = Math.max(1, median(trace.setDamages));
    const p95Hit = Math.max(1, percentile(trace.setDamages, 0.95));
    const skew = skewness(trace.setDamages);
    const popOff = trace.biggestHit / medHit;

    const baseRate = baseTrace.matches / Math.max(0.1, baseTrace.elapsedMs / 60000);
    const wepRate = trace.matches / Math.max(0.1, trace.elapsedMs / 60000);
    const audienceLean = lateByTier.expert.ratio / Math.max(0.01, lateByTier.novice.ratio);
    const accel = trace.endDpm / Math.max(1, trace.startDpm);

    const behavior: BehaviorVector8D = {
      directShare: trace.directShare,
      collateralRate: trace.collateralPerSet,
      tempoShift: (trace.elapsedMs - baseTrace.elapsedMs) / 180000,
      safetyLift: (pNovice.survivalRate - pBaseNovice.survivalRate) + 0.15 * (pNovice.meanHearts - pBaseNovice.meanHearts),
      cadenceSpeedup: wepRate / Math.max(0.1, baseRate) - 1,
      burstSkew: Math.log1p(Math.max(0, skew)) + trace.biggestHit / Math.max(1, trace.totalDamage),
      rampSlope: Math.log(Math.max(0.2, accel)) + 0.08 * trace.growthStacks,
      skillLean: Math.log(Math.max(0.2, audienceLean)),
    };

    return {
      id,
      name: w.name,
      role: weaponRole(id),
      partner: PARTNER_WEAPONS.includes(id),
      growthWhat: (g ?? []).map(d => d.look).join('; '),
      growthGives: (g ?? []).map(d => d.gives).join('; '),
      synergyProduces: synProfile.produces,
      synergyConsumes: synProfile.consumes,
      earlyAvg: earlyByTier[1].ratio,
      earlyMin: Math.min(...earlyByTier.map(x => x.ratio)),
      earlyMax: Math.max(...earlyByTier.map(x => x.ratio)),
      midAvg: midLift.ratio,
      lateNovice: lateByTier.novice.ratio,
      lateAvg: lateByTier.average.ratio,
      lateExpert: lateByTier.expert.ratio,
      audienceLean,
      deadShare: Math.min(earlyByTier[1].dead, midLift.dead, lateByTier.average.dead),
      inBuildLift: buildLift.ratio,
      pressureNovice: pNovice.meanDamage / Math.max(1, pBaseNovice.meanDamage),
      pressureAvg: pAvg.meanDamage / Math.max(1, pBaseAvg.meanDamage),
      pressureSurvivalGain: pNovice.survivalRate - pBaseNovice.survivalRate,
      snowballCurve: trace.dpmBuckets.map(v => v / normDpm),
      endDpmMultiple: trace.endDpm / Math.max(1, baseTrace.endDpm),
      snowballAccel: accel,
      baseDamageShare: trace.baseDamageShare,
      meanSynergyScore: trace.synergyScore,
      meanGrowthStacks: trace.growthStacks,
      meanEvosTriggered: trace.evosTriggered,
      setSkewness: skew,
      popOffMultiple: popOff,
      p95ToMedianHit: p95Hit / medHit,
      behavior,
    };
  });

  // Standardize 8D behavioral vectors for Cosine Nearest-Neighbor & 2D MAP-Elites projection
  const keys: (keyof BehaviorVector8D)[] = [
    'directShare',
    'collateralRate',
    'tempoShift',
    'safetyLift',
    'cadenceSpeedup',
    'burstSkew',
    'rampSlope',
    'skillLean',
  ];
  const statsByKey = Object.fromEntries(
    keys.map(k => {
      const vals = prelim.map(w => w.behavior[k]);
      return [k, { m: mean(vals), sd: Math.max(1e-6, stdDev(vals)) }];
    })
  ) as Record<keyof BehaviorVector8D, { m: number; sd: number }>;

  const zVectors = prelim.map(w => keys.map(k => (w.behavior[k] - statsByKey[k].m) / statsByKey[k].sd));

  const cosineDist = (a: readonly number[], b: readonly number[]): number => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom < 1e-9 ? 1 : Math.max(0, 1 - dot / denom);
  };

  // Raw 2D behavioral scores before [-1, 1] rank-anchored scaling
  const rawStyle = zVectors.map(
    z => 0.4 * z[1] + 0.45 * z[5] + 0.2 * z[0] - 0.45 * z[2] - 0.35 * z[4]
  );
  const rawAgency = zVectors.map(
    z => 0.5 * z[7] + 0.35 * z[6] - 0.45 * z[3] - 0.2 * z[4]
  );

  const normalizeAxis = (xs: readonly number[]): number[] => {
    const p5 = percentile(xs, 0.04);
    const p95 = percentile(xs, 0.96);
    const span = Math.max(1e-6, p95 - p5);
    return xs.map(x => Math.max(-0.98, Math.min(0.98, ((x - p5) / span) * 2 - 1)));
  };
  const styleCoords = normalizeAxis(rawStyle);
  const agencyCoords = normalizeAxis(rawAgency);

  const weapons: WeaponExtendedRow[] = prelim.map((w, i) => {
    let bestJ = -1;
    let bestD = Infinity;
    let sumD = 0;
    for (let j = 0; j < prelim.length; j++) {
      if (i === j) continue;
      const d = cosineDist(zVectors[i], zVectors[j]);
      sumD += d;
      if (d < bestD) {
        bestD = d;
        bestJ = j;
      }
    }
    const sx = styleCoords[i];
    const ay = agencyCoords[i];
    const col = Math.min(5, Math.max(0, Math.floor(((sx + 1) / 2) * 6)));
    const row = Math.min(5, Math.max(0, Math.floor(((ay + 1) / 2) * 6)));

    return {
      ...w,
      nearestNeighborId: prelim[bestJ]?.id ?? '',
      nearestNeighborName: prelim[bestJ]?.name ?? '',
      nearestNeighborDist: bestD,
      uniquenessScore: sumD / Math.max(1, prelim.length - 1),
      styleAxis: sx,
      agencyAxis: ay,
      nicheCell: [col, row],
    };
  });

  const nicheGrid: NicheCellSummary[] = [];
  let occupied = 0;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const cellWeapons = weapons
        .filter(w => w.nicheCell[0] === col && w.nicheCell[1] === row)
        .map(w => ({ id: w.id, name: w.name, role: w.role, score: w.inBuildLift }))
        .sort((a, b) => b.score - a.score);
      if (cellWeapons.length > 0) occupied++;
      nicheGrid.push({
        col,
        row,
        styleLabel: STYLE_LABELS[col],
        agencyLabel: AGENCY_LABELS[row],
        weapons: cellWeapons,
        eliteId: cellWeapons[0]?.id ?? null,
      });
    }
  }

  const nonPartnerWeapons = weapons.filter(w => !w.partner);
  return {
    baselineStartDpm: baseTrace.startDpm,
    baselineEndDpm: baseTrace.endDpm,
    baselineSnowballCurve: baseTrace.dpmBuckets.map(v => v / normDpm),
    meanBaseDamageShare: mean(nonPartnerWeapons.map(w => w.baseDamageShare)),
    weapons,
    nicheGrid,
    nicheCoverage: occupied / 36,
  };
};

// ─── 2. Complete C(64,2) Synergy Graph Pair Matrix & 192-Evolution Suite ────

export interface PairSynergyEntry {
  a: string;
  b: string;
  /** Shared Synergy Graph nodes between weapon `a` and weapon `b` */
  sharedSynergyAttrs: SynergyAttrId[];
  /** Mean damage(a,b) ÷ mean damage(none) */
  pairLift: number;
  /** (gainA + gainB) ÷ base + 1 */
  additiveLift: number;
  /** Actual combined gain ÷ (gainA + gainB); >1 = super-additive synergy, <1 = clash */
  synergy: number;
  /** Multiplicative epistasis: log(pairLift / (liftA * liftB)) */
  epistasis: number;
  evoStarts: number;
}

export interface EvolutionExtendedRow extends EvolutionLift {
  name: string;
  /** 1 = strongest of this weapon's 3 evolutions, 2 = middle, 3 = weakest */
  withinWeaponRank: 1 | 2 | 3;
  /** Total combat lift of this weapon (with this evolution) vs unarmed baseline */
  weaponOutputLift: number;
}

export interface PairSynergySuite {
  armoryIds: string[];
  soloLifts: Record<string, number>;
  totalPairs: number;
  synergyPairCount: number;
  nonSynergyPairCount: number;
  pairs: PairSynergyEntry[];
  topSynergyGraphPairs: PairSynergyEntry[];
  topEmergentSynergies: PairSynergyEntry[];
  clashes: PairSynergyEntry[];
  /** All 192 per-weapon timed evolutions (64 weapons × 3 variants: Evo A / B / C) */
  evolutions: EvolutionExtendedRow[];
}

export const measurePairSynergyMatrix = (pairRuns = 3, evoRuns = 8): PairSynergySuite => {
  const bench = benches().late;
  const armory = bench.save.armory;
  const none = play(bench, [], 'average', pairRuns);
  const baseDmg = Math.max(1, mean(none.damage));

  // Precompute all 64 solo samples once on the exact same seeds
  const soloDmg: Record<string, number> = {};
  const soloLifts: Record<string, number> = {};
  for (const id of armory) {
    const s = play(bench, [id], 'average', pairRuns);
    const m = mean(s.damage);
    soloDmg[id] = m;
    soloLifts[id] = m / baseDmg;
  }

  const pairs: PairSynergyEntry[] = [];
  const recheckRuns = Math.max(pairRuns, 10);
  let noneRecheck: ReturnType<typeof play> | null = null;
  const soloRecheckCache = new Map<string, number>();
  const getRecheckBase = () => (noneRecheck ??= play(bench, [], 'average', recheckRuns));
  const getRecheckSolo = (id: string) => {
    const hit = soloRecheckCache.get(id);
    if (hit !== undefined) return hit;
    const m = mean(play(bench, [id], 'average', recheckRuns).damage);
    soloRecheckCache.set(id, m);
    return m;
  };

  for (let i = 0; i < armory.length; i++) {
    const a = armory[i];
    for (let j = i + 1; j < armory.length; j++) {
      const b = armory[j];
      const ordered = normalizeWeaponPair(a, b);
      let both = play(bench, ordered, 'average', pairRuns);
      let meanBoth = mean(both.damage);
      let curBase = baseDmg;
      let curA = soloDmg[a];
      let curB = soloDmg[b];
      let syn = (meanBoth - curBase) / Math.max(1, curA - curBase + (curB - curBase));

      // Adaptive outlier recheck: when a fast 3-run sample looks suspicious, re-measure on 10 seeds to kill noise
      if (pairRuns <= 4 && (syn < 0.85 || syn > 1.5)) {
        curBase = Math.max(1, mean(getRecheckBase().damage));
        curA = getRecheckSolo(a);
        curB = getRecheckSolo(b);
        both = play(bench, ordered, 'average', recheckRuns);
        meanBoth = mean(both.damage);
        syn = (meanBoth - curBase) / Math.max(1, curA - curBase + (curB - curBase));
      }

      const gainA = curA - curBase;
      const gainB = curB - curBase;
      const pairLift = meanBoth / curBase;
      const additiveLift = (curBase + gainA + gainB) / curBase;
      const epi = Math.log(Math.max(0.05, pairLift) / Math.max(0.05, (curA / curBase) * (curB / curBase)));
      const sharedSynergyAttrs = beltSynergyOverlap(a, [b]);
      pairs.push({
        a,
        b,
        sharedSynergyAttrs,
        pairLift,
        additiveLift,
        synergy: syn,
        epistasis: epi,
        evoStarts: mean(both.evolutions),
      });
    }
  }

  // Per-Weapon 3-Evolution Suite (all 192 evolutions: Evo A / B / C per weapon)
  const evoNameById = Object.fromEntries(WEAPON_EVOLUTIONS.map(e => [e.id, e.name]));
  const rawEvos = evolutionLifts(bench, 'average', evoRuns);

  // Rank each weapon's 3 evolutions (1 = strongest, 2 = middle, 3 = weakest) by pure evo composite
  const byWeapon = new Map<string, EvolutionLift[]>();
  for (const e of rawEvos) {
    const list = byWeapon.get(e.weaponId) ?? [];
    list.push(e);
    byWeapon.set(e.weaponId, list);
  }
  const rankWithinWeapon = new Map<string, 1 | 2 | 3>();
  for (const list of byWeapon.values()) {
    const scored = [...list].sort((x, y) => {
      const sx = Math.pow(Math.max(0.05, x.ratio), 0.55) * Math.pow(Math.max(0.05, x.ruleLift), 0.45);
      const sy = Math.pow(Math.max(0.05, y.ratio), 0.55) * Math.pow(Math.max(0.05, y.ruleLift), 0.45);
      return sy - sx || x.variantIndex - y.variantIndex;
    });
    scored.forEach((e, idx) => {
      rankWithinWeapon.set(e.id, Math.min(3, idx + 1) as 1 | 2 | 3);
    });
  }

  const evolutions: EvolutionExtendedRow[] = rawEvos.map(e => ({
    ...e,
    name: evoNameById[e.id] ?? e.id,
    withinWeaponRank: rankWithinWeapon.get(e.id) ?? 1,
    weaponOutputLift: Math.max(0.1, (soloLifts[e.weaponId] ?? 1) * Math.max(0.5, e.ratio)),
  }));

  const withSynergy = pairs.filter(p => p.sharedSynergyAttrs.length > 0);
  const withoutSynergy = pairs.filter(p => p.sharedSynergyAttrs.length === 0);

  return {
    armoryIds: [...armory],
    soloLifts,
    totalPairs: pairs.length,
    synergyPairCount: withSynergy.length,
    nonSynergyPairCount: withoutSynergy.length,
    pairs,
    topSynergyGraphPairs: [...withSynergy].sort((x, y) => y.pairLift - x.pairLift).slice(0, 30),
    topEmergentSynergies: [...withoutSynergy].sort((x, y) => y.synergy - x.synergy).slice(0, 30),
    clashes: [...pairs]
      .filter(p => p.synergy < 0.78 || p.pairLift < Math.max(soloLifts[p.a], soloLifts[p.b]) * 0.92)
      .sort((x, y) => x.synergy - y.synergy)
      .slice(0, 30),
    evolutions,
  };
};

export interface GambleClashRow {
  a: string;
  b: string;
  pairLift: number;
  synergy: number;
  survivalRate: number;
  survivalDelta: number;
  documented: boolean;
}

const isDocumentedClash = (a: string, b: string) =>
  SPIRE_CLASH_PAIRS.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a));

/**
 * Audit Gamble weapon pairs on `pressureBench` (with active hazards, Shading Surge & Set-Parry)
 * for both DPS anti-synergy AND survival cliffs, flagging any severe undocumented clash.
 */
export const measureGambleClashes = (runs = 4, onlyPairs?: readonly (readonly [string, string])[]): GambleClashRow[] => {
  const gambles = ALL_ARMORY_WEAPON_IDS.filter(id => weaponRole(id) === 'gambles');
  const pairList: [string, string][] = onlyPairs
    ? onlyPairs.map(([a, b]) => [a, b])
    : gambles.flatMap((a, i) => gambles.slice(i + 1).map((b): [string, string] => [a, b]));
  const base = pressureSample([], 'average', runs);
  const soloCache = new Map<string, ReturnType<typeof pressureSample>>();
  const getSolo = (id: string) => {
    let hit = soloCache.get(id);
    if (!hit) {
      hit = pressureSample([id], 'average', runs);
      soloCache.set(id, hit);
    }
    return hit;
  };
  return pairList.map(([a, b]) => {
    const sa = getSolo(a);
    const sb = getSolo(b);
    const both = pressureSample([a, b], 'average', runs);
    const gainA = sa.meanDamage - base.meanDamage;
    const gainB = sb.meanDamage - base.meanDamage;
    return {
      a,
      b,
      pairLift: both.meanDamage / Math.max(1, base.meanDamage),
      synergy: (both.meanDamage - base.meanDamage) / Math.max(1, gainA + gainB),
      survivalRate: both.survivalRate,
      survivalDelta: both.survivalRate - Math.min(sa.survivalRate, sb.survivalRate),
      documented: isDocumentedClash(a, b),
    };
  });
};

// ─── 3. 6 Fighters (Passives + Skill Trees) × 64 Weapons Matrix ─────────────

export interface FighterCurveRow {
  fighter: CharacterName;
  passives: readonly string[];
  blurb: string;
  dummy0Stars: number;
  dummy60Stars: number;
  dummy160Stars: number;
  pressure0Stars: number;
  pressure60Stars: number;
  pressure160Stars: number;
  pressureSurvival160: number;
}

export interface FighterWeaponCell {
  fighter: CharacterName;
  weaponId: string;
  /** Fighter + Weapon ÷ Unarmed No-Passive Dummy */
  totalLift: number;
  /** (Fighter + Weapon) ÷ Fighter Alone (does the weapon actually help THIS fighter?) */
  weaponOnFighterLift: number;
  /** weaponOnFighterLift ÷ mean(weaponOnFighterLift across all 6 fighters) */
  affinity: number;
}

export interface FighterMatrixSuite {
  curves: FighterCurveRow[];
  cells: FighterWeaponCell[];
  signatureSynergies: FighterWeaponCell[];
  antiSynergies: FighterWeaponCell[];
}

/** Play with a specific fighter's passives + bought tree enabled on a bench. */
const playFighterBench = (
  bench: Bench,
  fighter: CharacterName,
  stars: number,
  charms: readonly string[],
  tier: Tier,
  runs: number
) => {
  const rng = createRng(fighter.length * 97 + stars);
  const nodes = stars > 0 ? buyTree(fighter, stars, 'plan', rng) : [];
  const save: AdventureSave = {
    ...bench.save,
    selectedFighter: fighter,
    unlockedFighters: FIGHTERS.map(f => f.name),
    skillNodes: { [fighter]: nodes },
    charms: [...charms],
  };
  const damages: number[] = [];
  let survived = 0;
  for (let i = 0; i < runs; i++) {
    const { state } = simulateRun(bench.level, save, BOTS[tier], seedOf(i), undefined, { skipPicks: true });
    damages.push(state.totalDamage);
    if (state.endReason !== 'hearts') survived++;
  }
  return { meanDamage: mean(damages), survival: survived / Math.max(1, runs) };
};

export const measureFighterMatrix = (curveRuns = 8, cellRuns = 4): FighterMatrixSuite => {
  const late = benches().late;
  const press = pressureBench();
  const armory = [...ALL_ARMORY_WEAPON_IDS];

  // Unarmed baseline with passives stripped via `disablePassives` (keeps identical Parry/Surge/Rainbow/Purity rules!)
  const bareDummyDs: number[] = [];
  for (let i = 0; i < curveRuns; i++) {
    bareDummyDs.push(
      simulateRun(late.level, late.save, BOTS.average, seedOf(i), undefined, {
        skipPicks: true,
        overrides: { disablePassives: true },
      }).state.totalDamage
    );
  }
  const bareDummyDmg = Math.max(1, mean(bareDummyDs));

  const barePressDs: number[] = [];
  for (let i = 0; i < curveRuns; i++) {
    barePressDs.push(
      simulateRun(press.level, press.save, BOTS.average, seedOf(i), undefined, {
        skipPicks: true,
        overrides: { disablePassives: true },
      }).state.totalDamage
    );
  }
  const barePressDmg = Math.max(1, mean(barePressDs));

  const curves: FighterCurveRow[] = FIGHTERS.map(f => {
    const d0 = playFighterBench(late, f.name, 0, [], 'average', curveRuns);
    const d60 = playFighterBench(late, f.name, 60, [], 'average', curveRuns);
    const d160 = playFighterBench(late, f.name, TREE_BUDGET, [], 'average', curveRuns);
    const p0 = playFighterBench(press, f.name, 0, [], 'average', curveRuns);
    const p60 = playFighterBench(press, f.name, 60, [], 'average', curveRuns);
    const p160 = playFighterBench(press, f.name, TREE_BUDGET, [], 'average', curveRuns);
    return {
      fighter: f.name,
      passives: f.passives,
      blurb: f.blurb,
      dummy0Stars: d0.meanDamage / bareDummyDmg,
      dummy60Stars: d60.meanDamage / bareDummyDmg,
      dummy160Stars: d160.meanDamage / bareDummyDmg,
      pressure0Stars: p0.meanDamage / barePressDmg,
      pressure60Stars: p60.meanDamage / barePressDmg,
      pressure160Stars: p160.meanDamage / barePressDmg,
      pressureSurvival160: p160.survival,
    };
  });

  // 6 Fighters (at 90★ mid-late tree so passives + signature nodes are live) × 64 Weapons on Pressure bench
  const treeStars = 90;
  const fighterBase = Object.fromEntries(
    FIGHTERS.map(f => [f.name, playFighterBench(press, f.name, treeStars, [], 'average', cellRuns).meanDamage])
  ) as Record<CharacterName, number>;

  const rawCells: Omit<FighterWeaponCell, 'affinity'>[] = [];
  for (const f of FIGHTERS) {
    for (const wId of armory) {
      const charms = PARTNER_WEAPONS.includes(wId) ? ['blast-powder', wId] : [wId];
      const baseForCharms = PARTNER_WEAPONS.includes(wId)
        ? playFighterBench(press, f.name, treeStars, ['blast-powder'], 'average', cellRuns).meanDamage
        : fighterBase[f.name];
      const res = playFighterBench(press, f.name, treeStars, charms, 'average', cellRuns);
      rawCells.push({
        fighter: f.name,
        weaponId: wId,
        totalLift: res.meanDamage / barePressDmg,
        weaponOnFighterLift: res.meanDamage / Math.max(1, baseForCharms),
      });
    }
  }

  const meanByWeapon = Object.fromEntries(
    armory.map(wId => {
      const vals = rawCells.filter(c => c.weaponId === wId).map(c => c.weaponOnFighterLift);
      return [wId, Math.max(0.01, mean(vals))];
    })
  );

  const cells: FighterWeaponCell[] = rawCells.map(c => ({
    ...c,
    affinity: c.weaponOnFighterLift / meanByWeapon[c.weaponId],
  }));

  return {
    curves,
    cells,
    signatureSynergies: [...cells].sort((a, b) => b.affinity - a.affinity).slice(0, 24),
    antiSynergies: [...cells]
      .filter(c => c.weaponOnFighterLift < 0.97 || c.affinity < 0.85)
      .sort((a, b) => a.weaponOnFighterLift - b.weaponOnFighterLift)
      .slice(0, 24),
  };
};

// ─── 4. 8 Arcana (Solo, × 6 Fighters, and All C(8,2)=28 Pairs) ──────────────

export interface ArcanaSoloRow {
  id: ArcanaId;
  numeral: string;
  name: string;
  upside: string;
  tradeoff: string;
  foeHpScale: number;
  /** Effective combat power: (damage / foeHpScale) ÷ no-Arcana baseline */
  effectiveLiftAvg: number;
  effectiveLiftNovice: number;
  effectiveLiftExpert: number;
  rawDamageLift: number;
  survivalRateAvg: number;
  survivalRateNovice: number;
  survivalRateExpert: number;
}

export interface ArcanaPairRow {
  a: ArcanaId;
  b: ArcanaId;
  foeHpScale: number;
  effectiveLift: number;
  survivalRate: number;
  synergy: number;
}

export interface FighterArcanaCell {
  fighter: CharacterName;
  arcanaId: ArcanaId;
  effectiveLift: number;
  survivalRate: number;
  affinity: number;
}

export interface ArcanaMatrixSuite {
  solo: ArcanaSoloRow[];
  pairs: ArcanaPairRow[];
  fighterArcana: FighterArcanaCell[];
}

/**
 * Realistic 2-wave combat bench for Arcana so every Arcana's upside & curse are live:
 * wave 1 (knocks out around mid-fight, triggering overkill coins, wave-clear heal & intermission shop)
 * + wave 2 (unkillable sponge) + XP level-up picks + per-weapon evolutions + Shading Surge + hazards.
 */
const arcanaCombatBench = () => {
  const ref = getLevel('4-4');
  const level: LevelDef = {
    ...ref,
    foes: [
      { name: 'Vanguard Construct', icon: ref.foes[0].icon, hp: 900, parry: null },
      { name: 'Boss Construct', icon: ref.foes[0].icon, hp: 1e7, parry: null },
    ],
    rules: {
      ...ref.rules,
      attributes: [...BASE_TRAITS],
      shadingSurge: true,
      hazards: { timeBombs: { every: 14, seconds: 18 }, snares: { every: 12 } },
      timer: 150,
      hearts: 7,
    },
    challenge: { kind: 'noMistakes' },
  };
  const gear = maxGearFields();
  const base = {
    ...createMaxedSave(),
    ...gear,
    upgrades: { charm_belt: 1, tarot_deck: 2 },
    skillNodes: {},
    // Bring a representative Synergy & Evolution duo so Evolution Resonance, XP picks & shops all fire naturally
    charms: ['flint-spark', 'blast-powder'],
    equippedArcana: [],
  } as AdventureSave;
  return { level, save: base };
};

const runArcanaSample = (
  arcanaIds: readonly ArcanaId[],
  tier: Tier,
  runs: number,
  fighter: CharacterName = 'Orange Tabby',
  stars = 60
) => {
  const ab = arcanaCombatBench();
  const rng = createRng(fighter.length * 53 + stars);
  const nodes = stars > 0 ? buyTree(fighter, stars, 'plan', rng) : [];
  const rules = arcanaRules(arcanaIds);
  const hpScale = rules.foeHpScale ?? 1;
  const save: AdventureSave = {
    ...ab.save,
    selectedFighter: fighter,
    skillNodes: { [fighter]: nodes },
    equippedArcana: [...arcanaIds],
    activeArcana: arcanaIds[0] ?? null,
  };
  const eff: number[] = [];
  const raw: number[] = [];
  let survived = 0;
  for (let i = 0; i < runs; i++) {
    // skipPicks: false so Scholar's Gambit (2x XP, 4 pick options) & Overkill Harvest (shop coins) work!
    const { state } = simulateRun(ab.level, save, BOTS[tier], seedOf(i), undefined, { skipPicks: false });
    raw.push(state.totalDamage);
    eff.push(state.totalDamage / hpScale);
    if (state.endReason !== 'hearts') survived++;
  }
  return { effective: median(eff), raw: median(raw), survival: survived / Math.max(1, runs), hpScale };
};

export const measureArcanaMatrix = (runs = 8): ArcanaMatrixSuite => {
  const soloRuns = Math.max(runs, 10);
  const baseAvg = runArcanaSample([], 'average', soloRuns);
  const baseNov = runArcanaSample([], 'novice', soloRuns);
  const baseExp = runArcanaSample([], 'expert', soloRuns);

  const soloRows: ArcanaSoloRow[] = ARCANA.map(a => {
    const avg = runArcanaSample([a.id], 'average', soloRuns);
    const nov = runArcanaSample([a.id], 'novice', soloRuns);
    const exp = runArcanaSample([a.id], 'expert', soloRuns);
    return {
      id: a.id,
      numeral: a.numeral,
      name: a.name,
      upside: a.upside,
      tradeoff: a.tradeoff,
      foeHpScale: avg.hpScale,
      effectiveLiftAvg: avg.effective / Math.max(1, baseAvg.effective),
      effectiveLiftNovice: nov.effective / Math.max(1, baseNov.effective),
      effectiveLiftExpert: exp.effective / Math.max(1, baseExp.effective),
      rawDamageLift: avg.raw / Math.max(1, baseAvg.raw),
      survivalRateAvg: avg.survival,
      survivalRateNovice: nov.survival,
      survivalRateExpert: exp.survival,
    };
  });

  const soloById = Object.fromEntries(soloRows.map(s => [s.id, s])) as Record<ArcanaId, ArcanaSoloRow>;
  const pairs: ArcanaPairRow[] = [];
  for (let i = 0; i < ARCANA.length; i++) {
    for (let j = i + 1; j < ARCANA.length; j++) {
      const a = ARCANA[i].id;
      const b = ARCANA[j].id;
      const both = runArcanaSample([a, b], 'average', Math.max(5, Math.floor(runs * 0.75)));
      const effLift = both.effective / Math.max(1, baseAvg.effective);
      const expected = soloById[a].effectiveLiftAvg * soloById[b].effectiveLiftAvg;
      pairs.push({
        a,
        b,
        foeHpScale: both.hpScale,
        effectiveLift: effLift,
        survivalRate: both.survival,
        synergy: effLift / Math.max(0.1, expected),
      });
    }
  }

  const fighterBases = Object.fromEntries(
    FIGHTERS.map(f => [f.name, runArcanaSample([], 'average', Math.max(5, Math.floor(runs * 0.75)), f.name, 90).effective])
  ) as Record<CharacterName, number>;

  const rawFA: Omit<FighterArcanaCell, 'affinity'>[] = [];
  for (const f of FIGHTERS) {
    for (const a of ARCANA) {
      const res = runArcanaSample([a.id], 'average', Math.max(5, Math.floor(runs * 0.75)), f.name, 90);
      rawFA.push({
        fighter: f.name,
        arcanaId: a.id,
        effectiveLift: res.effective / Math.max(1, fighterBases[f.name]),
        survivalRate: res.survival,
      });
    }
  }
  const meanByArcana = Object.fromEntries(
    ARCANA.map(a => [a.id, Math.max(0.05, mean(rawFA.filter(c => c.arcanaId === a.id).map(c => c.effectiveLift)))])
  ) as Record<ArcanaId, number>;

  const fighterArcana: FighterArcanaCell[] = rawFA.map(c => ({
    ...c,
    affinity: c.effectiveLift / meanByArcana[c.arcanaId],
  }));

  return { solo: soloRows, pairs, fighterArcana };
};

// ─── 5. Covering-Array Endgame Shapley & Base-vs-Mult Scaling Fan ───────────

export interface FanBandWindow {
  windowLabel: string;
  p10: number;
  median: number;
  mean: number;
  p90: number;
}

export interface ShapleyAttribution {
  id: string;
  name: string;
  kind: 'weapon' | 'fighter' | 'arcana';
  role?: WeaponRole;
  /** Multiplicative endgame DPM factor exp(β_i) inside full 5-weapon + Tree + Arcana builds */
  shapleyMult: number;
  appearances: number;
}

export interface CoveringArraySuite {
  buildCount: number;
  meanBaseDamageShare: number;
  meanSynergyScore: number;
  snowballTiers: {
    unarmed: FanBandWindow[];
    singleWeapon: FanBandWindow[];
    synergyPair: FanBandWindow[];
    fullBuild: FanBandWindow[];
  };
  endMultipleStats: {
    singleMedian: number;
    pairMedian: number;
    fullMedian: number;
    fullMean: number;
    fullP10: number;
    fullP90: number;
  };
  weaponShapley: ShapleyAttribution[];
  fighterShapley: ShapleyAttribution[];
  arcanaShapley: ShapleyAttribution[];
}

const WINDOW_LABELS = ['0–30s', '30–60s', '60–90s', '90–120s', '120–150s', '150–180s'];

const summarizeFan = (curves: readonly (readonly number[])[]): FanBandWindow[] =>
  WINDOW_LABELS.map((windowLabel, wIdx) => {
    const col = curves.map(c => c[wIdx] ?? 0);
    return {
      windowLabel,
      p10: percentile(col, 0.1),
      median: median(col),
      mean: mean(col),
      p90: percentile(col, 0.9),
    };
  });

export const measureCoveringArrayShapley = (passesPerSlot = 15, runsPerBuild = 3): CoveringArraySuite => {
  const sb = scaleBench();
  const armory = sb.save.armory;
  const rng = createRng(20261115);

  // Baseline unarmed curve (establishes ×1.0)
  const baseTrace = traceScaleFight([], Math.max(6, runsPerBuild * 2), 'average');
  const baseEnd = Math.max(1, baseTrace.endDpm);
  const baseStart = Math.max(1, baseTrace.startDpm);

  // Sample 1: Single weapons (all non-partner weapons)
  const singleCurves: number[][] = [];
  const singleEnds: number[] = [];
  for (const id of armory.filter(x => !PARTNER_WEAPONS.includes(x))) {
    const tr = traceScaleFight([id], runsPerBuild, 'average');
    singleCurves.push(tr.dpmBuckets.map(v => v / baseStart));
    singleEnds.push(tr.endDpm / baseEnd);
  }

  // Sample 2: 36 stratified Synergy-Graph-linked weapon pairs
  const allSynergyPairs: [string, string][] = [];
  for (let i = 0; i < armory.length; i++) {
    for (let j = i + 1; j < armory.length; j++) {
      if (beltSynergyOverlap(armory[i], [armory[j]]).length > 0) {
        allSynergyPairs.push(normalizeWeaponPair(armory[i], armory[j]));
      }
    }
  }
  const sampledPairs = rng.shuffle(allSynergyPairs).slice(0, 36);
  const pairCurves: number[][] = [];
  const pairEnds: number[] = [];
  for (const pair of sampledPairs) {
    const tr = traceScaleFight(pair, runsPerBuild, 'average');
    pairCurves.push(tr.dpmBuckets.map(v => v / baseStart));
    pairEnds.push(tr.endDpm / baseEnd);
  }

  // Sample 3: Stratified Latin Covering Array of Full 5-Weapon + Fighter (160★) + 2-Arcana + Maxed Workshop builds
  const pool: string[] = [];
  const totalBuilds = passesPerSlot * 13; // 15 * 13 = 195 builds -> 975 weapon slots -> ~15.2 appearances per weapon!
  while (pool.length < totalBuilds * 5 + 10) pool.push(...rng.shuffle([...armory]));

  const fullCurves: number[][] = [];
  const fullEnds: number[] = [];
  const fullBaseShares: number[] = [];
  const fullSynergyScores: number[] = [];
  const X: number[][] = [];
  const y: number[] = [];
  const wAppear = Array(armory.length).fill(0);
  const fAppear = Array(FIGHTERS.length).fill(0);
  const aAppear = Array(ARCANA.length).fill(0);

  let cursor = 0;
  for (let b = 0; b < totalBuilds; b++) {
    const charms: string[] = [];
    while (charms.length < 5) {
      const cand = pool[cursor++ % pool.length];
      if (!charms.includes(cand)) charms.push(cand);
    }
    // Ensure Understudy sits at index >= 1 so it copies a real charm
    if (charms[0] === 'understudy') [charms[0], charms[1]] = [charms[1], charms[0]];

    const fIdx = b % FIGHTERS.length;
    const fighter = FIGHTERS[fIdx].name;
    const aIdx1 = b % ARCANA.length;
    let aIdx2 = (b + 1 + Math.floor(b / ARCANA.length)) % ARCANA.length;
    // Never pair mutually contradictory monochrome_pact + prismatic_fever
    const id1 = ARCANA[aIdx1].id;
    let id2 = ARCANA[aIdx2].id;
    if ((id1 === 'monochrome_pact' && id2 === 'prismatic_fever') || (id1 === 'prismatic_fever' && id2 === 'monochrome_pact')) {
      aIdx2 = (aIdx2 + 1) % ARCANA.length;
      id2 = ARCANA[aIdx2].id;
    }
    const arcanaPair: ArcanaId[] = aIdx1 === aIdx2 ? [id1] : [id1, id2];
    const hpScale = arcanaRules(arcanaPair).foeHpScale ?? 1;

    const nodes = buyTree(fighter, TREE_BUDGET, b % 2 === 0 ? 'plan' : 'spread', rng);
    const fullSave: Partial<AdventureSave> = {
      ...createMaxedSave(),
      ...maxGearFields(),
      upgrades: {
        heavy_hitter: 3,
        tough_hide: 3,
        hourglass: 3,
        sharp_eyes: 3,
        second_wind: 3,
        charm_belt: 1,
        tarot_deck: 2,
        evolution_lab: 2,
      },
      selectedFighter: fighter,
      skillNodes: { [fighter]: nodes },
      equippedArcana: arcanaPair,
      activeArcana: arcanaPair[0],
    };

    const tr = traceScaleFight(charms, runsPerBuild, 'average', fullSave);
    const effBuckets = tr.dpmBuckets.map(v => v / hpScale / baseStart);
    const effEndMultiple = tr.endDpm / hpScale / baseEnd;

    fullCurves.push(effBuckets);
    fullEnds.push(effEndMultiple);
    fullBaseShares.push(tr.baseDamageShare);
    fullSynergyScores.push(tr.synergyScore);

    // Design row: [1 (intercept), 64 weapon indicators, 5 fighter contrasts (vs index 0), 8 arcana indicators]
    const row = Array(1 + armory.length + (FIGHTERS.length - 1) + ARCANA.length).fill(0);
    row[0] = 1;
    for (const cId of charms) {
      const wi = armory.indexOf(cId);
      if (wi >= 0) {
        row[1 + wi] = 1;
        wAppear[wi]++;
      }
    }
    fAppear[fIdx]++;
    if (fIdx > 0) row[1 + armory.length + (fIdx - 1)] = 1;
    for (const aId of arcanaPair) {
      const ai = ARCANA.findIndex(a => a.id === aId);
      if (ai >= 0) {
        row[1 + armory.length + (FIGHTERS.length - 1) + ai] = 1;
        aAppear[ai]++;
      }
    }
    X.push(row);
    y.push(Math.log(Math.max(0.2, effEndMultiple)));
  }

  const beta = solveRidge(X, y, 2.5);
  const wBetas = armory.map((_, i) => beta[1 + i]);
  const wMeanBeta = mean(wBetas);

  const weaponShapley: ShapleyAttribution[] = armory.map((id, i) => ({
    id,
    name: getArmoryWeapon(id)!.name,
    kind: 'weapon',
    role: weaponRole(id),
    // Center around mean 5-slot peer contribution so >1.00 = beats average endgame weapon slot
    shapleyMult: Math.exp(wBetas[i] - wMeanBeta),
    appearances: wAppear[i],
  }));

  const rawFighterBetas = FIGHTERS.map((_, i) => (i === 0 ? 0 : beta[1 + armory.length + (i - 1)]));
  const meanFBeta = mean(rawFighterBetas);
  const fighterShapley: ShapleyAttribution[] = FIGHTERS.map((f, i) => ({
    id: f.name,
    name: f.name,
    kind: 'fighter',
    shapleyMult: Math.exp(rawFighterBetas[i] - meanFBeta),
    appearances: fAppear[i],
  }));

  const arcanaShapley: ShapleyAttribution[] = ARCANA.map((a, i) => ({
    id: a.id,
    name: a.name,
    kind: 'arcana',
    shapleyMult: Math.exp(beta[1 + armory.length + (FIGHTERS.length - 1) + i]),
    appearances: aAppear[i],
  }));

  return {
    buildCount: totalBuilds,
    meanBaseDamageShare: mean(fullBaseShares),
    meanSynergyScore: mean(fullSynergyScores),
    snowballTiers: {
      unarmed: summarizeFan([baseTrace.dpmBuckets.map(v => v / baseStart)]),
      singleWeapon: summarizeFan(singleCurves),
      synergyPair: summarizeFan(pairCurves),
      fullBuild: summarizeFan(fullCurves),
    },
    endMultipleStats: {
      singleMedian: median(singleEnds),
      pairMedian: median(pairEnds),
      fullMedian: median(fullEnds),
      fullMean: mean(fullEnds),
      fullP10: percentile(fullEnds, 0.1),
      fullP90: percentile(fullEnds, 0.9),
    },
    weaponShapley: weaponShapley.sort((a, b) => b.shapleyMult - a.shapleyMult),
    fighterShapley: fighterShapley.sort((a, b) => b.shapleyMult - a.shapleyMult),
    arcanaShapley: arcanaShapley.sort((a, b) => b.shapleyMult - a.shapleyMult),
  };
};

// ─── 6. Campaign Progression & Bayesian Suspense Audit ──────────────────────

export interface CampaignLevelRow {
  id: string;
  title: string;
  world: number;
  kind: string;
  bareStar1Rate: number;
  bareWinRate: number;
  bareStar3Rate: number;
  bareTarget: number;
  investedStar1Rate: number;
  investedWinRate: number;
  investedStar3Rate: number;
  investedTarget: number;
  investedStar3Target: number;
  progressionGap: number;
  meanTimeLeftShare: number;
  meanHeartsLeftShare: number;
  /** Shannon/Bernoulli suspense S(p) = 4p(1-p) combined with close-clock tension [0..1] */
  suspenseScore: number;
  status: 'ok' | 'blowout' | 'wall' | 'drifted';
}

export interface CampaignSuspenseSuite {
  levels: CampaignLevelRow[];
  byWorld: {
    world: number;
    bareStar1Mean: number;
    bareMean: number;
    bareTarget: number;
    investedStar1Mean: number;
    investedMean: number;
    investedTarget: number;
    investedStar3Mean: number;
    meanSuspense: number;
  }[];
}

export const measureCampaignSuspense = (runs = 20): CampaignSuspenseSuite => {
  const evalPlan = (level: LevelDef, basePlan: BuildPlan) => {
    const plan: BuildPlan = { ...basePlan, keepCharms: !!PUZZLE_CHARMS[level.id] };
    const save = campaignSave(level);
    let star1 = 0;
    let wins = 0;
    let star3 = 0;
    let timeShares = 0;
    let heartShares = 0;
    for (let i = 0; i < runs; i++) {
      const { state, stars } = simulateRun(level, save, BOTS.average, seedOf(i), plan);
      if (stars >= 1) star1++;
      if (stars >= 2) wins++;
      if (stars >= 3) star3++;
      const tShare =
        level.rules.timer && state.timeLeft !== null
          ? Math.max(0, state.timeLeft) / level.rules.timer
          : level.rules.moves && state.movesLeft !== null
            ? Math.max(0, state.movesLeft) / level.rules.moves
            : 0.35;
      const hShare = state.maxHearts && state.hearts !== null ? Math.max(0, state.hearts) / state.maxHearts : 1;
      timeShares += tShare;
      heartShares += hShare;
    }
    const denom = Math.max(1, runs);
    return {
      star1Rate: star1 / denom,
      winRate: wins / denom,
      star3Rate: star3 / denom,
      meanTimeLeftShare: timeShares / denom,
      meanHeartsLeftShare: heartShares / denom,
    };
  };

  const rows: CampaignLevelRow[] = LEVELS.map(l => {
    const targets = winTargets(l);
    const st = starTargets(l);
    const bare = evalPlan(l, barePlan(l));
    const inv = evalPlan(l, investedPlan(l));
    // Outcome uncertainty 4*p*(1-p) + close-finish tension when winning with <35% clock or <60% hearts
    const outcomeEntropy = 4 * inv.winRate * (1 - inv.winRate);
    const finishTension = Math.max(0, 1 - inv.meanTimeLeftShare * 1.4) * 0.6 + Math.max(0, 1 - inv.meanHeartsLeftShare) * 0.4;
    const suspense = Math.min(1, 0.55 * outcomeEntropy + 0.45 * finishTension);

    const drifted =
      Math.abs(bare.winRate - targets.bare) > 0.22 || Math.abs(inv.winRate - targets.invested) > 0.22;
    const kind = l.isBoss ? 'boss' : isTrial(l) ? 'trial' : l.branchOf ? 'side' : 'main';
    const status: CampaignLevelRow['status'] = drifted
      ? 'drifted'
      : inv.winRate < 0.3
      ? 'wall'
      : (l.isBoss || !!l.branchOf) && inv.winRate > 0.95 && inv.meanTimeLeftShare > 0.55
      ? 'blowout'
      : 'ok';

    return {
      id: l.id,
      title: l.name,
      world: worldOf(l),
      kind,
      bareStar1Rate: bare.star1Rate,
      bareWinRate: bare.winRate,
      bareStar3Rate: bare.star3Rate,
      bareTarget: targets.bare,
      investedStar1Rate: inv.star1Rate,
      investedWinRate: inv.winRate,
      investedStar3Rate: inv.star3Rate,
      investedTarget: targets.invested,
      investedStar3Target: st.investedStar3,
      progressionGap: inv.winRate - bare.winRate,
      meanTimeLeftShare: inv.meanTimeLeftShare,
      meanHeartsLeftShare: inv.meanHeartsLeftShare,
      suspenseScore: suspense,
      status,
    };
  });

  const byWorld = [1, 2, 3, 4, 5].map(w => {
    const wRows = rows.filter(r => r.world === w && r.kind === 'main' && r.id !== '1-1');
    return {
      world: w,
      bareStar1Mean: mean(wRows.map(r => r.bareStar1Rate)),
      bareMean: mean(wRows.map(r => r.bareWinRate)),
      bareTarget: mean(wRows.map(r => r.bareTarget)),
      investedStar1Mean: mean(wRows.map(r => r.investedStar1Rate)),
      investedMean: mean(wRows.map(r => r.investedWinRate)),
      investedTarget: mean(wRows.map(r => r.investedTarget)),
      investedStar3Mean: mean(wRows.map(r => r.investedStar3Rate)),
      meanSuspense: mean(wRows.map(r => r.suspenseScore)),
    };
  });

  return { levels: rows, byWorld };
};

export interface FullBalanceAtlasData {
  generatedAt: string;
  version: string;
  roles: typeof WEAPON_ROLES;
  targets: typeof BALANCE_TARGETS;
  weaponsSuite: WeaponExtendedSuite;
  pairSuite: PairSynergySuite;
  fighterSuite: FighterMatrixSuite;
  arcanaSuite: ArcanaMatrixSuite;
  coveringSuite: CoveringArraySuite;
  campaignSuite: CampaignSuspenseSuite;
}

export const runFullBalanceAtlas = (opts?: {
  weaponRuns?: number;
  buildCount?: number;
  pairRuns?: number;
  evoRuns?: number;
  fighterRuns?: number;
  arcanaRuns?: number;
  coveringPasses?: number;
  campaignRuns?: number;
  version?: string;
}): FullBalanceAtlasData => ({
  generatedAt: new Date().toISOString(),
  version: opts?.version ?? pkg.version,
  roles: WEAPON_ROLES,
  targets: BALANCE_TARGETS,
  weaponsSuite: measureWeaponsExtended(opts?.weaponRuns ?? 10, opts?.buildCount ?? 10),
  pairSuite: measurePairSynergyMatrix(opts?.pairRuns ?? 3, opts?.evoRuns ?? 8),
  fighterSuite: measureFighterMatrix(opts?.fighterRuns ?? 8, Math.max(3, Math.floor((opts?.fighterRuns ?? 8) / 2))),
  arcanaSuite: measureArcanaMatrix(opts?.arcanaRuns ?? 8),
  coveringSuite: measureCoveringArrayShapley(opts?.coveringPasses ?? 14, 3),
  campaignSuite: measureCampaignSuspense(opts?.campaignRuns ?? 20),
});
