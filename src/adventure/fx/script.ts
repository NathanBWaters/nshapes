/**
 * Fight events → a script the stage can play. Pure: no React, no clock.
 *
 * One move's events play as a CASCADE, in the order they happened: the Set's
 * own hit first, then each thing it set off one step later. The steps are the
 * band's (src/audio/fightAudio.ts `takesChainSlot`), so every effect lands
 * with its sound. A short chain plays slower so each step can be read; a long
 * one speeds up, and never runs longer than about two seconds.
 *
 * An evolution splits the script: what led to it plays, then the cut-in holds
 * the screen until the player taps, then the rest plays.
 */
import { CHAIN_LEAD, isSetHit, isSour, takesChainSlot } from '@/audio/fightAudio';
import type { RunEvent } from '../types';
import { ownerOfEvent } from '../data/weaponGuide';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { getRecipe, getSkillNode } from '../engine/sources';
import { EVENT_FX } from './catalog';
import type { AnchorName, Beat, BeatSource, HitTier, Script, Segment } from './types';

export const HIT_TIERS = { big: 10, huge: 25, mega: 50 } as const;

export const hitTier = (amount: number): HitTier =>
  amount >= HIT_TIERS.mega ? 3 : amount >= HIT_TIERS.huge ? 2 : amount >= HIT_TIERS.big ? 1 : 0;

export const FX_TIMING = {
  /** One 32nd note at 120 bpm: the step when the band is not playing */
  gridMs: 62.5,
  /** An orb's flight from the cards to the HUD */
  flightMs: 240,
  /** A board effect with nothing to fly: how long until it "hits" */
  strikeMs: 110,
  /** After the last beat lands, before the clock runs again */
  settleMs: 180,
  /** How long a label stays up */
  lingerMs: 1000,
  /** Steps drawn in full; the rest of a huge chain is text only */
  maxSteps: 14,
} as const;

/** 32nd notes per step of the chain */
export const strideFor = (steps: number): number => (steps <= 4 ? 3 : steps <= 9 ? 2 : 1);

export interface ScriptContext {
  /** Held weapons, in the order they are held */
  weapons: readonly { id: string; name: string }[];
  /** One 32nd note of the band right now, ms (`band.gridMs`) */
  gridMs?: number;
  /** Effects are off: text only, all at once, and nothing holds the clock */
  reduced?: boolean;
}

/** The recipe an evolution event is about (the engine names it by id or by name). */
export const recipeIdOfEvent = (e: RunEvent): string | null =>
  EVOLUTION_RECIPES.find(r => r.id === e.text || r.name === e.text)?.id ?? null;

/** Who caused it: the rule behind it, or the held weapon that owns that kind of event. */
export const sourceOfEvent = (e: RunEvent, ctx: ScriptContext): BeatSource | null => {
  if (e.source) {
    const base = e.source.split('#')[0];
    if (base.startsWith('node:')) {
      const id = base.slice(5);
      return { ref: `node:${id}`, name: getSkillNode(id)?.name ?? id, anchor: 'fighter' };
    }
    if (base.startsWith('evo:')) {
      const id = base.slice(4);
      return { ref: `evo:${id}`, name: getRecipe(id)?.name ?? id, anchor: `evo:${id}` };
    }
    const held = /^w(\d+):(.*)$/.exec(base);
    if (held) {
      const w = ctx.weapons[Number(held[1])];
      const id = w?.id ?? held[2];
      return { ref: `weapon:${id}`, name: w?.name ?? id, anchor: `weapon:${id}` };
    }
  }
  const owner = ownerOfEvent(e.type, e.text, ctx.weapons.map(w => w.id));
  if (!owner) return null;
  return { ref: `weapon:${owner}`, name: ctx.weapons.find(w => w.id === owner)?.name ?? owner, anchor: `weapon:${owner}` };
};

/** A callout whose amount is damage it added to the Set (so something should fly to the foe) */
const isContribution = (e: RunEvent): boolean =>
  e.type !== 'rule' || ((e.amount ?? 0) > 0 && Number.isFinite(e.amount) && !e.slots && !(e.text ?? '').includes('×'));

/** The Set that leads a cascade: a plain hit, or a Rainbow */
const isLead = (e: RunEvent): boolean => isSetHit(e) || e.type === 'rainbow';

const beatsOf = (events: RunEvent[], ctx: ScriptContext): Segment => {
  const held = ctx.weapons.map(w => w.id);
  const setHit = events.some(isSetHit);
  const steps = events.filter(e => takesChainSlot(e, held, setHit)).length;
  const stride = ctx.reduced ? 1 : strideFor(steps);
  // (a band that is not there, or a nonsense tempo, falls back to 120 bpm)
  const grid = typeof ctx.gridMs === 'number' && ctx.gridMs >= 30 && ctx.gridMs <= 200 ? ctx.gridMs : FX_TIMING.gridMs;
  const step = stride * grid;
  const lead = events.find(isLead);
  const setSlots = lead?.slots ?? [];
  const lanes = new Map<string, number>();
  const namedSources = new Set<string>();
  const beats: Beat[] = [];
  let slot = setHit ? CHAIN_LEAD : 0;
  let taken = 0;

  for (const e of events) {
    const takes = takesChainSlot(e, held, setHit);
    const index = taken;
    const at = ctx.reduced || e === lead ? 0 : Math.min(slot, (setHit ? CHAIN_LEAD : 0) + FX_TIMING.maxSteps) * step;
    if (takes) {
      slot += 1;
      taken += 1;
    }
    const row = EVENT_FX[e.type];
    if (!row) continue;

    const sour = isSour(e);
    const flies = !!row.orb && !sour && isContribution(e);
    const slots = e.slots ?? [];
    const damage = row.damage ? Math.max(0, e.amount ?? 0) : 0;
    const tier = hitTier(damage);
    const text = row.label?.(e) ?? null;
    const label = text && tier === 3 ? `MEGA ${text}` : text;
    const laneKey = flies && row.to ? row.to : slots.length ? `slot:${slots[0]}` : row.from ?? 'board';
    const lane = lanes.get(laneKey) ?? 0;
    if (label) lanes.set(laneKey, lane + 1);
    const land = ctx.reduced ? 0 : at + (flies ? FX_TIMING.flightMs : FX_TIMING.strikeMs);
    const source = sourceOfEvent(e, ctx);
    const named = !!source && !namedSources.has(source.ref);
    if (source) namedSources.add(source.ref);

    beats.push({
      key: `e${e.id}`,
      event: e,
      row,
      at,
      land,
      life: land - at + FX_TIMING.lingerMs + tier * 250,
      slots,
      ghosts: e.cards ?? [],
      launch: slots.length ? slots : row.from === 'set' ? setSlots : [],
      source,
      named,
      label,
      lane,
      step: e === lead ? 0 : index + 1,
      lead: e === lead,
      tier,
      damage,
      flies,
      sour,
      quiet: !!ctx.reduced || (takes && index >= FX_TIMING.maxSteps),
    });
  }

  // Only the player's own moves hold the clock. What the clock itself causes (a foe's timer, a fuse,
  // an evolution running out) and ambient beats play while it runs.
  const holding = beats.filter(b => !b.row.ambient && !b.event.clock);
  const total = ctx.reduced || holding.length === 0 ? 0 : Math.max(...holding.map(b => b.land)) + FX_TIMING.settleMs;
  return { kind: 'beats', events, beats, total, stride };
};

export const scriptFor = (events: readonly RunEvent[], ctx: ScriptContext): Script => {
  const segments: Segment[] = [];
  let chunk: RunEvent[] = [];
  const flush = () => {
    if (chunk.length) segments.push(beatsOf(chunk, ctx));
    chunk = [];
  };
  for (const e of events) {
    chunk.push(e);
    if (e.type !== 'evolution_start') continue;
    const id = recipeIdOfEvent(e);
    const prev = segments[segments.length - 1];
    // Two evolutions at once share one cut-in
    if (chunk.length === 1 && prev?.kind === 'cutIn') {
      if (id && !prev.recipes.includes(id)) prev.recipes.push(id);
      chunk = [];
      continue;
    }
    flush();
    if (id) segments.push({ kind: 'cutIn', recipes: [id] });
  }
  flush();
  return { segments };
};

/** How long the clock is held for the beats of a script (cut-ins hold it for as long as they are up). */
export const scriptHoldMs = (script: Script): number =>
  script.segments.reduce((sum, s) => sum + (s.kind === 'beats' ? s.total : 0), 0);

export const scriptDamage = (script: Script): number =>
  script.segments.reduce((sum, s) => sum + (s.kind === 'beats' ? s.beats.reduce((d, b) => d + b.damage, 0) : 0), 0);

/** Every HUD place the catalog aims at or bumps, for the test that checks the HUD provides them. */
export const catalogAnchors = (): AnchorName[] => {
  const out = new Set<AnchorName>();
  for (const row of Object.values(EVENT_FX)) {
    if (!row) continue;
    if (row.to) out.add(row.to);
    if (row.from && row.from !== 'set') out.add(row.from);
    row.bump?.forEach(a => out.add(a));
  }
  return [...out];
};
