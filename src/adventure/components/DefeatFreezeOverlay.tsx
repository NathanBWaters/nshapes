/**
 * [FX-08] 300 ms Defeat Freeze-Frame + Fatal-Source Chiaroscuro Highlight.
 *
 * Sakurai Ep. #003 ("Pause for Effect!"): Before presenting DefeatOverlay,
 * briefly freeze the battlefield for 300 ms (180 ms under reduced motion /
 * effects off) with a crimson-ink spotlight and target ring locked onto the
 * exact fatal source (exploding bomb slot, sprung trap slot, foe strike,
 * clock timeout, or hearts), then hand off with 0 ms delay straight into
 * Wave 3's `<DefeatOverlay />`.
 *
 * Pure one-shot GPU `transform`/`opacity` animations (`pointerEvents="none"`),
 * zero infinite loops, `cancelAnimation(...)` cleanup, `Balance Era: No`.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Icon, { type IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { EASE, STAYS } from '@/utils/motion';
import type { Anchors, AnchorName } from '../fx';
import { fxMs } from '../fx/clock';
import type { RunState } from '../types';

/** Full defeat freeze-frame hold before 0 ms handoff to DefeatOverlay */
export const DEFEAT_FREEZE_MS = 300;
/** Crisp reduced-motion / effects-off defeat ring hold before 0 ms handoff */
export const DEFEAT_FREEZE_REDUCED_MS = 180;

export interface FatalSourceInfo {
  anchor: AnchorName;
  tag: string;
  icon: IconName;
}

/**
 * Purely derives the fatal anchor & crisp 2-word tag from `run.events` and
 * `run.endReason` (zero `run.ts` edits -> Balance Era: No).
 */
export const resolveFatalSource = (run: RunState): FatalSourceInfo => {
  for (let i = run.events.length - 1; i >= 0; i--) {
    const e = run.events[i];
    if (e.type === 'bomb' && e.slots && e.slots.length > 0) {
      return { anchor: `slot:${e.slots[0]}`, tag: 'BOMB!', icon: 'lorc/time-bomb' };
    }
    if (e.type === 'trap_sprung' && e.slots && e.slots.length > 0) {
      return { anchor: `slot:${e.slots[0]}`, tag: 'TRAPPED!', icon: 'lorc/wolf-trap' };
    }
    if (e.type === 'foe_strike' || e.type === 'inactivity') {
      return { anchor: 'foe', tag: 'FOE STRIKE!', icon: 'lorc/sword-clash' };
    }
    if (e.type === 'hurt') {
      if (e.slots && e.slots.length > 0) {
        const lower = (e.text ?? '').toLowerCase();
        if (lower.includes('bomb')) {
          return { anchor: `slot:${e.slots[0]}`, tag: 'BOMB!', icon: 'lorc/time-bomb' };
        }
        if (lower.includes('trap') || lower.includes('snare')) {
          return { anchor: `slot:${e.slots[0]}`, tag: 'TRAPPED!', icon: 'lorc/wolf-trap' };
        }
        return { anchor: `slot:${e.slots[0]}`, tag: 'FATAL HIT!', icon: 'lorc/broken-heart' };
      }
      return { anchor: 'foe', tag: 'FOE STRIKE!', icon: 'lorc/sword-clash' };
    }
    if (e.type === 'time_up') {
      return { anchor: 'clock', tag: "TIME'S UP!", icon: 'lorc/stopwatch' };
    }
    if (e.type === 'moves_out') {
      return { anchor: 'clock', tag: 'NO MOVES!', icon: 'lorc/archery-target' };
    }
  }

  if (run.timeLeft !== null && run.timeLeft <= 0) {
    return { anchor: 'clock', tag: "TIME'S UP!", icon: 'lorc/stopwatch' };
  }
  if (run.movesLeft !== null && run.movesLeft <= 0) {
    return { anchor: 'clock', tag: 'NO MOVES!', icon: 'lorc/archery-target' };
  }
  return { anchor: 'hearts', tag: 'NO HEARTS!', icon: 'lorc/broken-heart' };
};

interface Props {
  active: boolean;
  fatal: FatalSourceInfo | null;
  anchors: Anchors;
  stageSize: { w: number; h: number };
  enabled: boolean;
  reduced?: boolean;
  /** Fired right when the freeze completes so DefeatOverlay mounts with 0 ms extra delay */
  onComplete?: () => void;
}

const DefeatFreezeOverlay: React.FC<Props> = ({
  active,
  fatal,
  anchors,
  stageSize,
  enabled,
  reduced = false,
  onComplete,
}) => {
  const isQuiet = !enabled || reduced;
  const durationMs = isQuiet ? DEFEAT_FREEZE_REDUCED_MS : DEFEAT_FREEZE_MS;

  const backdropOp = useSharedValue(0);
  const ringScale = useSharedValue(isQuiet ? 1 : 1.35);
  const ringOp = useSharedValue(0);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active || !fatal) {
      cancelAnimation(backdropOp);
      cancelAnimation(ringScale);
      cancelAnimation(ringOp);
      backdropOp.value = 0;
      ringOp.value = 0;
      ringScale.value = isQuiet ? 1 : 1.35;
      return;
    }

    backdropOp.value = withTiming(1, { duration: fxMs(64), easing: EASE.ui, ...STAYS });
    ringOp.value = withTiming(1, { duration: fxMs(48), easing: EASE.ui, ...STAYS });
    if (isQuiet) {
      ringScale.value = 1;
    } else {
      ringScale.value = 1.35;
      ringScale.value = withTiming(1, { duration: fxMs(80), easing: EASE.enter });
    }

    const timer = setTimeout(() => {
      onCompleteRef.current?.();
    }, fxMs(durationMs));

    return () => {
      clearTimeout(timer);
      cancelAnimation(backdropOp);
      cancelAnimation(ringScale);
      cancelAnimation(ringOp);
    };
  }, [active, fatal, isQuiet, durationMs, backdropOp, ringScale, ringOp]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOp.value,
    transform: [{ scale: ringScale.value }],
  }));

  if (!active || !fatal) return null;

  const rect = anchors.rect(fatal.anchor);
  const w = stageSize.w > 0 ? stageSize.w : 375;
  const h = stageSize.h > 0 ? stageSize.h : 720;

  let cx = w * 0.5;
  let cy = h * 0.42;
  let ringSize = 84;
  if (rect) {
    cx = rect.x + rect.w / 2;
    cy = rect.y + rect.h / 2;
    ringSize = Math.max(58, Math.min(132, Math.max(rect.w, rect.h) + 18));
  } else if (fatal.anchor === 'foe') {
    cx = w * 0.78;
    cy = Math.min(130, h * 0.18);
  } else if (fatal.anchor === 'clock') {
    cx = w * 0.25;
    cy = Math.min(165, h * 0.24);
  } else if (fatal.anchor === 'hearts') {
    cx = w * 0.2;
    cy = Math.min(145, h * 0.2);
  }

  const tagTop = cy + ringSize / 2 + 8 > h - 42 ? Math.max(12, cy - ringSize / 2 - 34) : cy + ringSize / 2 + 6;

  return (
    <View testID="defeat-freeze-overlay" pointerEvents="none" style={st.root}>
      {/* Deep crimson-ink chiaroscuro spotlight wash */}
      <Animated.View style={[st.spotlight, backdropStyle]} />

      {/* Crimson + ink fatal-source highlight ring */}
      <Animated.View
        testID="defeat-freeze-ring"
        style={[
          st.ringOuter,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            left: cx - ringSize / 2,
            top: cy - ringSize / 2,
          },
          ringStyle,
        ]}
      >
        <View style={[st.ringInner, { borderRadius: ringSize / 2 }]} />
      </Animated.View>

      {/* Crisp 2-word fatal-source callout tag */}
      <Animated.View
        testID="defeat-freeze-tag"
        style={[
          st.tagWrap,
          { top: tagTop },
          ringStyle,
        ]}
      >
        <View style={st.tagPill}>
          <Icon name={fatal.icon} size={14} color={COLORS.canvasWhite} noShadow />
          <Text style={st.tagText} numberOfLines={1}>
            {fatal.tag}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const st = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 470,
    overflow: 'hidden',
  },
  spotlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 20, 18, 0.52)',
  },
  ringOuter: {
    position: 'absolute',
    borderWidth: 4,
    borderColor: '#161412',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: '100%',
    height: '100%',
    borderWidth: 3.5,
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
  },
  tagWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161412',
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  tagText: {
    flexShrink: 1,
    color: COLORS.canvasWhite,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});

export default DefeatFreezeOverlay;
