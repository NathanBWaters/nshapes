/**
 * The fight's effects (src/adventure/fx). These tests are the guard:
 *
 *  - every kind of fight event has a row in the catalog that shows something
 *    (the type checker already refuses a missing row; this refuses an empty one),
 *  - sound and picture step through a cascade together,
 *  - a cascade never holds the clock for long, and things that repeat on the
 *    clock never hold it at all,
 *  - the engine says WHERE things happened, so they can be drawn there,
 *  - the stage and the evolution cut-in render and let go of the clock.
 */
import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { EVENT_CUE, soundsFor, takesChainSlot } from '@/audio/fightAudio';
import { PASSIVES } from '@/adventure/data/passives';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { runReducer } from '@/adventure/engine/run';
import { EVENT_FX, EvolutionCutIn, FxStage, FX_TIMING, scriptFor, scriptHoldMs, strideFor, useAnchors, useFightFx } from '@/adventure/fx';
import { catalogAnchors, scriptDamage, sourceOfEvent } from '@/adventure/fx/script';
import type { Beat, Segment } from '@/adventure/fx/types';
import type { RunEvent, RunEventType } from '@/adventure/types';
import type { Card } from '@/types';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { eventsOf, findSet, plainRewards, relic, startFight, tick, withWeapons } from './testUtils/adventureFight';

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
  it('has a row for every event type the band has a cue for, and the other way round', () => {
    expect(TYPES.sort()).toEqual((Object.keys(EVENT_CUE) as RunEventType[]).sort());
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
      const coins = seg.beats.find(b => b.event.type === 'coins' && b.event !== events[1])!;
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

  it('says who did it: the rule behind the event, or the held weapon that owns that kind of event', () => {
    const ctx = { weapons: WEAPONS };
    expect(sourceOfEvent(ev('heal', { source: 'w1:mending-charm#0' }), ctx)).toEqual({ ref: 'weapon:mending-charm', name: 'Mending Charm', anchor: 'weapon:mending-charm' });
    expect(sourceOfEvent(ev('blast'), ctx)?.anchor).toBe('weapon:blast-powder');
    const recipe = EVOLUTION_RECIPES[0];
    expect(sourceOfEvent(ev('laser', { source: `evo:${recipe.id}#1` }), ctx)).toEqual({ ref: `evo:${recipe.id}`, name: recipe.name, anchor: `evo:${recipe.id}` });
    expect(sourceOfEvent(ev('hit', { source: 'node:some-node#0' }), ctx)?.anchor).toBe('fighter');
    expect(sourceOfEvent(ev('laser'), ctx)).toBeNull();
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

  it('things that repeat on the clock play but never hold it', () => {
    for (const type of TYPES.filter(t => EVENT_FX[t]?.ambient)) {
      expect({ type, hold: scriptHoldMs(scriptFor([ev(type, { amount: 1, slots: [0] })], { weapons: WEAPONS })) }).toEqual({ type, hold: 0 });
    }
    expect(TYPES.filter(t => EVENT_FX[t]?.ambient).sort()).toEqual(['countdown', 'keen_eye', 'regen']);
  });

  it('only the player\'s own moves hold the clock: what the clock causes plays while it runs', () => {
    const foeMove = [ev('shuffle', { clock: true }), ev('card_removed', { clock: true, slots: [3] })];
    expect(scriptHoldMs(scriptFor(foeMove, { weapons: WEAPONS }))).toBe(0);
    // …but it is still drawn in full
    expect(beatsOf(foeMove).every(b => !b.quiet)).toBe(true);
    expect(scriptHoldMs(scriptFor([ev('shuffle')], { weapons: WEAPONS }))).toBeGreaterThan(0);
  });

  it('an evolution splits the script: what led to it, the cut-in, then the rest', () => {
    const recipe = EVOLUTION_RECIPES[0];
    const script = scriptFor(
      [ev('hit', { amount: 5, slots: [0, 1, 2] }), ev('evolution_start', { text: recipe.name, slots: [1] }), ev('hit', { amount: 10, text: recipe.name })],
      { weapons: WEAPONS }
    );
    expect(script.segments.map(s => s.kind)).toEqual(['beats', 'cutIn', 'beats']);
    expect(script.segments[1]).toEqual({ kind: 'cutIn', recipes: [recipe.id] });
    // the Catalyst card erupts before the cut
    expect((script.segments[0] as Extract<Segment, { kind: 'beats' }>).beats.map(b => b.event.type)).toEqual(['hit', 'evolution_start']);
  });

  it('two evolutions at once share one cut-in', () => {
    const [a, b] = EVOLUTION_RECIPES;
    const script = scriptFor([ev('evolution_start', { text: a.name }), ev('evolution_start', { text: b.name })], { weapons: WEAPONS });
    expect(script.segments.filter(s => s.kind === 'cutIn')).toEqual([{ kind: 'cutIn', recipes: [a.id, b.id] }]);
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
    act(() => {
      jest.advanceTimersByTime(FX_TIMING.flightMs + 5);
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
    const recipe = EVOLUTION_RECIPES[0];
    const { result } = renderHook(() => {
      const anchors = useAnchors();
      return useFightFx({ anchors });
    });
    act(() => result.current.play(scriptFor([ev('evolution_start', { text: recipe.name })], { weapons: WEAPONS })));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.cutIn?.recipes).toEqual([recipe.id]);
    expect(result.current.busy).toBe(true);
    act(() => result.current.dismissCutIn());
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current.cutIn).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('the cut-in names the evolution, what it does and what fused, and closes on a tap (not on the tap that made the Set)', () => {
    const recipe = EVOLUTION_RECIPES[0];
    const onDone = jest.fn();
    const view = render(<EvolutionCutIn recipes={[recipe]} weapons={[]} seconds={30} size={{ w: 375, h: 700 }} onDone={onDone} />);
    expect(view.getByText(recipe.name)).toBeTruthy();
    expect(view.getByText(recipe.activeText)).toBeTruthy();
    expect(view.getByText('30 seconds')).toBeTruthy();
    fireEvent.press(view.getByTestId('evolution-cutin'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.press(view.getByTestId('evolution-cutin'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
