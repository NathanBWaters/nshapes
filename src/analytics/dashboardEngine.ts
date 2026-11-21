/**
 * Pure game analytics & balance engine for NShapes.
 *
 * Parses any combination of local `BattleRecord`s, local `LocalAnalyticsEvent`s,
 * and exported PostHog `fight_ended` JSON rows to compute:
 * - Executive retention & session KPIs (D1/D7/D30 cohorts, Wilson confidence intervals)
 * - Campaign progression funnel & churn wall scores
 * - Enjoyment vs friction diagnostics (win vs loss fun gap, close calls, droughts, tags)
 * - Simpson's-Paradox-adjusted weapon, fighter, evolution & Arcana balance tables
 * - Deterministic 60-player cohort generator for sandboxed inspection
 */
import { ARCANA } from '@/adventure/data/arcana';
import { armoryBaseWeapon, resolveLegacyWeapon } from '@/adventure/data/armory';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { FIGHTERS } from '@/adventure/data/fighters';
import { MAIN_LEVELS } from '@/adventure/data/levels';
import type { BattleOutcome, BattleRecord } from '@/adventure/history';
import {
  CURRENT_BALANCE_ERA,
  CURRENT_BALANCE_ERA_ID,
  getEraById,
  getEraForVersion,
  getMinValidVersion,
  isVersionAtLeast,
  semverToNumeric,
} from './balanceEras';
import {
  FUN_TAG_LABELS,
  NEGATIVE_FUN_TAGS,
  POSITIVE_FUN_TAGS,
  type FunRating,
  type FunTag,
} from './fightEvent';
import type { JourneyStage, LocalAnalyticsEvent } from './posthog';

export type FightMode = 'adventure' | 'spire' | 'free_play' | 'classic';

export interface AnalyzeFightsOptions {
  /** Filter rows by Balance Era (`'all'` default for backwards compat, `'current'` for active era, or era id `'E8'`). */
  eraScope?: 'all' | 'current' | string;
  /** Restrict report to one game mode (`'all'` default). */
  modeFilter?: FightMode | 'all';
  /** Apply strict production hygiene rules (exclude dev/practice/bug_in_game/short/tutorial-coached). */
  hygiene?: 'off' | 'prod_clean';
  /** Allow `env !== 'prod'` when `hygiene === 'prod_clean'`. */
  includeDev?: boolean;
}

export interface DashboardFilterAudit {
  inputCount: number;
  keptCount: number;
  droppedByVersion: number;
  droppedByEnv: number;
  droppedByMode: number;
  droppedByPractice: number;
  droppedByBug: number;
  droppedByShort: number;
  droppedByCoached: number;
  activeMinVersion: string | null;
  eraScope: string;
  hygiene: 'off' | 'prod_clean';
}

export interface NormalizedFightRow {
  fightId: string;
  distinctId: string;
  playerCode: string;
  sessionId: string;
  timestampMs: number;
  dayKey: string;
  appVersion?: string | null;
  balanceEra?: string | null;
  env?: string;
  practice?: boolean;
  mode: FightMode;
  levelId: string;
  levelName: string;
  levelOrder: number;
  world: number;
  spireAct?: number | null;
  spireFloor?: number | null;
  spireAscension?: number | null;
  spireNodeKind?: string | null;
  fighter: string;
  foe: string;
  outcome: BattleOutcome;
  stars: number;
  durationMs: number;
  damage: number;
  dpm: number;
  sets: number;
  mistakes: number;
  helpedSets?: number;
  hintsUsed?: number;
  gracesUsed?: number;
  biggestHitShare?: number;
  triggeredDamageShare: number;
  medianFindMs: number | null;
  maxDroughtMs: number;
  closeCall: boolean;
  diedWithHints: boolean;
  weapons: string[];
  weaponsOffered: string[];
  weaponsPicked: string[];
  weaponsBought: string[];
  evolutions: string[];
  arcana: string[];
  funRating: FunRating | null;
  funTags: FunTag[];
  journeyStage?: JourneyStage;
}

export interface RetentionPoint {
  day: number;
  label: string;
  eligiblePlayers: number;
  retainedPlayers: number;
  rate: number;
}

export interface FunnelRow {
  levelId: string;
  levelName: string;
  levelOrder: number;
  world: number;
  playersReached: number;
  playersCleared: number;
  funnelPct: number;
  nextLevelDropPct: number;
  attempts: number;
  wins: number;
  losses: number;
  abandons: number;
  winRate: number;
  abandonRate: number;
  attemptsPerClear: number | null;
  avgDurationMs: number;
  avgDpm: number;
  funRatedCount: number;
  funUpCount: number;
  funRate: number | null;
  diedWithHintsPct: number;
  closeCallPct: number;
  topNegativeTag: string | null;
  churnWallScore: number;
}

export type BalanceCategory = 'weapon' | 'fighter' | 'evolution' | 'arcana';
export type BalanceStatus = 'overpowered' | 'undertuned' | 'frustrating' | 'crowd_pleaser' | 'balanced' | 'low_sample';

export interface BalanceRow {
  id: string;
  name: string;
  category: BalanceCategory;
  usedCount: number;
  decidedCount: number;
  wins: number;
  rawWinRate: number | null;
  expectedWinRate: number | null;
  adjustedWinDelta: number | null;
  offeredCount: number;
  pickedOrBoughtCount: number;
  pickRate: number | null;
  funRatedCount: number;
  funRate: number | null;
  avgDpm: number;
  avgTriggeredShare: number;
  lowSample: boolean;
  status: BalanceStatus;
}

export interface SegmentFunMetric {
  label: string;
  sample: number;
  funRate: number | null;
}

export interface TagCountRow {
  tag: FunTag;
  label: string;
  polarity: 'up' | 'down';
  count: number;
  sharePct: number;
}

export interface PlayerJourneySummary {
  distinctId: string;
  playerCode: string;
  stage: JourneyStage;
  totalFights: number;
  wins: number;
  winRate: number | null;
  funRate: number | null;
  highestLevelOrder: number;
  highestLevelId: string;
  daysActive: number;
  lastPlayedMs: number;
  lastOutcome: BattleOutcome;
}

export interface AnalyticsDashboardReport {
  totalFights: number;
  adventureFights: number;
  spireFights: number;
  freePlayFights: number;
  classicFights: number;
  uniquePlayers: number;
  sessionsCount: number;
  avgFightsPerSession: number;
  overallWinRate: number | null;
  abandonRate: number;
  funRatedCount: number;
  funUpCount: number;
  funDownCount: number;
  overallFunRate: number | null;
  funConfidenceInterval: [number, number] | null;
  retention: RetentionPoint[];
  journeyBreakdown: { stage: JourneyStage; players: number; fights: number; funRate: number | null }[];
  funnel: FunnelRow[];
  balance: {
    weapons: BalanceRow[];
    fighters: BalanceRow[];
    evolutions: BalanceRow[];
    arcana: BalanceRow[];
  };
  enjoyment: {
    winFunRate: number | null;
    lossFunRate: number | null;
    closeCallFunRate: number | null;
    normalFunRate: number | null;
    fastBoardFunRate: number | null;
    droughtFunRate: number | null;
    diedWithHintsRate: number | null;
    segments: SegmentFunMetric[];
    modeBreakdown: { mode: FightMode; fights: number; funRate: number | null; avgDurationMs: number }[];
    tags: TagCountRow[];
  };
  players: PlayerJourneySummary[];
  filterAudit: DashboardFilterAudit;
}

const VALID_TAGS = new Set<string>([
  ...POSITIVE_FUN_TAGS.map(t => t.id),
  ...NEGATIVE_FUN_TAGS.map(t => t.id),
]);

const LEVEL_ORDER_MAP = new Map<string, { order: number; name: string; world: number }>(
  MAIN_LEVELS.map((l, idx) => [
    l.id,
    { order: idx + 1, name: l.name, world: Number(l.id.split('-')[0]) || 1 },
  ])
);

const WEAPON_NAME_MAP = new Map<string, string>();
const EVO_NAME_MAP = new Map<string, string>(EVOLUTION_RECIPES.map(e => [e.id, e.name]));
const ARCANA_NAME_MAP = new Map<string, string>(ARCANA.map(a => [a.id, a.name]));

const resolveWeaponName = (id: string): string => {
  const cached = WEAPON_NAME_MAP.get(id);
  if (cached) return cached;
  const resolved = armoryBaseWeapon(id)?.name ?? id;
  WEAPON_NAME_MAP.set(id, resolved);
  return resolved;
};

const toDayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const asStringArray = (val: unknown): string[] => {
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === 'string');
  if (typeof val === 'string' && val.startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
};

const isWinOutcome = (outcome: BattleOutcome): boolean => outcome === 'won' || outcome === 'survived';
const isDecidedOutcome = (outcome: BattleOutcome): boolean =>
  outcome === 'won' || outcome === 'survived' || outcome === 'lost';

/** 95% Wilson score interval for proportions so small samples don't mislead. */
export const wilsonCI = (successes: number, total: number): [number, number] | null => {
  if (total <= 0) return null;
  const z = 1.96;
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom;
  return [
    Math.max(0, Math.round((center - half) * 1000) / 1000),
    Math.min(1, Math.round((center + half) * 1000) / 1000),
  ];
};

const num = (v: unknown, fallback = 0): number => {
  const parsed = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const optNum = (v: unknown): number | null => {
  const parsed = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeOutcome = (v: unknown): BattleOutcome => {
  if (v === 'won' || v === 'survived' || v === 'lost' || v === 'practice' || v === 'left') return v;
  return 'left';
};

const normalizeMode = (v: unknown, levelId: string): FightMode => {
  if (v === 'free_play' || v === 'classic' || v === 'adventure' || v === 'spire') return v;
  if (levelId.startsWith('spire-')) return 'spire';
  if (levelId.startsWith('freeplay')) return 'free_play';
  if (levelId.startsWith('classic')) return 'classic';
  return 'adventure';
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

export const normalizeBattleRecord = (
  b: BattleRecord,
  identity: { distinctId?: string; playerCode?: string } = {}
): NormalizedFightRow => {
  const meta = LEVEL_ORDER_MAP.get(b.levelId);
  const ts = b.at;
  const did = identity.distinctId ?? 'local-player';
  return {
    fightId: b.fightId ?? `${b.at}-${b.levelId}`,
    distinctId: did,
    playerCode: identity.playerCode ?? 'LOCAL',
    sessionId: `local-${toDayKey(ts)}`,
    timestampMs: ts,
    dayKey: toDayKey(ts),
    appVersion: null,
    balanceEra: null,
    env: 'local',
    practice: b.outcome === 'practice' || Boolean(b.replay?.sandbox),
    mode: 'adventure',
    levelId: b.levelId,
    levelName: b.levelName || meta?.name || b.levelId,
    levelOrder: meta?.order ?? 0,
    world: meta?.world ?? (Number(b.levelId.split('-')[0]) || 1),
    fighter: b.fighter,
    foe: b.foe,
    outcome: b.outcome,
    stars: b.stars,
    durationMs: b.durationMs,
    damage: b.damage,
    dpm: b.dpm,
    sets: b.sets,
    mistakes: b.mistakes,
    helpedSets: 0,
    hintsUsed: 0,
    gracesUsed: 0,
    biggestHitShare: b.damage > 0 ? Math.round((b.biggestHit / b.damage) * 1000) / 1000 : 0,
    triggeredDamageShare: 0,
    medianFindMs: null,
    maxDroughtMs: b.durationMs,
    closeCall: false,
    diedWithHints: false,
    weapons: normalizeWeaponIds(b.weapons ?? []),
    weaponsOffered: [],
    weaponsPicked: [],
    weaponsBought: [],
    evolutions: [],
    arcana: b.replay?.arcana ?? [],
    funRating: b.funRating ?? null,
    funTags: (b.funTags ?? []).filter((t): t is FunTag => VALID_TAGS.has(t)),
  };
};

export const normalizePostHogLikeEvent = (raw: Record<string, unknown>): NormalizedFightRow | null => {
  const nested =
    raw.properties && typeof raw.properties === 'object' && !Array.isArray(raw.properties)
      ? (raw.properties as Record<string, unknown>)
      : null;
  const p = nested ? { ...raw, ...nested } : raw;

  const eventName = typeof raw.event === 'string' ? raw.event : 'fight_ended';
  if (eventName !== 'fight_ended') return null;

  const tsRaw = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : num(raw.timestamp, Date.now());
  const timestampMs = Number.isFinite(tsRaw) ? tsRaw : Date.now();
  const levelId =
    typeof p.level_id === 'string'
      ? p.level_id
      : typeof p.levelId === 'string'
        ? p.levelId
        : typeof p.level === 'string'
          ? p.level
          : 'unknown';
  const meta = LEVEL_ORDER_MAP.get(levelId);
  const mode = normalizeMode(p.mode, levelId);
  const outcome = normalizeOutcome(p.outcome);
  const funRaw = p.fun_rating ?? p.funRating;
  const funRating: FunRating | null = funRaw === 'up' || funRaw === 'down' ? funRaw : null;

  const rawVersion =
    typeof p.app_version === 'string'
      ? p.app_version
      : typeof p.$app_version === 'string'
        ? p.$app_version
        : typeof p.appVersion === 'string'
          ? p.appVersion
          : null;
  const appVersion =
    rawVersion && semverToNumeric(rawVersion) !== null ? rawVersion.replace(/^v/, '').trim() : null;
  const balanceEra =
    typeof p.balance_era === 'string' && p.balance_era.trim() !== ''
      ? p.balance_era.trim()
      : getEraForVersion(appVersion)?.id ?? null;

  const fightId =
    typeof p.fight_id === 'string'
      ? p.fight_id
      : typeof p.fightId === 'string'
        ? p.fightId
        : typeof raw.uuid === 'string'
          ? raw.uuid
          : `${timestampMs}-${levelId}`;

  return {
    fightId,
    distinctId:
      typeof raw.distinct_id === 'string'
        ? raw.distinct_id
        : typeof raw.distinctId === 'string'
          ? raw.distinctId
          : typeof p.distinct_id === 'string'
            ? p.distinct_id
            : 'anon',
    playerCode: typeof p.player_code === 'string' ? p.player_code : 'ANON',
    sessionId: typeof p.$session_id === 'string' ? p.$session_id : `sess-${toDayKey(timestampMs)}`,
    timestampMs,
    dayKey: toDayKey(timestampMs),
    appVersion,
    balanceEra,
    env: typeof p.env === 'string' && p.env.trim() !== '' ? p.env.trim().toLowerCase() : undefined,
    practice: Boolean(p.practice) || outcome === 'practice',
    mode,
    levelId,
    levelName: typeof p.level_name === 'string' ? p.level_name : meta?.name ?? levelId,
    levelOrder: num(p.level_order, meta?.order ?? 0),
    world: num(p.world, meta?.world ?? (Number(levelId.split('-')[0]) || 1)),
    spireAct: optNum(p.spire_act ?? p.spireAct),
    spireFloor: optNum(p.spire_floor ?? p.spireFloor),
    spireAscension: optNum(p.spire_ascension ?? p.spireAscension),
    spireNodeKind:
      typeof p.spire_node_kind === 'string'
        ? p.spire_node_kind
        : typeof p.spireNodeKind === 'string'
          ? p.spireNodeKind
          : null,
    fighter: typeof p.fighter === 'string' ? p.fighter : 'Unknown',
    foe: typeof p.foe === 'string' ? p.foe : 'Unknown',
    outcome,
    stars: num(p.stars, 0),
    durationMs: num(p.duration_ms ?? p.durationMs, 0),
    damage: num(p.damage, 0),
    dpm: num(p.dpm, 0),
    sets: num(p.sets, 0),
    mistakes: num(p.mistakes, 0),
    helpedSets: num(p.helped_sets ?? p.helpedSets, 0),
    hintsUsed: num(p.hints_used ?? p.hintsUsed, 0),
    gracesUsed: num(p.graces_used ?? p.gracesUsed, 0),
    biggestHitShare: num(p.biggest_hit_share ?? p.biggestHitShare, 0),
    triggeredDamageShare: num(p.triggered_damage_share, 0),
    medianFindMs: optNum(p.median_find_ms),
    maxDroughtMs: num(p.max_drought_ms, num(p.duration_ms, 0)),
    closeCall: Boolean(p.close_call),
    diedWithHints: Boolean(p.died_with_hints),
    weapons: normalizeWeaponIds(asStringArray(p.weapons)),
    weaponsOffered: normalizeWeaponBag(asStringArray(p.weapons_offered)),
    weaponsPicked: normalizeWeaponBag(asStringArray(p.weapons_picked)),
    weaponsBought: normalizeWeaponBag(asStringArray(p.weapons_bought)),
    evolutions: asStringArray(p.evolutions_forged ?? p.evolutionsForged),
    arcana: asStringArray(p.arcana),
    funRating,
    funTags: asStringArray(p.fun_tags).filter((t): t is FunTag => VALID_TAGS.has(t)),
    journeyStage: typeof p.journey_stage === 'string' ? (p.journey_stage as JourneyStage) : undefined,
  };
};

const zipHogqlTabular = (columns: string[], rows: unknown[][]): Record<string, unknown>[] =>
  rows.map(r => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      const val = r[i];
      if (col === 'properties' && typeof val === 'string') {
        try {
          obj[col] = JSON.parse(val);
        } catch {
          obj[col] = {};
        }
      } else {
        obj[col] = val;
      }
    });
    return obj;
  });

/**
 * Parses raw text from JSON arrays, NDJSON (newline-delimited JSON), PostHog
 * `{ results }`/`{ events }`/`{ batch }` envelopes, or HogQL `{ columns, results: [[...]] }`
 * tables into deduplicated normalized rows (folding retrospective `fight_rated` events).
 */
export const parseAnalyticsImportJson = (rawText: string): { rows: NormalizedFightRow[]; error?: string } => {
  const trimmed = rawText.trim();
  if (!trimmed) return { rows: [], error: 'Empty input.' };

  let list: unknown[] = [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (
        Array.isArray(obj.columns) &&
        obj.columns.every((c): c is string => typeof c === 'string') &&
        Array.isArray(obj.results) &&
        obj.results.every(r => Array.isArray(r))
      ) {
        list = zipHogqlTabular(obj.columns, obj.results as unknown[][]);
      } else if (Array.isArray(obj.results)) {
        list = obj.results;
      } else if (Array.isArray(obj.events)) {
        list = obj.events;
      } else if (Array.isArray(obj.batch)) {
        list = obj.batch;
      } else if (Array.isArray(obj.fights)) {
        list = obj.fights;
      } else if (typeof obj.event === 'string' || typeof obj.fight_id === 'string') {
        list = [obj];
      }
    }
  } catch (jsonErr) {
    // Fallback: parse as NDJSON (one JSON object per non-empty line)
    const lines = trimmed
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return { rows: [], error: jsonErr instanceof Error ? jsonErr.message : 'Invalid JSON' };
    }
    const ndItems: unknown[] = [];
    for (const line of lines) {
      try {
        ndItems.push(JSON.parse(line));
      } catch {
        return { rows: [], error: jsonErr instanceof Error ? jsonErr.message : 'Invalid JSON / NDJSON' };
      }
    }
    list = ndItems;
  }

  if (list.length === 0) return { rows: [], error: 'No fight_ended events found in JSON.' };

  const byFightId = new Map<string, NormalizedFightRow>();
  const lateRatings = new Map<string, { funRating: FunRating; funTags: FunTag[] }>();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    if (obj.event === 'fight_rated') {
      const props =
        obj.properties && typeof obj.properties === 'object' && !Array.isArray(obj.properties)
          ? (obj.properties as Record<string, unknown>)
          : obj;
      const fid = typeof props.fight_id === 'string' ? props.fight_id : null;
      const rating = props.fun_rating === 'up' || props.fun_rating === 'down' ? props.fun_rating : null;
      if (fid && rating) {
        const tags = asStringArray(props.fun_tags).filter((t): t is FunTag => VALID_TAGS.has(t));
        lateRatings.set(fid, { funRating: rating, funTags: tags });
      }
      continue;
    }

    const normalized =
      typeof obj.levelId === 'string' && typeof obj.at === 'number'
        ? normalizeBattleRecord(obj as unknown as BattleRecord)
        : normalizePostHogLikeEvent(obj);
    if (!normalized) continue;

    const prev = byFightId.get(normalized.fightId);
    if (prev) {
      const newer = normalized.timestampMs >= prev.timestampMs ? normalized : prev;
      const older = newer === normalized ? prev : normalized;
      byFightId.set(normalized.fightId, {
        ...newer,
        funRating: newer.funRating ?? older.funRating,
        funTags: newer.funTags.length > 0 ? newer.funTags : older.funTags,
      });
    } else {
      byFightId.set(normalized.fightId, normalized);
    }
  }

  for (const [fid, late] of lateRatings.entries()) {
    const existing = byFightId.get(fid);
    if (!existing) continue;
    existing.funRating = late.funRating;
    if (late.funTags.length > 0) existing.funTags = late.funTags;
  }

  const rows = Array.from(byFightId.values()).sort((a, b) => a.timestampMs - b.timestampMs);
  if (rows.length === 0) return { rows: [], error: 'JSON parsed, but contained 0 fight_ended records.' };
  return { rows };
};

/** Combines local analytics events + fallback BattleRecords cleanly without double-counting matching fightIds. */
export const mergeLocalAnalyticsSources = (
  localEvents: readonly LocalAnalyticsEvent[],
  history: readonly BattleRecord[],
  identity: { distinctId?: string; playerCode?: string } = {}
): NormalizedFightRow[] => {
  const byFightId = new Map<string, NormalizedFightRow>();

  for (const b of history) {
    const row = normalizeBattleRecord(b, identity);
    byFightId.set(row.fightId, row);
  }
  for (const ev of localEvents) {
    if (ev.event !== 'fight_ended') continue;
    const row = normalizePostHogLikeEvent(ev as unknown as Record<string, unknown>);
    if (!row) continue;
    const prev = byFightId.get(row.fightId);
    // Preserve fun feedback synced on BattleRecord if local event lacked it
    byFightId.set(row.fightId, {
      ...row,
      funRating: row.funRating ?? prev?.funRating ?? null,
      funTags: row.funTags.length > 0 ? row.funTags : prev?.funTags ?? [],
    });
  }
  return Array.from(byFightId.values()).sort((a, b) => a.timestampMs - b.timestampMs);
};

const stageOfPlayer = (maxOrder: number, cleared: number, advFights: number, fpFights: number): JourneyStage => {
  if (cleared >= 12 || maxOrder >= 20) return 'veteran';
  if (maxOrder >= 15) return 'late_adventure';
  if (maxOrder >= 7) return 'mid_adventure';
  if (advFights > 0 && cleared >= 1) return 'early_adventure';
  if (fpFights >= 2 && advFights === 0) return 'free_play_explorer';
  return advFights + fpFights > 0 ? 'onboarding' : 'new_player';
};

const applyDashboardFilters = (
  rawRows: readonly NormalizedFightRow[],
  options: AnalyzeFightsOptions
): { rows: NormalizedFightRow[]; filterAudit: DashboardFilterAudit } => {
  const eraScope = options.eraScope ?? 'all';
  const modeFilter = options.modeFilter ?? 'all';
  const hygiene = options.hygiene ?? 'off';
  const includeDev = options.includeDev ?? false;

  let activeMinVersion: string | null = null;
  if (eraScope === 'current') {
    activeMinVersion = getMinValidVersion('all', undefined, modeFilter === 'all' ? undefined : modeFilter);
  } else if (eraScope !== 'all') {
    const era = getEraById(eraScope);
    if (era) activeMinVersion = era.minVersion;
    else if (semverToNumeric(eraScope) !== null) activeMinVersion = eraScope;
  }

  const filterAudit: DashboardFilterAudit = {
    inputCount: rawRows.length,
    keptCount: 0,
    droppedByVersion: 0,
    droppedByEnv: 0,
    droppedByMode: 0,
    droppedByPractice: 0,
    droppedByBug: 0,
    droppedByShort: 0,
    droppedByCoached: 0,
    activeMinVersion,
    eraScope,
    hygiene,
  };

  const kept: NormalizedFightRow[] = [];
  for (const r of rawRows) {
    if (modeFilter !== 'all' && r.mode !== modeFilter) {
      filterAudit.droppedByMode += 1;
      continue;
    }
    if (activeMinVersion !== null && !isVersionAtLeast(r.appVersion, activeMinVersion)) {
      filterAudit.droppedByVersion += 1;
      continue;
    }
    if (hygiene === 'prod_clean') {
      if (!includeDev && r.env !== 'prod') {
        filterAudit.droppedByEnv += 1;
        continue;
      }
      if (r.practice || r.outcome === 'practice') {
        filterAudit.droppedByPractice += 1;
        continue;
      }
      if (r.funTags.includes('bug_in_game')) {
        filterAudit.droppedByBug += 1;
        continue;
      }
      if (r.sets < 3 || r.durationMs < 10_000) {
        filterAudit.droppedByShort += 1;
        continue;
      }
      if (r.mode === 'adventure') {
        const helped = r.helpedSets ?? 0;
        if (r.levelId === '1-1' || (r.sets > 0 && helped / r.sets > 0.5)) {
          filterAudit.droppedByCoached += 1;
          continue;
        }
      }
    }
    kept.push(r);
  }

  kept.sort((a, b) => a.timestampMs - b.timestampMs);
  filterAudit.keptCount = kept.length;
  return { rows: kept, filterAudit };
};

export const analyzeFights = (
  rawRows: readonly NormalizedFightRow[],
  options: AnalyzeFightsOptions = {}
): AnalyticsDashboardReport => {
  const { rows, filterAudit } = applyDashboardFilters(rawRows, options);
  const totalFights = rows.length;
  const adventureRows = rows.filter(r => r.mode === 'adventure');
  const spireRows = rows.filter(r => r.mode === 'spire');
  const freePlayRows = rows.filter(r => r.mode === 'free_play');
  const classicRows = rows.filter(r => r.mode === 'classic');

  const uniquePlayersSet = new Set(rows.map(r => r.distinctId));
  const sessionsSet = new Set(rows.map(r => r.sessionId));
  const decidedAll = rows.filter(r => isDecidedOutcome(r.outcome));
  const winsAll = decidedAll.filter(r => isWinOutcome(r.outcome));
  const abandonsAll = rows.filter(r => r.outcome === 'left');

  const ratedAll = rows.filter(r => r.funRating !== null);
  const funUpAll = ratedAll.filter(r => r.funRating === 'up');
  const funDownAll = ratedAll.filter(r => r.funRating === 'down');

  // --- Player Journeys & Cohort Retention ---
  const byPlayer = new Map<string, NormalizedFightRow[]>();
  for (const r of rows) {
    const list = byPlayer.get(r.distinctId) ?? [];
    list.push(r);
    byPlayer.set(r.distinctId, list);
  }

  const maxDataTimestampMs = rows.reduce((m, r) => Math.max(m, r.timestampMs), 0);
  const retentionDays = [0, 1, 3, 7, 14, 30];
  const retentionStats = retentionDays.map(day => ({ day, eligible: 0, retained: 0 }));

  const players: PlayerJourneySummary[] = [];
  const stageMap = new Map<JourneyStage, { players: number; fights: number; up: number; rated: number }>();

  for (const [did, pRows] of byPlayer.entries()) {
    const firstMs = pRows[0].timestampMs;
    const lastRow = pRows[pRows.length - 1];
    const activeDayKeys = new Set(pRows.map(r => r.dayKey));
    const activeOffsetDays = new Set(pRows.map(r => Math.floor((r.timestampMs - firstMs) / 86_400_000)));
    const playerSpanDays = Math.floor((maxDataTimestampMs - firstMs) / 86_400_000);

    for (let i = 0; i < retentionDays.length; i++) {
      const targetDay = retentionDays[i];
      if (playerSpanDays >= targetDay) {
        retentionStats[i].eligible += 1;
        if (targetDay === 0 || activeOffsetDays.has(targetDay) || activeOffsetDays.has(targetDay + 1)) {
          retentionStats[i].retained += 1;
        }
      }
    }

    const pDecided = pRows.filter(r => isDecidedOutcome(r.outcome));
    const pWins = pDecided.filter(r => isWinOutcome(r.outcome));
    const pRated = pRows.filter(r => r.funRating !== null);
    const pUp = pRated.filter(r => r.funRating === 'up').length;
    const pClearedSet = new Set(pRows.filter(r => r.mode === 'adventure' && isWinOutcome(r.outcome)).map(r => r.levelId));

    let maxOrder = 0;
    let highestLevelId = pRows[0].levelId;
    for (const r of pRows) {
      if (r.levelOrder >= maxOrder) {
        maxOrder = r.levelOrder;
        highestLevelId = r.levelId;
      }
    }
    const advCount = pRows.filter(r => r.mode === 'adventure').length;
    const fpCount = pRows.filter(r => r.mode === 'free_play').length;
    const stage = lastRow.journeyStage ?? stageOfPlayer(maxOrder, pClearedSet.size, advCount, fpCount);

    const prevStage = stageMap.get(stage) ?? { players: 0, fights: 0, up: 0, rated: 0 };
    stageMap.set(stage, {
      players: prevStage.players + 1,
      fights: prevStage.fights + pRows.length,
      up: prevStage.up + pUp,
      rated: prevStage.rated + pRated.length,
    });

    players.push({
      distinctId: did,
      playerCode: pRows[pRows.length - 1].playerCode,
      stage,
      totalFights: pRows.length,
      wins: pWins.length,
      winRate: pDecided.length > 0 ? pWins.length / pDecided.length : null,
      funRate: pRated.length > 0 ? pUp / pRated.length : null,
      highestLevelOrder: maxOrder,
      highestLevelId,
      daysActive: activeDayKeys.size,
      lastPlayedMs: lastRow.timestampMs,
      lastOutcome: lastRow.outcome,
    });
  }

  players.sort((a, b) => b.totalFights - a.totalFights);

  const retention: RetentionPoint[] = retentionStats.map(s => ({
    day: s.day,
    label: `D${s.day}`,
    eligiblePlayers: s.eligible,
    retainedPlayers: s.retained,
    rate: s.eligible > 0 ? Math.round((s.retained / s.eligible) * 1000) / 1000 : 0,
  }));

  const STAGE_ORDER: JourneyStage[] = [
    'new_player',
    'onboarding',
    'free_play_explorer',
    'early_adventure',
    'mid_adventure',
    'late_adventure',
    'veteran',
  ];
  const journeyBreakdown = STAGE_ORDER
    .filter(s => stageMap.has(s))
    .map(stage => {
      const s = stageMap.get(stage)!;
      return {
        stage,
        players: s.players,
        fights: s.fights,
        funRate: s.rated > 0 ? s.up / s.rated : null,
      };
    });

  // --- Campaign Funnel & Level Baselines ---
  const levelMap = new Map<string, NormalizedFightRow[]>();
  for (const r of adventureRows) {
    const list = levelMap.get(r.levelId) ?? [];
    list.push(r);
    levelMap.set(r.levelId, list);
  }

  // Track max levelOrder reached per player to measure true funnel attrition
  const playerMaxOrder = new Map<string, number>();
  for (const [did, pRows] of byPlayer.entries()) {
    let maxOrd = 0;
    for (const r of pRows) if (r.mode === 'adventure' && r.levelOrder > maxOrd) maxOrd = r.levelOrder;
    playerMaxOrder.set(did, maxOrd);
  }

  // Mode-aware stratum baselines prevent cross-mode Simpson's leakage (Adventure vs Spire vs Classic)
  const stratumKeyOf = (r: NormalizedFightRow): string => {
    if (r.mode === 'spire') {
      return `spire:${r.spireAct ?? r.world}:${r.spireNodeKind ?? 'std'}`;
    }
    return `${r.mode}:${r.levelId}`;
  };

  const stratumBaselineWinRate = new Map<string, number>();
  const stratumBuckets = new Map<string, { wins: number; decided: number }>();
  for (const r of rows) {
    if (r.practice || r.outcome === 'practice' || !isDecidedOutcome(r.outcome)) continue;
    const key = stratumKeyOf(r);
    const b = stratumBuckets.get(key) ?? { wins: 0, decided: 0 };
    b.decided += 1;
    if (isWinOutcome(r.outcome)) b.wins += 1;
    stratumBuckets.set(key, b);
  }
  for (const [k, b] of stratumBuckets.entries()) {
    if (b.decided > 0) stratumBaselineWinRate.set(k, b.wins / b.decided);
  }

  const orderedLevels = Array.from(levelMap.entries()).sort((a, b) => {
    const ordA = a[1][0]?.levelOrder ?? 0;
    const ordB = b[1][0]?.levelOrder ?? 0;
    if (ordA !== ordB) return ordA - ordB;
    return a[0].localeCompare(b[0]);
  });
  const topFunnelPlayers = Math.max(
    1,
    orderedLevels.length > 0 ? new Set(orderedLevels[0][1].map(r => r.distinctId)).size : uniquePlayersSet.size
  );

  const funnel: FunnelRow[] = orderedLevels.map(([levelId, lRows]) => {
    const sample = lRows[0];
    const playerIds = new Set(lRows.map(r => r.distinctId));
    const clearedIds = new Set(lRows.filter(r => isWinOutcome(r.outcome)).map(r => r.distinctId));
    const droppedHereCount = Array.from(playerIds).filter(
      did => (playerMaxOrder.get(did) ?? 0) <= sample.levelOrder && !clearedIds.has(did)
    ).length;

    const dec = lRows.filter(r => isDecidedOutcome(r.outcome));
    const wins = dec.filter(r => isWinOutcome(r.outcome)).length;
    const losses = lRows.filter(r => r.outcome === 'lost').length;
    const abandons = lRows.filter(r => r.outcome === 'left').length;
    const rated = lRows.filter(r => r.funRating !== null);
    const funUp = rated.filter(r => r.funRating === 'up').length;
    const negTagCounts = new Map<FunTag, number>();
    for (const r of rated) {
      if (r.funRating === 'down') {
        for (const t of r.funTags) negTagCounts.set(t, (negTagCounts.get(t) ?? 0) + 1);
      }
    }
    let topNegativeTag: string | null = null;
    let bestTagCount = 0;
    for (const [t, c] of negTagCounts.entries()) {
      if (c > bestTagCount) {
        bestTagCount = c;
        topNegativeTag = FUN_TAG_LABELS[t];
      }
    }

    const winRate = dec.length > 0 ? wins / dec.length : 1;
    const abandonRate = lRows.length > 0 ? abandons / lRows.length : 0;
    const funRate = rated.length > 0 ? funUp / rated.length : null;
    const nextLevelDropPct = playerIds.size > 0 ? droppedHereCount / playerIds.size : 0;
    const frictionScore =
      lRows.length >= 3
        ? Math.round(
            Math.min(
              100,
              (nextLevelDropPct * 0.4 + (1 - winRate) * 0.25 + abandonRate * 0.2 + (funRate !== null ? (1 - funRate) * 0.15 : 0)) *
                100
            )
          )
        : 0;

    return {
      levelId,
      levelName: sample.levelName,
      levelOrder: sample.levelOrder,
      world: sample.world,
      playersReached: playerIds.size,
      playersCleared: clearedIds.size,
      funnelPct: Math.min(1, playerIds.size / topFunnelPlayers),
      nextLevelDropPct,
      attempts: lRows.length,
      wins,
      losses,
      abandons,
      winRate,
      abandonRate,
      attemptsPerClear: clearedIds.size > 0 ? Math.round((lRows.length / clearedIds.size) * 100) / 100 : null,
      avgDurationMs: Math.round(lRows.reduce((s, r) => s + r.durationMs, 0) / Math.max(1, lRows.length)),
      avgDpm: Math.round(lRows.reduce((s, r) => s + r.dpm, 0) / Math.max(1, lRows.length)),
      funRatedCount: rated.length,
      funUpCount: funUp,
      funRate,
      diedWithHintsPct: losses > 0 ? lRows.filter(r => r.outcome === 'lost' && r.diedWithHints).length / losses : 0,
      closeCallPct: lRows.length > 0 ? lRows.filter(r => r.closeCall).length / lRows.length : 0,
      topNegativeTag,
      churnWallScore: frictionScore,
    };
  });

  // --- Simpson's Paradox-Adjusted Balance Tables ---
  const buildBalanceTable = (
    category: BalanceCategory,
    extractIds: (r: NormalizedFightRow) => string[],
    nameOf: (id: string) => string
  ): BalanceRow[] => {
    interface Acc {
      used: number;
      decided: number;
      wins: number;
      expectedWinSum: number;
      dpmSum: number;
      trigSum: number;
      funRated: number;
      funUp: number;
      offered: number;
      picked: number;
    }
    const map = new Map<string, Acc>();
    const ensure = (id: string): Acc => {
      let a = map.get(id);
      if (!a) {
        a = { used: 0, decided: 0, wins: 0, expectedWinSum: 0, dpmSum: 0, trigSum: 0, funRated: 0, funUp: 0, offered: 0, picked: 0 };
        map.set(id, a);
      }
      return a;
    };

    for (const r of rows) {
      // Exclude sandbox practice and endless free_play (no win/loss) from competitive balance metrics
      if (r.practice || r.outcome === 'practice' || r.mode === 'free_play') continue;

      if (category === 'weapon') {
        for (const id of r.weaponsOffered) ensure(id).offered += 1;
        for (const id of r.weaponsPicked) ensure(id).picked += 1;
        for (const id of r.weaponsBought) ensure(id).picked += 1;
      }

      const uniqueIds = new Set(extractIds(r));
      const baseWin = stratumBaselineWinRate.get(stratumKeyOf(r));
      const decided = isDecidedOutcome(r.outcome) && baseWin !== undefined;
      const won = isWinOutcome(r.outcome);

      for (const id of uniqueIds) {
        const a = ensure(id);
        a.used += 1;
        a.dpmSum += r.dpm;
        a.trigSum += r.triggeredDamageShare;
        if (r.funRating === 'up') {
          a.funRated += 1;
          a.funUp += 1;
        } else if (r.funRating === 'down') {
          a.funRated += 1;
        }
        if (decided) {
          a.decided += 1;
          if (won) a.wins += 1;
          a.expectedWinSum += baseWin!;
        }
      }
    }

    return Array.from(map.entries())
      .map(([id, a]): BalanceRow => {
        const rawWinRate = a.decided > 0 ? a.wins / a.decided : null;
        const expectedWinRate = a.decided > 0 ? a.expectedWinSum / a.decided : null;
        const adjustedWinDelta =
          rawWinRate !== null && expectedWinRate !== null
            ? Math.round((rawWinRate - expectedWinRate) * 1000) / 1000
            : null;
        const pickRate = a.offered > 0 ? a.picked / a.offered : null;
        const funRate = a.funRated > 0 ? a.funUp / a.funRated : null;
        const lowSample = a.used < 5;

        let status: BalanceStatus = 'balanced';
        if (lowSample) status = 'low_sample';
        else if (adjustedWinDelta !== null && adjustedWinDelta >= 0.08 && a.used >= 8) status = 'overpowered';
        else if (adjustedWinDelta !== null && adjustedWinDelta <= -0.08 && a.used >= 8) status = 'undertuned';
        else if (funRate !== null && funRate < 0.58 && a.funRated >= 5) status = 'frustrating';
        else if (funRate !== null && funRate >= 0.8 && (adjustedWinDelta ?? 0) >= -0.04) status = 'crowd_pleaser';

        return {
          id,
          name: nameOf(id),
          category,
          usedCount: a.used,
          decidedCount: a.decided,
          wins: a.wins,
          rawWinRate,
          expectedWinRate,
          adjustedWinDelta,
          offeredCount: a.offered,
          pickedOrBoughtCount: a.picked,
          pickRate,
          funRatedCount: a.funRated,
          funRate,
          avgDpm: a.used > 0 ? Math.round(a.dpmSum / a.used) : 0,
          avgTriggeredShare: a.used > 0 ? Math.round((a.trigSum / a.used) * 1000) / 1000 : 0,
          lowSample,
          status,
        };
      })
      .sort((a, b) => b.usedCount - a.usedCount);
  };

  const weapons = buildBalanceTable('weapon', r => r.weapons, resolveWeaponName);
  const fighters = buildBalanceTable('fighter', r => (r.fighter && r.fighter !== 'Unknown' ? [r.fighter] : []), id => id);
  const evolutions = buildBalanceTable('evolution', r => r.evolutions, id => EVO_NAME_MAP.get(id) ?? id);
  const arcana = buildBalanceTable('arcana', r => r.arcana, id => ARCANA_NAME_MAP.get(id) ?? id);

  // --- Enjoyment vs Friction Diagnostics ---
  const funRateOf = (subset: readonly NormalizedFightRow[]): number | null => {
    const r = subset.filter(x => x.funRating !== null);
    if (r.length === 0) return null;
    return r.filter(x => x.funRating === 'up').length / r.length;
  };

  const winRows = rows.filter(r => isWinOutcome(r.outcome));
  const lossRows = rows.filter(r => r.outcome === 'lost');
  const closeCallRows = rows.filter(r => r.closeCall);
  const normalCallRows = rows.filter(r => !r.closeCall);
  const fastBoardRows = rows.filter(r => r.maxDroughtMs <= 12_000);
  const droughtRows = rows.filter(r => r.maxDroughtMs > 18_000);

  const tagCounts = new Map<FunTag, number>();
  let totalTagApplications = 0;
  for (const r of ratedAll) {
    for (const tag of r.funTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      totalTagApplications += 1;
    }
  }
  const tags: TagCountRow[] = [
    ...POSITIVE_FUN_TAGS.map(t => ({ ...t, polarity: 'up' as const })),
    ...NEGATIVE_FUN_TAGS.map(t => ({ ...t, polarity: 'down' as const })),
  ]
    .map(t => {
      const c = tagCounts.get(t.id) ?? 0;
      return {
        tag: t.id,
        label: t.label,
        polarity: t.polarity,
        count: c,
        sharePct: totalTagApplications > 0 ? Math.round((c / totalTagApplications) * 1000) / 1000 : 0,
      };
    })
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const modeBreakdown = (['adventure', 'spire', 'free_play', 'classic'] as FightMode[]).map(mode => {
    const subset = rows.filter(r => r.mode === mode);
    return {
      mode,
      fights: subset.length,
      funRate: funRateOf(subset),
      avgDurationMs: subset.length > 0 ? Math.round(subset.reduce((s, r) => s + r.durationMs, 0) / subset.length) : 0,
    };
  });

  const segments: SegmentFunMetric[] = [
    { label: 'Wins / Survived', sample: winRows.filter(r => r.funRating !== null).length, funRate: funRateOf(winRows) },
    { label: 'Losses', sample: lossRows.filter(r => r.funRating !== null).length, funRate: funRateOf(lossRows) },
    { label: 'Close Calls', sample: closeCallRows.filter(r => r.funRating !== null).length, funRate: funRateOf(closeCallRows) },
    { label: 'Fast Boards (<=12s drought)', sample: fastBoardRows.filter(r => r.funRating !== null).length, funRate: funRateOf(fastBoardRows) },
    { label: 'Board Drought (>18s)', sample: droughtRows.filter(r => r.funRating !== null).length, funRate: funRateOf(droughtRows) },
  ];

  return {
    totalFights,
    adventureFights: adventureRows.length,
    spireFights: spireRows.length,
    freePlayFights: freePlayRows.length,
    classicFights: classicRows.length,
    uniquePlayers: uniquePlayersSet.size,
    sessionsCount: sessionsSet.size,
    avgFightsPerSession: sessionsSet.size > 0 ? Math.round((totalFights / sessionsSet.size) * 10) / 10 : 0,
    overallWinRate: decidedAll.length > 0 ? winsAll.length / decidedAll.length : null,
    abandonRate: totalFights > 0 ? abandonsAll.length / totalFights : 0,
    funRatedCount: ratedAll.length,
    funUpCount: funUpAll.length,
    funDownCount: funDownAll.length,
    overallFunRate: ratedAll.length > 0 ? funUpAll.length / ratedAll.length : null,
    funConfidenceInterval: wilsonCI(funUpAll.length, ratedAll.length),
    retention,
    journeyBreakdown,
    funnel,
    balance: { weapons, fighters, evolutions, arcana },
    enjoyment: {
      winFunRate: funRateOf(winRows),
      lossFunRate: funRateOf(lossRows),
      closeCallFunRate: funRateOf(closeCallRows),
      normalFunRate: funRateOf(normalCallRows),
      fastBoardFunRate: funRateOf(fastBoardRows),
      droughtFunRate: funRateOf(droughtRows),
      diedWithHintsRate:
        lossRows.length > 0 ? lossRows.filter(r => r.diedWithHints).length / lossRows.length : null,
      segments,
      modeBreakdown,
      tags,
    },
    players,
    filterAudit,
  };
};

// --- Deterministic Cohort Simulator (for sandboxed analytics exploration) ---
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickOne = <T>(arr: readonly T[], rng: () => number): T =>
  arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

/**
 * Generates a realistic, byte-deterministic multi-day cohort of players progressing
 * through NShapes Adventure + Free Play with authentic churn walls, weapon balance
 * deltas (including Simpson's Paradox conditions), close calls, droughts, and 👍/👎 feedback.
 */
export const generateSimulatedCohort = (
  seed: number = 20261115,
  playerCount: number = 60
): NormalizedFightRow[] => {
  const rng = mulberry32(seed);
  const rows: NormalizedFightRow[] = [];
  const startEpoch = Date.UTC(2026, 9, 25, 16, 0, 0);
  const fighterNames = FIGHTERS.map(f => f.name);
  const earlyWeapons = ['blast-powder', 'flint-spark', 'mending-charm', 'fortunes-favor', 'oracle-eye', 'chrono-shard'];
  const lateWeapons = ['chain-reaction', 'chaos-shard', 'soul-harvest', 'prismatic-ray', 'grace-conduit', 'echo-stone'];
  const allEvos = EVOLUTION_RECIPES.slice(0, 9).map(e => e.id);
  const allArcana = ARCANA.map(a => a.id);

  let fightSeq = 0;

  for (let pIdx = 0; pIdx < playerCount; pIdx++) {
    const distinctId = `sim-player-${String(pIdx + 1).padStart(3, '0')}`;
    const code = `NSH-SIM${String(pIdx + 1).padStart(3, '0')}`;
    const skillBias = (rng() - 0.48) * 0.24; // [-0.12, +0.12]
    const installDayOffset = Math.floor(rng() * 14);
    const maxPlayDays = 1 + Math.floor(rng() * 8);
    const favFighter = pickOne(fighterNames, rng);
    const prefersFreePlay = rng() < 0.16;

    let currentLevelIdx = 0;
    let churned = false;

    for (let d = 0; d < maxPlayDays && !churned; d++) {
      // Realistic retention drop after D0/D1
      if (d > 0 && rng() > (d === 1 ? 0.56 : 0.42)) continue;
      const dayTs = startEpoch + (installDayOffset + d) * 86_400_000 + Math.floor(rng() * 28_800_000);
      const sessionId = `${distinctId}-s${d + 1}`;
      const fightsInSession = 1 + Math.floor(rng() * 4);

      if (prefersFreePlay && rng() < 0.7) {
        const ts = dayTs + 120_000;
        const funRating: FunRating | null = rng() < 0.72 ? (rng() < 0.86 ? 'up' : 'down') : null;
        rows.push({
          fightId: `sim-fp-${++fightSeq}`,
          distinctId,
          playerCode: code,
          sessionId,
          timestampMs: ts,
          dayKey: toDayKey(ts),
          appVersion: CURRENT_BALANCE_ERA.minVersion,
          balanceEra: CURRENT_BALANCE_ERA_ID,
          env: 'prod',
          practice: false,
          mode: 'free_play',
          levelId: 'freeplay-medium',
          levelName: 'Free Play (medium)',
          levelOrder: 0,
          world: 0,
          fighter: favFighter,
          foe: 'Endless Board',
          outcome: 'left',
          stars: 0,
          durationMs: Math.round(90_000 + rng() * 180_000),
          damage: Math.round(80 + rng() * 220),
          dpm: Math.round(60 + rng() * 80),
          sets: 12 + Math.floor(rng() * 20),
          mistakes: Math.floor(rng() * 3),
          triggeredDamageShare: 0.15,
          medianFindMs: Math.round(3500 + rng() * 2500),
          maxDroughtMs: Math.round(9000 + rng() * 8000),
          closeCall: false,
          diedWithHints: false,
          weapons: [earlyWeapons[0], earlyWeapons[2]],
          weaponsOffered: [],
          weaponsPicked: [],
          weaponsBought: [],
          evolutions: [],
          arcana: [],
          funRating,
          funTags: funRating === 'up' ? ['satisfying_combos'] : funRating === 'down' ? ['too_slow'] : [],
        });
        continue;
      }

      for (let f = 0; f < fightsInSession && currentLevelIdx < MAIN_LEVELS.length; f++) {
        const level = MAIN_LEVELS[Math.min(currentLevelIdx, MAIN_LEVELS.length - 1)];
        const world = Number(level.id.split('-')[0]) || 1;
        const ts = dayTs + f * 240_000;

        // Intentional level difficulty + realistic churn wall around 1-6 / 2-3
        let baseLevelWin = Math.max(0.36, 0.9 - currentLevelIdx * 0.032);
        if (level.id === '1-6' || level.id === '2-3' || level.id === '3-2') baseLevelWin -= 0.16;

        const pool = world >= 2 ? [...earlyWeapons, ...lateWeapons] : earlyWeapons;
        const held = [pickOne(pool, rng), pickOne(pool, rng)];
        const uniqueHeld = Array.from(new Set(held));
        const picked = pickOne(pool, rng);
        const offered = Array.from(new Set([picked, pickOne(pool, rng), pickOne(pool, rng)]));
        const weapons = Array.from(new Set([...uniqueHeld, picked]));

        // Intentional weapon strength variance for dashboard diagnostics
        let buildMod = 0;
        if (weapons.includes('chain-reaction')) buildMod += 0.14;
        if (weapons.includes('mending-charm')) buildMod += 0.08;
        if (weapons.includes('chrono-shard')) buildMod -= 0.11;

        const arcanaPick = world >= 2 && rng() < 0.55 ? [pickOne(allArcana, rng)] : [];
        const winProb = Math.max(0.08, Math.min(0.96, baseLevelWin + skillBias + buildMod));
        const abandonProb = level.id === '2-3' ? 0.18 : 0.06;

        const roll = rng();
        let outcome: BattleOutcome;
        let stars = 0;
        if (roll < abandonProb) {
          outcome = 'left';
        } else if (roll < abandonProb + (1 - abandonProb) * winProb) {
          outcome = rng() < 0.18 ? 'survived' : 'won';
          stars = outcome === 'survived' ? 1 : rng() < 0.52 ? 3 : 2;
        } else {
          outcome = 'lost';
        }

        const droughtMs = Math.round((outcome === 'lost' || outcome === 'left' ? 11_000 : 6_500) + rng() * 14_000);
        const closeCall = (outcome === 'won' && rng() < 0.34) || (outcome === 'lost' && rng() < 0.3);
        const diedWithHints = outcome === 'lost' && rng() < 0.55;
        const evo = world >= 2 && rng() < 0.38 ? [pickOne(allEvos, rng)] : [];

        let funRating: FunRating | null = null;
        const funTags: FunTag[] = [];
        if (rng() < 0.68) {
          let funProb = outcome === 'left' ? 0.2 : outcome === 'lost' ? 0.38 : 0.84;
          if (closeCall && outcome === 'won') funProb += 0.1;
          if (droughtMs > 18_000) funProb -= 0.22;
          if (weapons.includes('chrono-shard')) funProb -= 0.12;
          funRating = rng() < Math.max(0.08, Math.min(0.96, funProb)) ? 'up' : 'down';
          if (funRating === 'up') {
            funTags.push(closeCall ? 'close_call' : weapons.includes('chain-reaction') ? 'great_build' : 'satisfying_combos');
          } else {
            funTags.push(droughtMs > 18_000 ? 'too_slow' : outcome === 'lost' ? 'too_hard' : 'unfair_rng');
          }
        }

        rows.push({
          fightId: `sim-${++fightSeq}`,
          distinctId,
          playerCode: code,
          sessionId,
          timestampMs: ts,
          dayKey: toDayKey(ts),
          appVersion: CURRENT_BALANCE_ERA.minVersion,
          balanceEra: CURRENT_BALANCE_ERA_ID,
          env: 'prod',
          practice: false,
          mode: 'adventure',
          levelId: level.id,
          levelName: level.name,
          levelOrder: currentLevelIdx + 1,
          world,
          fighter: favFighter,
          foe: level.foes[0]?.name ?? 'Foe',
          outcome,
          stars,
          durationMs: Math.round(55_000 + rng() * 95_000),
          damage: Math.round(level.foes.reduce((s, fDef) => s + fDef.hp, 0) * (outcome === 'lost' ? 0.72 : 1)),
          dpm: Math.round(70 + rng() * 140 + (weapons.includes('chain-reaction') ? 35 : 0)),
          sets: 6 + Math.floor(rng() * 14),
          mistakes: Math.floor(rng() * (outcome === 'lost' ? 5 : 2)),
          triggeredDamageShare: Math.round((0.15 + rng() * 0.45) * 100) / 100,
          medianFindMs: Math.round(3200 + rng() * 3500),
          maxDroughtMs: droughtMs,
          closeCall,
          diedWithHints,
          weapons,
          weaponsOffered: offered,
          weaponsPicked: [picked],
          weaponsBought: [],
          evolutions: evo,
          arcana: arcanaPick,
          funRating,
          funTags,
        });

        if (isWinOutcome(outcome)) {
          currentLevelIdx += 1;
        } else if (outcome === 'left' && rng() < 0.45) {
          churned = true;
          break;
        }
      }
    }
  }

  return rows;
};
