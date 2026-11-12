import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isBattleWorn, isFierceExpression, isHurtExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { EnemyExpression } from '@/utils/enemyAnimations';
import { EnemyEyes } from '../EnemyEyes';
import { EnemyRigProps } from './types';

interface PredatorMawProps {
  expression: EnemyExpression;
  cx?: number;
  y?: number;
  width?: number;
  fangSize?: number;
  manicGrin?: boolean;
  strokeColor?: string;
}

/**
 * Shared dynamic predator fanged maw / roar / wince / snooze renderer.
 */
const PredatorMaw: React.FC<PredatorMawProps> = ({
  expression,
  cx = 50,
  y = 54.5,
  width = 8.5,
  fangSize = 4.6,
  manicGrin = false,
  strokeColor = STROKE,
}) => {
  const isFierce = isFierceExpression(expression);
  const isHurt = isHurtExpression(expression);
  const isSleepy = expression === 'sleepy';

  if (isSleepy) {
    return (
      <Circle
        cx={cx}
        cy={y + 1.5}
        r={2.6}
        fill="#FB7185"
        stroke={strokeColor}
        strokeWidth={2}
      />
    );
  }

  if (isHurt) {
    return (
      <Path
        d={`M ${cx - width} ${y + 2.2} L ${cx - width * 0.5} ${y - 0.8} L ${cx} ${y + 2.2} L ${cx + width * 0.5} ${y - 0.8} L ${cx + width} ${y + 2.2}`}
        stroke={strokeColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }

  if (isFierce || manicGrin) {
    return (
      <G>
        <Path
          d={`M ${cx - width * 1.15} ${y - 0.8} Q ${cx} ${y + 9.5} ${cx + width * 1.15} ${y - 0.8} Z`}
          fill="#7F1D1D"
          stroke={strokeColor}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <Path
          d={`M ${cx - width * 0.55} ${y + 5.4} Q ${cx} ${y + 2.5} ${cx + width * 0.55} ${y + 5.4}`}
          fill="#F43F5E"
        />
        {/* Upper predator fangs */}
        <Polygon
          points={`${cx - width * 0.78},${y - 0.4} ${cx - width * 0.4},${y - 0.2} ${cx - width * 0.58},${y + fangSize}`}
          fill="#FFFFFF"
          stroke={strokeColor}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <Polygon
          points={`${cx + width * 0.4},${y - 0.2} ${cx + width * 0.78},${y - 0.4} ${cx + width * 0.58},${y + fangSize}`}
          fill="#FFFFFF"
          stroke={strokeColor}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {/* Lower teeth row */}
        <Polygon
          points={`${cx - width * 0.3},${y + 5.8} ${cx},${y + 3.2} ${cx + width * 0.3},${y + 5.8}`}
          fill="#FEF2F2"
        />
      </G>
    );
  }

  return (
    <G>
      <Path
        d={`M ${cx - width} ${y + 1.2} Q ${cx - width * 0.4} ${y - 1.2} ${cx} ${y + 0.8} Q ${cx + width * 0.5} ${y + 2.8} ${cx + width * 1.05} ${y - 1}`}
        stroke={strokeColor}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
      <Polygon
        points={`${cx - width * 0.78},${y + 0.5} ${cx - width * 0.42},${y + 0.6} ${cx - width * 0.6},${y + fangSize}`}
        fill="#FFFFFF"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Polygon
        points={`${cx + width * 0.42},${y + 0.7} ${cx + width * 0.78},${y + 0.2} ${cx + width * 0.6},${y + fangSize}`}
        fill="#FFFFFF"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </G>
  );
};

/**
 * Stalking Wolf & Prowling Direwolf rigs
 */
export const WolfRig: React.FC<EnemyRigProps<'dire'>> = ({
  variant,
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const isDire = variant === 'dire';
  const coat = isDire ? '#1E293B' : '#64748B';
  const chest = isDire ? '#475569' : '#E2E8F0';
  const innerEar = isDire ? '#991B1B' : '#CBD5E1';

  return (
    <RigLayerStack>
      {/* 1. Bushy Predator Wolf Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 63 81 C 84 82, 95 65, 89 45 L 83 49 L 81 42 C 74 49, 75 68, 61 74 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Path d="M 89 45 L 83 49 L 81 42 Q 86 41 89 45 Z" fill={chest} />
      </RigLayer>

      {/* 2. Muscular Torso + Jagged Direwolf Neck Ruff */}
      <RigLayer>
        <Path
          d={
            isDire
              ? 'M 26 56 C 20 69, 22 86, 33 89 L 67 89 C 78 86, 80 69, 74 56 Z'
              : 'M 30 58 C 24 69, 25 86, 35 89 L 65 89 C 75 86, 76 69, 70 58 Z'
          }
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Jagged neck ruff for Prowling Direwolf */}
        {isDire ? (
          <Polygon
            points="23,58 17,65 29,66 26,74 39,69 50,79 61,69 74,74 71,66 83,65 77,58"
            fill="#0F172A"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
        ) : (
          <Polygon
            points="34,60 42,74 50,68 58,74 66,60"
            fill={chest}
          />
        )}
        <Ellipse cx={50} cy={78} rx={11} ry={8.5} fill={chest} />
      </RigLayer>

      {/* 3. Swept Left Wolf Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled || isDire ? 'M 25 35 L 18 9 L 29 16 L 26 20 L 40 24 Z' : 'M 25 35 L 19 9 L 40 24 Z'}
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Polygon points="26,31 22,15 35,25" fill={innerEar} />
      </RigLayer>

      {/* 4. Swept Right Wolf Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 75 35 L 81 9 L 60 24 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Polygon points="74,31 78,15 65,25" fill={innerEar} />
      </RigLayer>

      {/* 5. Fierce Lupine Head + Crimson Scar (Direwolf) + Hunter Eyes */}
      <RigLayer style={headStyle}>
        {/* Jagged wolf cheek fur silhouette */}
        <Path
          d="M 24 41 L 16 46 L 23 50 L 18 55 L 29 58 C 35 63, 43 65, 50 65 C 57 65, 65 63, 71 58 L 82 55 L 77 50 L 84 46 L 76 41 C 74 26, 63 21, 50 21 C 37 21, 26 26, 24 41 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Wolf facial mask */}
        <Path
          d="M 33 49 C 33 41, 41 44, 50 48 C 59 44, 67 41, 67 49 C 67 59, 59 63, 50 63 C 41 63, 33 59, 33 49 Z"
          fill={chest}
        />

        {/* Crimson battle scar on Prowling Direwolf */}
        {isDire && (
          <G stroke="#EF4444" strokeWidth={2.8} strokeLinecap="round">
            <Line x1={33} y1={31} x2={43} y2={52} />
            <Line x1={34} y1={37} x2={40} y2={35} />
            <Line x1={37} y1={45} x2={43} y2={43} />
          </G>
        )}

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={41.5}
          radius={4.6}
          darkMask={isDire}
          irisColor={isDire ? '#EF4444' : '#F59E0B'}
        />

        {/* Angular black lupine nose */}
        <Polygon
          points="45.5,47.5 54.5,47.5 50,52"
          fill="#0F172A"
          stroke={STROKE}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        <PredatorMaw
          expression={expression}
          y={54}
          width={isDire ? 9.5 : 8}
          fangSize={isDire ? 6 : 4.6}
        />
      </RigLayer>

      {/* 6. Clawed Lupine Paws */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -14)' : undefined}>
          <Ellipse cx={38} cy={86.5} rx={7.2} ry={4.8} fill={chest} stroke={STROKE} strokeWidth={2.8} />
          <Ellipse cx={62} cy={86.5} rx={7.2} ry={4.8} fill={chest} stroke={STROKE} strokeWidth={2.8} />
          <Path
            d="M 34 86 L 33 90 M 38 87 L 38 91 M 42 86 L 43 90 M 58 86 L 57 90 M 62 87 L 62 91 M 66 86 L 67 90"
            stroke={STROKE}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Cackling Hyena, Pickpocket Hyena, Haggling Hyena & Hyena Boss rigs
 */
export const HyenaRig: React.FC<EnemyRigProps<'pickpocket' | 'haggling' | 'boss'>> = ({
  variant,
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const isPickpocket = variant === 'pickpocket';
  const isHaggling = variant === 'haggling';
  const isBoss = variant === 'boss';

  const ochre = isBoss ? '#B45309' : '#D97706';
  const belly = '#FDE68A';
  const spot = '#451A03';
  const mane = '#292524';

  return (
    <RigLayerStack>
      {/* 1. Bristling Hyena Brush Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 65 80 C 81 79, 90 67, 86 53 L 81 57 L 78 51 C 74 59, 73 71, 63 75 Z"
          fill={mane}
          stroke={STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Spotted Savanna Body + Bandana (Pickpocket) / Gold Chain (Boss) */}
      <RigLayer>
        <Path
          d="M 29 58 C 23 69, 24 86, 35 89 L 65 89 C 76 86, 77 69, 71 58 Z"
          fill={ochre}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={76} rx={12} ry={10} fill={belly} />
        {/* Signature spotted hyena markings */}
        <Circle cx={32} cy={70} r={2.5} fill={spot} />
        <Circle cx={35} cy={79} r={2.1} fill={spot} />
        <Circle cx={68} cy={71} r={2.6} fill={spot} />
        <Circle cx={65} cy={80} r={2} fill={spot} />

        {/* Pickpocket Hyena Crimson Rogue Bandana */}
        {isPickpocket && (
          <G>
            <Polygon
              points="31,60 69,60 50,76"
              fill="#DC2626"
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
            <Path d="M 43 63 L 50 69 L 57 63" stroke="#FCA5A5" strokeWidth={1.8} fill="none" />
          </G>
        )}

        {/* Hyena Boss Heavy Gold Chain & Medallion */}
        {isBoss && (
          <G>
            <Path
              d="M 33 61 Q 50 76 67 61"
              stroke={COLORS.actionYellow}
              strokeWidth={5.2}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 33 61 Q 50 76 67 61"
              stroke={STROKE}
              strokeWidth={1.6}
              strokeDasharray="4 3"
              fill="none"
            />
            <Circle cx={50} cy={73} r={5.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.3} />
            <Polygon points="50,70 52,74 48,74" fill="#DC2626" />
          </G>
        )}
      </RigLayer>

      {/* 3. Big Rounded Left Hyena Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={
            isRuffled || isBoss
              ? 'M 28 36 C 14 31, 13 13, 24 11 L 26 17 L 30 12 C 38 14, 40 25, 37 32 Z'
              : 'M 28 36 C 14 31, 13 12, 26 11 C 37 10, 40 23, 37 32 Z'
          }
          fill={ochre}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Ellipse cx={27} cy={22.5} rx={5.5} ry={6.8} fill={mane} />
      </RigLayer>

      {/* 4. Big Rounded Right Hyena Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 72 36 C 86 31, 87 12, 74 11 C 63 10, 60 23, 63 32 Z"
          fill={ochre}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Ellipse cx={73} cy={22.5} rx={5.5} ry={6.8} fill={mane} />
      </RigLayer>

      {/* 5. Hyena Head + Mohawk Crest + Fez/Monocle (Haggling) + Gold Crown (Boss) */}
      <RigLayer style={headStyle}>
        {/* Dark bristling mohawk crest */}
        <Polygon
          points="41,25 44,12 48,19 51,9 55,19 59,13 60,25"
          fill={mane}
          stroke={STROKE}
          strokeWidth={2.7}
          strokeLinejoin="round"
        />

        {/* Head silhouette */}
        <Path
          d="M 25 44 C 25 27, 36 22, 50 22 C 64 22, 75 27, 75 44 C 76 56, 64 64, 50 64 C 36 64, 24 56, 25 44 Z"
          fill={ochre}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Forehead spots */}
        <Circle cx={33} cy={34} r={2} fill={spot} />
        <Circle cx={67} cy={35} r={2.2} fill={spot} />

        {/* Dark hyena snout saddle */}
        <Ellipse cx={50} cy={53.5} rx={14} ry={9} fill={mane} />

        {/* Merchant Fez on Haggling Hyena */}
        {isHaggling && (
          <G>
            <Polygon
              points="39,24 42,9 58,9 61,24"
              fill="#DC2626"
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
            <Path d="M 50 9 Q 63 9 65 20" stroke={COLORS.actionYellow} strokeWidth={2.4} strokeLinecap="round" fill="none" />
            <Circle cx={65} cy={21} r={2.4} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.5} />
          </G>
        )}

        {/* Jagged Gold Crown on Hyena Boss */}
        {isBoss && (
          <G>
            <Polygon
              points="35,25 33,10 43,17 50,7 57,17 67,10 65,25"
              fill={COLORS.actionYellow}
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
            <Circle cx={50} cy={19} r={2.6} fill="#EF4444" stroke={STROKE} strokeWidth={1.4} />
          </G>
        )}

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={41.5}
          radius={4.7}
          irisColor={isBoss ? '#EF4444' : '#FACC15'}
        />

        {/* Brass Monocle on Haggling Hyena */}
        {isHaggling && (
          <G>
            <Circle
              cx={61.5}
              cy={41.5}
              r={7.2}
              fill="#BAE6FD"
              fillOpacity={0.28}
              stroke="#F59E0B"
              strokeWidth={2.5}
            />
            <Path d="M 68.5 43 Q 72 52 69 60" stroke="#F59E0B" strokeWidth={1.8} fill="none" />
          </G>
        )}

        <Ellipse cx={50} cy={48.5} rx={4.2} ry={2.8} fill="#0F172A" stroke={STROKE} strokeWidth={1.5} />

        {/* Signature manic toothy hyena grin */}
        <PredatorMaw expression={expression} y={53.8} width={9} manicGrin strokeColor="#0F172A" />
      </RigLayer>

      {/* 6. Hyena Paws + Rogue Coin (Pickpocket) */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          {isPickpocket && (
            <Circle cx={50} cy={80} r={5.2} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
          )}
          <Ellipse cx={39} cy={86} rx={6.8} ry={4.6} fill={mane} stroke={STROKE} strokeWidth={2.7} />
          <Ellipse cx={61} cy={86} rx={6.8} ry={4.6} fill={mane} stroke={STROKE} strokeWidth={2.7} />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Charging Boar & Armored Tusks rigs
 */
export const BoarRig: React.FC<EnemyRigProps<'armored'>> = ({
  variant,
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const isArmored = variant === 'armored';
  const russet = isArmored ? '#6C2A14' : '#853517';
  const bristle = '#3B1306';

  return (
    <RigLayerStack>
      {/* 1. Tufted Warthog Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 68 78 Q 84 72 86 55"
          stroke={russet}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Polygon
          points="86,56 81,46 86,49 91,45 89,56"
          fill={bristle}
          stroke={STROKE}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Stocky Boar Body + Steel Shoulder Plates (Armored Tusks) */}
      <RigLayer>
        <Path
          d="M 25 56 C 19 69, 21 86, 33 89 L 67 89 C 79 86, 81 69, 75 56 Z"
          fill={russet}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={76} rx={13} ry={9.5} fill="#A85532" />

        {isArmored && (
          <G>
            {/* Riveted steel shoulder pauldrons */}
            <Path
              d="M 19 60 C 18 51, 30 50, 37 59 L 33 71 L 19 68 Z"
              fill="#94A3B8"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Path
              d="M 81 60 C 82 51, 70 50, 63 59 L 67 71 L 81 68 Z"
              fill="#94A3B8"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Circle cx={25} cy={63} r={1.6} fill={STROKE} />
            <Circle cx={75} cy={63} r={1.6} fill={STROKE} />
          </G>
        )}
      </RigLayer>

      {/* 3. Bristled Left Boar Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled ? 'M 26 35 L 13 19 L 23 21 L 21 25 L 36 26 Z' : 'M 26 35 L 13 18 L 36 26 Z'}
          fill={russet}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Polygon points="25,31 18,22 32,27" fill="#FCA5A5" />
      </RigLayer>

      {/* 4. Bristled Right Boar Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 74 35 L 87 18 L 64 26 Z"
          fill={russet}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Polygon points="75,31 82,22 68,27" fill="#FCA5A5" />
      </RigLayer>

      {/* 5. Head + Iron War-Helm (Armored Tusks) + Curved Tusks + Flat Snout */}
      <RigLayer style={headStyle}>
        {/* Dorsal bristle ridge */}
        <Polygon
          points="40,24 44,13 50,18 56,13 60,24"
          fill={bristle}
          stroke={STROKE}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />

        {/* Broad warthog head */}
        <Path
          d="M 23 45 C 23 27, 35 22, 50 22 C 65 22, 77 27, 77 45 C 78 57, 66 64, 50 64 C 34 64, 22 57, 23 45 Z"
          fill={russet}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />

        {/* Riveted Iron War-Helm on Armored Tusks */}
        {isArmored && (
          <G>
            <Path
              d="M 24 38 C 25 22, 36 18, 50 18 C 64 18, 75 22, 76 38 L 54 38 L 50 47 L 46 38 Z"
              fill="#64748B"
              stroke={STROKE}
              strokeWidth={2.9}
              strokeLinejoin="round"
            />
            <Polygon points="47,19 50,8 53,19" fill="#CBD5E1" stroke={STROKE} strokeWidth={2.3} strokeLinejoin="round" />
            <Circle cx={33} cy={33} r={1.5} fill="#E2E8F0" />
            <Circle cx={67} cy={33} r={1.5} fill="#E2E8F0" />
          </G>
        )}

        {/* Curved white tusks (iron-capped mega-tusks on Armored Tusks!) */}
        <Path
          d={
            isArmored
              ? 'M 33 56 C 18 55, 13 40, 20 31 C 22 39, 27 48, 36 51 Z'
              : isRuffled
                ? 'M 34 56 C 23 55, 19 45, 23 40 L 26 43 C 27 48, 30 51, 36 52 Z'
                : 'M 34 56 C 22 55, 18 43, 24 36 C 25 43, 29 49, 36 52 Z'
          }
          fill="#FEF3C7"
          stroke={STROKE}
          strokeWidth={2.7}
          strokeLinejoin="round"
        />
        <Path
          d={
            isArmored
              ? 'M 67 56 C 82 55, 87 40, 80 31 C 78 39, 73 48, 64 51 Z'
              : 'M 66 56 C 78 55, 82 43, 76 36 C 75 43, 71 49, 64 52 Z'
          }
          fill="#FEF3C7"
          stroke={STROKE}
          strokeWidth={2.7}
          strokeLinejoin="round"
        />
        {isArmored && (
          <G fill="#94A3B8" stroke={STROKE} strokeWidth={2}>
            <Polygon points="20,31 16,39 24,41" />
            <Polygon points="80,31 84,39 76,41" />
          </G>
        )}

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={37.5}
          rightX={62.5}
          y={41}
          radius={4.4}
          irisColor={isArmored ? '#EF4444' : '#F59E0B'}
        />

        {/* Flat snorting boar snout disc */}
        <Ellipse
          cx={50}
          cy={50.5}
          rx={10.5}
          ry={6.8}
          fill="#FCA5A5"
          stroke={STROKE}
          strokeWidth={2.5}
        />
        <Ellipse cx={46} cy={50.5} rx={2.2} ry={3} fill={bristle} />
        <Ellipse cx={54} cy={50.5} rx={2.2} ry={3} fill={bristle} />

        <PredatorMaw expression={expression} y={58.5} width={6.8} fangSize={3.2} />
      </RigLayer>

      {/* 6. Cloven Charging Hooves */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          <Path
            d="M 32 82 L 44 82 L 45 90 L 39 87 L 37 90 L 31 90 Z"
            fill={bristle}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Path
            d="M 56 82 L 68 82 L 69 90 L 63 90 L 61 87 L 55 90 Z"
            fill={bristle}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Polar Guardian & Raging Bear rigs
 */
export const BearRig: React.FC<EnemyRigProps<'polar'>> = ({
  variant,
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const isPolar = variant === 'polar';
  const coat = isPolar ? '#F8FAFC' : '#5C3419';
  const muzzle = isPolar ? '#E0F2FE' : '#B45309';

  return (
    <RigLayerStack>
      {/* 1. Frost Shards (Polar) / Crimson Fury Spikes (Raging Bear) */}
      <RigLayer style={tailStyle}>
        {isPolar ? (
          <G>
            <Circle cx={73} cy={78} r={6.5} fill={coat} stroke={STROKE} strokeWidth={2.8} />
            <Polygon
              points="18,48 8,36 24,39"
              fill="#7DD3FC"
              fillOpacity={0.85}
              stroke={STROKE}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
            <Polygon
              points="82,48 92,36 76,39"
              fill="#7DD3FC"
              fillOpacity={0.85}
              stroke={STROKE}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
          </G>
        ) : (
          <G>
            {/* Crimson fury spikes radiating from Raging Bear */}
            <Polygon
              points="19,58 7,46 23,45 14,30 30,36 50,10 70,36 86,30 77,45 93,46 81,58"
              fill="#DC2626"
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
          </G>
        )}
      </RigLayer>

      {/* 2. Colossal Bear Torso + Translucent Ice Armor (Polar) / Battle Scars (Raging) */}
      <RigLayer>
        <Path
          d="M 23 55 C 16 69, 19 87, 32 90 L 68 90 C 81 87, 84 69, 77 55 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75} rx={15} ry={11} fill={muzzle} />

        {isPolar ? (
          <G>
            {/* Translucent cyan ice-crystal shoulder armor */}
            <Polygon
              points="17,64 13,49 27,45 37,57 30,69"
              fill="#38BDF8"
              fillOpacity={0.82}
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
            <Polygon points="17,52 25,48 28,57" fill="#E0F2FE" fillOpacity={0.85} />
            <Polygon
              points="83,64 87,49 73,45 63,57 70,69"
              fill="#38BDF8"
              fillOpacity={0.82}
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
            <Polygon points="83,52 75,48 72,57" fill="#E0F2FE" fillOpacity={0.85} />
          </G>
        ) : (
          <G stroke="#EF4444" strokeWidth={2.8} strokeLinecap="round">
            {/* Grizzly chest claw scars */}
            <Line x1={42} y1={68} x2={56} y2={79} />
            <Line x1={45} y1={65} x2={59} y2={76} />
          </G>
        )}
      </RigLayer>

      {/* 3. Round Left Bear Ear */}
      <RigLayer style={leftEarStyle}>
        <Circle cx={26} cy={26} r={8.8} fill={coat} stroke={STROKE} strokeWidth={3.2} />
        <Circle cx={26.5} cy={26.5} r={4.6} fill={isPolar ? '#BAE6FD' : muzzle} />
        {(isRuffled || !isPolar) && (
          <Polygon points="16,23 21,26 17,29" fill={COLORS.paperBeige} stroke={STROKE} strokeWidth={2} />
        )}
      </RigLayer>

      {/* 4. Round Right Bear Ear */}
      <RigLayer style={rightEarStyle}>
        <Circle cx={74} cy={26} r={8.8} fill={coat} stroke={STROKE} strokeWidth={3.2} />
        <Circle cx={73.5} cy={26.5} r={4.6} fill={isPolar ? '#BAE6FD' : muzzle} />
      </RigLayer>

      {/* 5. Massive Bear Head + Glowing Eyes + Roaring Maw */}
      <RigLayer style={headStyle}>
        <Path
          d="M 22 44 C 22 25, 34 20, 50 20 C 66 20, 78 25, 78 44 C 79 57, 67 64, 50 64 C 33 64, 21 57, 22 44 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={52.5} rx={14} ry={9.2} fill={muzzle} />

        {!isPolar && (
          <Line x1={58} y1={29} x2={66} y2={46} stroke="#EF4444" strokeWidth={2.7} strokeLinecap="round" />
        )}

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38}
          rightX={62}
          y={40.5}
          radius={4.7}
          irisColor={isPolar ? '#0284C7' : '#EF4444'}
        />

        <Ellipse cx={50} cy={47.5} rx={5.2} ry={3.4} fill="#0F172A" stroke={STROKE} strokeWidth={1.6} />

        <PredatorMaw
          expression={expression}
          y={53.8}
          width={isPolar ? 8.2 : 10}
          fangSize={isPolar ? 4.6 : 6.2}
          manicGrin={!isPolar}
        />
      </RigLayer>

      {/* 6. Heavy Bear Claws */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -15)' : undefined}>
          <Ellipse cx={35} cy={85} rx={8.5} ry={5.5} fill={coat} stroke={STROKE} strokeWidth={2.9} />
          <Ellipse cx={65} cy={85} rx={8.5} ry={5.5} fill={coat} stroke={STROKE} strokeWidth={2.9} />
          <G fill={isPolar ? '#BAE6FD' : '#F8FAFC'} stroke={STROKE} strokeWidth={1.5}>
            <Polygon points="30,85 29,92 33,87" />
            <Polygon points="35,86 35,93 38,87" />
            <Polygon points="40,85 41,92 37,87" />
            <Polygon points="60,85 59,92 63,87" />
            <Polygon points="65,86 65,93 68,87" />
            <Polygon points="70,85 71,92 67,87" />
          </G>
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Fierce Wolverine rig
 */
export const WolverineRig: React.FC<EnemyRigProps> = ({
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const umber = '#2E1E17';
  const goldMask = '#F59E0B';

  return (
    <RigLayerStack>
      {/* 1. Bushy Dark-Umber Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 64 80 C 83 80, 92 65, 86 50 C 82 42, 74 47, 75 56 C 75 65, 70 72, 62 74 Z"
          fill={umber}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Stocky Wolverine Body with Golden-Tan Chest Band */}
      <RigLayer>
        <Path
          d="M 26 57 C 20 69, 22 86, 33 89 L 67 89 C 78 86, 80 69, 74 57 Z"
          fill={umber}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path
          d="M 28 66 Q 50 78 72 66 L 74 73 Q 50 85 26 73 Z"
          fill={goldMask}
        />
      </RigLayer>

      {/* 3. Low Rounded Left Ear */}
      <RigLayer style={leftEarStyle}>
        <Circle cx={27} cy={29} r={7} fill={umber} stroke={STROKE} strokeWidth={3} />
        <Circle cx={27.5} cy={29.5} r={3.6} fill={goldMask} />
        {isRuffled && <Line x1={19} y1={27} x2={24} y2={29} stroke={STROKE} strokeWidth={2.2} />}
      </RigLayer>

      {/* 4. Low Rounded Right Ear */}
      <RigLayer style={rightEarStyle}>
        <Circle cx={73} cy={29} r={7} fill={umber} stroke={STROKE} strokeWidth={3} />
        <Circle cx={72.5} cy={29.5} r={3.6} fill={goldMask} />
      </RigLayer>

      {/* 5. Head with Golden-Tan Brow/Cheek Mask */}
      <RigLayer style={headStyle}>
        <Path
          d="M 23 44 L 18 49 L 24 54 C 29 61, 39 64, 50 64 C 61 64, 71 61, 76 54 L 82 49 L 77 44 C 75 27, 64 22, 50 22 C 36 22, 25 27, 23 44 Z"
          fill={umber}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Signature golden-tan wolverine brow & cheek mask */}
        <Path
          d="M 25 47 C 25 32, 37 28, 50 34 C 63 28, 75 32, 75 47 C 75 55, 66 56, 61 50 L 50 45 L 39 50 C 34 56, 25 55, 25 47 Z"
          fill="#FBBF24"
        />
        {/* Dark central eye saddle */}
        <Ellipse cx={50} cy={44} rx={16.5} ry={7.8} fill={umber} />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={42.5}
          radius={4.5}
          darkMask
          irisColor={goldMask}
        />

        <Ellipse cx={50} cy={49.5} rx={4.2} ry={2.8} fill="#0F172A" />
        <PredatorMaw expression={expression} y={54.5} width={8.5} strokeColor="#FDE68A" />
      </RigLayer>

      {/* 6. Gleaming Triple Steel-Bright Claws */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -14)' : undefined}>
          <Ellipse cx={33} cy={80} rx={6.8} ry={5} fill={umber} stroke={STROKE} strokeWidth={2.8} />
          <Ellipse cx={67} cy={80} rx={6.8} ry={5} fill={umber} stroke={STROKE} strokeWidth={2.8} />
          {/* Left triple steel claws */}
          <Polygon points="29,81 43,92 33,79" fill="#F8FAFC" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="33,83 47,94 37,81" fill="#E2E8F0" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="37,80 50,90 40,78" fill="#F8FAFC" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          {/* Right triple steel claws */}
          <Polygon points="71,81 57,92 67,79" fill="#F8FAFC" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="67,83 53,94 63,81" fill="#E2E8F0" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="63,80 50,90 60,78" fill="#F8FAFC" stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Ravenous Tapir rig
 */
export const TapirRig: React.FC<EnemyRigProps> = ({
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const charcoal = '#1E293B';
  const saddle = '#F8FAFC';

  return (
    <RigLayerStack>
      {/* 1. Stubby Tapir Rump Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 69 77 Q 80 76 79 84 Q 74 85 68 81 Z"
          fill={charcoal}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Two-Tone Charcoal Front & Cream Saddle Body */}
      <RigLayer>
        {/* Cream lower saddle body */}
        <Path
          d="M 28 57 C 22 69, 24 86, 35 89 L 65 89 C 76 86, 78 69, 72 57 Z"
          fill={saddle}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Charcoal upper forequarter cape */}
        <Path
          d="M 28 57 L 72 57 C 75 64, 75 70, 73 72 Q 50 67 27 72 C 25 70, 25 64, 28 57 Z"
          fill={charcoal}
          stroke={STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 3. White-Rimmed Rounded Left Tapir Ear */}
      <RigLayer style={leftEarStyle}>
        <Ellipse cx={27} cy={27} rx={8} ry={9.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Ellipse cx={28} cy={28.5} rx={5.2} ry={6.5} fill={charcoal} />
        {isRuffled && <Polygon points="18,24 23,26 19,29" fill={COLORS.paperBeige} stroke={STROKE} strokeWidth={1.8} />}
      </RigLayer>

      {/* 4. White-Rimmed Rounded Right Tapir Ear */}
      <RigLayer style={rightEarStyle}>
        <Ellipse cx={73} cy={27} rx={8} ry={9.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Ellipse cx={72} cy={28.5} rx={5.2} ry={6.5} fill={charcoal} />
      </RigLayer>

      {/* 5. Head + Flexible Prehensile Trunk Snout */}
      <RigLayer style={headStyle}>
        <Path
          d="M 26 44 C 26 27, 37 22, 50 22 C 63 22, 74 27, 74 44 C 74 56, 63 63, 50 63 C 37 63, 26 56, 26 44 Z"
          fill={charcoal}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={37.5}
          rightX={62.5}
          y={40.5}
          radius={4.5}
          darkMask
          irisColor="#F59E0B"
        />

        <PredatorMaw expression={expression} y={56} width={7.2} fangSize={3.6} strokeColor="#CBD5E1" />

        {/* Flexible overhanging prehensile tapir trunk snout */}
        <Path
          d="M 42 43 C 42 54, 45 61, 53 60 C 59 59, 60 52, 57 43"
          fill={charcoal}
          stroke={STROKE}
          strokeWidth={2.9}
          strokeLinejoin="round"
        />
        <Ellipse cx={53} cy={57.5} rx={4.5} ry={3} fill="#FDA4AF" stroke={STROKE} strokeWidth={1.8} />
        <Circle cx={51.5} cy={57.5} r={1.1} fill={charcoal} />
        <Circle cx={54.5} cy={57.5} r={1.1} fill={charcoal} />
      </RigLayer>

      {/* 6. Three-Toed Tapir Hooves */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          <Ellipse cx={38} cy={86.5} rx={7} ry={4.6} fill={charcoal} stroke={STROKE} strokeWidth={2.8} />
          <Ellipse cx={62} cy={86.5} rx={7} ry={4.6} fill={charcoal} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={35} cy={88.5} r={1.8} fill="#FFFFFF" />
          <Circle cx={38.5} cy={89} r={1.8} fill="#FFFFFF" />
          <Circle cx={59} cy={89} r={1.8} fill="#FFFFFF" />
          <Circle cx={62.5} cy={88.5} r={1.8} fill="#FFFFFF" />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Dusty Mammoth & Mammoth rigs
 */
export const MammothRig: React.FC<EnemyRigProps<'dusty'>> = ({
  variant,
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const isDusty = variant === 'dusty';
  const fur = isDusty ? '#92400E' : '#7C2D12';
  const furHighlight = isDusty ? '#FDE68A' : '#B45309';

  return (
    <RigLayerStack>
      {/* 1. Woolly Rump Tail + Canyon Dust Cloud (Dusty Mammoth) */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 72 72 Q 86 76 84 86 L 78 83 L 75 86 Z"
          fill={fur}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
        {isDusty && (
          <G opacity={0.85}>
            <Circle cx={17} cy={82} r={6} fill="#FDE68A" stroke={STROKE} strokeWidth={2} />
            <Circle cx={84} cy={80} r={6.5} fill="#FDE68A" stroke={STROKE} strokeWidth={2} />
          </G>
        )}
      </RigLayer>

      {/* 2. Massive Shaggy Woolly Coat */}
      <RigLayer>
        <Path
          d="M 21 53 C 16 68, 18 85, 25 89 L 33 85 L 41 89 L 50 85 L 59 89 L 67 85 L 75 89 C 82 85, 84 68, 79 53 Z"
          fill={fur}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {isDusty && (
          <Path
            d="M 25 63 Q 38 69 50 63 Q 62 69 75 63"
            stroke={furHighlight}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </RigLayer>

      {/* 3. Left Ear + Sweeping Curved Left Ivory Tusk */}
      <RigLayer style={leftEarStyle}>
        <Ellipse cx={24} cy={36} rx={6.5} ry={8.5} fill={fur} stroke={STROKE} strokeWidth={2.9} />
        {/* Grand sweeping left ivory tusk */}
        <Path
          d={
            isRuffled
              ? 'M 36 53 C 20 62, 7 52, 10 37 L 14 41 C 14 49, 24 55, 38 48 Z'
              : 'M 36 53 C 19 63, 5 50, 10 31 C 12 44, 22 54, 38 48 Z'
          }
          fill="#FEFCE8"
          stroke={STROKE}
          strokeWidth={2.9}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 4. Right Ear + Sweeping Curved Right Ivory Tusk */}
      <RigLayer style={rightEarStyle}>
        <Ellipse cx={76} cy={36} rx={6.5} ry={8.5} fill={fur} stroke={STROKE} strokeWidth={2.9} />
        {/* Grand sweeping right ivory tusk */}
        <Path
          d="M 64 53 C 81 63, 95 50, 90 31 C 88 44, 78 54, 62 48 Z"
          fill="#FEFCE8"
          stroke={STROKE}
          strokeWidth={2.9}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 5. Domed Furry Crown + Heavy Brow + Curling S-Shaped Trunk */}
      <RigLayer style={headStyle}>
        {/* Domed woolly crown */}
        <Path
          d="M 25 43 C 25 22, 36 14, 50 14 C 64 14, 75 22, 75 43 C 75 55, 64 61, 50 61 C 36 61, 25 55, 25 43 Z"
          fill={fur}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {/* Shaggy topknot fur */}
        <Polygon
          points="40,18 45,8 50,14 55,7 60,18"
          fill={isDusty ? '#D97706' : fur}
          stroke={STROKE}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
        {isDusty && (
          <Path d="M 33 26 Q 50 20 67 26" stroke={furHighlight} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        )}

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={36.5}
          rightX={63.5}
          y={39.5}
          radius={4.3}
          darkMask
          irisColor={isDusty ? '#F59E0B' : '#EA580C'}
        />

        <PredatorMaw expression={expression} y={54} width={6.5} fangSize={3} strokeColor="#FDE68A" />

        {/* Sweeping curling S-shaped mammoth trunk */}
        <Path
          d="M 44 43 C 43 58, 42 74, 54 75 C 63 76, 65 65, 58 62 C 54 61, 53 66, 56 68 C 51 68, 52 56, 56 43"
          fill={fur}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        {/* Trunk ridges */}
        <Path
          d="M 46 50 L 53 50 M 45 57 L 52 57 M 46 64 L 52 64"
          stroke={STROKE}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </RigLayer>

      {/* 6. Stomping Pillar Mammoth Feet */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -12)' : undefined}>
          <Rect x={29} y={81} width={15} height={9} rx={4} fill={fur} stroke={STROKE} strokeWidth={2.8} />
          <Rect x={56} y={81} width={15} height={9} rx={4} fill={fur} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={33} cy={88.5} r={2.2} fill="#FEFCE8" />
          <Circle cx={39} cy={88.5} r={2.2} fill="#FEFCE8" />
          <Circle cx={61} cy={88.5} r={2.2} fill="#FEFCE8" />
          <Circle cx={67} cy={88.5} r={2.2} fill="#FEFCE8" />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Feral Fangs & Savage Claws (Tier 3 Apex Beasts) rigs
 */
export const ApexPredatorRig: React.FC<EnemyRigProps<'saber'>> = ({
  variant,
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => {
  const isRuffled = isBattleWorn(healthState);
  const isFierce = isFierceExpression(expression);
  const isSaber = variant === 'saber';
  const coat = isSaber ? '#1E1B4B' : '#18181B';
  const accent = isSaber ? '#7C3AED' : '#DC2626';
  const glow = isSaber ? '#C084FC' : '#EF4444';

  return (
    <RigLayerStack>
      {/* 1. Whipping Apex Cat Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 65 81 C 86 81, 95 62, 88 41 C 86 35, 79 38, 82 47 C 85 59, 78 73, 64 75 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        {/* Glowing crimson/violet brush tip */}
        <Polygon
          points="88,41 81,31 86,34 92,29 91,42"
          fill={glow}
          stroke={STROKE}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Apex Body + Crimson Mane (Savage Claws) / Violet Stripes (Feral Fangs) */}
      <RigLayer>
        <Path
          d="M 27 56 C 21 69, 23 86, 34 89 L 66 89 C 77 86, 79 69, 73 56 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.3}
          strokeLinejoin="round"
        />
        {isSaber ? (
          <G>
            <Ellipse cx={50} cy={76} rx={11.5} ry={9.5} fill="#4C1D95" />
            <Path
              d="M 26 68 L 35 71 M 25 76 L 34 77 M 74 68 L 65 71 M 75 76 L 66 77"
              stroke={glow}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          </G>
        ) : (
          /* Jagged blazing crimson mane on Savage Claws */
          <Polygon
            points="21,57 14,66 26,67 22,77 37,71 50,82 63,71 78,77 74,67 86,66 79,57"
            fill={accent}
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
        )}
      </RigLayer>

      {/* 3. Swept Left Apex Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled ? 'M 25 35 L 16 10 L 28 16 L 25 20 L 40 24 Z' : 'M 25 35 L 16 10 L 40 24 Z'}
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Polygon points="26,31 20,16 35,25" fill={glow} />
      </RigLayer>

      {/* 4. Swept Right Apex Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 75 35 L 84 10 L 60 24 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Polygon points="74,31 80,16 65,25" fill={glow} />
      </RigLayer>

      {/* 5. Head + Giant Gleaming Saber Fangs (Feral Fangs) / Crimson Cheek Mane (Savage Claws) */}
      <RigLayer style={headStyle}>
        {!isSaber && (
          /* Crimson side-mane crown around Savage Claws' head */
          <Polygon
            points="50,13 58,21 69,16 68,28 83,33 75,44 85,51 71,56 50,62 29,56 15,51 25,44 17,33 32,28 31,16 42,21"
            fill={accent}
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
        )}

        <Path
          d="M 24 44 L 18 49 L 25 55 C 31 61, 40 63, 50 63 C 60 63, 69 61, 75 55 L 82 49 L 76 44 C 75 27, 64 21, 50 21 C 36 21, 25 27, 24 44 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />

        {/* Forehead apex crest */}
        <Polygon points="46,24 50,34 54,24" fill={glow} />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={41.5}
          radius={4.7}
          darkMask
          slitPupil
          irisColor={glow}
        />

        <Polygon
          points="46,48 54,48 50,52"
          fill={glow}
          stroke={STROKE}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />

        <PredatorMaw expression={expression} y={54} width={8.8} strokeColor={glow} />

        {/* TWO HUGE GLEAMING CURVED SABER FANGS for Feral Fangs! */}
        {isSaber && (
          <G>
            <Path
              d="M 36 54 L 43 55 C 43 65, 40 73, 35 76 C 34 68, 35 60, 36 54 Z"
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <Path
              d="M 64 54 L 57 55 C 57 65, 60 73, 65 76 C 66 68, 65 60, 64 54 Z"
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          </G>
        )}
      </RigLayer>

      {/* 6. Paws + Glowing Triple Razor Slash-Claws (Savage Claws) */}
      <RigLayer style={pawStyle}>
        {isSaber ? (
          <G transform={isFierce ? 'translate(0, -14)' : undefined}>
            <Ellipse cx={36} cy={86} rx={7.5} ry={4.8} fill={coat} stroke={STROKE} strokeWidth={2.8} />
            <Ellipse cx={64} cy={86} rx={7.5} ry={4.8} fill={coat} stroke={STROKE} strokeWidth={2.8} />
            <G fill="#F8FAFC" stroke={STROKE} strokeWidth={1.4}>
              <Polygon points="32,86 31,92 35,88" />
              <Polygon points="37,87 37,93 40,88" />
              <Polygon points="60,88 63,93 63,87" />
              <Polygon points="65,88 69,92 68,86" />
            </G>
          </G>
        ) : (
          /* Savage Claws: Glowing triple crimson-and-white razor slash-claws across the front! */
          <G transform={isFierce ? 'translate(0, -12)' : undefined}>
            <Ellipse cx={29} cy={77} rx={7} ry={5.2} fill={coat} stroke={STROKE} strokeWidth={2.8} />
            <Ellipse cx={71} cy={77} rx={7} ry={5.2} fill={coat} stroke={STROKE} strokeWidth={2.8} />
            {/* Glowing crimson slash arcs */}
            <G stroke="#EF4444" strokeWidth={4.6} strokeLinecap="round" fill="none">
              <Path d="M 28 73 Q 50 80 70 91" />
              <Path d="M 32 68 Q 53 75 74 86" />
              <Path d="M 36 63 Q 56 70 77 81" />
            </G>
            {/* Razor-bright white core slashes */}
            <G stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none">
              <Path d="M 28 73 Q 50 80 70 91" />
              <Path d="M 32 68 Q 53 75 74 86" />
              <Path d="M 36 63 Q 56 70 77 81" />
            </G>
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};
