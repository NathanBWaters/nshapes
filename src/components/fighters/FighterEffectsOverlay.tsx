import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Svg, Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import {
  BurstArcSpec,
  sampleBurstParticle,
  useEffectsDriver,
} from '@/components/creatures/useEffectsDriver';
import { STROKE, Sparkle4 } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CHEER, CREATURE_FX, HIT, OVERLAP, THROW } from '@/utils/motion';
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
  animate?: boolean;
  /** Bursts show still (the Effects switch is off); ambient life still runs */
  stillBurst?: boolean;
  /** 0..1 how big the moment is (a streak): a big one adds extra burst arcs */
  intensity?: number;
  /** Optional dynamic release delay (ms) syncing `'joy'` celebration marks to card landing (`[FX-23]`) */
  cheerReleaseMs?: number;
}

/**
 * Outer-perimeter parabolic burst arcs for Fighter reactions so comic emblems
 * fan outward cleanly around the hero WITHOUT covering the face OR clipping portrait edges.
 */
const FIGHTER_BURST_ARCS: readonly [
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
] = [
  { spreadX: -9, bowX: -3, liftY: 11, gravityY: 5, spinDeg: -20 },
  { spreadX: 9, bowX: 3, liftY: 12, gravityY: 5, spinDeg: 18 },
  { spreadX: 1, bowX: 2.5, liftY: 13, gravityY: 4, spinDeg: 10 },
  { spreadX: -12, bowX: -3, liftY: 9, gravityY: 6, spinDeg: -24 },
  { spreadX: 12, bowX: 3, liftY: 9, gravityY: 6, spinDeg: 24 },
];

/** Forward-right strike burst arcs for Set-launch `'throw'` sparks (strictly clear of the face!). */
const THROW_SPARK_ARCS: readonly [BurstArcSpec, BurstArcSpec, BurstArcSpec] = [
  { spreadX: 12, bowX: 3, liftY: 8, gravityY: 2, spinDeg: 14 },
  { spreadX: 16, bowX: 4, liftY: 12, gravityY: 4, spinDeg: 22 },
  { spreadX: 10, bowX: 2, liftY: 5, gravityY: 5, spinDeg: -12 },
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

/** One independent GPU-animated parabolic burst particle slot driven by Phase 0's `sampleBurstParticle`. */
function useBurstSlotStyle(progress: SharedValue<number>, spec: BurstArcSpec) {
  return useAnimatedStyle(() => {
    const sample = sampleBurstParticle(progress.value, spec);
    return {
      opacity: sample.opacity,
      transform: [
        { translateX: sample.tx },
        { translateY: sample.ty },
        { rotate: `${sample.rotDeg}deg` },
        { scale: sample.scale },
      ],
    };
  });
}

/**
 * Renders creature-specific staggered parabolic particle bursts, emotional comic symbols
 * (rising S-curve zZz, Phew drop, lightbulb gleam, healing crosses, affection hearts),
 * forward-edge throw swooshes (never obscuring the face), and streak sparkles.
 */
export const FighterEffectsOverlay: React.FC<FighterEffectsOverlayProps> = ({
  activeReaction,
  reactionId = 0,
  mood,
  personality,
  animate = true,
  stillBurst = false,
  intensity = 0,
  cheerReleaseMs,
}) => {
  const showAmbient = !activeReaction;
  const isThrow = activeReaction === 'throw';
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
    staticBurstProgress: 0.42,
    stillBurst,
    restartKey: personality,
    particleStaggerMs: isThrow ? HIT.snapMs * 2 : OVERLAP.primaryMs,
    particleStartOffsetMs: activeReaction === 'joy' ? effectiveReleaseMs : 0,
  });

  // 3 independent staggered rising S-curve sleepy `z Z z` layers (fixes closed-oval bug!)
  const sleepyZ0Style = useSleepyLetterStyle(ambientPhase, sleepyPresence, 0, animate);
  const sleepyZ1Style = useSleepyLetterStyle(ambientPhase, sleepyPresence, 1 / 3, animate);
  const sleepyZ2Style = useSleepyLetterStyle(ambientPhase, sleepyPresence, 2 / 3, animate);

  // 5 independent staggered parabolic particle channels (replaces welded single-slab burst!)
  const p0Style = useBurstSlotStyle(
    particleProgresses[0],
    isThrow ? THROW_SPARK_ARCS[0] : FIGHTER_BURST_ARCS[0]
  );
  const p1Style = useBurstSlotStyle(
    particleProgresses[1],
    isThrow ? THROW_SPARK_ARCS[1] : FIGHTER_BURST_ARCS[1]
  );
  const p2Style = useBurstSlotStyle(
    particleProgresses[2],
    isThrow ? THROW_SPARK_ARCS[2] : FIGHTER_BURST_ARCS[2]
  );
  const p3Style = useBurstSlotStyle(particleProgresses[3], FIGHTER_BURST_ARCS[3]);
  const p4Style = useBurstSlotStyle(particleProgresses[4], FIGHTER_BURST_ARCS[4]);

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

  // Render distinct emblems per staggered parabolic particle slot (`0..4`), anchored to outer edges!
  const renderJoyParticle = (slot: number, isMega: boolean) => {
    if (slot >= 3 && !isMega) return null;
    switch (personality.signatureMotif) {
      case 'hearts':
        if (slot === 0) return <HeartShape cx={16} cy={22} scale={0.95} fill="#FF7169" />;
        if (slot === 1) return <HeartShape cx={84} cy={20} scale={0.88} fill="#FF9538" />;
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={7} r={7.2} fill={COLORS.actionYellow} />;
        if (slot === 3) return <Sparkle4 cx={12} cy={38} r={5.4} fill={COLORS.actionYellow} />;
        if (slot === 4) return <HeartShape cx={89} cy={34} scale={0.72} fill="#FF7169" />;
        return null;
      case 'embers':
        if (slot === 0) {
          return (
            <Path
              d="M 15 26 C 11 20, 15 12, 18 9 C 20 14, 23 19, 19 26 Z"
              fill="#FF6B00"
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 1) {
          return (
            <Path
              d="M 84 24 C 81 18, 84 11, 87 8 C 89 13, 91 18, 88 24 Z"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={6} r={7.5} fill="#FF6B00" />;
        if (slot === 3) return <Sparkle4 cx={11} cy={38} r={5.5} fill={COLORS.actionYellow} />;
        if (slot === 4) return <Sparkle4 cx={90} cy={34} r={5.5} fill="#FF6B00" />;
        return null;
      case 'frost':
        if (slot === 0) {
          return (
            <Polygon
              points="15,12 20,19 15,26 10,19"
              fill={COLORS.logicTeal}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 1) {
          return (
            <Polygon
              points="85,12 90,19 85,26 80,19"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={6} r={7.2} fill={COLORS.logicTeal} />;
        if (slot === 3) return <Sparkle4 cx={12} cy={36} r={5.2} fill={COLORS.actionYellow} />;
        if (slot === 4) {
          return (
            <Polygon
              points="90,30 94,35 90,40 86,35"
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
              d="M 14 14 C 14 14, 19 21, 19 24 A 5 5 0 1 1 9 24 C 9 21, 14 14, 14 14 Z"
              fill={COLORS.logicTeal}
              stroke={STROKE}
              strokeWidth={1.7}
            />
          );
        }
        if (slot === 1) return <Sparkle4 cx={86} cy={16} r={7.2} fill={COLORS.actionYellow} />;
        if (slot === 2 && isMega) return <Sparkle4 cx={50} cy={6} r={7.2} fill="#FF9538" />;
        if (slot === 3) {
          return (
            <Path
              d="M 88 28 C 88 28, 92 33, 92 35.5 A 4 4 0 1 1 84 35.5 C 84 33, 88 28, 88 28 Z"
              fill="#38BDF8"
              stroke={STROKE}
              strokeWidth={1.5}
            />
          );
        }
        if (slot === 4) return <Sparkle4 cx={12} cy={38} r={5.2} fill={COLORS.actionYellow} />;
        return null;
      case 'shockwave':
        if (slot === 0) return <Sparkle4 cx={14} cy={18} r={7.5} fill={COLORS.actionYellow} />;
        if (slot === 1) return <Sparkle4 cx={86} cy={18} r={7.5} fill={COLORS.logicTeal} />;
        if (slot === 2 && isMega) {
          return (
            <Circle
              cx={50}
              cy={50}
              r={45}
              fill="none"
              stroke={COLORS.actionYellow}
              strokeWidth={2.6}
              strokeDasharray="8 6"
            />
          );
        }
        if (slot === 3) return <Sparkle4 cx={11} cy={38} r={5.6} fill={COLORS.logicTeal} />;
        if (slot === 4) return <Sparkle4 cx={90} cy={36} r={5.6} fill={COLORS.actionYellow} />;
        return null;
      case 'stars':
      default:
        if (slot === 0) return <Sparkle4 cx={14} cy={18} r={7.8} fill={COLORS.actionYellow} />;
        if (slot === 1) return <Sparkle4 cx={86} cy={16} r={7} fill="#FF9538" />;
        if (slot === 2 && isMega) return <HeartShape cx={50} cy={6} scale={0.82} fill="#FF7169" />;
        if (slot === 3) return <Sparkle4 cx={10} cy={36} r={5.4} fill="#FF9538" />;
        if (slot === 4) return <Sparkle4 cx={90} cy={34} r={5.6} fill={COLORS.actionYellow} />;
        return null;
    }
  };

  const renderReactionSlot = (slot: number) => {
    if (!activeReaction) return null;
    if (activeReaction === 'joy' || activeReaction === 'ecstatic') {
      return renderJoyParticle(slot, activeReaction === 'ecstatic' || intensity >= 0.5);
    }

    switch (activeReaction) {
      case 'throw':
        // Positioned strictly at the forward-right strike edge (x: 78..99) so VFX NEVER obscure the face!
        if (slot === 0) {
          return (
            <G>
              <Path
                d="M 80 18 Q 92 30 97 46"
                stroke={STROKE}
                strokeWidth={5.2}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 80 18 Q 92 30 97 46"
                stroke={COLORS.actionYellow}
                strokeWidth={3.2}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          );
        }
        if (slot === 1) {
          return <Sparkle4 cx={91} cy={22} r={6.2} fill={COLORS.actionYellow} />;
        }
        if (slot === 2) {
          return (
            <G>
              <Path
                d="M 84 36 Q 94 46 98 58"
                stroke={personality.auraColor}
                strokeWidth={2.8}
                strokeLinecap="round"
                fill="none"
              />
              <Sparkle4 cx={94} cy={52} r={4.6} fill={personality.auraColor} />
            </G>
          );
        }
        return null;

      case 'pain':
        if (slot === 0) {
          return (
            <Path
              d="M 76 12 Q 80 17 76 22 M 86 12 Q 82 17 86 22 M 76 12 Q 81 16 86 12 M 76 22 Q 81 18 86 22"
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
              x1={12}
              y1={20}
              x2={21}
              y2={26}
              stroke={COLORS.impactRed}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        }
        if (slot === 2) {
          return (
            <Line
              x1={10}
              y1={31}
              x2={19}
              y2={32}
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
                d="M 84 14 C 84 14, 90 22, 90 26 A 6 6 0 1 1 78 26 C 78 22, 84 14, 84 14 Z"
                fill="#38BDF8"
                stroke={STROKE}
                strokeWidth={2}
              />
              <Circle cx={82.2} cy={25.5} r={1.5} fill="#FFFFFF" />
            </G>
          );
        }
        if (slot === 1) {
          return <Sparkle4 cx={16} cy={18} r={7.5} fill={COLORS.logicTeal} />;
        }
        return null;

      case 'heal':
        if (slot === 0) {
          return (
            <G stroke={COLORS.logicTeal} strokeWidth={3.4} strokeLinecap="round">
              <Line x1={16} y1={14} x2={16} y2={24} />
              <Line x1={11} y1={19} x2={21} y2={19} />
            </G>
          );
        }
        if (slot === 1) {
          return <HeartShape cx={84} cy={19} scale={0.9} fill="#FF7169" />;
        }
        if (slot === 2) {
          return (
            <G stroke={COLORS.logicTeal} strokeWidth={2.8} strokeLinecap="round">
              <Line x1={76} y1={8} x2={76} y2={14} />
              <Line x1={73} y1={11} x2={79} y2={11} />
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
              r={45}
              fill="none"
              stroke={COLORS.actionYellow}
              strokeWidth={3}
              strokeDasharray="10 5"
            />
          );
        }
        if (slot === 1) return <Sparkle4 cx={15} cy={15} r={7.5} fill={COLORS.actionYellow} />;
        if (slot === 2) return <Sparkle4 cx={85} cy={15} r={7.5} fill={COLORS.logicTeal} />;
        return null;

      case 'hint':
        if (slot === 0) return <Sparkle4 cx={50} cy={8} r={8} fill={COLORS.actionYellow} />;
        if (slot === 1) {
          return (
            <Line
              x1={35}
              y1={8}
              x2={39}
              y2={10}
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
              y1={8}
              x2={61}
              y2={10}
              stroke={COLORS.actionYellow}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        }
        return null;

      case 'pet':
        if (slot === 0) return <HeartShape cx={50} cy={9} scale={1.02} fill="#FF7169" />;
        if (slot === 1) return <Sparkle4 cx={18} cy={22} r={5.5} fill={COLORS.actionYellow} />;
        if (slot === 2) return <HeartShape cx={82} cy={20} scale={0.72} fill="#FF9538" />;
        return null;

      case 'dizzy_joy':
        if (slot === 0) return <HeartShape cx={16} cy={18} scale={0.95} fill="#FF7169" />;
        if (slot === 1) return <HeartShape cx={84} cy={18} scale={0.95} fill={COLORS.logicTeal} />;
        if (slot === 2) return <Sparkle4 cx={50} cy={6} r={8.2} fill={COLORS.actionYellow} />;
        if (slot === 3) return <Sparkle4 cx={12} cy={36} r={5.5} fill={COLORS.actionYellow} />;
        if (slot === 4) return <Sparkle4 cx={88} cy={36} r={5.5} fill="#FF9538" />;
        return null;

      case 'entrance':
        if (slot === 0) return <Sparkle4 cx={84} cy={16} r={7} fill={COLORS.actionYellow} />;
        if (slot === 1) return <Sparkle4 cx={16} cy={20} r={5.5} fill={personality.auraColor} />;
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
            <Sparkle4 cx={15} cy={20} r={6.5} fill={COLORS.actionYellow} />
            <Sparkle4 cx={85} cy={18} r={6} fill={personality.auraColor} />
          </G>
        </Svg>
      </Animated.View>

      {/* Staggered Multi-Particle Parabolic Reaction Bursts */}
      {activeReaction && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          testID={`fighter-fx-${activeReaction}`}
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
