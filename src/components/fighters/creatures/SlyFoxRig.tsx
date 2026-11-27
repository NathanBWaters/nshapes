import React from 'react';
import { Circle, Defs, Ellipse, G, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isHurtExpression } from '@/components/creatures/expressions';
import { STROKE, TwoToneGradient } from '@/components/illustration/primitives';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const FOX_LIT = '#FFA552';
const FOX_ORANGE = '#FF7A1A';
const FOX_RUSSET = '#EA580C';
const FOX_SHADOW = '#9A3412';
const FOX_CREAM_LIT = '#FFFFFF';
const FOX_CREAM = '#FFFBF5';
const FOX_CREAM_SHADOW = '#E2CFC0';

/**
 * [UI-05] & [UI-07] Sly Fox — low crouched horizontal rogue silhouette,
 * sweeping oversized flame-tail extending far left, sharp triangular cheek ruffs,
 * forward-right vulpine snout, and 2-tone overhead directional lighting.
 */
export const SlyFoxRig: React.FC<CreatureRigProps> = ({
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
  const isCheering = expression === 'happy' || expression === 'starry';
  const isHurt = isHurtExpression(expression);
  const isRuffled =
    healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';

  return (
    <RigLayerStack silhouette={silhouette} facing="right">
      {/* 1. Giant Sweeping Horizontal White-Tipped Flame Tail extending FAR LEFT (pivots at 32, 74) */}
      <RigLayer skipAutoLighting style={tailStyle}>
        <Defs>
          <TwoToneGradient id="fox-tail" lit={FOX_LIT} base={FOX_RUSSET} shadow={FOX_SHADOW} />
          <TwoToneGradient id="fox-tip" lit={FOX_CREAM_LIT} base={FOX_CREAM} shadow={FOX_CREAM_SHADOW} />
        </Defs>
        <Path
          d="M 38 77 C 20 84, 3 77, 4 60 C 5 49, 17 44, 26 52 C 32 58, 34 65, 42 70 Z"
          fill="url(#fox-tail)"
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Swept flame-jagged cream tail tip on far left */}
        <Path
          d="M 4 61 C 5 49, 17 44, 24 51 L 19 56 L 23 61 L 15 63 L 17 70 C 9 72, 4 67, 4 61 Z"
          fill="url(#fox-tip)"
          stroke={STROKE}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Low Crouched Horizontal Rogue Body + Fluffy Cream Bib */}
      <RigLayer skipAutoLighting>
        <Defs>
          <TwoToneGradient id="fox-body" lit={FOX_ORANGE} base={FOX_RUSSET} shadow={FOX_SHADOW} />
          <TwoToneGradient id="fox-bib" lit={FOX_CREAM_LIT} base={FOX_CREAM} shadow={FOX_CREAM_SHADOW} />
        </Defs>
        <Path
          d="M 34 63 C 29 73, 33 85, 44 87 L 72 87 C 80 83, 81 69, 73 60 Z"
          fill="url(#fox-body)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Path
          d="M 37 64 Q 48 61 59 63"
          stroke="#FFFDF5"
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
        />
        {/* Jagged fluffy cream chest ruff shifted forward-right */}
        <Path
          d="M 52 62 L 63 63 L 74 62 L 72 74 L 67 71 L 63 79 L 58 72 L 54 75 Z"
          fill="url(#fox-bib)"
          stroke={STROKE}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 3. Swept-Back Left Vulpine Ear with Charcoal Tip (pivots at 43, 29) */}
      <RigLayer skipAutoLighting style={leftEarStyle}>
        <Defs>
          <TwoToneGradient id="fox-ear-l" lit={FOX_LIT} base={FOX_RUSSET} shadow={FOX_SHADOW} />
        </Defs>
        <Path
          d="M 34 36 L 23 11 L 51 25 Z"
          fill="url(#fox-ear-l)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Polygon points="23,11 30,23 35,17" fill={STROKE} />
        <Polygon points="35,32 31,21 45,27" fill={FOX_CREAM} />
      </RigLayer>

      {/* 4. Alert Right Vulpine Ear angled forward (pivots at 70, 29) */}
      <RigLayer skipAutoLighting style={rightEarStyle}>
        <Defs>
          <TwoToneGradient id="fox-ear-r" lit={FOX_LIT} base={FOX_RUSSET} shadow={FOX_SHADOW} />
        </Defs>
        <Path
          d="M 79 37 L 87 12 L 61 26 Z"
          fill="url(#fox-ear-r)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Polygon points="87,12 80,24 75,18" fill={STROKE} />
        <Polygon points="77,32 80,22 67,27" fill={FOX_CREAM} />
      </RigLayer>

      {/* 5. Low Angular Diamond Rogue Head & Sharp Cheek Ruffs (pivots at 58, 46) */}
      <RigLayer skipAutoLighting style={headStyle}>
        <Defs>
          <TwoToneGradient id="fox-head" lit={FOX_LIT} base={FOX_ORANGE} shadow={FOX_RUSSET} />
          <TwoToneGradient id="fox-cheek" lit={FOX_CREAM_LIT} base={FOX_CREAM} shadow={FOX_CREAM_SHADOW} />
        </Defs>
        <Path
          d={
            isRuffled
              ? 'M 58 24 C 71 24, 80 31, 82 41 L 94 47 L 83 52 L 88 56 L 63 65 L 33 55 L 37 51 L 26 47 L 36 41 C 38 31, 46 24, 58 24 Z'
              : 'M 58 24 C 71 24, 80 31, 82 42 L 94 48 L 82 55 L 63 65 L 36 55 L 26 48 L 36 41 C 38 31, 46 24, 58 24 Z'
          }
          fill="url(#fox-head)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Path
          d="M 43 30 C 49 26, 58 25, 66 27"
          stroke="#FFFDF5"
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
        {/* Swept cream cheek masks framing the sly orange snout bridge */}
        <Path d="M 29 48.5 Q 46 47 57 55 L 62 63.5 L 37 54.5 Z" fill="url(#fox-cheek)" />
        <Path d="M 91 48.5 Q 77 47 68 55 L 64 63.5 L 82 54.5 Z" fill="url(#fox-cheek)" />

        <CreatureEyes
          expression={expression}
          blinkStage={blinkStage}
          gazeOffset={gazeOffset}
          lidFill={FOX_ORANGE}
          leftX={49}
          rightX={71}
          y={43.5}
          radius={4.5}
        />

        {expression === 'normal' && (
          <Path d="M 65 36.5 L 76 34.5" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
        )}

        <Ellipse cx={64} cy={54} rx={3.8} ry={2.8} fill={STROKE} />
        <Circle cx={62.8} cy={53.1} r={1} fill="#FFFFFF" />

        {isCheering ? (
          <G>
            <Path
              d="M 55.5 57 Q 63 64 71.5 56 Z"
              fill="#FF7169"
              stroke={STROKE}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <Polygon points="67,57 69.5,56.7 68.2,60" fill="#FFFFFF" />
          </G>
        ) : isHurt ? (
          <Path
            d="M 56 59 L 60 57 L 63 59 L 66 57 L 70 59"
            stroke={STROKE}
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <Path
            d="M 58 58 Q 65 60 72 54.5"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </RigLayer>

      {/* 6. Staggered Stealth Dark-Socked Paws (continuously GPU-animated; zero 1f JSX teleport) */}
      <RigLayer skipAutoLighting style={pawStyle}>
        <G>
          <Ellipse cx={43} cy={87} rx={6.8} ry={4.2} fill={STROKE} />
          <Ellipse cx={74} cy={86.5} rx={7.2} ry={4.4} fill={STROKE} />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};
