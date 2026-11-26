/**
 * Level traps (spec §7): Time Bombs tick down and hurt when they go off;
 * Snares hurt when matched and are defused by matching the card they point at.
 * Placement lives in fight.ts because every refill can bring one.
 */
import type { Card } from '@/types';
import type { FightLogMathItem } from '../types';
import { SKILL_FEAT_POWER } from '../data/weaponPower';
import { addPower, emit, enqueue, hurt, mods, placeSnare, placeTimeBomb, recycle, snareTarget, SNARE_DEFUSE_DAMAGE, updateCards, type Draft } from './fight';

export const BOMB_DEFUSE_BASE_DAMAGE = 4;
export const BOMB_DEFUSE_HOT_DAMAGE = 8;
export const BOMB_DEFUSE_CLUTCH_DAMAGE = 14;
export const BOMB_HOT_THRESHOLD_SEC = 8;
export const BOMB_CLUTCH_THRESHOLD_SEC = 5;

const defused = (d: Draft, kind: 'bomb' | 'snare', bonus?: number, slot?: number) => {
  d.trapsDefused += 1;
  emit(d, 'trap_defused', bonus, kind, slot === undefined ? undefined : { slots: [slot] });
  enqueue(d, 'trapDefused');
};

/**
 * Traps touched by the Set being scored. Defusing a Time Bomb hurls it at the foe
 * for fuse-proximity bonus damage (+4 / +8 hot / +14 clutch + +0.25 Power); a Set
 * that includes the card a snare points at defuses it for +4 damage.
 */
export const resolveTrapsOnSet = (
  d: Draft,
  matched: Card[]
): { bonus: number; sprung: number; items: FightLogMathItem[] } => {
  const ids = new Set(matched.map(c => c.id));
  let bonus = 0;
  let sprung = 0;
  const items: FightLogMathItem[] = [];

  const bombs = d.timeBombIds.filter(id => ids.has(id));
  if (bombs.length) {
    // Capture remaining fuse timers BEFORE clearing countdown fields on the board
    const bombInfo = bombs.map(id => {
      const slot = d.board.findIndex(c => c.id === id);
      const live = slot >= 0 ? d.board[slot] : matched.find(c => c.id === id);
      return { id, slot, remaining: live?.countdownTimer ?? BOMB_HOT_THRESHOLD_SEC };
    });
    d.timeBombIds = d.timeBombIds.filter(id => !ids.has(id));
    updateCards(
      d,
      d.board.map((c, i) => (ids.has(c.id) && c.hasCountdown ? i : -1)).filter(i => i >= 0),
      c => ({ ...c, hasCountdown: false, countdownTimer: undefined })
    );
    for (const b of bombInfo) {
      let dmg = BOMB_DEFUSE_BASE_DAMAGE;
      let label = 'Bomb Throw';
      let note = 'defused bomb hurled at foe';
      if (b.remaining < BOMB_CLUTCH_THRESHOLD_SEC) {
        dmg = BOMB_DEFUSE_CLUTCH_DAMAGE;
        label = 'Clutch Defuse!';
        note = 'bomb thrown with <5s left (+0.25 Power)';
        addPower(d, SKILL_FEAT_POWER.clutchBomb);
      } else if (b.remaining < BOMB_HOT_THRESHOLD_SEC) {
        dmg = BOMB_DEFUSE_HOT_DAMAGE;
        label = 'Hot Defuse!';
        note = 'bomb thrown with <8s left';
      }
      bonus += dmg;
      items.push({ label, amount: dmg, note });
      defused(d, 'bomb', dmg, b.slot >= 0 ? b.slot : undefined);
    }
  }

  const clear: number[] = [];
  d.board.forEach((c, i) => {
    if (!c.snare) return;
    const t = snareTarget(i, c.snare, d.board.length);
    if (t !== null && ids.has(d.board[t].id)) {
      bonus += SNARE_DEFUSE_DAMAGE;
      items.push({ label: 'Snare Defused', amount: SNARE_DEFUSE_DAMAGE, note: 'cleared snare trap' });
      clear.push(i);
      defused(d, 'snare', SNARE_DEFUSE_DAMAGE, i);
    } else if (ids.has(c.id)) {
      clear.push(i);
      sprung += 1;
    }
  });
  updateCards(d, clear, c => ({ ...c, snare: undefined }));
  return { bonus, sprung, items };
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
  let liftedFog = 0;
  d.board.forEach((c, i) => {
    if (c.snare || c.isFaceDown || bombIds.has(c.id)) idx.push(i);
    if (c.isFaceDown && (c.fogBonus ?? 0) > 0) liftedFog += 1;
  });
  d.board.forEach((c, i) => {
    if (c.snare) defused(d, 'snare', undefined, i);
    if (bombIds.has(c.id)) defused(d, 'bomb', undefined, i);
  });
  d.timeBombIds = [];
  updateCards(d, idx, c => {
    const hadFog = c.isFaceDown && (c.fogBonus ?? 0) > 0;
    const { fogFlipAt: _at, fogBonus, ...rest } = c;
    return {
      ...rest,
      snare: undefined,
      isFaceDown: false,
      ...(hadFog ? { bonusPoints: (c.bonusPoints ?? 0) + Math.round(fogBonus ?? 0) } : {}),
      ...(bombIds.has(c.id) ? { hasCountdown: false, countdownTimer: undefined } : {}),
    };
  });
  if (liftedFog > 0) enqueue(d, 'trick', undefined, 'fog');
};
