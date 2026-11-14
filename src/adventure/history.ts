/**
 * Battle history: one record per fight, kept across sessions and shown at
 * Camp. Pure logic here (what a record holds, damage per minute, the bests);
 * reading and writing the list lives in save.ts.
 */
import type { CharacterName } from '@/types';
import type { LevelDef, RunState } from './types';

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
}

/** The list keeps this many of the most recent battles. */
export const HISTORY_LIMIT = 500;

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

export const battleRecord = (
  level: LevelDef,
  run: RunState,
  o: { at: number; stars?: number; coins?: number; left?: boolean }
): BattleRecord => ({
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
  evolutions: run.evolutionsTriggered,
  weapons: run.weapons.map(w => w.id),
});

/** A fight the player walked away from before making a move is not a battle. */
export const wasFought = (run: Pick<RunState, 'matches' | 'mistakes'>): boolean => run.matches + run.mistakes > 0;

/** Newest last. Drops the oldest once the list is full. */
export const withBattle = (history: readonly BattleRecord[], record: BattleRecord): BattleRecord[] =>
  [...history, record].slice(-HISTORY_LIMIT);

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

/** A stored value that has the shape of a record (older or damaged entries are dropped on load). */
export const isBattleRecord = (v: unknown): v is BattleRecord => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.at === 'number' && typeof r.levelId === 'string' && typeof r.levelName === 'string' &&
    typeof r.fighter === 'string' && typeof r.outcome === 'string' && typeof r.damage === 'number' &&
    typeof r.dpm === 'number' && typeof r.durationMs === 'number' && Array.isArray(r.weapons)
  );
};
