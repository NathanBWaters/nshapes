/**
 * Shading Surge (Worlds 3-5).
 *
 * The board plays on the level's attributes (three) with every card solid.
 * Every SURGE_RULES.calmMs of fight clock, shading switches on for
 * SURGE_RULES.surgeMs: each card on the board keeps its shape, color and
 * number and takes a shading, and every Set made meanwhile gains +12 base
 * damage and ×1.8 multiplier. Then the cards go back to solid. The surge runs
 * on the fight clock, so freezes, level-ups and the shop pause it.
 */
import { ATTRIBUTE_VALUES } from '@/utils/gameUtils';
import { SURGE_RULES } from '../data/rules';
import type { SurgeState } from '../types';
import { allSets, hasAnySet, isSelectable } from './sets';
import { emit, type Draft } from './fight';

const SOLID = ATTRIBUTE_VALUES.shading[0];

export const initialSurge = (): SurgeState => ({ active: false, msLeft: SURGE_RULES.calmMs, count: 0, sets: 0 });

/** The multiplier on a Set scored now. */
export const surgeMultiplier = (d: Draft): number => (d.surge?.active ? SURGE_RULES.multiplier : 1);

/** Elevated flat base damage added on every Set made during an active Shading Surge (+12). */
export const surgeFlatBonus = (d: Draft): number => (d.surge?.active ? (SURGE_RULES.flatBonus ?? 12) : 0);

/** Give every board card a shading, keeping at least one Set on the board. */
const shadeBoard = (d: Draft) => {
  const base = d.board;
  for (let attempt = 0; attempt < 20; attempt++) {
    d.board = base.map(c => ({ ...c, shading: d._rng.pick(ATTRIBUTE_VALUES.shading) }));
    if (hasAnySet(d.board, d.attributes)) return;
  }
  const sets = allSets(base.filter(isSelectable), d.level.rules.attributes);
  if (sets.length === 0) return;
  const ids = new Set(d._rng.pick(sets).map(c => c.id));
  const shading = d._rng.pick(ATTRIBUTE_VALUES.shading);
  d.board = d.board.map(c => (ids.has(c.id) ? { ...c, shading } : c));
};

const startSurge = (d: Draft, surge: SurgeState) => {
  d.surge = { ...surge, active: true, msLeft: SURGE_RULES.surgeMs, count: surge.count + 1 };
  d.attributes = d.level.rules.attributes.includes('shading')
    ? [...d.level.rules.attributes]
    : [...d.level.rules.attributes, 'shading'];
  shadeBoard(d);
  emit(d, 'surge_start', SURGE_RULES.multiplier);
};

const endSurge = (d: Draft, surge: SurgeState) => {
  d.surge = { ...surge, active: false, msLeft: SURGE_RULES.calmMs };
  d.attributes = [...d.level.rules.attributes];
  d.board = d.board.map(c => (c.shading === SOLID ? c : { ...c, shading: SOLID }));
  if (d.simplified?.attribute === 'shading') d.simplified = null;
  emit(d, 'surge_end');
};

/** Dev/sandbox helper ([TP-11]/[TP-12]): explicitly engage or end Shading Surge on demand. */
export const setSurgeActive = (d: Draft, active: boolean) => {
  const cur = d.surge ?? initialSurge();
  if (active) {
    if (!cur.active) startSurge(d, cur);
  } else if (cur.active) {
    endSurge(d, cur);
  }
};

/** Advance the surge clock by `ms` of fight time. */
export const tickSurge = (d: Draft, ms: number) => {
  const surge = d.surge;
  if (!surge) return;
  const msLeft = surge.msLeft - ms;
  if (msLeft > 0) {
    const warnAt = SURGE_RULES.warnMs;
    if (!surge.active && surge.msLeft > warnAt && msLeft <= warnAt) emit(d, 'surge_warn', Math.ceil(msLeft / 1000));
    d.surge = { ...surge, msLeft };
    return;
  }
  if (surge.active) endSurge(d, surge);
  else startSurge(d, surge);
};
