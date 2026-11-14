/**
 * Plays scripts (fx/script.ts): mounts each beat when its time comes, tells
 * the HUD when it lands, and says whether anything is still playing, which is
 * what stops the fight clock while a cascade runs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '@/types';
import type { Anchors } from './anchors';
import { fxMs } from './clock';
import { scriptDamage } from './script';
import type { Beat, Script, Segment } from './types';
import type { GhostBreak } from './visuals';

/** How long a ghost card takes to break */
const GHOST_MS = 260;
/** An ambient effect of one kind plays at most this often */
const AMBIENT_GAP_MS = 900;
/** How long the small banner stays up when effects are off */
const BANNER_MS = 2700;

export interface LiveGhost {
  key: string;
  beat: string;
  slot: number;
  card: Card;
  broken: boolean;
  how: GhostBreak;
  color: string;
}

export interface FightFxOptions {
  anchors: Anchors;
  /** Effects are off: evolutions show a small banner instead of the cut-in */
  reduced?: boolean;
  /** A stretch of beats starts now (the band plays its sounds) */
  onSegment?: (segment: Extract<Segment, { kind: 'beats' }>) => void;
  /** A beat reached its target: the HUD reacts */
  onLand?: (beat: Beat) => void;
}

export interface FightFx {
  play: (script: Script) => void;
  /** Something is still playing, or a cut-in is waiting for a tap: the fight clock stands still */
  busy: boolean;
  /** Damage of beats that have not landed yet: the HP bar shows it as still there */
  pendingDamage: number;
  beats: Beat[];
  ghosts: LiveGhost[];
  /** Recipe ids of the evolution cut-in on screen; `key` changes with every new one */
  cutIn: { recipes: string[]; key: number } | null;
  dismissCutIn: () => void;
  /** Effects off: recipe ids of the evolution banner on screen */
  banner: { recipes: string[]; key: number } | null;
}

export const useFightFx = (options: FightFxOptions): FightFx => {
  const opts = useRef(options);
  opts.current = options;
  const [beats, setBeats] = useState<Beat[]>([]);
  const [ghosts, setGhosts] = useState<LiveGhost[]>([]);
  const [holds, setHolds] = useState(0);
  const [pendingDamage, setPending] = useState(0);
  const [cutIn, setCutIn] = useState<FightFx['cutIn']>(null);
  const [banner, setBanner] = useState<FightFx['banner']>(null);

  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const dead = useRef(false);
  const seq = useRef(0);
  const cutQueue = useRef<{ recipes: string[]; done: () => void }[]>([]);
  const lastAmbient = useRef(new Map<string, number>());

  useEffect(() => {
    dead.current = false;
    const all = timers.current;
    return () => {
      dead.current = true;
      all.forEach(clearTimeout);
      all.clear();
    };
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      if (!dead.current) fn();
    }, fxMs(ms));
    timers.current.add(t);
  }, []);

  const showNextCutIn = useCallback(() => {
    const next = cutQueue.current[0];
    setCutIn(next ? { recipes: next.recipes, key: ++seq.current } : null);
  }, []);

  const dismissCutIn = useCallback(() => {
    const shown = cutQueue.current.shift();
    shown?.done();
    showNextCutIn();
  }, [showNextCutIn]);

  const land = useCallback((beat: Beat) => {
    const { anchors, onLand } = opts.current;
    if (beat.damage > 0) setPending(p => Math.max(0, p - beat.damage));
    if (!beat.quiet) {
      if (beat.flies && beat.row.to) anchors.bump(beat.row.to);
      beat.row.bump?.forEach(anchors.bump);
    }
    onLand?.(beat);
  }, []);

  const playBeats = useCallback((segment: Extract<Segment, { kind: 'beats' }>) => {
    opts.current.onSegment?.(segment);
    for (const beat of segment.beats) {
      if (beat.row.ambient) {
        // The same warning again within a second: once is enough
        const now = Date.now();
        if (now - (lastAmbient.current.get(beat.event.type) ?? 0) < fxMs(AMBIENT_GAP_MS)) continue;
        lastAmbient.current.set(beat.event.type, now);
      }
      later(() => {
        setBeats(l => [...l, beat]);
        if (beat.source && !beat.quiet) opts.current.anchors.bump(beat.source.anchor);
        if (beat.ghosts.some(Boolean)) {
          setGhosts(g => g.map(x => (x.beat === beat.key ? { ...x, broken: true } : x)));
          later(() => setGhosts(g => g.filter(x => x.beat !== beat.key)), GHOST_MS);
        }
      }, beat.at);
      later(() => land(beat), beat.land);
      later(() => setBeats(l => l.filter(b => b !== beat)), beat.at + beat.life);
    }
  }, [later, land]);

  const play = useCallback((script: Script) => {
    const all = script.segments.flatMap(s => (s.kind === 'beats' ? s.beats : []));
    const damage = scriptDamage(script);
    if (damage > 0) setPending(p => p + damage);

    // The engine has already dealt the next cards: cover them with what was there until each beat arrives
    const covers: LiveGhost[] = [];
    for (const b of all) {
      if (b.quiet) continue;
      b.ghosts.forEach((card, i) => {
        if (card) covers.push({ key: `${b.key}:${b.slots[i]}`, beat: b.key, slot: b.slots[i], card, broken: false, how: b.row.board === 'beam' ? 'vaporise' : 'shatter', color: b.row.color });
      });
    }
    if (covers.length) setGhosts(g => [...g, ...covers]);

    const reduced = !!opts.current.reduced;
    const holdsClock = !reduced && script.segments.some(s => s.kind === 'cutIn' || s.total > 0);
    if (holdsClock) setHolds(h => h + 1);
    opts.current.anchors.measure();

    // Segments play one after another on timers (no promises: a cut-in simply holds the chain until it is dismissed)
    const run = (index: number) => {
      if (dead.current) return;
      const segment = script.segments[index];
      if (!segment) {
        if (holdsClock) setHolds(h => Math.max(0, h - 1));
        return;
      }
      const next = () => run(index + 1);
      if (segment.kind === 'cutIn') {
        if (reduced) {
          const key = ++seq.current;
          setBanner({ recipes: segment.recipes, key });
          later(() => setBanner(b => (b?.key === key ? null : b)), BANNER_MS);
          next();
          return;
        }
        cutQueue.current.push({ recipes: segment.recipes, done: next });
        if (cutQueue.current.length === 1) showNextCutIn();
        return;
      }
      playBeats(segment);
      if (segment.total > 0) later(next, segment.total);
      else next();
    };
    run(0);
  }, [later, playBeats, showNextCutIn]);

  return useMemo(
    () => ({ play, busy: holds > 0, pendingDamage, beats, ghosts, cutIn, dismissCutIn, banner }),
    [play, holds, pendingDamage, beats, ghosts, cutIn, dismissCutIn, banner]
  );
};
