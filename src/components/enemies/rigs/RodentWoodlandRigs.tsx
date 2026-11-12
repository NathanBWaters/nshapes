import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { RigLayer, RigLayerStack } from '@/components/creatures/RigLayers';
import { isBattleWorn, isFierceExpression, isHurtExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { EnemyExpression } from '@/utils/enemyAnimations';
import { EnemyEyes } from '../EnemyEyes';
import { EnemyRigProps } from './types';

interface MouthVisualProps {
  expression: EnemyExpression;
  cx?: number;
  y?: number;
  width?: number;
  hasBuckTeeth?: boolean;
  toothColor?: string;
  hasFangs?: boolean;
  strokeColor?: string;
}

/**
 * Shared dynamic rodent/woodland mouth expression helper.
 */
const WoodlandMouth: React.FC<MouthVisualProps> = ({
  expression,
  cx = 50,
  y = 54.5,
  width = 6.2,
  hasBuckTeeth = false,
  toothColor = '#FEF9C3',
  hasFangs = false,
  strokeColor = STROKE,
}) => {
  const isFierce = isFierceExpression(expression);
  const isHurt = isHurtExpression(expression);
  const isSleepy = expression === 'sleepy';

  if (isSleepy) {
    return (
      <Circle
        cx={cx}
        cy={y + 1.2}
        r={2.4}
        fill="#FB7185"
        stroke={strokeColor}
        strokeWidth={2}
      />
    );
  }

  if (isHurt) {
    return (
      <Path
        d={`M ${cx - width} ${y + 2} Q ${cx - width * 0.5} ${y - 1.2} ${cx} ${y + 2} Q ${cx + width * 0.5} ${y - 1.2} ${cx + width} ${y + 2}`}
        stroke={strokeColor}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    );
  }

  if (isFierce) {
    return (
      <G>
        <Path
          d={`M ${cx - width * 1.15} ${y - 0.5} Q ${cx} ${y + 8.5} ${cx + width * 1.15} ${y - 0.5} Z`}
          fill="#991B1B"
          stroke={strokeColor}
          strokeWidth={2.3}
          strokeLinejoin="round"
        />
        <Path
          d={`M ${cx - width * 0.55} ${y + 4.8} Q ${cx} ${y + 2.2} ${cx + width * 0.55} ${y + 4.8}`}
          fill="#FB7185"
        />
        {hasBuckTeeth ? (
          <Rect
            x={cx - 3.2}
            y={y - 0.3}
            width={6.4}
            height={4.6}
            rx={1}
            fill={toothColor}
            stroke={strokeColor}
            strokeWidth={1.7}
          />
        ) : (
          <G>
            <Polygon
              points={`${cx - width * 0.72},${y} ${cx - width * 0.32},${y} ${cx - width * 0.52},${y + 4.2}`}
              fill="#FFFFFF"
              stroke={strokeColor}
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
            <Polygon
              points={`${cx + width * 0.32},${y} ${cx + width * 0.72},${y} ${cx + width * 0.52},${y + 4.2}`}
              fill="#FFFFFF"
              stroke={strokeColor}
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
          </G>
        )}
      </G>
    );
  }

  return (
    <G>
      {hasBuckTeeth && (
        <G>
          <Rect
            x={cx - 3.3}
            y={y + 0.4}
            width={6.6}
            height={5}
            rx={1.1}
            fill={toothColor}
            stroke={strokeColor}
            strokeWidth={1.8}
          />
          <Line
            x1={cx}
            y1={y + 0.6}
            x2={cx}
            y2={y + 5.2}
            stroke={strokeColor}
            strokeWidth={1.4}
          />
        </G>
      )}
      {hasFangs && (
        <G>
          <Polygon
            points={`${cx - width * 0.75},${y + 0.6} ${cx - width * 0.35},${y + 0.8} ${cx - width * 0.55},${y + 4.8}`}
            fill="#FFFFFF"
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <Polygon
            points={`${cx + width * 0.35},${y + 0.8} ${cx + width * 0.75},${y + 0.6} ${cx + width * 0.55},${y + 4.8}`}
            fill="#FFFFFF"
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </G>
      )}
      <Path
        d={`M ${cx - width} ${y + 0.6} Q ${cx - width * 0.45} ${y + 3.4} ${cx} ${y + 0.3} Q ${cx + width * 0.5} ${y + 3.2} ${cx + width * 1.05} ${y - 0.6}`}
        stroke={strokeColor}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
};

/**
 * Junk Rat & Sneaky Mouse rigs
 */
export const RatMouseRig: React.FC<EnemyRigProps<'junk'>> = ({
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
  const isJunkRat = variant === 'junk';
  const coat = isJunkRat ? '#78716C' : '#94A3B8';
  const belly = isJunkRat ? '#E7E5E4' : '#F1F5F9';
  const earInner = isJunkRat ? '#F472B6' : '#FDA4AF';
  const tailFill = isJunkRat ? '#F472B6' : '#F9A8D4';

  return (
    <RigLayerStack>
      {/* 1. Wormy / Curling Pink Rodent Tail */}
      <RigLayer style={tailStyle}>
        {isJunkRat ? (
          <G>
            <Path
              d="M 66 80 C 84 82, 94 67, 88 49 C 85 40, 77 42, 81 51 C 85 60, 79 73, 65 74 Z"
              fill={tailFill}
              stroke={STROKE}
              strokeWidth={2.9}
              strokeLinejoin="round"
            />
            <Path
              d="M 80 73 L 85 76 M 85 63 L 90 64 M 84 52 L 89 50"
              stroke="#BE185D"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </G>
        ) : (
          <Path
            d="M 66 79 C 84 80, 93 64, 86 48 C 81 38, 73 43, 77 50 C 81 57, 86 67, 66 74 Z"
            fill={tailFill}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
        )}
      </RigLayer>

      {/* 2. Grounded Body */}
      <RigLayer>
        <Path
          d={
            isJunkRat
              ? 'M 31 58 C 24 68, 25 86, 35 89 L 65 89 C 75 86, 76 68, 69 58 Z'
              : 'M 34 60 C 28 70, 29 86, 38 89 L 62 89 C 71 86, 72 70, 66 60 Z'
          }
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75.5} rx={isJunkRat ? 12 : 10.5} ry={10} fill={belly} />
        {isJunkRat && (
          <G>
            {/* Scruffy alley fur tufts & stitched patch */}
            <Path d="M 26 70 L 22 72 L 27 75 M 74 70 L 78 72 L 73 75" stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" fill={coat} />
            <Rect x={53} y={73} width={7} height={6} rx={1.2} fill="#D6D3D1" stroke={STROKE} strokeWidth={1.8} />
            <Line x1={54.5} y1={71.8} x2={54.5} y2={74.2} stroke={STROKE} strokeWidth={1.5} />
            <Line x1={58.5} y1={71.8} x2={58.5} y2={74.2} stroke={STROKE} strokeWidth={1.5} />
          </G>
        )}
      </RigLayer>

      {/* 3. Left Ear */}
      <RigLayer style={leftEarStyle}>
        {isJunkRat ? (
          <G>
            {/* Signature notched alley-rat ear */}
            <Path
              d="M 35 34 C 24 36, 15 28, 17 18 L 23 22 L 25 14 C 33 13, 40 21, 38 31 Z"
              fill={coat}
              stroke={STROKE}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Circle cx={28} cy={24} r={6.2} fill={earInner} />
          </G>
        ) : (
          <G>
            {/* Huge round radar mouse ear */}
            <Circle cx={24} cy={24} r={13.5} fill={coat} stroke={STROKE} strokeWidth={3.1} />
            <Circle cx={24.5} cy={24.5} r={9.2} fill={earInner} />
            {isRuffled && (
              <Polygon points="10,21 15,23 11,26" fill={COLORS.paperBeige} stroke={STROKE} strokeWidth={2} />
            )}
          </G>
        )}
      </RigLayer>

      {/* 4. Right Ear */}
      <RigLayer style={rightEarStyle}>
        {isJunkRat ? (
          <G>
            <Path
              d={
                isRuffled
                  ? 'M 65 34 C 76 36, 85 28, 83 18 L 77 21 L 76 14 C 67 13, 60 21, 62 31 Z'
                  : 'M 65 34 C 77 36, 85 27, 82 17 C 79 11, 65 13, 62 30 Z'
              }
              fill={coat}
              stroke={STROKE}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Circle cx={72} cy={24} r={6.2} fill={earInner} />
          </G>
        ) : (
          <G>
            <Circle cx={76} cy={24} r={13.5} fill={coat} stroke={STROKE} strokeWidth={3.1} />
            <Circle cx={75.5} cy={24.5} r={9.2} fill={earInner} />
          </G>
        )}
      </RigLayer>

      {/* 5. Head + Tin-Can Lid Crown (Junk Rat) + Eyes + Whiskers + Mouth */}
      <RigLayer style={headStyle}>
        <Path
          d={
            isJunkRat
              ? isRuffled
                ? 'M 25 43 C 25 27, 36 22, 50 22 C 64 22, 75 27, 75 43 L 79 46 L 74 50 C 71 59, 60 64, 50 64 C 40 64, 29 59, 26 50 L 21 46 Z'
                : 'M 25 44 C 25 27, 36 22, 50 22 C 64 22, 75 27, 75 44 C 75 56, 62 64, 50 64 C 38 64, 25 56, 25 44 Z'
              : 'M 27 44 C 27 29, 37 24, 50 24 C 63 24, 73 29, 73 44 C 73 55, 61 62, 50 62 C 39 62, 27 55, 27 44 Z'
          }
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />

        <Ellipse cx={50} cy={52.5} rx={11.5} ry={7.8} fill={belly} />

        {/* Bent Tin-Can Lid Crown for Junk Rat */}
        {isJunkRat && (
          <G>
            <Path
              d="M 35 25 L 38 14 L 44 18 L 50 11 L 56 18 L 63 13 L 65 25 Q 50 28 35 25 Z"
              fill="#CBD5E1"
              stroke={STROKE}
              strokeWidth={2.7}
              strokeLinejoin="round"
            />
            <Path d="M 38 22 Q 50 24.5 62 22" stroke="#64748B" strokeWidth={1.8} fill="none" />
            <Circle cx={50} cy={10} r={3} fill="none" stroke={STROKE} strokeWidth={2.2} />
          </G>
        )}

        <G stroke={STROKE} strokeWidth={2} strokeLinecap="round">
          <Line x1={16} y1={47} x2={29} y2={49} />
          <Line x1={15} y1={53} x2={29} y2={52.5} />
          <Line x1={84} y1={47} x2={71} y2={49} />
          <Line x1={85} y1={53} x2={71} y2={52.5} />
        </G>

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={39}
          rightX={61}
          y={42.5}
          radius={isJunkRat ? 4.5 : 4.8}
          irisColor={isJunkRat ? '#EAB308' : '#7C3AED'}
        />

        {/* Bulbous pink rodent nose */}
        <Ellipse
          cx={50}
          cy={49.2}
          rx={isJunkRat ? 4.2 : 3.5}
          ry={3}
          fill={earInner}
          stroke={STROKE}
          strokeWidth={1.8}
        />

        <WoodlandMouth
          expression={expression}
          y={54}
          hasBuckTeeth
          toothColor={isJunkRat ? '#FDE047' : '#FFFFFF'}
        />
      </RigLayer>

      {/* 6. Paws + Fishbone Prop (Junk Rat) / Sneaky Tiptoe Paws (Sneaky Mouse) */}
      <RigLayer style={pawStyle}>
        {isJunkRat ? (
          <G transform={isFierce ? 'translate(0, -14)' : undefined}>
            <Line x1={26} y1={79} x2={72} y2={74} stroke="#F8FAFC" strokeWidth={3.4} strokeLinecap="round" />
            <Line x1={26} y1={79} x2={72} y2={74} stroke={STROKE} strokeWidth={1.4} strokeLinecap="round" />
            <Path
              d="M 42 72 L 43 82 M 49 71 L 50 81 M 56 70.5 L 57 80.5"
              stroke={STROKE}
              strokeWidth={2.3}
              strokeLinecap="round"
            />
            <Polygon points="71,74 79,68 78,80" fill="#F8FAFC" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
            <Path
              d="M 29 73 C 21 73, 19 82, 28 84 L 33 78 Z"
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.3}
              strokeLinejoin="round"
            />
            <Circle cx={25.5} cy={77.5} r={1.3} fill={STROKE} />
            {/* Rat paws gripping fishbone */}
            <Ellipse cx={37} cy={80} rx={5.8} ry={4.5} fill={earInner} stroke={STROKE} strokeWidth={2.6} />
            <Ellipse cx={63} cy={77} rx={5.8} ry={4.5} fill={earInner} stroke={STROKE} strokeWidth={2.6} />
          </G>
        ) : isFierce ? (
          <G>
            <Ellipse cx={30} cy={63} rx={5.5} ry={4.8} fill={earInner} stroke={STROKE} strokeWidth={2.6} />
            <Ellipse cx={70} cy={63} rx={5.5} ry={4.8} fill={earInner} stroke={STROKE} strokeWidth={2.6} />
          </G>
        ) : (
          <G>
            <Ellipse cx={43} cy={86.5} rx={5.8} ry={4.2} fill={earInner} stroke={STROKE} strokeWidth={2.6} />
            <Ellipse cx={57} cy={86.5} rx={5.8} ry={4.2} fill={earInner} stroke={STROKE} strokeWidth={2.6} />
            <Line x1={43} y1={84.5} x2={43} y2={88.5} stroke={STROKE} strokeWidth={1.5} />
            <Line x1={57} y1={84.5} x2={57} y2={88.5} stroke={STROKE} strokeWidth={1.5} />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Greedy Squirrel & Nutkin rigs
 */
export const SquirrelRig: React.FC<EnemyRigProps<'nutkin'>> = ({
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
  const isNutkin = variant === 'nutkin';
  const coat = isNutkin ? '#C2410C' : '#D97706';
  const plumeHighlight = isNutkin ? '#FB923C' : '#FBBF24';
  const cream = isNutkin ? '#FFEDD5' : '#FEF3C7';

  return (
    <RigLayerStack>
      {/* 1. Giant Curled Fluffy Squirrel Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d={
            isRuffled
              ? 'M 62 83 C 88 85, 98 62, 92 38 L 96 34 L 89 30 C 85 16, 68 14, 65 27 C 63 36, 73 41, 74 34 C 77 45, 74 66, 60 74 Z'
              : 'M 62 83 C 89 85, 98 61, 92 36 C 88 18, 69 14, 65 27 C 63 36, 73 41, 75 34 C 78 46, 74 66, 60 74 Z'
          }
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path
          d="M 73 72 C 85 68, 89 51, 84 36 C 81 27, 74 26, 73 31"
          stroke={plumeHighlight}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
        />
      </RigLayer>

      {/* 2. Plump Body */}
      <RigLayer>
        <Path
          d="M 31 58 C 25 69, 26 86, 36 89 L 64 89 C 74 86, 75 69, 69 58 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75} rx={12.5} ry={11} fill={cream} />
      </RigLayer>

      {/* 3. Left Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled ? 'M 26 33 L 22 14 L 30 19 L 29 22 L 39 25 Z' : 'M 26 33 L 22 13 L 39 25 Z'}
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        {isNutkin && (
          <Path d="M 22 13 L 17 6 L 25 11" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" fill={coat} />
        )}
        <Polygon points="27,30 25,18 35,25" fill={cream} />
      </RigLayer>

      {/* 4. Right Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 74 33 L 78 13 L 61 25 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        {isNutkin && (
          <Path d="M 78 13 L 83 6 L 75 11" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" fill={coat} />
        )}
        <Polygon points="73,30 75,18 65,25" fill={cream} />
      </RigLayer>

      {/* 5. Puffed Chubby-Cheeked Head */}
      <RigLayer style={headStyle}>
        <Path
          d="M 26 42 C 26 26, 37 21, 50 21 C 63 21, 74 26, 74 42 C 82 45, 82 58, 71 61 C 64 64, 36 64, 29 61 C 18 58, 18 45, 26 42 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Puffed nut-stuffed cheek pouches */}
        <Circle cx={28.5} cy={51.5} r={7.2} fill={cream} />
        <Circle cx={71.5} cy={51.5} r={7.2} fill={cream} />
        <Path d="M 24 47 Q 21 51.5 24 56" stroke={STROKE} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d="M 76 47 Q 79 51.5 76 56" stroke={STROKE} strokeWidth={2} strokeLinecap="round" fill="none" />

        <Ellipse cx={50} cy={52.5} rx={12} ry={7.8} fill={cream} />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={41.5}
          radius={4.6}
          irisColor={isNutkin ? '#9A3412' : '#92400E'}
        />

        <Ellipse cx={50} cy={48.5} rx={3.6} ry={2.6} fill="#451A03" stroke={STROKE} strokeWidth={1.6} />

        <WoodlandMouth expression={expression} y={53.2} hasBuckTeeth toothColor="#FFFFFF" />
      </RigLayer>

      {/* 6. Paws Clutching Giant Oak Acorn */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          <Path
            d="M 40 73 C 40 85, 46 90, 50 92 C 54 90, 60 85, 60 73 Z"
            fill="#B45309"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Path d="M 44 76 Q 44 83 47 86" stroke="#FCD34D" strokeWidth={2.2} strokeLinecap="round" fill="none" />
          {/* Acorn stem & cross-hatched cap */}
          <Path d="M 50 64 L 52 68" stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <Path
            d="M 38 74 C 38 67, 62 67, 62 74 Z"
            fill="#78350F"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Line x1={44} y1={69} x2={47} y2={74} stroke={STROKE} strokeWidth={1.5} />
          <Line x1={51} y1={68.5} x2={54} y2={74} stroke={STROKE} strokeWidth={1.5} />
          {/* Squirrel paws hugging the acorn */}
          <Ellipse cx={38} cy={78} rx={5.8} ry={4.6} fill={coat} stroke={STROKE} strokeWidth={2.7} />
          <Ellipse cx={62} cy={78} rx={5.8} ry={4.6} fill={coat} stroke={STROKE} strokeWidth={2.7} />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Dozy Bunny, Snow Hare & Rabbit rigs
 */
export const LagomorphRig: React.FC<EnemyRigProps<'dozy' | 'snow' | 'rabbit'>> = ({
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
  const isDozy = variant === 'dozy';
  const isSnowHare = variant === 'snow';

  const coat = isSnowHare ? '#F8FAFC' : isDozy ? '#CBD5E1' : '#D69E5E';
  const belly = isSnowHare ? '#E0F2FE' : isDozy ? '#F8FAFC' : '#FEF3C7';
  const innerEar = isSnowHare ? '#7DD3FC' : '#FDA4AF';
  const iris = isSnowHare ? '#0284C7' : isDozy ? '#6366F1' : '#B45309';

  return (
    <RigLayerStack>
      {/* 1. Fluffy Cotton Puff Tail */}
      <RigLayer style={tailStyle}>
        <Circle cx={73} cy={79} r={8.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={3} />
        <Circle cx={77} cy={75} r={5.5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.6} />
      </RigLayer>

      {/* 2. Grounded Bunny Body */}
      <RigLayer>
        <Path
          d="M 31 59 C 25 70, 26 86, 36 89 L 64 89 C 74 86, 75 70, 69 59 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75.5} rx={12.5} ry={10.5} fill={belly} />
        {/* Fluffy chest fur scallop */}
        <Path
          d="M 42 63 Q 46 67 50 63 Q 54 67 58 63"
          stroke={STROKE}
          strokeWidth={2}
          strokeLinecap="round"
          fill={belly}
        />
      </RigLayer>

      {/* 3. Tall Articulated Left Rabbit Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={
            isRuffled
              ? 'M 33 30 C 27 18, 27 5, 34 4 C 39 3, 42 12, 42 16 L 38 18 L 43 21 L 42 30 Z'
              : 'M 33 30 C 26 18, 27 4, 35 4 C 42 4, 44 17, 42 30 Z'
          }
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Ellipse cx={35.5} cy={17.5} rx={3.3} ry={9.2} fill={innerEar} />
        {isSnowHare && (
          <Path d="M 31 8 C 33 3.5, 37 3.5, 39 8 Z" fill="#1E293B" />
        )}
      </RigLayer>

      {/* 4. Tall Articulated Right Rabbit Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 67 30 C 74 18, 73 4, 65 4 C 58 4, 56 17, 58 30 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Ellipse cx={64.5} cy={17.5} rx={3.3} ry={9.2} fill={innerEar} />
        {isSnowHare && (
          <Path d="M 61 8 C 63 3.5, 67 3.5, 69 8 Z" fill="#1E293B" />
        )}
      </RigLayer>

      {/* 5. Head + Striped Blue Nightcap (Dozy Bunny) + Eyes + Mouth */}
      <RigLayer style={headStyle}>
        <Path
          d={
            isRuffled
              ? 'M 25 45 C 25 29, 36 24, 50 24 C 64 24, 75 29, 75 45 L 79 49 L 74 53 C 71 61, 61 64, 50 64 C 39 64, 29 61, 26 53 L 21 49 Z'
              : 'M 25 46 C 25 29, 36 24, 50 24 C 64 24, 75 29, 75 46 C 77 57, 64 64, 50 64 C 36 64, 23 57, 25 46 Z'
          }
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />

        {/* Cozy Striped Blue Nightcap for Dozy Bunny */}
        {isDozy && (
          <G>
            <Path
              d="M 31 30 C 37 15, 62 12, 78 24 C 83 28, 84 35, 81 38 C 75 33, 66 28, 69 29 L 31 30 Z"
              fill="#3B82F6"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            {/* Light blue stripes on nightcap */}
            <Path
              d="M 43 27 L 48 17 M 54 27 L 60 17 M 65 28 L 71 21"
              stroke="#BAE6FD"
              strokeWidth={3.2}
              strokeLinecap="round"
            />
            {/* Fluffy white nightcap cuff & pom-pom */}
            <Rect x={29} y={26} width={42} height={6.5} rx={3.2} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.5} />
            <Circle cx={82} cy={38} r={5} fill="#FFFFFF" stroke={STROKE} strokeWidth={2.4} />
          </G>
        )}

        {/* Frosty brow crest for Snow Hare */}
        {isSnowHare && (
          <Polygon
            points="50,26 46,33 50,31 54,33"
            fill="#7DD3FC"
            stroke={STROKE}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        )}

        <Ellipse cx={50} cy={53} rx={12} ry={7.5} fill={belly} />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={43.5}
          radius={4.6}
          irisColor={iris}
        />

        {/* Cute pink bunny nose */}
        <Polygon
          points="46.8,49 53.2,49 50,52.5"
          fill="#FB7185"
          stroke={STROKE}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        <WoodlandMouth expression={expression} y={54} hasBuckTeeth toothColor="#FFFFFF" />
      </RigLayer>

      {/* 6. Bunny Paws */}
      <RigLayer style={pawStyle}>
        {isFierce ? (
          <G>
            <Ellipse cx={28} cy={62} rx={6.5} ry={5.2} fill={belly} stroke={STROKE} strokeWidth={2.8} />
            <Ellipse cx={72} cy={62} rx={6.5} ry={5.2} fill={belly} stroke={STROKE} strokeWidth={2.8} />
          </G>
        ) : (
          <G>
            {variant === 'rabbit' && (
              <G>
                {/* Nibbled orange carrot prop */}
                <Polygon
                  points="38,83 62,78 60,86"
                  fill="#F97316"
                  stroke={STROKE}
                  strokeWidth={2.3}
                  strokeLinejoin="round"
                />
                <Path d="M 62 79 L 68 75 M 62 82 L 69 82" stroke="#16A34A" strokeWidth={2.5} strokeLinecap="round" />
              </G>
            )}
            <Ellipse cx={40} cy={86.5} rx={7} ry={4.6} fill={belly} stroke={STROKE} strokeWidth={2.8} />
            <Ellipse cx={60} cy={86.5} rx={7} ry={4.6} fill={belly} stroke={STROKE} strokeWidth={2.8} />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Spiny Hedgehog, Prickle & Merciless Porcupine rigs
 */
export const QuillBeastRig: React.FC<EnemyRigProps<'porcupine' | 'prickle'>> = ({
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
  const isPorcupine = variant === 'porcupine';
  const isPrickle = variant === 'prickle';

  const bodyFill = isPorcupine ? '#44403C' : '#D6B899';
  const faceFill = isPorcupine ? '#57534E' : '#F5E6D3';
  const capFill = isPorcupine ? '#1E293B' : '#5C3A21';

  return (
    <RigLayerStack>
      {/* 1. Layered Fan of Sharp Back Quills */}
      <RigLayer style={tailStyle}>
        {isPorcupine ? (
          <G>
            {/* Towering Tier-3 Banded Black & Ivory War Quills */}
            <Polygon
              points="50,4 42,32 58,32"
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Polygon points="50,4 46,16 54,16" fill="#1E293B" />
            <Polygon
              points={isRuffled ? '29,9 32,16 28,18 33,36 45,32' : '27,8 33,36 46,32'}
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Polygon points="27,8 30,20 39,18" fill="#1E293B" />
            <Polygon
              points="73,8 54,32 67,36"
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Polygon points="73,8 61,18 70,20" fill="#1E293B" />
            <Polygon
              points="11,24 27,48 36,36"
              fill="#1E293B"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Polygon points="16,29 24,42 30,35" fill="#F8FAFC" />
            <Polygon
              points="89,24 64,36 73,48"
              fill="#1E293B"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Polygon points="84,29 70,35 76,42" fill="#F8FAFC" />
            <Polygon
              points="8,48 28,62 30,47"
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Polygon
              points="92,48 70,47 72,62"
              fill="#F8FAFC"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
          </G>
        ) : (
          <G>
            {/* Chestnut Spiky Hedgehog Quill Fan */}
            <Path
              d="M 18 64 L 10 49 L 22 46 L 14 31 L 29 31 L 27 16 L 41 24 L 50 11 L 59 24 L 73 16 L 71 31 L 86 31 L 78 46 L 90 49 L 82 64 Z"
              fill={capFill}
              stroke={STROKE}
              strokeWidth={3.1}
              strokeLinejoin="round"
            />
            {/* Cream quill highlight tips */}
            <Path
              d="M 50 15 L 47 22 M 30 20 L 33 26 M 70 20 L 67 26 M 19 33 L 25 36 M 81 33 L 75 36"
              stroke="#FDE68A"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            {/* Cute Meadow Leaf skewered on Prickle's quills */}
            {isPrickle && (
              <G>
                <Path
                  d="M 65 18 C 72 8, 86 10, 84 22 C 82 30, 68 28, 65 18 Z"
                  fill="#22C55E"
                  stroke={STROKE}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
                <Path d="M 64 20 Q 74 18 81 16" stroke="#14532D" strokeWidth={1.8} strokeLinecap="round" fill="none" />
              </G>
            )}
          </G>
        )}
      </RigLayer>

      {/* 2. Grounded Body */}
      <RigLayer>
        <Path
          d="M 29 58 C 23 70, 25 86, 36 89 L 64 89 C 75 86, 77 70, 71 58 Z"
          fill={bodyFill}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75.5} rx={13} ry={10} fill={isPorcupine ? '#78716C' : '#FDF4E7'} />
        {isPorcupine && (
          <Path
            d="M 41 72 L 50 78 L 59 72"
            stroke="#EF4444"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </RigLayer>

      {/* 3. Left Ear */}
      <RigLayer style={leftEarStyle}>
        <Circle cx={27} cy={34} r={6.8} fill={faceFill} stroke={STROKE} strokeWidth={2.9} />
        <Circle cx={27.5} cy={34.5} r={3.6} fill={isPorcupine ? '#EF4444' : '#FDA4AF'} />
      </RigLayer>

      {/* 4. Right Ear */}
      <RigLayer style={rightEarStyle}>
        <Circle cx={73} cy={34} r={6.8} fill={faceFill} stroke={STROKE} strokeWidth={2.9} />
        <Circle cx={72.5} cy={34.5} r={3.6} fill={isPorcupine ? '#EF4444' : '#FDA4AF'} />
      </RigLayer>

      {/* 5. Head + Widow's Peak / Crimson War-Brow + Snout */}
      <RigLayer style={headStyle}>
        <Path
          d="M 25 45 C 25 28, 36 23, 50 23 C 64 23, 75 28, 75 45 C 75 57, 63 64, 50 64 C 37 64, 25 57, 25 45 Z"
          fill={faceFill}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Path
          d="M 26 39 C 28 26, 38 23, 50 23 C 62 23, 72 26, 74 39 L 58 34 L 50 40 L 42 34 Z"
          fill={capFill}
          stroke={STROKE}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />

        {/* Merciless Porcupine crimson war-brow markings */}
        {isPorcupine && (
          <Path
            d="M 31 35 L 44 39 L 50 34 L 56 39 L 69 35"
            stroke="#EF4444"
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={43.5}
          radius={4.5}
          irisColor={isPorcupine ? '#EF4444' : '#B45309'}
        />

        <Circle
          cx={50}
          cy={49.5}
          r={isPorcupine ? 4.2 : 3.6}
          fill={isPorcupine ? '#1E293B' : '#3E2723'}
          stroke={STROKE}
          strokeWidth={1.7}
        />
        <Circle cx={48.8} cy={48.4} r={1.1} fill="#FFFFFF" />

        <WoodlandMouth
          expression={expression}
          y={54.5}
          hasFangs={isPorcupine}
          hasBuckTeeth={!isPorcupine}
          toothColor="#FEF3C7"
        />
      </RigLayer>

      {/* 6. Clawed Paws */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -14)' : undefined}>
          <Ellipse cx={37} cy={86} rx={7} ry={4.8} fill={faceFill} stroke={STROKE} strokeWidth={2.8} />
          <Ellipse cx={63} cy={86} rx={7} ry={4.8} fill={faceFill} stroke={STROKE} strokeWidth={2.8} />
          {isPorcupine && (
            <G fill="#F8FAFC" stroke={STROKE} strokeWidth={1.5}>
              <Polygon points="33,86 31,92 35,88" />
              <Polygon points="37,87 37,93 40,88" />
              <Polygon points="60,88 63,93 63,87" />
              <Polygon points="65,88 69,92 67,86" />
            </G>
          )}
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Burrowing Mole rig
 */
export const BurrowingMoleRig: React.FC<EnemyRigProps> = ({
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
  const velvet = '#3E2723';
  const belly = '#6D4C41';
  const clawCream = '#FDE2E4';

  return (
    <RigLayerStack>
      {/* 1. Stubby Pink Tail + Flying Dirt Clods */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 68 79 Q 81 74 82 65 Q 82 61 78 62 Q 74 68 67 74 Z"
          fill="#F9A8D4"
          stroke={STROKE}
          strokeWidth={2.7}
          strokeLinejoin="round"
        />
        <Circle cx={83} cy={56} r={2.6} fill="#92400E" stroke={STROKE} strokeWidth={1.8} />
        <Circle cx={18} cy={60} r={2.2} fill="#92400E" stroke={STROKE} strokeWidth={1.8} />
      </RigLayer>

      {/* 2. Velvet Mole Body + Miner Dirt Mound at Base */}
      <RigLayer>
        <Path
          d="M 28 56 C 23 69, 25 85, 34 88 L 66 88 C 75 85, 77 69, 72 56 Z"
          fill={velvet}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={73} rx={13} ry={10} fill={belly} />
        {/* Scalloped freshly dug dirt mound */}
        <Path
          d="M 16 90 Q 24 79 34 84 Q 42 78 50 83 Q 58 78 66 84 Q 76 79 84 90 Z"
          fill="#78350F"
          stroke={STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Circle cx={30} cy={87} r={2} fill="#B45309" />
        <Circle cx={52} cy={86.5} r={2.3} fill="#B45309" />
        <Circle cx={71} cy={87} r={1.9} fill="#B45309" />
      </RigLayer>

      {/* 3. Left Tufted Ear Ridge */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled ? 'M 28 32 L 22 25 L 27 27 L 28 22 L 35 28 Z' : 'M 28 33 Q 22 25 32 24 L 36 28 Z'}
          fill={velvet}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 4. Right Tufted Ear Ridge */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 72 33 Q 78 25 68 24 L 64 28 Z"
          fill={velvet}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 5. Head + Star-Shaped Pink Snout + Squinty Eyes */}
      <RigLayer style={headStyle}>
        <Path
          d="M 25 46 C 25 27, 36 22, 50 22 C 64 22, 75 27, 75 46 C 75 58, 63 64, 50 64 C 37 64, 25 58, 25 46 Z"
          fill={velvet}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Top head hair tuft */}
        <Path d="M 46 22 L 48 15 L 52 21 L 55 16 L 54 22" stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" fill={velvet} />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38}
          rightX={62}
          y={39.5}
          radius={3.8}
          darkMask
          irisColor="#F59E0B"
        />

        {/* Star-shaped pink mole snout */}
        <Polygon
          points="50,41 52.5,45.5 57.5,43.5 54.8,48 59,51 54,51.8 55.5,56 50,53.2 44.5,56 46,51.8 41,51 45.2,48 42.5,43.5 47.5,45.5"
          fill="#FB7185"
          stroke={STROKE}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <Circle cx={50} cy={49} r={2.8} fill="#F43F5E" />

        <WoodlandMouth expression={expression} y={57} width={5.2} strokeColor="#FDE2E4" />
      </RigLayer>

      {/* 6. Oversized Pale Spade Digging Claws */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          {/* Left huge digging paw */}
          <Path
            d="M 18 76 C 18 68, 33 68, 35 77 L 33 85 L 28 81 L 24 86 L 20 81 L 16 84 Z"
            fill={clawCream}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          {/* Right huge digging paw */}
          <Path
            d="M 82 76 C 82 68, 67 68, 65 77 L 67 85 L 72 81 L 76 86 L 80 81 L 84 84 Z"
            fill={clawCream}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Hoarding Beaver & Busy Beaver rigs
 */
export const BeaverRig: React.FC<EnemyRigProps<'hoarding'>> = ({
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
  const isHoarding = variant === 'hoarding';
  const coat = isHoarding ? '#9A3412' : '#B45309';
  const muzzle = '#FED7AA';

  return (
    <RigLayerStack>
      {/* 1. Cross-Hatched Flat Paddle Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 65 79 C 79 86, 95 76, 94 60 C 93 48, 79 48, 72 60 C 68 67, 65 73, 64 76 Z"
          fill="#5C2410"
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <G stroke={STROKE} strokeWidth={1.6}>
          <Line x1={74} y1={58} x2={89} y2={71} />
          <Line x1={70} y1={66} x2={83} y2={78} />
          <Line x1={87} y1={55} x2={72} y2={74} />
          <Line x1={92} y1={63} x2={78} y2={79} />
        </G>
      </RigLayer>

      {/* 2. Stocky Beaver Body */}
      <RigLayer>
        <Path
          d="M 29 57 C 23 69, 24 86, 35 89 L 65 89 C 76 86, 77 69, 71 57 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75} rx={13.5} ry={10.5} fill={muzzle} />
      </RigLayer>

      {/* 3. Small Round Left Beaver Ear */}
      <RigLayer style={leftEarStyle}>
        <Circle cx={28} cy={28} r={6.5} fill={coat} stroke={STROKE} strokeWidth={3} />
        <Circle cx={28.5} cy={28.5} r={3.2} fill={muzzle} />
        {isRuffled && <Line x1={21} y1={26} x2={25} y2={28} stroke={STROKE} strokeWidth={2.2} />}
      </RigLayer>

      {/* 4. Small Round Right Beaver Ear */}
      <RigLayer style={rightEarStyle}>
        <Circle cx={72} cy={28} r={6.5} fill={coat} stroke={STROKE} strokeWidth={3} />
        <Circle cx={71.5} cy={28.5} r={3.2} fill={muzzle} />
      </RigLayer>

      {/* 5. Broad Head + Red Sweatband (Busy Beaver) + Prominent Buck Teeth */}
      <RigLayer style={headStyle}>
        <Path
          d="M 24 44 C 24 27, 35 22, 50 22 C 65 22, 76 27, 76 44 C 78 56, 66 63, 50 63 C 34 63, 22 56, 24 44 Z"
          fill={coat}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />

        {/* Red Athletic Sweatband on Busy Beaver */}
        {!isHoarding && (
          <G>
            <Path
              d="M 25 34 Q 50 30 75 34 L 75 28 Q 50 24 25 28 Z"
              fill="#EF4444"
              stroke={STROKE}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            <Path d="M 27 31 Q 50 27 73 31" stroke="#FFFFFF" strokeWidth={1.8} fill="none" />
          </G>
        )}

        <Ellipse cx={43} cy={52.5} rx={8.5} ry={6.5} fill={muzzle} />
        <Ellipse cx={57} cy={52.5} rx={8.5} ry={6.5} fill={muzzle} />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38.5}
          rightX={61.5}
          y={41.5}
          radius={4.5}
          irisColor={isHoarding ? '#D97706' : '#78350F'}
        />

        {/* Wide dark beaver nose */}
        <Ellipse cx={50} cy={48.5} rx={4.8} ry={3} fill="#3E2723" stroke={STROKE} strokeWidth={1.8} />

        {/* Prominent oversized beaver incisors + mouth */}
        <Rect
          x={45.2}
          y={53.8}
          width={9.6}
          height={7.2}
          rx={1.4}
          fill="#FEF08A"
          stroke={STROKE}
          strokeWidth={2.1}
        />
        <Line x1={50} y1={54} x2={50} y2={60.8} stroke={STROKE} strokeWidth={1.6} />
        <WoodlandMouth expression={expression} y={53.5} width={7} />
      </RigLayer>

      {/* 6. Paws + Chewed Timber + Gold Coins (Hoarding Beaver) */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          <Path
            d="M 26 80 L 45 80 L 48 83 L 52 80 L 74 80 L 74 88 L 26 88 Z"
            fill="#92400E"
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Ellipse cx={26} cy={84} rx={3.2} ry={4} fill="#FDE68A" stroke={STROKE} strokeWidth={2.2} />
          {isHoarding && (
            <G>
              {/* Shiny hoarded gold coins */}
              <Circle cx={46} cy={75} r={5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
              <Circle cx={55} cy={74} r={5.4} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.2} />
              <Circle cx={50.5} cy={79} r={5} fill="#FBBF24" stroke={STROKE} strokeWidth={2.2} />
            </G>
          )}
          <Ellipse cx={34} cy={82} rx={5.8} ry={4.5} fill={coat} stroke={STROKE} strokeWidth={2.7} />
          <Ellipse cx={66} cy={82} rx={5.8} ry={4.5} fill={coat} stroke={STROKE} strokeWidth={2.7} />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Punishing Ermine rig
 */
export const PunishingErmineRig: React.FC<EnemyRigProps> = ({
  healthState,
  expression,
  gazeOffset,
  headStyle,
  leftEarStyle,
  rightEarStyle,
  tailStyle,
  pawStyle,
}) => (
  <RigLayerStack>
    {/* 1. Snowy Stoat Tail with Jet-Black Ermine Tip */}
    <RigLayer style={tailStyle}>
      <Path
        d="M 63 81 C 83 82, 93 64, 88 42 C 86 34, 78 36, 80 46 C 82 58, 76 72, 62 75 Z"
        fill="#F8FAFC"
        stroke={STROKE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Iconic black ermine tail tip */}
      <Path
        d="M 88 42 C 86 32, 77 33, 80 45 C 83 47, 86 46, 88 42 Z"
        fill="#0F172A"
        stroke={STROKE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    </RigLayer>

    {/* 2. Sleek Stoat Body + Stern Crimson & Gold Judge Collar */}
    <RigLayer>
      <Path
        d="M 35 56 C 31 69, 31 86, 39 89 L 61 89 C 69 86, 69 69, 65 56 Z"
        fill="#F8FAFC"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <Ellipse cx={50} cy={77} rx={9} ry={9.5} fill="#E2E8F0" />
      {/* Judge crimson & gold collar */}
      <Path
        d="M 30 58 L 26 70 L 40 67 L 50 73 L 60 67 L 74 70 L 70 58 Z"
        fill="#DC2626"
        stroke={STROKE}
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      <Path
        d="M 29 68 L 40 65 L 50 71 L 60 65 L 71 68"
        stroke={COLORS.actionYellow}
        strokeWidth={2.2}
        fill="none"
      />
      <Circle cx={50} cy={63.5} r={3.6} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2} />
    </RigLayer>

    {/* 3. Left Stoat Ear */}
    <RigLayer style={leftEarStyle}>
      <Circle cx={30} cy={29} r={7.2} fill="#F8FAFC" stroke={STROKE} strokeWidth={3} />
      <Circle cx={30.5} cy={29.5} r={4} fill="#BAE6FD" />
      {isBattleWorn(healthState) && <Polygon points="22,26 26,28 23,31" fill={COLORS.paperBeige} stroke={STROKE} strokeWidth={1.8} />}
    </RigLayer>

    {/* 4. Right Stoat Ear */}
    <RigLayer style={rightEarStyle}>
      <Circle cx={70} cy={29} r={7.2} fill="#F8FAFC" stroke={STROKE} strokeWidth={3} />
      <Circle cx={69.5} cy={29.5} r={4} fill="#BAE6FD" />
    </RigLayer>

    {/* 5. Sleek Ermine Head + Sharp Icy Glare */}
    <RigLayer style={headStyle}>
      <Path
        d="M 28 43 C 28 27, 38 22, 50 22 C 62 22, 72 27, 72 43 C 72 54, 61 61, 50 61 C 39 61, 28 54, 28 43 Z"
        fill="#F8FAFC"
        stroke={STROKE}
        strokeWidth={3.1}
        strokeLinejoin="round"
      />
      <EnemyEyes
        expression={expression}
        gazeOffset={gazeOffset}
        leftX={39.5}
        rightX={60.5}
        y={41.5}
        radius={4.3}
        irisColor="#0284C7"
      />
      <Polygon points="47,48 53,48 50,51.5" fill="#0F172A" stroke={STROKE} strokeWidth={1.4} strokeLinejoin="round" />
      <WoodlandMouth expression={expression} y={53.2} width={5.8} hasFangs />
    </RigLayer>

    {/* 6. Sleek Stoat Paws */}
    <RigLayer style={pawStyle}>
      <G transform={isFierceExpression(expression) ? 'translate(0, -14)' : undefined}>
        <Ellipse cx={41} cy={86.5} rx={5.8} ry={4.2} fill="#F8FAFC" stroke={STROKE} strokeWidth={2.7} />
        <Ellipse cx={59} cy={86.5} rx={5.8} ry={4.2} fill="#F8FAFC" stroke={STROKE} strokeWidth={2.7} />
      </G>
    </RigLayer>
  </RigLayerStack>
);

/**
 * Masked Bandit (Raccoon) rig
 */
export const MaskedBanditRig: React.FC<EnemyRigProps> = ({
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
  const grey = '#94A3B8';
  const mask = '#1E293B';

  return (
    <RigLayerStack>
      {/* 1. Ringed Raccoon Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 63 82 C 86 84, 96 66, 90 46 C 87 37, 76 40, 75 51 C 74 62, 70 72, 61 75 Z"
          fill={grey}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        {/* Bold dark bandit tail rings */}
        <Path d="M 75 50 L 90 48 L 89 55 L 75 56 Z" fill={mask} />
        <Path d="M 73 62 L 89 63 L 86 70 L 70 68 Z" fill={mask} />
        <Circle cx={83} cy={43} r={5.2} fill={mask} />
      </RigLayer>

      {/* 2. Raccoon Body */}
      <RigLayer>
        <Path
          d="M 30 58 C 24 69, 25 86, 35 89 L 65 89 C 75 86, 76 69, 70 58 Z"
          fill={grey}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75} rx={12.5} ry={10.5} fill="#E2E8F0" />
      </RigLayer>

      {/* 3. White-Rimmed Left Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled ? 'M 25 34 L 20 14 L 30 19 L 28 22 L 40 25 Z' : 'M 25 34 L 20 13 L 40 25 Z'}
          fill="#F8FAFC"
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Polygon points="26,31 23,18 36,26" fill={mask} />
      </RigLayer>

      {/* 4. White-Rimmed Right Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 75 34 L 80 13 L 60 25 Z"
          fill="#F8FAFC"
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Polygon points="74,31 77,18 64,26" fill={mask} />
      </RigLayer>

      {/* 5. Head + Classic Dark Bandit Mask + Eyes */}
      <RigLayer style={headStyle}>
        <Path
          d="M 23 45 L 18 49 L 23 54 C 28 61, 39 64, 50 64 C 61 64, 72 61, 77 54 L 82 49 L 77 45 C 75 28, 64 22, 50 22 C 36 22, 25 28, 23 45 Z"
          fill={grey}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* White brow stripe framing the mask */}
        <Path
          d="M 24 41 C 30 33, 41 33, 50 37 C 59 33, 70 33, 76 41"
          stroke="#F8FAFC"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 23 43 C 29 35, 42 36, 50 41 C 58 36, 71 35, 77 43 C 78 50, 65 53, 55 48 L 50 46 L 45 48 C 35 53, 22 50, 23 43 Z"
          fill={mask}
        />
        <Line x1={50} y1={23} x2={50} y2={39} stroke={mask} strokeWidth={3.5} strokeLinecap="round" />

        <Ellipse cx={50} cy={53.5} rx={11.5} ry={7.2} fill="#F8FAFC" />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38}
          rightX={62}
          y={43}
          radius={4.5}
          darkMask
          irisColor="#F59E0B"
        />

        <Circle cx={50} cy={49.5} r={3.4} fill={mask} />
        <WoodlandMouth expression={expression} y={54.5} width={6.2} hasFangs />
      </RigLayer>

      {/* 6. Bandit Paws Holding Stolen Coin Sack */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          <Path
            d="M 45 68 L 41 63 L 59 63 L 55 68 C 63 72, 64 87, 50 89 C 36 87, 37 72, 45 68 Z"
            fill="#D97706"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Line x1={44} y1={68.5} x2={56} y2={68.5} stroke="#FEF3C7" strokeWidth={2.4} strokeLinecap="round" />
          <Circle cx={50} cy={78.5} r={4.5} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.8} />
          {/* Dark nimble raccoon paws */}
          <Ellipse cx={36} cy={79} rx={5.8} ry={4.5} fill={mask} stroke={STROKE} strokeWidth={2.6} />
          <Ellipse cx={64} cy={79} rx={5.8} ry={4.5} fill={mask} stroke={STROKE} strokeWidth={2.6} />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Lazy Sloth rig
 */
export const LazySlothRig: React.FC<EnemyRigProps> = ({
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
  const mossBrown = '#78634A';
  const creamFace = '#F5EFE6';
  const patchDark = '#3E3024';

  return (
    <RigLayerStack>
      {/* 1. Jungle Branch & Moss Leaves Behind */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 65 78 C 80 76, 89 65, 92 52"
          stroke="#5C3A21"
          strokeWidth={5.5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 86 58 C 92 50, 98 54, 93 63 C 89 66, 85 63, 86 58 Z"
          fill="#22C55E"
          stroke={STROKE}
          strokeWidth={2.2}
        />
      </RigLayer>

      {/* 2. Shaggy Moss-Brown Sloth Body */}
      <RigLayer>
        <Path
          d="M 28 57 C 22 70, 24 86, 35 89 L 65 89 C 76 86, 78 70, 72 57 Z"
          fill={mossBrown}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={75} rx={13} ry={10.5} fill={creamFace} />
        {/* Subtle canopy moss patch on shoulder */}
        <Circle cx={33} cy={65} r={3.2} fill="#4ADE80" opacity={0.8} />
      </RigLayer>

      {/* 3. Left Shaggy Cheek Tuft */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled ? 'M 26 34 L 18 30 L 23 36 L 19 40 L 27 42 Z' : 'M 27 33 Q 18 32 22 41 L 28 42 Z'}
          fill={mossBrown}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 4. Right Shaggy Cheek Tuft */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 73 33 Q 82 32 78 41 L 72 42 Z"
          fill={mossBrown}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 5. Sloth Head + Dark Teardrop Eye-Patches */}
      <RigLayer style={headStyle}>
        <Path
          d="M 24 44 C 24 26, 35 21, 50 21 C 65 21, 76 26, 76 44 C 76 57, 64 63, 50 63 C 36 63, 24 57, 24 44 Z"
          fill={mossBrown}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Pale sloth face disc */}
        <Ellipse cx={50} cy={46.5} rx={20} ry={14} fill={creamFace} />

        {/* Iconic drooping dark teardrop eye-patches */}
        <Path
          d="M 43 41 C 37 36, 29 40, 27 49 C 27 53, 33 52, 41 46 Z"
          fill={patchDark}
        />
        <Path
          d="M 57 41 C 63 36, 71 40, 73 49 C 73 53, 67 52, 59 46 Z"
          fill={patchDark}
        />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={36.5}
          rightX={63.5}
          y={43.5}
          radius={4.3}
          darkMask
          irisColor="#92400E"
        />

        {/* Wide snub sloth nose */}
        <Ellipse cx={50} cy={48.5} rx={4.5} ry={3} fill={patchDark} />
        <WoodlandMouth expression={expression} y={53.5} width={6.8} />
      </RigLayer>

      {/* 6. Long Curved Pale Hook-Claws */}
      <RigLayer style={pawStyle}>
        <G transform={isFierce ? 'translate(0, -13)' : undefined}>
          <Ellipse cx={34} cy={80} rx={6.5} ry={4.6} fill={mossBrown} stroke={STROKE} strokeWidth={2.7} />
          <Ellipse cx={66} cy={80} rx={6.5} ry={4.6} fill={mossBrown} stroke={STROKE} strokeWidth={2.7} />
          {/* Three long curved pale sloth hook-claws per paw */}
          <Path
            d="M 29 82 Q 28 91 34 92 M 34 83 Q 34 92 39 92 M 39 82 Q 40 90 44 90"
            stroke="#FEF3C7"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 71 82 Q 72 91 66 92 M 66 83 Q 66 92 61 92 M 61 82 Q 60 90 56 90"
            stroke="#FEF3C7"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </RigLayer>
    </RigLayerStack>
  );
};

/**
 * Chihuahua rig
 */
export const ChihuahuaRig: React.FC<EnemyRigProps> = ({
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
  const tan = '#E59A3C';
  const cream = '#FEF3C7';

  return (
    <RigLayerStack>
      {/* 1. Sickle-Curved Feisty Tail */}
      <RigLayer style={tailStyle}>
        <Path
          d="M 65 78 C 80 76, 86 60, 78 48 C 75 44, 72 48, 74 54 C 77 62, 72 71, 63 73 Z"
          fill={tan}
          stroke={STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </RigLayer>

      {/* 2. Compact Body + Studded Red Collar */}
      <RigLayer>
        <Path
          d="M 34 59 C 29 69, 30 85, 38 89 L 62 89 C 70 85, 71 69, 66 59 Z"
          fill={tan}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Ellipse cx={50} cy={76} rx={10} ry={9.5} fill={cream} />
        <Path
          d="M 33 61 Q 50 67 67 61 L 66 66 Q 50 72 34 66 Z"
          fill="#DC2626"
          stroke={STROKE}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <Polygon points="38,64 35,69 41,66" fill="#F8FAFC" stroke={STROKE} strokeWidth={1.5} />
        <Polygon points="50,66 48,72 52,72" fill="#F8FAFC" stroke={STROKE} strokeWidth={1.5} />
        <Polygon points="62,64 59,66 65,69" fill="#F8FAFC" stroke={STROKE} strokeWidth={1.5} />
      </RigLayer>

      {/* 3. Huge Pointed Left Bat-Ear */}
      <RigLayer style={leftEarStyle}>
        <Path
          d={isRuffled ? 'M 28 38 L 8 10 L 20 15 L 18 19 L 38 25 Z' : 'M 28 38 L 8 9 L 38 25 Z'}
          fill={tan}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Polygon points="27,34 14,15 34,26" fill="#FDA4AF" />
      </RigLayer>

      {/* 4. Huge Pointed Right Bat-Ear */}
      <RigLayer style={rightEarStyle}>
        <Path
          d="M 72 38 L 92 9 L 62 25 Z"
          fill={tan}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
        <Polygon points="73,34 86,15 66,26" fill="#FDA4AF" />
      </RigLayer>

      {/* 5. Apple-Domed Chihuahua Head + Bulging Eyes + Yappy Fangs */}
      <RigLayer style={headStyle}>
        <Path
          d="M 26 43 C 25 25, 36 20, 50 20 C 64 20, 75 25, 74 43 C 74 55, 62 62, 50 62 C 38 62, 26 55, 26 43 Z"
          fill={tan}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        {/* Cream brow pips & muzzle */}
        <Circle cx={40} cy={32} r={2.4} fill={cream} />
        <Circle cx={60} cy={32} r={2.4} fill={cream} />
        <Ellipse cx={50} cy={52.5} rx={11} ry={7} fill={cream} />

        <EnemyEyes
          expression={expression}
          gazeOffset={gazeOffset}
          leftX={38}
          rightX={62}
          y={42.5}
          radius={5.2}
          irisColor="#451A03"
        />

        <Polygon points="46.8,48 53.2,48 50,51.6" fill="#1E293B" stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
        <WoodlandMouth expression={expression} y={53.5} width={6.5} hasFangs />
      </RigLayer>

      {/* 6. Feisty Scrappy Paws */}
      <RigLayer style={pawStyle}>
        {isFierce ? (
          <G>
            <Ellipse cx={30} cy={65} rx={5.8} ry={4.6} fill={cream} stroke={STROKE} strokeWidth={2.7} />
            <Ellipse cx={70} cy={65} rx={5.8} ry={4.6} fill={cream} stroke={STROKE} strokeWidth={2.7} />
          </G>
        ) : (
          <G>
            <Ellipse cx={41} cy={86.5} rx={5.8} ry={4.2} fill={cream} stroke={STROKE} strokeWidth={2.7} />
            <Ellipse cx={59} cy={86.5} rx={5.8} ry={4.2} fill={cream} stroke={STROKE} strokeWidth={2.7} />
          </G>
        )}
      </RigLayer>
    </RigLayerStack>
  );
};
