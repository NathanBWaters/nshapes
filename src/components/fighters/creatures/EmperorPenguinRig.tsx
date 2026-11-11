import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Svg, Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const STROKE = COLORS.slateCharcoal;
const TUX_NAVY = '#1E293B';
const EMPEROR_GOLD = '#FBBF24';
const BEAK_ORANGE = '#FF9538';

export const EmperorPenguinRig: React.FC<CreatureRigProps> = ({
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
  const isOpenBeak = isCheering || expression === 'panic' || expression === 'wince';
  const crownTilted = healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. Mystic Oracle Halo Ring behind head (uses tailStyle, pivots at 50, 36) */}
      <Animated.View style={[StyleSheet.absoluteFill, tailStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle
            cx={50}
            cy={36}
            r={27}
            fill="none"
            stroke={COLORS.logicTeal}
            strokeWidth={2}
            strokeDasharray="6 5"
            opacity={healthState === 'knocked_out' ? 0.2 : 0.65}
          />
          <Polygon points="50,6 52.5,10 50,14 47.5,10" fill={COLORS.logicTeal} opacity={0.8} />
        </Svg>
      </Animated.View>

      {/* 2. Left Flipper (uses leftEarStyle, pivots at shoulder 24, 54) */}
      <Animated.View style={[StyleSheet.absoluteFill, leftEarStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path
            d={
              isCheering
                ? 'M 27 54 C 15 44, 9 30, 14 25 C 19 21, 27 36, 30 49 Z'
                : 'M 26 51 C 14 58, 12 74, 18 77 C 23 79, 28 67, 29 57 Z'
            }
            fill={TUX_NAVY}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      {/* 3. Right Flipper (uses rightEarStyle, pivots at shoulder 76, 54) */}
      <Animated.View style={[StyleSheet.absoluteFill, rightEarStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path
            d={
              isCheering
                ? 'M 73 54 C 85 44, 91 30, 86 25 C 81 21, 73 36, 70 49 Z'
                : 'M 74 51 C 86 58, 88 74, 82 77 C 77 79, 72 67, 71 57 Z'
            }
            fill={TUX_NAVY}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      {/* 4. Regal Tuxedo Body + Amber Emperor Bib */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path
            d="M 27 49 C 22 66, 25 86, 38 89 L 62 89 C 75 86, 78 66, 73 49 Z"
            fill={TUX_NAVY}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Snow-white belly */}
          <Ellipse cx={50} cy={70} rx={16.5} ry={17} fill="#FFFFFF" />
          {/* Warm Emperor golden-amber upper chest glow */}
          <Path
            d="M 35.5 62 C 37 52, 63 52, 64.5 62 C 60 67, 40 67, 35.5 62 Z"
            fill={EMPEROR_GOLD}
            opacity={0.85}
          />
          {/* Mystic Crystal Orb Collar Gem */}
          <Polygon
            points="50,54 54,58.5 50,63 46,58.5"
            fill={COLORS.logicTeal}
            stroke={STROKE}
            strokeWidth={2}
          />
        </Svg>
      </View>

      {/* 5. Royal Head, Golden Crown & Beak (pivots at 50, 39) */}
      <Animated.View style={[StyleSheet.absoluteFill, headStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Sleek Penguin Hood */}
          <Ellipse
            cx={50}
            cy={38}
            rx={21.5}
            ry={17.5}
            fill={TUX_NAVY}
            stroke={STROKE}
            strokeWidth={3.3}
          />
          {/* White facial heart-mask patches */}
          <Circle cx={39.5} cy={39.5} r={8.2} fill="#FFFFFF" />
          <Circle cx={60.5} cy={39.5} r={8.2} fill="#FFFFFF" />
          {/* Emperor golden ear-cheek crescents */}
          <Circle cx={32} cy={43} r={3.6} fill={EMPEROR_GOLD} />
          <Circle cx={68} cy={43} r={3.6} fill={EMPEROR_GOLD} />

          {/* Golden Royal Crown (tilts comically askew when beat up!) */}
          <G transform={crownTilted ? 'rotate(14, 54, 20)' : undefined}>
            <Polygon
              points="37,23 39,12 45,18 50,9 55,18 61,12 63,23"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
            <Circle cx={50} cy={17.5} r={2.2} fill={COLORS.logicTeal} />
          </G>

          {/* Eyes */}
          <CreatureEyes expression={expression} gazeOffset={gazeOffset} leftX={39.5} rightX={60.5} y={39} radius={4.3} />

          {/* Golden-Orange Diamond Beak */}
          {isOpenBeak ? (
            <G>
              {/* Open trumpeting beak! */}
              <Polygon
                points="43,45 57,45 50,40.5"
                fill={COLORS.actionYellow}
                stroke={STROKE}
                strokeWidth={2.3}
                strokeLinejoin="round"
              />
              <Polygon
                points="44,46 56,46 50,53.5"
                fill="#FF7169"
                stroke={STROKE}
                strokeWidth={2.3}
                strokeLinejoin="round"
              />
            </G>
          ) : (
            <Polygon
              points="43,45.5 50,41.5 57,45.5 50,50.5"
              fill={BEAK_ORANGE}
              stroke={STROKE}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
          )}
        </Svg>
      </Animated.View>

      {/* 6. Webbed Orange Feet */}
      <Animated.View style={[StyleSheet.absoluteFill, pawStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Ellipse cx={39} cy={89} rx={8} ry={4.2} fill={BEAK_ORANGE} stroke={STROKE} strokeWidth={2.8} />
          <Ellipse cx={61} cy={89} rx={8} ry={4.2} fill={BEAK_ORANGE} stroke={STROKE} strokeWidth={2.8} />
        </Svg>
      </Animated.View>
    </View>
  );
};
