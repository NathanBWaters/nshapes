import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import {
  BurstArcSpec,
  sampleBurstParticle,
  useEffectsDriver,
} from '@/components/creatures/useEffectsDriver';
import { STROKE, Sparkle4 } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { ACCESSIBLE, CHEER, CREATURE_FX, EASE, HIT, OVERLAP, STAYS, THROW } from '@/utils/motion';
import { TAU } from '@/utils/proceduralMotion';
import {
  FIGHTER_REACTION_HOLD_MS,
  FighterAmbientMood,
  FighterPersonalityProfile,
  FighterReactionType,
} from '@/utils/fighterAnimations';

export type FighterOverlayReactionType = FighterReactionType | 'throw';

interface FighterEffectsOverlayProps {
  activeReaction: FighterOverlayReactionType | null;
  reactionId?: number;
  mood: FighterAmbientMood;
  personality: FighterPersonalityProfile;
  /** Portrait stage size (px), used to scale forward strike offsets proportionally */
  size?: number;
  animate?: boolean;
  /** Bursts show still (the Effects switch is off); ambient life still runs */
  stillBurst?: boolean;
  /** 0..1 how big the moment is (a streak): a big one adds extra burst arcs */
  intensity?: number;
  /** Optional dynamic release delay (ms) syncing `'joy'` celebration marks to card landing (`[FX-23]`) */
  cheerReleaseMs?: number;
}

/**
 * Compact outer-perimeter parabolic burst arcs for Fighter reactions so comic emblems
 * fan outward gently with smooth ease-out deceleration WITHOUT covering faces OR clipping
 * framed portrait borders (`|bowX| * π < 0.6 * |spreadX|` guarantees monotonic deceleration).
 */
const FIGHTER_BURST_ARCS: readonly [
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
] = [
  { spreadX: -6, bowX: -1.0, liftY: 4.6, gravityY: -7.6, spinDeg: -16 },
  { spreadX: 6, bowX: 1.0, liftY: 4.8, gravityY: -8.0, spinDeg: 15 },
  { spreadX: 1.2, bowX: 0.2, liftY: 3.8, gravityY: -6.4, spinDeg: 8 },
  { spreadX: -7, bowX: -1.1, liftY: 4.0, gravityY: -6.6, spinDeg: -18 },
  { spreadX: 7, bowX: 1.1, liftY: 4.0, gravityY: -6.6, spinDeg: 18 },
];

/** Forward-right strike burst arcs for Set-launch `'throw'` sparks (strictly in front of lunged faces!). */
const THROW_SPARK_ARCS: readonly [BurstArcSpec, BurstArcSpec, BurstArcSpec] = [
  { spreadX: 8, bowX: 1.4, liftY: 3.6, gravityY: -5.2, spinDeg: 12 },
  { spreadX: 11, bowX: 1.8, liftY: 5.0, gravityY: -7.5, spinDeg: 18 },
  { spreadX: 7, bowX: 1.2, liftY: 2.8, gravityY: -3.8, spinDeg: -10 },
];

/** Exact 120-frame (1.92s) sleepy cycle frequency so `zZz` loops C0+C1 seamlessly (`f0 === f120`). */
const SLEEPY_LOOP_HZ = 1 / 1.92;

function HeartShape({
  cx,
  cy,
  scale = 1,
  fill = '#FF7169',
}: {
  cx: number;
  cy: number;
  scale?: number;
  fill?: string;
}) {
  return (
    <G transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <Path
        d="M 0 4.5 C -6 -0.5, -9 -5.5, -4.8 -8 C -2.2 -9.5, 0 -7, 0 -5 C 0 -7, 2.2 -9.5, 4.8 -8 C 9 -5.5, 6 -0.5, 0 4.5 Z"
        fill={fill}
        stroke={STROKE}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </G>
  );
}

/** Evaluates one sleepy `z`/`Z` letter along a true rising S-curve with smooth fade-in and fade-out. */
function useSleepyLetterStyle(
  ambientPhase: SharedValue<number>,
  presence: SharedValue<number>,
  phaseOffset: number,
  animate: boolean
) {
  return useAnimatedStyle(() => {
    const p = presence.value;
    if (!animate) {
      return {
        opacity: p * 0.9,
        transform: [
          { translateX: phaseOffset * 6 },
          { translateY: -phaseOffset * 12 },
          { scale: 0.85 + phaseOffset * 0.2 },
        ],
      };
    }
    const raw = ambientPhase.value / TAU + phaseOffset;
    const t = raw - Math.floor(raw); // seamless 0..1 sawtooth wrapped cleanly on 2π
    // Smooth window: fades in 0..0.18, floats clear 0.18..0.68, fades out 0.68..1.0 (zero wrap pop!)
    const env = t < 0.18 ? t / 0.18 : t > 0.68 ? (1 - t) / 0.32 : 1;
    const sCurveX = Math.sin(t * TAU) * 3.8 + t * 4.8;
    const riseY = 3 - t * 18;
    const scale = 0.72 + t * 0.4;
    return {
      opacity: p * env,
      transform: [
        { translateX: sCurveX },
        { translateY: riseY },
        { scale },
      ],
    };
  });
}

interface BurstSlotOptions {
  /** Base horizontal offset (px) applied during animated bursts (pushes `'throw'` slashes ahead of lunged faces) */
  baseTx: number;
  /** Base vertical offset (px) applied during animated bursts */
  baseTy: number;
  /** Reduced-motion / still-burst mode: zero travel, opacity-only cross-fade via `reducedOpacity` */
  staticStill: boolean;
  /** Static horizontal offset (px) when `staticStill` is true (fighter stays un-lunged) */
  staticBaseTx: number;
  /** Dedicated `ACCESSIBLE.fadeMs` opacity channel for mount-until-exited reduced-motion fades */
  reducedOpacity: SharedValue<number>;
}

/**
 * One independent GPU-animated parabolic burst particle slot driven by Phase 0's `sampleBurstParticle`
 * over a cubic ease-out progress warp (`1 - (1 - s)^3`) for crisp launch and silky zero-velocity settle.
 * Under reduced motion / `stillBurst`, performs a zero-travel `ACCESSIBLE.fadeMs` cross-fade.
 */
function useBurstSlotStyle(
  progress: SharedValue<number>,
  spec: BurstArcSpec,
  options: BurstSlotOptions
) {
  const { baseTx, baseTy, staticStill, staticBaseTx, reducedOpacity } = options;
  return useAnimatedStyle(() => {
    if (staticStill) {
      return {
        opacity: reducedOpacity.value,
        transform: [
          { translateX: staticBaseTx },
          { translateY: 0 },
          { rotate: '0deg' },
          { scale: 1 },
        ],
      };
    }

    const s = Math.max(0, Math.min(1, progress.value));
    if (s <= 0.001 || s >= 0.999) {
      return {
        opacity: 0,
        transform: [
          { translateX: baseTx },
          { translateY: baseTy },
          { rotate: '0deg' },
          { scale: 0.78 },
        ],
      };
    }

    // Cubic ease-out trajectory warp over linear driver time `s` -> brisk burst + asymptotic settle (zero LINEAR / HARD-STOP)
    const inv = 1 - s;
    const uPos = 1 - inv * inv * inv;
    const sample = sampleBurstParticle(uPos, spec);

    // Smooth non-linear pop-in and gentle ease-out-cubic settle on scale
    let scale: number;
    if (s < 0.24) {
      const p = s / 0.24;
      const ep = 1 - (1 - p) * (1 - p) * (1 - p);
      scale = 0.78 + ep * 0.3;
    } else {
      const q = (s - 0.24) / 0.76;
      const eq = 1 - (1 - q) * (1 - q) * (1 - q);
      scale = 1.08 - eq * 0.16;
    }

    // Smooth quadratic fade-in & fade-out envelope (zero POP-OUT)
    let opacity: number;
    if (s < 0.14) {
      const p = s / 0.14;
      opacity = 1 - (1 - p) * (1 - p);
    } else if (s > 0.62) {
      const q = (s - 0.62) / 0.38;
      opacity = (1 - q) * (1 - q);
    } else {
      opacity = 1;
    }

    return {
      opacity,
      transform: [
        { translateX: baseTx + sample.tx },
        { translateY: baseTy + sample.ty },
        { rotate: `${sample.rotDeg}deg` },
        { scale },
      ],
    };
  });
}

/**
 * Renders creature-specific staggered parabolic particle bursts, emotional comic symbols
 * (rising S-curve zZz, Phew drop, lightbulb gleam, healing crosses, affection hearts),
 * forward-edge throw swooshes strictly ahead of lunged faces, and streak sparkles.
 */
export const FighterEffectsOverlay: React.FC<FighterEffectsOverlayProps> = ({
  activeReaction,
  reactionId = 0,
  mood,
  personality,
  size = 72,
  animate = true,
  stillBurst = false,
  intensity = 0,
  cheerReleaseMs,
}) => {
  const isStaticBurst = !animate || stillBurst;

  // Mount-until-exited reaction latch so reduced-motion / still bursts fade out cleanly (zero POP-OUT!)
  const [displayedReaction, setDisplayedReaction] = useState<FighterOverlayReactionType | null>(
    activeReaction
  );
  const [displayedIntensity, setDisplayedIntensity] = useState(intensity);
  const burstExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedOpacity = useSharedValue(activeReaction && isStaticBurst ? 1 : 0);

  if (activeReaction && displayedReaction !== activeReaction) {
    setDisplayedReaction(activeReaction);
  }
  if (activeReaction && displayedIntensity !== intensity) {
    setDisplayedIntensity(intensity);
  }

  useEffect(() => {
    if (burstExitTimerRef.current) {
      clearTimeout(burstExitTimerRef.current);
      burstExitTimerRef.current = null;
    }
    if (activeReaction) {
      if (isStaticBurst) {
        reducedOpacity.value = 0;
        reducedOpacity.value = withTiming(1, {
          duration: ACCESSIBLE.fadeMs,
          easing: EASE.ui,
          ...STAYS,
        });
      } else {
        cancelAnimation(reducedOpacity);
        reducedOpacity.value = 1;
      }
      return;
    }
    if (displayedReaction) {
      if (isStaticBurst) {
        reducedOpacity.value = withTiming(0, {
          duration: ACCESSIBLE.fadeMs,
          easing: EASE.exitSoft,
          ...STAYS,
        });
        burstExitTimerRef.current = setTimeout(() => {
          burstExitTimerRef.current = null;
          setDisplayedReaction(null);
        }, ACCESSIBLE.fadeMs + HIT.snapMs);
      } else {
        setDisplayedReaction(null);
      }
    }
    return () => {
      if (burstExitTimerRef.current) {
        clearTimeout(burstExitTimerRef.current);
        burstExitTimerRef.current = null;
      }
    };
  }, [activeReaction, reactionId, isStaticBurst, displayedReaction, reducedOpacity]);

  useEffect(() => {
    return () => {
      cancelAnimation(reducedOpacity);
    };
  }, [reducedOpacity]);

  const effectiveReaction = activeReaction ?? displayedReaction;
  const effectiveIntensity = activeReaction ? intensity : displayedIntensity;
  const showAmbient = !activeReaction;
  const isThrow = effectiveReaction === 'throw';
  const holdMs =
    activeReaction === 'throw'
      ? Math.round(THROW.expressionHoldMs * 0.72)
      : activeReaction
        ? FIGHTER_REACTION_HOLD_MS[activeReaction] ?? 850
        : 850;
  const effectiveReleaseMs = Math.max(
    0,
    Math.min(holdMs - HIT.snapMs * 4, cheerReleaseMs ?? CHEER.releaseMs)
  );
  const {
    particleProgresses,
    ambientPhase,
    presences: [sleepyPresence, urgentPresence, streakPresence],
  } = useEffectsDriver({
    animate,
    initialAmbientHz: mood === 'sleepy' ? SLEEPY_LOOP_HZ : 0.6,
    ambientHz: mood === 'urgent' ? 1.55 : mood === 'sleepy' ? SLEEPY_LOOP_HZ : 0.78,
    presenceTargets: [
      showAmbient && mood === 'sleepy' ? 1 : 0,
      showAmbient && mood === 'urgent' ? 1 : 0,
      showAmbient && (mood === 'streak' || mood === 'victory') ? 1 : 0,
    ],
    fadeMs: CREATURE_FX.fighterAmbientFadeMs,
    activeReaction,
    reactionId,
    burstMs: holdMs,
    burstEasing: EASE.linear,
    staticBurstProgress: 0.42,
    stillBurst,
    restartKey: personality,
    particleStaggerMs: isThrow ? HIT.snapMs * 2 : OVERLAP.primaryMs,
    // Delay `'throw'` slash until `THROW.windMs` (32ms) so impact arcs ignite ON the strike frame, never during coil wind-up!
    particleStartOffsetMs:
      activeReaction === 'throw'
        ? THROW.windMs
        : activeReaction === 'joy'
          ? effectiveReleaseMs
          : 0,
  });

  // 3 independent staggered rising S-curve sleepy `z Z z` layers (fixes closed-oval bug!)
  const sleepyZ0Style = useSleepyLetterStyle(ambientPhase, sleepyPresence, 0, animate);
  const sleepyZ1Style = useSleepyLetterStyle(ambientPhase, sleepyPresence, 1 / 3, animate);
  const sleepyZ2Style = useSleepyLetterStyle(ambientPhase, sleepyPresence, 2 / 3, animate);

  // Forward-right offset pushes `'throw'` strike arcs strictly ahead of lunged faces/snouts/fists!
  const throwBase0 = isThrow ? Math.round(size * 0.3) : 0;
  const throwBase1 = isThrow ? Math.round(size * 0.34) : 0;
  const throwBase2 = isThrow ? Math.round(size * 0.27) : 0;
  const throwStaticBase = isThrow ? Math.round(size * 0.15) : 0;

  // 5 independent staggered parabolic particle channels (cubic ease-out flight + zero-travel reduced fade)
  const p0Style = useBurstSlotStyle(
    particleProgresses[0],
    isThrow ? THROW_SPARK_ARCS[0] : FIGHTER_BURST_ARCS[0],
    {
      baseTx: throwBase0,
      baseTy: 0,
      staticStill: isStaticBurst,
      staticBaseTx: throwStaticBase,
      reducedOpacity,
    }
  );
  const p1Style = useBurstSlotStyle(
    particleProgresses[1],
    isThrow ? THROW_SPARK_ARCS[1] : FIGHTER_BURST_ARCS[1],
    {
      baseTx: throwBase1,
      baseTy: isThrow ? -2 : 0,
      staticStill: isStaticBurst,
      staticBaseTx: throwStaticBase,
      reducedOpacity,
    }
  );
  const p2Style = useBurstSlotStyle(
    particleProgresses[2],
    isThrow ? THROW_SPARK_ARCS[2] : FIGHTER_BURST_ARCS[2],
    {
      baseTx: throwBase2,
      baseTy: 0,
      staticStill: isStaticBurst,
      staticBaseTx: throwStaticBase,
      reducedOpacity,
    }
  );
  const p3Style = useBurstSlotStyle(particleProgresses[3], FIGHTER_BURST_ARCS[3], {
    baseTx: 0,
    baseTy: 0,
    staticStill: isStaticBurst,
    staticBaseTx: 0,
    reducedOpacity,
  });
  const p4Style = useBurstSlotStyle(particleProgresses[4], FIGHTER_BURST_ARCS[4], {
    baseTx: 0,
    baseTy: 0,
    staticStill: isStaticBurst,
    staticBaseTx: 0,
    reducedOpacity,
  });

  // Snappy urgent pulse for clock panic
  const urgentStyle = useAnimatedStyle(() => {
    const pulse = (Math.sin(ambientPhase.value * 2) + 1) / 2;
    return {
      opacity: urgentPresence.value * (0.75 + 0.25 * pulse),
      transform: [
        { translateY: -pulse * 2.4 },
        { scale: 0.94 + pulse * 0.1 },
      ],
    };
  });

  // Gentle twinkling orbit for streak / victory sparkles
  const streakStyle = useAnimatedStyle(() => {
    const s = Math.sin(ambientPhase.value);
    return {
      opacity: streakPresence.value * (0.76 + 0.24 * Math.abs(s)),
      transform: [
        { translateY: s * -2.5 },
        { scale: 0.95 + Math.abs(s) * 0.09 },
      ],
    };
  });

  // Render distinct emblems per staggered parabolic particle slot (`0..4`), anchored safely inside framed edges!
  const renderJoyParticle = (slot: number, isMega: boolean) => {
    if (slot >= 3 && !isMega) return null;
    switch (personality.signatureMotif) {
      case 'hearts':
        if (slot === 0) return <HeartShape cx={20} cy={24} scale={0.9} fill="#FF7169" />;
        if (slot === 1) return <HeartShape cx={80} cy={22} scale={0.84} fill="#FF9538" />;
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={14} r={6.4} fill={COLORS.actionYellow} />;
        if (slot === 3) return <Sparkle4 cx={18} cy={40} r={5.0} fill={COLORS.actionYellow} />;
        if (slot === 4) return <HeartShape cx={82} cy={38} scale={0.68} fill="#FF7169" />;
        return null;
      case 'embers':
        if (slot === 0) {
          return (
            <Path
              d="M 19 28 C 15 22, 19 15, 22 12 C 24 17, 27 22, 23 28 Z"
              fill="#FF6B00"
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 1) {
          return (
            <Path
              d="M 80 26 C 77 20, 80 14, 83 11 C 85 16, 87 20, 84 26 Z"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={14} r={6.5} fill="#FF6B00" />;
        if (slot === 3) return <Sparkle4 cx={18} cy={40} r={5.0} fill={COLORS.actionYellow} />;
        if (slot === 4) return <Sparkle4 cx={82} cy={38} r={5.0} fill="#FF6B00" />;
        return null;
      case 'frost':
        if (slot === 0) {
          return (
            <Polygon
              points="20,15 25,21 20,27 15,21"
              fill={COLORS.logicTeal}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 1) {
          return (
            <Polygon
              points="80,15 85,21 80,27 75,21"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={14} r={6.4} fill={COLORS.logicTeal} />;
        if (slot === 3) return <Sparkle4 cx={18} cy={40} r={4.8} fill={COLORS.actionYellow} />;
        if (slot === 4) {
          return (
            <Polygon
              points="82,34 86,39 82,44 78,39"
              fill={COLORS.logicTeal}
              stroke={STROKE}
              strokeWidth={1.5}
            />
          );
        }
        return null;
      case 'splash':
        if (slot === 0) {
          return (
            <Path
              d="M 20 17 C 20 17, 24.5 23.5, 24.5 26 A 4.5 4.5 0 1 1 15.5 26 C 15.5 23.5, 20 17, 20 17 Z"
              fill={COLORS.logicTeal}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 1) return <Sparkle4 cx={80} cy={20} r={6.4} fill={COLORS.actionYellow} />;
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={14} r={6.2} fill="#FF9538" />;
        if (slot === 3) {
          return (
            <Path
              d="M 81 33 C 81 33, 84.5 37.5, 84.5 39.8 A 3.5 3.5 0 1 1 77.5 39.8 C 77.5 37.5, 81 33, 81 33 Z"
              fill="#38BDF8"
              stroke={STROKE}
              strokeWidth={1.5}
            />
          );
        }
        if (slot === 4) return <Sparkle4 cx={19} cy={41} r={4.8} fill={COLORS.actionYellow} />;
        return null;
      case 'shockwave':
        if (slot === 0) return <Sparkle4 cx={20} cy={22} r={6.8} fill={COLORS.actionYellow} />;
        if (slot === 1) return <Sparkle4 cx={80} cy={22} r={6.8} fill={COLORS.logicTeal} />;
        if (slot === 2 && isMega) {
          return (
            <Circle
              cx={50}
              cy={50}
              r={43}
              fill="none"
              stroke={COLORS.actionYellow}
              strokeWidth={2.5}
              strokeDasharray="8 6"
            />
          );
        }
        if (slot === 3) return <Sparkle4 cx={18} cy={40} r={5.2} fill={COLORS.logicTeal} />;
        if (slot === 4) return <Sparkle4 cx={82} cy={38} r={5.2} fill={COLORS.actionYellow} />;
        return null;
      case 'stars':
      default:
        if (slot === 0) return <Sparkle4 cx={20} cy={22} r={6.8} fill={COLORS.actionYellow} />;
        if (slot === 1) return <Sparkle4 cx={80} cy={20} r={6.2} fill="#FF9538" />;
        if (slot === 2 && isMega) return <HeartShape cx={50} cy={15} scale={0.76} fill="#FF7169" />;
        if (slot === 3) return <Sparkle4 cx={18} cy={40} r={5.0} fill="#FF9538" />;
        if (slot === 4) return <Sparkle4 cx={82} cy={38} r={5.2} fill={COLORS.actionYellow} />;
        return null;
    }
  };

  const renderReactionSlot = (slot: number) => {
    if (!effectiveReaction) return null;
    if (effectiveReaction === 'joy' || effectiveReaction === 'ecstatic') {
      return renderJoyParticle(slot, effectiveReaction === 'ecstatic' || effectiveIntensity >= 0.5);
    }

    switch (effectiveReaction) {
      case 'throw':
        // Rendered inside viewBox 0..100 + shifted forward via `throwBase*` so slashes flash strictly AHEAD of lunged faces!
        if (slot === 0) {
          return (
            <G>
              <Path
                d="M 78 20 Q 90 32 95 48"
                stroke={STROKE}
                strokeWidth={5.0}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 78 20 Q 90 32 95 48"
                stroke={COLORS.actionYellow}
                strokeWidth={3.0}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          );
        }
        if (slot === 1) {
          return <Sparkle4 cx={89} cy={24} r={5.8} fill={COLORS.actionYellow} />;
        }
        if (slot === 2) {
          return (
            <G>
              <Path
                d="M 82 38 Q 92 48 96 60"
                stroke={personality.auraColor}
                strokeWidth={2.8}
                strokeLinecap="round"
                fill="none"
              />
              <Sparkle4 cx={92} cy={54} r={4.4} fill={personality.auraColor} />
            </G>
          );
        }
        return null;

      case 'pain':
        if (slot === 0) {
          return (
            <Path
              d="M 76 14 Q 80 19 76 24 M 86 14 Q 82 19 86 24 M 76 14 Q 81 18 86 14 M 76 24 Q 81 20 86 24"
              stroke={COLORS.impactRed}
              strokeWidth={2.8}
              strokeLinecap="round"
              fill="none"
            />
          );
        }
        if (slot === 1) {
          return (
            <Line
              x1={16}
              y1={22}
              x2={25}
              y2={28}
              stroke={COLORS.impactRed}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        }
        if (slot === 2) {
          return (
            <Line
              x1={14}
              y1={33}
              x2={23}
              y2={34}
              stroke={COLORS.impactOrange}
              strokeWidth={2.8}
              strokeLinecap="round"
            />
          );
        }
        return null;

      case 'relief':
        if (slot === 0) {
          return (
            <G>
              <Path
                d="M 82 16 C 82 16, 88 24, 88 28 A 6 6 0 1 1 76 28 C 76 24, 82 16, 82 16 Z"
                fill="#38BDF8"
                stroke={STROKE}
                strokeWidth={2}
              />
              <Circle cx={80.2} cy={27.5} r={1.5} fill="#FFFFFF" />
            </G>
          );
        }
        if (slot === 1) {
          return <Sparkle4 cx={18} cy={20} r={7.0} fill={COLORS.logicTeal} />;
        }
        return null;

      case 'heal':
        if (slot === 0) {
          return (
            <G stroke={COLORS.logicTeal} strokeWidth={3.4} strokeLinecap="round">
              <Line x1={18} y1={16} x2={18} y2={26} />
              <Line x1={13} y1={21} x2={23} y2={21} />
            </G>
          );
        }
        if (slot === 1) {
          return <HeartShape cx={82} cy={21} scale={0.88} fill="#FF7169" />;
        }
        if (slot === 2) {
          return (
            <G stroke={COLORS.logicTeal} strokeWidth={2.8} strokeLinecap="round">
              <Line x1={74} y1={12} x2={74} y2={18} />
              <Line x1={71} y1={15} x2={77} y2={15} />
            </G>
          );
        }
        return null;

      case 'powerup':
        if (slot === 0) {
          return (
            <Circle
              cx={50}
              cy={50}
              r={43}
              fill="none"
              stroke={COLORS.actionYellow}
              strokeWidth={3}
              strokeDasharray="10 5"
            />
          );
        }
        if (slot === 1) return <Sparkle4 cx={18} cy={18} r={7.0} fill={COLORS.actionYellow} />;
        if (slot === 2) return <Sparkle4 cx={82} cy={18} r={7.0} fill={COLORS.logicTeal} />;
        return null;

      case 'hint':
        if (slot === 0) return <Sparkle4 cx={50} cy={14} r={7.2} fill={COLORS.actionYellow} />;
        if (slot === 1) {
          return (
            <Line
              x1={35}
              y1={14}
              x2={39}
              y2={16}
              stroke={COLORS.actionYellow}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        }
        if (slot === 2) {
          return (
            <Line
              x1={65}
              y1={14}
              x2={61}
              y2={16}
              stroke={COLORS.actionYellow}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        }
        return null;

      case 'pet':
        if (slot === 0) return <HeartShape cx={50} cy={15} scale={0.94} fill="#FF7169" />;
        if (slot === 1) return <Sparkle4 cx={20} cy={24} r={5.2} fill={COLORS.actionYellow} />;
        if (slot === 2) return <HeartShape cx={80} cy={22} scale={0.7} fill="#FF9538" />;
        return null;

      case 'dizzy_joy':
        if (slot === 0) return <HeartShape cx={20} cy={22} scale={0.88} fill="#FF7169" />;
        if (slot === 1) return <HeartShape cx={80} cy={22} scale={0.88} fill={COLORS.logicTeal} />;
        if (slot === 2) return <Sparkle4 cx={50} cy={14} r={7.2} fill={COLORS.actionYellow} />;
        if (slot === 3) return <Sparkle4 cx={18} cy={38} r={5.2} fill={COLORS.actionYellow} />;
        if (slot === 4) return <Sparkle4 cx={82} cy={38} r={5.2} fill="#FF9538" />;
        return null;

      case 'entrance':
        if (slot === 0) return <Sparkle4 cx={80} cy={20} r={6.6} fill={COLORS.actionYellow} />;
        if (slot === 1) return <Sparkle4 cx={20} cy={22} r={5.2} fill={personality.auraColor} />;
        return null;

      default:
        return null;
    }
  };

  const slotStyles = [p0Style, p1Style, p2Style, p3Style, p4Style] as const;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Staggered Rising S-Curve Sleepy zZz Overlay (3 independent fade-wrapped streams clear of right ear) */}
      <Animated.View style={[StyleSheet.absoluteFill, sleepyZ0Style]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <SvgText x={77} y={28} fontSize={12} fontWeight="900" fill={STROKE}>
            z
          </SvgText>
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, sleepyZ1Style]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <SvgText x={81} y={24} fontSize={15} fontWeight="900" fill={COLORS.logicTeal}>
            Z
          </SvgText>
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, sleepyZ2Style]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <SvgText x={79} y={26} fontSize={11} fontWeight="900" fill={STROKE}>
            z
          </SvgText>
        </Svg>
      </Animated.View>

      {/* Cross-fading Urgent Clock-Panic Overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, urgentStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Path
              d="M 15 17 C 15 17, 19.5 23, 19.5 25.5 A 4.5 4.5 0 1 1 10.5 25.5 C 10.5 23, 15 17, 15 17 Z"
              fill="#38BDF8"
              stroke={STROKE}
              strokeWidth={1.8}
            />
            <Line x1={84} y1={11} x2={84} y2={22} stroke={COLORS.impactRed} strokeWidth={4} strokeLinecap="round" />
            <Circle cx={84} cy={27.5} r={2.3} fill={COLORS.impactRed} />
          </G>
        </Svg>
      </Animated.View>

      {/* Cross-fading Streak / Victory Sparkles Overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, streakStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <Sparkle4 cx={18} cy={22} r={6.0} fill={COLORS.actionYellow} />
            <Sparkle4 cx={82} cy={20} r={5.6} fill={personality.auraColor} />
          </G>
        </Svg>
      </Animated.View>

      {/* Staggered Multi-Particle Parabolic Reaction Bursts (mount-until-exited for reduced-motion cross-fades) */}
      {effectiveReaction && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          testID={`fighter-fx-${effectiveReaction}`}
        >
          {slotStyles.map((slotStyle, idx) => {
            const emblem = renderReactionSlot(idx);
            if (!emblem) return null;
            return (
              <Animated.View key={idx} style={[StyleSheet.absoluteFill, slotStyle]}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100">
                  {emblem}
                </Svg>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
};
