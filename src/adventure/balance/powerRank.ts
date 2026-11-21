/**
 * Unified 1.00x+ Power Ranking Engine for NShapes (Weapons, Evolutions, Fighters, Arcana).
 *
 * Pure TypeScript (zero React Native / UI / filesystem dependencies) so it can be reused
 * identically across CLI (`scripts/balance-power-rank.ts`), unit tests, and dev tools.
 *
 * Core mathematical principle:
 *  - Every item gets a strictly positive Composite Combat Power Index `P_i > 0`
 *    (weighted geometric mean of counterfactual total-lift ratios from the Balance Lab
 *    and Balance Atlas).
 *  - Primary multiplier: `powerMult = P_i / min_j(P_j)` (weakest item in category === 1.00x).
 *    Strictly positive, scale-invariant, noise-resistant, directly interpretable as
 *    "total combat output ratio relative to the weakest item in the category".
 *  - Secondary multiplier: `addedMult = ln(P_i) / ln(P_min)` (guarded when `P_min >= 1.05`,
 *    else `null`). Strictly monotone with `powerMult` (identical rank order), expressing
 *    marginal bonus power added over an empty slot relative to the weakest item.
 *  - PostHog live telemetry blending (Empirical Bayes shrinkage in log-space):
 *      w_live = effectiveN / (effectiveN + 30)
 *      P_blend = P_sim * exp(w_live * liveLogLift)
 *    Re-anchored so the weakest blended item === 1.00x.
 */
import type { CharacterName } from '@/types';
import {
  BALANCE_ERA_MANIFEST,
  compareSemver,
  CURRENT_BALANCE_ERA,
  getMinValidVersion,
  type FightModeFilter,
} from '../../analytics/balanceEras';
import type {
  CredibilityTier,
  LiveItemSignal,
  PostHogAuditLedger,
  PostHogBalanceSignals,
} from '../../analytics/posthogRules';
import { roleLabel, WEAPON_ROLES, type WeaponRole } from '../data/weaponRoles';
import type { FullBalanceAtlasData, WeaponExtendedRow } from './analytics';
import type { Snapshot } from './report';

export type { CredibilityTier, LiveItemSignal, PostHogAuditLedger, PostHogBalanceSignals };

// ─── Public Constants & Formula Weights ──────────────────────────────────────

export const EMPIRICAL_BAYES_PRIOR_K = 30;
export const ADDED_MULT_MIN_FLOOR = 1.05;

export const WEAPON_COMPOSITE_WEIGHTS = {
  inBuild: 0.55,
  soloLate3Tier: 0.15,
  pressure: 0.15,
  campaign: 0.05,
  shapley: 0.10,
} as const;

export const EVOLUTION_COMPOSITE_WEIGHTS = {
  cleanTotal: 0.55,
  ruleLift: 0.45,
} as const;

export const EVOLUTION_BUILD_AROUND_WEIGHTS = {
  cleanTotal: 0.40,
  ruleLift: 0.35,
  pairOutput: 0.25,
} as const;

export const FIGHTER_COMPOSITE_WEIGHTS = {
  shapley: 0.30,
  withWeapons90: 0.25,
  pressure160Surv: 0.25,
  dummy160: 0.20,
} as const;

export const ARCANA_COMPOSITE_WEIGHTS = {
  effectiveAvgSurv: 0.45,
  effectiveExpert: 0.20,
  shapley: 0.35,
} as const;

export const DIVERGENCE_THRESHOLDS = {
  minEffectiveN: 15,
  /** ~+25% / -20% live-vs-sim residual relative to category peers */
  logResidualGap: 0.22,
  minFunCount: 10,
  lowFunRate: 0.50,
  highFunRate: 0.85,
} as const;

// ─── Categories, Lenses & Shared Live-Telemetry Contract ─────────────────────

export type PowerCategory = 'weapons' | 'evolutions' | 'fighters' | 'arcana';

export type WeaponLens = 'composite' | 'inBuild' | 'solo' | 'pressure' | 'shapley';
export type EvolutionLens = 'composite' | 'buildAround' | 'ruleLift' | 'pairOutput';
export type FighterLens = 'composite' | 'fullBuild' | 'pressure160' | 'dummy160' | 'withWeapons90';
export type ArcanaLens = 'composite' | 'effectiveAvg' | 'effectiveExpert' | 'shapley';
export type AnyLens = WeaponLens | EvolutionLens | FighterLens | ArcanaLens;

export const CATEGORY_LENSES: Record<PowerCategory, readonly string[]> = {
  weapons: ['composite', 'inBuild', 'solo', 'pressure', 'shapley'],
  evolutions: ['composite', 'buildAround', 'ruleLift', 'pairOutput'],
  fighters: ['composite', 'fullBuild', 'pressure160', 'dummy160', 'withWeapons90'],
  arcana: ['composite', 'effectiveAvg', 'effectiveExpert', 'shapley'],
};

/**
 * Accepts full `PostHogBalanceSignals` from `analyzePostHogForBalance(...)` as well as
 * partial signal subsets in unit tests or targeted CLI queries.
 */
export type LiveItemSignalLike = Omit<
  LiveItemSignal,
  'category' | 'ridgeWinDelta' | 'logDpmDelta' | 'ridgeLogDpmDelta'
> & {
  category: string;
  ridgeWinDelta?: number | null;
  logDpmDelta?: number | null;
  ridgeLogDpmDelta?: number | null;
};

export interface PostHogSignalsInput {
  audit?: PostHogAuditLedger;
  /** Backwards-compatible alias for `audit` */
  ledger?: PostHogAuditLedger;
  mode?: FightModeFilter | 'all';
  ridgeUsed?: boolean;
  decidedFights?: number;
  evolutionCohortFights?: number;
  weapons?: Readonly<Record<string, LiveItemSignalLike>> | readonly LiveItemSignalLike[];
  evolutions?: Readonly<Record<string, LiveItemSignalLike>> | readonly LiveItemSignalLike[];
  fighters?: Readonly<Record<string, LiveItemSignalLike>> | readonly LiveItemSignalLike[];
  arcana?: Readonly<Record<string, LiveItemSignalLike>> | readonly LiveItemSignalLike[];
  byCategory?: Partial<
    Record<PowerCategory, Readonly<Record<string, LiveItemSignalLike>> | readonly LiveItemSignalLike[]>
  >;
}

export type DivergenceKind = 'BOT_BLIND_SLEEPER' | 'BOT_FAVORED_TRAP' | 'FUN_POWER_GAP' | 'STALE_DATA';

export interface DivergenceAlert {
  kind: DivergenceKind;
  category: PowerCategory | 'global';
  itemId?: string;
  itemName?: string;
  severity: 'info' | 'warn';
  detail: string;
}

// ─── Output Types ────────────────────────────────────────────────────────────

export interface WeaponEntryMeta {
  kind: 'weapons';
  role: WeaponRole;
  roleLabel: string;
  partner: boolean;
  inBuildLift: number;
  soloEarly: number;
  soloCampaign: number;
  soloMid: number;
  soloLateNovice: number;
  soloLateAvg: number;
  soloLateExpert: number;
  soloLate3Tier: number;
  pressureAvg: number;
  pressureNovice: number;
  pressureSurvivalGain: number;
  shapleyMult: number;
  powerEndMultiple: number;
}

export interface EvolutionEntryMeta {
  kind: 'evolutions';
  pair: [string, string];
  isSignature: boolean;
  armingPairCount: number;
  hasEncoreFix: boolean;
  rawTotalLift: number;
  cleanTotalLift: number;
  ruleLift: number;
  meanPairLift: number;
  startsPerFight: number;
  ruleFiringsPerFight: number;
  buildAroundMult: number;
}

export interface FighterEntryMeta {
  kind: 'fighters';
  passives: readonly string[];
  blurb: string;
  dummy0Stars: number;
  dummy60Stars: number;
  dummy160Stars: number;
  pressure0Stars: number;
  pressure60Stars: number;
  pressure160Stars: number;
  pressureSurvival160: number;
  withWeapons90Mean: number;
  shapleyMult: number;
  topWeaponSynergies: { weaponId: string; affinity: number; totalLift: number }[];
  topArcana: { arcanaId: string; affinity: number; effectiveLift: number }[];
}

export interface ArcanaEntryMeta {
  kind: 'arcana';
  numeral: string;
  upside: string;
  tradeoff: string;
  foeHpScale: number;
  effectiveLiftNovice: number;
  effectiveLiftAvg: number;
  effectiveLiftExpert: number;
  survivalRateAvg: number;
  shapleyMult: number;
}

export type EntryMeta = WeaponEntryMeta | EvolutionEntryMeta | FighterEntryMeta | ArcanaEntryMeta;

export interface PowerRankEntry {
  rank: number;
  id: string;
  name: string;
  category: PowerCategory;
  /** Primary 1.00x+ multiplier (blended with PostHog when available, else equal to simMult). Weakest === 1.00. */
  powerMult: number;
  /** Secondary marginal added-value multiplier ln(P_i)/ln(P_min) (weakest === 1.00), or null when P_min < 1.05. */
  addedMult: number | null;
  /** Pure simulation 1.00x+ multiplier (weakest === 1.00). */
  simMult: number;
  /** Pure simulation added-value multiplier, or null when sim P_min < 1.05. */
  simAddedMult: number | null;
  /** Standalone PostHog live 1.00x+ multiplier among observed items in this category, or null if no live fights. */
  liveMult: number | null;
  /** 95% confidence interval around `powerMult` when live data is blended, else null. */
  ciLow: number | null;
  ciHigh: number | null;
  /** Empirical Bayes shrinkage weight on live telemetry: effectiveN / (effectiveN + 30). */
  liveWeight: number;
  /** Underlying strictly positive composite power index before min-anchoring. */
  rawSimIndex: number;
  rawBlendedIndex: number;
  /** 1.00x-anchored multiplier under every sub-lens of this category (pure simulation). */
  subLenses: Record<string, number>;
  /** PostHog telemetry metadata (defaults to sim_only when absent). */
  credibility: CredibilityTier;
  validSince: string | null;
  fights: number;
  effectiveN: number;
  uniquePlayers: number;
  winRate: number | null;
  adjustedWinDelta: number | null;
  pickRate: number | null;
  funRate: number | null;
  funCount: number;
  alerts: DivergenceAlert[];
  meta: EntryMeta;
}

export interface RoleRollup {
  role: WeaponRole;
  label: string;
  count: number;
  avgMult: number;
  medianMult: number;
  minMult: number;
  maxMult: number;
  topId: string;
  topName: string;
  topMult: number;
}

export interface CategoryRanking {
  category: PowerCategory;
  lens: string;
  count: number;
  weakestId: string;
  weakestName: string;
  strongestId: string;
  strongestName: string;
  minRawSim: number;
  maxRawSim: number;
  minRawBlended: number;
  maxRawBlended: number;
  medianMult: number;
  p90Mult: number;
  maxMult: number;
  maxAddedMult: number | null;
  liveObservedCount: number;
  entries: PowerRankEntry[];
  roleRollups?: RoleRollup[];
}

export interface EraContext {
  currentEraId: string;
  currentEraMinVersion: string;
  appVersion?: string;
  getMinValidVersion?: (category: PowerCategory, itemId?: string, mode?: string) => string;
}

export interface PowerRankInput {
  snapshot: Snapshot;
  analytics: FullBalanceAtlasData;
  posthog?: PostHogSignalsInput | null;
  lenses?: Partial<Record<PowerCategory, string>>;
  mode?: FightModeFilter;
  eraContext?: EraContext;
  /** Prior strength `k` for Empirical Bayes live weight `n_eff / (n_eff + k)`. Default 30. */
  priorK?: number;
}

export interface PowerRankReport {
  generatedAt: string;
  simAnalyticsVersion: string;
  simAnalyticsGeneratedAt: string;
  appVersion: string | null;
  mode: string;
  hasLiveData: boolean;
  currentEraId: string | null;
  currentEraMinVersion: string | null;
  medianChassisLift: number;
  priorK: number;
  auditLedger: PostHogAuditLedger | null;
  alerts: DivergenceAlert[];
  categories: Record<PowerCategory, CategoryRanking>;
}

export interface ComparisonResult {
  category: PowerCategory;
  a: PowerRankEntry;
  b: PowerRankEntry;
  /** `a.powerMult / b.powerMult` (>1 means A is stronger than B) */
  ratioAOverB: number;
  rankDelta: number;
  subLensRatios: Record<string, number>;
}

// ─── Numeric Helpers ─────────────────────────────────────────────────────────

const clampPos = (x: number, floor = 1e-4): number => (Number.isFinite(x) && x > floor ? x : floor);

const geoMean = (xs: readonly number[]): number => {
  if (!xs.length) return 1;
  let sum = 0;
  for (const x of xs) sum += Math.log(clampPos(x));
  return Math.exp(sum / xs.length);
};

const quantile = (xs: readonly number[], p: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

const roundN = (x: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

const extractSignalsMap = (
  posthog: PostHogSignalsInput | null | undefined,
  category: PowerCategory
): Map<string, LiveItemSignalLike> => {
  const out = new Map<string, LiveItemSignalLike>();
  if (!posthog) return out;
  const raw = posthog.byCategory?.[category] ?? posthog[category];
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item.id === 'string') out.set(item.id, item);
    }
  } else {
    for (const [k, item] of Object.entries(raw)) {
      if (item) out.set(item.id || k, item);
    }
  }
  return out;
};

const normalizeLens = (category: PowerCategory, requested?: string): string => {
  const valid = CATEGORY_LENSES[category];
  if (!requested) return valid[0];
  if (valid.includes(requested)) return requested;
  // Helpful aliases
  if (category === 'weapons' && (requested === 'soloLate' || requested === 'late')) return 'solo';
  if (category === 'weapons' && requested === 'in-build') return 'inBuild';
  if (category === 'evolutions' && (requested === 'build-around' || requested === 'e8')) return 'buildAround';
  if (category === 'evolutions' && (requested === 'rule' || requested === 'rule-lift')) return 'ruleLift';
  if (category === 'evolutions' && (requested === 'pair' || requested === 'pairLift')) return 'pairOutput';
  if (category === 'fighters' && (requested === 'shapley' || requested === 'full-build')) return 'fullBuild';
  if (category === 'fighters' && requested === 'pressure') return 'pressure160';
  if (category === 'fighters' && requested === 'dummy') return 'dummy160';
  if (category === 'fighters' && requested === 'weapons') return 'withWeapons90';
  return valid[0];
};

// ─── Core Ranking Builder (shared across all 4 categories) ───────────────────

interface RawCategoryItem {
  id: string;
  name: string;
  category: PowerCategory;
  /** Raw positive index per lens for this category */
  lensRaw: Record<string, number>;
  meta: EntryMeta;
}

const buildCategoryRanking = (
  category: PowerCategory,
  lens: string,
  items: readonly RawCategoryItem[],
  signals: Map<string, LiveItemSignalLike>,
  priorK: number,
  mode: string,
  eraContext?: EraContext
): CategoryRanking => {
  // 1. Precompute 1.00x-anchored simulation multipliers for every sub-lens
  const lensNames = CATEGORY_LENSES[category];
  const lensMin: Record<string, number> = {};
  for (const l of lensNames) {
    lensMin[l] = Math.min(...items.map(it => clampPos(it.lensRaw[l] ?? it.lensRaw.composite)));
  }

  // 2. Active lens pure simulation index & peer geometric mean (for divergence detection)
  const rawSims = items.map(it => clampPos(it.lensRaw[lens] ?? it.lensRaw.composite));
  const minRawSim = Math.min(...rawSims);
  const maxRawSim = Math.max(...rawSims);
  const gmSim = geoMean(rawSims);

  // 3. Standalone live multipliers among observed items
  const rawLives: number[] = [];
  for (const it of items) {
    const sig = signals.get(it.id);
    if (sig && sig.fights > 0 && Number.isFinite(sig.liveLogLift)) {
      rawLives.push(Math.exp(sig.liveLogLift));
    }
  }
  const minRawLive = rawLives.length > 0 ? Math.min(...rawLives) : null;

  // 4. Apply Empirical Bayes shrinkage in log-space
  const preliminary = items.map((it, idx) => {
    const rawSim = rawSims[idx];
    const sig = signals.get(it.id);
    const fights = sig?.fights ?? 0;
    const effectiveN = sig?.effectiveN ?? 0;
    const liveWeight = effectiveN > 0 ? effectiveN / (effectiveN + priorK) : 0;
    const liveLogLift = sig && Number.isFinite(sig.liveLogLift) ? sig.liveLogLift : 0;
    const rawBlended = clampPos(rawSim * Math.exp(liveWeight * liveLogLift));

    const validSince =
      sig?.validSince ??
      eraContext?.getMinValidVersion?.(category, it.id, mode) ??
      eraContext?.currentEraMinVersion ??
      null;

    const subLenses: Record<string, number> = {};
    for (const l of lensNames) {
      const val = clampPos(it.lensRaw[l] ?? it.lensRaw.composite);
      subLenses[l] = roundN(val / lensMin[l], 4);
    }

    return {
      it,
      sig,
      rawSim,
      rawBlended,
      fights,
      effectiveN,
      liveWeight,
      liveLogLift,
      validSince,
      subLenses,
    };
  });

  const minRawBlended = Math.min(...preliminary.map(p => p.rawBlended));
  const maxRawBlended = Math.max(...preliminary.map(p => p.rawBlended));

  // Precompute blended powerMults so FUN_POWER_GAP can inspect p25/p75
  const allPowerMults = preliminary.map(p => p.rawBlended / minRawBlended);
  const p25Mult = quantile(allPowerMults, 0.25);
  const p75Mult = quantile(allPowerMults, 0.75);

  const unsortedEntries: PowerRankEntry[] = preliminary.map(p => {
    const powerMult = p.rawBlended / minRawBlended;
    const simMult = p.rawSim / minRawSim;
    const addedMult =
      minRawBlended >= ADDED_MULT_MIN_FLOOR ? Math.log(p.rawBlended) / Math.log(minRawBlended) : null;
    const simAddedMult =
      minRawSim >= ADDED_MULT_MIN_FLOOR ? Math.log(p.rawSim) / Math.log(minRawSim) : null;

    const hasLive = !!(p.sig && p.sig.fights > 0 && Number.isFinite(p.sig.liveLogLift) && minRawLive !== null);
    const liveMult = hasLive ? Math.exp(p.liveLogLift) / minRawLive! : null;

    let ciLow: number | null = null;
    let ciHigh: number | null = null;
    if (p.effectiveN > 0) {
      const se =
        p.sig &&
        p.sig.liveLogLiftSE !== null &&
        Number.isFinite(p.sig.liveLogLiftSE) &&
        p.sig.liveLogLiftSE > 0
          ? p.sig.liveLogLiftSE
          : 1 / Math.sqrt(Math.max(1, p.effectiveN));
      const postSE = p.liveWeight * se;
      ciLow = roundN(powerMult * Math.exp(-1.96 * postSE), 4);
      ciHigh = roundN(powerMult * Math.exp(1.96 * postSE), 4);
    }

    // Divergence alerts
    const alerts: DivergenceAlert[] = [];
    const simLogRel = Math.log(p.rawSim / gmSim);
    if (p.sig && p.effectiveN >= DIVERGENCE_THRESHOLDS.minEffectiveN && Number.isFinite(p.sig.liveLogLift)) {
      const residualGap = p.sig.liveLogLift - simLogRel;
      if (residualGap >= DIVERGENCE_THRESHOLDS.logResidualGap) {
        const pctAhead = Math.round((Math.exp(residualGap) - 1) * 100);
        alerts.push({
          kind: 'BOT_BLIND_SLEEPER',
          category,
          itemId: p.it.id,
          itemName: p.it.name,
          severity: 'warn',
          detail: `Live players outperform simulation by +${pctAhead}% vs peers (n=${p.fights}, n_eff=${p.effectiveN.toFixed(1)}, sim=${simMult.toFixed(2)}×, live=${liveMult?.toFixed(2) ?? '—'}×)`,
        });
      } else if (residualGap <= -DIVERGENCE_THRESHOLDS.logResidualGap) {
        const pctBehind = Math.round((1 - Math.exp(residualGap)) * 100);
        alerts.push({
          kind: 'BOT_FAVORED_TRAP',
          category,
          itemId: p.it.id,
          itemName: p.it.name,
          severity: 'warn',
          detail: `Live players underperform simulation by -${pctBehind}% vs peers (n=${p.fights}, n_eff=${p.effectiveN.toFixed(1)}, sim=${simMult.toFixed(2)}×, live=${liveMult?.toFixed(2) ?? '—'}×)`,
        });
      }
    }

    if (
      p.sig &&
      p.sig.funCount >= DIVERGENCE_THRESHOLDS.minFunCount &&
      p.sig.funRate !== null &&
      Number.isFinite(p.sig.funRate)
    ) {
      if (powerMult >= p75Mult && p.sig.funRate <= DIVERGENCE_THRESHOLDS.lowFunRate) {
        alerts.push({
          kind: 'FUN_POWER_GAP',
          category,
          itemId: p.it.id,
          itemName: p.it.name,
          severity: 'info',
          detail: `High power (${powerMult.toFixed(2)}×) but low fun rating (${Math.round(p.sig.funRate * 100)}% 👍 across ${p.sig.funCount} ratings)`,
        });
      } else if (powerMult <= p25Mult && p.sig.funRate >= DIVERGENCE_THRESHOLDS.highFunRate) {
        alerts.push({
          kind: 'FUN_POWER_GAP',
          category,
          itemId: p.it.id,
          itemName: p.it.name,
          severity: 'info',
          detail: `Crowd pleaser (${Math.round(p.sig.funRate * 100)}% 👍 across ${p.sig.funCount} ratings) despite low power (${powerMult.toFixed(2)}×)`,
        });
      }
    }

    return {
      rank: 0,
      id: p.it.id,
      name: p.it.name,
      category,
      powerMult: roundN(powerMult, 4),
      addedMult: addedMult !== null ? roundN(addedMult, 4) : null,
      simMult: roundN(simMult, 4),
      simAddedMult: simAddedMult !== null ? roundN(simAddedMult, 4) : null,
      liveMult: liveMult !== null ? roundN(liveMult, 4) : null,
      ciLow,
      ciHigh,
      liveWeight: roundN(p.liveWeight, 4),
      rawSimIndex: roundN(p.rawSim, 4),
      rawBlendedIndex: roundN(p.rawBlended, 4),
      subLenses: p.subLenses,
      credibility: p.sig?.credibility ?? 'sim_only',
      validSince: p.validSince,
      fights: p.fights,
      effectiveN: roundN(p.effectiveN, 2),
      uniquePlayers: p.sig?.uniquePlayers ?? 0,
      winRate: p.sig?.winRate ?? null,
      adjustedWinDelta: p.sig?.adjustedWinDelta ?? null,
      pickRate: p.sig?.pickRate ?? null,
      funRate: p.sig?.funRate ?? null,
      funCount: p.sig?.funCount ?? 0,
      alerts,
      meta: p.it.meta,
    };
  });

  // Sort descending by powerMult, then simMult, then id for deterministic ties
  unsortedEntries.sort(
    (a, b) => b.rawBlendedIndex - a.rawBlendedIndex || b.rawSimIndex - a.rawSimIndex || a.id.localeCompare(b.id)
  );
  const entries = unsortedEntries.map((e, i) => ({ ...e, rank: i + 1 }));

  const weakest = entries[entries.length - 1];
  const strongest = entries[0];
  const mults = entries.map(e => e.powerMult);

  return {
    category,
    lens,
    count: entries.length,
    weakestId: weakest?.id ?? '',
    weakestName: weakest?.name ?? '',
    strongestId: strongest?.id ?? '',
    strongestName: strongest?.name ?? '',
    minRawSim: roundN(minRawSim, 4),
    maxRawSim: roundN(maxRawSim, 4),
    minRawBlended: roundN(minRawBlended, 4),
    maxRawBlended: roundN(maxRawBlended, 4),
    medianMult: roundN(quantile(mults, 0.5), 4),
    p90Mult: roundN(quantile(mults, 0.9), 4),
    maxMult: strongest?.powerMult ?? 1,
    maxAddedMult: strongest?.addedMult ?? null,
    liveObservedCount: entries.filter(e => e.fights > 0).length,
    entries,
  };
};

// ─── Category Builders ───────────────────────────────────────────────────────

const buildWeaponItems = (snapshot: Snapshot, analytics: FullBalanceAtlasData): RawCategoryItem[] => {
  const weapons: readonly WeaponExtendedRow[] = analytics.weaponsSuite.weapons;
  const shapById = new Map(analytics.coveringSuite.weaponShapley.map(s => [s.id, s.shapleyMult]));

  const pre = weapons.map(w => {
    const snapEarly = snapshot[`weapon:${w.id}:early`];
    const snapCamp = snapshot[`weapon:${w.id}:campaign`];
    const snapLate = snapshot[`weapon:${w.id}:late`];
    const snapInB = snapshot[`weapon:${w.id}:inBuild`];

    const inBuildBlend =
      snapInB !== undefined
        ? Math.pow(clampPos(snapInB), 0.65) * Math.pow(clampPos(w.inBuildLift), 0.35)
        : clampPos(w.inBuildLift);
    const lateAvgVal = clampPos(snapLate ?? w.lateAvg);
    const soloLate3Tier = Math.cbrt(clampPos(w.lateNovice) * lateAvgVal * clampPos(w.lateExpert));
    const pressVal = clampPos(w.pressureAvg);
    const campVal = clampPos(snapCamp ?? w.earlyAvg);
    const shapVal = clampPos(shapById.get(w.id) ?? 1);

    return {
      w,
      snapEarly: snapEarly ?? w.earlyAvg,
      snapCamp: campVal,
      snapLate: lateAvgVal,
      inBuildBlend,
      soloLate3Tier,
      pressVal,
      shapVal,
    };
  });

  const nonPartner = pre.filter(p => !p.w.partner);
  const gmInB = geoMean(pre.map(p => p.inBuildBlend));
  const gmLate = geoMean(nonPartner.map(p => p.soloLate3Tier));
  const gmPress = geoMean(nonPartner.map(p => p.pressVal));
  const gmCamp = geoMean(nonPartner.map(p => p.snapCamp));

  return pre.map(p => {
    const ratio = p.inBuildBlend / gmInB;
    const effLate = p.w.partner ? gmLate * ratio : p.soloLate3Tier;
    const effPress = p.w.partner ? gmPress * ratio : p.pressVal;
    const effCamp = p.w.partner ? gmCamp * ratio : p.snapCamp;

    const composite =
      Math.pow(p.inBuildBlend, WEAPON_COMPOSITE_WEIGHTS.inBuild) *
      Math.pow(effLate, WEAPON_COMPOSITE_WEIGHTS.soloLate3Tier) *
      Math.pow(effPress, WEAPON_COMPOSITE_WEIGHTS.pressure) *
      Math.pow(effCamp, WEAPON_COMPOSITE_WEIGHTS.campaign) *
      Math.pow(p.shapVal, WEAPON_COMPOSITE_WEIGHTS.shapley);

    return {
      id: p.w.id,
      name: p.w.name,
      category: 'weapons',
      lensRaw: {
        composite,
        inBuild: p.inBuildBlend,
        solo: p.soloLate3Tier,
        pressure: p.pressVal,
        shapley: p.shapVal,
      },
      meta: {
        kind: 'weapons',
        role: p.w.role,
        roleLabel: roleLabel(p.w.role),
        partner: p.w.partner,
        inBuildLift: roundN(p.inBuildBlend, 3),
        soloEarly: roundN(p.snapEarly, 3),
        soloCampaign: roundN(p.snapCamp, 3),
        soloMid: roundN(p.w.midAvg, 3),
        soloLateNovice: roundN(p.w.lateNovice, 3),
        soloLateAvg: roundN(p.snapLate, 3),
        soloLateExpert: roundN(p.w.lateExpert, 3),
        soloLate3Tier: roundN(p.soloLate3Tier, 3),
        pressureAvg: roundN(p.pressVal, 3),
        pressureNovice: roundN(p.w.pressureNovice, 3),
        pressureSurvivalGain: roundN(p.w.pressureSurvivalGain, 3),
        shapleyMult: roundN(p.shapVal, 3),
        powerEndMultiple: roundN(p.w.powerEndMultiple, 2),
      },
    };
  });
};

const computeWeaponRoleRollups = (entries: readonly PowerRankEntry[]): RoleRollup[] => {
  const byRole = new Map<WeaponRole, PowerRankEntry[]>();
  for (const e of entries) {
    if (e.meta.kind !== 'weapons') continue;
    const list = byRole.get(e.meta.role) ?? [];
    list.push(e);
    byRole.set(e.meta.role, list);
  }
  const rollups: RoleRollup[] = [];
  for (const roleDef of WEAPON_ROLES) {
    const list = byRole.get(roleDef.id);
    if (!list || !list.length) continue;
    const sorted = [...list].sort((a, b) => b.powerMult - a.powerMult);
    const mults = sorted.map(e => e.powerMult);
    rollups.push({
      role: roleDef.id,
      label: roleDef.label,
      count: sorted.length,
      avgMult: roundN(geoMean(mults), 3),
      medianMult: roundN(quantile(mults, 0.5), 3),
      minMult: sorted[sorted.length - 1].powerMult,
      maxMult: sorted[0].powerMult,
      topId: sorted[0].id,
      topName: sorted[0].name,
      topMult: sorted[0].powerMult,
    });
  }
  return rollups.sort((a, b) => b.avgMult - a.avgMult);
};

const buildEvolutionItems = (
  snapshot: Snapshot,
  analytics: FullBalanceAtlasData
): { items: RawCategoryItem[]; medianChassisLift: number } => {
  const recipes = analytics.pairSuite.recipes;
  const pairByKey = new Map<string, number>();
  const pairsByRecipe = new Map<string, number[]>();

  for (const p of analytics.pairSuite.pairs) {
    const key = p.a < p.b ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
    pairByKey.set(key, p.pairLift);
    for (const rid of p.recipeIds) {
      const list = pairsByRecipe.get(rid) ?? [];
      list.push(p.pairLift);
      pairsByRecipe.set(rid, list);
    }
  }

  // Median universal blank-shell chassis lift across all non-Encore recipes (~1.191)
  const chassisRatios: number[] = [];
  for (const r of recipes) {
    if (r.pair.includes('encore-mask')) continue;
    const tot = snapshot[`recipe:${r.id}`] ?? r.ratio;
    const rule = snapshot[`recipe:${r.id}:ruleLift`] ?? r.ruleLift;
    if (tot > 0 && rule > 0) chassisRatios.push(tot / rule);
  }
  const medianChassisLift = chassisRatios.length ? quantile(chassisRatios, 0.5) : 1.191;

  const prelim = recipes.map(r => {
    const [a, b] = r.pair;
    const canonKey = a < b ? `${a}|${b}` : `${b}|${a}`;
    const armingLifts = pairsByRecipe.get(r.id) ?? [];
    const meanPairLift =
      armingLifts.length > 0
        ? armingLifts.reduce((s, v) => s + v, 0) / armingLifts.length
        : (pairByKey.get(canonKey) ?? 1);

    const hasEncore = r.pair.includes('encore-mask');
    const sTot = snapshot[`recipe:${r.id}`];
    const sRule = snapshot[`recipe:${r.id}:ruleLift`];
    const ruleBlend =
      sRule !== undefined
        ? Math.pow(clampPos(sRule), 0.7) * Math.pow(clampPos(r.ruleLift), 0.3)
        : clampPos(r.ruleLift);
    const totBlend =
      sTot !== undefined
        ? Math.pow(clampPos(sTot), 0.7) * Math.pow(Math.max(1.01, r.ratio), 0.3)
        : Math.max(1.01, r.ratio);

    // Fix Encore Mask denominator artifact: turning evolutions off disables Encore Mask itself
    const cleanTotal = hasEncore ? ruleBlend * medianChassisLift : totBlend;

    const composite =
      Math.pow(cleanTotal, EVOLUTION_COMPOSITE_WEIGHTS.cleanTotal) *
      Math.pow(ruleBlend, EVOLUTION_COMPOSITE_WEIGHTS.ruleLift);
    const buildAround =
      Math.pow(cleanTotal, EVOLUTION_BUILD_AROUND_WEIGHTS.cleanTotal) *
      Math.pow(ruleBlend, EVOLUTION_BUILD_AROUND_WEIGHTS.ruleLift) *
      Math.pow(clampPos(meanPairLift), EVOLUTION_BUILD_AROUND_WEIGHTS.pairOutput);

    return {
      r,
      hasEncore,
      armingPairCount: Math.max(1, armingLifts.length),
      rawTotalLift: sTot ?? r.ratio,
      cleanTotal,
      ruleBlend,
      meanPairLift: clampPos(meanPairLift),
      composite,
      buildAround,
    };
  });

  const minBuildAround = Math.min(...prelim.map(p => p.buildAround));

  const items: RawCategoryItem[] = prelim.map(p => ({
    id: p.r.id,
    name: p.r.name || p.r.id,
    category: 'evolutions',
    lensRaw: {
      composite: p.composite,
      buildAround: p.buildAround,
      ruleLift: p.ruleBlend,
      pairOutput: p.meanPairLift,
    },
    meta: {
      kind: 'evolutions',
      pair: p.r.pair,
      isSignature: p.armingPairCount > 1,
      armingPairCount: p.armingPairCount,
      hasEncoreFix: p.hasEncore,
      rawTotalLift: roundN(p.rawTotalLift, 3),
      cleanTotalLift: roundN(p.cleanTotal, 3),
      ruleLift: roundN(p.ruleBlend, 3),
      meanPairLift: roundN(p.meanPairLift, 3),
      startsPerFight: roundN(p.r.starts, 2),
      ruleFiringsPerFight: roundN(p.r.ruleFirings, 1),
      buildAroundMult: roundN(p.buildAround / minBuildAround, 4),
    },
  }));

  return { items, medianChassisLift: roundN(medianChassisLift, 4) };
};

const buildFighterItems = (analytics: FullBalanceAtlasData): RawCategoryItem[] => {
  const shapByFighter = new Map(analytics.coveringSuite.fighterShapley.map(s => [s.id, s.shapleyMult]));
  const cellsByFighter = new Map<CharacterName, typeof analytics.fighterSuite.cells>();
  for (const cell of analytics.fighterSuite.cells) {
    const list = cellsByFighter.get(cell.fighter) ?? [];
    list.push(cell);
    cellsByFighter.set(cell.fighter, list);
  }
  const arcanaByFighter = new Map<CharacterName, typeof analytics.arcanaSuite.fighterArcana>();
  for (const fa of analytics.arcanaSuite.fighterArcana) {
    const list = arcanaByFighter.get(fa.fighter) ?? [];
    list.push(fa);
    arcanaByFighter.set(fa.fighter, list);
  }

  return analytics.fighterSuite.curves.map(c => {
    const shap = clampPos(shapByFighter.get(c.fighter) ?? 1);
    const cells = cellsByFighter.get(c.fighter) ?? [];
    const withWeapons90 = cells.length ? geoMean(cells.map(x => Math.max(0.1, x.totalLift))) : 1;
    const p160 = clampPos(c.pressure160Stars);
    const p160Surv = clampPos(p160 * (0.65 + 0.35 * Math.min(1, Math.max(0, c.pressureSurvival160))));
    const d160 = clampPos(c.dummy160Stars);

    const composite =
      Math.pow(shap, FIGHTER_COMPOSITE_WEIGHTS.shapley) *
      Math.pow(withWeapons90, FIGHTER_COMPOSITE_WEIGHTS.withWeapons90) *
      Math.pow(p160Surv, FIGHTER_COMPOSITE_WEIGHTS.pressure160Surv) *
      Math.pow(d160, FIGHTER_COMPOSITE_WEIGHTS.dummy160);

    const topWeaponSynergies = [...cells]
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, 3)
      .map(x => ({
        weaponId: x.weaponId,
        affinity: roundN(x.affinity, 2),
        totalLift: roundN(x.totalLift, 2),
      }));
    const topArcana = [...(arcanaByFighter.get(c.fighter) ?? [])]
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, 2)
      .map(x => ({
        arcanaId: x.arcanaId,
        affinity: roundN(x.affinity, 2),
        effectiveLift: roundN(x.effectiveLift, 2),
      }));

    return {
      id: c.fighter,
      name: c.fighter,
      category: 'fighters',
      lensRaw: {
        composite,
        fullBuild: shap,
        pressure160: p160,
        dummy160: d160,
        withWeapons90,
      },
      meta: {
        kind: 'fighters',
        passives: c.passives,
        blurb: c.blurb,
        dummy0Stars: roundN(c.dummy0Stars, 3),
        dummy60Stars: roundN(c.dummy60Stars, 3),
        dummy160Stars: roundN(c.dummy160Stars, 3),
        pressure0Stars: roundN(c.pressure0Stars, 3),
        pressure60Stars: roundN(c.pressure60Stars, 3),
        pressure160Stars: roundN(c.pressure160Stars, 3),
        pressureSurvival160: roundN(c.pressureSurvival160, 3),
        withWeapons90Mean: roundN(withWeapons90, 3),
        shapleyMult: roundN(shap, 3),
        topWeaponSynergies,
        topArcana,
      },
    };
  });
};

const buildArcanaItems = (analytics: FullBalanceAtlasData): RawCategoryItem[] => {
  const shapById = new Map(analytics.coveringSuite.arcanaShapley.map(s => [s.id, s.shapleyMult]));
  return analytics.arcanaSuite.solo.map(a => {
    const effAvg = clampPos(a.effectiveLiftAvg);
    const effAvgSurv = clampPos(effAvg * (0.7 + 0.3 * Math.min(1, Math.max(0, a.survivalRateAvg))));
    const effExp = Math.max(0.2, a.effectiveLiftExpert);
    const shap = clampPos(shapById.get(a.id) ?? 1);

    const composite =
      Math.pow(effAvgSurv, ARCANA_COMPOSITE_WEIGHTS.effectiveAvgSurv) *
      Math.pow(effExp, ARCANA_COMPOSITE_WEIGHTS.effectiveExpert) *
      Math.pow(shap, ARCANA_COMPOSITE_WEIGHTS.shapley);

    return {
      id: a.id,
      name: a.name,
      category: 'arcana',
      lensRaw: {
        composite,
        effectiveAvg: effAvg,
        effectiveExpert: effExp,
        shapley: shap,
      },
      meta: {
        kind: 'arcana',
        numeral: a.numeral,
        upside: a.upside,
        tradeoff: a.tradeoff,
        foeHpScale: a.foeHpScale,
        effectiveLiftNovice: roundN(a.effectiveLiftNovice, 3),
        effectiveLiftAvg: roundN(a.effectiveLiftAvg, 3),
        effectiveLiftExpert: roundN(a.effectiveLiftExpert, 3),
        survivalRateAvg: roundN(a.survivalRateAvg, 3),
        shapleyMult: roundN(shap, 3),
      },
    };
  });
};

// ─── Main Public Entry Point ─────────────────────────────────────────────────

export const computePowerRankings = (input: PowerRankInput): PowerRankReport => {
  const priorK = input.priorK ?? EMPIRICAL_BAYES_PRIOR_K;
  const rawMode = input.mode ?? input.posthog?.mode;
  const mode: FightModeFilter = rawMode && rawMode !== 'all' ? rawMode : 'adventure';
  const ledger = input.posthog?.audit ?? input.posthog?.ledger ?? null;
  const eraContext: EraContext = input.eraContext ?? {
    currentEraId: CURRENT_BALANCE_ERA.id,
    currentEraMinVersion: CURRENT_BALANCE_ERA.minVersion,
    appVersion: BALANCE_ERA_MANIFEST.currentAppVersion,
    getMinValidVersion: (cat, itemId, m) => getMinValidVersion(cat, itemId, (m as FightModeFilter | undefined) ?? mode),
  };

  const weaponItems = buildWeaponItems(input.snapshot, input.analytics);
  const { items: evoItems, medianChassisLift } = buildEvolutionItems(input.snapshot, input.analytics);
  const fighterItems = buildFighterItems(input.analytics);
  const arcanaItems = buildArcanaItems(input.analytics);

  const wLens = normalizeLens('weapons', input.lenses?.weapons);
  const eLens = normalizeLens('evolutions', input.lenses?.evolutions);
  const fLens = normalizeLens('fighters', input.lenses?.fighters);
  const aLens = normalizeLens('arcana', input.lenses?.arcana);

  const weapons = buildCategoryRanking(
    'weapons',
    wLens,
    weaponItems,
    extractSignalsMap(input.posthog, 'weapons'),
    priorK,
    mode,
    eraContext
  );
  weapons.roleRollups = computeWeaponRoleRollups(weapons.entries);

  const evolutions = buildCategoryRanking(
    'evolutions',
    eLens,
    evoItems,
    extractSignalsMap(input.posthog, 'evolutions'),
    priorK,
    mode,
    eraContext
  );
  const fighters = buildCategoryRanking(
    'fighters',
    fLens,
    fighterItems,
    extractSignalsMap(input.posthog, 'fighters'),
    priorK,
    mode,
    eraContext
  );
  const arcana = buildCategoryRanking(
    'arcana',
    aLens,
    arcanaItems,
    extractSignalsMap(input.posthog, 'arcana'),
    priorK,
    mode,
    eraContext
  );

  const categories: Record<PowerCategory, CategoryRanking> = { weapons, evolutions, fighters, arcana };
  const hasLiveData =
    weapons.liveObservedCount +
      evolutions.liveObservedCount +
      fighters.liveObservedCount +
      arcana.liveObservedCount >
    0;

  // Global & per-item divergence alerts
  const alerts: DivergenceAlert[] = [];
  if (ledger && ledger.droppedByVersion > 0 && ledger.kept === 0) {
    alerts.push({
      kind: 'STALE_DATA',
      category: 'global',
      severity: 'warn',
      detail: `All ${ledger.droppedByVersion} PostHog fights were excluded by balance-era minVersion ${ledger.activeMinVersion} (era ${ledger.currentEraId}); rankings fell back to simulation priors.`,
    });
  }
  if (
    eraContext.currentEraMinVersion &&
    input.analytics.version &&
    compareSemver(input.analytics.version, eraContext.currentEraMinVersion) < 0
  ) {
    alerts.push({
      kind: 'STALE_DATA',
      category: 'global',
      severity: 'info',
      detail: `balance-analytics.json is stamped v${input.analytics.version} (generated ${input.analytics.generatedAt}) while current era ${eraContext.currentEraId} starts at v${eraContext.currentEraMinVersion}. If regenerated immediately before the patch bump this is cosmetic; otherwise re-run \`npm run balance:atlas\`.`,
    });
  }

  for (const cat of Object.values(categories)) {
    for (const entry of cat.entries) {
      for (const a of entry.alerts) alerts.push(a);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    simAnalyticsVersion: input.analytics.version,
    simAnalyticsGeneratedAt: input.analytics.generatedAt,
    appVersion: eraContext.appVersion ?? null,
    mode,
    hasLiveData,
    currentEraId: ledger?.currentEraId ?? eraContext.currentEraId ?? null,
    currentEraMinVersion: ledger?.activeMinVersion ?? eraContext.currentEraMinVersion ?? null,
    medianChassisLift,
    priorK,
    auditLedger: ledger,
    alerts,
    categories,
  };
};

// ─── Query & Comparison Helpers ──────────────────────────────────────────────

const normQuery = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

export const findItemInReport = (
  report: PowerRankReport,
  query: string,
  category?: PowerCategory
): PowerRankEntry | undefined => {
  const qRaw = query.trim().toLowerCase();
  const qNorm = normQuery(query);
  const pools: CategoryRanking[] = category ? [report.categories[category]] : Object.values(report.categories);

  for (const pool of pools) {
    const exact = pool.entries.find(e => e.id.toLowerCase() === qRaw || e.name.toLowerCase() === qRaw);
    if (exact) return exact;
  }
  for (const pool of pools) {
    const normalized = pool.entries.find(e => normQuery(e.id) === qNorm || normQuery(e.name) === qNorm);
    if (normalized) return normalized;
  }
  for (const pool of pools) {
    const partial = pool.entries.find(e => normQuery(e.id).includes(qNorm) || normQuery(e.name).includes(qNorm));
    if (partial) return partial;
  }
  return undefined;
};

export const compareItems = (
  report: PowerRankReport,
  queryA: string,
  queryB: string
): ComparisonResult | null => {
  const a = findItemInReport(report, queryA);
  if (!a) return null;
  const b = findItemInReport(report, queryB, a.category);
  if (!b) return null;
  const subLensRatios: Record<string, number> = {};
  for (const k of Object.keys(a.subLenses)) {
    const va = a.subLenses[k];
    const vb = b.subLenses[k];
    if (va > 0 && vb > 0) subLensRatios[k] = roundN(va / vb, 3);
  }
  return {
    category: a.category,
    a,
    b,
    ratioAOverB: roundN(a.powerMult / Math.max(1e-6, b.powerMult), 3),
    rankDelta: b.rank - a.rank,
    subLensRatios,
  };
};

// ─── Renderers (Markdown & Compact CLI) ──────────────────────────────────────

const fx = (n: number | null | undefined): string => (n !== null && n !== undefined && Number.isFinite(n) ? `${n.toFixed(2)}×` : '—');
const fpct = (n: number | null | undefined): string =>
  n !== null && n !== undefined && Number.isFinite(n) ? `${Math.round(n * 100)}%` : '—';

export interface RenderMarkdownOptions {
  categories?: readonly PowerCategory[];
  top?: number;
  bottom?: number;
  role?: WeaponRole;
  includeAllEvolutions?: boolean;
  includeArcana?: boolean;
  includeMethodology?: boolean;
}

const renderLiveColumns = (e: PowerRankEntry): string[] => {
  const ci = e.ciLow !== null && e.ciHigh !== null ? `${e.ciLow.toFixed(2)}–${e.ciHigh.toFixed(2)}×` : '—';
  const tags = e.alerts.map(a => a.kind).join(', ') || '—';
  return [
    fx(e.simMult),
    fx(e.liveMult),
    ci,
    `${e.fights} (${e.credibility})`,
    e.funCount > 0 ? `${fpct(e.funRate)} (${e.funCount})` : '—',
    tags,
  ];
};

const sliceEntries = (
  entries: readonly PowerRankEntry[],
  top?: number,
  bottom?: number
): { shown: PowerRankEntry[]; truncated: boolean } => {
  if (!top && !bottom) return { shown: [...entries], truncated: false };
  const t = top ?? 0;
  const b = bottom ?? 0;
  if (t + b >= entries.length) return { shown: [...entries], truncated: false };
  const head = t > 0 ? entries.slice(0, t) : [];
  const tail = b > 0 ? entries.slice(-b) : [];
  return { shown: [...head, ...tail], truncated: true };
};

export const renderPowerRankMarkdown = (
  report: PowerRankReport,
  opts: RenderMarkdownOptions = {}
): string => {
  const out: string[] = [];
  const row = (cells: (string | number)[]) => out.push(`| ${cells.join(' | ')} |`);
  const cats: readonly PowerCategory[] =
    opts.categories ?? (opts.includeArcana ? ['weapons', 'evolutions', 'fighters', 'arcana'] : ['weapons', 'evolutions', 'fighters']);
  const includeAllEvos = opts.includeAllEvolutions ?? true;
  const includeMethodology = opts.includeMethodology ?? true;

  out.push('# NShapes Power Rankings (`1.00×` Weakest-Anchored)', '');
  out.push(
    `Generated by \`npm run balance:power\` (see [balance-system.md](./balance-system.md) & [analytics.md](./analytics.md)). Every item in a category is expressed as a multiplier over the **weakest item in that category (\`1.00×\`)**.`,
    ''
  );
  out.push(
    `- **App / Sim Data:** ${report.appVersion ? `v${report.appVersion}` : `sim v${report.simAnalyticsVersion}`} (atlas generated \`${report.simAnalyticsGeneratedAt}\`) | **Mode:** \`${report.mode}\``
  );
  out.push(
    `- **Balance Era:** \`${report.currentEraId ?? 'unknown'}\` (PostHog valid-from \`>= v${report.currentEraMinVersion ?? 'n/a'}\`) | **Telemetry Mode:** ${
      report.hasLiveData ? '**Blended (Simulation Prior + PostHog Empirical Bayes)**' : '**Simulation-Only** *(no era-valid PostHog telemetry loaded; pass `--live` or `--posthog <file>` to blend)*'
    }`
  );
  if (report.auditLedger) {
    const l = report.auditLedger;
    out.push(
      `- **PostHog Filter Audit:** ${l.kept} kept / ${l.totalRaw} raw (dropped: ${l.droppedByVersion} stale-era, ${l.droppedByEnv} dev-env, ${l.droppedByMode} other-mode, ${l.droppedByPractice} practice, ${l.droppedByBug} bug-tagged, ${l.droppedByShort} short, ${l.droppedByCoached} coached; ${l.deduped} deduped, ${l.ratedFolds} \`fight_rated\` folds)`
    );
  }
  out.push('');

  // Executive Summary
  out.push('## Executive Summary', '');
  row(['Category', 'Items', 'Active Lens', 'Weakest (`1.00×`)', 'Median', 'P90', 'Strongest', 'Added-Power Span']);
  row(['---', '---', '---', '---', '---', '---', '---', '---']);
  for (const c of cats) {
    const cr = report.categories[c];
    row([
      `**${c[0].toUpperCase() + c.slice(1)}**`,
      cr.count,
      `\`${cr.lens}\``,
      `${cr.weakestName} (\`1.00×\`)`,
      fx(cr.medianMult),
      fx(cr.p90Mult),
      `${cr.strongestName} (**${fx(cr.maxMult)}**)`,
      cr.maxAddedMult !== null ? `1.00× – ${fx(cr.maxAddedMult)}` : '—',
    ]);
  }
  out.push('');

  // Divergence & Freshness Alerts (scoped to requested categories + global alerts)
  const catSet = new Set<string>(cats);
  const itemAlerts = report.alerts.filter(a => a.kind !== 'STALE_DATA' && (a.category === 'global' || catSet.has(a.category)));
  const staleAlerts = report.alerts.filter(a => a.kind === 'STALE_DATA');
  if (itemAlerts.length || staleAlerts.length) {
    out.push('## Diagnostics & Divergence Alerts', '');
    for (const a of [...staleAlerts, ...itemAlerts]) {
      const tag = a.itemName ? `\`${a.kind}\` **${a.itemName}** (${a.category})` : `\`${a.kind}\``;
      out.push(`- ${tag}: ${a.detail}`);
    }
    out.push('');
  }

  // ── WEAPONS ───────────────────────────────────────────────────────────────
  if (cats.includes('weapons')) {
    const cr = report.categories.weapons;
    const filtered = opts.role
      ? cr.entries.filter(e => e.meta.kind === 'weapons' && e.meta.role === opts.role)
      : cr.entries;
    const { shown } = sliceEntries(filtered, opts.top, opts.bottom);

    out.push(`## Weapons (${filtered.length}${opts.role ? ` in role \`${opts.role}\`` : ''} · Lens: \`${cr.lens}\`)`, '');
    out.push(
      `Composite index \`W8\` = \`inBuild^0.55 · soloLate3T^0.15 · pressure^0.15 · campaign^0.05 · shapley^0.10\` (partner-safe for \`understudy\` & \`encore-mask\`). Weakest = **${cr.weakestName} (\`1.00×\`)**, Strongest = **${cr.strongestName} (${fx(cr.maxMult)})**.`,
      ''
    );

    if (cr.roleRollups && !opts.role) {
      out.push('### Role Averages', '');
      row(['Role', 'Weapons', 'Geom Mean', 'Median', 'Range', 'Top Weapon']);
      row(['---', '---', '---', '---', '---', '---']);
      for (const rr of cr.roleRollups) {
        row([rr.label, rr.count, `**${fx(rr.avgMult)}**`, fx(rr.medianMult), `${fx(rr.minMult)} – ${fx(rr.maxMult)}`, `${rr.topName} (${fx(rr.topMult)})`]);
      }
      out.push('');
    }

    const liveHeaders = report.hasLiveData ? ['Sim', 'Live', '95% CI', 'Fights (Tier)', 'Fun 👍', 'Flags'] : [];
    row(['#', 'Weapon', 'Role', 'Power', 'Added', 'In-Build', 'Solo 3T', 'Pressure', 'Shapley', ...liveHeaders]);
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---', ...liveHeaders.map(() => '---')]);
    for (const e of shown) {
      const m = e.meta as WeaponEntryMeta;
      row([
        e.rank,
        `${e.name}${m.partner ? ' *' : ''}`,
        m.role,
        `**${fx(e.powerMult)}**`,
        fx(e.addedMult),
        `${fx(e.subLenses.inBuild)} (${m.inBuildLift.toFixed(2)})`,
        m.partner ? 'partner' : `${fx(e.subLenses.solo)} (${m.soloLate3Tier.toFixed(2)})`,
        m.partner ? 'partner' : `${fx(e.subLenses.pressure)} (${m.pressureAvg.toFixed(2)})`,
        `${fx(e.subLenses.shapley)} (${m.shapleyMult.toFixed(2)})`,
        ...(report.hasLiveData ? renderLiveColumns(e) : []),
      ]);
    }
    out.push('', '*\\* Partner-only weapons (`understudy`, `encore-mask`) cannot trigger alone; composite imputes solo/pressure/campaign neutrally from their in-build rank.*', '');
  }

  // ── EVOLUTIONS ────────────────────────────────────────────────────────────
  if (cats.includes('evolutions')) {
    const cr = report.categories.evolutions;
    out.push(`## Evolutions (${cr.count} · Lens: \`${cr.lens}\`)`, '');
    out.push(
      `Default lens \`composite\` (\`E7\`) measures **Pure Evolution Upgrade Power** = \`cleanTotal^0.55 · ruleLift^0.45\` (free of carrier-weapon confounding, with Encore Mask pairs adjusted via median universal chassis lift \`×${report.medianChassisLift.toFixed(3)}\` so turning evolutions off never inflates them). **Build-Around (\`E8\`)** adds 25% weight on total armed-pair combat output (\`pairLift\`).`,
      ''
    );

    const liveHeaders = report.hasLiveData ? ['Sim', 'Live', '95% CI', 'Fights (Tier)', 'Fun 👍', 'Flags'] : [];
    const renderEvoTable = (rows: readonly PowerRankEntry[]) => {
      row(['#', 'Evolution', 'Pair', 'Power', 'Added', 'Build-Around (E8)', 'Clean Lift', 'Rule Lift', 'Pair Lift', 'Starts', ...liveHeaders]);
      row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', ...liveHeaders.map(() => '---')]);
      for (const e of rows) {
        const m = e.meta as EvolutionEntryMeta;
        const badge = `${m.isSignature ? ' ★' : ''}${m.hasEncoreFix ? ' †' : ''}`;
        row([
          e.rank,
          `${e.name}${badge}`,
          `\`${m.pair.join(' + ')}\``,
          `**${fx(e.powerMult)}**`,
          fx(e.addedMult),
          fx(m.buildAroundMult),
          `×${m.cleanTotalLift.toFixed(2)}`,
          `×${m.ruleLift.toFixed(2)}`,
          `×${m.meanPairLift.toFixed(2)}`,
          m.startsPerFight.toFixed(1),
          ...(report.hasLiveData ? renderLiveColumns(e) : []),
        ]);
      }
    };

    if (opts.top || opts.bottom) {
      const { shown } = sliceEntries(cr.entries, opts.top, opts.bottom);
      renderEvoTable(shown);
      out.push('');
    } else {
      out.push('### Top 25 Evolutions (Pure Evolution Power)', '');
      renderEvoTable(cr.entries.slice(0, 25));
      out.push('', '### Top 10 Build-Around Evolutions (`E8`: Recipe Lift + Armed Pair Ceiling)', '');
      const topBuildAround = [...cr.entries]
        .sort((a, b) => (b.meta as EvolutionEntryMeta).buildAroundMult - (a.meta as EvolutionEntryMeta).buildAroundMult)
        .slice(0, 10);
      row(['E8 #', 'Evolution', 'Pair', 'Build-Around (E8)', 'Pure Evo (E7)', 'Pair Lift', 'Rule Lift']);
      row(['---', '---', '---', '---', '---', '---', '---']);
      topBuildAround.forEach((e, idx) => {
        const m = e.meta as EvolutionEntryMeta;
        row([idx + 1, `${e.name}${m.isSignature ? ' ★' : ''}`, `\`${m.pair.join(' + ')}\``, `**${fx(m.buildAroundMult)}**`, fx(e.powerMult), `×${m.meanPairLift.toFixed(2)}`, `×${m.ruleLift.toFixed(2)}`]);
      });

      out.push('', '### Bottom 15 Evolutions', '');
      renderEvoTable(cr.entries.slice(-15));
      out.push('');

      if (includeAllEvos) {
        out.push(`<details><summary>Complete All ${cr.count} Evolutions Ranked (1.00× – ${fx(cr.maxMult)})</summary>`, '');
        renderEvoTable(cr.entries);
        out.push('', '</details>', '');
      }
    }
    out.push('*★ Signature family recipe (arms from multiple pairs; Pair Lift averaged across arming pairs). † Encore Mask recipe (Clean Lift computed as `ruleLift × medianChassisLift` to remove the evolutions-off denominator artifact).*', '');
  }

  // ── FIGHTERS ──────────────────────────────────────────────────────────────
  if (cats.includes('fighters')) {
    const cr = report.categories.fighters;
    const { shown } = sliceEntries(cr.entries, opts.top, opts.bottom);
    out.push(`## Fighters (${cr.count} · Lens: \`${cr.lens}\`)`, '');
    out.push(
      `Composite index \`F7\` = \`fullBuildShapley^0.30 · withWeapons90^0.25 · (pressure160 · (0.65 + 0.35·surv))^0.25 · dummy160^0.20\`. Weakest = **${cr.weakestName} (\`1.00×\`)**, Strongest = **${cr.strongestName} (${fx(cr.maxMult)})**.`,
      ''
    );

    const liveHeaders = report.hasLiveData ? ['Sim', 'Live', '95% CI', 'Fights (Tier)', 'Fun 👍', 'Flags'] : [];
    row(['#', 'Fighter', 'Power', 'Added', 'Full-Build Shapley', '90★ + Weapon', '160★ Pressure', '160★ Dummy', 'Surv (160★)', 'Top Weapon Synergies', ...liveHeaders]);
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', ...liveHeaders.map(() => '---')]);
    for (const e of shown) {
      const m = e.meta as FighterEntryMeta;
      const syns = m.topWeaponSynergies.map(s => `\`${s.weaponId}\` (${s.affinity.toFixed(2)}×)`).join(', ');
      row([
        e.rank,
        `**${e.name}**`,
        `**${fx(e.powerMult)}**`,
        fx(e.addedMult),
        `${fx(e.subLenses.fullBuild)} (${m.shapleyMult.toFixed(3)})`,
        `${fx(e.subLenses.withWeapons90)} (×${m.withWeapons90Mean.toFixed(2)})`,
        `${fx(e.subLenses.pressure160)} (×${m.pressure160Stars.toFixed(2)})`,
        `${fx(e.subLenses.dummy160)} (×${m.dummy160Stars.toFixed(2)})`,
        fpct(m.pressureSurvival160),
        syns || '—',
        ...(report.hasLiveData ? renderLiveColumns(e) : []),
      ]);
    }
    out.push(
      '',
      '> **Fighter simulation nuances & data gaps to keep in mind:**',
      '> - **Full-build compression:** Inside a maxed 5-charm + 2-Arcana + Power-ON build (`fullBuild` lens), weapons & Power carry ~85% of output, compressing fighters to a tight `1.00× – 1.22×` band (`Pelican` #1 at `1.22×`, `Orange Tabby` #6 at `1.00×`).',
      '> - **Pelican 90★ vs 160★ capstone jump:** `fighterSuite.cells` evaluates with-weapon performance at 90★ (below the World 4 `SEALED_AT` capstone gate), where Pelican is #6 (`4.24×`), before jumping to `8.11×` at 160★ and `#1` in endgame Shapley (`1.112`).',
      '> - **Sly Fox speed-vs-survival tradeoff:** Sly Fox leads unarmed 160★ Pressure damage (`×9.47`) on fast 3-trait boards where its 5s combo chains, yet dies in 50% of Pressure fights and falls to #6 (`×2.19`) on slower 5-trait calm boards.',
      '> - **Current fighter sim gaps:** `balance-snapshot.json` does not yet track fighters, and `fighterSuite.curves` runs average-bot only (6 seeds, unarmed). Live PostHog data with Simpson-adjusted win/DPM deltas will be especially valuable here.',
      ''
    );
  }

  // ── ARCANA (OPTIONAL) ─────────────────────────────────────────────────────
  if (cats.includes('arcana')) {
    const cr = report.categories.arcana;
    const { shown } = sliceEntries(cr.entries, opts.top, opts.bottom);
    out.push(`## Arcana (${cr.count} · Lens: \`${cr.lens}\`)`, '');
    const liveHeaders = report.hasLiveData ? ['Sim', 'Live', '95% CI', 'Fights (Tier)', 'Fun 👍', 'Flags'] : [];
    row(['#', 'Arcana', 'Power', 'Added', 'Avg Eff Lift', 'Expert Lift', 'Surv', 'Shapley', 'Foe HP', ...liveHeaders]);
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---', ...liveHeaders.map(() => '---')]);
    for (const e of shown) {
      const m = e.meta as ArcanaEntryMeta;
      row([
        e.rank,
        `${m.numeral} ${e.name}`,
        `**${fx(e.powerMult)}**`,
        fx(e.addedMult),
        `×${m.effectiveLiftAvg.toFixed(2)}`,
        `×${m.effectiveLiftExpert.toFixed(2)}`,
        fpct(m.survivalRateAvg),
        `${fx(e.subLenses.shapley)} (${m.shapleyMult.toFixed(2)})`,
        `×${m.foeHpScale.toFixed(2)}`,
        ...(report.hasLiveData ? renderLiveColumns(e) : []),
      ]);
    }
    out.push('');
  }

  if (includeMethodology) {
    out.push(
      '## Methodology Appendix',
      '',
      '1. **Why Positive-Anchored Geometric Composites (`P_i / P_min`):** Every component is a strictly positive damage multiplier ratio (`> 0`). A weighted geometric mean preserves multiplicative symmetry, guarantees zero division-by-zero or negative singularities, and resists Monte Carlo noise in the weakest item.',
      '2. **Primary (`Power`) vs Secondary (`Added`):** `Power = P_i / P_min` answers *"how many times more total combat output does a fight/build get with X vs the weakest item?"*. `Added = ln(P_i) / ln(P_min)` (shown whenever `P_min >= 1.05`) has identical rank order and answers *"how many times more bonus power above bare baseline does X add?"*.',
      `3. **PostHog Empirical Bayes Blending:** Live fight events are filtered by \`src/analytics/balanceEras.json\` + \`src/analytics/posthogRules.ts\` (numeric semver \`>= minValidVersion\`, \`env='prod'\`, mode isolation, no practice/bug/short/coached runs, \`fight_id\` dedup, player-weight cap, leave-one-out Simpson's-paradox level stratification, L2 Ridge co-occurrence debiasing). Live log-lift residuals shrink toward the simulation prior with \`w_live = effectiveN / (effectiveN + ${report.priorK})\`: \`P_blend = P_sim × exp(w_live × liveLogLift)\`, then re-anchored to \`1.00×\`.`,
      '4. **Re-running on demand:** `npm run balance:power` (sim-only), `npm run balance:power -- --live` (pulls PostHog if `POSTHOG_PERSONAL_API_KEY` is set), `npm run balance:power -- --compare blast-powder,chrono-shard`, `npm run balance:power -- --category evolutions --lens buildAround --top 15`.',
      ''
    );
  }

  return out.join('\n');
};

export const renderPowerRankCompact = (
  report: PowerRankReport,
  opts: { categories?: readonly PowerCategory[]; top?: number; bottom?: number; role?: WeaponRole } = {}
): string => {
  const cats = opts.categories ?? (['weapons', 'evolutions', 'fighters'] as const);
  const topN = opts.top ?? 10;
  const botN = opts.bottom ?? 5;
  const lines: string[] = [];
  lines.push(
    `NShapes Power Rankings (era=${report.currentEraId ?? 'n/a'}, minVer=${report.currentEraMinVersion ?? 'n/a'}, live=${report.hasLiveData ? 'blended' : 'sim-only'})`
  );
  for (const c of cats) {
    const cr = report.categories[c];
    const pool =
      c === 'weapons' && opts.role
        ? cr.entries.filter(e => e.meta.kind === 'weapons' && e.meta.role === opts.role)
        : cr.entries;
    lines.push(`\n[${c.toUpperCase()} | lens=${cr.lens} | n=${pool.length} | span 1.00x .. ${cr.maxMult.toFixed(2)}x]`);
    const head = pool.slice(0, Math.min(topN, pool.length));
    for (const e of head) {
      const add = e.addedMult !== null ? ` (added ${e.addedMult.toFixed(2)}x)` : '';
      const live = e.fights > 0 ? ` | live ${fx(e.liveMult)} n=${e.fights}` : '';
      lines.push(`  #${String(e.rank).padStart(3)} ${e.id.padEnd(24)} ${e.powerMult.toFixed(2)}x${add}${live}`);
    }
    if (pool.length > topN && botN > 0) {
      lines.push('  ...');
      for (const e of pool.slice(-Math.min(botN, pool.length - topN))) {
        const add = e.addedMult !== null ? ` (added ${e.addedMult.toFixed(2)}x)` : '';
        const live = e.fights > 0 ? ` | live ${fx(e.liveMult)} n=${e.fights}` : '';
        lines.push(`  #${String(e.rank).padStart(3)} ${e.id.padEnd(24)} ${e.powerMult.toFixed(2)}x${add}${live}`);
      }
    }
  }
  return lines.join('\n') + '\n';
};
