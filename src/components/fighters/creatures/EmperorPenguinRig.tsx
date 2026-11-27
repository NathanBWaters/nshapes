import React from 'react';
import { Circle, Defs, Ellipse, G, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { STROKE, TwoToneGradient } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const TUX_LIT = '#334155';
const TUX_NAVY = '#1E293B';
const TUX_SHADOW = '#0F172A';
const BELLY_LIT = '#FFFFFF';
const BELLY_BASE = '#F8FAFC';
const BELLY_SHADOW = '#CBD5E1';
const EMPEROR_GOLD = '#FBBF24';
const BEAK_ORANGE = '#FF9538';

/**
 * [UI-05] & [UI-07] Emperor Penguin — tall slender regal column posture,
 * tilted golden crown on top, floating mystic halo offset behind-left,
 * trailing left flipper + bold forward-casting right flipper, and 2-tone lighting.
 */
export const EmperorPenguinRig: React.FC<CreatureRigProps> = ({
  expression,
  healthState,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
  silhouette = false,
}) => {
  const isCheering = expression === 'happy' || expression === 'starry';
  const isOpenBeak = isCheering || expression === 'panic' || expression === 'wince';
  const crownTilted =
    healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <RigLayerStack silhouette={silhouette} facing="right">
      {/* 1. Floating Mystic Oracle Halo offset behind-left (uses tailStyle, pivots at 38, 36) */}
      <RigLayer skipAutoLighting style={tailStyle}>
        <Circle
          cx={38}
          cy={36}
          r={24}
          fill="none"
          stroke={COLORS.logicTeal}
          strokeWidth={2.2}
          strokeDasharray="6 5"
          opacity={healthState === 'knocked_out' ? 0.2 : 0.72}
        />
        <Polygon points="22,15 26,19 22,23 18,19" fill={COLORS.logicTeal} opacity={0.85} />
      </RigLayer>

      {/* 2. Trailing Left Flipper swept gracefully back (uses leftEarStyle, pivots at 30, 54) */}
      <RigLayer skipAutoLighting style={leftEarStyle}>
        <Defs>
          <TwoToneGradient id="peng-flip-l" lit={TUX_LIT} base={TUX_NAVY} shadow={TUX_SHADOW} />
        </Defs>
        <Path
          d={
            isCheering
              ? 'M 33 52 C 19 44, 12 31, 17 26 C 22 22, 31 36, 35 48 Z'
              : 'M 33 51 C 19 56, 13 70, 19 75 C 25 78, 32 67, 35 56 Z'
          }
          fill="url(#peng-flip-l)"
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 3. Tall Slender Regal Tuxedo Column Body + Amber Bib */}
      <RigLayer skipAutoLighting>
        <Defs>
          <TwoToneGradient id="peng-tux" lit={TUX_LIT} base={TUX_NAVY} shadow={TUX_SHADOW} />
          <TwoToneGradient id="peng-belly" lit={BELLY_LIT} base={BELLY_BASE} shadow={BELLY_SHADOW} />
        </Defs>
        <Path
          d="M 33 46 C 29 64, 31 85, 42 89 L 61 89 C 70 85, 72 64, 67 46 Z"
          fill="url(#peng-tux)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Sunlit upper-left tuxedo shoulder sheen */}
        <Path
          d="M 34 55 C 33 64, 34 73, 37 80"
          stroke="#94A3B8"
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
          opacity={0.45}
        />
        <Ellipse cx={54} cy={69} rx={13.5} ry={17.5} fill="url(#peng-belly)" />
        {/* Warm Emperor golden-amber upper chest glow */}
        <Path
          d="M 41 60 C 43 50, 64 50, 66 60 C 61 65, 45 65, 41 60 Z"
          fill={EMPEROR_GOLD}
          opacity={0.88}
        />
        {/* Mystic Crystal Orb Collar Gem */}
        <Polygon
          points="55,52 59,56.5 55,61 51,56.5"
          fill={COLORS.logicTeal}
          stroke={STROKE}
          strokeWidth={2}
        />
      </RigLayer>

      {/* 4. Lead Right Flipper sweeping boldly forward-right casting! (uses rightEarStyle, pivots at 65, 52) */}
      <RigLayer skipAutoLighting style={rightEarStyle}>
        <Defs>
          <TwoToneGradient id="peng-flip-r" lit={TUX_LIT} base={TUX_NAVY} shadow={TUX_SHADOW} />
        </Defs>
        <Path
          d={
            isCheering
              ? 'M 64 51 C 77 41, 91 31, 93 38 C 95 45, 81 54, 67 57 Z'
              : 'M 64 51 C 76 47, 91 48, 92 55 C 93 61, 79 63, 66 59 Z'
          }
          fill="url(#peng-flip-r)"
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 5. Regal Tall Head, Tilted Golden Crown & Forward Beak (pivots at 52, 36) */}
      <RigLayer skipAutoLighting style={headStyle}>
        <Defs>
          <TwoToneGradient id="peng-head" lit={TUX_LIT} base={TUX_NAVY} shadow={TUX_SHADOW} />
          <TwoToneGradient id="peng-crown" lit="#FEF08A" base={COLORS.actionYellow} shadow="#D97706" />
        </Defs>
        <Ellipse
          cx={51}
          cy={35}
          rx={18.5}
          ry={16.5}
          fill="url(#peng-head)"
          stroke={STROKE}
          strokeWidth={3.3}
        />
        {/* White facial patches shifted 3/4 right */}
        <Circle cx={45} cy={36.5} r={7.4} fill="#FFFFFF" />
        <Circle cx={61.5} cy={36.5} r={7.2} fill="#FFFFFF" />
        {/* Emperor golden ear-cheek crescent */}
        <Circle cx={37} cy={40} r={3.5} fill={EMPEROR_GOLD} />

        {/* Tall Golden Royal Crown perched high & tilted proudly */}
        <G transform={crownTilted ? 'rotate(18, 52, 18)' : 'rotate(6, 52, 18)'}>
          <Polygon
            points="39,21 41,9 47,16 52,5 57,16 63,9 65,21"
            fill="url(#peng-crown)"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Circle cx={52} cy={15.5} r={2.2} fill={COLORS.logicTeal} />
        </G>

        <CreatureEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={45.5}
          rightX={62}
          y={36}
          radius={4.2}
        />

        {/* Forward-right regal penguin beak */}
        {isOpenBeak ? (
          <G>
            <Polygon
              points="52,42 75,38 56,37"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={2.3}
              strokeLinejoin="round"
            />
            <Polygon
              points="53,43 72,46 57,49.5"
              fill="#FF7169"
              stroke={STROKE}
              strokeWidth={2.3}
              strokeLinejoin="round"
            />
          </G>
        ) : (
          <Polygon
            points="52,42 57,38.5 76,42.5 56,47.5"
            fill={BEAK_ORANGE}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
        )}
      </RigLayer>

      {/* 6. Staggered Webbed Orange Feet */}
      <RigLayer skipAutoLighting style={pawStyle}>
        <Ellipse cx={42} cy={89} rx={7.8} ry={4.2} fill={BEAK_ORANGE} stroke={STROKE} strokeWidth={2.8} />
        <Ellipse cx={61} cy={89} rx={8.4} ry={4.2} fill={BEAK_ORANGE} stroke={STROKE} strokeWidth={2.8} />
      </RigLayer>
    </RigLayerStack>
  );
};
