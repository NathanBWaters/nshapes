import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isHurtExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const BADGER_CHARCOAL = '#334155';
const BADGER_ASH = '#64748B';
const STRIPE_WHITE = '#FFFFFF';

export const BadgerRig: React.FC<CreatureRigProps> = ({
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
  const isBrawlerGrit =
    healthState === 'scuffed' || healthState === 'battered' || healthState === 'critical';

  return (
    <RigLayerStack>
      {/* 1. Stubby White-Tipped Badger Tail (pivots at 73, 77) */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 69 78 C 80 78, 87 71, 85 63 C 83 58, 76 61, 71 71 Z"
          fill={BADGER_ASH}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Circle cx={83} cy={65} r={3.5} fill={STRIPE_WHITE} />
      </RigLayer>

      {/* 2. Stocky Wide-Shouldered Brawler Torso */}
      <RigLayer>
        <Path
          d="M 26 56 C 20 68, 22 86, 33 89 L 67 89 C 78 86, 80 68, 74 56 Z"
          fill={BADGER_CHARCOAL}
          stroke={STROKE}
          strokeWidth={3.4}
          strokeLinejoin="round"
        />
        {/* Ash-grey brawler belly */}
        <Ellipse cx={50} cy={76} rx={16} ry={11} fill={BADGER_ASH} />
        {/* Champion gold belt buckle accent */}
        <Path d="M 30 80 Q 50 84 70 80" stroke={STROKE} strokeWidth={4} fill="none" />
        <Polygon
          points="46,79 54,79 53,85 47,85"
          fill={COLORS.actionYellow}
          stroke={STROKE}
          strokeWidth={1.8}
        />
      </RigLayer>

      {/* 3. Low White-Rimmed Left Badger Ear (pivots at 29, 29) */}
      <RigLayer style={leftEarStyle}>
        <Circle cx={27} cy={25} r={8.5} fill={STRIPE_WHITE} stroke={STROKE} strokeWidth={3.2} />
        <Circle cx={27} cy={25.5} r={4.5} fill={BADGER_CHARCOAL} />
      </RigLayer>

      {/* 4. Low White-Rimmed Right Badger Ear (pivots at 71, 29) */}
      <RigLayer style={rightEarStyle}>
        <Circle cx={73} cy={25} r={8.5} fill={STRIPE_WHITE} stroke={STROKE} strokeWidth={3.2} />
        <Circle cx={73} cy={25.5} r={4.5} fill={BADGER_CHARCOAL} />
      </RigLayer>

      {/* 5. Broad Wedge Head with Iconic Black & White War-Stripes (pivots at 50, 48) */}
      <RigLayer style={headStyle}>
        {/* White outer wedge head */}
        <Path
          d="M 50 21 C 66 21, 78 30, 79 47 C 80 57, 68 63, 50 63 C 32 63, 20 57, 21 47 C 22 30, 34 21, 50 21 Z"
          fill={STRIPE_WHITE}
          stroke={STROKE}
          strokeWidth={3.4}
          strokeLinejoin="round"
        />
        {/* Bold twin dark war-stripes sweeping over the eyes! */}
        <Path
          d="M 38 22 C 31 28, 29 44, 33 56 L 44 54 C 43 42, 43 29, 45 22 Z"
          fill={STROKE}
        />
        <Path
          d="M 62 22 C 69 28, 71 44, 67 56 L 56 54 C 57 42, 57 29, 55 22 Z"
          fill={STROKE}
        />

        {/* Eyes (rendered with darkMask=true so crisp white arcs/scleras pop on the black war-stripes!) */}
        <CreatureEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38}
          rightX={62}
          y={42.5}
          radius={4.3}
          darkMask={true}
        />

        {/* Broad tough snout pad */}
        <Ellipse cx={50} cy={50.5} rx={5.2} ry={3.5} fill={STROKE} />
        <Circle cx={48.5} cy={49.5} r={1.1} fill={STRIPE_WHITE} />

        {/* Scrappy Brawler Mouth + Signature Underbite Fang! */}
        {isCheering ? (
          <G>
            <Path
              d="M 41 55 Q 50 63 59 55 Z"
              fill="#FF7169"
              stroke={STROKE}
              strokeWidth={2.3}
              strokeLinejoin="round"
            />
            <Polygon points="43,55.5 45.5,55.5 44.2,58.5" fill={STRIPE_WHITE} />
            <Polygon points="54.5,55.5 57,55.5 55.8,58.5" fill={STRIPE_WHITE} />
          </G>
        ) : isHurt ? (
          <Path
            d="M 42 57.5 L 46 55 L 50 57.5 L 54 55 L 58 57.5"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <G>
            {/* Tough determined smirk + little white underbite tusk! */}
            <Path
              d={isBrawlerGrit ? 'M 42 56.5 L 58 55.5' : 'M 42.5 56.5 Q 50 58 57.5 55'}
              stroke={STROKE}
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
            />
            <Polygon
              points="53.5,56 57,55.6 55.3,51.8"
              fill={STRIPE_WHITE}
              stroke={STROKE}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </G>
        )}
      </RigLayer>

      {/* 6. Clawed Brawler Paws (pump into the air on match, guard stance when idle!) */}
      <RigLayer style={pawStyle}>
        {isCheering ? (
          <G>
            {/* Victory double uppercut fists! */}
            <Circle cx={24} cy={57} r={6.8} fill={BADGER_CHARCOAL} stroke={STROKE} strokeWidth={2.9} />
            <Line x1={21} y1={51} x2={21} y2={54} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={24} y1={50} x2={24} y2={53.5} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={27} y1={51} x2={27} y2={54} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />

            <Circle cx={76} cy={57} r={6.8} fill={BADGER_CHARCOAL} stroke={STROKE} strokeWidth={2.9} />
            <Line x1={73} y1={51} x2={73} y2={54} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={76} y1={50} x2={76} y2={53.5} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={79} y1={51} x2={79} y2={54} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            {/* Grounded clawed digger paws */}
            <Ellipse cx={37} cy={87} rx={7.8} ry={4.8} fill={BADGER_CHARCOAL} stroke={STROKE} strokeWidth={2.9} />
            <Line x1={34} y1={87} x2={34} y2={90.5} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={37} y1={87} x2={37} y2={91} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={40} y1={87} x2={40} y2={90.5} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />

            <Ellipse cx={63} cy={87} rx={7.8} ry={4.8} fill={BADGER_CHARCOAL} stroke={STROKE} strokeWidth={2.9} />
            <Line x1={60} y1={87} x2={60} y2={90.5} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={63} y1={87} x2={63} y2={91} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
            <Line x1={66} y1={87} x2={66} y2={90.5} stroke={STRIPE_WHITE} strokeWidth={2} strokeLinecap="round" />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};
