/**
 * Anchors: named places on the fight screen (the foe, the hearts, a weapon on
 * the belt, a card slot…) that the effects aim at.
 *
 * A HUD part wraps itself in <Anchor name="coins">. The registry measures
 * every anchor against the stage (so the numbers hold on any screen size) and
 * lets the stage make one jump ("bump") when something lands on it.
 *
 * [FX-01] / [FX-14]: `name === 'foe'` skips `Anchor.jump` by default so
 * `EnemyAvatar` is the single transform owner of hitstop squash/recoil, and
 * every anchor respects `useReducedMotion()`, `quiet`, and `fxClock.slow`.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { EASE, MS, SPRING } from '@/utils/motion';
import { fxClock, fxMs } from './clock';
import type { AnchorName, Rect } from './types';

type Node = View | null;
type Measurable = {
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

export interface Anchors {
  /** A stable ref callback for the View at this place */
  ref: (name: AnchorName) => (node: Node) => void;
  /** The stage itself: every rect is measured against it */
  rootRef: (node: Node) => void;
  /** Where the place is right now, in stage coordinates (null until it has been measured) */
  rect: (name: AnchorName) => Rect | null;
  /** Measure everything again soon (cheap: at most once per frame) */
  measure: () => void;
  /** Make the HUD part at this place jump */
  bump: (name: AnchorName) => void;
  /** Hear about bumps of a place; returns the unsubscribe */
  onBump: (name: AnchorName, fn: () => void) => () => void;
}

const windowRect = (node: Measurable, cb: (r: Rect) => void) => {
  if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
    const b = node.getBoundingClientRect();
    cb({ x: b.left, y: b.top, w: b.width, h: b.height });
    return;
  }
  node.measureInWindow?.((x, y, w, h) => {
    if (Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0) cb({ x, y, w, h });
  });
};

export const useAnchors = (): Anchors => {
  const nodes = useRef(new Map<string, Measurable>());
  const rects = useRef(new Map<string, Rect>());
  const refs = useRef(new Map<string, (node: Node) => void>());
  const listeners = useRef(new Map<string, Set<() => void>>());
  const root = useRef<Measurable | null>(null);
  const queued = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (queued.current) clearTimeout(queued.current);
  }, []);

  return useMemo<Anchors>(() => {
    const measureNow = () => {
      queued.current = null;
      const stage = root.current;
      if (!stage) return;
      windowRect(stage, origin => {
        for (const [name, node] of nodes.current) {
          windowRect(node, r => rects.current.set(name, { x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h }));
        }
      });
    };
    const measure = () => {
      if (!queued.current) queued.current = setTimeout(measureNow, 16);
    };
    return {
      ref: name => {
        let fn = refs.current.get(name);
        if (!fn) {
          fn = node => {
            // A card slot remounts whenever its card changes: keep its last rect until the new one is measured
            if (node) nodes.current.set(name, node as unknown as Measurable);
            else nodes.current.delete(name);
            measure();
          };
          refs.current.set(name, fn);
        }
        return fn;
      },
      rootRef: node => {
        root.current = node as unknown as Measurable | null;
        measure();
      },
      rect: name => rects.current.get(name) ?? null,
      measure,
      bump: name => listeners.current.get(name)?.forEach(fn => fn()),
      onBump: (name, fn) => {
        const set = listeners.current.get(name) ?? new Set();
        set.add(fn);
        listeners.current.set(name, set);
        return () => {
          set.delete(fn);
        };
      },
    };
  }, []);
};

interface AnchorsConfig {
  quiet: boolean;
  skipFoeJump: boolean;
}

const DEFAULT_ANCHORS_CONFIG: AnchorsConfig = { quiet: false, skipFoeJump: true };

const AnchorsContext = createContext<Anchors | null>(null);
const AnchorsConfigContext = createContext<AnchorsConfig>(DEFAULT_ANCHORS_CONFIG);

export interface AnchorsProviderProps {
  value: Anchors | null;
  /** Suppresses HUD anchor jump animations when Effects are off ([FX-14]). */
  quiet?: boolean;
  /** Skip `Anchor.jump` on `name === 'foe'` so `EnemyAvatar` owns hitstop ([FX-01]). Defaults true. */
  skipFoeJump?: boolean;
  children?: React.ReactNode;
}

export const AnchorsProvider: React.FC<AnchorsProviderProps> = ({
  value,
  quiet = false,
  skipFoeJump = true,
  children,
}) => {
  const config = useMemo<AnchorsConfig>(() => ({ quiet, skipFoeJump }), [quiet, skipFoeJump]);
  return (
    <AnchorsContext.Provider value={value}>
      <AnchorsConfigContext.Provider value={config}>{children}</AnchorsConfigContext.Provider>
    </AnchorsContext.Provider>
  );
};

export const useAnchorsContext = (): Anchors | null => useContext(AnchorsContext);

/** Run `fn` whenever the place called `name` is bumped. */
export const useBump = (name: AnchorName, fn: () => void) => {
  const anchors = useAnchorsContext();
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => anchors?.onBump(name, () => latest.current()), [anchors, name]);
};

/** Pure predicate for whether an anchor should skip its scale jump ([FX-01]/[FX-14]). */
export const shouldSkipAnchorJump = (
  name: AnchorName,
  opts: { skipFoeJump?: boolean; quiet?: boolean; reducedMotion?: boolean } = {}
): boolean => {
  if (opts.quiet || opts.reducedMotion) return true;
  if (name === 'foe' && opts.skipFoeJump !== false) return true;
  return false;
};

/**
 * A place the effects can aim at. Its children jump when something lands on
 * it. Outside a fight (no provider) it is a plain View.
 */
export const Anchor: React.FC<{
  name: AnchorName;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
  /** Skip scale jump on `name === 'foe'` so EnemyAvatar owns hitstop ([FX-01]). Defaults true. */
  skipFoeJump?: boolean;
  /** Suppress scale jump when Effects are off ([FX-14]). */
  quiet?: boolean;
}> = ({ name, style, children, testID, skipFoeJump, quiet }) => {
  const anchors = useAnchorsContext();
  const config = useContext(AnchorsConfigContext);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const effectiveSkipFoe = skipFoeJump ?? config.skipFoeJump;
  const effectiveQuiet = quiet ?? config.quiet;
  const skip = shouldSkipAnchorJump(name, {
    skipFoeJump: effectiveSkipFoe,
    quiet: effectiveQuiet,
    reducedMotion: Boolean(reducedMotion),
  });

  useEffect(() => {
    if (skip) {
      cancelAnimation(scale);
      scale.value = 1;
    }
    return () => cancelAnimation(scale);
  }, [skip, scale]);

  const jump = useCallback(() => {
    if (skip) return;
    cancelAnimation(scale);
    const settle =
      fxClock.slow > 1
        ? withTiming(1, { duration: fxMs(MS.quick), easing: EASE.enterSoft })
        : withSpring(1, SPRING.lively);
    scale.value = withSequence(
      withTiming(1.28, { duration: fxMs(70), easing: EASE.ui }),
      settle
    );
  }, [skip, scale]);

  useBump(name, jump);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View ref={anchors?.ref(name)} collapsable={false} style={style} testID={testID} onLayout={anchors?.measure}>
      <Animated.View style={st}>{children}</Animated.View>
    </View>
  );
};
