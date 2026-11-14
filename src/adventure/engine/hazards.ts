/**
 * Level traps (spec §7): Time Bombs tick down and hurt when they go off;
 * Snares hurt when matched and are defused by matching the card they point at.
 * Placement lives in fight.ts because every refill can bring one.
 */
import type { Card } from '@/types';
import { emit, enqueue, hurt, mods, placeSnare, placeTimeBomb, recycle, snareTarget, SNARE_DEFUSE_DAMAGE, updateCards, type Draft } from './fight';

const defused = (d: Draft, kind: 'bomb' | 'snare', bonus?: number, slot?: number) => {
  d.trapsDefused += 1;
  emit(d, 'trap_defused', bonus, kind, slot === undefined ? undefined : { slots: [slot] });
  enqueue(d, 'trapDefused');
};

/**
 * Traps touched by the Set being scored. A Set that includes the card a snare
 * points at defuses it, even if the snared card is in the Set too. Returns the
 * bonus damage earned and how many snares were sprung (see `springSnares`).
 */
export const resolveTrapsOnSet = (d: Draft, matched: Card[]): { bonus: number; sprung: number } => {
  const ids = new Set(matched.map(c => c.id));
  let bonus = 0;
  let sprung = 0;

  const bombs = d.timeBombIds.filter(id => ids.has(id));
  if (bombs.length) {
    d.timeBombIds = d.timeBombIds.filter(id => !ids.has(id));
    updateCards(d, d.board.map((c, i) => (ids.has(c.id) && c.hasCountdown ? i : -1)).filter(i => i >= 0), c => ({ ...c, hasCountdown: false, countdownTimer: undefined }));
    bombs.forEach(id => defused(d, 'bomb', undefined, d.board.findIndex(c => c.id === id)));
  }

  const clear: number[] = [];
  d.board.forEach((c, i) => {
    if (!c.snare) return;
    const t = snareTarget(i, c.snare, d.board.length);
    if (t !== null && ids.has(d.board[t].id)) {
      bonus += SNARE_DEFUSE_DAMAGE;
      clear.push(i);
      defused(d, 'snare', SNARE_DEFUSE_DAMAGE, i);
    } else if (ids.has(c.id)) {
      clear.push(i);
      sprung += 1;
    }
  });
  updateCards(d, clear, c => ({ ...c, snare: undefined }));
  return { bonus, sprung };
};

/** Sprung snares bite after the Set has landed (so the lost heart doesn't feed this Set). */
export const springSnares = (d: Draft, n: number) => {
  for (let k = 0; k < n; k++) {
    d.trapsSprung += 1;
    const immune = !!mods(d).trapImmunity;
    emit(d, 'trap_sprung', immune ? 0 : 1, 'snare');
    if (!immune) hurt(d, 1);
  }
};

/** Fuses burn down (in seconds); a bomb that goes off costs a heart and its card is replaced. */
export const tickTimeBombs = (d: Draft, ms: number) => {
  if (d.timeBombIds.length === 0) return;
  const ids = new Set(d.timeBombIds);
  const expired: number[] = [];
  d.board = d.board.map((c, i) => {
    if (!ids.has(c.id) || !c.hasCountdown || d.replacing.includes(c.id)) return c;
    const left = Math.max(0, (c.countdownTimer ?? 0) - ms / 1000);
    if (left <= 0) expired.push(i);
    return { ...c, countdownTimer: left };
  });
  if (expired.length === 0) return;
  const gone = new Set(expired.map(i => d.board[i].id));
  d.timeBombIds = d.timeBombIds.filter(id => !gone.has(id));
  updateCards(d, expired, c => ({ ...c, hasCountdown: false, countdownTimer: undefined }));
  expired.forEach(i => {
    d.trapsSprung += 1;
    emit(d, 'trap_sprung', 1, 'bomb', { slots: [i], cards: [d.board[i]] });
    hurt(d, 1);
  });
  recycle(d, expired);
};

/** Each fight opens with one trap of every kind the level uses. */
export const placeOpeningTraps = (d: Draft) => {
  const all = d.board.map((_, i) => i);
  if (d.level.rules.hazards?.timeBombs) placeTimeBomb(d, all);
  if (d.level.rules.hazards?.snares) placeSnare(d, all);
};

/** Defuse every trap on the board and turn every face-down card up (an evolution's Cleanse). */
export const cleanseBoard = (d: Draft) => {
  const bombIds = new Set(d.timeBombIds);
  const idx: number[] = [];
  d.board.forEach((c, i) => {
    if (c.snare || c.isFaceDown || bombIds.has(c.id)) idx.push(i);
  });
  d.board.forEach((c, i) => {
    if (c.snare) defused(d, 'snare', undefined, i);
    if (bombIds.has(c.id)) defused(d, 'bomb', undefined, i);
  });
  d.timeBombIds = [];
  updateCards(d, idx, c => ({
    ...c,
    snare: undefined,
    isFaceDown: false,
    ...(bombIds.has(c.id) ? { hasCountdown: false, countdownTimer: undefined } : {}),
  }));
};
