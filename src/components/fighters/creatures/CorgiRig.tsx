import React from 'react';
import { Circle, Defs, Ellipse, G, Path } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { STROKE, TwoToneGradient } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const CORGI_LIT = '#FCD34D';
const CORGI_FAWN = '#F59E0B';
const CORGI_SHADOW = '#B45309';
const CORGI_CREAM_LIT = '#FFFFFF';
const CORGI_CREAM = '#FFFDF7';
const CORGI_CREAM_SHADOW = '#E2D9CC';
const TONGUE_PINK = '#FF7169';

/**
 * [UI-05] & [UI-07] Corgi — elongated horizontal loaf-sprint stance, giant
 * splayed radar ears tilted forward-right, fluffy rump nub-tail on far left,
 * kicked-back rear stubby paw + lunging front paw, and 2-tone overhead lighting.
 */
export const CorgiRig: React.FC<CreatureRigProps> = ({
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
  const isDroopyEars = expression === 'sad' || expression === 'wince' || expression === 'ko';
  const showTongue =
    expression === 'normal' ||
    expression === 'happy' ||
    expression === 'starry' ||
    expression === 'eager' ||
    expression === 'blush' ||
    expression === 'relieved';
  const isScruffy =
    healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <RigLayerStack silhouette={silhouette} facing="right">
      {/* 1. Hyper-Speed Fluffy Corgi Loaf Nub-Tail high on the FAR LEFT rump (pivots at 18, 66) */}
      <RigLayer skipAutoLighting style={tailStyle}>
        <Defs>
          <TwoToneGradient id="corgi-tail" lit={CORGI_LIT} base={CORGI_FAWN} shadow={CORGI_SHADOW} />
        </Defs>
        <Circle
          cx={13}
          cy={64}
          r={8.6}
          fill="url(#corgi-tail)"
          stroke={STROKE}
          strokeWidth={3.1}
        />
        <Circle cx={11.5} cy={62} r={4.2} fill={CORGI_CREAM_LIT} />
      </RigLayer>

      {/* 2. Low Elongated Corgi Loaf-Sprint Body + Fluffy White Chest Ruff */}
      <RigLayer skipAutoLighting>
        <Defs>
          <TwoToneGradient id="corgi-body" lit={CORGI_LIT} base={CORGI_FAWN} shadow={CORGI_SHADOW} />
          <TwoToneGradient id="corgi-chest" lit={CORGI_CREAM_LIT} base={CORGI_CREAM} shadow={CORGI_CREAM_SHADOW} />
        </Defs>
        <Path
          d="M 18 65 C 14 75, 19 86, 30 87 L 69 87 C 79 84, 81 70, 74 59 L 46 60 C 33 59, 22 60, 18 65 Z"
          fill="url(#corgi-body)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Sunlit upper-left loaf back rim */}
        <Path
          d="M 23 64 Q 36 61 50 62"
          stroke="#FFFDF5"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.62}
        />
        {/* Fluffy white royal chest floof on the right front */}
        <Path
          d="M 48 60 C 46 68, 49 79, 57 82 C 62 84, 71 83, 75 78 C 80 73, 79 64, 73 59 Z"
          fill="url(#corgi-chest)"
          stroke={STROKE}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <Path
          d="M 46 60 Q 61 65 74 59"
          stroke={COLORS.logicTeal}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
        />
      </RigLayer>

      {/* 3. Exaggerated Giant Left Radar Ear tilted forward (pivots at 40, 29) */}
      <RigLayer skipAutoLighting style={leftEarStyle}>
        <Defs>
          <TwoToneGradient id="corgi-ear-l" lit={CORGI_LIT} base={CORGI_FAWN} shadow={CORGI_SHADOW} />
        </Defs>
        <Path
          d={
            isDroopyEars
              ? 'M 36 33 C 18 30, 12 40, 20 48 C 26 52, 35 45, 42 37 Z'
              : 'M 31 35 C 19 18, 20 3, 31 4 C 41 5, 47 17, 49 26 Z'
          }
          fill="url(#corgi-ear-l)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {!isDroopyEars && (
          <Path
            d="M 33 31 C 26 20, 26 10, 32 10 C 38 11, 43 19, 44 26 Z"
            fill={TONGUE_PINK}
            opacity={0.85}
          />
        )}
      </RigLayer>

      {/* 4. Exaggerated Giant Right Radar Ear splayed forward-right (pivots at 72, 29) */}
      <RigLayer skipAutoLighting style={rightEarStyle}>
        <Defs>
          <TwoToneGradient id="corgi-ear-r" lit={CORGI_LIT} base={CORGI_FAWN} shadow={CORGI_SHADOW} />
        </Defs>
        <Path
          d={
            isDroopyEars
              ? 'M 76 34 C 92 31, 97 41, 90 48 C 84 52, 76 45, 70 37 Z'
              : 'M 79 36 C 91 21, 93 6, 82 6 C 72 6, 65 18, 63 26 Z'
          }
          fill="url(#corgi-ear-r)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {!isDroopyEars && (
          <Path
            d="M 77 31 C 84 21, 86 12, 80 12 C 74 12, 69 20, 68 26 Z"
            fill={TONGUE_PINK}
            opacity={0.85}
          />
        )}
      </RigLayer>

      {/* 5. Sunny 3/4 Right-Facing Corgi Head, Blaze & Happy Tongue (pivots at 58, 44) */}
      <RigLayer skipAutoLighting style={headStyle}>
        <Defs>
          <TwoToneGradient id="corgi-head" lit={CORGI_LIT} base={CORGI_FAWN} shadow={CORGI_SHADOW} />
          <TwoToneGradient id="corgi-blaze" lit={CORGI_CREAM_LIT} base={CORGI_CREAM} shadow={CORGI_CREAM_SHADOW} />
        </Defs>
        <Path
          d={
            isScruffy
              ? 'M 33 44 C 33 26, 44 21, 58 21 C 72 21, 83 27, 83 45 L 86 49 L 82 53 C 79 60, 70 62, 58 62 C 46 62, 36 59, 34 52 L 30 48 Z'
              : 'M 33 45 C 33 26, 44 21, 58 21 C 72 21, 83 27, 83 45 C 83 56, 72 62, 58 62 C 44 62, 33 56, 33 45 Z'
          }
          fill="url(#corgi-head)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Iconic white Corgi forehead blaze + snout shifted right */}
        <Path
          d="M 60 23 C 63 29, 64 37, 67 44 C 73 46, 74 57, 60 59 C 46 57, 47 46, 53 44 C 56 37, 57 29, 60 23 Z"
          fill="url(#corgi-blaze)"
        />
        <Ellipse cx={48} cy={34} rx={3.2} ry={2} fill="#FEF3C7" />
        <Ellipse cx={71} cy={34} rx={3.2} ry={2} fill="#FEF3C7" />

        <CreatureEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={48}
          rightX={71}
          y={41.5}
          radius={4.7}
        />

        <Ellipse cx={61} cy={48.5} rx={4.6} ry={3.3} fill={STROKE} />
        <Ellipse cx={59.6} cy={47.5} rx={1.4} ry={0.9} fill="#FFFFFF" />

        {showTongue ? (
          <G>
            <Path
              d="M 53.5 53 Q 57.5 57 61 53 Q 64.5 57 68.5 53"
              stroke={STROKE}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={
                isCheering
                  ? 'M 57 54.5 C 57 63.5, 65 63.5, 65 54.5 Z'
                  : 'M 57.8 54.5 C 57.8 61, 64.2 61, 64.2 54.5 Z'
              }
              fill={TONGUE_PINK}
              stroke={STROKE}
              strokeWidth={2}
            />
            <Path d="M 61 55 L 61 59" stroke={STROKE} strokeWidth={1.3} strokeLinecap="round" />
          </G>
        ) : expression === 'wince' || expression === 'ko' ? (
          <Path
            d="M 54 55.5 Q 57.5 52.5 61 55.5 Q 64.5 52.5 68 55.5"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <Path
            d="M 55 55 Q 61 52.5 67 55"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </RigLayer>

      {/* 6. Kicked-Back Rear Loaf Paw + Forward-Lunging Sprint Paw */}
      <RigLayer skipAutoLighting style={pawStyle}>
        <Defs>
          <TwoToneGradient id="corgi-paw" lit={CORGI_CREAM_LIT} base={CORGI_CREAM} shadow={CORGI_CREAM_SHADOW} />
        </Defs>
        {isCheering ? (
          <G>
            <Ellipse cx={24} cy={83} rx={7} ry={4.6} fill="url(#corgi-paw)" stroke={STROKE} strokeWidth={2.8} />
            <Ellipse cx={82} cy={65} rx={7} ry={5.2} fill="url(#corgi-paw)" stroke={STROKE} strokeWidth={2.8} />
          </G>
        ) : (
          <G>
            {/* Kicked-back stubby rear loaf paw */}
            <Ellipse cx={20} cy={86.5} rx={7.4} ry={4.5} fill="url(#corgi-paw)" stroke={STROKE} strokeWidth={2.8} />
            {/* Mid support paw */}
            <Ellipse cx={48} cy={87.5} rx={6.4} ry={4.2} fill="url(#corgi-paw)" stroke={STROKE} strokeWidth={2.7} />
            {/* Forward lunging tippy-tap paw */}
            <Ellipse cx={76} cy={84} rx={7.5} ry={4.8} fill="url(#corgi-paw)" stroke={STROKE} strokeWidth={2.8} />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};
