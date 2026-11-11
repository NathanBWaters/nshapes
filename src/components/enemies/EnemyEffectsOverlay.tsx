import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import {
  EnemyAmbientMood,
  EnemyPersonalityProfile,
  EnemyReactionType,
} from '@/utils/enemyAnimations';
import { advancePhase, expApproach } from '@/utils/proceduralMotion';

interface EnemyEffectsOverlayProps {
  activeReaction: EnemyReactionType | null;
  reactionId?: number;
  mood: EnemyAmbientMood;
  personality: EnemyPersonalityProfile;
  animate?: boolean;
}

const STROKE = COLORS.slateCharcoal;

function ImpactStar({
  cx,
  cy,
  r,
  fill = COLORS.actionYellow,
}: {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    const d = i % 2 === 0 ? r : r * 0.44;
    pts.push(`${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`);
  }
  return (
    <Polygon
      points={pts.join(' ')}
      fill={fill}
      stroke={STROKE}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  );
}

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
 * Renders phase-continuous enemy ambient menace/sleepy/cornered effects and
 * juicy discrete combat bursts (hit impact stars, crit shockwaves, claw slashes,
 * wicked taunt sparks, regen pluses).
 */
export const EnemyEffectsOverlay: React.FC<EnemyEffectsOverlayProps> = ({
  activeReaction,
  reactionId = 0,
  mood,
  personality,
  animate = true,
}) => {
  const burstProgress = useSharedValue(0);
  const ambientPhase = useSharedValue(0);
  const ambientFreqHz = useSharedValue(0.7);

  const showAmbient = !activeReaction;
  const sleepyTarget = showAmbient && mood === 'sleepy' ? 1 : 0;
  const enragedTarget = showAmbient && (mood === 'enraged' || mood === 'victory') ? 1 : 0;
  const corneredTarget = showAmbient && mood === 'cornered' ? 1 : 0;

  const sleepyPresence = useSharedValue(sleepyTarget);
  const enragedPresence = useSharedValue(enragedTarget);
  const corneredPresence = useSharedValue(corneredTarget);

  useFrameCallback((frameInfo) => {
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);
    const desiredHz = mood === 'enraged' ? 1.65 : mood === 'sleepy' ? 0.42 : 0.95;
    ambientFreqHz.value = expApproach(ambientFreqHz.value, desiredHz, 8, dt);
    ambientPhase.value = advancePhase(ambientPhase.value, ambientFreqHz.value, dt);
  }, animate);

  useEffect(() => {
    if (!animate) {
      sleepyPresence.value = sleepyTarget;
      enragedPresence.value = enragedTarget;
      corneredPresence.value = corneredTarget;
      return;
    }
    const cfg = { duration: 220, easing: Easing.inOut(Easing.quad) };
    sleepyPresence.value = withTiming(sleepyTarget, cfg);
    enragedPresence.value = withTiming(enragedTarget, cfg);
    corneredPresence.value = withTiming(corneredTarget, cfg);
  }, [
    sleepyTarget,
    enragedTarget,
    corneredTarget,
    animate,
    sleepyPresence,
    enragedPresence,
    corneredPresence,
  ]);

  useEffect(() => {
    if (!activeReaction) {
      burstProgress.value = 0;
      return;
    }
    if (!animate) {
      burstProgress.value = 0.5;
      return;
    }
    burstProgress.value = 0;
    burstProgress.value = withTiming(1, {
      duration: 680,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeReaction, reactionId, animate, burstProgress]);

  const burstStyle = useAnimatedStyle(() => {
    const p = burstProgress.value;
    const popScale = interpolate(p, [0, 0.24, 0.65, 1], [0.4, 1.14, 1.03, 0.96]);
    return {
      opacity: interpolate(p, [0, 0.14, 0.72, 1], [0, 1, 0.9, 0]),
      transform: [
        { translateY: interpolate(p, [0, 0.4, 1], [3, -6, -12]) },
        { scale: popScale },
      ],
    };
  });

  const sleepyStyle = useAnimatedStyle(() => {
    const s = Math.sin(ambientPhase.value);
    const c = Math.cos(ambientPhase.value);
    return {
      opacity: sleepyPresence.value * (0.72 + 0.24 * ((s + 1) * 0.5)),
      transform: [
        { translateY: -4.5 * ((s + 1) * 0.5) },
        { translateX: c * 2.4 },
      ],
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
    const s = Math.sin(ambientPhase.value * 2.2);
    return {
      opacity: corneredPresence.value * 0.85,
      transform: [{ translateX: s * 1.4 }],
    };
  });

  const renderBurst = () => {
    if (!activeReaction) return null;

    switch (activeReaction) {
      case 'pain':
        return (
          <G testID="enemy-fx-pain">
            <ImpactStar cx={76} cy={22} r={11} fill={COLORS.actionYellow} />
            <ImpactStar cx={22} cy={30} r={7.5} fill={COLORS.impactOrange} />
            <Line x1={12} y1={18} x2={22} y2={24} stroke={COLORS.impactRed} strokeWidth={2.8} strokeLinecap="round" />
            <Line x1={88} y1={14} x2={78} y2={20} stroke={COLORS.impactRed} strokeWidth={2.8} strokeLinecap="round" />
          </G>
        );

      case 'crit_pain':
        return (
          <G testID="enemy-fx-crit_pain">
            <Circle
              cx={50}
              cy={50}
              r={43}
              fill="none"
              stroke="#9333EA"
              strokeWidth={3.2}
              strokeDasharray="6 4"
            />
            <ImpactStar cx={78} cy={18} r={13} fill={COLORS.actionYellow} />
            <ImpactStar cx={20} cy={20} r={10} fill="#EC4899" />
            <ImpactStar cx={82} cy={72} r={8.5} fill={COLORS.logicTeal} />
          </G>
        );

      case 'taunt':
        return (
          <G testID="enemy-fx-taunt">
            {/* Sinister cackle lightning sparks */}
            <Path
              d="M 16 14 L 23 22 L 18 24 L 25 32"
              stroke={personality.auraColor}
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d="M 84 14 L 77 22 L 82 24 L 75 32"
              stroke={COLORS.actionYellow}
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <SvgText x={74} y={16} fontSize={12} fontWeight="900" fill={COLORS.impactRed} stroke={STROKE} strokeWidth={0.5}>
              HA!
            </SvgText>
          </G>
        );

      case 'attack':
      case 'rage_spin':
        return (
          <G testID={`enemy-fx-${activeReaction}`}>
            {/* Triple crimson claw-slash arcs */}
            <Path d="M 18 22 Q 48 44 80 72" stroke={COLORS.impactRed} strokeWidth={3.6} strokeLinecap="round" fill="none" />
            <Path d="M 26 14 Q 54 36 86 62" stroke={COLORS.impactOrange} strokeWidth={3.2} strokeLinecap="round" fill="none" />
            <Path d="M 12 32 Q 42 54 72 80" stroke={COLORS.actionYellow} strokeWidth={2.8} strokeLinecap="round" fill="none" />
          </G>
        );

      case 'regen':
        return (
          <G testID="enemy-fx-regen">
            {[
              { x: 20, y: 26, s: 1 },
              { x: 80, y: 22, s: 0.9 },
              { x: 76, y: 42, s: 0.72 },
            ].map((p, idx) => (
              <G key={idx} transform={`translate(${p.x}, ${p.y}) scale(${p.s})`}>
                <Path
                  d="M -2 -6 H 2 V -2 H 6 V 2 H 2 V 6 H -2 V 2 H -6 V -2 H -2 Z"
                  fill={COLORS.logicTeal}
                  stroke={STROKE}
                  strokeWidth={1.5}
                />
              </G>
            ))}
          </G>
        );

      case 'poke':
        return (
          <G testID="enemy-fx-poke">
            <AngerVein cx={78} cy={20} scale={1.15} />
          </G>
        );

      case 'entrance':
        return (
          <G testID="enemy-fx-entrance">
            <Circle
              cx={50}
              cy={54}
              r={41}
              fill="none"
              stroke={personality.auraColor}
              strokeWidth={2.8}
              strokeDasharray="7 5"
            />
          </G>
        );
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Cross-fading Sleepy zZz */}
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

      {/* Cross-fading Cornered Panic Drops */}
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

      {/* Discrete Combat Reaction Burst */}
      {activeReaction && (
        <Animated.View style={[StyleSheet.absoluteFill, burstStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            {renderBurst()}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};
