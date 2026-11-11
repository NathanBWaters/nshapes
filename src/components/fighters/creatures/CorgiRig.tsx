import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Svg, Circle, Ellipse, G, Path } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const STROKE = COLORS.slateCharcoal;
const CORGI_FAWN = '#F59E0B';
const CORGI_CREAM = '#FFFFFF';
const TONGUE_PINK = '#FF7169';

export const CorgiRig: React.FC<CreatureRigProps> = ({
  expression,
  healthState,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isCheering = expression === 'happy' || expression === 'starry';
  const isDroopyEars = expression === 'sad' || expression === 'wince' || expression === 'ko';
  const showTongue =
    expression === 'normal' ||
    expression === 'happy' ||
    expression === 'starry' ||
    expression === 'eager' ||
    expression === 'blush' ||
    expression === 'relieved';
  const isScruffy = healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. Hyper-Speed Fluffy Corgi Loaf Nub-Tail (pivots at 73, 75) */}
      <Animated.View style={[StyleSheet.absoluteFill, tailStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle
            cx={78}
            cy={74}
            r={8.5}
            fill={CORGI_FAWN}
            stroke={STROKE}
            strokeWidth={3.1}
          />
          <Circle cx={80} cy={72} r={4.2} fill={CORGI_CREAM} />
        </Svg>
      </Animated.View>

      {/* 2. Sturdy Loaf Body + Ultra-Fluffy Scalloped Chest Ruff */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path
            d="M 29 58 C 23 68, 24 85, 34 89 L 66 89 C 76 85, 77 68, 71 58 Z"
            fill={CORGI_FAWN}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Fluffy white royal chest floof */}
          <Path
            d="M 35 60 C 31 67, 33 78, 41 81 C 45 84, 55 84, 59 81 C 67 78, 69 67, 65 60 Z"
            fill={CORGI_CREAM}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {/* Teal bone/tag collar */}
          <Path
            d="M 35 60 Q 50 65 65 60"
            stroke={COLORS.logicTeal}
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>

      {/* 3. Giant Rounded Corgi Left Radar Ear (pivots at 30, 30) */}
      <Animated.View style={[StyleSheet.absoluteFill, leftEarStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path
            d={
              isDroopyEars
                ? 'M 28 33 C 12 31, 6 41, 13 48 C 19 52, 27 45, 34 37 Z' // Airplane droopy ear!
                : 'M 23 36 C 14 21, 16 7, 25 8 C 33 9, 39 20, 41 27 Z'
            }
            fill={CORGI_FAWN}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {!isDroopyEars && (
            <Path
              d="M 25 32 C 20 22, 21 13, 26 14 C 31 15, 35 22, 36 27 Z"
              fill={TONGUE_PINK}
              opacity={0.85}
            />
          )}
        </Svg>
      </Animated.View>

      {/* 4. Giant Rounded Corgi Right Radar Ear (pivots at 70, 30) */}
      <Animated.View style={[StyleSheet.absoluteFill, rightEarStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path
            d={
              isDroopyEars
                ? 'M 72 33 C 88 31, 94 41, 87 48 C 81 52, 73 45, 66 37 Z'
                : 'M 77 36 C 86 21, 84 7, 75 8 C 67 9, 61 20, 59 27 Z'
            }
            fill={CORGI_FAWN}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {!isDroopyEars && (
            <Path
              d="M 75 32 C 80 22, 79 13, 74 14 C 69 15, 65 22, 64 27 Z"
              fill={TONGUE_PINK}
              opacity={0.85}
            />
          )}
        </Svg>
      </Animated.View>

      {/* 5. Sunny Corgi Head, Forehead Blaze & Happy Panting Tongue (pivots at 50, 47) */}
      <Animated.View style={[StyleSheet.absoluteFill, headStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path
            d={
              isScruffy
                ? 'M 24 45 C 24 27, 35 22, 50 22 C 65 22, 76 27, 76 45 L 79 49 L 75 53 C 72 60, 62 63, 50 63 C 38 63, 28 60, 25 53 L 21 49 Z'
                : 'M 24 46 C 24 27, 35 22, 50 22 C 65 22, 76 27, 76 46 C 76 57, 65 63, 50 63 C 35 63, 24 57, 24 46 Z'
            }
            fill={CORGI_FAWN}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Iconic white Corgi forehead blaze + snout */}
          <Path
            d="M 50 24 C 53 30, 54 38, 57 45 C 63 47, 64 58, 50 60 C 36 58, 37 47, 43 45 C 46 38, 47 30, 50 24 Z"
            fill={CORGI_CREAM}
          />
          {/* Expressive cream eyebrow pips */}
          <Ellipse cx={38} cy={35} rx={3.2} ry={2} fill="#FEF3C7" />
          <Ellipse cx={62} cy={35} rx={3.2} ry={2} fill="#FEF3C7" />

          {/* Eyes */}
          <CreatureEyes expression={expression} gazeOffset={gazeOffset} leftX={37.5} rightX={62.5} y={42.5} radius={4.7} />

          {/* Shiny oval dog nose */}
          <Ellipse cx={50} cy={49} rx={4.6} ry={3.3} fill={STROKE} />
          <Ellipse cx={48.6} cy={48} rx={1.4} ry={0.9} fill="#FFFFFF" />

          {/* Happy Pink Panting Tongue or Grimace */}
          {showTongue ? (
            <G>
              {/* Happy 'W' doggy smile */}
              <Path
                d="M 42.5 53.5 Q 46.5 57.5 50 53.5 Q 53.5 57.5 57.5 53.5"
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
              {/* Little pink tongue lolling out! */}
              <Path
                d={
                  isCheering
                    ? 'M 46 55 C 46 64, 54 64, 54 55 Z'
                    : 'M 46.8 55 C 46.8 61.5, 53.2 61.5, 53.2 55 Z'
                }
                fill={TONGUE_PINK}
                stroke={STROKE}
                strokeWidth={2}
              />
              <Path d="M 50 55.5 L 50 59.5" stroke={STROKE} strokeWidth={1.3} strokeLinecap="round" />
            </G>
          ) : expression === 'wince' || expression === 'ko' ? (
            <Path
              d="M 43 56 Q 46.5 53 50 56 Q 53.5 53 57 56"
              stroke={STROKE}
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <Path
              d="M 44 55.5 Q 50 53 56 55.5"
              stroke={STROKE}
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>
      </Animated.View>

      {/* 6. Stubby White-Socked Corgi Tippy-Tap Paws */}
      <Animated.View style={[StyleSheet.absoluteFill, pawStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {isCheering ? (
            <G>
              {/* Zoomie leap front paws! */}
              <Ellipse cx={27} cy={63} rx={6.8} ry={5.2} fill={CORGI_CREAM} stroke={STROKE} strokeWidth={2.8} />
              <Ellipse cx={73} cy={63} rx={6.8} ry={5.2} fill={CORGI_CREAM} stroke={STROKE} strokeWidth={2.8} />
            </G>
          ) : (
            <G>
              <Ellipse cx={39} cy={87.5} rx={7.2} ry={4.6} fill={CORGI_CREAM} stroke={STROKE} strokeWidth={2.8} />
              <Ellipse cx={61} cy={87.5} rx={7.2} ry={4.6} fill={CORGI_CREAM} stroke={STROKE} strokeWidth={2.8} />
            </G>
          )}
        </Svg>
      </Animated.View>
    </View>
  );
};
