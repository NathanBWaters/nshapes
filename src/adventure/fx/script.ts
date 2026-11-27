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
import { CHAIN_LEAD, IMPACT_MS, isSetHit, isSour, takesChainSlot, type TimedEvent } from '@/audio/fightAudio';
import type { RunEvent } from '../types';
import { ownerOfEvent } from '../data/weaponGuide';
import { WEAPON_EVOLUTIONS, getWeaponEvolution } from '../data/evolutions';
import { getSkillNode } from '../engine/sources';
import { EVENT_FX } from './catalog';
import type { AnchorName, Beat, BeatSource, HitTier, Script, Segment } from './types';

export const HIT_TIERS = { big: 10, huge: 25, mega: 50 } as const;

export const hitTier = (amount: number): HitTier =>
  amount >= HIT_TIERS.mega ? 3 : amount >= HIT_TIERS.huge ? 2 : amount >= HIT_TIERS.big ? 1 : 0;

export const FX_TIMING = {
  /** One 32nd note at 120 bpm: the step when the band is not playing */
  gridMs: 62.5,
  /** An orb's (or a thrown card's) flight from the cards to its target, at 120 bpm (`flightFor` fits it to the band's grid) */
  flightMs: IMPACT_MS,
  /** A board effect with nothing to fly: how long until it "hits" */
  strikeMs: 110,
  /** After the last beat lands, before the clock runs again */
  settleMs: 180,
  /** How long a label stays up */
  lingerMs: 1000,
  /** Steps drawn in full; the rest of a huge chain is text only */
  maxSteps: 14,
} as const;

/** A flight lasts a whole number of the band's 32nd notes, so a sound that lands with it is still on the beat */
export const flightFor = (gridMs: number): number => Math.max(1, Math.round(FX_TIMING.flightMs / gridMs)) * gridMs;

/** 32nd notes per step of the chain */
export const strideFor = (steps: number): number => (steps <= 4 ? 3 : steps <= 9 ? 2 : 1);

export interface ScriptContext {
  /** Held weapons, in the order they are held */
  weapons: readonly { id: string; name: string }[];
  /** One 32nd note of the band right now, ms (`band.gridMs`) */
  gridMs?: number;
  /** Effects are off: text only, all at once, and nothing holds the clock */
  reduced?: boolean;
  /** Fight already ended (won/lost): never pause the victory/defeat transition for an Evolution cut-in */
  skipCutIn?: boolean;
  /** Evolutions already seen before: show non-blocking EvolutionBanner instead of pausing ([OB-08]) */
  bannerOnlyEvolutions?: ReadonlySet<string>;
  /** Back-compat alias for `bannerOnlyEvolutions` */
  bannerOnlyRecipes?: ReadonlySet<string>;
  /** Force non-blocking EvolutionBanner for all evolutions in this script */
  forceBanner?: boolean;
}

/** The per-weapon evolution an event refers to (resolved from `source: evo:<id>` or `text` id/name). */
export const evolutionIdOfEvent = (e: RunEvent): string | null => {
  if (e.source) {
    const base = e.source.split('#')[0];
    if (base.startsWith('evo:')) {
      const id = base.slice(4);
      if (getWeaponEvolution(id)) return id;
    }
  }
  if (!e.text) return null;
  return WEAPON_EVOLUTIONS.find(def => def.id === e.text || def.name === e.text)?.id ?? null;
};

/** Back-compat barrel alias for `evolutionIdOfEvent`. */
export const recipeIdOfEvent = evolutionIdOfEvent;

/** Who caused it: the rule behind it, the weapon's belt slot, or the held weapon that owns that event. */
export const sourceOfEvent = (e: RunEvent, ctx: ScriptContext): BeatSource | null => {
  if (e.source) {
    const base = e.source.split('#')[0];
    if (base.startsWith('node:')) {
      const id = base.slice(5);
      return { ref: `node:${id}`, name: getSkillNode(id)?.name ?? id, anchor: 'fighter' };
    }
    if (base.startsWith('weapon:')) {
      const id = base.slice(7);
      const w = ctx.weapons.find(item => item.id === id);
      return { ref: `weapon:${id}`, name: w?.name ?? id, anchor: `weapon:${id}` };
    }
    if (base.startsWith('evo:')) {
      const id = base.slice(4);
      const def = getWeaponEvolution(id);
      const anchor: AnchorName = def ? `weapon:${def.weaponId}` : 'fighter';
      return { ref: `evo:${id}`, name: def?.name ?? id, anchor };
    }
    const held = /^w(\d+):(.*)$/.exec(base);
    if (held) {
      const w = ctx.weapons[Number(held[1])];
      const id = w?.id ?? held[2];
      return { ref: `weapon:${id}`, name: w?.name ?? id, anchor: `weapon:${id}` };
    }
  }
  if (e.type === 'evolution_start' || e.type === 'evolution_end') {
    const evoId = evolutionIdOfEvent(e);
    const def = evoId ? getWeaponEvolution(evoId) : undefined;
    if (def) {
      return { ref: `evo:${def.id}`, name: def.name, anchor: `weapon:${def.weaponId}` };
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
  const flight = flightFor(grid);
  const lead = events.find(isLead);
  const setSlots = lead?.slots ?? [];
  const lanes = new Map<string, number>();
  const namedSources = new Set<string>();
  // A rule's callout and the hit it dealt carry the same name: say it once, on the hit
  const dealt = new Set(events.filter(e => e.type === 'hit' && e.text).map(e => `${e.source ?? ''}|${e.text}`));
  const echoesHit = (e: RunEvent) => e.type === 'rule' && dealt.has(`${e.source ?? ''}|${e.text}`);
  const beats: Beat[] = [];
  const timedEvents: TimedEvent[] = [];
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
    if (!row) {
      timedEvents.push(e);
      continue;
    }

    const sour = isSour(e);
    const flies = !!row.orb && !sour && isContribution(e) && !echoesHit(e);
    const slots = e.slots ?? [];
    const damage = row.damage ? Math.max(0, e.amount ?? 0) : 0;
    const tier = hitTier(damage);
    const text = echoesHit(e) ? null : row.label?.(e) ?? null;
    const label = text && tier === 3 ? `MEGA ${text}` : text;
    const laneKey = flies && row.to ? row.to : slots.length ? `slot:${slots[0]}` : row.from ?? 'board';
    const lane = lanes.get(laneKey) ?? 0;
    if (label) lanes.set(laneKey, lane + 1);
    const land = ctx.reduced ? 0 : at + (flies ? flight : FX_TIMING.strikeMs);
    // Its sound is heard on its picture: when what it throws arrives (the Set's cards at the foe, a coin at the
    // counter), unless it happens on the board itself (a blast on a card): then as that starts, on its step.
    const onBoard = !!row.board && (slots.length > 0 || (!!row.from && row.from !== 'set')) && row.to !== 'board';
    const cue = ctx.reduced ? 0 : flies && (e === lead || !onBoard) ? land : at;
    const source = sourceOfEvent(e, ctx);
    const named = !!source && !namedSources.has(source.ref);
    // The band reads when to sound it from the event itself (src/audio/fightAudio.ts `soundsFor`)
    const timed: TimedEvent = cue > at ? { ...e, heardAfterMs: cue - at } : e;
    timedEvents.push(timed);
    if (source) namedSources.add(source.ref);

    beats.push({
      key: `e${e.id}`,
      event: timed,
      row,
      at,
      land,
      cue,
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
  return { kind: 'beats', events: timedEvents, beats, total, stride };
};

export const scriptFor = (events: readonly RunEvent[], ctx: ScriptContext): Script => {
  const segments: Segment[] = [];
  let chunk: RunEvent[] = [];
  const flush = () => {
    if (chunk.length) segments.push(beatsOf(chunk, ctx));
    chunk = [];
  };
  for (const e of events) {
    if (e.type !== 'evolution_start' || ctx.skipCutIn) {
      chunk.push(e);
      continue;
    }
    const id = evolutionIdOfEvent(e);
    const segKind: 'cutIn' | 'banner' =
      ctx.forceBanner || (id !== null && (ctx.bannerOnlyEvolutions?.has(id) || ctx.bannerOnlyRecipes?.has(id)))
        ? 'banner'
        : 'cutIn';
    // [OB-08] Non-blocking banner evolutions never hold the fight clock on their own
    chunk.push(segKind === 'banner' ? { ...e, clock: true } : e);
    const prev = segments[segments.length - 1];
    // Two evolutions at once share one cut-in or banner
    if (chunk.length === 1 && prev?.kind === segKind) {
      if (id && !prev.recipes.includes(id)) prev.recipes.push(id);
      chunk = [];
      continue;
    }
    flush();
    if (id) segments.push({ kind: segKind, recipes: [id] });
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
