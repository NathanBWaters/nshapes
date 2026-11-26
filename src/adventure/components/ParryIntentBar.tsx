/**
 * Live in-fight Set-Parry telegraph & Stagger bar.
 *
 * Constant height so the board never shifts when the foe transitions between
 * calm → windup → golden Perfect Parry window → Staggered ×2.
 * [FX-24] Fill glides at 60fps via GPU-composited `transform: [{ scaleX }]`
 * interpolated smoothly over `TICK_MS` (250 ms) with zero layout `width` thrash.
 * [FX-14] All animations are gated on `useAppActive()`, `effects`, and
 * `useReducedMotion()` with `cancelAnimation(...)` cleanup.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { useColorblind } from '@/utils/cardColors';
import { formatParryCounterMeta } from '@/utils/cardVisuals';
import { EASE } from '@/utils/motion';
import type { ParryState } from '../types';
import { isInPerfectWindow } from '../engine/parry';
import { INK } from './ui';

/** Matches AdventureRun's 250 ms simulation tick for seamless 60fps GPU interpolation ([FX-24]) */
const PARRY_TICK_MS = 250;

interface Props {
  parry: ParryState;
  active: boolean;
  /** True when this foe asks for a specific Counter-Set and one is currently on the board */
  counterAvailable?: boolean;
  /** Compact side-by-side mode when paired with Shading Surge in the shared Dual Threat Rail */
  compact?: boolean;
  /** Adventure's Effects switch: off stops infinite pulse & tick glide cleanly ([FX-14]) */
  effects?: boolean;
  onPress?: () => void;
}

const ParryIntentBar: React.FC<Props> = ({
  parry,
  active,
  counterAvailable = true,
  compact = false,
  effects = true,
  onPress,
}) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const colorblind = useColorblind();
  const meta = formatParryCounterMeta(parry.spec.counter, colorblind);
  const perfect = isInPerfectWindow(parry);
  const staggered = parry.phase === 'staggered';
  const windup = parry.phase === 'windup';
  const secs = Math.max(0.1, parry.msLeft / 1000);
  const secsText = secs < 4 ? `${secs.toFixed(1)}s` : `${Math.ceil(secs)}s`;

  const progress =
    parry.durationMs > 0
      ? windup
        ? Math.max(0, Math.min(1, 1 - parry.msLeft / parry.durationMs))
        : Math.max(0, Math.min(1, parry.msLeft / parry.durationMs))
      : 0;

  const perfectMarkerPct =
    windup && parry.durationMs > 0
      ? Math.max(0, Math.min(96, (1 - parry.spec.perfectWindowMs / parry.durationMs) * 100))
      : null;

  // [FX-24] 60fps GPU scaleX interpolation over TICK_MS (freezes at exact pixel on pause / reducedMotion)
  const fillSv = useSharedValue(progress);
  const prevPhaseRef = useRef(parry.phase);
  const glideActive = active && appActive && effects && !reducedMotion && (windup || staggered) && parry.durationMs > 0;

  useEffect(() => {
    const phaseChanged = prevPhaseRef.current !== parry.phase;
    prevPhaseRef.current = parry.phase;

    if (!glideActive) {
      cancelAnimation(fillSv);
      fillSv.value = progress;
      return;
    }

    if (phaseChanged || Math.abs(fillSv.value - progress) > 0.14) {
      cancelAnimation(fillSv);
      fillSv.value = progress;
    }

    const delta = PARRY_TICK_MS / parry.durationMs;
    const nextProgress = windup
      ? Math.min(1, progress + delta)
      : Math.max(0, progress - delta);
    fillSv.value = withTiming(nextProgress, { duration: PARRY_TICK_MS, easing: EASE.linear });

    return () => cancelAnimation(fillSv);
  }, [progress, parry.phase, parry.durationMs, windup, glideActive, fillSv]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fillSv.value <= 0.001 ? 0 : 1,
    transform: [{ scaleX: Math.max(0.0001, fillSv.value) }],
  }));

  // [FX-14] Gate infinite pulse strictly on active && appActive && effects && !reducedMotion
  const pulse = useSharedValue(1);
  const shouldPulse = active && appActive && effects && !reducedMotion && (perfect || staggered);
  useEffect(() => {
    if (!shouldPulse) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1.035, { duration: 220 }), withTiming(1, { duration: 220 })),
      -1
    );
    return () => cancelAnimation(pulse);
  }, [shouldPulse, pulse]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const fullLabel = staggered
    ? `STAGGERED · ×2 DMG · ${secsText}`
    : perfect
      ? `PERFECT PARRY! ${meta.shortLabel} · ${secsText}`
      : windup
        ? `${parry.spec.attackName.toUpperCase()} · ${meta.shortLabel} · ${secsText}`
        : `Counter: ${meta.shortLabel} · next in ${secsText}`;

  const label = compact
    ? staggered
      ? `STAGGER ×2 · ${secsText}`
      : perfect
        ? `PARRY! ${meta.shortLabel} · ${secsText}`
        : windup
          ? `${meta.shortLabel} · ${secsText}`
          : `${meta.shortLabel} · ${secsText}`
    : fullLabel;

  const iconName = staggered ? 'lorc/shield-reflect' : perfect ? 'lorc/sword-clash' : parry.spec.icon;
  const iconColor = staggered ? '#0F766E' : perfect ? INK : windup ? '#991B1B' : meta.color;

  return (
    <TouchableOpacity
      testID="run-parry-bar"
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={fullLabel}
      style={compact ? st.wrapCompact : st.wrap}
    >
      <Animated.View
        style={[
          st.bar,
          compact && st.barCompact,
          windup && st.barWindup,
          perfect && st.barPerfect,
          staggered && st.barStaggered,
          animStyle,
        ]}
      >
        {(windup || staggered) && (
          <Animated.View
            testID="parry-bar-fill"
            pointerEvents="none"
            style={[
              st.fill,
              windup && st.fillWindup,
              perfect && st.fillPerfect,
              staggered && st.fillStaggered,
              fillStyle,
            ]}
          />
        )}
        {perfectMarkerPct !== null && !perfect && (
          <View pointerEvents="none" style={[st.perfectZone, { left: `${perfectMarkerPct}%` }]} />
        )}
        <Icon name={iconName} size={compact ? 12 : 13} color={iconColor} />
        <Text
          style={[
            st.text,
            compact && st.textCompact,
            windup && !perfect && st.textWindup,
            perfect && st.textPerfect,
            staggered && st.textStaggered,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {windup && parry.spec.counter.kind !== 'any' && !counterAvailable && (
          <View style={st.stallBadge}>
            <Text style={st.stallText}>{compact ? '+3s' : 'STALL +3s'}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const st = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
  },
  wrapCompact: {
    flex: 1.45,
    minWidth: 0,
  },
  bar: {
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#C9C2B8',
    backgroundColor: '#F5F2EC',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  barCompact: {
    paddingHorizontal: 6,
  },
  barWindup: {
    borderColor: '#B91C1C',
    backgroundColor: '#FEE2E2',
  },
  barPerfect: {
    borderColor: INK,
    backgroundColor: COLORS.actionYellow,
  },
  barStaggered: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    transformOrigin: 'left center',
  },
  fillWindup: {
    backgroundColor: '#FCA5A5',
  },
  fillPerfect: {
    backgroundColor: '#F59E0B',
  },
  fillStaggered: {
    backgroundColor: '#5EEAD4',
  },
  perfectZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(255, 222, 0, 0.45)',
    borderLeftWidth: 2,
    borderLeftColor: '#D97706',
  },
  text: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: '800',
    color: '#57534E',
    fontVariant: ['tabular-nums'],
  },
  textCompact: {
    fontSize: 10,
  },
  textWindup: {
    fontWeight: '900',
    color: '#7F1D1D',
  },
  textPerfect: {
    fontWeight: '900',
    color: INK,
    letterSpacing: 0.3,
  },
  textStaggered: {
    fontWeight: '900',
    color: '#115E59',
    letterSpacing: 0.3,
  },
  stallBadge: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#B91C1C',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  stallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#B91C1C',
  },
});

export default ParryIntentBar;
