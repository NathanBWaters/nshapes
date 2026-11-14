/**
 * Anchors: named places on the fight screen (the foe, the hearts, a weapon on
 * the belt, a card slot…) that the effects aim at.
 *
 * A HUD part wraps itself in <Anchor name="coins">. The registry measures
 * every anchor against the stage (so the numbers hold on any screen size) and
 * lets the stage make one jump ("bump") when something lands on it.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { AnchorName, Rect } from './types';

type Node = View | null;
type Measurable = { getBoundingClientRect?: () => { left: number; top: number; width: number; height: number }; measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };

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

const AnchorsContext = createContext<Anchors | null>(null);
export const AnchorsProvider = AnchorsContext.Provider;
export const useAnchorsContext = (): Anchors | null => useContext(AnchorsContext);

/** Run `fn` whenever the place called `name` is bumped. */
export const useBump = (name: AnchorName, fn: () => void) => {
  const anchors = useAnchorsContext();
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => anchors?.onBump(name, () => latest.current()), [anchors, name]);
};

/**
 * A place the effects can aim at. Its children jump when something lands on
 * it. Outside a fight (no provider) it is a plain View.
 */
export const Anchor: React.FC<{ name: AnchorName; style?: StyleProp<ViewStyle>; children?: React.ReactNode; testID?: string }> = ({ name, style, children, testID }) => {
  const anchors = useAnchorsContext();
  const scale = useSharedValue(1);
  const jump = useCallback(() => {
    scale.value = withSequence(
      withTiming(1.28, { duration: 70, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 320, mass: 0.6 })
    );
  }, [scale]);
  useBump(name, jump);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View ref={anchors?.ref(name)} collapsable={false} style={style} testID={testID} onLayout={anchors?.measure}>
      <Animated.View style={st}>{children}</Animated.View>
    </View>
  );
};
