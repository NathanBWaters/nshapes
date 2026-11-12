import React from 'react';
import { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isHurtExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const FOX_RUSSET = '#EA580C';
const FOX_ORANGE = '#FF7A1A';
const FOX_CREAM = '#FFFBF5';

export const SlyFoxRig: React.FC<CreatureRigProps> = ({
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
      {/* 1. Giant Bushy White-Tipped Flame Tail (pivots at 68, 78) */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 64 81 C 80 84, 96 70, 93 48 C 91 37, 81 33, 76 41 C 71 49, 71 65, 62 74 Z"
          fill={FOX_RUSSET}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Jagged cream tail tip */}
        <Path
          d="M 93 49 C 91 37, 81 33, 76 41 C 74 45, 74 50, 74 53 L 80 49 L 84 54 L 88 49 Z"
          fill={FOX_CREAM}
          stroke={STROKE}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Agile Rogue Body + Fluffy Cream Bib */}
      <RigLayer>
        <Path
          d="M 33 57 C 28 69, 29 85, 37 89 L 63 89 C 71 85, 72 69, 67 57 Z"
          fill={FOX_RUSSET}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Jagged fluffy cream chest ruff */}
        <Path
          d="M 39 59 L 50 61 L 61 59 L 58 72 L 54 69 L 50 76 L 46 69 L 42 72 Z"
          fill={FOX_CREAM}
          stroke={STROKE}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 3. Left Vulpine Ear with Dark Tip (pivots at 31, 28) */}
      <RigLayer style={leftEarStyle}>
        <Path
          d="M 23 34 L 15 9 L 40 24 Z"
          fill={FOX_RUSSET}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Charcoal rogue ear tip */}
        <Polygon points="15,9 21,21 26,16" fill={STROKE} />
        <Polygon points="24,30 21,19 34,25" fill={FOX_CREAM} />
      </RigLayer>

      {/* 4. Right Vulpine Ear with Dark Tip (pivots at 69, 28) */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 77 34 L 85 9 L 60 24 Z"
          fill={FOX_RUSSET}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Polygon points="85,9 79,21 74,16" fill={STROKE} />
        <Polygon points="76,30 79,19 66,25" fill={FOX_CREAM} />
      </RigLayer>

      {/* 5. Angular Fox Head & Sly Smirk (pivots at 50, 48) */}
      <RigLayer style={headStyle}>
        {/* Swept cheek-tuft diamond head */}
        <Path
          d={
            isRuffled
              ? 'M 50 21 C 64 21, 74 28, 76 39 L 85 45 L 77 49 L 81 53 L 50 63 L 19 53 L 23 49 L 15 45 L 24 39 C 26 28, 36 21, 50 21 Z'
              : 'M 50 21 C 64 21, 74 28, 76 40 L 84 46 L 75 53 L 50 63 L 25 53 L 16 46 L 24 40 C 26 28, 36 21, 50 21 Z'
          }
          fill={FOX_ORANGE}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Cream lower cheek mask leaving orange nose-bridge V */}
        <Path
          d="M 18 46.5 Q 34 45 45 53 L 50 61.5 L 25 52.5 Z"
          fill={FOX_CREAM}
        />
        <Path
          d="M 82 46.5 Q 66 45 55 53 L 50 61.5 L 75 52.5 Z"
          fill={FOX_CREAM}
        />

        <CreatureEyes expression={expression} gazeOffset={gazeOffset} leftX={38} rightX={62} y={42} radius={4.5} />

        {/* Signature sly slanted brow when calm */}
        {expression === 'normal' && (
          <Path
            d="M 57 35.5 L 67 33.5"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        <Ellipse cx={50} cy={52.5} rx={3.8} ry={2.8} fill={STROKE} />
        <Circle cx={48.8} cy={51.6} r={1} fill="#FFFFFF" />

        {/* Sly Mouth / Fang Grin */}
        {isCheering ? (
          <G>
            <Path
              d="M 42.5 55.5 Q 50 62.5 58.5 54.5 Z"
              fill="#FF7169"
              stroke={STROKE}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <Polygon points="54,55.5 56.5,55.2 55.2,58.5" fill="#FFFFFF" />
          </G>
        ) : isHurt ? (
          <Path
            d="M 43 57.5 L 47 55.5 L 50 57.5 L 53 55.5 L 57 57.5"
            stroke={STROKE}
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          // Lopsided confident sly smirk!
          <Path
            d="M 45 56.5 Q 52 58.5 58.5 53.5"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </RigLayer>

      {/* 6. Dark-Socked Fox Paws */}
      <RigLayer style={pawStyle}>
        {isCheering ? (
          <G>
            <Ellipse cx={25} cy={60} rx={6} ry={5} fill={STROKE} />
            <Ellipse cx={75} cy={60} rx={6} ry={5} fill={STROKE} />
          </G>
        ) : (
          <G>
            <Ellipse cx={41} cy={87.5} rx={6.5} ry={4.3} fill={STROKE} />
            <Ellipse cx={59} cy={87.5} rx={6.5} ry={4.3} fill={STROKE} />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};
