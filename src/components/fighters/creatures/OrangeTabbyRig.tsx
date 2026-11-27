import React from 'react';
import { Circle, Defs, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isHurtExpression } from '@/components/creatures/expressions';
import { STROKE, TwoToneGradient } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const TABBY_LIT = '#FFB866';
const TABBY_ORANGE = '#FF9538';
const TABBY_SHADOW = '#C95814';
const TABBY_STRIPE = '#B43E09';
const TABBY_CREAM_LIT = '#FFFDF7';
const TABBY_CREAM = '#FFF5E6';
const TABBY_CREAM_SHADOW = '#E6CFAF';
const NOSE_PINK = '#FF7169';

/**
 * [UI-05] & [UI-07] Orange Tabby — asymmetric 3/4 right-facing springy pounce,
 * high S-curve striped tail counterbalancing left, raised swipe paw forward-right,
 * and 2-tone overhead directional lighting gradients.
 */
export const OrangeTabbyRig: React.FC<CreatureRigProps> = ({
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
      {/* 1. High S-Curve Striped Cat Tail counterbalancing on the far LEFT (pivots at 26, 74) */}
      <RigLayer skipAutoLighting style={tailStyle}>
        <Defs>
          <TwoToneGradient id="tabby-tail" lit={TABBY_LIT} base={TABBY_ORANGE} shadow={TABBY_SHADOW} />
        </Defs>
        <Path
          d="M 32 77 C 14 75, 7 60, 11 40 C 13 28, 22 22, 27 28 C 31 33, 25 39, 22 44 C 19 52, 23 64, 34 68 Z"
          fill="url(#tabby-tail)"
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path d="M 11 54 L 19 52" stroke={TABBY_STRIPE} strokeWidth={2.7} strokeLinecap="round" />
        <Path d="M 12 42 L 20 42" stroke={TABBY_STRIPE} strokeWidth={2.7} strokeLinecap="round" />
        <Path d="M 17 31 L 23 34" stroke={TABBY_STRIPE} strokeWidth={2.5} strokeLinecap="round" />
      </RigLayer>

      {/* 2. Arched Forward-Leaning Pounce Body + Teal Collar & Gold Bell */}
      <RigLayer skipAutoLighting>
        <Defs>
          <TwoToneGradient id="tabby-body" lit={TABBY_LIT} base={TABBY_ORANGE} shadow={TABBY_SHADOW} />
          <TwoToneGradient id="tabby-belly" lit={TABBY_CREAM_LIT} base={TABBY_CREAM} shadow={TABBY_CREAM_SHADOW} />
        </Defs>
        <Path
          d="M 33 56 C 24 66, 25 83, 35 88 L 65 88 C 75 84, 77 69, 71 57 Z"
          fill="url(#tabby-body)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Ellipse cx={55} cy={75} rx={12} ry={10.5} fill="url(#tabby-belly)" />
        {/* Overhead sunlit back rim */}
        <Path
          d="M 30 67 C 31 61, 35 58, 40 57"
          stroke="#FFFDF5"
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
        <Path d="M 29 69 L 37 70 M 28 76 L 36 77" stroke={TABBY_STRIPE} strokeWidth={2.6} strokeLinecap="round" />
        {/* Teal collar & gold bell angled 3/4 right */}
        <Path
          d="M 37 59 Q 55 66 71 59"
          stroke={COLORS.logicTeal}
          strokeWidth={5.2}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 37 59 Q 55 66 71 59"
          stroke={STROKE}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={58} cy={65.5} r={4.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
        <Circle cx={58.6} cy={66.5} r={1.1} fill={STROKE} />
      </RigLayer>

      {/* 3. Rear Left Ear angled alertly forward (pivots at 42, 28) */}
      <RigLayer skipAutoLighting style={leftEarStyle}>
        <Defs>
          <TwoToneGradient id="tabby-ear-l" lit={TABBY_LIT} base={TABBY_ORANGE} shadow={TABBY_SHADOW} />
        </Defs>
        <Path
          d={
            isRuffled
              ? 'M 33 34 L 31 11 L 42 18 L 39 21 L 50 24 Z'
              : 'M 33 34 L 31 11 L 50 24 Z'
          }
          fill="url(#tabby-ear-l)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Polygon points="35,30 34,16 45,24" fill={NOSE_PINK} />
      </RigLayer>

      {/* 4. Lead Right Ear canted forward toward foe (pivots at 69, 29) */}
      <RigLayer skipAutoLighting style={rightEarStyle}>
        <Defs>
          <TwoToneGradient id="tabby-ear-r" lit={TABBY_LIT} base={TABBY_ORANGE} shadow={TABBY_SHADOW} />
        </Defs>
        <Path
          d="M 79 34 L 83 12 L 62 24 Z"
          fill="url(#tabby-ear-r)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Polygon points="77,30 79,17 67,24" fill={NOSE_PINK} />
      </RigLayer>

      {/* 5. 3/4 Right-Facing Expressive Tabby Head & Whiskers (pivots at 56, 45) */}
      <RigLayer skipAutoLighting style={headStyle}>
        <Defs>
          <TwoToneGradient id="tabby-head" lit={TABBY_LIT} base={TABBY_ORANGE} shadow={TABBY_SHADOW} />
          <TwoToneGradient id="tabby-muzzle" lit={TABBY_CREAM_LIT} base={TABBY_CREAM} shadow={TABBY_CREAM_SHADOW} />
        </Defs>
        <Path
          d={
            isRuffled
              ? 'M 30 43 C 30 26, 42 21, 56 21 C 70 21, 81 27, 81 44 L 84 47 L 80 50 C 78 58, 68 62, 56 62 C 42 62, 32 58, 30 49 L 27 46 Z'
              : 'M 30 44 C 30 26, 42 21, 56 21 C 70 21, 81 27, 81 44 C 81 55, 70 62, 56 62 C 41 62, 29 55, 30 44 Z'
          }
          fill="url(#tabby-head)"
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Warm top-left rim sheen */}
        <Path
          d="M 36 30 C 42 24, 51 23, 59 24"
          stroke="#FFFDF5"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
        {/* Classic tabby 'M' forehead stripes shifted 3/4 right */}
        <Path
          d="M 49 23 L 51 30 M 56 22 L 56 31 M 63 23 L 61 30"
          stroke={TABBY_STRIPE}
          strokeWidth={2.8}
          strokeLinecap="round"
        />
        <Ellipse cx={58} cy={51.5} rx={12.5} ry={7.5} fill="url(#tabby-muzzle)" />

        <G stroke={STROKE} strokeWidth={2.1} strokeLinecap="round">
          <Line x1={23} y1={45} x2={34} y2={47} />
          <Line x1={22} y1={51} x2={34} y2={51} />
          <Line x1={89} y1={44} x2={77} y2={47} />
          <Line x1={90} y1={51} x2={77} y2={51} />
        </G>

        <CreatureEyes
          expression={expression}
          blinkStage={blinkStage}
          gazeOffset={gazeOffset}
          lidFill={TABBY_ORANGE}
          leftX={46}
          rightX={68}
          y={41.5}
          radius={4.6}
        />

        {/* Cute pink triangle nose shifted right */}
        <Polygon
          points="54.8,47.5 61.2,47.5 58,51.2"
          fill={NOSE_PINK}
          stroke={STROKE}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {isCheering ? (
          <Path
            d="M 52.5 52 Q 58 60.5 63.5 52 Z"
            fill={NOSE_PINK}
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        ) : isHurt ? (
          <Path
            d="M 51.5 54.5 Q 54.8 51.5 58 54.5 Q 61.2 51.5 64.5 54.5"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        ) : expression === 'panic' ? (
          <Circle cx={58} cy={54.5} r={3} fill={NOSE_PINK} stroke={STROKE} strokeWidth={2} />
        ) : (
          <Path
            d="M 51.8 52.8 Q 55 56.5 58 52.5 Q 61 56.5 64.2 52.8"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </RigLayer>

      {/* 6. Asymmetric Swipe Paw Forward-Right + Braced Rear Paw (with connected orange forearm for attached pounce swipes) */}
      <RigLayer skipAutoLighting style={pawStyle}>
        <Defs>
          <TwoToneGradient id="tabby-paw" lit={TABBY_CREAM_LIT} base={TABBY_CREAM} shadow={TABBY_CREAM_SHADOW} />
          <TwoToneGradient id="tabby-arm" lit={TABBY_LIT} base={TABBY_ORANGE} shadow={TABBY_SHADOW} />
        </Defs>
        <G>
          {/* Grounded back support paw */}
          <Ellipse cx={40} cy={87} rx={7.2} ry={4.6} fill="url(#tabby-paw)" stroke={STROKE} strokeWidth={2.8} />
          {/* Connected orange foreleg bridging chest to raised swipe paw */}
          <Path
            d="M 62 72 C 67 69, 73 68, 77 70 C 77 75, 71 78, 63 79 Z"
            fill="url(#tabby-arm)"
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          {/* Raised asymmetrical combat swipe paw reaching right */}
          <Ellipse cx={77} cy={71} rx={7.2} ry={5.6} fill="url(#tabby-paw)" stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={79} cy={71.5} r={2} fill={NOSE_PINK} />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};
