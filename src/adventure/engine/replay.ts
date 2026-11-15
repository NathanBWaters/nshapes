/**
 * Fight recordings: every action the screen sent to the run reducer, small
 * enough to ship in one analytics event, and enough to play the fight again.
 *
 * A run is a pure function of (level, save, seed, actions) — card draws go
 * through the seeded RNG in state — so a recording rebuilds the whole fight:
 * every Set, every weapon trigger, every damage number.
 *
 * Compaction:
 *  - Cards and card ids inside an action are named by board slot or deck
 *    position (ids differ between processes; the seeded deal does not).
 *  - Runs of identical TICKs collapse into one entry with a count.
 *  - CLEAR_EVENTS is UI bookkeeping and is dropped.
 * Each kept action carries the fight clock when it was sent (`at`, ms).
 */
import type { Card } from '@/types';
import type { AdventureSave, LevelDef, RunState } from '../types';
import { createRun, runReducer, type RunAction } from './run';

/** Bump when the recording format changes (not when the engine does: `appVersion` covers that). */
export const RECORDING_FORMAT = 1;

export type RecordedAction =
  | { type: 'TICK'; ms: number; n: number }
  | { at: number; a: Record<string, unknown> };

export interface FightRecording {
  format: typeof RECORDING_FORMAT;
  seed: number;
  actions: RecordedAction[];
}

const isCard = (v: unknown): v is Card =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as Card).id === 'string' && 'shape' in (v as object);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Card ids come from process-wide counters, so the same fight played twice
 * gets different ids. A recording names a card by where it is instead: board
 * slot "b3" or deck position "d12", which the seeded deal makes the same on replay.
 */
type Where = Pick<RunState, 'board' | 'deck'>;

const placesOf = (s: Where) => {
  const byId = new Map<string, string>();
  s.deck.forEach((c, i) => byId.set(c.id, `d${i}`));
  s.board.forEach((c, i) => byId.set(c.id, `b${i}`));
  return byId;
};

const cardAt = (s: Where, place: string): Card | undefined =>
  place[0] === 'b' ? s.board[Number(place.slice(1))] : place[0] === 'd' ? s.deck[Number(place.slice(1))] : undefined;

/**
 * Deep: a card exactly as the state has it becomes { $c: place }; a card the
 * screen changed stays whole with { $id: place } for its id; a bare id string
 * becomes "@place".
 */
const squeeze = (v: unknown, s: Where, places: Map<string, string>): unknown => {
  if (isCard(v)) {
    const place = places.get(v.id);
    if (!place) return v;
    if (same(cardAt(s, place), v)) return { $c: place };
    const { id: _id, ...rest } = v;
    return { ...squeeze(rest, s, places) as object, $id: place };
  }
  if (typeof v === 'string') return places.has(v) ? `@${places.get(v)}` : v;
  if (Array.isArray(v)) return v.map(x => squeeze(x, s, places));
  if (typeof v === 'object' && v !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = squeeze(x, s, places);
    return out;
  }
  return v;
};

/** Undo squeeze against the replay's own state. */
const inflate = (v: unknown, s: Where): unknown => {
  if (typeof v === 'string') return v.startsWith('@') ? cardAt(s, v.slice(1))?.id ?? v : v;
  if (Array.isArray(v)) return v.map(x => inflate(x, s));
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    if (typeof o.$c === 'string') return cardAt(s, o.$c);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) if (k !== '$id') out[k] = inflate(x, s);
    if (typeof o.$id === 'string') out.id = cardAt(s, o.$id)?.id ?? o.$id;
    return out;
  }
  return v;
};

/** A recording plus the save the fight started from: everything a replay needs besides the level. */
export interface FightTape {
  recording: FightRecording;
  save: AdventureSave;
}

/** Collects the actions of one fight as they are dispatched. */
export class FightRecorder {
  readonly seed: number;
  private actions: RecordedAction[] = [];

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Call with the state the action is applied to (for the fight clock). */
  record(action: RunAction, before: Pick<RunState, 'elapsedMs' | 'board' | 'deck'>) {
    if (action.type === 'CLEAR_EVENTS') return;
    if (action.type === 'TICK') {
      const last = this.actions[this.actions.length - 1];
      if (last && 'type' in last && last.ms === action.ms) last.n += 1;
      else this.actions.push({ type: 'TICK', ms: action.ms, n: 1 });
      return;
    }
    this.actions.push({ at: before.elapsedMs, a: squeeze(action, before, placesOf(before)) as Record<string, unknown> });
  }

  get length() {
    return this.actions.length;
  }

  toJSON(): FightRecording {
    return { format: RECORDING_FORMAT, seed: this.seed, actions: this.actions.map(x => ('type' in x ? { ...x } : x)) };
  }
}

/** Play a recording again from the start. Returns the final state. */
export const replayFight = (level: LevelDef, save: AdventureSave, rec: FightRecording): RunState => {
  let s = createRun(level, save, { seed: rec.seed });
  for (const entry of rec.actions) {
    if ('type' in entry) {
      for (let i = 0; i < entry.n; i++) s = runReducer(s, { type: 'TICK', ms: entry.ms });
      continue;
    }
    s = runReducer(s, inflate(entry.a, s) as RunAction);
  }
  return s;
};
