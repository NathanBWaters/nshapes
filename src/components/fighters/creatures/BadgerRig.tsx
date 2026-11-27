import React from 'react';
import { Circle, Defs, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isHurtExpression } from '@/components/creatures/expressions';
import { STROKE, TwoToneGradient } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { CreatureEyes } from './FacialFeatures';
import { CreatureRigProps } from './types';

const BADGER_LIT = '#475569';
const BADGER_CHARCOAL = '#334155';
const BADGER_SHADOW = '#1E293B';
const BADGER_ASH_LIT = '#94A3B8';
const BADGER_ASH = '#64748B';
const BADGER_ASH_SHADOW = '#475569';
const STRIPE_LIT = '#FFFFFF';
const STRIPE_WHITE = '#F8FAFC';
const STRIPE_SHADOW = '#CBD5E1';

/**
 * [UI-05] & [UI-07] Badger — wide low-center-of-gravity brawler hunch,
 * staggered raised boxing fists (lead guard fist forward-right, rear uppercut
 * fist cocked left), bold black/white war-stripes, and 2-tone overhead lighting.
 */
export const BadgerRig: React.FC<CreatureRigProps> = ({
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
  const isHurt = isHurtExpression(expression);
  const isBrawlerGrit =
    healthState === 'scuffed' || healthState === 'battered' || healthState === 'critical';

  return (
    <RigLayerStack silhouette={silhouette} facing="right">
      {/* 1. Stubby White-Tipped Badger Tail tucked left (pivots at 20, 74) */}
      <RigLayer skipAutoLighting style={tailStyle}>
        <Defs>
          <TwoToneGradient id="badger-tail" lit={BADGER_ASH_LIT} base={BADGER_ASH} shadow={BADGER_ASH_SHADOW} />
        </Defs>
        <Path
          d="M 24 76 C 14 78, 7 71, 9 63 C 11 58, 18 61, 23 70 Z"
          fill="url(#badger-tail)"
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Circle cx={11} cy={65} r={3.5} fill={STRIPE_LIT} />
      </RigLayer>

      {/* 2. Wide Hunched Brawler Torso + Champion Gold Belt Buckle */}
      <RigLayer skipAutoLighting>
        <Defs>
          <TwoToneGradient id="badger-body" lit={BADGER_LIT} base={BADGER_CHARCOAL} shadow={BADGER_SHADOW} />
          <TwoToneGradient id="badger-chest" lit={BADGER_ASH_LIT} base={BADGER_ASH} shadow={BADGER_ASH_SHADOW} />
        </Defs>
        <Path
          d="M 22 54 C 15 65, 17 85, 30 89 L 69 89 C 79 85, 80 68, 74 56 Z"
          fill="url(#badger-body)"
          stroke={STROKE}
          strokeWidth={3.4}
          strokeLinejoin="round"
        />
        {/* Broad hunched shoulder highlight */}
        <Path
          d="M 23 62 C 26 55, 34 52, 42 52"
          stroke="#CBD5E1"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.45}
        />
        <Ellipse cx={53} cy={76} rx={16.5} ry={11} fill="url(#badger-chest)" />
        {/* Champion gold belt buckle */}
        <Path d="M 26 80 Q 52 84 73 79" stroke={STROKE} strokeWidth={4} fill="none" />
        <Polygon
          points="50,79 58,79 57,85 51,85"
          fill={COLORS.actionYellow}
          stroke={STROKE}
          strokeWidth={1.8}
        />
        {/* Grounded wide brawler boots */}
        <Ellipse cx={34} cy={88} rx={8.5} ry={4.5} fill={BADGER_SHADOW} stroke={STROKE} strokeWidth={2.7} />
        <Ellipse cx={64} cy={88} rx={8.5} ry={4.5} fill={BADGER_SHADOW} stroke={STROKE} strokeWidth={2.7} />
      </RigLayer>

      {/* 3. Low White-Rimmed Left Badger Ear (pivots at 34, 26) */}
      <RigLayer skipAutoLighting style={leftEarStyle}>
        <Circle cx={32} cy={25} r={8.2} fill={STRIPE_LIT} stroke={STROKE} strokeWidth={3.2} />
        <Circle cx={32} cy={25.5} r={4.3} fill={BADGER_CHARCOAL} />
      </RigLayer>

      {/* 4. Low White-Rimmed Right Badger Ear (pivots at 75, 26) */}
      <RigLayer skipAutoLighting style={rightEarStyle}>
        <Circle cx={75} cy={25.5} r={8} fill={STRIPE_LIT} stroke={STROKE} strokeWidth={3.2} />
        <Circle cx={75} cy={26} r={4.2} fill={BADGER_CHARCOAL} />
      </RigLayer>

      {/* 5. Broad Forward-Hunched Wedge Head & War-Stripes (pivots at 55, 44) */}
      <RigLayer skipAutoLighting style={headStyle}>
        <Defs>
          <TwoToneGradient id="badger-head" lit={STRIPE_LIT} base={STRIPE_WHITE} shadow={STRIPE_SHADOW} />
        </Defs>
        <Path
          d="M 55 20 C 70 20, 82 29, 83 46 C 83 56, 72 62, 55 62 C 37 62, 26 56, 27 46 C 28 29, 40 20, 55 20 Z"
          fill="url(#badger-head)"
          stroke={STROKE}
          strokeWidth={3.4}
          strokeLinejoin="round"
        />
        {/* Bold twin dark war-stripes sweeping over 3/4 right-shifted eyes */}
        <Path
          d="M 43 21 C 36 27, 34 43, 38 55 L 50 53 C 49 41, 49 28, 51 21 Z"
          fill={STROKE}
        />
        <Path
          d="M 66 21 C 73 27, 75 43, 71 55 L 61 53 C 62 41, 62 28, 60 21 Z"
          fill={STROKE}
        />

        <CreatureEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={45}
          rightX={68}
          y={41.5}
          radius={4.3}
          darkMask={true}
        />

        {/* Broad tough snout pad shifted 3/4 right */}
        <Ellipse cx={58} cy={49.5} rx={5.2} ry={3.5} fill={STROKE} />
        <Circle cx={56.5} cy={48.5} r={1.1} fill={STRIPE_LIT} />

        {isCheering ? (
          <G>
            <Path
              d="M 49 54 Q 58 62 67 54 Z"
              fill="#FF7169"
              stroke={STROKE}
              strokeWidth={2.3}
              strokeLinejoin="round"
            />
            <Polygon points="51,54.5 53.5,54.5 52.2,57.5" fill={STRIPE_LIT} />
            <Polygon points="62.5,54.5 65,54.5 63.8,57.5" fill={STRIPE_LIT} />
          </G>
        ) : isHurt ? (
          <Path
            d="M 50 56.5 L 54 54 L 58 56.5 L 62 54 L 66 56.5"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : (
          <G>
            <Path
              d={isBrawlerGrit ? 'M 50 55.5 L 66 54.5' : 'M 50.5 55.5 Q 58 57 65.5 54'}
              stroke={STROKE}
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
            />
            <Polygon
              points="61.5,55 65,54.6 63.3,50.8"
              fill={STRIPE_LIT}
              stroke={STROKE}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </G>
        )}
      </RigLayer>

      {/* 6. Staggered Raised Boxing Fists — unmistakable brawler silhouette! */}
      <RigLayer skipAutoLighting style={pawStyle}>
        <Defs>
          <TwoToneGradient id="badger-fist" lit={BADGER_LIT} base={BADGER_CHARCOAL} shadow={BADGER_SHADOW} />
        </Defs>
        {isCheering ? (
          <G>
            <Circle cx={22} cy={52} r={7.4} fill="url(#badger-fist)" stroke={STROKE} strokeWidth={3} />
            <Line x1={19} y1={46} x2={19} y2={49.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={22} y1={45} x2={22} y2={49} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={25} y1={46} x2={25} y2={49.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />

            <Circle cx={85} cy={49} r={7.8} fill="url(#badger-fist)" stroke={STROKE} strokeWidth={3} />
            <Line x1={82} y1={43} x2={82} y2={46.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={85} y1={42} x2={85} y2={46} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={88} y1={43} x2={88} y2={46.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            {/* Rear cocked uppercut fist on the left */}
            <Circle cx={21} cy={70} r={7.5} fill="url(#badger-fist)" stroke={STROKE} strokeWidth={3} />
            <Line x1={18} y1={65} x2={18} y2={68.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={21} y1={64} x2={21} y2={68} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={24} y1={65} x2={24} y2={68.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />

            {/* Lead raised guard boxing fist jutting forward-right */}
            <Circle cx={85} cy={61} r={8.2} fill="url(#badger-fist)" stroke={STROKE} strokeWidth={3} />
            <Line x1={82} y1={55} x2={82} y2={58.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={85} y1={54} x2={85} y2={58} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
            <Line x1={88} y1={55} x2={88} y2={58.5} stroke={STRIPE_LIT} strokeWidth={2} strokeLinecap="round" />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};
