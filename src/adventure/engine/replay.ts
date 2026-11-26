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
import type { IconName } from '@/components/Icon';
import type { Card, CharacterName, Weapon } from '@/types';
import type { FightReplayData } from '../history';
import type { AdventureSave, FightLogEntry, LevelDef, RunEvent, RunState, SetFollowUpItem, SetIgnition } from '../types';
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

/** Offer/pick/buy ledger captured alongside the fight recording for balance telemetry. */
export interface FightChoices {
  offered: string[];
  picked: string[];
  bought: string[];
  rerolls: number;
}

/** A recording plus the save the fight started from: everything a replay needs besides the level. */
export interface FightTape {
  recording: FightRecording;
  save: AdventureSave;
  choices?: FightChoices;
}

/** Collects the actions of one fight as they are dispatched. */
export class FightRecorder {
  readonly seed: number;
  private actions: RecordedAction[] = [];
  private offeredIds: string[] = [];
  private pickedIds: string[] = [];
  private boughtIds: string[] = [];
  private rerollCount = 0;
  private shopSlateRecorded = false;

  constructor(seed: number) {
    this.seed = seed;
  }

  /** Call with the state the action is applied to (for the fight clock). */
  record(
    action: RunAction,
    before: Pick<RunState, 'elapsedMs' | 'board' | 'deck'> & Partial<Pick<RunState, 'pickOptions' | 'shopOptions'>>
  ) {
    if (action.type === 'CLEAR_EVENTS') return;
    if (action.type === 'TICK') {
      const last = this.actions[this.actions.length - 1];
      if (last && 'type' in last && last.ms === action.ms) last.n += 1;
      else this.actions.push({ type: 'TICK', ms: action.ms, n: 1 });
      return;
    }

    if (action.type === 'PICK') {
      if (before.pickOptions?.length) {
        for (const w of before.pickOptions) this.offeredIds.push(w.id);
      }
      if (action.weaponId) this.pickedIds.push(action.weaponId);
    } else if (action.type === 'BUY') {
      if (!this.shopSlateRecorded && before.shopOptions?.length) {
        for (const w of before.shopOptions) this.offeredIds.push(w.id);
        this.shopSlateRecorded = true;
      }
      const chosen = before.shopOptions?.[action.index];
      if (chosen?.id) this.boughtIds.push(chosen.id);
    } else if (action.type === 'REROLL') {
      if (!this.shopSlateRecorded && before.shopOptions?.length) {
        for (const w of before.shopOptions) this.offeredIds.push(w.id);
      }
      this.shopSlateRecorded = false;
      this.rerollCount += 1;
    } else if (action.type === 'NEXT_WAVE') {
      if (!this.shopSlateRecorded && before.shopOptions?.length) {
        for (const w of before.shopOptions) this.offeredIds.push(w.id);
      }
      this.shopSlateRecorded = false;
    }

    this.actions.push({ at: before.elapsedMs, a: squeeze(action, before, placesOf(before)) as Record<string, unknown> });
  }

  get length() {
    return this.actions.length;
  }

  choicesJSON(): FightChoices {
    return {
      offered: [...this.offeredIds],
      picked: [...this.pickedIds],
      bought: [...this.boughtIds],
      rerolls: this.rerollCount,
    };
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

/** Reconstructed board, emitted events, and score equation snapshot for a single fight move ([TP-13]). */
export interface MoveSnapshot {
  moveIndex: number;
  entry: FightLogEntry;
  boardBefore: Card[];
  boardAfter: Card[];
  events: RunEvent[];
  ignition: SetIgnition | null;
  weapons: Weapon[];
  fighter: CharacterName;
  foeName: string;
  foeIcon: IconName;
  foeHpBefore: number;
  foeHpAfter: number;
  foeMaxHp: number;
}

/**
 * [TP-13] Replay a deterministic `FightRecording` up to `moveIndex` (0-based
 * index into `run.log`) and capture the exact pre-move board, emitted
 * `RunEvent[]`, and `SetIgnition` for slow-motion visual highlight playback.
 */
export const replayMoveSnapshot = (
  level: LevelDef,
  save: AdventureSave,
  rec: FightRecording,
  moveIndex: number
): MoveSnapshot | null => {
  if (moveIndex < 0) return null;
  let s = createRun(level, save, { seed: rec.seed });

  if (moveIndex === 0 && s.log.length > 0) {
    return {
      moveIndex: 0,
      entry: s.log[0],
      boardBefore: [...s.board],
      boardAfter: [...s.board],
      events: [...s.events],
      ignition: s.lastSetIgnition,
      weapons: [...s.weapons],
      fighter: s.fighter,
      foeName: s.foeName,
      foeIcon: s.foeIcon,
      foeHpBefore: s.foeHp,
      foeHpAfter: s.foeHp,
      foeMaxHp: s.foeMaxHp,
    };
  }

  for (const recEntry of rec.actions) {
    if ('type' in recEntry) {
      for (let i = 0; i < recEntry.n; i++) {
        const before = s;
        const prevEventSeq = before.eventSeq;
        s = runReducer(s, { type: 'TICK', ms: recEntry.ms });
        if (s.log.length > moveIndex) {
          return {
            moveIndex,
            entry: s.log[moveIndex],
            boardBefore: [...before.board],
            boardAfter: [...s.board],
            events: s.events.filter(ev => ev.id > prevEventSeq),
            ignition: s.lastSetIgnition,
            weapons: [...s.weapons],
            fighter: s.fighter,
            foeName: s.foeName,
            foeIcon: s.foeIcon,
            foeHpBefore: before.foeHp,
            foeHpAfter: s.foeHp,
            foeMaxHp: s.foeMaxHp,
          };
        }
      }
      continue;
    }

    const before = s;
    const prevEventSeq = before.eventSeq;
    s = runReducer(s, inflate(recEntry.a, s) as RunAction);
    if (s.log.length > moveIndex) {
      return {
        moveIndex,
        entry: s.log[moveIndex],
        boardBefore: [...before.board],
        boardAfter: [...s.board],
        events: s.events.filter(ev => ev.id > prevEventSeq),
        ignition: s.lastSetIgnition,
        weapons: [...s.weapons],
        fighter: s.fighter,
        foeName: s.foeName,
        foeIcon: s.foeIcon,
        foeHpBefore: before.foeHp,
        foeHpAfter: s.foeHp,
        foeMaxHp: s.foeMaxHp,
      };
    }
  }

  return null;
};

const FALLBACK_SHAPES: readonly Card['shape'][] = ['oval', 'diamond', 'squiggle'];
const FALLBACK_COLORS: readonly Card['color'][] = ['red', 'green', 'purple'];
const FALLBACK_SHADINGS: readonly Card['shading'][] = ['solid', 'striped', 'open'];

/**
 * Synthesize a visual `MoveSnapshot` directly from saved `FightReplayData`
 * (used when opening "Watch Highlight (0.5×)" from persisted Battle History
 * where a full action tape was not attached).
 */
export const synthesizeHighlightSnapshot = (
  data: FightReplayData,
  moveIndex: number,
  weapons: Weapon[],
  foeIcon: IconName = 'lorc/daemon-skull'
): MoveSnapshot | null => {
  const entry = data.log[moveIndex];
  if (!entry) return null;

  const board: Card[] = Array.from({ length: 12 }, (_, i) => ({
    id: `hl-${moveIndex}-${i}`,
    shape: FALLBACK_SHAPES[i % 3],
    color: FALLBACK_COLORS[Math.floor(i / 3) % 3],
    number: ((i % 3) + 1) as Card['number'],
    shading: FALLBACK_SHADINGS[(i + Math.floor(i / 3)) % 3],
    selected: false,
  }));

  const setSlots = [0, 4, 8];
  if (entry.cards && entry.cards.length > 0) {
    entry.cards.slice(0, 3).forEach((c, i) => {
      const slot = setSlots[i] ?? i;
      board[slot] = {
        id: `hl-set-${moveIndex}-${i}`,
        shape: c.shape,
        color: c.color,
        number: c.number,
        shading: c.shading,
        background: c.background,
        bonusPoints: c.bonusPoints,
        selected: false,
      };
    });
  }

  const events: RunEvent[] = [];
  let seq = 1;
  if (entry.kind === 'set' && entry.set) {
    const type: RunEvent['type'] =
      (entry.set.surgeMultiplier ?? 1) > 1
        ? 'surge_hit'
        : entry.set.rainbow
          ? 'rainbow'
          : 'hit';
    events.push({
      id: seq++,
      type,
      amount: entry.setDamage,
      slots: setSlots,
      cards: setSlots.map(idx => board[idx]),
    });
  }

  const followUps: SetFollowUpItem[] = [];
  const effectSlotPools: number[][] = [
    [1, 5],
    [3, 4, 5],
    [2, 6, 10],
    [7, 11],
  ];
  entry.lines.forEach((line, idx) => {
    const slots = effectSlotPools[idx % effectSlotPools.length];
    const sourceWeaponId = line.sourceRef?.startsWith('weapon:') ? line.sourceRef.slice(7) : undefined;
    const weaponIdx = sourceWeaponId ? weapons.findIndex(w => w.id === sourceWeaponId) : -1;
    events.push({
      id: seq++,
      type: line.type,
      amount: line.amount,
      text: line.text,
      slots,
      cards: slots.map(i => board[i]),
      ...(weaponIdx >= 0 && sourceWeaponId ? { source: `w${weaponIdx}:${sourceWeaponId}#0` } : {}),
    });
    if (line.amount && line.amount > 0 && line.type !== 'hit' && line.type !== 'rainbow' && line.type !== 'surge_hit') {
      followUps.push({
        label: line.source ?? line.text ?? line.type,
        amount: line.amount,
        sourceRef: line.sourceRef,
      });
    }
  });

  const ignition: SetIgnition | null = entry.set
    ? {
        id: moveIndex + 1,
        math: entry.set,
        followUps: followUps.length > 0 ? followUps : undefined,
        turnDamage: entry.damage,
        lethal: entry.foeHp <= 0,
        isBossOrElite: false,
        foeName: data.foeName,
      }
    : null;

  const prevHp = moveIndex > 0 ? data.log[moveIndex - 1].foeHp : entry.foeMaxHp;
  return {
    moveIndex,
    entry,
    boardBefore: board,
    boardAfter: board,
    events,
    ignition,
    weapons,
    fighter: data.fighter,
    foeName: data.foeName,
    foeIcon,
    foeHpBefore: Math.max(entry.foeHp, prevHp),
    foeHpAfter: entry.foeHp,
    foeMaxHp: entry.foeMaxHp,
  };
};
