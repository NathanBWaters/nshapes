/**
 * Machine-enforced PostHog telemetry analysis rules for NShapes balance evaluation.
 *
 * Pure and React-Native-safe so CLI tools (`balance:power`), `/dev/analytics`,
 * and PostHog HogQL dashboards (`posthogDashboards.ts`) all enforce the EXACT
 * same validity, hygiene, confounding, and credibility rules.
 *
 * Key statistical safeguards:
 *  1. Numeric semver version-era filtering (global + per-item `getMinValidVersion`).
 *  2. Environment (`env = 'prod'`), mode isolation, practice/sandbox exclusion,
 *     `bug_in_game` exclusion, `fight_id` dedup + retrospective `fight_rated` folding,
 *     non-trivial engagement floor (`sets >= 3`, `duration_ms >= 10s`), tutorial `1-1`
 *     & high-coaching (`helped_sets / sets > 0.5`) exclusion, and legacy weapon ID resolution.
 *  3. Player concentration control (`1 / sqrt(playerItemFights)` + per-player max share cap
 *     + Kish effective sample size `effectiveN`).
 *  4. Leave-one-out Simpson's-Paradox stratification across `(level_id, era)` in Adventure
 *     or `(spire_act, spire_node_kind, ascension)` in Starfall Summit.
 *  5. Evolution survivorship control (forged evolutions are benchmarked strictly against
 *     the `evolutions > 0` cohort of fights that lasted long enough to forge a Catalyst).
 *  6. L2-regularized Ridge regression co-occurrence de-biasing (Cholesky solver) when
 *     valid decided sample size supports it (`N >= 80`).
 *  7. Credibility gates (`sim_only`, `exploratory`, `emerging`, `credible`) and
 *     natural-log-calibrated `liveLogLift` + `liveLogLiftSE` for Empirical Bayes blending.
 */
import { resolveLegacyWeapon } from '@/adventure/data/armory';
import { MAIN_LEVELS } from '@/adventure/data/levels';
import {
  BALANCE_ERAS,
  CURRENT_BALANCE_ERA,
  CURRENT_BALANCE_ERA_ID,
  compareSemver,
  getEraById,
  getEraForVersion,
  getMinValidVersion,
  isVersionAtLeast,
  semverToNumeric,
  type BalanceCategory,
  type BalanceEra,
  type FightModeFilter,
} from './balanceEras';

export type CredibilityTier = 'sim_only' | 'exploratory' | 'emerging' | 'credible';

export interface PostHogFilterOptions {
  /** Game mode to isolate (default `'adventure'`). Use `'all'` only for cross-mode inspection. */
  mode?: FightModeFilter | 'all';
  /** Allow `env !== 'prod'` events (default `false`). */
  includeDev?: boolean;
  /** Balance era scope: `'current'` (default), `'all'`, or a specific era id like `'E8'`. */
  eraId?: string | 'current' | 'all';
  /** Explicit minimum `app_version` override (takes precedence over `eraId` when set). */
  minVersionOverride?: string | null;
  /** Exclude `practice === true` and `outcome === 'practice'` (default `true`). */
  excludePractice?: boolean;
  /** Exclude fights tagged with `'bug_in_game'` (default `true`). */
  excludeBugTagged?: boolean;
  /** Minimum Sets matched for non-trivial engagement (default `3`). */
  minSets?: number;
  /** Minimum fight duration in ms (default `10_000`). */
  minDurationMs?: number;
  /** Exclude scripted walkthrough level `'1-1'` in Adventure (default `true`). */
  excludeTutorial11?: boolean;
  /** Maximum fraction of Sets that were hint/coach-assisted in Adventure (default `0.5`). */
  maxHelpedSetRatio?: number;
  /** Cap any single player's contribution to an item's weighted sample (default `0.25`). */
  maxPlayerWeightShare?: number;
  /** Enforce granular per-item `getMinValidVersion` on top of the global floor (default `true`). */
  usePerItemMinVersion?: boolean;
  /**
   * Low-sample solo playtester mode: uses uniform fight weights (`w = 1`, `effectiveN = fights`),
   * player-count-free credibility tiers (`exploratory` 1–2, `emerging` 3–9, `credible` >=10),
   * tighter low-N `liveLogLift` clamp (`±0.50` for `fights < 10`), and filters automated Playwright
   * E2E bot signatures when combined with `includeDev: true`. Keeps `env = 'prod'` by default.
   */
  soloTester?: boolean;
  /** Custom era table (primarily for unit tests). */
  eras?: readonly BalanceEra[];
}

export interface PostHogAuditLedger {
  totalRaw: number;
  deduped: number;
  ratedFolds: number;
  kept: number;
  droppedByVersion: number;
  droppedByEnv: number;
  droppedByMode: number;
  droppedByPractice: number;
  droppedByE2eBot: number;
  droppedByBug: number;
  droppedByShort: number;
  droppedByCoached: number;
  activeMinVersion: string;
  currentEraId: string;
}

export interface ValidatedFightRecord {
  fightId: string;
  distinctId: string;
  timestampMs: number;
  appVersion: string | null;
  eraId: string | null;
  env: string;
  mode: FightModeFilter;
  levelId: string;
  levelOrder: number;
  world: number;
  boss: boolean;
  practice: boolean;
  spireAct: number | null;
  spireFloor: number | null;
  spireAscension: number | null;
  spireNodeKind: string | null;
  fighter: string;
  outcome: 'won' | 'survived' | 'lost' | 'practice' | 'left';
  durationMs: number;
  damage: number;
  dpm: number;
  sets: number;
  mistakes: number;
  helpedSets: number;
  hintsUsed: number;
  gracesUsed: number;
  medianFindMs: number | null;
  maxDroughtMs: number;
  evolutionsCount: number;
  weapons: string[];
  weaponsOffered: string[];
  weaponsPicked: string[];
  weaponsBought: string[];
  evolutionsForged: string[];
  arcana: string[];
  funRating: 'up' | 'down' | null;
  funTags: string[];
}

export interface LiveItemSignal {
  id: string;
  category: BalanceCategory;
  validSince: string;
  fights: number;
  effectiveN: number;
  uniquePlayers: number;
  winRate: number | null;
  expectedWinRate: number | null;
  adjustedWinDelta: number | null;
  ridgeWinDelta: number | null;
  logDpmDelta: number | null;
  ridgeLogDpmDelta: number | null;
  /** Composite log-scale residual centered at 0, combining adjusted/ridge win + log-DPM. */
  liveLogLift: number;
  liveLogLiftSE: number | null;
  pickRate: number | null;
  funRate: number | null;
  funCount: number;
  credibility: CredibilityTier;
}

export interface PostHogBalanceSignals {
  audit: PostHogAuditLedger;
  mode: FightModeFilter | 'all';
  soloTester?: boolean;
  weapons: Record<string, LiveItemSignal>;
  evolutions: Record<string, LiveItemSignal>;
  fighters: Record<string, LiveItemSignal>;
  arcana: Record<string, LiveItemSignal>;
  ridgeUsed: boolean;
  decidedFights: number;
  evolutionCohortFights: number;
}

/**
 * Detects automated Playwright E2E bot fights recorded under `env = 'dev'`
 * (machine-regular <=1.4s median find, <=2.0s max drought, zero mistakes).
 */
export const isLikelyE2eBotFight = (
  r: Pick<ValidatedFightRecord, 'env' | 'medianFindMs' | 'maxDroughtMs' | 'mistakes'>
): boolean =>
  r.env === 'dev' &&
  r.medianFindMs !== null &&
  r.medianFindMs > 0 &&
  r.medianFindMs <= 1400 &&
  r.maxDroughtMs <= 2000 &&
  r.mistakes === 0;

const MAIN_LEVEL_META = new Map(
  MAIN_LEVELS.map((l, idx) => [
    l.id,
    { order: idx + 1, world: Number(l.id.split('-')[0]) || 1, boss: !!l.isBoss },
  ])
);

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round4 = (v: number): number => Math.round(v * 10000) / 10000;

const asNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const asOptNum = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const asBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  return false;
};

const asStringArray = (val: unknown): string[] => {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === 'string');
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeWeaponIds = (ids: readonly string[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawId of ids) {
    const resolved = resolveLegacyWeapon(rawId);
    if (!resolved) continue;
    if (!seen.has(resolved.id)) {
      seen.add(resolved.id);
      out.push(resolved.id);
    }
  }
  return out;
};

const normalizeWeaponBag = (ids: readonly string[]): string[] => {
  const out: string[] = [];
  for (const rawId of ids) {
    const resolved = resolveLegacyWeapon(rawId);
    if (resolved) out.push(resolved.id);
  }
  return out;
};

const normalizeMode = (rawMode: unknown, levelId: string): FightModeFilter => {
  if (rawMode === 'adventure' || rawMode === 'spire' || rawMode === 'free_play' || rawMode === 'classic') {
    return rawMode;
  }
  if (levelId.startsWith('spire-')) return 'spire';
  if (levelId.startsWith('freeplay')) return 'free_play';
  if (levelId.startsWith('classic')) return 'classic';
  return 'adventure';
};

const normalizeOutcome = (raw: unknown): ValidatedFightRecord['outcome'] => {
  if (raw === 'won' || raw === 'survived' || raw === 'lost' || raw === 'practice' || raw === 'left') {
    return raw;
  }
  return 'left';
};

const isWin = (o: ValidatedFightRecord['outcome']): boolean => o === 'won' || o === 'survived';
const isDecided = (o: ValidatedFightRecord['outcome']): boolean =>
  o === 'won' || o === 'survived' || o === 'lost';

const flattenEventProps = (raw: Record<string, unknown>): Record<string, unknown> => {
  const props =
    raw.properties && typeof raw.properties === 'object' && !Array.isArray(raw.properties)
      ? (raw.properties as Record<string, unknown>)
      : null;
  return props ? { ...raw, ...props } : raw;
};

const resolveActiveMinVersion = (
  options: PostHogFilterOptions,
  eras: readonly BalanceEra[]
): { minVersion: string; eraId: string } => {
  const latestEra = eras[eras.length - 1] ?? CURRENT_BALANCE_ERA;
  if (options.minVersionOverride) {
    const matched = getEraForVersion(options.minVersionOverride, eras);
    return {
      minVersion: options.minVersionOverride,
      eraId: matched?.id ?? latestEra.id,
    };
  }
  const eraOpt = options.eraId ?? 'current';
  if (eraOpt === 'all') {
    return { minVersion: eras[0]?.minVersion ?? '0.1.119', eraId: 'all' };
  }
  if (eraOpt === 'current') {
    const mode = options.mode && options.mode !== 'all' ? options.mode : undefined;
    return {
      minVersion: getMinValidVersion('all', undefined, mode, eras),
      eraId: latestEra.id,
    };
  }
  const explicit = getEraById(eraOpt, eras);
  if (explicit) {
    return { minVersion: explicit.minVersion, eraId: explicit.id };
  }
  return { minVersion: latestEra.minVersion, eraId: latestEra.id };
};

/**
 * Parses, deduplicates, folds retrospective `fight_rated` events, and applies all
 * version-era & hygiene rules to raw PostHog events or normalized fight objects.
 */
export const filterFightEvents = (
  rawEvents: readonly Record<string, unknown>[],
  options: PostHogFilterOptions = {}
): { fights: ValidatedFightRecord[]; audit: PostHogAuditLedger } => {
  const eras = options.eras ?? BALANCE_ERAS;
  const modeFilter = options.mode ?? 'adventure';
  const includeDev = options.includeDev ?? false;
  const soloTester = options.soloTester ?? false;
  const excludePractice = options.excludePractice ?? true;
  const excludeBugTagged = options.excludeBugTagged ?? true;
  const minSets = options.minSets ?? 3;
  const minDurationMs = options.minDurationMs ?? 10_000;
  const excludeTutorial11 = options.excludeTutorial11 ?? true;
  const maxHelpedSetRatio = options.maxHelpedSetRatio ?? 0.5;
  const { minVersion: activeMinVersion, eraId: activeEraId } = resolveActiveMinVersion(options, eras);

  const audit: PostHogAuditLedger = {
    totalRaw: rawEvents.length,
    deduped: 0,
    ratedFolds: 0,
    kept: 0,
    droppedByVersion: 0,
    droppedByEnv: 0,
    droppedByMode: 0,
    droppedByPractice: 0,
    droppedByE2eBot: 0,
    droppedByBug: 0,
    droppedByShort: 0,
    droppedByCoached: 0,
    activeMinVersion,
    currentEraId: activeEraId === 'all' ? CURRENT_BALANCE_ERA_ID : activeEraId,
  };

  // Pass 1: Separate `fight_ended` (deduping by fight_id) and retrospective `fight_rated`
  const byFightId = new Map<string, ValidatedFightRecord>();
  const lateRatings = new Map<string, { timestampMs: number; funRating: 'up' | 'down'; funTags: string[] }>();

  for (let i = 0; i < rawEvents.length; i++) {
    const raw = rawEvents[i];
    if (!raw || typeof raw !== 'object') continue;
    const p = flattenEventProps(raw);
    const eventName = typeof raw.event === 'string' ? raw.event : 'fight_ended';

    const tsParsed =
      typeof raw.timestamp === 'string'
        ? Date.parse(raw.timestamp)
        : typeof p.timestampMs === 'number'
          ? p.timestampMs
          : typeof raw.timestamp === 'number'
            ? raw.timestamp
            : Date.now();
    const timestampMs = Number.isFinite(tsParsed) ? tsParsed : 0;

    if (eventName === 'fight_rated') {
      const fid = typeof p.fight_id === 'string' ? p.fight_id : typeof p.fightId === 'string' ? p.fightId : null;
      const rating = p.fun_rating === 'up' || p.fun_rating === 'down' ? p.fun_rating : null;
      if (fid && rating) {
        const prev = lateRatings.get(fid);
        if (!prev || timestampMs >= prev.timestampMs) {
          lateRatings.set(fid, { timestampMs, funRating: rating, funTags: asStringArray(p.fun_tags) });
        }
      }
      continue;
    }

    if (eventName !== 'fight_ended') continue;

    const levelId =
      typeof p.level_id === 'string'
        ? p.level_id
        : typeof p.levelId === 'string'
          ? p.levelId
          : typeof p.level === 'string'
            ? p.level
            : 'unknown';
    const meta = MAIN_LEVEL_META.get(levelId);
    const mode = normalizeMode(p.mode, levelId);
    const fightId =
      typeof p.fight_id === 'string' && p.fight_id.length > 0
        ? p.fight_id
        : typeof p.fightId === 'string' && p.fightId.length > 0
          ? p.fightId
          : typeof raw.uuid === 'string' && raw.uuid.length > 0
            ? raw.uuid
            : `${timestampMs}-${levelId}-${i}`;

    const rawVersion =
      typeof p.app_version === 'string'
        ? p.app_version
        : typeof p.$app_version === 'string'
          ? p.$app_version
          : typeof p.appVersion === 'string'
            ? p.appVersion
            : null;
    const appVersion = rawVersion && semverToNumeric(rawVersion) !== null ? rawVersion.replace(/^v/, '').trim() : null;
    const era = getEraForVersion(appVersion, eras);

    const env = typeof p.env === 'string' && p.env.trim() !== '' ? p.env.trim().toLowerCase() : 'unknown';
    const outcome = normalizeOutcome(p.outcome);
    const practice = asBool(p.practice) || outcome === 'practice';

    const funRaw = p.fun_rating ?? p.funRating;
    const funRating: 'up' | 'down' | null = funRaw === 'up' || funRaw === 'down' ? funRaw : null;
    const funTags = asStringArray(p.fun_tags ?? p.funTags);

    const evolutionsForged = asStringArray(p.evolutions_forged ?? p.evolutionsForged ?? (Array.isArray(p.evolutions) ? p.evolutions : []));
    const evolutionsCount =
      typeof p.evolutions === 'number'
        ? p.evolutions
        : typeof p.evolutions === 'string' && /^\d+$/.test(p.evolutions)
          ? Number(p.evolutions)
          : evolutionsForged.length;

    const record: ValidatedFightRecord = {
      fightId,
      distinctId:
        typeof raw.distinct_id === 'string'
          ? raw.distinct_id
          : typeof raw.distinctId === 'string'
            ? raw.distinctId
            : typeof p.distinct_id === 'string'
              ? p.distinct_id
              : 'anon',
      timestampMs,
      appVersion,
      eraId: era?.id ?? null,
      env,
      mode,
      levelId,
      levelOrder: asNum(p.level_order ?? p.levelOrder, meta?.order ?? 0),
      world: asNum(p.world, meta?.world ?? (Number(levelId.split('-')[0]) || 0)),
      boss: asBool(p.boss) || (meta?.boss ?? false),
      practice,
      spireAct: asOptNum(p.spire_act ?? p.spireAct),
      spireFloor: asOptNum(p.spire_floor ?? p.spireFloor),
      spireAscension: asOptNum(p.spire_ascension ?? p.spireAscension),
      spireNodeKind:
        typeof p.spire_node_kind === 'string'
          ? p.spire_node_kind
          : typeof p.spireNodeKind === 'string'
            ? p.spireNodeKind
            : null,
      fighter: typeof p.fighter === 'string' ? p.fighter : 'Unknown',
      outcome,
      durationMs: asNum(p.duration_ms ?? p.durationMs, 0),
      damage: asNum(p.damage, 0),
      dpm: asNum(p.dpm, 0),
      sets: asNum(p.sets, 0),
      mistakes: asNum(p.mistakes, 0),
      helpedSets: asNum(p.helped_sets ?? p.helpedSets, 0),
      hintsUsed: asNum(p.hints_used ?? p.hintsUsed, 0),
      gracesUsed: asNum(p.graces_used ?? p.gracesUsed, 0),
      medianFindMs: asOptNum(p.median_find_ms ?? p.medianFindMs),
      maxDroughtMs: asNum(p.max_drought_ms ?? p.maxDroughtMs, 0),
      evolutionsCount,
      weapons: normalizeWeaponIds(asStringArray(p.weapons)),
      weaponsOffered: normalizeWeaponBag(asStringArray(p.weapons_offered ?? p.weaponsOffered)),
      weaponsPicked: normalizeWeaponBag(asStringArray(p.weapons_picked ?? p.weaponsPicked)),
      weaponsBought: normalizeWeaponBag(asStringArray(p.weapons_bought ?? p.weaponsBought)),
      evolutionsForged: Array.from(new Set(evolutionsForged)),
      arcana: Array.from(new Set(asStringArray(p.arcana))),
      funRating,
      funTags,
    };

    const existing = byFightId.get(fightId);
    if (existing) {
      audit.deduped += 1;
      // Keep the later/more-complete copy while preserving any fun feedback
      const newer = record.timestampMs >= existing.timestampMs ? record : existing;
      const older = newer === record ? existing : record;
      byFightId.set(fightId, {
        ...newer,
        funRating: newer.funRating ?? older.funRating,
        funTags: newer.funTags.length > 0 ? newer.funTags : older.funTags,
      });
    } else {
      byFightId.set(fightId, record);
    }
  }

  // Fold retrospective `fight_rated` onto matching `fight_ended`
  for (const [fid, rating] of lateRatings.entries()) {
    const rec = byFightId.get(fid);
    if (!rec) continue;
    rec.funRating = rating.funRating;
    if (rating.funTags.length > 0) rec.funTags = rating.funTags;
    audit.ratedFolds += 1;
  }

  // Pass 2: Apply strict hygiene & version-era gates in deterministic order
  const fights: ValidatedFightRecord[] = [];
  for (const r of byFightId.values()) {
    if (!includeDev && r.env !== 'prod') {
      audit.droppedByEnv += 1;
      continue;
    }
    if (modeFilter !== 'all' && r.mode !== modeFilter) {
      audit.droppedByMode += 1;
      continue;
    }
    if (excludePractice && r.practice) {
      audit.droppedByPractice += 1;
      continue;
    }
    if (soloTester && includeDev && isLikelyE2eBotFight(r)) {
      audit.droppedByE2eBot += 1;
      continue;
    }
    if (!isVersionAtLeast(r.appVersion, activeMinVersion)) {
      audit.droppedByVersion += 1;
      continue;
    }
    if (excludeBugTagged && r.funTags.includes('bug_in_game')) {
      audit.droppedByBug += 1;
      continue;
    }
    if (r.sets < minSets || r.durationMs < minDurationMs) {
      audit.droppedByShort += 1;
      continue;
    }
    if (r.mode === 'adventure') {
      if (excludeTutorial11 && r.levelId === '1-1') {
        audit.droppedByCoached += 1;
        continue;
      }
      if (r.sets > 0 && r.helpedSets / r.sets > maxHelpedSetRatio) {
        audit.droppedByCoached += 1;
        continue;
      }
    }
    fights.push(r);
  }

  fights.sort((a, b) => a.timestampMs - b.timestampMs);
  audit.kept = fights.length;
  return { fights, audit };
};

// ─── Stratification & Leave-One-Out Baselines ──────────────────────────────

const stratumKeyOf = (r: ValidatedFightRecord): string => {
  const eraKey = r.eraId ?? 'unknown';
  if (r.mode === 'spire') {
    const act = r.spireAct ?? r.world ?? 1;
    const node = r.spireNodeKind ?? (r.boss ? 'boss' : 'skirmish');
    const ascBucket = r.spireAscension !== null ? Math.min(3, Math.floor(r.spireAscension / 2)) : 0;
    return `spire:${act}:${node}:a${ascBucket}:${eraKey}`;
  }
  return `${r.mode}:${r.levelId}:${eraKey}`;
};

const fallbackStratumKeyOf = (r: ValidatedFightRecord): string => {
  if (r.mode === 'spire') return `spire:act${r.spireAct ?? r.world ?? 1}`;
  return `${r.mode}:w${r.world}:${r.boss ? 'boss' : 'std'}`;
};

interface StratumStats {
  decided: number;
  wins: number;
  dpmCount: number;
  logDpmSum: number;
}

const buildStratumStats = (fights: readonly ValidatedFightRecord[]) => {
  const fine = new Map<string, StratumStats>();
  const coarse = new Map<string, StratumStats>();
  const global: StratumStats = { decided: 0, wins: 0, dpmCount: 0, logDpmSum: 0 };

  const add = (map: Map<string, StratumStats>, key: string, r: ValidatedFightRecord) => {
    let s = map.get(key);
    if (!s) {
      s = { decided: 0, wins: 0, dpmCount: 0, logDpmSum: 0 };
      map.set(key, s);
    }
    if (isDecided(r.outcome)) {
      s.decided += 1;
      if (isWin(r.outcome)) s.wins += 1;
    }
    if (r.dpm > 0) {
      s.dpmCount += 1;
      s.logDpmSum += Math.log(r.dpm);
    }
  };

  for (const r of fights) {
    add(fine, stratumKeyOf(r), r);
    add(coarse, fallbackStratumKeyOf(r), r);
    if (isDecided(r.outcome)) {
      global.decided += 1;
      if (isWin(r.outcome)) global.wins += 1;
    }
    if (r.dpm > 0) {
      global.dpmCount += 1;
      global.logDpmSum += Math.log(r.dpm);
    }
  }

  const expectedWinFor = (r: ValidatedFightRecord, leaveOneOut: boolean): number | null => {
    const pick = (s: StratumStats | undefined, minN: number): number | null => {
      if (!s || s.decided < minN) return null;
      if (leaveOneOut && isDecided(r.outcome) && s.decided > 1) {
        return (s.wins - (isWin(r.outcome) ? 1 : 0)) / (s.decided - 1);
      }
      return s.wins / s.decided;
    };
    return (
      pick(fine.get(stratumKeyOf(r)), 5) ??
      pick(coarse.get(fallbackStratumKeyOf(r)), 5) ??
      pick(global, 1)
    );
  };

  const expectedLogDpmFor = (r: ValidatedFightRecord, leaveOneOut: boolean): number | null => {
    const pick = (s: StratumStats | undefined, minN: number): number | null => {
      if (!s || s.dpmCount < minN) return null;
      if (leaveOneOut && r.dpm > 0 && s.dpmCount > 1) {
        return (s.logDpmSum - Math.log(r.dpm)) / (s.dpmCount - 1);
      }
      return s.logDpmSum / s.dpmCount;
    };
    return (
      pick(fine.get(stratumKeyOf(r)), 5) ??
      pick(coarse.get(fallbackStratumKeyOf(r)), 5) ??
      pick(global, 1)
    );
  };

  return { expectedWinFor, expectedLogDpmFor };
};

// ─── L2 Ridge Regression (Cholesky SPD Solver) ─────────────────────────────

/**
 * Solves `(X^T W X + lambda * I_penalized) beta = X^T W y` via Cholesky decomposition.
 * Column 0 is an unpenalized intercept; all remaining columns are L2-regularized.
 */
const solveWeightedRidge = (
  rows: { cols: number[]; vals: number[]; weight: number; target: number }[],
  numCols: number,
  lambda: number
): number[] | null => {
  if (rows.length === 0 || numCols <= 1) return null;
  const A = new Float64Array(numCols * numCols);
  const b = new Float64Array(numCols);

  for (const row of rows) {
    const w = row.weight;
    const len = row.cols.length;
    for (let i = 0; i < len; i++) {
      const ci = row.cols[i];
      const vi = row.vals[i];
      b[ci] += w * vi * row.target;
      const base = ci * numCols;
      for (let j = i; j < len; j++) {
        const cj = row.cols[j];
        const vj = row.vals[j];
        const prod = w * vi * vj;
        A[base + cj] += prod;
        if (i !== j) A[cj * numCols + ci] += prod;
      }
    }
  }

  // Tiny ridge on intercept (1e-6), full lambda on feature columns
  A[0] += 1e-6;
  for (let c = 1; c < numCols; c++) {
    A[c * numCols + c] += lambda;
  }

  // Cholesky factorization A = L L^T
  const L = new Float64Array(numCols * numCols);
  for (let i = 0; i < numCols; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * numCols + j];
      for (let k = 0; k < j; k++) {
        sum -= L[i * numCols + k] * L[j * numCols + k];
      }
      if (i === j) {
        if (sum <= 1e-12) return null;
        L[i * numCols + j] = Math.sqrt(sum);
      } else {
        L[i * numCols + j] = sum / L[j * numCols + j];
      }
    }
  }

  // Forward solve L z = b
  const z = new Float64Array(numCols);
  for (let i = 0; i < numCols; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= L[i * numCols + k] * z[k];
    z[i] = sum / L[i * numCols + i];
  }

  // Backward solve L^T beta = z
  const beta = new Array<number>(numCols).fill(0);
  for (let i = numCols - 1; i >= 0; i--) {
    let sum = z[i];
    for (let k = i + 1; k < numCols; k++) sum -= L[k * numCols + i] * beta[k];
    beta[i] = sum / L[i * numCols + i];
  }

  return beta;
};

const fitBuildRidge = (
  fights: readonly ValidatedFightRecord[],
  extractFeatures: (r: ValidatedFightRecord) => string[],
  targetOf: (r: ValidatedFightRecord) => number | null,
  minFights: number,
  lambda: number
): Map<string, number> => {
  const out = new Map<string, number>();
  const validRows: { r: ValidatedFightRecord; feats: string[]; y: number }[] = [];
  const featCounts = new Map<string, number>();

  for (const r of fights) {
    const y = targetOf(r);
    if (y === null || !Number.isFinite(y)) continue;
    const feats = extractFeatures(r);
    validRows.push({ r, feats, y });
    for (const f of feats) featCounts.set(f, (featCounts.get(f) ?? 0) + 1);
  }
  if (validRows.length < minFights) return out;

  // Player-level inverse-sqrt weighting for global regression stability
  const playerCounts = new Map<string, number>();
  for (const row of validRows) {
    playerCounts.set(row.r.distinctId, (playerCounts.get(row.r.distinctId) ?? 0) + 1);
  }

  // Column 0 = intercept, 1 = weaponCount centered, 2 = log(medianFindMs) centered, 3+ = item features
  const activeFeats = Array.from(featCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([f]) => f)
    .sort();
  if (activeFeats.length === 0) return out;

  const colIndex = new Map<string, number>();
  activeFeats.forEach((f, idx) => colIndex.set(f, idx + 3));
  const numCols = activeFeats.length + 3;

  const meanWeapons =
    validRows.reduce((s, row) => s + row.r.weapons.length, 0) / Math.max(1, validRows.length);
  const findLogs = validRows
    .map(row => (row.r.medianFindMs && row.r.medianFindMs > 0 ? Math.log(row.r.medianFindMs) : null))
    .filter((v): v is number => v !== null);
  const meanFindLog =
    findLogs.length > 0 ? findLogs.reduce((a, b) => a + b, 0) / findLogs.length : Math.log(5000);

  const design = validRows.map(({ r, feats, y }) => {
    const cols: number[] = [0, 1, 2];
    const vals: number[] = [
      1,
      (r.weapons.length - meanWeapons) / 3,
      r.medianFindMs && r.medianFindMs > 0 ? clamp(Math.log(r.medianFindMs) - meanFindLog, -2, 2) : 0,
    ];
    for (const f of feats) {
      const idx = colIndex.get(f);
      if (idx !== undefined) {
        cols.push(idx);
        vals.push(1);
      }
    }
    const pCount = playerCounts.get(r.distinctId) ?? 1;
    return { cols, vals, weight: 1 / Math.sqrt(pCount), target: y };
  });

  const beta = solveWeightedRidge(design, numCols, lambda);
  if (!beta) return out;

  activeFeats.forEach((f, idx) => {
    out.set(f, beta[idx + 3]);
  });
  return out;
};

// ─── Credibility & Concentration-Weighted Aggregation ──────────────────────

export const classifyCredibility = (
  effectiveN: number,
  uniquePlayers: number,
  soloTester = false
): CredibilityTier => {
  if (effectiveN <= 0) return 'sim_only';
  if (soloTester) {
    if (effectiveN >= 10) return 'credible';
    if (effectiveN >= 3) return 'emerging';
    return 'exploratory';
  }
  if (effectiveN >= 50 && uniquePlayers >= 10) return 'credible';
  if (effectiveN >= 15 && uniquePlayers >= 5) return 'emerging';
  return 'exploratory';
};

/**
 * Computes player-concentration-controlled weights (`1 / sqrt(playerItemFights)`, capped via
 * exact iterative water-filling so no single player exceeds `maxPlayerWeightShare` whenever
 * `uniquePlayers * maxPlayerWeightShare >= 1`) and Kish's effective sample size
 * `effectiveN = (sum w)^2 / (sum w^2)`.
 */
const computePlayerCappedWeights = (
  records: readonly ValidatedFightRecord[],
  maxPlayerWeightShare: number
): { weights: number[]; effectiveN: number; uniquePlayers: number } => {
  if (records.length === 0) return { weights: [], effectiveN: 0, uniquePlayers: 0 };
  const perPlayer = new Map<string, number>();
  for (const r of records) {
    perPlayer.set(r.distinctId, (perPlayer.get(r.distinctId) ?? 0) + 1);
  }
  const uniquePlayers = perPlayer.size;

  // Base inverse-sqrt weight per player
  const rawWeights = records.map(r => 1 / Math.sqrt(perPlayer.get(r.distinctId) ?? 1));
  const playerTotal = new Map<string, number>();
  for (let i = 0; i < records.length; i++) {
    const pid = records[i].distinctId;
    playerTotal.set(pid, (playerTotal.get(pid) ?? 0) + rawWeights[i]);
  }

  // Exact iterative water-filling cap when feasible (uniquePlayers * c >= 1)
  let weights = rawWeights;
  if (
    maxPlayerWeightShare > 0 &&
    maxPlayerWeightShare < 1 &&
    uniquePlayers * maxPlayerWeightShare >= 1 - 1e-9
  ) {
    const capped = new Set<string>();
    const scaleByPlayer = new Map<string, number>();
    let equalFallback = false;
    let finalWCap = 0;

    for (let iter = 0; iter <= uniquePlayers; iter++) {
      const k = capped.size;
      const denom = 1 - k * maxPlayerWeightShare;
      let uncappedSum = 0;
      for (const [pid, pw] of playerTotal.entries()) {
        if (!capped.has(pid)) uncappedSum += pw;
      }
      if (denom <= 1e-9 || uncappedSum <= 0) {
        equalFallback = true;
        break;
      }
      const wCap = (maxPlayerWeightShare * uncappedSum) / denom;
      let added = false;
      for (const [pid, pw] of playerTotal.entries()) {
        if (!capped.has(pid) && pw > wCap + 1e-12) {
          capped.add(pid);
          added = true;
        }
      }
      if (!added) {
        finalWCap = wCap;
        break;
      }
    }

    if (equalFallback) {
      for (const [pid, pw] of playerTotal.entries()) {
        scaleByPlayer.set(pid, pw > 0 ? 1 / pw : 1);
      }
    } else if (capped.size > 0) {
      for (const [pid, pw] of playerTotal.entries()) {
        scaleByPlayer.set(pid, capped.has(pid) && pw > 0 ? finalWCap / pw : 1);
      }
    }

    if (scaleByPlayer.size > 0) {
      weights = records.map((r, i) => rawWeights[i] * (scaleByPlayer.get(r.distinctId) ?? 1));
    }
  }

  let sumW = 0;
  let sumW2 = 0;
  for (const w of weights) {
    sumW += w;
    sumW2 += w * w;
  }
  const kish = sumW2 > 0 ? (sumW * sumW) / sumW2 : 0;
  return {
    weights,
    effectiveN: Math.min(records.length, Math.round(kish * 10) / 10),
    uniquePlayers,
  };
};

const WIN_TO_LOG_LIFT_SCALE = 1.6;

/**
 * Full balance signal analyzer for PostHog events: applies version-era invalidation,
 * hygiene filters, Simpson's stratification, Evolution survivorship control, L2 Ridge
 * co-occurrence de-biasing, and credibility classification.
 */
export const analyzePostHogForBalance = (
  rawEvents: readonly Record<string, unknown>[],
  options: PostHogFilterOptions = {}
): PostHogBalanceSignals => {
  const eras = options.eras ?? BALANCE_ERAS;
  const modeFilter = options.mode ?? 'adventure';
  const modeArg: FightModeFilter | undefined = modeFilter === 'all' ? undefined : modeFilter;
  // Per-item validity floors apply by default only when analyzing the current era
  // without an explicit historical eraId / minVersionOverride.
  const usePerItemMinVersion =
    options.usePerItemMinVersion ??
    ((options.eraId === undefined || options.eraId === 'current') && !options.minVersionOverride);
  const maxPlayerWeightShare = options.maxPlayerWeightShare ?? 0.25;
  const soloTester = options.soloTester ?? false;

  const { fights, audit } = filterFightEvents(rawEvents, options);

  const decidedFights = fights.filter(f => isDecided(f.outcome));
  const evoCohort = fights.filter(f => f.evolutionsCount > 0 || f.evolutionsForged.length > 0);
  const evoDecided = evoCohort.filter(f => isDecided(f.outcome));

  const mainStrata = buildStratumStats(fights);
  const evoStrata = buildStratumStats(evoCohort);

  const resolveItemFloor = (category: Exclude<BalanceCategory, 'levels'>, id: string): string => {
    if (!usePerItemMinVersion) return audit.activeMinVersion;
    const itemFloor = getMinValidVersion(category, id, modeArg, eras);
    return compareSemver(itemFloor, audit.activeMinVersion) > 0 ? itemFloor : audit.activeMinVersion;
  };

  // Tag stale pre-patch item occurrences as `@pre` in Ridge so granular item patches
  // remain nuisance covariates without contaminating post-patch Ridge coefficients.
  const ridgeFeatureTag = (
    category: Exclude<BalanceCategory, 'levels'>,
    id: string,
    appVersion: string | null
  ): string => {
    if (!usePerItemMinVersion) return `${category}:${id}`;
    const floor = resolveItemFloor(category, id);
    return isVersionAtLeast(appVersion, floor) ? `${category}:${id}` : `${category}:${id}@pre`;
  };

  // Offer-vs-pick counts for weapons (respecting per-item minValidVersion)
  const weaponOffered = new Map<string, number>();
  const weaponChosen = new Map<string, number>();
  for (const r of fights) {
    for (const wid of r.weaponsOffered) {
      const floor = resolveItemFloor('weapons', wid);
      if (!isVersionAtLeast(r.appVersion, floor)) continue;
      weaponOffered.set(wid, (weaponOffered.get(wid) ?? 0) + 1);
    }
    for (const wid of [...r.weaponsPicked, ...r.weaponsBought]) {
      const floor = resolveItemFloor('weapons', wid);
      if (!isVersionAtLeast(r.appVersion, floor)) continue;
      weaponChosen.set(wid, (weaponChosen.get(wid) ?? 0) + 1);
    }
  }

  // Fit L2 Ridge co-occurrence debiasing when N >= 80 decided fights
  const extractMainRidgeFeatures = (r: ValidatedFightRecord): string[] => [
    ...r.weapons.map(id => ridgeFeatureTag('weapons', id, r.appVersion)),
    ...(r.fighter && r.fighter !== 'Unknown' ? [ridgeFeatureTag('fighters', r.fighter, r.appVersion)] : []),
    ...r.arcana.map(id => ridgeFeatureTag('arcana', id, r.appVersion)),
  ];

  const ridgeMainWin = fitBuildRidge(
    decidedFights,
    extractMainRidgeFeatures,
    r => {
      const exp = mainStrata.expectedWinFor(r, true);
      return exp === null ? null : (isWin(r.outcome) ? 1 : 0) - exp;
    },
    80,
    8
  );

  const ridgeMainDpm = fitBuildRidge(
    fights.filter(f => f.dpm > 0),
    extractMainRidgeFeatures,
    r => {
      if (r.dpm <= 0) return null;
      const exp = mainStrata.expectedLogDpmFor(r, true);
      return exp === null ? null : Math.log(r.dpm) - exp;
    },
    80,
    8
  );

  // Within-Catalyst-cohort Ridge for Evolutions (controls survivorship bias!)
  const extractEvoRidgeFeatures = (r: ValidatedFightRecord): string[] =>
    r.evolutionsForged.map(id => ridgeFeatureTag('evolutions', id, r.appVersion));

  const ridgeEvoWin = fitBuildRidge(
    evoDecided,
    extractEvoRidgeFeatures,
    r => {
      const exp = evoStrata.expectedWinFor(r, true);
      return exp === null ? null : (isWin(r.outcome) ? 1 : 0) - exp;
    },
    40,
    6
  );

  const ridgeEvoDpm = fitBuildRidge(
    evoCohort.filter(f => f.dpm > 0),
    extractEvoRidgeFeatures,
    r => {
      if (r.dpm <= 0) return null;
      const exp = evoStrata.expectedLogDpmFor(r, true);
      return exp === null ? null : Math.log(r.dpm) - exp;
    },
    40,
    6
  );

  const ridgeUsed = ridgeMainWin.size > 0 || ridgeMainDpm.size > 0;

  const buildCategorySignals = (
    category: Exclude<BalanceCategory, 'levels'>,
    pool: readonly ValidatedFightRecord[],
    strata: ReturnType<typeof buildStratumStats>,
    ridgeWinMap: Map<string, number>,
    ridgeDpmMap: Map<string, number>,
    extractIds: (r: ValidatedFightRecord) => string[]
  ): Record<string, LiveItemSignal> => {
    const grouped = new Map<string, ValidatedFightRecord[]>();
    const validSinceByItem = new Map<string, string>();

    for (const r of pool) {
      const ids = Array.from(new Set(extractIds(r)));
      for (const id of ids) {
        let floor = validSinceByItem.get(id);
        if (!floor) {
          floor = resolveItemFloor(category, id);
          validSinceByItem.set(id, floor);
        }
        if (!isVersionAtLeast(r.appVersion, floor)) continue;
        const list = grouped.get(id);
        if (list) list.push(r);
        else grouped.set(id, [r]);
      }
    }

    const result: Record<string, LiveItemSignal> = {};
    for (const [id, itemFights] of grouped.entries()) {
      const validSince = validSinceByItem.get(id) ?? audit.activeMinVersion;
      const { weights, effectiveN, uniquePlayers } = soloTester
        ? {
            weights: itemFights.map(() => 1),
            effectiveN: itemFights.length,
            uniquePlayers: new Set(itemFights.map(r => r.distinctId)).size,
          }
        : computePlayerCappedWeights(itemFights, maxPlayerWeightShare);

      let wDecided = 0;
      let wWins = 0;
      let wExpectedWin = 0;
      let wDpm = 0;
      let wLogDpmDelta = 0;
      let wLogDpmDeltaSq = 0;
      let funCount = 0;
      let funUp = 0;

      for (let i = 0; i < itemFights.length; i++) {
        const r = itemFights[i];
        const w = weights[i];
        if (isDecided(r.outcome)) {
          const expW = strata.expectedWinFor(r, true);
          if (expW !== null) {
            wDecided += w;
            if (isWin(r.outcome)) wWins += w;
            wExpectedWin += w * expW;
          }
        }
        if (r.dpm > 0) {
          const expD = strata.expectedLogDpmFor(r, true);
          if (expD !== null) {
            const delta = clamp(Math.log(r.dpm) - expD, -1.5, 1.5);
            wDpm += w;
            wLogDpmDelta += w * delta;
            wLogDpmDeltaSq += w * delta * delta;
          }
        }
        if (r.funRating !== null) {
          funCount += 1;
          if (r.funRating === 'up') funUp += 1;
        }
      }

      const winRate = wDecided > 0 ? round4(wWins / wDecided) : null;
      const expectedWinRate = wDecided > 0 ? round4(wExpectedWin / wDecided) : null;
      const adjustedWinDelta =
        winRate !== null && expectedWinRate !== null ? round4(winRate - expectedWinRate) : null;
      const logDpmDelta = wDpm > 0 ? round4(wLogDpmDelta / wDpm) : null;

      const featKey = `${category}:${id}`;
      const rawRidgeWin = ridgeWinMap.get(featKey);
      const rawRidgeDpm = ridgeDpmMap.get(featKey);
      const ridgeWinDelta =
        rawRidgeWin !== undefined && itemFights.length >= 10 ? round4(rawRidgeWin) : null;
      const ridgeLogDpmDelta =
        rawRidgeDpm !== undefined && itemFights.length >= 10 ? round4(rawRidgeDpm) : null;

      // Prefer Ridge co-occurrence-debiased estimates when sample supports them
      const bestWinDelta = ridgeWinDelta ?? adjustedWinDelta;
      const bestDpmDelta = ridgeLogDpmDelta ?? logDpmDelta;

      const liftBound = soloTester && itemFights.length < 10 ? 0.5 : 0.8;
      let liveLogLift = 0;
      if (bestWinDelta !== null && bestDpmDelta !== null) {
        liveLogLift = clamp(
          0.6 * (WIN_TO_LOG_LIFT_SCALE * bestWinDelta) + 0.4 * clamp(bestDpmDelta, -0.75, 0.75),
          -liftBound,
          liftBound
        );
      } else if (bestWinDelta !== null) {
        liveLogLift = clamp(WIN_TO_LOG_LIFT_SCALE * bestWinDelta, -liftBound, liftBound);
      } else if (bestDpmDelta !== null) {
        liveLogLift = clamp(0.65 * clamp(bestDpmDelta, -0.75, 0.75), -liftBound, liftBound);
      }

      // Compute standard error on natural-log scale for 95% CI reporting
      let liveLogLiftSE: number | null = null;
      if (effectiveN > 0) {
        const pHat = winRate ?? 0.5;
        const winSE =
          wDecided > 0
            ? WIN_TO_LOG_LIFT_SCALE * Math.sqrt(Math.max(0.04, pHat * (1 - pHat)) / Math.max(1, effectiveN))
            : null;
        const dpmVar =
          wDpm > 0 && logDpmDelta !== null
            ? Math.max(0.04, wLogDpmDeltaSq / wDpm - logDpmDelta * logDpmDelta)
            : null;
        const dpmSE = dpmVar !== null ? Math.sqrt(dpmVar / Math.max(1, effectiveN)) : null;

        if (winSE !== null && dpmSE !== null) {
          liveLogLiftSE = round4(Math.max(0.02, Math.sqrt(0.36 * winSE * winSE + 0.16 * dpmSE * dpmSE)));
        } else if (winSE !== null) {
          liveLogLiftSE = round4(Math.max(0.02, winSE));
        } else if (dpmSE !== null) {
          liveLogLiftSE = round4(Math.max(0.02, 0.65 * dpmSE));
        }
      }

      const offered = category === 'weapons' ? (weaponOffered.get(id) ?? 0) : 0;
      const chosen = category === 'weapons' ? (weaponChosen.get(id) ?? 0) : 0;
      const pickRate = offered > 0 ? round4(chosen / offered) : null;
      const funRate = funCount > 0 ? round4(funUp / funCount) : null;

      result[id] = {
        id,
        category,
        validSince,
        fights: itemFights.length,
        effectiveN,
        uniquePlayers,
        winRate,
        expectedWinRate,
        adjustedWinDelta,
        ridgeWinDelta,
        logDpmDelta,
        ridgeLogDpmDelta,
        liveLogLift: round4(liveLogLift),
        liveLogLiftSE,
        pickRate,
        funRate,
        funCount,
        credibility: classifyCredibility(effectiveN, uniquePlayers, soloTester),
      };
    }

    return result;
  };

  return {
    audit,
    mode: modeFilter,
    ...(soloTester ? { soloTester: true } : {}),
    weapons: buildCategorySignals('weapons', fights, mainStrata, ridgeMainWin, ridgeMainDpm, r => r.weapons),
    evolutions: buildCategorySignals(
      'evolutions',
      evoCohort,
      evoStrata,
      ridgeEvoWin,
      ridgeEvoDpm,
      r => r.evolutionsForged
    ),
    fighters: buildCategorySignals(
      'fighters',
      fights,
      mainStrata,
      ridgeMainWin,
      ridgeMainDpm,
      r => (r.fighter && r.fighter !== 'Unknown' ? [r.fighter] : [])
    ),
    arcana: buildCategorySignals('arcana', fights, mainStrata, ridgeMainWin, ridgeMainDpm, r => r.arcana),
    ridgeUsed,
    decidedFights: decidedFights.length,
    evolutionCohortFights: evoCohort.length,
  };
};

// ─── Shared HogQL Clause Builders (ClickHouse / PostHog SQL) ───────────────

/**
 * Generates a crash-proof ClickHouse/HogQL numeric semver predicate:
 * `(major * 1_000_000 + minor * 1_000 + patch) >= <minNumeric>`.
 */
export const buildHogqlVersionClause = (
  minVersion: string,
  fieldExpr: string = 'properties.app_version'
): string => {
  const numeric = semverToNumeric(minVersion);
  if (numeric === null) {
    throw new Error(`Invalid minVersion "${minVersion}" for HogQL version clause`);
  }
  const clean = `replaceRegexpOne(coalesce(toString(${fieldExpr}), '0.0.0'), '^v', '')`;
  return `(toInt64OrZero(arrayElement(splitByChar('.', ${clean}), 1)) * 1000000 + toInt64OrZero(arrayElement(splitByChar('.', ${clean}), 2)) * 1000 + toInt64OrZero(arrayElement(splitByChar('.', ${clean}), 3))) >= ${numeric}`;
};

export interface HogqlBalanceHygieneOptions {
  minVersion?: string;
  mode?: FightModeFilter | 'all';
  includeDev?: boolean;
  excludePractice?: boolean;
  excludeBugTagged?: boolean;
  minSets?: number;
  minDurationMs?: number;
  excludeTutorial11?: boolean;
  maxHelpedSetRatio?: number;
  decidedOnly?: boolean;
}

/**
 * Builds the canonical `WHERE` predicate fragment shared across PostHog balance
 * dashboards and `scripts/lib/posthogFetch.ts`.
 */
export const buildHogqlBalanceHygieneWhere = (opts: HogqlBalanceHygieneOptions = {}): string => {
  const mode = opts.mode ?? 'adventure';
  const minVersion =
    opts.minVersion ??
    getMinValidVersion('all', undefined, mode === 'all' ? undefined : mode);
  const includeDev = opts.includeDev ?? false;
  const excludePractice = opts.excludePractice ?? true;
  const excludeBugTagged = opts.excludeBugTagged ?? true;
  const minSets = opts.minSets ?? 3;
  const minDurationMs = opts.minDurationMs ?? 10_000;
  const excludeTutorial11 = opts.excludeTutorial11 ?? true;
  const maxHelpedSetRatio = opts.maxHelpedSetRatio ?? 0.5;
  const decidedOnly = opts.decidedOnly ?? false;

  const clauses: string[] = [
    `event = 'fight_ended'`,
    buildHogqlVersionClause(minVersion),
  ];

  if (!includeDev) {
    clauses.push(`coalesce(toString(properties.env), '') = 'prod'`);
  }
  if (mode !== 'all') {
    clauses.push(`coalesce(toString(properties.mode), 'adventure') = '${mode}'`);
  }
  if (excludePractice) {
    clauses.push(`lower(coalesce(toString(properties.practice), 'false')) NOT IN ('true', '1')`);
    clauses.push(`coalesce(toString(properties.outcome), '') != 'practice'`);
  }
  if (excludeBugTagged) {
    clauses.push(`NOT has(JSONExtractArrayRaw(coalesce(toString(properties.fun_tags), '[]')), '"bug_in_game"')`);
  }
  if (minSets > 0) {
    clauses.push(`toIntOrZero(toString(properties.sets)) >= ${Math.floor(minSets)}`);
  }
  if (minDurationMs > 0) {
    clauses.push(`toFloat64OrZero(toString(properties.duration_ms)) >= ${Math.floor(minDurationMs)}`);
  }
  if (excludeTutorial11 && (mode === 'adventure' || mode === 'all')) {
    clauses.push(`coalesce(toString(properties.level_id), '') != '1-1'`);
  }
  if (maxHelpedSetRatio < 1 && (mode === 'adventure' || mode === 'all')) {
    clauses.push(
      `(toFloat64OrZero(toString(properties.helped_sets)) / greatest(toFloat64OrZero(toString(properties.sets)), 1)) <= ${round3(maxHelpedSetRatio)}`
    );
  }
  if (decidedOnly) {
    clauses.push(`properties.outcome IN ('won', 'survived', 'lost')`);
  }

  return clauses.join('\n  AND ');
};
