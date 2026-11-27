import React from 'react';
import { Circle, Defs, Ellipse, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { STROKE, TwoToneGradient } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const PLUMAGE_LIT = '#FFFFFF';
const PLUMAGE_WHITE = '#FFFDF7';
const PLUMAGE_SHADOW = '#CBD5E1';
const POUCH_LIT = '#FDBA74';
const POUCH_ORANGE = '#FF9538';
const POUCH_SHADOW = '#C2410C';
const BILL_LIT = '#FEF08A';
const BILL_GOLD = '#FFDE00';
const BILL_SHADOW = '#CA8A04';

/**
 * [UI-05] & [UI-07] Pelican — lean coastal silhouette, oversized hooked golden
 * bill + deep tangerine throat pouch jutting boldly far right, jaunty 3-feather
 * crest & coastal wings swept asymmetrically back-left, with 2-tone lighting.
 */
export const PelicanRig: React.FC<CreatureRigProps> = ({
  expression,
  healthState,
  blinkStage = 0,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
  silhouette = false,
}) => {
  const isStarry = expression === 'starry';
  const isRuffled =
    healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <RigLayerStack silhouette={silhouette} facing="right">
      {/* 1. Far Swept-Back Coastal Wing (uses leftEarStyle, pivots at 24, 54; continuously GPU-flapped) */}
      <RigLayer skipAutoLighting style={leftEarStyle}>
        <Defs>
          <TwoToneGradient id="pel-wing-l" lit={PLUMAGE_LIT} base={PLUMAGE_WHITE} shadow={PLUMAGE_SHADOW} />
        </Defs>
        <Path
          d="M 27 52 C 11 49, 4 62, 11 72 C 17 79, 28 69, 31 58 Z"
          fill="url(#pel-wing-l)"
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path
          d="M 9 65 L 18 65 L 14 73 C 10 72, 8 69, 9 65 Z"
          fill={COLORS.logicTeal}
        />
      </RigLayer>

      {/* 2. Tall Lean Coastal Pelican Body */}
      <RigLayer skipAutoLighting>
        <Defs>
          <TwoToneGradient id="pel-body" lit={PLUMAGE_LIT} base={PLUMAGE_WHITE} shadow={PLUMAGE_SHADOW} />
        </Defs>
        <Path
          d="M 24 49 C 19 65, 23 84, 34 88 L 54 88 C 63 83, 64 66, 58 49 Z"
          fill="url(#pel-body)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Path
          d="M 33 70 Q 43 76 53 70"
          stroke="#94A3B8"
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      </RigLayer>

      {/* 3. Near Swept-Back Coastal Wing (uses rightEarStyle, pivots at 33, 56; continuously GPU-flapped) */}
      <RigLayer skipAutoLighting style={rightEarStyle}>
        <Defs>
          <TwoToneGradient id="pel-wing-r" lit={PLUMAGE_LIT} base={PLUMAGE_WHITE} shadow={PLUMAGE_SHADOW} />
        </Defs>
        <Path
          d="M 37 56 C 22 57, 15 71, 22 79 C 29 84, 41 72, 43 60 Z"
          fill="url(#pel-wing-r)"
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Path
          d="M 21 71 L 30 71 L 26 79 C 22 79, 20 75, 21 71 Z"
          fill={COLORS.logicTeal}
        />
      </RigLayer>

      {/* 4. Signature Oversized Expandable Tangerine Throat Pouch jutting FAR RIGHT (pivots at 54, 50; SPRING.loose heave) */}
      <RigLayer skipAutoLighting style={tailStyle}>
        <Defs>
          <TwoToneGradient id="pel-pouch" lit={POUCH_LIT} base={POUCH_ORANGE} shadow={POUCH_SHADOW} />
        </Defs>
        <Path
          d="M 44 42 C 45 65, 84 67, 92 43 Z"
          fill="url(#pel-pouch)"
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path
          d="M 55 46 Q 59 56 66 57 M 67 46 Q 71 55 77 55"
          stroke="#C2410C"
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        {isStarry && (
          <Polygon
            points="81,41 91,33 89,41 94,44 83,44"
            fill={COLORS.logicTeal}
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
      </RigLayer>

      {/* 5. Pelican Head, Swept 3-Feather Crest & Massive Hooked Golden Bill (pivots at 42, 34) */}
      <RigLayer skipAutoLighting style={headStyle}>
        <Defs>
          <TwoToneGradient id="pel-head" lit={PLUMAGE_LIT} base={PLUMAGE_WHITE} shadow={PLUMAGE_SHADOW} />
          <TwoToneGradient id="pel-bill" lit={BILL_LIT} base={BILL_GOLD} shadow={BILL_SHADOW} />
        </Defs>
        {/* Jaunty swept-back 3-feather head crest */}
        <Path
          d={
            isRuffled
              ? 'M 33 21 L 16 9 L 28 24 L 12 18 L 28 28 Z'
              : 'M 34 21 C 25 9, 15 10, 22 20 C 15 15, 10 20, 22 26 Z'
          }
          fill="url(#pel-head)"
          stroke={STROKE}
          strokeWidth={2.9}
          strokeLinejoin="round"
        />
        <Circle
          cx={38}
          cy={34}
          r={15.5}
          fill="url(#pel-head)"
          stroke={STROKE}
          strokeWidth={3.3}
        />

        <CreatureEyes
          expression={expression}
          blinkStage={blinkStage}
          gazeOffset={gazeOffset}
          lidFill={PLUMAGE_WHITE}
          leftX={33}
          rightX={46}
          y={32.5}
          radius={4.1}
        />

        {/* Oversized Sculpted Golden Upper Bill with Pronounced Hooked Tip jutting far right */}
        <Path
          d="M 43 38 L 91 38 C 95 38, 96 44, 91 47 L 88 43 L 43 44 Z"
          fill="url(#pel-bill)"
          stroke={STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 6. Webbed Coastal Feet */}
      <RigLayer skipAutoLighting style={pawStyle}>
        <Ellipse cx={34} cy={88.5} rx={7.5} ry={4} fill={POUCH_ORANGE} stroke={STROKE} strokeWidth={2.8} />
        <Ellipse cx={53} cy={88.5} rx={8} ry={4} fill={POUCH_ORANGE} stroke={STROKE} strokeWidth={2.8} />
      </RigLayer>
    </RigLayerStack>
  );
};
