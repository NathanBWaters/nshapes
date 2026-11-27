/**
 * Battle history: one record per fight, kept across sessions and shown at
 * Camp. Pure logic here (what a record holds, damage per minute, the bests);
 * reading and writing the list lives in save.ts.
 */
import type { CharacterName, Weapon } from '@/types';
import type { FunRating, FunTag } from '@/analytics/fightEvent';
import type { ArcanaId, FightLogEntry, LevelDef, PassiveId, RunState, RunStatus } from './types';
import { getArmoryWeapon, resolveLegacyWeapon, understudyOf } from './data/armory';
import { UNDERSTUDY_ID } from './data/adventureWeapons';
import { growthStatBonus, type GrowthState } from './data/weaponGrowth';
import type { WeaponBuilds } from './data/weaponStats';

/** Snapshot of a finished fight used to render FightReplay after the RunState is gone (e.g. from Camp -> History). */
export interface FightReplayData {
  levelId: string;
  foeName: string;
  fighter: CharacterName;
  status: RunStatus;
  endReason: RunState['endReason'];
  sandbox?: boolean;
  maxHearts: number | null;
  totalDamage: number;
  elapsedMs: number;
  matches: number;
  mistakes: number;
  weapons: string[];
  weaponBuilds: WeaponBuilds;
  growth?: GrowthState;
  skillNodes: string[];
  passives?: PassiveId[];
  arcana?: ArcanaId[];
  /** Equipped per-weapon evolution IDs active on the held weapons during this fight */
  equippedEvolutions?: Record<string, string>;
  /** Total per-weapon evolutions ignited during this fight */
  evosTriggered?: number;
  /** Peak pre-multiplier additive base damage hit in this fight */
  peakBaseDamage?: number;
  /** @deprecated Legacy Power snapshot retained read-only for older stored replays */
  power?: number;
  log: FightLogEntry[];
}

/** How a battle ended. `left`: the player retreated or restarted partway through. */
export type BattleOutcome = 'won' | 'survived' | 'lost' | 'practice' | 'left';

export interface BattleRecord {
  /** When it ended (ms since epoch) */
  at: number;
  levelId: string;
  /** Names as they were then: levels and foes can be renamed later */
  levelName: string;
  foe: string;
  fighter: CharacterName;
  outcome: BattleOutcome;
  /** Stars this battle earned (0 for a loss, practice, or leaving) */
  stars: number;
  damage: number;
  /** Damage per minute of fight clock */
  dpm: number;
  biggestHit: number;
  sets: number;
  mistakes: number;
  /** Fight clock in ms: the time the player had the board, not counting effects, pauses or menus */
  durationMs: number;
  /** Coins this battle put in the purse (drops, star rewards and bounties) */
  coins: number;
  evolutions: number;
  /** Ids of the weapons held when it ended */
  weapons: string[];
  /** Equipped per-weapon evolution IDs on held weapons during this fight */
  equippedEvolutions?: Record<string, string>;
  /** Total per-weapon evolutions triggered during this fight (mirrors `evolutions`) */
  evosTriggered?: number;
  /** Peak pre-multiplier additive base damage hit in this fight */
  peakBaseDamage?: number;
  /** @deprecated Legacy Power multiplier; read-compatible with older stored battles, never written on new ones */
  power?: number;
  /** Stable id pairing this record with its single PostHog fight_ended event */
  fightId?: string;
  /** Player enjoyment feedback captured on Results or Camp History */
  funRating?: FunRating;
  funTags?: FunTag[];
  /** Compact fight log & build snapshot for FightReplay (retained for the newest REPLAY_LIMIT fights) */
  replay?: FightReplayData;
}

/** The list keeps this many of the most recent battles. */
export const HISTORY_LIMIT = 500;
/** Full per-move replay logs are kept for this many of the most recent battles to keep storage compact. */
export const REPLAY_LIMIT = 50;

/**
 * Damage dealt per minute of fight clock. The clock stands still while effects
 * play and while the fight is paused, so this measures play, not waiting.
 */
export const damagePerMinute = (run: Pick<RunState, 'totalDamage' | 'elapsedMs'>): number =>
  Math.round((run.totalDamage / Math.max(run.elapsedMs, 1000)) * 60000);

const outcomeOf = (level: LevelDef, run: RunState, left: boolean): BattleOutcome => {
  if (level.rules.sandbox) return 'practice';
  if (left) return 'left';
  if (run.status === 'lost') return 'lost';
  return run.endReason === 'defeated' ? 'won' : 'survived';
};

const heldEquippedEvolutions = (run: RunState): Record<string, string> => {
  const out: Record<string, string> = {};
  const map = run.equippedEvolutions;
  if (!map) return out;
  for (const w of run.weapons) {
    const evoId = map[w.id];
    if (typeof evoId === 'string' && evoId.length > 0) out[w.id] = evoId;
  }
  return out;
};

/** Pack the parts of RunState that FightReplay needs into a JSON-safe snapshot. */
export const fightReplayOf = (run: RunState): FightReplayData => {
  const equippedEvos = heldEquippedEvolutions(run);
  const peakBaseDamage = run.fightMetrics?.maxBaseDamage ?? 0;
  const evosTriggered = run.evolutionsTriggered ?? 0;
  return {
    levelId: run.level.id,
    foeName: run.foeName,
    fighter: run.fighter,
    status: run.status,
    endReason: run.endReason,
    ...(run.level.rules.sandbox ? { sandbox: true } : {}),
    maxHearts: run.maxHearts,
    totalDamage: run.totalDamage,
    elapsedMs: run.elapsedMs,
    matches: run.matches,
    mistakes: run.mistakes,
    weapons: run.weapons.map(w => w.id),
    weaponBuilds: run.weaponBuilds,
    ...(Object.keys(run.growth ?? {}).length > 0 ? { growth: run.growth } : {}),
    skillNodes: run.skillNodes,
    ...(run.passives.length > 0 ? { passives: run.passives } : {}),
    ...(run.arcana.length > 0 ? { arcana: run.arcana } : {}),
    ...(Object.keys(equippedEvos).length > 0 ? { equippedEvolutions: equippedEvos } : {}),
    ...(evosTriggered > 0 ? { evosTriggered } : {}),
    ...(peakBaseDamage > 0 ? { peakBaseDamage } : {}),
    log: run.log,
  };
};

/** Reconstruct held Weapon objects from saved ids, Workshop builds, and in-fight growth. */
export const buildReplayWeapons = (
  ids: readonly string[],
  builds?: WeaponBuilds,
  growth?: GrowthState
): Weapon[] => {
  const seen = new Set<string>();
  const out: Weapon[] = [];
  for (let i = 0; i < ids.length; i++) {
    const resolved = resolveLegacyWeapon(ids[i]);
    if (!resolved || seen.has(resolved.id)) continue;
    seen.add(resolved.id);
    const grown = growth ? growthStatBonus(growth, resolved.id) : undefined;
    const effectiveBuilds = builds ?? (resolved.tier > 0 ? { [resolved.id]: { level: resolved.tier + 1, tuning: {} } } : undefined);
    const w = getArmoryWeapon(resolved.id, effectiveBuilds, grown);
    if (!w) continue;
    const prevResolved = i > 0 ? resolveLegacyWeapon(ids[i - 1]) : null;
    out.push(resolved.id === UNDERSTUDY_ID ? understudyOf(w, prevResolved?.id, effectiveBuilds) : w);
  }
  return out;
};

export const battleRecord = (
  level: LevelDef,
  run: RunState,
  o: { at: number; stars?: number; coins?: number; left?: boolean; fightId?: string }
): BattleRecord => {
  const equippedEvos = heldEquippedEvolutions(run);
  const peakBaseDamage = run.fightMetrics?.maxBaseDamage ?? 0;
  const evosTriggered = run.evolutionsTriggered ?? 0;
  return {
    at: o.at,
    levelId: level.id,
    levelName: level.name,
    foe: run.foeName,
    fighter: run.fighter,
    outcome: outcomeOf(level, run, !!o.left),
    stars: o.stars ?? 0,
    damage: run.totalDamage,
    dpm: damagePerMinute(run),
    biggestHit: run.biggestHit,
    sets: run.matches,
    mistakes: run.mistakes,
    durationMs: run.elapsedMs,
    coins: o.coins ?? 0,
    evolutions: evosTriggered,
    evosTriggered,
    peakBaseDamage,
    weapons: run.weapons.map(w => w.id),
    ...(Object.keys(equippedEvos).length > 0 ? { equippedEvolutions: equippedEvos } : {}),
    ...(o.fightId ? { fightId: o.fightId } : {}),
    ...(run.log.length > 1 ? { replay: fightReplayOf(run) } : {}),
  };
};

/** Strip full replay logs from battles older than the newest `keep` replays so storage stays small. */
export const trimReplays = (records: readonly BattleRecord[], keep = REPLAY_LIMIT): BattleRecord[] => {
  let kept = 0;
  const out = new Array<BattleRecord>(records.length);
  for (let i = records.length - 1; i >= 0; i--) {
    const b = records[i];
    if (b.replay) {
      if (kept < keep) {
        kept++;
        out[i] = b;
      } else {
        const { replay: _drop, ...rest } = b;
        out[i] = rest;
      }
    } else {
      out[i] = b;
    }
  }
  return out;
};

/** A fight the player walked away from before making a move is not a battle. */
export const wasFought = (run: Pick<RunState, 'matches' | 'mistakes'>): boolean => run.matches + run.mistakes > 0;

/** Newest last. Drops the oldest once the list is full, and caps stored replays at REPLAY_LIMIT. */
export const withBattle = (history: readonly BattleRecord[], record: BattleRecord): BattleRecord[] =>
  trimReplays([...history, record].slice(-HISTORY_LIMIT), REPLAY_LIMIT);

/** Updates fun rating & optional reason tags on a stored battle record. */
export const withBattleFeedback = (
  history: readonly BattleRecord[],
  match: { fightId?: string; at: number; levelId: string },
  feedback: { funRating: FunRating | null; funTags: FunTag[] }
): BattleRecord[] => {
  let changed = false;
  const next = history.map(b => {
    const matched = match.fightId && b.fightId ? b.fightId === match.fightId : b.at === match.at && b.levelId === match.levelId;
    if (!matched) return b;
    changed = true;
    const { funRating: _r, funTags: _t, ...rest } = b;
    return {
      ...rest,
      ...(feedback.funRating ? { funRating: feedback.funRating } : {}),
      ...(feedback.funRating && feedback.funTags.length > 0 ? { funTags: feedback.funTags } : {}),
    };
  });
  return changed ? next : [...history];
};

/** The best damage per minute on this level so far, or null if it has not been fought. */
export const bestDpmOn = (history: readonly BattleRecord[], levelId: string): number | null => {
  const scores = history.filter(b => b.levelId === levelId && b.outcome !== 'left').map(b => b.dpm);
  return scores.length > 0 ? Math.max(...scores) : null;
};

export interface HistorySummary {
  battles: number;
  /** Battles that knocked out the foe */
  wins: number;
  bestDpm: number;
  biggestHit: number;
  totalDamage: number;
}

export const summarize = (history: readonly BattleRecord[]): HistorySummary => ({
  battles: history.length,
  wins: history.filter(b => b.outcome === 'won').length,
  bestDpm: history.reduce((best, b) => (b.outcome === 'left' ? best : Math.max(best, b.dpm)), 0),
  biggestHit: history.reduce((best, b) => Math.max(best, b.biggestHit), 0),
  totalDamage: history.reduce((sum, b) => sum + b.damage, 0),
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/** "Today 14:05", "Yesterday 09:30", "12 Nov" (with the year once it is not this one). */
export const formatWhen = (at: number, now: number): string => {
  const d = new Date(at);
  const today = new Date(now);
  const dayOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayOf(today) - dayOf(d)) / 86_400_000);
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`;
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === today.getFullYear() ? date : `${date} ${d.getFullYear()}`;
};

/** "1:05" */
export const formatDuration = (ms: number): string => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${two(s % 60)}`;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const isFightLogEntryLike = (v: unknown): boolean =>
  isObj(v) && typeof v.t === 'number' && typeof v.kind === 'string' && typeof v.damage === 'number' && Array.isArray(v.lines);

export const isFightReplayData = (v: unknown): v is FightReplayData => {
  if (!isObj(v)) return false;
  return (
    typeof v.levelId === 'string' && typeof v.foeName === 'string' && typeof v.fighter === 'string' &&
    typeof v.totalDamage === 'number' && typeof v.elapsedMs === 'number' &&
    typeof v.matches === 'number' && typeof v.mistakes === 'number' &&
    Array.isArray(v.weapons) && isObj(v.weaponBuilds) && Array.isArray(v.skillNodes) &&
    Array.isArray(v.log) && v.log.every(isFightLogEntryLike)
  );
};

const isCoreRecord = (v: unknown): v is BattleRecord => {
  if (!isObj(v)) return false;
  return (
    typeof v.at === 'number' && typeof v.levelId === 'string' && typeof v.levelName === 'string' &&
    typeof v.fighter === 'string' && typeof v.outcome === 'string' && typeof v.damage === 'number' &&
    typeof v.dpm === 'number' && typeof v.durationMs === 'number' && Array.isArray(v.weapons)
  );
};

/** A stored value that has the shape of a record (older or damaged entries are dropped on load). */
export const isBattleRecord = (v: unknown): v is BattleRecord =>
  isCoreRecord(v) && (v.replay === undefined || isFightReplayData(v.replay));

const sanitizeStringMap = (raw: unknown): Record<string, string> | undefined => {
  if (!isObj(raw)) return undefined;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, val] of Object.entries(raw)) {
    if (typeof k === 'string' && k.length > 0 && typeof val === 'string' && val.length > 0) {
      out[k] = val;
      count++;
    }
  }
  return count > 0 ? out : undefined;
};

/** Validate a stored record, stripping any corrupted `replay` snapshot without losing the summary entry. */
export const sanitizeBattleRecord = (v: unknown): BattleRecord | null => {
  if (!isCoreRecord(v)) return null;
  const rec = v as BattleRecord;
  let clean: BattleRecord = rec;
  if (rec.replay !== undefined && !isFightReplayData(rec.replay)) {
    const { replay: _drop, ...rest } = rec;
    clean = rest;
  }
  const raw = clean as unknown as Record<string, unknown>;
  if (raw.funRating !== undefined && raw.funRating !== 'up' && raw.funRating !== 'down') {
    const { funRating: _dropFun, ...rest } = clean;
    clean = rest;
  }
  if (raw.funTags !== undefined && (!Array.isArray(raw.funTags) || !raw.funTags.every(t => typeof t === 'string'))) {
    const { funTags: _dropTags, ...rest } = clean;
    clean = rest;
  }
  if (raw.fightId !== undefined && typeof raw.fightId !== 'string') {
    const { fightId: _dropId, ...rest } = clean;
    clean = rest;
  }
  if (raw.equippedEvolutions !== undefined) {
    const cleanedEvos = sanitizeStringMap(raw.equippedEvolutions);
    const { equippedEvolutions: _dropEvos, ...rest } = clean;
    clean = cleanedEvos ? { ...rest, equippedEvolutions: cleanedEvos } : rest;
  }
  if (raw.evosTriggered !== undefined && (typeof raw.evosTriggered !== 'number' || !Number.isFinite(raw.evosTriggered))) {
    const { evosTriggered: _dropCount, ...rest } = clean;
    clean = rest;
  }
  if (raw.peakBaseDamage !== undefined && (typeof raw.peakBaseDamage !== 'number' || !Number.isFinite(raw.peakBaseDamage))) {
    const { peakBaseDamage: _dropBase, ...rest } = clean;
    clean = rest;
  }
  return clean;
};
