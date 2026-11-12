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
  FIGHTER_REACTION_HOLD_MS,
  FighterAmbientMood,
  FighterPersonalityProfile,
  FighterReactionType,
} from '@/utils/fighterAnimations';
import { advancePhase, expApproach } from '@/utils/proceduralMotion';

interface FighterEffectsOverlayProps {
  activeReaction: FighterReactionType | null;
  reactionId?: number;
  mood: FighterAmbientMood;
  personality: FighterPersonalityProfile;
  animate?: boolean;
}

const STROKE = COLORS.slateCharcoal;

function Sparkle4({
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
  return (
    <Path
      d={`M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z`}
      fill={fill}
      stroke={STROKE}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

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

/**
 * Renders creature-specific particle bursts, emotional comic symbols (💢, Phew drop,
 * zZz, lightbulb gleam, healing crosses, affection hearts), and streak sparkles.
 *
 * Uses continuous phase integration (`useFrameCallback`) and smooth cross-fade presence
 * envelopes so ambient indicators glide in/out without popping when moods transition.
 */
export const FighterEffectsOverlay: React.FC<FighterEffectsOverlayProps> = ({
  activeReaction,
  reactionId = 0,
  mood,
  personality,
  animate = true,
}) => {
  const burstProgress = useSharedValue(0);
  const ambientPhase = useSharedValue(0);
  const ambientFreqHz = useSharedValue(0.6);

  const showAmbient = !activeReaction;
  const sleepyTarget = showAmbient && mood === 'sleepy' ? 1 : 0;
  const urgentTarget = showAmbient && mood === 'urgent' ? 1 : 0;
  const streakTarget = showAmbient && (mood === 'streak' || mood === 'victory') ? 1 : 0;

  const sleepyPresence = useSharedValue(sleepyTarget);
  const urgentPresence = useSharedValue(urgentTarget);
  const streakPresence = useSharedValue(streakTarget);

  useFrameCallback((frameInfo) => {
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);
    const desiredHz = mood === 'urgent' ? 1.55 : mood === 'sleepy' ? 0.42 : 0.78;
    ambientFreqHz.value = expApproach(ambientFreqHz.value, desiredHz, 8, dt);
    ambientPhase.value = advancePhase(ambientPhase.value, ambientFreqHz.value, dt);
  }, animate);

  useEffect(() => {
    if (!animate) {
      sleepyPresence.value = sleepyTarget;
      urgentPresence.value = urgentTarget;
      streakPresence.value = streakTarget;
      return;
    }
    const cfg = { duration: 240, easing: Easing.inOut(Easing.quad) };
    sleepyPresence.value = withTiming(sleepyTarget, cfg);
    urgentPresence.value = withTiming(urgentTarget, cfg);
    streakPresence.value = withTiming(streakTarget, cfg);
  }, [
    animate,
    sleepyTarget,
    urgentTarget,
    streakTarget,
    sleepyPresence,
    urgentPresence,
    streakPresence,
  ]);

  useEffect(() => {
    if (!animate || !activeReaction) {
      burstProgress.value = activeReaction ? 0.55 : 0;
      return;
    }
    burstProgress.value = 0;
    burstProgress.value = withTiming(1, {
      duration: FIGHTER_REACTION_HOLD_MS[activeReaction] ?? 850,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeReaction, reactionId, animate, burstProgress, personality]);

  // Curved arc + overshoot pop-and-settle for one-shot reaction particles
  const burstStyle = useAnimatedStyle(() => {
    const p = burstProgress.value;
    const opacity = interpolate(p, [0, 0.12, 0.78, 1], [0, 1, 1, 0]);
    const scale = interpolate(p, [0, 0.24, 0.52, 1], [0.52, 1.12, 1.03, 1.14]);
    const translateY = interpolate(p, [0, 0.35, 1], [5, -3.5, -7.5]);
    const translateX = Math.sin(p * Math.PI) * 1.5;
    return {
      opacity,
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  // S-curve rising float for sleepy zZz
  const sleepyStyle = useAnimatedStyle(() => {
    const s = Math.sin(ambientPhase.value);
    const c = Math.cos(ambientPhase.value);
    return {
      opacity: sleepyPresence.value * (0.78 + 0.22 * ((s + 1) / 2)),
      transform: [
        { translateX: s * 2.2 },
        { translateY: c * 2.8 - 1 },
        { scale: 0.92 + 0.08 * sleepyPresence.value },
      ],
    };
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

  const renderSignatureJoyMotif = (isMega: boolean) => {
    switch (personality.signatureMotif) {
      case 'hearts':
        return (
          <G>
            <HeartShape cx={17} cy={22} scale={0.95} fill="#FF7169" />
            <HeartShape cx={83} cy={20} scale={0.85} fill="#FF9538" />
            {isMega && <Sparkle4 cx={50} cy={8} r={7.5} fill={COLORS.actionYellow} />}
          </G>
        );
      case 'embers':
        return (
          <G>
            <Path
              d="M 16 27 C 12 21, 16 13, 19 10 C 21 15, 24 20, 20 27 Z"
              fill="#FF6B00"
              stroke={STROKE}
              strokeWidth={1.7}
            />
            <Path
              d="M 83 25 C 80 19, 83 12, 86 9 C 88 14, 90 19, 87 25 Z"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={1.7}
            />
            {isMega && <Sparkle4 cx={50} cy={8} r={8} fill="#FF6B00" />}
          </G>
        );
      case 'frost':
        return (
          <G>
            <Polygon points="16,12 21,19 16,26 11,19" fill={COLORS.logicTeal} stroke={STROKE} strokeWidth={1.7} />
            <Polygon points="84,12 89,19 84,26 79,19" fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.7} />
            {isMega && <Sparkle4 cx={50} cy={7} r={7.5} fill={COLORS.logicTeal} />}
          </G>
        );
      case 'splash':
        return (
          <G>
            <Path
              d="M 16 14 C 16 14, 21 21, 21 24 A 5 5 0 1 1 11 24 C 11 21, 16 14, 16 14 Z"
              fill={COLORS.logicTeal}
              stroke={STROKE}
              strokeWidth={1.7}
            />
            <Sparkle4 cx={84} cy={18} r={7.5} fill={COLORS.actionYellow} />
            {isMega && <Sparkle4 cx={50} cy={8} r={8} fill="#FF9538" />}
          </G>
        );
      case 'shockwave':
        return (
          <G>
            <Sparkle4 cx={16} cy={20} r={7.5} fill={COLORS.actionYellow} />
            <Sparkle4 cx={84} cy={20} r={7.5} fill={COLORS.logicTeal} />
            {isMega && (
              <Circle
                cx={50}
                cy={50}
                r={44}
                fill="none"
                stroke={COLORS.actionYellow}
                strokeWidth={2.8}
                strokeDasharray="8 6"
              />
            )}
          </G>
        );
      case 'stars':
      default:
        return (
          <G>
            <Sparkle4 cx={16} cy={20} r={8} fill={COLORS.actionYellow} />
            <Sparkle4 cx={84} cy={18} r={7} fill="#FF9538" />
            {isMega && <HeartShape cx={50} cy={10} scale={0.9} fill="#FF7169" />}
          </G>
        );
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Cross-fading Sleepy zZz Overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, sleepyStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <G>
            <SvgText x={70} y={28} fontSize={11} fontWeight="800" fill={STROKE}>
              z
            </SvgText>
            <SvgText x={78} y={19} fontSize={14} fontWeight="800" fill={COLORS.logicTeal}>
              Z
            </SvgText>
            <SvgText x={87} y={10} fontSize={11} fontWeight="800" fill={STROKE}>
              z
            </SvgText>
          </G>
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

      {/* Discrete One-Shot Reaction FX */}
      {activeReaction && (
        <Animated.View
          style={[StyleSheet.absoluteFill, burstStyle]}
          testID={`fighter-fx-${activeReaction}`}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            {(activeReaction === 'joy' || activeReaction === 'ecstatic') &&
              renderSignatureJoyMotif(activeReaction === 'ecstatic')}

            {activeReaction === 'pain' && (
              <G>
                <Path
                  d="M 74 14 Q 78 19 74 24 M 84 14 Q 80 19 84 24 M 74 14 Q 79 18 84 14 M 74 24 Q 79 20 84 24"
                  stroke={COLORS.impactRed}
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  fill="none"
                />
                <Line x1={14} y1={22} x2={22} y2={27} stroke={COLORS.impactRed} strokeWidth={3} strokeLinecap="round" />
                <Line x1={12} y1={31} x2={21} y2={32} stroke={COLORS.impactOrange} strokeWidth={2.8} strokeLinecap="round" />
              </G>
            )}

            {activeReaction === 'relief' && (
              <G>
                <Path
                  d="M 82 16 C 82 16, 88 24, 88 28 A 6 6 0 1 1 76 28 C 76 24, 82 16, 82 16 Z"
                  fill="#38BDF8"
                  stroke={STROKE}
                  strokeWidth={2}
                />
                <Circle cx={80.2} cy={27.5} r={1.5} fill="#FFFFFF" />
                <Sparkle4 cx={18} cy={20} r={7.5} fill={COLORS.logicTeal} />
              </G>
            )}

            {activeReaction === 'heal' && (
              <G>
                <G stroke={COLORS.logicTeal} strokeWidth={3.4} strokeLinecap="round">
                  <Line x1={18} y1={16} x2={18} y2={26} />
                  <Line x1={13} y1={21} x2={23} y2={21} />
                </G>
                <HeartShape cx={82} cy={21} scale={0.9} fill="#FF7169" />
                <G stroke={COLORS.logicTeal} strokeWidth={2.8} strokeLinecap="round">
                  <Line x1={76} y1={9} x2={76} y2={15} />
                  <Line x1={73} y1={12} x2={79} y2={12} />
                </G>
              </G>
            )}

            {activeReaction === 'powerup' && (
              <G>
                <Circle
                  cx={50}
                  cy={50}
                  r={44}
                  fill="none"
                  stroke={COLORS.actionYellow}
                  strokeWidth={3}
                  strokeDasharray="10 5"
                />
                <Sparkle4 cx={17} cy={17} r={7.5} fill={COLORS.actionYellow} />
                <Sparkle4 cx={83} cy={17} r={7.5} fill={COLORS.logicTeal} />
              </G>
            )}

            {activeReaction === 'hint' && (
              <G>
                <Sparkle4 cx={50} cy={9} r={8} fill={COLORS.actionYellow} />
                <Line x1={37} y1={8} x2={40} y2={10} stroke={COLORS.actionYellow} strokeWidth={2.4} strokeLinecap="round" />
                <Line x1={63} y1={8} x2={60} y2={10} stroke={COLORS.actionYellow} strokeWidth={2.4} strokeLinecap="round" />
              </G>
            )}

            {activeReaction === 'pet' && (
              <G>
                <HeartShape cx={50} cy={11} scale={1.05} fill="#FF7169" />
                <Sparkle4 cx={20} cy={24} r={5.5} fill={COLORS.actionYellow} />
              </G>
            )}

            {activeReaction === 'dizzy_joy' && (
              <G>
                <HeartShape cx={20} cy={18} scale={0.95} fill="#FF7169" />
                <Sparkle4 cx={50} cy={8} r={8.5} fill={COLORS.actionYellow} />
                <HeartShape cx={80} cy={18} scale={0.95} fill={COLORS.logicTeal} />
              </G>
            )}

            {activeReaction === 'entrance' && (
              <G>
                <Sparkle4 cx={82} cy={18} r={7} fill={COLORS.actionYellow} />
              </G>
            )}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};
