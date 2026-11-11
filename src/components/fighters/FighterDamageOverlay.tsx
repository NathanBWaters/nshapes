import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Svg, Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { FighterHealthState } from '@/utils/fighterAnimations';

interface FighterDamageOverlayProps {
  healthState: FighterHealthState;
  headStyle?: StyleProp<ViewStyle>;
  animate?: boolean;
  testID?: string;
}

const STROKE = COLORS.slateCharcoal;

function MiniStar({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`);
  }
  return (
    <Polygon
      points={pts.join(' ')}
      fill={fill}
      stroke={STROKE}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

/**
 * Renders progressive cartoon battle-wear over the fighter rig:
 * - pristine: none
 * - scuffed: cheek band-aid + minor fur/feather scuff marks
 * - battered: + brow X-plaster + temple sweat drop + heavier torso scuffs
 * - critical: + wrapped white gauze forehead bandage + dripping sweat
 * - knocked_out: + orbiting dizzy KO stars above head
 */
export const FighterDamageOverlay: React.FC<FighterDamageOverlayProps> = ({
  healthState,
  headStyle,
  animate = true,
  testID,
}) => {
  const dizzyPhase = useSharedValue(0);
  const sweatBob = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(dizzyPhase);
      cancelAnimation(sweatBob);
      dizzyPhase.value = 0;
      sweatBob.value = 0;
      return;
    }

    if (healthState === 'knocked_out') {
      dizzyPhase.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: 900, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(dizzyPhase);
      dizzyPhase.value = 0;
    }

    if (healthState === 'critical' || healthState === 'battered') {
      sweatBob.value = withRepeat(
        withSequence(
          withTiming(2.5, { duration: 650, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(sweatBob);
      sweatBob.value = 0;
    }

    return () => {
      cancelAnimation(dizzyPhase);
      cancelAnimation(sweatBob);
    };
  }, [animate, healthState, dizzyPhase, sweatBob]);

  const dizzyStarsStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dizzyPhase.value * 4 },
      { rotate: `${dizzyPhase.value * 8}deg` },
    ],
  }));

  const sweatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweatBob.value }],
  }));

  if (healthState === 'pristine') {
    return null;
  }

  const showScuffed = true; // All non-pristine states have at least scuffed wear
  const showBattered =
    healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';
  const showCritical = healthState === 'critical' || healthState === 'knocked_out';
  const showKO = healthState === 'knocked_out';

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      testID={testID ?? `fighter-damage-${healthState}`}
    >
      {/* Torso scuff scratches */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {showScuffed && (
            <G stroke={STROKE} strokeWidth={2} strokeLinecap="round" opacity={0.75}>
              <Line x1={33} y1={72} x2={38} y2={70} />
              <Line x1={34} y1={75.5} x2={39} y2={73.5} />
            </G>
          )}
          {showBattered && (
            <G stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" opacity={0.82}>
              <Line x1={61} y1={74} x2={66} y2={76} />
              <Line x1={60} y1={77.5} x2={65} y2={79.5} />
              <Path d="M 46 81 L 49 79 L 52 81.5" fill="none" />
            </G>
          )}
        </Svg>
      </View>

      {/* Head-mounted Band-Aids, X-Plasters & Critical Gauze Headband (moves with headStyle!) */}
      <Animated.View style={[StyleSheet.absoluteFill, headStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* 1. Scuffed: Cheek Band-Aid on left cheek */}
          {showScuffed && (
            <G transform="rotate(-18, 29, 51)">
              <Rect
                x={21.5}
                y={48}
                width={15}
                height={6.2}
                rx={3}
                fill="#FDE68A"
                stroke={STROKE}
                strokeWidth={1.8}
              />
              <Rect
                x={26.5}
                y={48.5}
                width={5}
                height={5.2}
                rx={1}
                fill="#F59E0B"
                opacity={0.55}
              />
            </G>
          )}

          {/* 2. Battered: Crossed X-Plaster on upper-right brow */}
          {showBattered && !showCritical && (
            <G transform="translate(64, 30)">
              <G transform="rotate(42)">
                <Rect x={-7} y={-2.5} width={14} height={5} rx={2.2} fill="#FEF3C7" stroke={STROKE} strokeWidth={1.7} />
              </G>
              <G transform="rotate(-42)">
                <Rect x={-7} y={-2.5} width={14} height={5} rx={2.2} fill="#FEF3C7" stroke={STROKE} strokeWidth={1.7} />
              </G>
            </G>
          )}

          {/* 3. Critical / KO: Wrapped White Medical Gauze Forehead Bandage! */}
          {showCritical && (
            <G>
              <Path
                d="M 24 31 Q 50 23 76 31 L 75 38 Q 50 31 25 38 Z"
                fill="#FFFFFF"
                stroke={STROKE}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              {/* Gauze wrap fold lines */}
              <Line x1={36} y1={28.5} x2={41} y2={35} stroke="#CBD5E1" strokeWidth={1.8} strokeLinecap="round" />
              <Line x1={58} y1={28.5} x2={53} y2={35} stroke="#CBD5E1" strokeWidth={1.8} strokeLinecap="round" />
              {/* Coral med-cross pin on forehead bandage */}
              <Line x1={65} y1={30.5} x2={65} y2={35.5} stroke="#FF7169" strokeWidth={2.2} strokeLinecap="round" />
              <Line x1={62.5} y1={33} x2={67.5} y2={33} stroke="#FF7169" strokeWidth={2.2} strokeLinecap="round" />
            </G>
          )}
        </Svg>
      </Animated.View>

      {/* Dripping Temple Sweat Drop for Battered / Critical */}
      {(healthState === 'battered' || healthState === 'critical') && (
        <Animated.View style={[StyleSheet.absoluteFill, headStyle, sweatStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Path
              d="M 79 35 C 79 35, 83.5 41, 83.5 43.8 A 4.5 4.5 0 1 1 74.5 43.8 C 74.5 41, 79 35, 79 35 Z"
              fill="#38BDF8"
              stroke={STROKE}
              strokeWidth={1.8}
            />
            <Circle cx={77.8} cy={43.5} r={1.1} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      )}

      {/* 4. Knocked Out: Orbiting Cartoon Dizzy Halo & Stars! */}
      {showKO && (
        <Animated.View style={[StyleSheet.absoluteFill, dizzyStarsStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Ellipse
              cx={50}
              cy={13}
              rx={24}
              ry={6.5}
              fill="none"
              stroke={COLORS.actionYellow}
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            <MiniStar cx={26} cy={13} r={5.5} fill={COLORS.actionYellow} />
            <MiniStar cx={50} cy={7.5} r={6.5} fill="#FF9538" />
            <MiniStar cx={74} cy={13} r={5.5} fill={COLORS.actionYellow} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};
