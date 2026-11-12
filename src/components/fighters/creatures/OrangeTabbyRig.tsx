import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isHurtExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const TABBY_ORANGE = '#FF9538';
const TABBY_STRIPE = '#C2410C';
const TABBY_CREAM = '#FFF7ED';
const NOSE_PINK = '#FF7169';

export const OrangeTabbyRig: React.FC<CreatureRigProps> = ({
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
  const isHurt = isHurtExpression(expression);
  const isRuffled = healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <RigLayerStack>
      {/* 1. Striped Curling Tail (pivots at 70, 78) */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 68 80 C 84 79, 93 66, 89 50 C 87 42, 79 41, 78 48 C 77 54, 83 56, 83 63 C 83 70, 75 74, 67 75 Z"
          fill={TABBY_ORANGE}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Tail tiger rings */}
        <Path d="M 82 69 L 88 67" stroke={TABBY_STRIPE} strokeWidth={2.8} strokeLinecap="round" />
        <Path d="M 84 58 L 90 56" stroke={TABBY_STRIPE} strokeWidth={2.8} strokeLinecap="round" />
      </RigLayer>

      {/* 2. Plump Sitting Body + Teal Collar & Gold Bell */}
      <RigLayer>
        <Path
          d="M 31 58 C 25 69, 26 86, 36 89 L 64 89 C 74 86, 75 69, 69 58 Z"
          fill={TABBY_ORANGE}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Cream belly patch */}
        <Ellipse cx={50} cy={76} rx={12.5} ry={10.5} fill={TABBY_CREAM} />
        {/* Side tabby stripes */}
        <Path d="M 29 70 L 35 71 M 28 77 L 35 77" stroke={TABBY_STRIPE} strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M 71 70 L 65 71 M 72 77 L 65 77" stroke={TABBY_STRIPE} strokeWidth={2.6} strokeLinecap="round" />
        {/* Logic-Teal Collar */}
        <Path
          d="M 34 61 Q 50 67 66 61"
          stroke={COLORS.logicTeal}
          strokeWidth={5.2}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 34 61 Q 50 67 66 61"
          stroke={STROKE}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
        {/* Golden Jingle Bell */}
        <Circle cx={50} cy={66.5} r={4.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
        <Circle cx={50} cy={67.5} r={1.1} fill={STROKE} />
      </RigLayer>

      {/* 3. Left Ear (pivots at 33, 29) */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={
            isRuffled
              ? 'M 24 35 L 20 12 L 32 18 L 29 21 L 41 25 Z' // Battle-nicked ear when beat up!
              : 'M 24 35 L 20 12 L 41 25 Z'
          }
          fill={TABBY_ORANGE}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Polygon points="25,31 23,17 36,25" fill={NOSE_PINK} />
      </RigLayer>

      {/* 4. Right Ear (pivots at 67, 29) */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 76 35 L 80 12 L 59 25 Z"
          fill={TABBY_ORANGE}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Polygon points="75,31 77,17 64,25" fill={NOSE_PINK} />
      </RigLayer>

      {/* 5. Expressive Tabby Head & Whiskers (pivots at 50, 48) */}
      <RigLayer style={headStyle}>
        {/* Fluffy cheek silhouette */}
        <Path
          d={
            isRuffled
              ? 'M 24 44 C 24 27, 36 22, 50 22 C 64 22, 76 27, 76 44 L 79 47 L 75 50 C 73 59, 63 63, 50 63 C 37 63, 27 59, 25 50 L 21 47 Z'
              : 'M 24 45 C 24 27, 36 22, 50 22 C 64 22, 76 27, 76 45 C 77 56, 65 63, 50 63 C 35 63, 23 56, 24 45 Z'
          }
          fill={TABBY_ORANGE}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Forehead classic tabby 'M' stripes */}
        <Path
          d="M 43 24 L 45 31 M 50 23 L 50 32 M 57 24 L 55 31"
          stroke={TABBY_STRIPE}
          strokeWidth={2.8}
          strokeLinecap="round"
        />
        {/* Cream muzzle peanut */}
        <Ellipse cx={50} cy={52.5} rx={12.5} ry={7.5} fill={TABBY_CREAM} />

        {/* Side whiskers */}
        <G stroke={STROKE} strokeWidth={2.1} strokeLinecap="round">
          <Line x1={17} y1={46} x2={28} y2={48} />
          <Line x1={16} y1={52} x2={28} y2={52} />
          <Line x1={83} y1={46} x2={72} y2={48} />
          <Line x1={84} y1={52} x2={72} y2={52} />
        </G>

        {/* Eyes */}
        <CreatureEyes expression={expression} gazeOffset={gazeOffset} leftX={38.5} rightX={61.5} y={42.5} radius={4.6} />

        {/* Cute pink triangle nose */}
        <Polygon
          points="46.8,48.5 53.2,48.5 50,52.2"
          fill={NOSE_PINK}
          stroke={STROKE}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {/* Mouth */}
        {isCheering ? (
          // Big joyful 'meow!' open mouth
          <Path
            d="M 44.5 53 Q 50 61.5 55.5 53 Z"
            fill={NOSE_PINK}
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        ) : isHurt ? (
          // Wavy 'nyaa!' pain grimace
          <Path
            d="M 43.5 55.5 Q 46.8 52.5 50 55.5 Q 53.2 52.5 56.5 55.5"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        ) : expression === 'panic' ? (
          <Circle cx={50} cy={55.5} r={3} fill={NOSE_PINK} stroke={STROKE} strokeWidth={2} />
        ) : (
          // Classic ':3' cat smile!
          <Path
            d="M 43.8 53.8 Q 47 57.5 50 53.5 Q 53 57.5 56.2 53.8"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </RigLayer>

      {/* 6. Cream Front Paws (cheer up in the air on match!) */}
      <RigLayer style={pawStyle}>
        {isCheering ? (
          <G>
            {/* Raised cheering paws with pink toe-beans! */}
            <Ellipse cx={26} cy={60} rx={6.5} ry={5.5} fill={TABBY_CREAM} stroke={STROKE} strokeWidth={2.8} />
            <Circle cx={26} cy={60.5} r={2} fill={NOSE_PINK} />
            <Ellipse cx={74} cy={60} rx={6.5} ry={5.5} fill={TABBY_CREAM} stroke={STROKE} strokeWidth={2.8} />
            <Circle cx={74} cy={60.5} r={2} fill={NOSE_PINK} />
          </G>
        ) : (
          <G>
            {/* Neat sitting mittens */}
            <Ellipse cx={41} cy={87} rx={7} ry={4.6} fill={TABBY_CREAM} stroke={STROKE} strokeWidth={2.8} />
            <Ellipse cx={59} cy={87} rx={7} ry={4.6} fill={TABBY_CREAM} stroke={STROKE} strokeWidth={2.8} />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};
