/**
 * Product analytics: a lightweight PostHog Batch API client engineered for
 * game analytics best practices.
 *
 * Design principles:
 * 1. Wide events, minimum event count: one rich `fight_ended` event per completed
 *    or exited fight + one `app_opened` event per app launch. Player fun ratings
 *    (thumbs up/down + tags) mutate the staged `fight_ended` event before commit.
 * 2. Cross-session user journey: stable anonymous `installId`, readable
 *    `playerCode`, rolling 30-min `$session_id`, `$set` / `$set_once` person
 *    profiles, journey stage classification, and optional `$identify` linking.
 * 3. Offline-first persistence: all queued and staged events survive restarts in
 *    MMKV and flush through `/batch/` with keepalive on web unload.
 * 4. Lifecycle safety: foreground/background hooks go exclusively through
 *    `@/utils/appLifecycle` to respect battery and single-gateway guardrails.
 */
import { Platform } from 'react-native';
import { storage } from '@/utils/storage';
import { subscribeAppActive } from '@/utils/appLifecycle';
import { version as APP_VERSION } from '../../package.json';
import {
  POSTHOG_HOST,
  POSTHOG_PROJECT_ID,
  POSTHOG_PROJECT_KEY,
  SESSION_TIMEOUT_MS,
} from './config';

export { POSTHOG_HOST, POSTHOG_PROJECT_KEY, POSTHOG_PROJECT_ID, SESSION_TIMEOUT_MS };

const KEYS = {
  install: 'analytics_install_id',
  distinctId: 'analytics_distinct_id',
  playerCode: 'analytics_player_code',
  queue: 'analytics_queue',
  optOut: 'analytics_opt_out',
  session: 'analytics_session',
  profile: 'analytics_profile',
  staged: 'analytics_staged_event',
  localHistory: 'analytics_local_history',
} as const;

/** The queue never holds more than this (web storage is ~5 MB); the oldest events go first. */
const MAX_QUEUE_BYTES = 1_500_000;
/** PostHog drops a single event over 1 MB */
const MAX_EVENT_BYTES = 900_000;
/** Compact local copy of recent committed events for the in-app analytics inspector */
const MAX_LOCAL_HISTORY_EVENTS = 120;

export type JourneyStage =
  | 'new_player'
  | 'onboarding'
  | 'early_adventure'
  | 'mid_adventure'
  | 'late_adventure'
  | 'veteran'
  | 'free_play_explorer';

export interface PlayerAnalyticsProfile {
  firstSeenAt: string;
  lastSeenAt: string;
  firstSeenDate: string;
  firstAppVersion: string;
  totalFights: number;
  totalWins: number;
  totalLosses: number;
  totalAbandons: number;
  totalPlayMs: number;
  adventureFights: number;
  freePlayFights: number;
  classicFights: number;
  funUpCount: number;
  funDownCount: number;
  highestWorldUnlocked: number;
  highestLevelOrder: number;
  highestLevelId: string | null;
  levelsClearedCount: number;
  starsTotal: number;
  unlocksCount: number;
  favoriteFighter: string | null;
  favoriteWeapon: string | null;
  fighterCounts: Record<string, number>;
  weaponCounts: Record<string, number>;
  sessionCount: number;
  initialMode: string | null;
}

export interface FightProfileUpdate {
  mode: 'adventure' | 'free_play' | 'classic';
  outcome: 'won' | 'survived' | 'lost' | 'practice' | 'left';
  durationMs: number;
  fighter?: string;
  weapons?: string[];
  levelOrder?: number;
  levelId?: string;
  world?: number;
  highestWorldUnlocked?: number;
  levelsClearedCount?: number;
  starsTotal?: number;
  unlocksCount?: number;
  funRating?: 'up' | 'down' | null;
}

export interface SessionInfo {
  sessionId: string;
  startedAtMs: number;
  lastActivityAtMs: number;
  sessionNumber: number;
  fightIndex: number;
}

export interface QueuedEvent {
  uuid: string;
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export interface LocalAnalyticsEvent {
  uuid: string;
  event: string;
  distinctId: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

interface StagedEvent {
  uuid: string;
  event: string;
  distinctId: string;
  fightId?: string;
  timestamp: string;
  properties: Record<string, unknown>;
  profileDelta?: FightProfileUpdate;
}

export interface CaptureOptions {
  /** Overrides `distinct_id` (used internally for `$identify`). */
  distinctId?: string;
  /** Profile update to fold into `$set` / `$set_once` before sending. */
  profileDelta?: FightProfileUpdate;
  /** Skip immediate HTTP flush (mainly for batching tests). */
  deferFlush?: boolean;
}

const TEST_DETERMINISTIC_UUID = '00000000-0000-4000-8000-000000000000';

let isTest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;
let flushing: Promise<void> | null = null;
let started = false;
let unsubscribeLifecycle: (() => void) | null = null;
let stagedMemory: StagedEvent | null | undefined;

/** Tests turn sending on to exercise the client against a mocked fetch. */
export const __enableAnalyticsForTests = () => {
  isTest = false;
};

/** Resets runtime singletons in Jest without breaking module imports. */
export const __resetAnalyticsForTests = () => {
  started = false;
  flushing = null;
  stagedMemory = undefined;
  if (unsubscribeLifecycle) {
    unsubscribeLifecycle();
    unsubscribeLifecycle = null;
  }
};

// Safe MMKV wrappers: partial mocks in unit tests may omit `storage.remove`.
const readKey = (key: string): string | undefined => {
  try {
    const val = storage.getString(key);
    return val && val.length > 0 ? val : undefined;
  } catch {
    return undefined;
  }
};

const writeKey = (key: string, val: string) => {
  try {
    storage.set(key, val);
  } catch {
    /* ignore storage quota failures */
  }
};

const removeKey = (key: string) => {
  try {
    const maybeStorage = storage as { remove?: (k: string) => void; set: (k: string, v: string) => void };
    if (typeof maybeStorage.remove === 'function') maybeStorage.remove(key);
    else maybeStorage.set(key, '');
  } catch {
    /* ignore */
  }
};

/** RFC 4122 v4 UUID; prefers CSPRNG so global `Math.random` overrides in tests are never perturbed. */
const uuid = (): string => {
  const gCrypto = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto : undefined;
  if (gCrypto && typeof gCrypto.randomUUID === 'function') {
    return gCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const fnv1aHex = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
};

/** Anonymous install UUID (stored persistently, no personal information). */
export const installId = (): string => {
  if (isTest) return TEST_DETERMINISTIC_UUID;
  let id = readKey(KEYS.install);
  if (!id) {
    id = uuid();
    writeKey(KEYS.install, id);
  }
  return id;
};

/** Active PostHog distinct_id: uses identified account ID if linked, otherwise anonymous installId. */
export const distinctId = (): string => readKey(KEYS.distinctId) ?? installId();

/** Short non-PII support/lookup identifier (e.g. `NSH-A1B2C3D4`) derived from `installId`. */
export const playerCode = (): string => {
  const cached = readKey(KEYS.playerCode);
  if (cached) return cached;
  const code = `NSH-${fnv1aHex(installId())}`;
  writeKey(KEYS.playerCode, code);
  return code;
};

/** True when the player opted out via Settings/Camp (independent of Jest test suppression). */
export const analyticsOptedOut = (): boolean => readKey(KEYS.optOut) === '1';

export const analyticsEnabled = (): boolean => !isTest && !analyticsOptedOut();

export const setAnalyticsEnabled = (on: boolean) => {
  if (on) {
    removeKey(KEYS.optOut);
    stagedMemory = undefined;
  } else {
    writeKey(KEYS.optOut, '1');
    removeKey(KEYS.queue);
    removeKey(KEYS.staged);
    removeKey(KEYS.session);
    stagedMemory = null;
  }
};

/** Wipes all analytics identifiers, staged events, session, profile, and local event history. */
export const resetPlayerIdentity = () => {
  stagedMemory = null;
  for (const key of Object.values(KEYS)) {
    if (key !== KEYS.optOut) removeKey(key);
  }
};

const emptyProfile = (nowIso: string): PlayerAnalyticsProfile => ({
  firstSeenAt: nowIso,
  lastSeenAt: nowIso,
  firstSeenDate: nowIso.slice(0, 10),
  firstAppVersion: APP_VERSION,
  totalFights: 0,
  totalWins: 0,
  totalLosses: 0,
  totalAbandons: 0,
  totalPlayMs: 0,
  adventureFights: 0,
  freePlayFights: 0,
  classicFights: 0,
  funUpCount: 0,
  funDownCount: 0,
  highestWorldUnlocked: 1,
  highestLevelOrder: 0,
  highestLevelId: null,
  levelsClearedCount: 0,
  starsTotal: 0,
  unlocksCount: 0,
  favoriteFighter: null,
  favoriteWeapon: null,
  fighterCounts: {},
  weaponCounts: {},
  sessionCount: 0,
  initialMode: null,
});

export const readPlayerProfile = (): PlayerAnalyticsProfile => {
  const nowIso = new Date().toISOString();
  const raw = readKey(KEYS.profile);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PlayerAnalyticsProfile>;
      if (parsed && typeof parsed.firstSeenAt === 'string') {
        return {
          ...emptyProfile(parsed.firstSeenAt),
          ...parsed,
          fighterCounts: parsed.fighterCounts ?? {},
          weaponCounts: parsed.weaponCounts ?? {},
        };
      }
    } catch {
      /* reset corrupt profile */
    }
  }
  const created = emptyProfile(nowIso);
  writeKey(KEYS.profile, JSON.stringify(created));
  return created;
};

const writePlayerProfile = (profile: PlayerAnalyticsProfile) => {
  writeKey(KEYS.profile, JSON.stringify(profile));
};

export const computeJourneyStage = (p: PlayerAnalyticsProfile): JourneyStage => {
  if (p.levelsClearedCount >= 12 || p.highestWorldUnlocked >= 4) return 'veteran';
  if (p.highestLevelOrder >= 15 || p.highestWorldUnlocked >= 3) return 'late_adventure';
  if (p.highestLevelOrder >= 7 || p.highestWorldUnlocked >= 2) return 'mid_adventure';
  if (p.adventureFights > 0 && p.levelsClearedCount >= 1) return 'early_adventure';
  if (p.freePlayFights >= 2 && p.adventureFights === 0) return 'free_play_explorer';
  if (p.totalFights >= 1) return 'onboarding';
  return 'new_player';
};

const topKey = (counts: Record<string, number>): string | null => {
  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [k, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestKey = k;
      bestCount = count;
    }
  }
  return bestKey;
};

const applyProfileDelta = (
  profile: PlayerAnalyticsProfile,
  delta: FightProfileUpdate | undefined,
  sessionNumber: number,
  nowIso: string
): PlayerAnalyticsProfile => {
  const next: PlayerAnalyticsProfile = {
    ...profile,
    fighterCounts: { ...profile.fighterCounts },
    weaponCounts: { ...profile.weaponCounts },
    lastSeenAt: nowIso,
    sessionCount: Math.max(profile.sessionCount, sessionNumber),
  };
  if (!delta) return next;

  next.totalFights += 1;
  if (delta.outcome === 'won' || delta.outcome === 'survived') next.totalWins += 1;
  else if (delta.outcome === 'lost') next.totalLosses += 1;
  else if (delta.outcome === 'left') next.totalAbandons += 1;

  next.totalPlayMs += Math.max(0, Math.round(delta.durationMs));
  if (!next.initialMode) next.initialMode = delta.mode;

  if (delta.mode === 'adventure') next.adventureFights += 1;
  else if (delta.mode === 'free_play') next.freePlayFights += 1;
  else next.classicFights += 1;

  if (delta.funRating === 'up') next.funUpCount += 1;
  else if (delta.funRating === 'down') next.funDownCount += 1;

  if (typeof delta.highestWorldUnlocked === 'number') {
    next.highestWorldUnlocked = Math.max(next.highestWorldUnlocked, delta.highestWorldUnlocked);
  }
  if (typeof delta.levelsClearedCount === 'number') {
    next.levelsClearedCount = Math.max(next.levelsClearedCount, delta.levelsClearedCount);
  }
  if (typeof delta.starsTotal === 'number') {
    next.starsTotal = Math.max(next.starsTotal, delta.starsTotal);
  }
  if (typeof delta.unlocksCount === 'number') {
    next.unlocksCount = Math.max(next.unlocksCount, delta.unlocksCount);
  }
  if (typeof delta.levelOrder === 'number' && delta.levelOrder > next.highestLevelOrder) {
    next.highestLevelOrder = delta.levelOrder;
    next.highestLevelId = delta.levelId ?? next.highestLevelId;
  }

  if (delta.fighter) {
    next.fighterCounts[delta.fighter] = (next.fighterCounts[delta.fighter] ?? 0) + 1;
    next.favoriteFighter = topKey(next.fighterCounts);
  }
  if (delta.weapons) {
    for (const w of delta.weapons) {
      next.weaponCounts[w] = (next.weaponCounts[w] ?? 0) + 1;
    }
    next.favoriteWeapon = topKey(next.weaponCounts);
  }

  return next;
};

const buildPersonProps = (profile: PlayerAnalyticsProfile) => {
  const decided = profile.totalWins + profile.totalLosses;
  const rated = profile.funUpCount + profile.funDownCount;
  const stage = computeJourneyStage(profile);
  return {
    stage,
    $set_once: {
      first_seen_at: profile.firstSeenAt,
      first_seen_date: profile.firstSeenDate,
      first_app_version: profile.firstAppVersion,
      install_platform: Platform.OS,
      initial_mode: profile.initialMode ?? 'unknown',
    },
    $set: {
      player_code: playerCode(),
      journey_stage: stage,
      app_version: APP_VERSION,
      last_seen_at: profile.lastSeenAt,
      total_fights: profile.totalFights,
      total_wins: profile.totalWins,
      total_losses: profile.totalLosses,
      total_abandons: profile.totalAbandons,
      win_rate: decided > 0 ? Math.round((profile.totalWins / decided) * 1000) / 1000 : null,
      fun_rate: rated > 0 ? Math.round((profile.funUpCount / rated) * 1000) / 1000 : null,
      fun_ratings_count: rated,
      adventure_fights: profile.adventureFights,
      free_play_fights: profile.freePlayFights,
      classic_fights: profile.classicFights,
      highest_world_unlocked: profile.highestWorldUnlocked,
      highest_level_order: profile.highestLevelOrder,
      highest_level_id: profile.highestLevelId,
      levels_cleared_count: profile.levelsClearedCount,
      stars_total: profile.starsTotal,
      unlocks_count: profile.unlocksCount,
      favorite_fighter: profile.favoriteFighter,
      favorite_weapon: profile.favoriteWeapon,
      session_count: profile.sessionCount,
      total_play_min: Math.round((profile.totalPlayMs / 60_000) * 10) / 10,
    },
  };
};

/** Touches the rolling 30-minute session window and optionally increments the fight index within the session. */
export const touchSession = (
  nowMs: number = Date.now(),
  opts: { incrementFight?: boolean } = {}
): SessionInfo => {
  const raw = readKey(KEYS.session);
  let current: SessionInfo | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SessionInfo>;
      if (parsed && typeof parsed.sessionId === 'string' && typeof parsed.lastActivityAtMs === 'number') {
        current = parsed as SessionInfo;
      }
    } catch {
      current = null;
    }
  }

  let next: SessionInfo;
  if (!current || nowMs - current.lastActivityAtMs > SESSION_TIMEOUT_MS) {
    next = {
      sessionId: isTest ? TEST_DETERMINISTIC_UUID : uuid(),
      startedAtMs: nowMs,
      lastActivityAtMs: nowMs,
      sessionNumber: (current?.sessionNumber ?? 0) + 1,
      fightIndex: opts.incrementFight ? 1 : 0,
    };
  } else {
    next = {
      ...current,
      lastActivityAtMs: nowMs,
      fightIndex: opts.incrementFight ? current.fightIndex + 1 : current.fightIndex,
    };
  }
  writeKey(KEYS.session, JSON.stringify(next));
  return next;
};

const readQueue = (): QueuedEvent[] => {
  try {
    const raw = readKey(KEYS.queue);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (events: QueuedEvent[]) => {
  let kept = events;
  while (kept.length > 1 && JSON.stringify(kept).length > MAX_QUEUE_BYTES) kept = kept.slice(1);
  if (kept.length === 0) removeKey(KEYS.queue);
  else writeKey(KEYS.queue, JSON.stringify(kept));
};

const stripHeavyReplayFields = (properties: Record<string, unknown>): Record<string, unknown> => {
  const { recording: _r, save: _s, ...summary } = properties;
  return summary;
};

const readLocalHistory = (): LocalAnalyticsEvent[] => {
  try {
    const raw = readKey(KEYS.localHistory);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const appendLocalHistory = (entry: LocalAnalyticsEvent) => {
  try {
    const compact: LocalAnalyticsEvent = {
      ...entry,
      properties: stripHeavyReplayFields(entry.properties),
    };
    const next = [...readLocalHistory(), compact].slice(-MAX_LOCAL_HISTORY_EVENTS);
    writeKey(KEYS.localHistory, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};

const readStaged = (): StagedEvent | null => {
  if (stagedMemory !== undefined) return stagedMemory;
  const raw = readKey(KEYS.staged);
  if (!raw) {
    stagedMemory = null;
    return null;
  }
  try {
    stagedMemory = JSON.parse(raw) as StagedEvent;
    return stagedMemory;
  } catch {
    stagedMemory = null;
    removeKey(KEYS.staged);
    return null;
  }
};

const writeStaged = (event: StagedEvent | null) => {
  stagedMemory = event;
  if (!event) removeKey(KEYS.staged);
  else writeKey(KEYS.staged, JSON.stringify(event));
};

/** Properties every event carries */
const common = () => ({
  $lib: 'nshapes',
  $app_version: APP_VERSION,
  app_version: APP_VERSION,
  $os: Platform.OS,
  platform: Platform.OS,
  env: __DEV__ ? 'dev' : 'prod',
  player_code: playerCode(),
  $process_person_profile: true,
});

/** Send everything queued. Safe to call any time; one flush runs at once. */
export const flush = (): Promise<void> => {
  if (!analyticsEnabled()) return Promise.resolve();
  if (flushing) return flushing;
  const batch = readQueue();
  if (batch.length === 0) return Promise.resolve();
  flushing = fetch(`${POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_PROJECT_KEY, batch }),
    // Lets the request finish if a web tab closes right after a fight
    ...(Platform.OS === 'web' ? { keepalive: JSON.stringify(batch).length < 60_000 } : {}),
  })
    .then(res => {
      if (!res.ok && res.status < 500) {
        if (__DEV__) console.warn('[analytics] batch rejected', res.status);
      } else if (!res.ok) return;
      // Sent (or permanently rejected): drop exactly what was sent, keep anything queued meanwhile
      const sent = new Set(batch.map(e => e.uuid));
      writeQueue(readQueue().filter(e => !sent.has(e.uuid)));
    })
    .catch(() => {
      // Offline: it stays queued for the next flush
    })
    .finally(() => {
      flushing = null;
    });
  return flushing;
};

const commitEnvelope = (
  event: string,
  properties: Record<string, unknown>,
  opts: {
    uuid?: string;
    distinctId?: string;
    timestamp?: string;
    profileDelta?: FightProfileUpdate;
    incrementFightSession?: boolean;
    deferFlush?: boolean;
  } = {}
) => {
  if (!analyticsEnabled()) return;
  try {
    const nowMs = opts.timestamp ? Date.parse(opts.timestamp) || Date.now() : Date.now();
    const nowIso = opts.timestamp ?? new Date(nowMs).toISOString();
    const session = touchSession(nowMs, { incrementFight: opts.incrementFightSession });
    const prevProfile = readPlayerProfile();
    const nextProfile = applyProfileDelta(prevProfile, opts.profileDelta, session.sessionNumber, nowIso);
    writePlayerProfile(nextProfile);

    const firstSeenMs = Date.parse(nextProfile.firstSeenAt) || nowMs;
    const daysSinceInstall = Math.max(0, Math.floor((nowMs - firstSeenMs) / 86_400_000));
    const person = buildPersonProps(nextProfile);

    const mergedProps: Record<string, unknown> = {
      ...common(),
      $session_id: session.sessionId,
      session_number: session.sessionNumber,
      session_fight_index: session.fightIndex,
      session_elapsed_sec: Math.max(0, Math.round((nowMs - session.startedAtMs) / 1000)),
      days_since_install: daysSinceInstall,
      journey_stage: person.stage,
      ...properties,
      $set_once: {
        ...person.$set_once,
        ...((properties.$set_once as Record<string, unknown> | undefined) ?? {}),
      },
      $set: {
        ...person.$set,
        ...((properties.$set as Record<string, unknown> | undefined) ?? {}),
      },
    };

    const qEvent: QueuedEvent = {
      uuid: opts.uuid ?? uuid(),
      event,
      distinct_id: opts.distinctId ?? distinctId(),
      timestamp: nowIso,
      properties: mergedProps,
    };

    if (JSON.stringify(qEvent).length > MAX_EVENT_BYTES) {
      // Too big for one event: keep the summary, drop the bulky parts
      const summary = stripHeavyReplayFields(qEvent.properties);
      qEvent.properties = { ...summary, truncated: true };
    }

    writeQueue([...readQueue(), qEvent]);
    appendLocalHistory({
      uuid: qEvent.uuid,
      event: qEvent.event,
      distinctId: qEvent.distinct_id,
      timestamp: qEvent.timestamp,
      properties: qEvent.properties,
    });
    if (!opts.deferFlush) void flush();
  } catch (err) {
    if (__DEV__) console.warn('[analytics] capture failed', err);
  }
};

/** Queue an event immediately and try to send it now. */
export const capture = (
  event: string,
  properties: Record<string, unknown> = {},
  options: CaptureOptions = {}
) => {
  commitEnvelope(event, properties, {
    distinctId: options.distinctId,
    profileDelta: options.profileDelta,
    incrementFightSession: event === 'fight_ended',
    deferFlush: options.deferFlush,
  });
};

/**
 * Stages a wide event (such as `fight_ended`) while the player is viewing the
 * post-fight screen so thumbs up/down feedback attaches to that exact single
 * event before dispatch. Automatically commits any prior un-committed staged
 * event so nothing is ever lost.
 */
export const stageEvent = (
  event: string,
  properties: Record<string, unknown>,
  opts: { fightId?: string; profileDelta?: FightProfileUpdate } = {}
) => {
  if (!analyticsEnabled()) return;
  if (readStaged()) commitStagedEvent('superseded', false);
  const nowIso = new Date().toISOString();
  writeStaged({
    uuid: uuid(),
    event,
    distinctId: distinctId(),
    fightId: opts.fightId,
    timestamp: nowIso,
    properties,
    profileDelta: opts.profileDelta,
  });
};

/**
 * Updates fun rating & reason tags directly inside a staged `fight_ended` event
 * (or the local analytics history buffer). Returns `true` if a staged event was
 * updated in place (meaning NO extra event needs to be sent), or `false` if the
 * event was already committed/flushed.
 */
export const updateFightFeedbackInAnalytics = (
  fightId: string,
  feedback: { funRating?: 'up' | 'down' | null; funTags?: string[] } = {},
  extra: { replayOpened?: boolean } = {}
): boolean => {
  const patch: Record<string, unknown> = {};
  if (feedback.funRating !== undefined) {
    patch.fun_rating = feedback.funRating;
    patch.fun_score = feedback.funRating === 'up' ? 1 : feedback.funRating === 'down' ? 0 : null;
  }
  if (feedback.funTags !== undefined) {
    patch.fun_tags = feedback.funTags;
  }
  if (extra.replayOpened !== undefined) {
    patch.replay_opened = extra.replayOpened;
  }
  if (Object.keys(patch).length === 0) return false;

  // Update local history copy in place so in-app analytics dashboards reflect retrospective feedback too
  const history = readLocalHistory();
  let historyUpdated = false;
  const nextHistory = history.map(item => {
    if (item.properties.fight_id !== fightId) return item;
    historyUpdated = true;
    return { ...item, properties: { ...item.properties, ...patch } };
  });
  if (historyUpdated) writeKey(KEYS.localHistory, JSON.stringify(nextHistory));

  const staged = readStaged();
  if (!staged || staged.fightId !== fightId) return false;

  writeStaged({
    ...staged,
    properties: { ...staged.properties, ...patch },
    profileDelta:
      staged.profileDelta && feedback.funRating !== undefined
        ? { ...staged.profileDelta, funRating: feedback.funRating }
        : staged.profileDelta,
  });
  return true;
};

/** Commits the currently staged wide event (if any) to the outbound batch queue. */
export const commitStagedEvent = (reason: string = 'navigation', flushNow: boolean = true): boolean => {
  const staged = readStaged();
  if (!staged) return false;
  writeStaged(null);
  commitEnvelope(
    staged.event,
    { ...staged.properties, commit_reason: reason },
    {
      uuid: staged.uuid,
      distinctId: staged.distinctId,
      timestamp: staged.timestamp,
      profileDelta: staged.profileDelta,
      incrementFightSession: staged.event === 'fight_ended',
      deferFlush: !flushNow,
    }
  );
  return true;
};

/** Links the current anonymous install ID to an explicit player/account ID via `$identify`. */
export const identifyPlayer = (userId: string, traits: Record<string, unknown> = {}) => {
  const cleanId = userId.trim();
  if (!cleanId || !analyticsEnabled()) return;
  const prevDistinct = distinctId();
  writeKey(KEYS.distinctId, cleanId);
  if (prevDistinct === cleanId) return;
  commitEnvelope('$identify', {
    $anon_distinct_id: prevDistinct,
    $set: {
      ...traits,
      player_code: playerCode(),
      identified: true,
    },
  });
};

export interface AnalyticsInspectorState {
  enabled: boolean;
  optedOut: boolean;
  installId: string;
  distinctId: string;
  playerCode: string;
  profile: PlayerAnalyticsProfile;
  journeyStage: JourneyStage;
  queuedCount: number;
  stagedFightId: string | null;
  localEvents: LocalAnalyticsEvent[];
}

export const getAnalyticsInspectorState = (): AnalyticsInspectorState => {
  const profile = readPlayerProfile();
  const staged = readStaged();
  return {
    enabled: analyticsEnabled(),
    optedOut: analyticsOptedOut(),
    installId: isTest ? TEST_DETERMINISTIC_UUID : installId(),
    distinctId: isTest ? TEST_DETERMINISTIC_UUID : distinctId(),
    playerCode: isTest ? 'NSH-TEST0000' : playerCode(),
    profile,
    journeyStage: computeJourneyStage(profile),
    queuedCount: readQueue().length,
    stagedFightId: staged?.fightId ?? null,
    localEvents: readLocalHistory(),
  };
};

export const clearAnalyticsInspectorHistory = () => {
  removeKey(KEYS.localHistory);
};

/** Call once at app start: commits any interrupted staged fight, captures `app_opened`, and wires lifecycle flushing. */
export const startAnalytics = () => {
  if (started || !analyticsEnabled()) return;
  started = true;
  if (readStaged()) commitStagedEvent('recovered_on_start', false);
  touchSession();
  capture('app_opened');
  unsubscribeLifecycle = subscribeAppActive(active => {
    if (active) {
      touchSession();
      void flush();
    } else {
      commitStagedEvent('app_backgrounded', true);
    }
  });
};
