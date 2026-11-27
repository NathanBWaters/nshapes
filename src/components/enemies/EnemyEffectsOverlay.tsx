import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  type EasingFunction,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  BURST_ARC_PRESETS,
  BurstArcSpec,
  sampleBurstParticle,
  useEffectsDriver,
} from '@/components/creatures/useEffectsDriver';
import { STROKE, StarBurst } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import {
  ACCESSIBLE,
  CREATURE_FX,
  EASE,
  ENEMY_ATTACK,
  HIT,
  HitKind,
  MS,
  OVERLAP,
  STAYS,
} from '@/utils/motion';
import {
  EnemyAmbientMood,
  EnemyPersonalityProfile,
  EnemyReactionType,
} from '@/utils/enemyAnimations';

interface EnemyEffectsOverlayProps {
  activeReaction: EnemyReactionType | null;
  reactionId?: number;
  mood: EnemyAmbientMood;
  personality: EnemyPersonalityProfile;
  animate?: boolean;
  /** Bursts show still (the Effects switch is off); ambient life still runs */
  stillBurst?: boolean;
  /** Suppress built-in pain/crit impact stars when FxStage renders edge hit sparks (`[FX-15]`) */
  hideImpactStars?: boolean;
  /** Optional damage-pose variant so `'zap'` renders a crisp electric rim highlight (`[FX-12]`) */
  hitKind?: HitKind;
  /** Strike launch offset (ms) so `attack` slash arcs fire on the exact lunge frame (zero premature VFX) */
  attackStrikeDelayMs?: number;
  /** Stomp landing offset (ms) so `entrance` dust ring fires on ground impact */
  entranceLandingDelayMs?: number;
}

/** Impact stars of a hit: one frame on progress */
const STAR_FRAME = HIT.snapMs / HIT.starsMs;

const PAIN_SPECS: readonly [BurstArcSpec, BurstArcSpec, BurstArcSpec] = [
  { spreadX: 12, bowX: 3, liftY: 14, gravityY: 4, spinDeg: 26 },
  { spreadX: -14, bowX: -3, liftY: 12, gravityY: 5, spinDeg: -28 },
  { spreadX: 7, bowX: 2, liftY: 17, gravityY: 6, spinDeg: 16 },
] as const;

const SLASH_SPECS: readonly [BurstArcSpec, BurstArcSpec, BurstArcSpec] = [
  { spreadX: -8, bowX: -3, liftY: 5, gravityY: 3, spinDeg: -10 },
  { spreadX: -10, bowX: -2, liftY: 8, gravityY: 5, spinDeg: -14 },
  { spreadX: -7, bowX: -2, liftY: 4, gravityY: 6, spinDeg: -8 },
] as const;

const REGEN_SPECS: readonly [BurstArcSpec, BurstArcSpec, BurstArcSpec] = [
  { spreadX: -8, bowX: -4, liftY: 20, gravityY: -8, spinDeg: -10 },
  { spreadX: 9, bowX: 4, liftY: 24, gravityY: -10, spinDeg: 12 },
  { spreadX: 2, bowX: -3, liftY: 16, gravityY: -6, spinDeg: 6 },
] as const;

const ENTRANCE_SPECS: readonly [BurstArcSpec, BurstArcSpec, BurstArcSpec] = [
  { spreadX: -15, bowX: -3, liftY: 12, gravityY: 7, spinDeg: -20 },
  { spreadX: 15, bowX: 3, liftY: 12, gravityY: 7, spinDeg: 20 },
  { spreadX: -5, bowX: 2, liftY: 15, gravityY: 8, spinDeg: -12 },
] as const;

function AngerVein({ cx, cy, scale = 1 }: { cx: number; cy: number; scale?: number }) {
  return (
    <G transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <Path
        d="M -6 -2 Q -2 -2 -2 -6 M 2 -6 Q 2 -2 6 -2 M 6 2 Q 2 2 2 6 M -2 6 Q -2 2 -6 2"
        stroke={COLORS.impactRed}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

/**
 * Renders phase-continuous enemy ambient menace/sleepy/cornered effects (exact integer
 * harmonics — zero wrap seam!), staggered multi-particle parabolic combat bursts eased
 * with `EASE.enter` and synced to the exact strike/impact frame, and reduced-motion-safe
 * `STAYS` fade-in/out exits (zero `POP-OUT`).
 */
export const EnemyEffectsOverlay: React.FC<EnemyEffectsOverlayProps> = ({
  activeReaction,
  reactionId = 0,
  mood,
  personality,
  animate = true,
  stillBurst = false,
  hideImpactStars = false,
  hitKind = 'throw',
  attackStrikeDelayMs = ENEMY_ATTACK.windMs + ENEMY_ATTACK.coilHoldMs,
  entranceLandingDelayMs = CREATURE_FX.entranceDropMs,
}) => {
  const reducedMotion = Boolean(useReducedMotion());
  const isStillMode = !animate || stillBurst || reducedMotion;
  const showAmbient = !activeReaction;
  const impact = activeReaction === 'pain' || activeReaction === 'crit_pain';
  const suppressImpactBurst = hideImpactStars && impact;
  const effectiveBurstReaction = suppressImpactBurst ? null : activeReaction;

  // Mount-until-exited state so reduced-motion / still bursts fade out via ACCESSIBLE.fadeMs (zero POP-OUT!)
  const [renderedReaction, setRenderedReaction] = useState<EnemyReactionType | null>(
    effectiveBurstReaction
  );
  const renderedReactionRef = useRef<EnemyReactionType | null>(effectiveBurstReaction);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedBurstOpacity = useSharedValue(effectiveBurstReaction ? 1 : 0);

  useEffect(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (effectiveBurstReaction) {
      renderedReactionRef.current = effectiveBurstReaction;
      setRenderedReaction(effectiveBurstReaction);
      if (isStillMode) {
        reducedBurstOpacity.value = 0;
        reducedBurstOpacity.value = withTiming(1, {
          duration: ACCESSIBLE.fadeMs,
          easing: EASE.ui,
          ...STAYS,
        });
      } else {
        reducedBurstOpacity.value = 1;
      }
      return;
    }

    if (isStillMode && renderedReactionRef.current) {
      reducedBurstOpacity.value = withTiming(0, {
        duration: ACCESSIBLE.fadeMs,
        easing: EASE.exitSoft,
        ...STAYS,
      });
      exitTimerRef.current = setTimeout(() => {
        renderedReactionRef.current = null;
        setRenderedReaction(null);
        exitTimerRef.current = null;
      }, ACCESSIBLE.fadeMs);
    } else {
      renderedReactionRef.current = null;
      setRenderedReaction(null);
      reducedBurstOpacity.value = 0;
    }

    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [effectiveBurstReaction, reactionId, isStillMode, reducedBurstOpacity]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      cancelAnimation(reducedBurstOpacity);
    };
  }, [reducedBurstOpacity]);

  const startOffsetMs =
    effectiveBurstReaction === 'attack'
      ? attackStrikeDelayMs
      : effectiveBurstReaction === 'entrance'
        ? entranceLandingDelayMs
        : 0;

  const burstDurationMs = impact
    ? HIT.starsMs
    : effectiveBurstReaction === 'attack'
      ? Math.max(CREATURE_FX.enemyBurstMs, attackStrikeDelayMs + MS.move + MS.feedback)
      : CREATURE_FX.enemyBurstMs;

  const {
    burstProgress,
    particleProgresses: [p0, p1, p2, p3],
    ambientPhase,
    presences: [sleepyPresence, enragedPresence, corneredPresence],
  } = useEffectsDriver({
    animate,
    initialAmbientHz: 0.7,
    ambientHz: mood === 'enraged' ? 1.65 : mood === 'sleepy' ? 0.42 : 0.95,
    presenceTargets: [
      showAmbient && mood === 'sleepy' ? 1 : 0,
      showAmbient && (mood === 'enraged' || mood === 'victory') ? 1 : 0,
      showAmbient && mood === 'cornered' ? 1 : 0,
    ],
    fadeMs: CREATURE_FX.ambientFadeMs,
    activeReaction: effectiveBurstReaction,
    reactionId,
    burstMs: burstDurationMs,
    // Fast explosive launch + smooth air-drag deceleration across all bursts (eliminates LINEAR & HARD-STOP hints)
    burstEasing: EASE.enter as unknown as EasingFunction,
    staticBurstProgress: impact ? 0.3 : 0.5,
    stillBurst: isStillMode,
    rehitFrom: impact ? STAR_FRAME : undefined,
    particleStaggerMs: impact ? OVERLAP.primaryMs : Math.round(OVERLAP.secondaryMs * 0.65),
    particleStartOffsetMs: startOffsetMs,
  });

  const displayReaction = isStillMode ? renderedReaction : effectiveBurstReaction;
  const displayImpact = displayReaction === 'pain' || displayReaction === 'crit_pain';

  const burstWrapperStyle = useAnimatedStyle(() => ({
    opacity: isStillMode ? reducedBurstOpacity.value : 1,
  }));

  // Ring / primary rim anchor layer (smooth cubic ease-out, zero linear ramp or hard stop)
  const ringStyle = useAnimatedStyle(() => {
    if (isStillMode) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }
    const p = p0.value;
    const inv = 1 - p;
    const easeOutCubic = 1 - inv * inv * inv;
    if (displayImpact) {
      return {
        opacity: interpolate(p, [0, STAR_FRAME * 0.5, 0.58, 1], [0, 1, 0.92, 0], 'clamp'),
        transform: [{ scale: 0.84 + easeOutCubic * 0.34 }],
      };
    }
    return {
      opacity: interpolate(p, [0, 0.14, 0.68, 1], [0, 0.96, 0.85, 0], 'clamp'),
      transform: [{ scale: 0.72 + easeOutCubic * 0.44 }],
    };
  });

  // Staggered independent parabolic arc particles (4 distinct GPU-only transforms, static under reduced motion)
  const particle0Style = useAnimatedStyle(() => {
    if (isStillMode) {
      return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] };
    }
    const spec =
      displayReaction === 'attack' || displayReaction === 'rage_spin'
        ? SLASH_SPECS[0]
        : displayReaction === 'regen'
          ? REGEN_SPECS[0]
          : displayReaction === 'entrance'
            ? ENTRANCE_SPECS[0]
            : displayReaction === 'pain'
              ? PAIN_SPECS[0]
              : BURST_ARC_PRESETS[0];
    const s = sampleBurstParticle(p0.value, spec);
    return {
      opacity: s.opacity,
      transform: [
        { translateX: s.tx },
        { translateY: s.ty },
        { rotate: `${s.rotDeg}deg` },
        { scale: s.scale },
      ],
    };
  });

  const particle1Style = useAnimatedStyle(() => {
    if (isStillMode) {
      return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] };
    }
    const spec =
      displayReaction === 'attack' || displayReaction === 'rage_spin'
        ? SLASH_SPECS[1]
        : displayReaction === 'regen'
          ? REGEN_SPECS[1]
          : displayReaction === 'entrance'
            ? ENTRANCE_SPECS[1]
            : displayReaction === 'pain'
              ? PAIN_SPECS[1]
              : BURST_ARC_PRESETS[2];
    const s = sampleBurstParticle(p1.value, spec);
    return {
      opacity: s.opacity,
      transform: [
        { translateX: s.tx },
        { translateY: s.ty },
        { rotate: `${s.rotDeg}deg` },
        { scale: s.scale },
      ],
    };
  });

  const particle2Style = useAnimatedStyle(() => {
    if (isStillMode) {
      return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] };
    }
    const spec =
      displayReaction === 'attack' || displayReaction === 'rage_spin'
        ? SLASH_SPECS[2]
        : displayReaction === 'regen'
          ? REGEN_SPECS[2]
          : displayReaction === 'entrance'
            ? ENTRANCE_SPECS[2]
            : displayReaction === 'pain'
              ? PAIN_SPECS[2]
              : BURST_ARC_PRESETS[4];
    const s = sampleBurstParticle(p2.value, spec);
    return {
      opacity: s.opacity,
      transform: [
        { translateX: s.tx },
        { translateY: s.ty },
        { rotate: `${s.rotDeg}deg` },
        { scale: s.scale },
      ],
    };
  });

  const particle3Style = useAnimatedStyle(() => {
    if (isStillMode) {
      return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] };
    }
    const s = sampleBurstParticle(p3.value, BURST_ARC_PRESETS[3]);
    return {
      opacity: s.opacity,
      transform: [
        { translateX: s.tx },
        { translateY: s.ty },
        { rotate: `${s.rotDeg}deg` },
        { scale: s.scale },
      ],
    };
  });

  // Fallback pulse style for single-emblem bursts (poke)
  const pokeStyle = useAnimatedStyle(() => {
    if (isStillMode) {
      return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    }
    const p = burstProgress.value;
    const inv = 1 - p;
    const easeOut = 1 - inv * inv * inv;
    return {
      opacity: interpolate(p, [0, 0.12, 0.72, 1], [0, 1, 0.92, 0], 'clamp'),
      transform: [{ translateY: 2 - easeOut * 11 }, { scale: 0.65 + Math.sin(Math.min(1, p * 1.4) * Math.PI * 0.65) * 0.48 }],
    };
  });

  const sleepyStyle = useAnimatedStyle(() => {
    // Integer-harmonic rising drift + soft fade (zero wrap seam!)
    const t = ambientPhase.value / (Math.PI * 2);
    const lift = -9 * t;
    const sway = Math.sin(ambientPhase.value) * 2.2;
    const env = Math.sin(Math.PI * t);
    return {
      opacity: sleepyPresence.value * (0.28 + 0.68 * env),
      transform: [{ translateX: sway }, { translateY: lift }],
    };
  });

  const enragedStyle = useAnimatedStyle(() => {
    const s = Math.sin(ambientPhase.value * 2);
    return {
      opacity: enragedPresence.value * (0.65 + 0.35 * ((s + 1) * 0.5)),
      transform: [{ scale: 0.95 + 0.12 * ((s + 1) * 0.5) }],
    };
  });

  const corneredStyle = useAnimatedStyle(() => {
    // Exact integer harmonic `2` prevents the 2π wrap seam tick previously caused by `2.2`
    const s = Math.sin(ambientPhase.value * 2);
    return {
      opacity: corneredPresence.value * 0.85,
      transform: [{ translateX: s * 1.4 }],
    };
  });

  const renderZapRim = () => (
    <G testID="enemy-fx-zap-rim">
      <Circle cx={50} cy={50} r={45} fill="none" stroke={STROKE} strokeWidth={4.2} strokeDasharray="8 5" />
      <Circle cx={50} cy={50} r={45} fill="none" stroke={COLORS.logicTeal} strokeWidth={2.2} strokeDasharray="8 5" />
      <Path
        d="M 16 20 L 24 27 L 19 30 L 27 38"
        stroke={COLORS.actionYellow}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M 84 22 L 76 29 L 81 32 L 73 40"
        stroke={COLORS.logicTeal}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  );

  const renderStaggeredBurst = () => {
    if (!displayReaction) return null;

    switch (displayReaction) {
      case 'pain':
        return (
          <Animated.View style={[StyleSheet.absoluteFill, burstWrapperStyle]} testID="enemy-fx-pain">
            {hitKind === 'zap' && (
              <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100">
                  {renderZapRim()}
                </Svg>
              </Animated.View>
            )}
            <Animated.View style={[StyleSheet.absoluteFill, particle0Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <StarBurst cx={74} cy={24} outer={10} inner={4.4} tips={8} fill={COLORS.actionYellow} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle1Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <StarBurst cx={24} cy={30} outer={7.2} inner={3.2} tips={8} fill={COLORS.impactOrange} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle2Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Line x1={14} y1={20} x2={24} y2={26} stroke={COLORS.impactRed} strokeWidth={2.8} strokeLinecap="round" />
                <Line x1={86} y1={16} x2={76} y2={22} stroke={COLORS.impactRed} strokeWidth={2.8} strokeLinecap="round" />
              </Svg>
            </Animated.View>
          </Animated.View>
        );

      case 'crit_pain':
        return (
          <Animated.View style={[StyleSheet.absoluteFill, burstWrapperStyle]} testID="enemy-fx-crit_pain">
            <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                {hitKind === 'zap' && renderZapRim()}
                <Circle
                  cx={50}
                  cy={50}
                  r={43}
                  fill="none"
                  stroke={STROKE}
                  strokeWidth={4.4}
                  strokeDasharray="7 5"
                />
                <Circle
                  cx={50}
                  cy={50}
                  r={43}
                  fill="none"
                  stroke="#9333EA"
                  strokeWidth={2.4}
                  strokeDasharray="7 5"
                />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle0Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <StarBurst cx={76} cy={22} outer={12} inner={5.2} tips={8} fill={COLORS.actionYellow} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle1Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <StarBurst cx={22} cy={24} outer={9} inner={4.0} tips={8} fill="#EC4899" />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle2Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <StarBurst cx={80} cy={68} outer={8} inner={3.5} tips={8} fill={COLORS.logicTeal} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle3Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <StarBurst cx={22} cy={68} outer={6.5} inner={2.9} tips={5} fill={COLORS.impactOrange} />
              </Svg>
            </Animated.View>
          </Animated.View>
        );

      case 'taunt':
        return (
          <Animated.View style={[StyleSheet.absoluteFill, burstWrapperStyle]} testID="enemy-fx-taunt">
            <Animated.View style={[StyleSheet.absoluteFill, particle0Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Path
                  d="M 16 18 L 23 25 L 18 27 L 25 34"
                  stroke={personality.auraColor}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle1Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <SvgText
                  x={68}
                  y={22}
                  fontSize={12}
                  fontWeight="900"
                  fill={COLORS.impactRed}
                  stroke={STROKE}
                  strokeWidth={0.5}
                >
                  HA!
                </SvgText>
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle2Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Path
                  d="M 84 18 L 77 25 L 82 27 L 75 34"
                  stroke={COLORS.actionYellow}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
          </Animated.View>
        );

      case 'attack':
      case 'rage_spin':
        return (
          <Animated.View
            style={[StyleSheet.absoluteFill, burstWrapperStyle]}
            testID={`enemy-fx-${displayReaction}`}
          >
            {/* Forward-left storybook strike arcs anchored cleanly IN FRONT OF the lunged snout/claw (Staging #3) */}
            <Animated.View style={[StyleSheet.absoluteFill, particle0Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100" style={styles.overflowVisible}>
                <Path
                  d="M 16 16 C 3 32, 1 54, 13 78"
                  stroke={STROKE}
                  strokeWidth={5.2}
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 16 16 C 3 32, 1 54, 13 78"
                  stroke={COLORS.impactRed}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle1Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100" style={styles.overflowVisible}>
                <Path
                  d="M 9 22 C -1 38, -2 58, 9 82"
                  stroke={STROKE}
                  strokeWidth={4.4}
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d="M 9 22 C -1 38, -2 58, 9 82"
                  stroke={COLORS.impactOrange}
                  strokeWidth={2.3}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle2Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100" style={styles.overflowVisible}>
                <StarBurst cx={9} cy={22} outer={7.2} inner={3.1} tips={5} fill={COLORS.actionYellow} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle3Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100" style={styles.overflowVisible}>
                <StarBurst cx={84} cy={74} outer={6.2} inner={2.7} tips={5} fill={personality.auraColor} />
              </Svg>
            </Animated.View>
          </Animated.View>
        );

      case 'regen':
        return (
          <Animated.View style={[StyleSheet.absoluteFill, burstWrapperStyle]} testID="enemy-fx-regen">
            <Animated.View style={[StyleSheet.absoluteFill, particle0Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <G transform="translate(22, 34)">
                  <Path
                    d="M -2 -6 H 2 V -2 H 6 V 2 H 2 V 6 H -2 V 2 H -6 V -2 H -2 Z"
                    fill={COLORS.logicTeal}
                    stroke={STROKE}
                    strokeWidth={1.5}
                  />
                </G>
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle1Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <G transform="translate(78, 30) scale(0.92)">
                  <Path
                    d="M -2 -6 H 2 V -2 H 6 V 2 H 2 V 6 H -2 V 2 H -6 V -2 H -2 Z"
                    fill={COLORS.logicTeal}
                    stroke={STROKE}
                    strokeWidth={1.5}
                  />
                </G>
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle2Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <G transform="translate(72, 48) scale(0.76)">
                  <Path
                    d="M -2 -6 H 2 V -2 H 6 V 2 H 2 V 6 H -2 V 2 H -6 V -2 H -2 Z"
                    fill="#99F6E4"
                    stroke={STROKE}
                    strokeWidth={1.5}
                  />
                </G>
              </Svg>
            </Animated.View>
          </Animated.View>
        );

      case 'poke':
        return (
          <Animated.View style={[StyleSheet.absoluteFill, burstWrapperStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, pokeStyle]} testID="enemy-fx-poke">
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <AngerVein cx={78} cy={20} scale={1.15} />
              </Svg>
            </Animated.View>
          </Animated.View>
        );

      case 'entrance':
        return (
          <Animated.View style={[StyleSheet.absoluteFill, burstWrapperStyle]} testID="enemy-fx-entrance">
            <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                {/* Grounded open-center stomp shockwave ring */}
                <Path
                  d="M 12 84 Q 50 94 88 84"
                  fill="none"
                  stroke={STROKE}
                  strokeWidth={4.2}
                  strokeLinecap="round"
                />
                <Path
                  d="M 12 84 Q 50 94 88 84"
                  fill="none"
                  stroke={personality.auraColor}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle0Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Circle cx={22} cy={82} r={5} fill="#E7E5E4" stroke={STROKE} strokeWidth={1.8} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle1Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <Circle cx={78} cy={82} r={5} fill="#E7E5E4" stroke={STROKE} strokeWidth={1.8} />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, particle2Style]}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100">
                <StarBurst cx={50} cy={86} outer={6.5} inner={2.8} tips={5} fill={COLORS.actionYellow} />
              </Svg>
            </Animated.View>
          </Animated.View>
        );
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, sleepyStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G testID={mood === 'sleepy' ? 'enemy-ambient-sleepy' : undefined}>
            <SvgText x={73} y={28} fontSize={10} fontWeight="900" fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={0.5}>
              z
            </SvgText>
            <SvgText x={80} y={19} fontSize={13} fontWeight="900" fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={0.6}>
              Z
            </SvgText>
          </G>
        </Svg>
      </Animated.View>

      {/* Cross-fading Enraged Menace Aura */}
      <Animated.View style={[StyleSheet.absoluteFill, enragedStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G testID={mood === 'enraged' ? 'enemy-ambient-enraged' : undefined}>
            <AngerVein cx={80} cy={18} scale={0.95} />
            <Path d="M 14 68 Q 10 56 17 48" stroke={personality.auraColor} strokeWidth={2.4} strokeLinecap="round" fill="none" />
            <Path d="M 86 68 Q 90 56 83 48" stroke={personality.auraColor} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          </G>
        </Svg>
      </Animated.View>

      {/* Cross-fading Cornered Panic Drops (exact integer harmonic — zero seam!) */}
      <Animated.View style={[StyleSheet.absoluteFill, corneredStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G testID={mood === 'cornered' ? 'enemy-ambient-cornered' : undefined}>
            <Path
              d="M 16 24 C 14 29, 14 33, 16.5 33 C 19 33, 19 29, 16 24 Z"
              fill="#38BDF8"
              stroke={STROKE}
              strokeWidth={1.5}
            />
          </G>
        </Svg>
      </Animated.View>

      {/* Staggered Multi-Particle Combat Reaction Bursts */}
      {renderStaggeredBurst()}
    </View>
  );
};

const styles = StyleSheet.create({
  overflowVisible: {
    overflow: 'visible',
  },
});
