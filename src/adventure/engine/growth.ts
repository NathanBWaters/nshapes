/**
 * Weapon growth in a fight: counts what each held weapon is watching for,
 * turns it into stacks, and makes the stacks real (data/weaponGrowth.ts says
 * what each weapon watches and what a stack gives).
 *
 * A stack that raises one of the weapon's own numbers rebuilds the weapon from
 * its numbers (the same `buildWeapon` that levels and tuning use), so rules,
 * chances and wording all follow. A stack that adds a standing modifier is
 * read through `mods(d)` like any other source.
 */
import type { AttributeName, Card, PlayerStats, Weapon } from '@/types';
import { getArmoryWeapon } from '../data/armory';
import { HINTED_SET_MS, WEAPON_GROWTH, growthKey, growthStatBonus, type GrowthDef, type SetTest } from '../data/weaponGrowth';
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import { powerLevelFactor, powerPer, powerShare, powerWatches } from '../data/weaponPower';
import type { TrickKind, WeaponTriggerKind } from '../rules/types';
import { applyEffect } from '../rules/engine';
import type { RunState } from '../types';
import { GRID_COLS, emit, heal, mods, refreshSources, setGrowthHook, type Draft, type FightEventKind } from './fight';

/** Something a weapon may be watching for. */
export type GrowthEvent =
  | { on: 'set'; cards: readonly Card[]; slots: readonly number[]; rainbow: boolean; hinted: boolean }
  | { on: 'mistake'; cards: readonly Card[] }
  | { on: 'weapon'; kind: WeaponTriggerKind }
  | { on: 'trick'; kind: TrickKind }
  | { on: 'own'; weaponId: string }
  | { on: 'feat'; name: string }
  | { on: 'doubled' | 'catalyst' | 'healed' | 'hurt' | 'hintUsed' | 'graceUsed' | 'cardBurned' | 'linkDestroyed' | 'cardBroken' | 'evolutionEnd' };

const valueOf = (c: Card, a: AttributeName) => (a === 'background' ? c.background ?? 'white' : c[a]);

/** The four corner cards of the 3-column board (the last row may be short). */
export const cornerSlots = (boardLength: number): number[] => {
  if (boardLength <= 0) return [];
  const lastRow = Math.floor((boardLength - 1) / GRID_COLS) * GRID_COLS;
  return [...new Set([0, Math.min(GRID_COLS - 1, boardLength - 1), lastRow, boardLength - 1])];
};

const passes = (d: Draft, test: SetTest | undefined, ev: Extract<GrowthEvent, { on: 'set' }>): boolean => {
  switch (test) {
    case undefined: return true;
    case 'fullHearts': return d.hearts !== null && d.maxHearts !== null && d.hearts >= d.maxHearts;
    case 'rainbow': return ev.rainbow;
    case 'hinted': return ev.hinted;
    case 'oneTwoThree': return new Set(ev.cards.map(c => c.number)).size === 3;
    case 'corners': {
      const corners = cornerSlots(d.board.length);
      return ev.slots.filter(i => corners.includes(i)).length >= 2;
    }
    case 'sameColorAgain': {
      const color = ev.cards[0]?.color;
      return !!color && ev.cards.every(c => c.color === color) && d.growthMemo.lastSetColor === color;
    }
  }
};

/** Does this event count for this track? `null`: the event is not what it watches. */
const counts = (d: Draft, def: GrowthDef, weaponId: string, ev: GrowthEvent): boolean | null => {
  const w = def.watch;
  if (w.on !== ev.on) return null;
  switch (ev.on) {
    case 'set': return passes(d, (w as { test?: SetTest }).test, ev);
    case 'mistake': return !(w as { allRed?: boolean }).allRed || ev.cards.every(c => valueOf(c, 'color') === 'red');
    case 'weapon': return (w as { kind: WeaponTriggerKind }).kind === ev.kind ? true : null;
    case 'trick': return (w as { kind: TrickKind }).kind === ev.kind ? true : null;
    case 'own': return ev.weaponId === weaponId ? true : null;
    case 'feat': return (w as { name: string }).name === ev.name ? true : null;
    default: return true;
  }
};

/** Put the grown numbers into the held weapons, the baked stats and the weapon chances. */
const rebuild = (d: Draft, weaponId: string) => {
  const grown = growthStatBonus(d.growth, weaponId);
  const stats = { ...d.stats } as unknown as Record<string, number>;
  const chances = { ...d.baseChances };
  d.weapons = d.weapons.map(old => {
    if (old.id !== weaponId) return old;
    const next = getArmoryWeapon(weaponId, d.weaponBuilds, grown);
    if (!next) return old;
    for (const [k, v] of Object.entries(next.effects)) {
      const before = (old.effects as Record<string, unknown>)[k];
      if (typeof v !== 'number' || typeof before !== 'number' || v === before) continue;
      if (k in chances) chances[k] += v - before;
      else if (typeof stats[k] === 'number') stats[k] += v - before;
    }
    return next as Weapon;
  });
  d.stats = stats as unknown as PlayerStats;
  d.baseChances = chances;
  refreshSources(d);
};

const gain = (d: Draft, weaponId: string, slot: number, index: number, def: GrowthDef) => {
  const key = growthKey(weaponId, index);
  const track = d.growth[key] ?? { stacks: 0, progress: 0 };
  const cap = def.max ?? Infinity;
  if (track.stacks >= cap) return;
  const stacks = Math.min(cap, track.stacks + 1);
  d.growth = { ...d.growth, [key]: { stacks, progress: 0 } };
  if (def.stat) rebuild(d, weaponId);
  else refreshSources(d);
  // Named after the weapon, so its place on the belt jumps and the fight log credits it
  const prev = d._chain;
  d._chain = [...prev, `w${slot}:${weaponId}#grow`];
  emit(d, 'power_up', stacks, def.gives);
  if (def.now) applyEffect(d, def.now);
  d._chain = prev;
};

/** How deep growth is inside its own effects (a proc's effect can cause the event that procs it) */
let procDepth = 0;

/** The balance lab plays fights with growth off, to measure what it adds. */
let enabled = true;
export const setGrowthEnabled = (on: boolean) => {
  enabled = on;
};

/** Tell every held weapon that something happened. */
export const noteGrowth = (d: Draft, ev: GrowthEvent) => {
  if (!enabled) return;
  if (d.status !== 'playing' && d.status !== 'pick' && d.status !== 'intermission') return;
  const seen = new Set<string>();
  const share = powerShare(new Set(d.weapons.filter(w => powerWatches(w.id).length > 0).map(w => w.id)).size);
  d.weapons.forEach((w, slot) => {
    if (w.id === UNDERSTUDY_ID || seen.has(w.id)) return;
    seen.add(w.id);
    // Power: every watch that happens adds the weapon's share, at any stack count (it never stops)
    const hits = powerWatches(w.id).filter(watch => counts(d, { watch } as GrowthDef, w.id, ev) === true).length;
    if (hits > 0) d.power = (d.power ?? 0) + hits * share * powerPer(w.id) * powerLevelFactor(d.weaponBuilds[w.id]?.level ?? 1);
    (WEAPON_GROWTH[w.id] ?? []).forEach((def, index) => {
      const ok = counts(d, def, w.id, ev);
      if (ok === null) return;
      const key = growthKey(w.id, index);
      const track = d.growth[key] ?? { stacks: 0, progress: 0 };
      if (!ok) {
        if (def.unbroken && track.progress > 0) d.growth = { ...d.growth, [key]: { ...track, progress: 0 } };
        return;
      }
      if (def.chance !== undefined && d._rng.next() * 100 >= def.chance) return;
      const progress = track.progress + 1;
      if (progress < (def.every ?? 1)) {
        d.growth = { ...d.growth, [key]: { ...track, progress } };
        return;
      }
      gain(d, w.id, slot, index, def);
    });
  });

  // Stacks that make something more likely: each one adds its % that this event brings the effect too
  if (procDepth < 2) {
    procDepth += 1;
    const rolled = new Set<string>();
    d.weapons.forEach((w, slot) => {
      if (w.id === UNDERSTUDY_ID || rolled.has(w.id)) return;
      rolled.add(w.id);
      (WEAPON_GROWTH[w.id] ?? []).forEach((def, index) => {
        const stacks = d.growth[growthKey(w.id, index)]?.stacks ?? 0;
        if (!def.proc || stacks <= 0) return;
        if (counts(d, { ...def, watch: def.proc.on }, w.id, ev) !== true) return;
        if (d._rng.next() * 100 >= def.proc.pct * stacks) return;
        const prev = d._chain;
        d._chain = [...prev, `w${slot}:${w.id}#grow`];
        applyEffect(d, def.proc.effect);
        d._chain = prev;
      });
    });
    procDepth -= 1;
  }

  // What growth changes about the events themselves
  if (ev.on === 'weapon' && ev.kind === 'ricochet') {
    const pct = mods(d).ricochetHealChance ?? 0;
    if (pct > 0 && d._rng.next() * 100 < pct) heal(d, 1);
  }
  if (ev.on === 'weapon' && ev.kind === 'laser') {
    const pct = mods(d).laserSetChance ?? 0;
    if (pct > 0 && d._rng.next() * 100 < pct) d.growthMemo = { ...d.growthMemo, plantSet: true };
  }
  if (ev.on === 'hintUsed') d.growthMemo = { ...d.growthMemo, lastHintAtMs: d.elapsedMs };
  if (ev.on === 'set') {
    const color = ev.cards[0]?.color;
    d.growthMemo = { ...d.growthMemo, lastSetColor: color && ev.cards.every(c => c.color === color) ? color : null };
  }
};

/** A Set counts as made on a hint when the board said so, or a hint was spent moments ago. */
export const isHintedSet = (d: Draft, flagged: boolean | undefined): boolean =>
  !!flagged || (d.growthMemo.lastHintAtMs >= 0 && d.elapsedMs - d.growthMemo.lastHintAtMs <= HINTED_SET_MS);

/** Graces a fight starts with count toward what watches graces being gained (Fortune Token). */
export const seedGrowth = (d: Draft) => {
  d.weapons.forEach(w => {
    (WEAPON_GROWTH[w.id] ?? []).forEach((def, index) => {
      if (def.watch.on !== 'weapon' || def.watch.kind !== 'grace' || !def.every) return;
      const start = Math.min(def.every - 1, d.stats.graces);
      if (start > 0) d.growth = { ...d.growth, [growthKey(w.id, index)]: { stacks: 0, progress: start } };
    });
  });
};

const SIMPLE: Partial<Record<FightEventKind, GrowthEvent['on']>> = {
  healed: 'healed', hurt: 'hurt', hintUsed: 'hintUsed', graceUsed: 'graceUsed', cardBurned: 'cardBurned',
  linkDestroyed: 'linkDestroyed', cardBroken: 'cardBroken', evolutionEnd: 'evolutionEnd',
};

// Every queued fight event passes through here (fight.ts `enqueue`); Sets and mistakes are told with their cards by run.ts
setGrowthHook((d, ev) => {
  if (ev.on === 'own' || ev.on === 'feat') noteGrowth(d, ev);
  else if (ev.on === 'doubled' || ev.on === 'catalyst') noteGrowth(d, { on: ev.on });
  else if (ev.on === 'weapon' && ev.kind) noteGrowth(d, { on: 'weapon', kind: ev.kind });
  else if (ev.on === 'trick' && ev.trick) noteGrowth(d, { on: 'trick', kind: ev.trick });
  else if (SIMPLE[ev.on]) noteGrowth(d, { on: SIMPLE[ev.on] } as GrowthEvent);
});

/**
 * Would matching these cards grow a held weapon through the shape of the Set
 * itself (corners, colors, numbers, a Rainbow)? For the bots, which hunt for it
 * the way a player who read the weapon would.
 */
export const setWouldGrow = (s: RunState, cards: readonly Card[], attributes: readonly AttributeName[]): boolean => {
  const slots = cards.map(c => s.board.findIndex(b => b.id === c.id));
  const corners = cornerSlots(s.board.length);
  const color = cards[0]?.color;
  const oneColor = !!color && cards.every(c => c.color === color);
  return s.weapons.some(w =>
    (WEAPON_GROWTH[w.id] ?? []).some((def, i) => {
      if (def.watch.on !== 'set' || !def.watch.test) return false;
      const track = s.growth[growthKey(w.id, i)];
      if (def.max !== undefined && (track?.stacks ?? 0) >= def.max) return false;
      switch (def.watch.test) {
        case 'corners': return slots.filter(x => corners.includes(x)).length >= 2;
        case 'oneTwoThree': return new Set(cards.map(c => c.number)).size === 3;
        // Either half of the pair: a one-color Set sets up the next one
        case 'sameColorAgain': return oneColor && (s.growthMemo.lastSetColor === null || s.growthMemo.lastSetColor === color);
        case 'rainbow': return attributes.every(a => new Set(cards.map(c => valueOf(c, a))).size === 3);
        default: return false;
      }
    })
  );
};
