/**
 * The fight's effects (src/adventure/fx). These tests are the guard:
 *
 *  - every kind of fight event has a row in the catalog that shows something
 *    (the type checker already refuses a missing row; this refuses an empty one),
 *  - sound and picture step through a cascade together, and each sound is
 *    heard on the frame its picture lands, never before,
 *  - a cascade never holds the clock for long, and things that repeat on the
 *    clock never hold it at all,
 *  - the engine says WHERE things happened, so they can be drawn there,
 *  - the stage and the evolution cut-in render and let go of the clock.
 */
import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { EVENT_CUE, soundsFor, takesChainSlot } from '@/audio/fightAudio';
import { PASSIVES } from '@/adventure/data/passives';
import { WEAPON_EVOLUTIONS } from '@/adventure/data/evolutions';
import { runReducer } from '@/adventure/engine/run';
import {
  Anchor,
  AnchorsProvider,
  EVENT_FX,
  EvolutionCutIn,
  FxStage,
  FX_TIMING,
  scriptFor,
  scriptHoldMs,
  strideFor,
  useAnchors,
  useFightFx,
} from '@/adventure/fx';
import { shouldSkipAnchorJump } from '@/adventure/fx/anchors';
import { combatShakeKindOf, hitKindOf } from '@/adventure/fx/catalog';
import { impactEdgeOf, leadStarburstSize } from '@/adventure/fx/FxStage';
import { catalogAnchors, flightFor, scriptDamage, sourceOfEvent } from '@/adventure/fx/script';
import {
  BEAM_TIMING,
  Explosion,
  EXPLOSION_TIMING,
  explosionSlotBudgets,
  Ghost,
  ghostHitstopHoldMs,
  MAX_EXPLOSION_EMBERS,
  Ring,
  STARBURST_DEFAULT_MS,
  THROW_PHYSICS,
  TICK_RAYS,
} from '@/adventure/fx/visuals';
import {
  ChiaroscuroFlash,
  CHIAROSCURO_FLASH_MS,
  chiaroscuroDistanceScale,
  EVOLUTION_BANNER_TIMING,
  EvolutionBanner,
  MegaFlash,
} from '@/adventure/components/RunFx';
import type { Anchors } from '@/adventure/fx/anchors';
import type { AnchorName, Beat, Rect, Segment } from '@/adventure/fx/types';
import type { RunEvent, RunEventType } from '@/adventure/types';
import {
  buildCombatShakePlan,
  COMBAT_SHAKE_DECAY,
  COMBAT_SHAKE_SPECS,
  geometricShakeSequence,
  useCombatShake,
  viewportShakeScale,
} from '@/hooks/useCombatShake';
import type { Card } from '@/types';
import { ScreenFlashStorage, ScreenShakeStorage } from '@/utils/fxSettingsStorage';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { eventsOf, findSet, plainRewards, relic, startFight, tick, withWeapons } from './testUtils/adventureFight';

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  G: 'G',
  Path: 'Path',
  Polygon: 'Polygon',
  Polyline: 'Polyline',
  Line: 'Line',
  Rect: 'Rect',
  Defs: 'Defs',
  Pattern: 'Pattern',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
}));

jest.mock('@/components/Icon', () => {
  const { Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return <RNText>{name}</RNText>;
  };
});

jest.mock('@/components/weapons', () => {
  const { Text: RNText } = require('react-native');
  return { WeaponAvatar: ({ weapon }: { weapon: { name: string } }) => <RNText>{weapon.name}</RNText> };
});

const TYPES = Object.keys(EVENT_FX) as RunEventType[];
const WEAPONS = [
  { id: 'blast-powder', name: 'Blast Powder' },
  { id: 'mending-charm', name: 'Mending Charm' },
];

let id = 0;
const ev = (type: RunEventType, more: Partial<RunEvent> = {}): RunEvent => ({ id: ++id, type, ...more });
const beatsOf = (events: RunEvent[], ctx = {}): Beat[] =>
  scriptFor(events, { weapons: WEAPONS, ...ctx }).segments.flatMap(s => (s.kind === 'beats' ? s.beats : []));
const firstBeats = (events: RunEvent[]): Extract<Segment, { kind: 'beats' }> => {
  const seg = scriptFor(events, { weapons: WEAPONS }).segments[0];
  if (seg.kind !== 'beats') throw new Error('expected beats');
  return seg;
};

describe('the catalog: what every event looks like', () => {
  it('has a row for every event type the band has a cue for, and covers new per-weapon evo & card modifier events without catalyst_spawn', () => {
    expect(TYPES.sort()).toEqual((Object.keys(EVENT_CUE) as RunEventType[]).sort());
    expect(TYPES).toContain('evo_progress');
    expect(TYPES).toContain('evo_almost');
    expect(TYPES).toContain('evo_charge');
    expect(TYPES).toContain('holo_spawn');
    expect(TYPES).toContain('marked');
    expect(TYPES as string[]).not.toContain('catalyst_spawn');
  });

  it('every row shows something', () => {
    for (const type of TYPES) {
      const row = EVENT_FX[type];
      if (!row) continue;
      const shows = !!(row.board || row.sweep || row.orb || row.aura || row.bump?.length || row.label);
      expect({ type, shows }).toEqual({ type, shows: true });
      // an orb needs somewhere to go
      if (row.orb) expect({ type, to: !!row.to }).toEqual({ type, to: true });
    }
  });

  it('only the events listed here are allowed to show nothing', () => {
    // mistake: the board's own red flash and shake show it, and the heart it costs is `hurt`
    expect(TYPES.filter(t => EVENT_FX[t] === null)).toEqual(['mistake']);
  });

  it('aims only at places the fight HUD has', () => {
    const fixed = new Set(['foe', 'fighter', 'hearts', 'clock', 'coins', 'hint', 'graces', 'xp', 'combo', 'board']);
    for (const name of catalogAnchors()) {
      const ok = fixed.has(name) || (name.startsWith('passive:') && name.slice(8) in PASSIVES);
      expect({ name, ok }).toEqual({ name, ok: true });
    }
  });

  it('labels every event without crashing, whatever it carries', () => {
    for (const type of TYPES) {
      for (const e of [ev(type), ev(type, { amount: 3, text: 'x' }), ev(type, { amount: 0.5, text: '2', slots: [0, 1] })]) {
        const label = EVENT_FX[type]?.label?.(e);
        if (label != null) expect({ type, ok: label.length > 0 && !label.includes('undefined') && !label.includes('NaN') }).toEqual({ type, ok: true });
      }
    }
  });

  it('labels folded Set-break pinata_break cleanly as PIÑATA! instead of −0, and keeps standalone damage labels', () => {
    expect(EVENT_FX.pinata_break?.label?.(ev('pinata_break'))).toBe('PIÑATA!');
    expect(EVENT_FX.pinata_break?.label?.(ev('pinata_break', { amount: 0 }))).toBe('PIÑATA!');
    expect(EVENT_FX.pinata_break?.label?.(ev('pinata_break', { amount: 12 }))).toBe('PIÑATA −12');
    const [foldedBeat] = beatsOf([ev('pinata_break', { slots: [0] })]);
    expect(foldedBeat.label).toBe('PIÑATA!');
  });
});

describe('the script: one move as a cascade', () => {
  it("the Set's own hit leads; what it set off follows in order, one step each", () => {
    const seg = firstBeats([ev('hit', { amount: 7, slots: [0, 4, 8] }), ev('blast', { amount: 4, text: '2', slots: [3, 7] }), ev('coins', { amount: 5 }), ev('heal', { amount: 1 })]);
    const step = seg.stride * FX_TIMING.gridMs;
    expect(seg.beats.map(b => b.event.type)).toEqual(['hit', 'blast', 'coins', 'heal']);
    expect(seg.beats.map(b => b.at / step)).toEqual([0, 2, 3, 4]);
    expect(seg.beats.map(b => b.step)).toEqual([0, 1, 2, 3]);
    // each lands after it starts, and the clock is held until the last one has landed
    for (const b of seg.beats) expect(b.land).toBeGreaterThan(b.at);
    expect(seg.total).toBe(Math.max(...seg.beats.map(b => b.land)) + FX_TIMING.settleMs);
  });

  it('each sound is heard when its picture lands: the Set at the foe, a coin at the counter, a blast where it goes off', () => {
    const seg = firstBeats([ev('hit', { amount: 7, slots: [0, 4, 8] }), ev('blast', { amount: 4, text: '2', slots: [3, 7] }), ev('coins', { amount: 5 })]);
    const [hit, blast, coins] = seg.beats;
    const flight = flightFor(FX_TIMING.gridMs);
    // the Set's cards (and a coin) fly: heard as they arrive; a blast goes off on the board as its step starts
    expect(hit.cue).toBe(hit.land);
    expect(hit.land - hit.at).toBe(flight);
    expect(coins.flies && coins.cue === coins.land).toBe(true);
    expect(blast.cue).toBe(blast.at);
    // …and the band reads that from the events it is handed
    const sounds = soundsFor(seg.events, { weapons: WEAPONS.map(w => w.id), combo: 1 });
    expect(sounds.find(s => s.kind === 'payout')?.after).toBe(flight);
    expect(sounds.find(s => s.kind === 'cue' && s.name === 'coins')?.after).toBe(flight);
    expect(sounds.find(s => s.kind === 'cue' && s.name === 'blast')?.after).toBeUndefined();
  });

  it('a flight is a whole number of the band\'s 32nd notes, so what lands with it stays on the beat', () => {
    for (const grid of [40, 53.6, 62.5, 75, 120]) {
      const steps = flightFor(grid) / grid;
      expect({ grid, whole: Math.abs(steps - Math.round(steps)) < 1e-9 && steps >= 1 }).toEqual({ grid, whole: true });
      expect(Math.abs(flightFor(grid) - FX_TIMING.flightMs)).toBeLessThanOrEqual(grid / 2);
    }
  });

  it('a short chain plays slower than a long one', () => {
    expect(strideFor(2)).toBeGreaterThan(strideFor(7));
    expect(strideFor(7)).toBeGreaterThan(strideFor(12));
  });

  it('never holds the clock much longer than two seconds, however long the chain', () => {
    for (const n of [1, 3, 5, 9, 10, 14, 30, 60]) {
      const events = [ev('hit', { amount: 5, slots: [0, 1, 2] }), ...Array.from({ length: n }, () => ev('blast', { amount: 1, text: '1', slots: [4] }))];
      const hold = scriptHoldMs(scriptFor(events, { weapons: WEAPONS }));
      expect({ n, ok: hold > 0 && hold <= 2300 }).toEqual({ n, ok: true });
    }
  });

  it('draws only the first steps of a huge chain in full: the rest is text', () => {
    const events = [ev('hit', { amount: 5, slots: [0, 1, 2] }), ...Array.from({ length: 30 }, () => ev('blast', { amount: 1, text: '1', slots: [4] }))];
    const beats = beatsOf(events);
    expect(beats.filter(b => !b.quiet)).toHaveLength(1 + FX_TIMING.maxSteps);
    // …but all of its damage still comes off the bar
    expect(scriptDamage(scriptFor(events, { weapons: WEAPONS }))).toBe(5 + 30);
  });

  it('steps with the band: every event takes a step on screen exactly when it takes one in the sound', () => {
    const held = WEAPONS.map(w => w.id);
    for (const type of TYPES) {
      const events = [ev('hit', { amount: 5, slots: [0, 1, 2] }), ev(type, { amount: 2, text: 'x' }), ev('coins', { amount: 1 })];
      const seg = firstBeats(events);
      const step = seg.stride * FX_TIMING.gridMs;
      const coins = seg.beats.find(b => b.event.type === 'coins' && b.event.id !== events[1].id)!;
      const cue = soundsFor(events, { weapons: held, combo: 1 }).filter(s => s.kind === 'cue' && s.name === 'coins').pop();
      // the coins after it land on the same step in both
      if (cue && cue.kind === 'cue' && type !== 'evolution_start') expect({ type, at: coins.at / step }).toEqual({ type, at: cue.slot });
      expect(typeof takesChainSlot(events[1], held, true)).toBe('boolean');
    }
  });

  it('counts as damage only what was dealt right then (bonuses folded into the Set are not counted twice)', () => {
    const events = [
      ev('grudge_release', { amount: 6 }), ev('patience', { amount: 3 }), ev('rule', { amount: 4, text: 'Mirror!' }),
      ev('hit', { amount: 20, slots: [0, 1, 2] }), ev('blast', { text: '2', slots: [3, 4] }), ev('blast', { amount: 5, text: '1', slots: [5] }),
      ev('trap_defused', { amount: 4, text: 'snare' }), ev('hot_streak_hit', { amount: 2 }),
    ];
    expect(scriptDamage(scriptFor(events, { weapons: WEAPONS }))).toBe(25);
  });

  it('says who did it: the rule behind the event, or the held weapon that owns that kind of event (retargeting evo anchors to weapon:<id>)', () => {
    const ctx = { weapons: WEAPONS };
    expect(sourceOfEvent(ev('heal', { source: 'w1:mending-charm#0' }), ctx)).toEqual({ ref: 'weapon:mending-charm', name: 'Mending Charm', anchor: 'weapon:mending-charm' });
    expect(sourceOfEvent(ev('evo_progress', { source: 'weapon:blast-powder', text: '1/3' }), ctx)).toEqual({
      ref: 'weapon:blast-powder',
      name: 'Blast Powder',
      anchor: 'weapon:blast-powder',
    });
    expect(sourceOfEvent(ev('blast'), ctx)?.anchor).toBe('weapon:blast-powder');
    const evo = WEAPON_EVOLUTIONS[0];
    expect(sourceOfEvent(ev('laser', { source: `evo:${evo.id}#1` }), ctx)).toEqual({
      ref: `evo:${evo.id}`,
      name: evo.name,
      anchor: `weapon:${evo.weaponId}`,
    });
    expect(sourceOfEvent(ev('evolution_start', { text: evo.name }), ctx)).toEqual({
      ref: `evo:${evo.id}`,
      name: evo.name,
      anchor: `weapon:${evo.weaponId}`,
    });
    expect(sourceOfEvent(ev('evolution_end', { text: evo.name }), ctx)).toEqual({
      ref: `evo:${evo.id}`,
      name: evo.name,
      anchor: `weapon:${evo.weaponId}`,
    });
    expect(sourceOfEvent(ev('hit', { source: 'node:some-node#0' }), ctx)?.anchor).toBe('fighter');
    expect(sourceOfEvent(ev('laser'), ctx)).toBeNull();
  });

  it("a rule's callout and the hit it dealt are named once, on the hit", () => {
    const source = 'w0:blast-powder#0';
    const beats = beatsOf([ev('hit', { amount: 5, slots: [0, 1, 2] }), ev('rule', { text: 'Overheal!', source }), ev('hit', { amount: 7, text: 'Overheal!', source })]);
    expect(beats.map(b => b.label)).toEqual(['−5', null, 'Overheal! −7']);
    expect(beats[1].flies).toBe(false);
    // a callout with no hit of its own still speaks
    expect(beatsOf([ev('rule', { text: 'Mirror!', amount: 4 })])[0].label).toBe('Mirror! +4');
  });

  it('remembers the cards an event removed, so they can be shown breaking', () => {
    const card = { id: 'c', shape: 'oval', color: 'red', number: 1, shading: 'solid', selected: false } as Card;
    const [, blast] = beatsOf([ev('hit', { amount: 3, slots: [0, 1, 2] }), ev('blast', { amount: 2, text: '1', slots: [5], cards: [card] })]);
    expect(blast.slots).toEqual([5]);
    expect(blast.ghosts).toEqual([card]);
  });

  it('what a Set pays flies from the cards of that Set', () => {
    const beats = beatsOf([ev('hit', { amount: 3, slots: [2, 5, 7] }), ev('coins', { amount: 4 })]);
    expect(beats[1].launch).toEqual([2, 5, 7]);
    expect(beats[1].flies).toBe(true);
  });

  it('bad news from your own gear shakes and never flies at the foe', () => {
    const [beat] = beatsOf([ev('rule', { amount: 0.5, text: 'Off the rope' })]);
    expect(beat.sour).toBe(true);
    expect(beat.flies).toBe(false);
  });

  it('things that repeat on the clock or tick evolution progress play ambiently and never hold the clock', () => {
    for (const type of TYPES.filter(t => EVENT_FX[t]?.ambient)) {
      expect({ type, hold: scriptHoldMs(scriptFor([ev(type, { amount: 1, slots: [0] })], { weapons: WEAPONS })) }).toEqual({ type, hold: 0 });
    }
    expect(TYPES.filter(t => EVENT_FX[t]?.ambient).sort()).toEqual([
      'countdown',
      'evo_almost',
      'evo_progress',
      'keen_eye',
      'parry_warn',
      'regen',
    ]);
  });

  it('only the player\'s own moves hold the clock: what the clock causes plays while it runs', () => {
    const foeMove = [ev('shuffle', { clock: true }), ev('card_removed', { clock: true, slots: [3] })];
    expect(scriptHoldMs(scriptFor(foeMove, { weapons: WEAPONS }))).toBe(0);
    // …but it is still drawn in full
    expect(beatsOf(foeMove).every(b => !b.quiet)).toBe(true);
    expect(scriptHoldMs(scriptFor([ev('shuffle')], { weapons: WEAPONS }))).toBeGreaterThan(0);
  });

  it('an evolution splits the script: what led to it, the cut-in, then the rest', () => {
    const evo = WEAPON_EVOLUTIONS[0];
    const script = scriptFor(
      [ev('hit', { amount: 5, slots: [0, 1, 2] }), ev('evolution_start', { text: evo.name, source: `evo:${evo.id}`, slots: [1] }), ev('hit', { amount: 10, text: evo.name })],
      { weapons: WEAPONS }
    );
    expect(script.segments.map(s => s.kind)).toEqual(['beats', 'cutIn', 'beats']);
    expect(script.segments[1]).toEqual({ kind: 'cutIn', recipes: [evo.id] });
    expect((script.segments[0] as Extract<Segment, { kind: 'beats' }>).beats.map(b => b.event.type)).toEqual(['hit', 'evolution_start']);
  });

  it('two evolutions at once share one cut-in', () => {
    const [a, b] = WEAPON_EVOLUTIONS;
    const script = scriptFor([ev('evolution_start', { text: a.name }), ev('evolution_start', { text: b.name })], { weapons: WEAPONS });
    expect(script.segments.filter(s => s.kind === 'cutIn')).toEqual([{ kind: 'cutIn', recipes: [a.id, b.id] }]);
  });

  it('skipCutIn omits the blocking Evolution cut-in when the fight already ended while keeping lethal beats intact', () => {
    const evo = WEAPON_EVOLUTIONS[0];
    const script = scriptFor(
      [
        ev('hit', { amount: 5, slots: [0, 1, 2] }),
        ev('evolution_start', { text: evo.name, slots: [1] }),
        ev('hit', { amount: 10, text: evo.name }),
        ev('foe_defeated'),
      ],
      { weapons: WEAPONS, skipCutIn: true }
    );
    expect(script.segments.map(s => s.kind)).toEqual(['beats']);
    const beatTypes = (script.segments[0] as Extract<Segment, { kind: 'beats' }>).beats.map(b => b.event.type);
    expect(beatTypes).toContain('hit');
    expect(beatTypes).toContain('foe_defeated');
  });

  it('with effects off everything is text, at once, and nothing holds the clock', () => {
    const script = scriptFor([ev('hit', { amount: 5, slots: [0, 1, 2] }), ev('blast', { amount: 2, text: '1', slots: [3] })], { weapons: WEAPONS, reduced: true });
    expect(scriptHoldMs(script)).toBe(0);
    const beats = script.segments.flatMap(s => (s.kind === 'beats' ? s.beats : []));
    expect(beats.every(b => b.quiet && b.at === 0 && b.land === 0)).toBe(true);
    expect(beats.map(b => b.label)).toEqual(['−5', 'BLAST −2']);
  });

  it('a nonsense tempo falls back to the default step', () => {
    const at = (gridMs: number) => beatsOf([ev('hit', { amount: 1, slots: [0, 1, 2] }), ev('coins', { amount: 1 })], { gridMs })[1].at;
    expect(at(Number.NaN)).toBe(at(FX_TIMING.gridMs));
    expect(at(0)).toBe(at(FX_TIMING.gridMs));
    expect(at(80)).toBeGreaterThan(at(FX_TIMING.gridMs));
  });
});

describe('the engine says where things happened', () => {
  const base = () => startFight({ save: { selectedFighter: 'Pelican' }, features: ['hearts', 'gear'] });
  const noFx = (over: Partial<WeaponEffectResult>): WeaponEffectResult => ({
    explosiveCards: [], laserCards: [], laserCount: 0, fireCards: [], ricochetCards: [], ricochetCount: 0, autoMatchedSets: [],
    bonusPoints: 0, bonusMoney: 0, bonusTime: 0, bonusGraces: 0, bonusHealing: 0, bonusHints: 0, bonusExperience: 0, bonusCoins: 0,
    boardGrowth: 0, notifications: [], timeGainTriggered: false, ...over,
  });

  it("a Set's hit names the slots of its three cards", () => {
    const s = base();
    const set = findSet(s)!;
    const next = runReducer(s, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
    const [hit] = eventsOf(next, 'hit');
    expect(hit.slots).toEqual(set.map(c => s.board.findIndex(b => b.id === c.id)));
  });

  it("a blast the board rolled is told with its cards and no damage of its own (it is inside the Set's hit)", () => {
    const s = base();
    const set = findSet(s)!;
    const collateral = s.board.filter(c => !set.includes(c)).slice(0, 2);
    const cards = [...set, ...collateral];
    const next = runReducer(s, { type: 'MATCH', cards, rewards: cards.map(c => ({ cardId: c.id, points: 1 })), effects: noFx({ explosiveCards: collateral }) });
    const [blast] = eventsOf(next, 'blast');
    expect(blast.amount).toBeUndefined();
    expect(blast.slots).toEqual(collateral.map(c => s.board.findIndex(b => b.id === c.id)));
    expect(blast.cards).toEqual(collateral);
    // nothing is dealt twice: the foe lost exactly the Set's hit
    expect(s.foeHp - next.foeHp).toBe(eventsOf(next, 'hit')[0].amount);
  });

  it('a blast from a rule names the cards it destroyed and the damage it dealt', () => {
    const s = withWeapons(base(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'explode', area: { shape: 'random', count: 2 } }] }]));
    const set = findSet(s)!;
    const next = runReducer(s, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
    const [blast] = eventsOf(next, 'blast');
    expect(blast.amount).toBeGreaterThan(0);
    expect(blast.slots).toHaveLength(2);
    expect(blast.cards!.map(c => c!.id)).toEqual(blast.slots!.map(i => s.board[i].id));
    // …and the board has already moved on: new cards sit in those slots
    for (const i of blast.slots!) expect(next.board[i].id).not.toBe(s.board[i].id);
  });

  it('marks what happens on the fight clock, and nothing else', () => {
    const idle = withWeapons(base(), relic([{ trigger: { on: 'idle', ms: 1000 }, effects: [{ do: 'damage', amount: 2 }], callout: 'Tick!' }]));
    const ticked = tick(idle, 1500);
    const onClock = ticked.events.filter(e => e.id > idle.eventSeq);
    expect(onClock.length).toBeGreaterThan(0);
    expect(onClock.every(e => e.clock === true)).toBe(true);
    const set = findSet(idle)!;
    const matched = runReducer(idle, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
    expect(matched.events.filter(e => e.id > idle.eventSeq).some(e => e.clock)).toBe(false);
  });

  it('fire, growth, armor and links say which cards', () => {
    const rules = [
      { trigger: { on: 'set' as const }, effects: [{ do: 'ignite' as const, count: 1 }, { do: 'growBoard' as const, count: 1 }, { do: 'armorCard' as const, extraHealth: 1, bounty: 3 }, { do: 'link' as const, count: 1 }] },
    ];
    const s = withWeapons(base(), relic(rules));
    const set = findSet(s)!;
    const next = runReducer(s, { type: 'MATCH', cards: set, rewards: plainRewards(set) });
    expect(eventsOf(next, 'fire')[0].slots).toHaveLength(1);
    expect(eventsOf(next, 'grow')[0].slots).toEqual([s.board.length]);
    expect(eventsOf(next, 'pinata')[0].slots).toHaveLength(1);
    expect(eventsOf(next, 'link')[0].slots).toHaveLength(2);
  });
});

describe('the stage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const Harness: React.FC<{ onFx: (fx: ReturnType<typeof useFightFx>) => void; reduced?: boolean }> = ({ onFx, reduced }) => {
    const anchors = useAnchors();
    const fx = useFightFx({ anchors, reduced });
    onFx(fx);
    return <FxStage fx={fx} anchors={anchors} size={{ w: 375, h: 700 }} />;
  };

  it('holds the clock while a cascade plays, takes the damage off the bar as it lands, then lets go', () => {
    let fx!: ReturnType<typeof useFightFx>;
    const view = render(<Harness onFx={f => (fx = f)} />);
    const script = scriptFor([ev('hit', { amount: 12, slots: [0, 1, 2] }), ev('blast', { amount: 3, text: '1', slots: [4] })], { weapons: WEAPONS });
    act(() => fx.play(script));
    expect(fx.busy).toBe(true);
    expect(fx.pendingDamage).toBe(15);
    // nothing has landed yet: no number, the whole hit still on the bar
    expect(view.queryAllByTestId('floater-tier-1')).toHaveLength(0);
    act(() => {
      jest.advanceTimersByTime(flightFor(FX_TIMING.gridMs) + 5);
    });
    // the Set has landed (its number is up), the blast has not
    expect(fx.pendingDamage).toBe(3);
    expect(view.queryAllByTestId('floater-tier-1')).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(scriptHoldMs(script));
    });
    expect(fx.busy).toBe(false);
    expect(fx.pendingDamage).toBe(0);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(fx.beats).toHaveLength(0);
  });

  it('waits for the band: when its note is late, every landing is as late, and the cards still leave at once', () => {
    let fx!: ReturnType<typeof useFightFx>;
    const Late: React.FC = () => {
      const anchors = useAnchors();
      fx = useFightFx({ anchors, onSegment: () => 40 });
      return <FxStage fx={fx} anchors={anchors} size={{ w: 375, h: 700 }} />;
    };
    const card = { id: 'c1' } as unknown as Card;
    render(<Late />);
    act(() => fx.play(scriptFor([ev('hit', { amount: 12, slots: [0, 1, 2], cards: [card, null, null] })], { weapons: WEAPONS })));
    const flight = flightFor(FX_TIMING.gridMs);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    // the thrown card is already on its way, and flies for the whole (longer) flight, less the frame its start waits for
    expect(fx.ghosts[0]).toMatchObject({ broken: true, how: 'throw', ms: flight + 40 - 16 });
    act(() => {
      jest.advanceTimersByTime(flight + 5);
    });
    expect(fx.pendingDamage).toBe(12);
    act(() => {
      jest.advanceTimersByTime(40);
    });
    expect(fx.pendingDamage).toBe(0);
    expect(fx.beats[0].landed).toBe(true);
  });

  it('with effects off nothing waits and the numbers still show', () => {
    let fx!: ReturnType<typeof useFightFx>;
    const view = render(<Harness onFx={f => (fx = f)} reduced />);
    act(() => fx.play(scriptFor([ev('hit', { amount: 4, slots: [0, 1, 2] })], { weapons: WEAPONS, reduced: true })));
    expect(fx.busy).toBe(false);
    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(view.getAllByTestId('floater-tier-0')).toHaveLength(1);
    expect(fx.pendingDamage).toBe(0);
  });

  it('an evolution holds the clock until its cut-in is dismissed', () => {
    const evo = WEAPON_EVOLUTIONS[0];
    const { result } = renderHook(() => {
      const anchors = useAnchors();
      return useFightFx({ anchors });
    });
    act(() => result.current.play(scriptFor([ev('evolution_start', { text: evo.name })], { weapons: WEAPONS })));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.cutIn?.recipes).toEqual([evo.id]);
    expect(result.current.busy).toBe(true);
    act(() => result.current.dismissCutIn());
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current.cutIn).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('the cut-in names the single-weapon evolution, what it does and closes on a tap after the 220ms guard', () => {
    const evo = WEAPON_EVOLUTIONS[0];
    const onDone = jest.fn();
    const view = render(
      <EvolutionCutIn
        evolutions={[{ evolution: evo, durationSec: 20 }]}
        weapons={[]}
        size={{ w: 375, h: 700 }}
        onDone={onDone}
      />
    );
    expect(view.getByText(evo.name)).toBeTruthy();
    expect(view.getByText(evo.tagline)).toBeTruthy();
    expect(view.getByText('20s ACTIVE')).toBeTruthy();
    fireEvent.press(view.getByTestId('evolution-cutin'));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    fireEvent.press(view.getByTestId('evolution-cutin'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('Wave 4 Lane B VFX, Explosions, Flashes, Shakes & Beams ([FX-03,11,15,16,17,18,19])', () => {
  afterEach(() => {
    ScreenShakeStorage.set(true);
    ScreenFlashStorage.set(true);
    jest.useRealTimers();
  });

  const makeMockAnchors = (rects: Partial<Record<AnchorName, Rect>>): Anchors => {
    const listeners = new Map<string, Set<() => void>>();
    return {
      ref: () => () => {},
      rootRef: () => {},
      rect: name => rects[name] ?? null,
      measure: () => {},
      bump: name => listeners.get(name)?.forEach(fn => fn()),
      onBump: (name, fn) => {
        const s = listeners.get(name) ?? new Set();
        s.add(fn);
        listeners.set(name, s);
        return () => {
          s.delete(fn);
        };
      },
    };
  };

  const sampleCard = (id = 'c1'): Card => ({
    id,
    shape: 'oval',
    color: 'red',
    number: 1,
    shading: 'solid',
    selected: false,
  });

  describe('[FX-03] foe_strike catalog fix & hitKind tagging', () => {
    it('removes shake and foe bump from foe_strike so the attacking foe never self-flinches', () => {
      const row = EVENT_FX.foe_strike!;
      expect(row.shake).toBeUndefined();
      expect(row.bump).toEqual(['hearts']);
      expect(row.bump).not.toContain('foe');
      expect(row.enemy).toBe('attack');
      expect(row.fighter).toBe('pain');
    });

    it('tags attack events with throw/blast/zap hitKind and maps combat shake patterns cleanly', () => {
      expect(hitKindOf('hit')).toBe('throw');
      expect(hitKindOf('rainbow')).toBe('throw');
      expect(hitKindOf('parry')).toBe('throw');
      expect(hitKindOf('blast')).toBe('blast');
      expect(hitKindOf('pinata_break')).toBe('blast');
      expect(hitKindOf('trap_sprung')).toBe('blast');
      expect(hitKindOf('laser')).toBe('zap');
      expect(hitKindOf('ricochet')).toBe('zap');
      expect(hitKindOf('link_burst')).toBe('zap');

      expect(combatShakeKindOf('foe_strike', 0)).toBe('small');
      expect(combatShakeKindOf('blast', 0)).toBe('medium');
      expect(combatShakeKindOf('hit', 3)).toBe('large');
      expect(combatShakeKindOf('perfect_parry', 0)).toBe('large');
      expect(combatShakeKindOf('hit', 0)).toBeNull();
    });

    it('skips Anchor.jump on foe by default ([FX-01]) and honors quiet/reducedMotion ([FX-14])', () => {
      expect(shouldSkipAnchorJump('foe')).toBe(true);
      expect(shouldSkipAnchorJump('foe', { skipFoeJump: false })).toBe(false);
      expect(shouldSkipAnchorJump('coins')).toBe(false);
      expect(shouldSkipAnchorJump('coins', { quiet: true })).toBe(true);
      expect(shouldSkipAnchorJump('coins', { reducedMotion: true })).toBe(true);

      const anchors = makeMockAnchors({});
      const { getByTestId } = render(
        <AnchorsProvider value={anchors} quiet={false}>
          <Anchor name="foe" testID="anchor-foe" />
          <Anchor name="coins" testID="anchor-coins" />
        </AnchorsProvider>
      );
      expect(getByTestId('anchor-foe')).toBeTruthy();
      expect(getByTestId('anchor-coins')).toBeTruthy();
    });
  });

  describe('[FX-11] thrown Ghost physics, pointerEvents & curved SwishRibbon', () => {
    it('exports exaggerated pullback, ±42° bank, 1.18/0.86 velocity stretch & tier hitstop hold', () => {
      expect(THROW_PHYSICS.drawBack).toBe(16);
      expect(THROW_PHYSICS.bankDeg).toBe(42);
      expect(THROW_PHYSICS.stretchPeakY).toBe(1.18);
      expect(THROW_PHYSICS.squashPeakX).toBe(0.86);
      expect(ghostHitstopHoldMs(0, 'hit')).toBe(48);
      expect(ghostHitstopHoldMs(3, 'hit')).toBe(136);
      expect(ghostHitstopHoldMs(3, 'perfect_parry')).toBe(145);
    });

    it('sets pointerEvents="none" on thrown and breaking ghosts while preserving unbroken cover protection', () => {
      const rect: Rect = { x: 20, y: 300, w: 84, h: 112 };
      const card = sampleCard('g1');

      const thrownView = render(
        <Ghost rect={rect} card={card} broken={false} how="throw" color="#F0483E" to={{ x: 260, y: 90 }} order={0} />
      );
      expect(thrownView.getByTestId('fx-ghost').props.pointerEvents).toBe('none');

      const coveringView = render(
        <Ghost rect={rect} card={card} broken={false} how="shatter" color="#FF7A1A" />
      );
      expect(coveringView.getByTestId('fx-ghost').props.pointerEvents).toBe('auto');

      const breakingView = render(
        <Ghost rect={rect} card={card} broken={true} how="shatter" color="#FF7A1A" />
      );
      expect(breakingView.getByTestId('fx-ghost').props.pointerEvents).toBe('none');
    });

    it('renders curved color-matched SwishRibbon behind flying thrown ghosts on FxStage', () => {
      const anchors = makeMockAnchors({
        'slot:0': { x: 24, y: 360, w: 80, h: 100 },
        foe: { x: 250, y: 70, w: 72, h: 72 },
      });
      const fx = {
        play: jest.fn(),
        busy: true,
        pendingDamage: 12,
        beats: [],
        ghosts: [
          {
            key: 'e1:0',
            beat: 'e1',
            slot: 0,
            card: sampleCard('thrown-1'),
            broken: true,
            how: 'throw' as const,
            color: '#9333EA',
            order: 0,
            ms: 240,
          },
        ],
        cutIn: null,
        dismissCutIn: jest.fn(),
        banner: null,
      };
      const view = render(<FxStage fx={fx} anchors={anchors} size={{ w: 375, h: 700 }} />);
      expect(view.getAllByTestId('fx-swish-ribbon')).toHaveLength(1);
      expect(view.getByTestId('fx-ghost').props.pointerEvents).toBe('none');
    });
  });

  describe('[FX-15] edge-spawned contracting Starburst, hollow Ring & asymmetric Ticks', () => {
    it('computes left contact edge spawn and clamps proportional starburst size to [34..128]', () => {
      const foe: Rect = { x: 200, y: 100, w: 80, h: 60 };
      expect(impactEdgeOf(foe)).toEqual({ x: 200 + 80 * 0.16, y: 100 + 60 * 0.46 });
      expect(STARBURST_DEFAULT_MS).toBe(220);

      expect(leadStarburstSize({ x: 0, y: 0, w: 36, h: 36 }, 0)).toBe(34);
      expect(leadStarburstSize({ x: 0, y: 0, w: 80, h: 80 }, 1)).toBe(69);
      expect(leadStarburstSize({ x: 0, y: 0, w: 220, h: 220 }, 3)).toBe(128);
    });

    it('uses deterministic asymmetric ray counts per tier and hollow ink-outlined Ring', () => {
      expect(TICK_RAYS[0]).toHaveLength(5);
      expect(TICK_RAYS[1]).toHaveLength(6);
      expect(TICK_RAYS[2]).toHaveLength(6);
      expect(TICK_RAYS[3]).toHaveLength(7);
      // Verify asymmetry (not uniform 60° hexagon steps)
      const diffs = TICK_RAYS[1].slice(1).map((r, i) => r.deg - TICK_RAYS[1][i].deg);
      expect(new Set(diffs).size).toBeGreaterThan(1);

      const ringView = render(<Ring at={{ x: 100, y: 100 }} size={64} color="#F0483E" width={4} />);
      expect(ringView.getByTestId('fx-ring')).toBeTruthy();
      const circles = ringView.UNSAFE_getAllByType('Circle' as never);
      expect(circles).toHaveLength(2);
      expect(circles[0].props.fill).toBe('none');
      expect(circles[0].props.stroke).toBe('#161412');
      expect(circles[1].props.stroke).toBe('#F0483E');
    });
  });

  describe('[FX-16] 4-stage Explosion primitive capped <= 24 particles', () => {
    it('enforces global particle ceiling <= 24 across any number of blasted slots', () => {
      expect(MAX_EXPLOSION_EMBERS).toBe(24);
      expect(EXPLOSION_TIMING.flashMs).toBe(32);
      expect(EXPLOSION_TIMING.totalMs).toBe(380);
      for (const slots of [1, 2, 3, 4, 5, 6, 9, 12, 18, 30]) {
        let total = 0;
        for (let i = 0; i < slots; i++) {
          const b = explosionSlotBudgets(slots, i);
          total += b.cloudBudget + b.emberBudget;
        }
        expect({ slots, total, ok: total > 0 && total <= 24 }).toEqual({ slots, total, ok: true });
      }
    });

    it('renders all 4 stages (Flash, Fireball, Black Smoke, Embers) and caps 6-card blasts <= 24', () => {
      const slotRect: Rect = { x: 40, y: 200, w: 84, h: 108 };
      const single = render(<Explosion rect={slotRect} color="#FF7A1A" />);
      expect(single.getByTestId('fx-explosion')).toBeTruthy();
      expect(single.getByTestId('fx-explosion-flash')).toBeTruthy();
      expect(single.getByTestId('fx-explosion-fireball')).toBeTruthy();
      expect(single.getAllByTestId('fx-explosion-smoke')).toHaveLength(4);
      expect(single.getAllByTestId('fx-explosion-ember')).toHaveLength(6);

      // 6-card blast on FxStage must render 6 Explosions whose combined smoke + embers <= 24
      const anchors = makeMockAnchors({
        'slot:0': { x: 10, y: 200, w: 80, h: 100 },
        'slot:1': { x: 100, y: 200, w: 80, h: 100 },
        'slot:2': { x: 190, y: 200, w: 80, h: 100 },
        'slot:3': { x: 10, y: 310, w: 80, h: 100 },
        'slot:4': { x: 100, y: 310, w: 80, h: 100 },
        'slot:5': { x: 190, y: 310, w: 80, h: 100 },
        foe: { x: 250, y: 70, w: 72, h: 72 },
      });
      const [blastBeat] = beatsOf([ev('blast', { amount: 18, text: '6', slots: [0, 1, 2, 3, 4, 5] })]);
      const stageView = render(
        <FxStage
          fx={{
            play: jest.fn(),
            busy: true,
            pendingDamage: 18,
            beats: [blastBeat],
            ghosts: [],
            cutIn: null,
            dismissCutIn: jest.fn(),
            banner: null,
          }}
          anchors={anchors}
          size={{ w: 375, h: 700 }}
        />
      );
      expect(stageView.getAllByTestId('fx-explosion')).toHaveLength(6);
      const smokeCount = stageView.getAllByTestId('fx-explosion-smoke').length;
      const emberCount = stageView.getAllByTestId('fx-explosion-ember').length;
      expect(smokeCount + emberCount).toBeLessThanOrEqual(24);
    });
  });

  describe('[FX-17] ChiaroscuroFlash, ScreenFlashStorage & EvolutionBanner exit speed', () => {
    it('persists ScreenFlashStorage in MMKV and gates MegaFlash & EvolutionCutIn flashes', () => {
      expect(CHIAROSCURO_FLASH_MS.totalMs).toBe(112);
      expect(chiaroscuroDistanceScale(375)).toBe(0.78);
      expect(chiaroscuroDistanceScale(480)).toBe(1.0);

      const seen: boolean[] = [];
      const unsub = ScreenFlashStorage.subscribe(v => seen.push(v));
      expect(ScreenFlashStorage.get()).toBe(true);

      const onView = render(<MegaFlash trigger={1} stageW={375} />);
      expect(onView.getByTestId('mega-flash')).toBeTruthy();
      expect(onView.getByTestId('mega-flash-dark')).toBeTruthy();
      expect(onView.getByTestId('mega-flash-bright')).toBeTruthy();

      act(() => ScreenFlashStorage.set(false));
      expect(ScreenFlashStorage.get()).toBe(false);
      expect(seen).toEqual([false]);
      expect(onView.queryByTestId('mega-flash')).toBeNull();

      const disabledDirect = render(<ChiaroscuroFlash trigger={1} enabled={false} />);
      expect(disabledDirect.queryByTestId('chiaroscuro-flash')).toBeNull();

      // EvolutionCutIn respects ScreenFlashStorage
      const evo = WEAPON_EVOLUTIONS[0];
      const cutOff = render(
        <EvolutionCutIn
          evolutions={[{ evolution: evo, durationSec: 18 }]}
          weapons={[]}
          size={{ w: 375, h: 700 }}
          onDone={jest.fn()}
        />
      );
      expect(cutOff.queryByTestId('evolution-cutin-flash')).toBeNull();

      act(() => ScreenFlashStorage.set(true));
      expect(cutOff.getByTestId('evolution-cutin-flash')).toBeTruthy();
      unsub();
    });

    it('makes EvolutionBanner exit faster than enter with zero horizontal slide ([FX-14])', () => {
      expect(EVOLUTION_BANNER_TIMING.exitMs).toBeLessThan(EVOLUTION_BANNER_TIMING.enterMs);
      const banner = render(
        <EvolutionBanner name="Solar Flare" icon="lorc/crystal-shine" text="Blasts burn." seconds={30} seq={1} />
      );
      expect(banner.getByTestId('evolution-banner')).toBeTruthy();
    });
  });

  describe('[FX-18] useCombatShake deterministic pattern-varied shake & ScreenShakeStorage', () => {
    it('differentiates small (vertical-only), medium (X+Y), and large (X+Y+roll) with monotonic ×0.7 decay', () => {
      expect(COMBAT_SHAKE_DECAY).toBe(0.7);
      expect(COMBAT_SHAKE_SPECS.small).toEqual({ ampX: 0, ampY: 3, rollDeg: 0, legs: 4, totalMs: 110 });
      expect(COMBAT_SHAKE_SPECS.medium).toEqual({ ampX: 6, ampY: 4, rollDeg: 0, legs: 5, totalMs: 180 });
      expect(COMBAT_SHAKE_SPECS.large).toEqual({ ampX: 10, ampY: 6, rollDeg: 0.7, legs: 6, totalMs: 260 });

      expect(viewportShakeScale(200)).toBe(0.75);
      expect(viewportShakeScale(375)).toBe(1);
      expect(viewportShakeScale(900)).toBe(1.5);

      const seq = geometricShakeSequence(10, 5, 0.7, -1);
      expect(seq).toEqual([-10, 7, -4.9, 3.43, -2.4, 0]);
      // Determinism: identical across repeated calls and strictly monotonic decay
      expect(geometricShakeSequence(10, 5, 0.7, -1)).toEqual(seq);
      for (let i = 1; i < seq.length; i++) {
        expect(Math.abs(seq[i])).toBeLessThan(Math.abs(seq[i - 1]));
      }

      const smallPlan = buildCombatShakePlan('small', 375, 1);
      expect(smallPlan.xs.every(v => v === 0)).toBe(true);
      expect(smallPlan.rolls.every(v => v === 0)).toBe(true);
      expect(Math.abs(smallPlan.ys[0])).toBe(3);
      expect(smallPlan.durations.reduce((a, b) => a + b, 0)).toBe(110);

      const largePlan = buildCombatShakePlan('large', 375, 1);
      expect(Math.abs(largePlan.xs[0])).toBe(10);
      expect(Math.abs(largePlan.ys[0])).toBe(6);
      expect(Math.abs(largePlan.rolls[0])).toBe(0.7);
      expect(largePlan.durations.reduce((a, b) => a + b, 0)).toBe(260);
    });

    it('persists ScreenShakeStorage and short-circuits useCombatShake when disabled', () => {
      const seen: boolean[] = [];
      const unsub = ScreenShakeStorage.subscribe(v => seen.push(v));
      const { result } = renderHook(() => useCombatShake({ stageW: 375 }));

      let fired = false;
      act(() => {
        fired = result.current.triggerCombatShake('medium', 375);
      });
      expect(fired).toBe(true);

      act(() => ScreenShakeStorage.set(false));
      expect(ScreenShakeStorage.get()).toBe(false);
      expect(seen).toEqual([false]);

      act(() => {
        fired = result.current.triggerCombatShake('large', 375);
      });
      expect(fired).toBe(false);

      ScreenShakeStorage.set(true);
      const { result: reducedHook } = renderHook(() => useCombatShake({ reduced: true }));
      act(() => {
        fired = reducedHook.current.triggerCombatShake('small', 375);
      });
      expect(fired).toBe(false);
      unsub();
    });
  });

  describe('[FX-19] 2-frame snap Beam, 30 Hz flicker & endpoint sparks', () => {
    it('snaps Beam in 24–32 ms with 30 Hz flicker and mounts endpoint Ticks sparks on FxStage', () => {
      expect(BEAM_TIMING.growMs).toBeGreaterThanOrEqual(24);
      expect(BEAM_TIMING.growMs).toBeLessThanOrEqual(32);
      expect(BEAM_TIMING.zapGrowMs).toBeGreaterThan(BEAM_TIMING.growMs);
      expect(BEAM_TIMING.flickerHz).toBe(30);

      const anchors = makeMockAnchors({
        'slot:3': { x: 10, y: 260, w: 80, h: 100 },
        'slot:4': { x: 100, y: 260, w: 80, h: 100 },
        'slot:5': { x: 190, y: 260, w: 80, h: 100 },
        foe: { x: 250, y: 70, w: 72, h: 72 },
      });
      const [laserBeat] = beatsOf([ev('laser', { amount: 12, text: '3', slots: [3, 4, 5] })]);
      const view = render(
        <FxStage
          fx={{
            play: jest.fn(),
            busy: true,
            pendingDamage: 12,
            beats: [laserBeat],
            ghosts: [],
            cutIn: null,
            dismissCutIn: jest.fn(),
            banner: null,
          }}
          anchors={anchors}
          size={{ w: 375, h: 700 }}
        />
      );
      expect(view.getAllByTestId('fx-beam')).toHaveLength(1);
      expect(view.getAllByTestId('fx-beam-spark')).toHaveLength(1);
    });
  });
});
