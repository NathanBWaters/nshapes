/**
 * Live in-fight Set-Parry telegraph & Stagger bar.
 *
 * Constant height so the board never shifts when the foe transitions between
 * calm → windup → golden Perfect Parry window → Staggered ×2.
 * [FX-24] Fill glides at 60fps via GPU-composited `transform: [{ scaleX }]`
 * interpolated smoothly over `TICK_MS` (250 ms) with zero layout `width` thrash.
 * [FX-14] All animations are gated on `useAppActive()`, `effects`, and
 * `useReducedMotion()` with `cancelAnimation(...)` cleanup.
 *
 * Lane 3 polish:
 * - Zero text scaling jitter: bar text stays rock-steady at scale 1 with `tabular-nums`,
 *   while an absolute GPU border/rim accent ring pulses cleanly on Perfect/Staggered.
 * - Crisp phase-swap punch (icon spring pop + brief tint flash) across calm → windup → gold → staggered.
 * - `STALL +3s` badge animates in/out cleanly as an anchored pill without shifting bar text.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { useColorblind } from '@/utils/cardColors';
import { formatParryCounterMeta } from '@/utils/cardVisuals';
import { ACCESSIBLE, EASE, MS, SPRING, STAYS, exitMs } from '@/utils/motion';
import type { ParryState } from '../types';
import { isInPerfectWindow } from '../engine/parry';
import { INK } from './ui';

/** Matches AdventureRun's 250 ms simulation tick for seamless 60fps GPU interpolation ([FX-24]) */
const PARRY_TICK_MS = 250;

type VisualPhase = 'calm' | 'windup' | 'perfect' | 'staggered';

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
  const visualPhase: VisualPhase = staggered ? 'staggered' : perfect ? 'perfect' : windup ? 'windup' : 'calm';
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

    if (phaseChanged) {
      cancelAnimation(fillSv);
      // Smoothly ease into the new phase fill before resuming linear countdown glide (avoids 1-frame hard-stop jump)
      const delta = PARRY_TICK_MS / parry.durationMs;
      const nextProgress = windup
        ? Math.min(1, progress + delta)
        : Math.max(0, progress - delta);
      fillSv.value = withSequence(
        withTiming(progress, { duration: MS.feedback, easing: EASE.enter }),
        withTiming(nextProgress, { duration: Math.max(40, PARRY_TICK_MS - MS.feedback), easing: EASE.linear })
      );
      return () => cancelAnimation(fillSv);
    }

    if (Math.abs(fillSv.value - progress) > 0.14) {
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

  // Border/rim accent pulse overlay (GPU opacity only — NEVER scales the bar text!)
  const rimPulse = useSharedValue(0);
  const shouldPulse = active && appActive && effects && !reducedMotion && (perfect || staggered);
  useEffect(() => {
    if (!shouldPulse) {
      cancelAnimation(rimPulse);
      rimPulse.value = perfect || staggered ? 0.45 : 0;
      return;
    }
    rimPulse.value = 0.2;
    rimPulse.value = withRepeat(
      withTiming(1, { duration: MS.move, easing: EASE.drift }),
      -1,
      true
    );
    return () => cancelAnimation(rimPulse);
  }, [shouldPulse, perfect, staggered, rimPulse]);

  const rimStyle = useAnimatedStyle(() => ({
    opacity: rimPulse.value,
  }));

  // Crisp phase-swap punch: icon spring pop + short surface tint flash across calm → windup → gold → staggered
  const prevVisualPhaseRef = useRef<VisualPhase>(visualPhase);
  const iconScale = useSharedValue(1);
  const iconOp = useSharedValue(1);
  const phaseFlash = useSharedValue(0);
  useEffect(() => {
    const changed = prevVisualPhaseRef.current !== visualPhase;
    prevVisualPhaseRef.current = visualPhase;
    if (!changed) return;

    cancelAnimation(iconScale);
    cancelAnimation(iconOp);
    cancelAnimation(phaseFlash);

    if (!effects || reducedMotion) {
      iconScale.value = 1;
      iconOp.value = 1;
      phaseFlash.value = 0.24;
      phaseFlash.value = withTiming(0, { duration: ACCESSIBLE.fadeMs, easing: EASE.exitSoft, ...STAYS });
      return;
    }

    const punchScale = visualPhase === 'perfect' || visualPhase === 'staggered' ? 1.28 : 1.18;
    iconOp.value = 0.4;
    iconOp.value = withTiming(1, { duration: 64, easing: EASE.ui });
    iconScale.value = 0.84;
    iconScale.value = withSequence(
      withTiming(punchScale, { duration: 72, easing: EASE.enter }),
      withSpring(1, SPRING.snappy)
    );
    phaseFlash.value = visualPhase === 'perfect' || visualPhase === 'staggered' ? 0.44 : 0.28;
    phaseFlash.value = withTiming(0, { duration: MS.quick, easing: EASE.exitSoft });

    return () => {
      cancelAnimation(iconScale);
      cancelAnimation(iconOp);
      cancelAnimation(phaseFlash);
    };
  }, [visualPhase, effects, reducedMotion, iconScale, iconOp, phaseFlash]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: iconOp.value,
    transform: [{ scale: iconScale.value }],
  }));
  const flashAnimStyle = useAnimatedStyle(() => ({
    opacity: phaseFlash.value,
  }));

  // Animate STALL +3s badge smoothly without shifting centered bar text
  const showStall = windup && parry.spec.counter.kind !== 'any' && !counterAvailable;
  const stallProg = useSharedValue(showStall ? 1 : 0);
  useEffect(() => {
    cancelAnimation(stallProg);
    if (!effects || reducedMotion) {
      stallProg.value = withTiming(showStall ? 1 : 0, {
        duration: ACCESSIBLE.fadeMs,
        easing: showStall ? EASE.ui : EASE.exitSoft,
        ...STAYS,
      });
      return;
    }
    stallProg.value = withTiming(showStall ? 1 : 0, {
      duration: showStall ? MS.quick : exitMs(MS.quick),
      easing: showStall ? EASE.popSoft : EASE.exitSoft,
    });
    return () => cancelAnimation(stallProg);
  }, [showStall, effects, reducedMotion, stallProg]);

  const stallStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, stallProg.value)),
    transform: [
      { translateX: reducedMotion ? 0 : (1 - Math.min(1, stallProg.value)) * 6 },
      { scale: reducedMotion ? 1 : 0.88 + 0.12 * stallProg.value },
    ],
  }));

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
  const flashColor = staggered ? '#5EEAD4' : perfect ? '#FFF6C2' : windup ? '#FCA5A5' : '#FFFFFF';

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
      <View
        style={[
          st.bar,
          compact && st.barCompact,
          windup && st.barWindup,
          perfect && st.barPerfect,
          staggered && st.barStaggered,
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
        <Animated.View
          pointerEvents="none"
          testID="parry-bar-phase-flash"
          style={[st.phaseFlash, { backgroundColor: flashColor }, flashAnimStyle]}
        />
        {(perfect || staggered) && (
          <Animated.View
            pointerEvents="none"
            testID="parry-bar-pulse-ring"
            style={[
              st.pulseRing,
              perfect ? st.pulseRingPerfect : st.pulseRingStaggered,
              rimStyle,
            ]}
          />
        )}
        <Animated.View style={iconAnimStyle}>
          <Icon name={iconName} size={compact ? 12 : 13} color={iconColor} />
        </Animated.View>
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
        {showStall && (
          <Animated.View pointerEvents="none" testID="parry-stall-badge" style={[st.stallBadge, stallStyle]}>
            <Text style={st.stallText}>{compact ? '+3s' : 'STALL +3s'}</Text>
          </Animated.View>
        )}
      </View>
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
  phaseFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 2,
  },
  pulseRingPerfect: {
    borderColor: '#FFFDF5',
  },
  pulseRingStaggered: {
    borderColor: '#0F766E',
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
    position: 'absolute',
    right: 3,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#B91C1C',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stallText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#B91C1C',
    fontVariant: ['tabular-nums'],
  },
});

export default ParryIntentBar;
