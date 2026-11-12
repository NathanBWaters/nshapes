import React from 'react';
import { Circle, Ellipse, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const PLUMAGE_WHITE = '#FFFFFF';
const POUCH_ORANGE = '#FF9538';
const BILL_GOLD = '#FFDE00';

export const PelicanRig: React.FC<CreatureRigProps> = ({
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
  const isStarry = expression === 'starry';
  const isRuffled = healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <RigLayerStack>
      {/* 1. Left Coastal Wing with Teal Feather Trim (uses leftEarStyle, pivots at 25, 56) */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={
            isCheering
              ? 'M 28 56 C 14 45, 7 29, 13 24 C 19 20, 29 35, 32 51 Z'
              : 'M 27 53 C 15 60, 14 76, 20 80 C 26 82, 30 70, 31 59 Z'
          }
          fill={PLUMAGE_WHITE}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Teal primary wing tip */}
        <Path
          d={
            isCheering
              ? 'M 13 24 C 16 22, 21 26, 23 32 L 15 34 Z'
              : 'M 17 72 L 24 72 L 21 80 C 17 79, 16 76, 17 72 Z'
          }
          fill={COLORS.logicTeal}
        />
      </RigLayer>

      {/* 2. Right Coastal Wing with Teal Feather Trim (uses rightEarStyle, pivots at 73, 56) */}
      <RigLayer style={rightEarStyle}>
        <Path
          d={
            isCheering
              ? 'M 70 56 C 84 45, 91 29, 85 24 C 79 20, 69 35, 66 51 Z'
              : 'M 71 53 C 83 60, 84 76, 78 80 C 72 82, 68 70, 67 59 Z'
          }
          fill={PLUMAGE_WHITE}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path
          d={
            isCheering
              ? 'M 85 24 C 82 22, 77 26, 75 32 L 83 34 Z'
              : 'M 81 72 L 74 72 L 77 80 C 81 79, 82 76, 81 72 Z'
          }
          fill={COLORS.logicTeal}
        />
      </RigLayer>

      {/* 3. Rounded Coastal Pelican Body */}
      <RigLayer>
        <Path
          d="M 28 52 C 23 68, 26 85, 38 88 L 60 88 C 72 85, 74 68, 69 52 Z"
          fill={PLUMAGE_WHITE}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Subtle coastal chest feather arc */}
        <Path
          d="M 38 72 Q 49 78 60 72"
          stroke="#CBD5E1"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      </RigLayer>

      {/* 4. Signature Expandable Tangerine Gular Throat Pouch! (uses tailStyle, pivots at 55, 52) */}
      <RigLayer style={tailStyle}>
        <Path
          d={
            isCheering
              ? 'M 44 43 C 44 68, 84 72, 87 45 Z' // Huge inflated celebratory pouch!
              : 'M 45 43 C 46 63, 79 65, 85 45 Z'
          }
          fill={POUCH_ORANGE}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path
          d="M 55 47 Q 58 56 64 57 M 65 47 Q 68 55 73 55"
          stroke="#EA580C"
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        {/* Easter-egg lucky teal fish tail peeking out of the pouch on big matches! */}
        {isStarry && (
          <Polygon
            points="76,43 85,35 83,43 88,46 78,46"
            fill={COLORS.logicTeal}
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
      </RigLayer>

      {/* 5. Pelican Head, Jaunty Feather Crest & Golden Upper Bill (pivots at 47, 35) */}
      <RigLayer style={headStyle}>
        {/* Jaunty 3-feather head crest */}
        <Path
          d={
            isRuffled
              ? 'M 36 22 L 24 12 L 33 25 L 20 19 L 33 29 Z'
              : 'M 38 22 C 31 11, 24 12, 29 21 C 23 16, 19 20, 28 26 Z'
          }
          fill={PLUMAGE_WHITE}
          stroke={STROKE}
          strokeWidth={2.9}
          strokeLinejoin="round"
        />
        <Circle
          cx={42}
          cy={35}
          r={16.5}
          fill={PLUMAGE_WHITE}
          stroke={STROKE}
          strokeWidth={3.3}
        />

        {/* Eyes (Keen Pattern-Spotter pair angled slightly toward the bill!) */}
        <CreatureEyes expression={expression} gazeOffset={gazeOffset} leftX={35} rightX={49} y={33.5} radius={4.2} />

        {/* Sculpted Golden Upper Bill with Hooked Tip */}
        <Path
          d={
            isCheering
              ? 'M 45 39 L 87 35 C 90 35, 91 39, 88 41 L 45 44 Z' // Lifted joyful bill!
              : 'M 45 40 L 87 41 C 90 41, 91 45, 87 46.5 L 45 45 Z'
          }
          fill={BILL_GOLD}
          stroke={STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 6. Webbed Coastal Feet */}
      <RigLayer style={pawStyle}>
        <Ellipse cx={38} cy={88.5} rx={7.5} ry={4} fill={POUCH_ORANGE} stroke={STROKE} strokeWidth={2.8} />
        <Ellipse cx={59} cy={88.5} rx={7.5} ry={4} fill={POUCH_ORANGE} stroke={STROKE} strokeWidth={2.8} />
      </RigLayer>
    </RigLayerStack>
  );
};
