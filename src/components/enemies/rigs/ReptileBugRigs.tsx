import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { RigLayers } from '@/components/creatures/RigLayers';
import { isBattleWorn, isMouthOpenExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { EnemyEyes } from '../EnemyEyes';
import { EnemyRigProps } from './types';

/**
 * Foggy Frog (slate-teal wreathed in swirling pale mist clouds)
 * & Bramble Frog (mossy green with thorny bramble leaves & berry crown)
 */
export const FrogRig: React.FC<EnemyRigProps<'bramble'>> = (props) => {
  const { variant, expression, healthState, gazeOffset } = props;
  const isBramble = variant === 'bramble';
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const skinFill = isBramble ? '#4D7C0F' : '#0F766E';
  const skinSpot = isBramble ? '#BEF264' : '#115E59';
  const throatSac = isBramble ? '#ECFCCB' : '#CCFBF1';
  const iris = isBramble ? '#F59E0B' : '#38BDF8';

  return (
    <RigLayers
      partStyles={props}
      tail={
        isBramble ? (
          <G>
            {/* Curled thorny bramble vine & berries */}
            <Path
              d="M 67 79 C 82 81, 92 69, 86 56 C 82 49, 74 52, 76 59"
              stroke="#365314"
              strokeWidth={3.6}
              strokeLinecap="round"
              fill="none"
            />
            <Polygon points="84,72 90,75 85,77" fill="#365314" />
            <Polygon points="88,61 94,59 89,65" fill="#365314" />
            <Circle cx={76} cy={59} r={3.6} fill="#E11D48" stroke={STROKE} strokeWidth={2} />
            <Circle cx={83} cy={52} r={2.8} fill="#9F1239" stroke={STROKE} strokeWidth={1.8} />
          </G>
        ) : (
          <G opacity={0.9}>
            {/* Swirling pale mist clouds */}
            <Path
              d="M 14 78 C 7 78, 6 68, 14 66 C 16 60, 25 60, 28 66 L 28 79 Z"
              fill="#CCFBF1"
              stroke={STROKE}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <Path
              d="M 68 80 C 68 71, 76 67, 81 71 C 86 66, 95 70, 93 78 C 92 84, 75 84, 68 80 Z"
              fill="#E2E8F0"
              stroke={STROKE}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            <Path d="M 74 62 Q 84 57 90 63" stroke="#99F6E4" strokeWidth={2.8} strokeLinecap="round" fill="none" />
          </G>
        )
      }
      leftEar={
        isBramble ? (
          <G>
            {/* Left thorny bramble leaf */}
            <Path
              d={
                isRuffled
                  ? 'M 32 36 L 13 24 L 19 33 L 14 36 L 27 42 Z'
                  : 'M 32 36 C 21 22, 12 23, 13 33 C 15 40, 24 42, 31 41 Z'
              }
              fill="#65A30D"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Line x1={29} y1={37} x2={17} y2={30} stroke="#365314" strokeWidth={2} strokeLinecap="round" />
          </G>
        ) : (
          <Path
            d="M 29 36 C 17 31, 12 36, 17 42 C 21 46, 27 43, 30 41"
            fill="#CCFBF1"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        )
      }
      rightEar={
        isBramble ? (
          <G>
            <Path
              d="M 68 36 C 79 22, 88 23, 87 33 C 85 40, 76 42, 69 41 Z"
              fill="#65A30D"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Line x1={71} y1={37} x2={83} y2={30} stroke="#365314" strokeWidth={2} strokeLinecap="round" />
          </G>
        ) : (
          <Path
            d="M 71 36 C 83 31, 88 36, 83 42 C 79 46, 73 43, 70 41"
            fill="#CCFBF1"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        )
      }
      body={
        <G>
          {/* Plump squat amphibian body */}
          <Ellipse
            cx={50}
            cy={70}
            rx={26}
            ry={17.5}
            fill={skinFill}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          {/* Inflated vocal throat / belly sac */}
          <Ellipse
            cx={50}
            cy={70}
            rx={16.5}
            ry={11.5}
            fill={throatSac}
            stroke={STROKE}
            strokeWidth={2.1}
          />
          {/* Amphibian flank warts / spots */}
          <Circle cx={29.5} cy={68} r={2.8} fill={skinSpot} />
          <Circle cx={27.5} cy={75} r={2} fill={skinSpot} />
          <Circle cx={70.5} cy={68} r={2.8} fill={skinSpot} />
          <Circle cx={72.5} cy={75} r={2} fill={skinSpot} />
        </G>
      }
      head={
        <G>
          {/* Wide frog head with raised eye-domes */}
          <Path
            d="M 23 47 C 21 38, 25 25, 36 25 C 42 25, 45 30, 50 30 C 55 30, 58 25, 64 25 C 75 25, 79 38, 77 47 C 76 57, 64 60, 50 60 C 36 60, 24 57, 23 47 Z"
            fill={skinFill}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />

          {/* Bramble Frog's thorny berry crown */}
          {isBramble && (
            <G transform={isRuffled ? 'rotate(11, 50, 25)' : undefined}>
              <Path d="M 39 28 Q 50 20 61 28" stroke="#365314" strokeWidth={3} strokeLinecap="round" fill="none" />
              <Polygon points="44,24 42,19 46,23" fill="#365314" />
              <Polygon points="56,24 58,19 54,23" fill="#365314" />
              <Circle cx={50} cy={22} r={3.6} fill="#E11D48" stroke={STROKE} strokeWidth={2} />
              <Circle cx={44} cy={25} r={2.6} fill="#9F1239" stroke={STROKE} strokeWidth={1.8} />
              <Circle cx={56} cy={25} r={2.6} fill="#9F1239" stroke={STROKE} strokeWidth={1.8} />
            </G>
          )}

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={36}
            rightX={64}
            y={35.5}
            radius={4.8}
            irisColor={iris}
          />

          {/* Frog nostrils */}
          <Circle cx={46.5} cy={43.5} r={1.3} fill={STROKE} />
          <Circle cx={53.5} cy={43.5} r={1.3} fill={STROKE} />

          {/* Wide frog grin or tongue-flick croak */}
          {openMouth ? (
            <G>
              <Path
                d="M 31 48 Q 50 59 69 48 Z"
                fill="#881337"
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {/* Flicking curled pink frog tongue */}
              <Path
                d="M 48 53 C 50 61, 59 63, 58 57 C 57 54, 53 55, 54 58"
                stroke="#FB7185"
                strokeWidth={3.4}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          ) : (
            <Path
              d="M 30 48.5 Q 50 55.5 70 48.5"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </G>
      }
      paws={
        <G>
          {/* Splayed webbed amphibian front feet */}
          <Path
            d="M 36 83 L 24 89 L 31 89 L 34 92 L 38 89 L 43 90 Z"
            fill={skinFill}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Circle cx={24.5} cy={89} r={2} fill={throatSac} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={34} cy={92} r={2} fill={throatSac} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={43} cy={90} r={2} fill={throatSac} stroke={STROKE} strokeWidth={1.5} />

          <Path
            d="M 64 83 L 57 90 L 62 89 L 66 92 L 69 89 L 76 89 Z"
            fill={skinFill}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Circle cx={57} cy={90} r={2} fill={throatSac} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={66} cy={92} r={2} fill={throatSac} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={75.5} cy={89} r={2} fill={throatSac} stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
    />
  );
};

/**
 * Iron Shell: armored snapping tortoise with a heavy riveted steel dome shell
 * (bolts, metal plates, glowing seam), sturdy clawed feet, and grumpy horned turtle head!
 */
export const IronShellRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const STEEL_DARK = '#334155';
  const STEEL_MID = '#64748B';
  const STEEL_LIGHT = '#CBD5E1';
  const TURTLE_SKIN = '#3F6212';
  const GLOW_SEAM = COLORS.impactOrange;

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          {/* Spiked iron tortoise tail + furnace puff */}
          <Polygon
            points="76,72 92,76 79,82"
            fill={STEEL_MID}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Circle cx={90} cy={66} r={3.5} fill="#E2E8F0" opacity={0.75} />
        </G>
      }
      leftEar={
        <Polygon
          points={isRuffled ? '29,39 16,27 21,35 18,38 25,45' : '29,39 15,26 24,45'}
          fill={STEEL_LIGHT}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      }
      rightEar={
        <Polygon
          points="71,39 85,26 76,45"
          fill={STEEL_LIGHT}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      }
      body={
        <G>
          {/* Heavy riveted steel dome shell */}
          <Path
            d="M 14 76 C 14 35, 30 22, 50 22 C 70 22, 86 35, 86 76 Z"
            fill={STEEL_DARK}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Welded steel armor plates */}
          <Path
            d="M 22 72 C 23 42, 35 28, 50 28 C 65 28, 77 42, 78 72 Z"
            fill={STEEL_MID}
            stroke={STROKE}
            strokeWidth={2.4}
          />
          {/* Glowing furnace seam lines between plates */}
          <Path
            d="M 50 28 L 50 46 M 24 55 L 40 46 L 60 46 L 76 55"
            stroke={GLOW_SEAM}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Battle-dent crack when battered */}
          {isRuffled && (
            <Path
              d="M 63 34 L 67 40 L 62 43"
              stroke={STROKE}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
          {/* Steel rivets / bolts */}
          <Circle cx={32} cy={43} r={2.2} fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.4} />
          <Circle cx={68} cy={43} r={2.2} fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.4} />
          <Circle cx={23} cy={65} r={2.2} fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.4} />
          <Circle cx={77} cy={65} r={2.2} fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.4} />
          {/* Heavy iron shell rim */}
          <Rect
            x={12}
            y={73}
            width={76}
            height={7.5}
            rx={3.5}
            fill={STEEL_LIGHT}
            stroke={STROKE}
            strokeWidth={3}
          />
        </G>
      }
      head={
        <G>
          {/* Grumpy horned snapping-turtle head */}
          <Ellipse
            cx={50}
            cy={58}
            rx={18.5}
            ry={14.5}
            fill={TURTLE_SKIN}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          {/* Central steel brow horn */}
          <Polygon
            points="46,46 50,35 54,46"
            fill={STEEL_LIGHT}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* Cheek spikes */}
          <Polygon points="32,57 25,55 32,62" fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="68,57 75,55 68,62" fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={40}
            rightX={60}
            y={55}
            radius={4.3}
            irisColor="#EF4444"
          />

          {/* Jagged snapping-turtle beak */}
          {openMouth ? (
            <G>
              <Polygon
                points="40,63 50,60 60,63 50,67.5"
                fill="#BEF264"
                stroke={STROKE}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
              <Polygon
                points="42,66.5 58,66.5 50,73"
                fill="#991B1B"
                stroke={STROKE}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
            </G>
          ) : (
            <Path
              d="M 39 65 L 45 62.5 L 50 66 L 55 62.5 L 61 65"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </G>
      }
      paws={
        <G>
          {/* Sturdy iron-clawed tortoise feet */}
          <Path
            d="M 20 79 L 18 89 L 36 89 L 34 79 Z"
            fill={TURTLE_SKIN}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Polygon points="19,89 22,93 25,89" fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.8} />
          <Polygon points="25,89 28,93 31,89" fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.8} />

          <Path
            d="M 66 79 L 64 89 L 82 89 L 80 79 Z"
            fill={TURTLE_SKIN}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Polygon points="69,89 72,93 75,89" fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.8} />
          <Polygon points="75,89 78,93 81,89" fill={STEEL_LIGHT} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
    />
  );
};

/**
 * Ticking Viper (olive-amber coiled viper + sparking bomb-fuse/stopwatch tail),
 * Venomous Cobra (flared purple-and-gold king cobra hood + spectacle markings + neon-green venom),
 * & Snake (classic emerald-and-gold coiled serpent)
 */
export const SerpentRig: React.FC<EnemyRigProps<'viper' | 'cobra'>> = (props) => {
  const { variant, expression, healthState, gazeOffset } = props;
  const isViper = variant === 'viper';
  const isCobra = variant === 'cobra';
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const scalePrimary = isCobra ? '#6B21A8' : isViper ? '#65A30D' : '#059669';
  const scaleDark = isCobra ? '#3B0764' : isViper ? '#365314' : '#064E3B';
  const bellyGold = isCobra ? '#FACC15' : isViper ? '#FEF08A' : '#FDE047';
  const iris = isCobra ? '#84CC16' : isViper ? '#FACC15' : '#F59E0B';

  return (
    <RigLayers
      partStyles={props}
      tail={
        isViper ? (
          <G>
            {/* Coiled viper tail ending in a ticking bomb-timer & sparking fuse! */}
            <Path
              d="M 68 78 C 80 76, 86 64, 83 51"
              stroke={scalePrimary}
              strokeWidth={7.5}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 68 78 C 80 76, 86 64, 83 51"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinecap="round"
              fill="none"
            />
            {/* Brass stopwatch-bomb cap on tail */}
            <Circle cx={83} cy={45} r={6.8} fill="#F59E0B" stroke={STROKE} strokeWidth={2.6} />
            <Circle cx={83} cy={45} r={4.2} fill="#FFFBEB" />
            <Path d="M 83 42.5 L 83 45 L 85 46.5" stroke="#DC2626" strokeWidth={1.8} strokeLinecap="round" fill="none" />
            {/* Sizzling fuse cord + bright spark star */}
            <Path d="M 83 38 C 84 33, 89 31, 88 26" stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" fill="none" />
            <Polygon
              points="88,18 90,23 95,25 90,27 88,32 86,27 81,25 86,23"
              fill={COLORS.actionYellow}
              stroke="#EF4444"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </G>
        ) : (
          <G>
            {/* Whipping coiled serpent tail */}
            <Path
              d="M 68 79 C 83 77, 89 63, 82 49 C 80 44, 84 39, 87 37"
              stroke={STROKE}
              strokeWidth={8.5}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 68 79 C 83 77, 89 63, 82 49 C 80 44, 84 39, 87 37"
              stroke={scalePrimary}
              strokeWidth={4.2}
              strokeLinecap="round"
              fill="none"
            />
            {isCobra && <Circle cx={88} cy={34} r={2.6} fill="#4ADE80" stroke={STROKE} strokeWidth={1.6} />}
          </G>
        )
      }
      leftEar={
        isCobra ? (
          <G>
            {/* Wide flared purple-and-gold King Cobra left hood + spectacle marking */}
            <Path
              d={
                isRuffled
                  ? 'M 43 28 C 17 25, 8 41, 14 54 L 20 53 L 17 60 C 25 66, 36 64, 43 58 Z'
                  : 'M 43 28 C 16 25, 7 42, 16 58 C 23 66, 35 64, 43 58 Z'
              }
              fill={scalePrimary}
              stroke={STROKE}
              strokeWidth={3.1}
              strokeLinejoin="round"
            />
            <Circle cx={25} cy={45} r={5.5} fill="none" stroke={bellyGold} strokeWidth={2.8} />
            <Circle cx={25} cy={45} r={2.2} fill={scaleDark} />
          </G>
        ) : isViper ? (
          /* Horned viper supraorbital scale horn */
          <Polygon
            points={isRuffled ? '35,30 26,18 31,24 29,27 41,28' : '35,30 27,16 41,27'}
            fill={bellyGold}
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
        ) : (
          /* Sleek emerald neck crest */
          <Path
            d="M 35 35 C 26 32, 25 44, 34 47 Z"
            fill={bellyGold}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )
      }
      rightEar={
        isCobra ? (
          <G>
            <Path
              d={
                isRuffled
                  ? 'M 57 28 C 83 25, 92 41, 86 54 L 80 53 L 83 60 C 75 66, 64 64, 57 58 Z'
                  : 'M 57 28 C 84 25, 93 42, 84 58 C 77 66, 65 64, 57 58 Z'
              }
              fill={scalePrimary}
              stroke={STROKE}
              strokeWidth={3.1}
              strokeLinejoin="round"
            />
            <Circle cx={75} cy={45} r={5.5} fill="none" stroke={bellyGold} strokeWidth={2.8} />
            <Circle cx={75} cy={45} r={2.2} fill={scaleDark} />
          </G>
        ) : isViper ? (
          <Polygon
            points="65,30 73,16 59,27"
            fill={bellyGold}
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
        ) : (
          <Path
            d="M 65 35 C 74 32, 75 44, 66 47 Z"
            fill={bellyGold}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )
      }
      body={
        <G>
          {/* Back serpent coil + central golden neck column */}
          <Path
            d="M 42 48 L 40 68 L 60 68 L 58 48 Z"
            fill={scalePrimary}
            stroke={STROKE}
            strokeWidth={3}
          />
          <Rect x={44.5} y={50} width={11} height={17} rx={4} fill={bellyGold} />
          <Path d="M 45 55 L 55 55 M 45 60 L 55 60" stroke={scaleDark} strokeWidth={1.8} />

          {/* Stacked coiled serpent loops */}
          <Ellipse
            cx={50}
            cy={72}
            rx={24}
            ry={9.5}
            fill={scalePrimary}
            stroke={STROKE}
            strokeWidth={3.1}
          />
          {/* Diamond scale markings */}
          <Polygon points="35,69 39,72 35,75 31,72" fill={scaleDark} />
          <Polygon points="50,69 54,72 50,75 46,72" fill={bellyGold} />
          <Polygon points="65,69 69,72 65,75 61,72" fill={scaleDark} />
        </G>
      }
      head={
        <G>
          {/* Triangular coiled serpent head */}
          <Path
            d="M 30 37 C 30 24, 40 21, 50 21 C 60 21, 70 24, 70 37 C 70 46, 60 52, 50 52 C 40 52, 30 46, 30 37 Z"
            fill={scalePrimary}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* Crown diamond scale */}
          <Polygon points="50,24 54,29 50,34 46,29" fill={bellyGold} />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={39.5}
            rightX={60.5}
            y={36.5}
            radius={4.5}
            irisColor={iris}
            darkMask={isCobra}
            slitPupil
          />

          {/* Dripping fangs + forked crimson tongue! */}
          {openMouth ? (
            <G>
              <Path
                d="M 38 45 Q 50 55 62 45 Z"
                fill="#881337"
                stroke={STROKE}
                strokeWidth={2.3}
                strokeLinejoin="round"
              />
              <Polygon points="41,45.5 44.5,45.5 42.8,52.5" fill="#FFFFFF" />
              <Polygon points="55.5,45.5 59,45.5 57.2,52.5" fill="#FFFFFF" />
            </G>
          ) : (
            <G>
              <Path d="M 38 45.5 Q 50 49 62 45.5" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" fill="none" />
              <Polygon points="41.5,46.5 44.5,47 43,52.5" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.2} />
              <Polygon points="55.5,47 58.5,46.5 57,52.5" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.2} />
            </G>
          )}

          {/* Forked crimson serpent tongue */}
          <Path
            d="M 50 49 L 50 58 M 50 58 L 46.5 62 M 50 58 L 53.5 62"
            stroke="#EF4444"
            strokeWidth={2.3}
            strokeLinecap="round"
            fill="none"
          />

          {/* Neon-green venom drops for Venomous Cobra */}
          {isCobra && (
            <G>
              <Circle cx={43} cy={55.5} r={2} fill="#4ADE80" />
              <Circle cx={57} cy={55.5} r={2} fill="#4ADE80" />
            </G>
          )}
        </G>
      }
      paws={
        <G>
          {/* Front lower serpent strike coil with golden belly scutes */}
          <Ellipse
            cx={50}
            cy={83}
            rx={27}
            ry={8.5}
            fill={scalePrimary}
            stroke={STROKE}
            strokeWidth={3.1}
          />
          <Path
            d="M 33 84 Q 50 89 67 84"
            stroke={bellyGold}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          {isCobra && (
            <G>
              <Ellipse cx={34} cy={91} rx={3.5} ry={1.8} fill="#4ADE80" />
              <Ellipse cx={66} cy={91} rx={3.5} ry={1.8} fill="#4ADE80" />
            </G>
          )}
        </G>
      }
    />
  );
};

/**
 * Shifting Chameleon: spiral curled tail, tall angled casque head-crest,
 * vibrant color-shifting rainbow body stripes (teal, magenta, gold),
 * gripping zygodactyl feet, and big swiveling turret eyes!
 */
export const ChameleonRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const CHAM_TEAL = '#14B8A6';
  const CHAM_MAGENTA = '#EC4899';
  const CHAM_GOLD = '#FACC15';
  const CHAM_VIOLET = '#8B5CF6';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          {/* Tightly wound spiral curled chameleon tail */}
          <Path
            d="M 66 74 C 83 76, 93 63, 87 50 C 83 41, 71 42, 70 51 C 69 58, 78 61, 80 55 C 81 51, 77 50, 76 53"
            stroke={STROKE}
            strokeWidth={8.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 66 74 C 83 76, 93 63, 87 50 C 83 41, 71 42, 70 51 C 69 58, 78 61, 80 55"
            stroke={CHAM_VIOLET}
            strokeWidth={4.4}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={86} cy={61} r={1.8} fill={CHAM_GOLD} />
          <Circle cx={82} cy={46} r={1.8} fill={CHAM_MAGENTA} />
        </G>
      }
      leftEar={
        <Polygon
          points={isRuffled ? '34,34 19,21 24,30 20,33 32,42' : '34,34 19,20 26,42'}
          fill={CHAM_MAGENTA}
          stroke={STROKE}
          strokeWidth={2.7}
          strokeLinejoin="round"
        />
      }
      rightEar={
        <Polygon
          points="66,34 81,20 74,42"
          fill={CHAM_MAGENTA}
          stroke={STROKE}
          strokeWidth={2.7}
          strokeLinejoin="round"
        />
      }
      body={
        <G>
          {/* Dorsal spine spikes */}
          <Polygon points="34,54 38,47 43,53 48,46 53,53 58,47 64,54" fill={CHAM_GOLD} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
          {/* Arched color-shifting rainbow body */}
          <Path
            d="M 27 68 C 27 52, 37 49, 50 49 C 63 49, 73 54, 72 70 C 71 80, 61 83, 50 83 C 39 83, 27 80, 27 68 Z"
            fill={CHAM_TEAL}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          {/* Rainbow body stripes (magenta, gold, violet) */}
          <Path d="M 35 53 Q 40 67 34 80" stroke={CHAM_MAGENTA} strokeWidth={5.5} strokeLinecap="round" fill="none" />
          <Path d="M 49 51 Q 53 67 48 81" stroke={CHAM_GOLD} strokeWidth={5.5} strokeLinecap="round" fill="none" />
          <Path d="M 62 53 Q 66 67 61 79" stroke={CHAM_VIOLET} strokeWidth={5} strokeLinecap="round" fill="none" />
        </G>
      }
      head={
        <G>
          {/* Tall angled casque head-crest */}
          <Polygon
            points="32,34 50,9 68,34"
            fill={CHAM_TEAL}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon points="41,29 50,15 59,29" fill={CHAM_GOLD} />

          {/* Chameleon head */}
          <Ellipse
            cx={50}
            cy={40}
            rx={21}
            ry={15}
            fill={CHAM_TEAL}
            stroke={STROKE}
            strokeWidth={3.2}
          />

          {/* Big swiveling scaly turret eye rings */}
          <Circle cx={36.5} cy={38.5} r={8.5} fill={CHAM_MAGENTA} stroke={STROKE} strokeWidth={2.6} />
          <Circle cx={63.5} cy={38.5} r={8.5} fill={CHAM_MAGENTA} stroke={STROKE} strokeWidth={2.6} />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={36.5}
            rightX={63.5}
            y={38.5}
            radius={4.3}
            irisColor={CHAM_GOLD}
          />

          {/* Chameleon mouth + zapping sticky tongue */}
          {openMouth ? (
            <G>
              <Path d="M 38 48 Q 50 55 62 48 Z" fill="#881337" stroke={STROKE} strokeWidth={2.3} />
              <Path d="M 50 51 C 50 61, 61 63, 60 57" stroke="#F43F5E" strokeWidth={3.2} strokeLinecap="round" fill="none" />
              <Circle cx={60} cy={56.5} r={3} fill="#FB7185" stroke={STROKE} strokeWidth={1.6} />
            </G>
          ) : (
            <Path d="M 36 48.5 L 50 51 L 64 48.5" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      paws={
        <G>
          {/* Perch branch */}
          <Line x1={20} y1={88} x2={80} y2={88} stroke="#78350F" strokeWidth={5} strokeLinecap="round" />
          <Line x1={20} y1={88} x2={80} y2={88} stroke={STROKE} strokeWidth={1.8} strokeLinecap="round" />
          {/* Gripping split-mitten zygodactyl feet */}
          <Path
            d="M 36 80 L 31 89 L 37 87 L 42 89 Z"
            fill={CHAM_GOLD}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Path
            d="M 62 80 L 57 89 L 63 87 L 68 89 Z"
            fill={CHAM_GOLD}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </G>
      }
    />
  );
};

/**
 * Stinging Scorpion: segmented dark-crimson/obsidian arachnid carapace,
 * two big snapping pincer claws, and a high-arched segmented tail
 * tipped with a glowing toxic-green stinger!
 */
export const ScorpionRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const SCORP_CRIMSON = '#991B1B';
  const SCORP_DARK = '#450A0A';
  const OBSIDIAN = '#1E293B';
  const TOXIC_GREEN = '#4ADE80';

  return (
    <RigLayers
      partStyles={props}
      earsInFront
      tail={
        <G>
          {/* High-arched segmented scorpion metasoma tail (pivots at 56, 38) */}
          <Circle cx={59} cy={43} r={6.5} fill={SCORP_CRIMSON} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={64} cy={33} r={6.2} fill={SCORP_DARK} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={61} cy={22} r={5.8} fill={SCORP_CRIMSON} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={51} cy={15} r={5.5} fill={SCORP_DARK} stroke={STROKE} strokeWidth={2.8} />
          {/* Venom bulb & glowing toxic-green stinger barb! */}
          <Path
            d="M 46 14 C 37 12, 33 19, 39 25 L 33 30 C 42 29, 48 23, 46 14 Z"
            fill={TOXIC_GREEN}
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Circle cx={32.5} cy={33} r={2.1} fill="#A3E635" />
        </G>
      }
      leftEar={
        <G>
          {/* Left big snapping pincer claw (pivots at 24, 58) */}
          <Path d="M 29 59 L 17 51" stroke={OBSIDIAN} strokeWidth={6} strokeLinecap="round" />
          <Path
            d={
              isRuffled
                ? 'M 17 52 C 6 50, 4 35, 13 28 L 15 35 L 12 39 L 19 42 L 24 31 C 29 38, 26 49, 17 52 Z'
                : 'M 17 52 C 5 50, 4 34, 14 27 L 17 40 L 23 29 C 29 36, 27 49, 17 52 Z'
            }
            fill={SCORP_CRIMSON}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </G>
      }
      rightEar={
        <G>
          {/* Right big snapping pincer claw (pivots at 76, 58) */}
          <Path d="M 71 59 L 83 51" stroke={OBSIDIAN} strokeWidth={6} strokeLinecap="round" />
          <Path
            d="M 83 52 C 95 50, 96 34, 86 27 L 83 40 L 77 29 C 71 36, 73 49, 83 52 Z"
            fill={SCORP_CRIMSON}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </G>
      }
      body={
        <G>
          {/* Spiny jointed arachnid walking legs */}
          <G stroke={OBSIDIAN} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <Path d="M 31 63 L 16 64 L 11 73" />
            <Path d="M 32 69 L 17 73 L 13 82" />
            <Path d="M 35 75 L 22 81 L 19 89" />
            <Path d="M 69 63 L 84 64 L 89 73" />
            <Path d="M 68 69 L 83 73 L 87 82" />
            <Path d="M 65 75 L 78 81 L 81 89" />
          </G>
          {/* Segmented dark-crimson/obsidian carapace */}
          <Ellipse
            cx={50}
            cy={66}
            rx={21}
            ry={15.5}
            fill={SCORP_DARK}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          <Path d="M 32 62 Q 50 67 68 62 M 34 69 Q 50 74 66 69" stroke={SCORP_CRIMSON} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        </G>
      }
      head={
        <G>
          {/* Armored cephalothorax head-shield (pivots at 50, 56) */}
          <Path
            d="M 32 56 C 32 45, 40 42, 50 42 C 60 42, 68 45, 68 56 C 68 64, 60 67, 50 67 C 40 67, 32 64, 32 56 Z"
            fill={SCORP_CRIMSON}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={40.5}
            rightX={59.5}
            y={54.5}
            radius={4.2}
            irisColor={TOXIC_GREEN}
            darkMask
          />
          {/* Secondary arachnid lateral eye dots */}
          <Circle cx={34.5} cy={55} r={1.6} fill={TOXIC_GREEN} />
          <Circle cx={65.5} cy={55} r={1.6} fill={TOXIC_GREEN} />

          {/* Chelicerae mouth */}
          {openMouth ? (
            <Path d="M 43 62 L 47 66 L 50 62 L 53 66 L 57 62" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" fill="none" />
          ) : (
            <Path d="M 44 62.5 Q 50 65 56 62.5" stroke={OBSIDIAN} strokeWidth={2.5} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      paws={
        <G>
          {/* Snapping front mandible-claws at base */}
          <Path
            d="M 42 78 L 37 88 L 45 84 Z"
            fill={OBSIDIAN}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Path
            d="M 58 78 L 63 88 L 55 84 Z"
            fill={OBSIDIAN}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Circle cx={50} cy={87} r={1.9} fill={TOXIC_GREEN} />
        </G>
      }
    />
  );
};

/**
 * Trap Weaver: velvet black orb-weaver spider with crimson hourglass markings,
 * <EnemyEyes variant="spider" ... />, gleaming chelicerae fangs, spiny legs,
 * and a silk thread with a dangling lit bomb!
 */
export const TrapWeaverRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const SPIDER_VELVET = '#0F172A';
  const SPIDER_HIGHLIGHT = '#334155';
  const HOURGLASS_RED = '#EF4444';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          {/* Silk thread with a dangling lit bomb! */}
          <Line x1={65} y1={48} x2={82} y2={69} stroke="#CBD5E1" strokeWidth={2.2} strokeDasharray="3 2" />
          <Circle cx={82} cy={76} r={7.8} fill="#1E293B" stroke={STROKE} strokeWidth={2.7} />
          <Path d="M 75 76 Q 82 79 89 76" stroke={HOURGLASS_RED} strokeWidth={2.5} fill="none" />
          <Rect x={79.5} y={66.5} width={5} height={3} rx={1} fill="#64748B" stroke={STROKE} strokeWidth={1.6} />
          <Path d="M 82 66.5 Q 86 62 89 64" stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" fill="none" />
          {/* Lit bomb spark! */}
          <Polygon
            points="90,58 91.5,62 95.5,63.5 91.5,65 90,69 88.5,65 84.5,63.5 88.5,62"
            fill={COLORS.actionYellow}
            stroke={HOURGLASS_RED}
            strokeWidth={1.3}
          />
        </G>
      }
      leftEar={
        <Path
          d={isRuffled ? 'M 35 38 L 22 24 L 18 32' : 'M 35 38 L 21 23 L 15 33'}
          stroke={SPIDER_VELVET}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      }
      rightEar={
        <Path
          d="M 65 38 L 79 23 L 85 33"
          stroke={SPIDER_VELVET}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      }
      body={
        <G>
          {/* 8 spiny jointed orb-weaver legs */}
          <G stroke={SPIDER_VELVET} strokeWidth={3.3} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <Path d="M 33 56 L 13 46 L 6 59" />
            <Path d="M 31 62 L 11 58 L 6 72" />
            <Path d="M 32 69 L 14 71 L 10 84" />
            <Path d="M 36 75 L 22 82 L 19 91" />

            <Path d="M 67 56 L 87 46 L 94 59" />
            <Path d="M 69 62 L 89 58 L 94 72" />
            <Path d="M 68 69 L 86 71 L 90 84" />
            <Path d="M 64 75 L 78 82 L 81 91" />
          </G>
          {/* Bulbous velvet-black abdomen */}
          <Ellipse
            cx={50}
            cy={67}
            rx={20.5}
            ry={17}
            fill={SPIDER_VELVET}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          <Ellipse cx={43} cy={58} rx={4.5} ry={2.2} fill={SPIDER_HIGHLIGHT} opacity={0.7} />
          {/* Iconic crimson hourglass marking */}
          <Polygon
            points="44,58 56,58 51.5,66.5 56,75 44,75 48.5,66.5"
            fill={HOURGLASS_RED}
          />
        </G>
      }
      head={
        <G>
          {/* Spider cephalothorax head */}
          <Ellipse
            cx={50}
            cy={43}
            rx={18.5}
            ry={13.5}
            fill={SPIDER_VELVET}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          {/* 8-eye spider cluster! */}
          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            variant="spider"
            leftX={42}
            rightX={58}
            y={41.5}
            radius={4.1}
            irisColor={HOURGLASS_RED}
            darkMask
          />
          {/* Gleaming curved chelicerae fangs */}
          <Path
            d={openMouth ? 'M 41 51 L 37 60 L 45 55 Z' : 'M 42 51 L 40 59 L 46 54 Z'}
            fill="#F8FAFC"
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path
            d={openMouth ? 'M 59 51 L 63 60 L 55 55 Z' : 'M 58 51 L 60 59 L 54 54 Z'}
            fill="#F8FAFC"
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </G>
      }
      paws={
        <G>
          {/* Front trap-weaving tarsus claws & silver silk tripwire */}
          <Line x1={29} y1={88} x2={71} y2={88} stroke="#CBD5E1" strokeWidth={1.8} strokeDasharray="4 2" />
          <Path d="M 38 81 L 32 89 M 62 81 L 68 89" stroke={SPIDER_VELVET} strokeWidth={3.2} strokeLinecap="round" />
        </G>
      }
    />
  );
};

/**
 * Swarming Ants (fierce crimson fire-ant commando + ticking dynamite pack),
 * Scout Ant (nimble russet ant + green scout neckerchief),
 * Soldier Ant (heavy steel legionnaire helmet + oversized jaws),
 * & Queen Ant (translucent royal wings + larger abdomen + golden crown)
 */
export const AntRig: React.FC<EnemyRigProps<'scout' | 'soldier' | 'queen' | 'swarm'>> = (props) => {
  const { variant, expression, healthState, gazeOffset } = props;
  const isScout = variant === 'scout';
  const isSoldier = variant === 'soldier';
  const isQueen = variant === 'queen';
  const isSwarm = variant === 'swarm';
  const isRuffled = isBattleWorn(healthState);
  const openJaws = isMouthOpenExpression(expression);

  const chitinFill = isQueen
    ? '#6B21A8'
    : isSoldier
      ? '#78350F'
      : isSwarm
        ? '#B91C1C'
        : '#C2410C';
  const chitinDark = isQueen
    ? '#3B0764'
    : isSoldier
      ? '#451A03'
      : isSwarm
        ? '#7F1D1D'
        : '#7C2D12';
  const iris = isQueen
    ? '#E879F9'
    : isSoldier
      ? '#EF4444'
      : isSwarm
        ? '#FACC15'
        : '#F59E0B';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          {/* Segmented ant gaster abdomen (larger royal gaster for Queen Ant!) */}
          <Ellipse
            cx={isQueen ? 70 : 68}
            cy={isQueen ? 73 : 75}
            rx={isQueen ? 17 : 13}
            ry={isQueen ? 13 : 10}
            fill={chitinDark}
            stroke={STROKE}
            strokeWidth={3}
          />
          {isQueen && (
            <Path
              d="M 62 63 Q 70 73 62 83 M 71 62 Q 79 73 71 84"
              stroke="#FACC15"
              strokeWidth={2.8}
              strokeLinecap="round"
              fill="none"
            />
          )}
          {/* Swarming Ants (Tier 3): ticking dynamite pack strapped to back! */}
          {isSwarm && (
            <G>
              {/* Bundled red TNT dynamite sticks */}
              <Rect
                x={63}
                y={52}
                width={20}
                height={7}
                rx={2.5}
                fill="#EF4444"
                stroke={STROKE}
                strokeWidth={2.3}
              />
              <Rect
                x={65}
                y={58}
                width={20}
                height={7}
                rx={2.5}
                fill="#DC2626"
                stroke={STROKE}
                strokeWidth={2.3}
              />
              {/* Black commando tape + ticking stopwatch dial */}
              <Line x1={70} y1={52} x2={70} y2={65} stroke="#1E293B" strokeWidth={2.6} />
              <Circle cx={76} cy={58.5} r={4.6} fill="#FFFBEB" stroke={STROKE} strokeWidth={2} />
              <Path d="M 76 56 L 76 58.5 L 78 59.5" stroke="#DC2626" strokeWidth={1.6} strokeLinecap="round" fill="none" />
              {/* Sizzling fuse + spark burst! */}
              <Path d="M 83 55 Q 89 51 88 45" stroke={STROKE} strokeWidth={2.2} strokeLinecap="round" fill="none" />
              <Polygon
                points="88,38 90,42.5 94.5,44 90,45.5 88,50 86,45.5 81.5,44 86,42.5"
                fill={COLORS.actionYellow}
                stroke="#EF4444"
                strokeWidth={1.3}
              />
            </G>
          )}
        </G>
      }
      leftEar={
        isQueen ? (
          /* Queen Ant's translucent royal left wing */
          <G opacity={0.88}>
            <Path
              d={
                isRuffled
                  ? 'M 36 53 C 17 31, 5 29, 7 45 L 13 48 L 9 54 C 16 61, 27 61, 36 59 Z'
                  : 'M 36 53 C 17 30, 5 29, 7 46 C 9 58, 22 61, 36 59 Z'
              }
              fill="#F3E8FF"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Path d="M 33 54 L 14 42 M 23 48 L 16 54" stroke="#A855F7" strokeWidth={1.8} strokeLinecap="round" />
          </G>
        ) : (
          /* Bent elbowed insect antenna */
          <G>
            <Path
              d={isRuffled ? 'M 40 27 L 31 13 L 22 20' : 'M 40 27 L 31 12 L 20 16'}
              stroke={STROKE}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Circle cx={isRuffled ? 22 : 20} cy={isRuffled ? 20 : 16} r={2.4} fill={chitinFill} />
          </G>
        )
      }
      rightEar={
        isQueen ? (
          <G opacity={0.88}>
            <Path
              d={
                isRuffled
                  ? 'M 64 53 C 83 31, 95 29, 93 45 L 87 48 L 91 54 C 84 61, 73 61, 64 59 Z'
                  : 'M 64 53 C 83 30, 95 29, 93 46 C 91 58, 78 61, 64 59 Z'
              }
              fill="#F3E8FF"
              stroke={STROKE}
              strokeWidth={2.8}
              strokeLinejoin="round"
            />
            <Path d="M 67 54 L 86 42 M 77 48 L 84 54" stroke="#A855F7" strokeWidth={1.8} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            <Path
              d="M 60 27 L 69 12 L 80 16"
              stroke={STROKE}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Circle cx={80} cy={16} r={2.4} fill={chitinFill} />
          </G>
        )
      }
      body={
        <G>
          {/* Jointed middle & hind insect legs */}
          <G stroke={STROKE} strokeWidth={3.1} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <Path d="M 36 62 L 19 64 L 14 76" />
            <Path d="M 38 70 L 23 76 L 19 87" />
            <Path d="M 64 62 L 81 64 L 86 76" />
            <Path d="M 62 70 L 77 76 L 81 87" />
          </G>
          {/* Segmented insect thorax */}
          <Ellipse
            cx={50}
            cy={63}
            rx={15.5}
            ry={13.5}
            fill={chitinFill}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          <Path d="M 36 65 Q 50 70 64 65" stroke={chitinDark} strokeWidth={2.6} fill="none" />

          {/* Scout Ant's jaunty green scout neckerchief! */}
          {isScout && (
            <G>
              <Polygon
                points="34,53 66,53 50,68"
                fill="#16A34A"
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              <Circle cx={50} cy={58} r={2.8} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.6} />
            </G>
          )}

          {/* Soldier Ant's steel harness straps */}
          {isSoldier && (
            <G>
              <Line x1={38} y1={53} x2={62} y2={71} stroke="#94A3B8" strokeWidth={3.2} />
              <Line x1={62} y1={53} x2={38} y2={71} stroke="#94A3B8" strokeWidth={3.2} />
              <Circle cx={50} cy={62} r={3.4} fill="#F59E0B" stroke={STROKE} strokeWidth={1.8} />
            </G>
          )}

          {/* Queen Ant's royal gold-and-cream collar ruff */}
          {isQueen && (
            <G>
              <Path
                d="M 33 53 Q 41 60 50 56 Q 59 60 67 53 Q 58 48 50 50 Q 42 48 33 53 Z"
                fill="#FEF3C7"
                stroke={STROKE}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <Polygon points="50,51 53.5,55.5 50,60 46.5,55.5" fill="#FACC15" stroke={STROKE} strokeWidth={1.6} />
            </G>
          )}

          {/* Swarming Ants' black commando dynamite straps */}
          {isSwarm && (
            <G>
              <Path d="M 36 55 L 64 67 M 37 67 L 64 55" stroke="#1E293B" strokeWidth={3.2} strokeLinecap="round" />
              <Rect x={46.5} y={58} width={7} height={6} rx={1} fill="#FACC15" stroke={STROKE} strokeWidth={1.6} />
            </G>
          )}
        </G>
      }
      head={
        <G>
          {/* Queen Ant's golden-tipped antennae */}
          {isQueen && (
            <G>
              <Path d="M 41 25 L 33 13 L 24 16" stroke={STROKE} strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Circle cx={24} cy={16} r={2.3} fill="#FACC15" />
              <Path d="M 59 25 L 67 13 L 76 16" stroke={STROKE} strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Circle cx={76} cy={16} r={2.3} fill="#FACC15" />
            </G>
          )}

          {/* Chitinous ant head */}
          <Path
            d="M 31 36 C 31 24, 39 21, 50 21 C 61 21, 69 24, 69 36 C 69 46, 59 52, 50 52 C 41 52, 31 46, 31 36 Z"
            fill={chitinFill}
            stroke={STROKE}
            strokeWidth={3.2}
          />

          {/* Soldier Ant's heavy steel legionnaire helmet! */}
          {isSoldier && (
            <G transform={isRuffled ? 'rotate(-8, 50, 24)' : undefined}>
              {/* Red legionnaire crest brush */}
              <Path
                d="M 38 18 C 42 9, 58 9, 62 18 Z"
                fill="#DC2626"
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {/* Riveted steel dome & brow guard */}
              <Path
                d="M 29 33 C 29 19, 39 16, 50 16 C 61 16, 71 19, 71 33 L 50 36 Z"
                fill="#64748B"
                stroke={STROKE}
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <Path d="M 28 32 L 50 36 L 72 32" stroke="#CBD5E1" strokeWidth={3.2} strokeLinecap="round" fill="none" />
            </G>
          )}

          {/* Queen Ant's gleaming golden crown! */}
          {isQueen && (
            <G transform={isRuffled ? 'rotate(11, 50, 19)' : undefined}>
              <Polygon
                points="37,23 39,11 45,17 50,8 55,17 61,11 63,23"
                fill={COLORS.actionYellow}
                stroke={STROKE}
                strokeWidth={2.6}
                strokeLinejoin="round"
              />
              <Circle cx={50} cy={17} r={2.2} fill={COLORS.logicTeal} />
            </G>
          )}

          {/* Swarming Ants' fierce commando headband */}
          {isSwarm && (
            <G>
              <Path d="M 31 30 Q 50 33 69 30" stroke="#1E293B" strokeWidth={5} strokeLinecap="round" fill="none" />
              <Path d="M 69 30 L 77 27 M 69 31 L 76 34" stroke="#1E293B" strokeWidth={2.8} strokeLinecap="round" />
            </G>
          )}

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={39.5}
            rightX={60.5}
            y={38.5}
            radius={4.4}
            irisColor={iris}
            darkMask={isQueen || isSoldier}
          />
        </G>
      }
      paws={
        <G>
          {/* Snapping mandibles (oversized steel-edged jaws on Soldier Ant!) */}
          {isSoldier ? (
            <G>
              <Path
                d={
                  openJaws
                    ? 'M 36 47 C 25 52, 26 64, 41 64 L 40 59 L 44 57 L 41 53 Z'
                    : 'M 37 47 C 29 53, 33 63, 47 61 L 44 56 L 47 54 L 43 51 Z'
                }
                fill="#CBD5E1"
                stroke={STROKE}
                strokeWidth={2.8}
                strokeLinejoin="round"
              />
              <Path
                d={
                  openJaws
                    ? 'M 64 47 C 75 52, 74 64, 59 64 L 60 59 L 56 57 L 59 53 Z'
                    : 'M 63 47 C 71 53, 67 63, 53 61 L 56 56 L 53 54 L 57 51 Z'
                }
                fill="#CBD5E1"
                stroke={STROKE}
                strokeWidth={2.8}
                strokeLinejoin="round"
              />
            </G>
          ) : (
            <G>
              <Path
                d={
                  openJaws
                    ? 'M 40 48 C 33 53, 35 61, 45 60 L 44 55 Z'
                    : 'M 41 48 C 36 53, 39 59, 48 58 L 46 53 Z'
                }
                fill={chitinDark}
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              <Path
                d={
                  openJaws
                    ? 'M 60 48 C 67 53, 65 61, 55 60 L 56 55 Z'
                    : 'M 59 48 C 64 53, 61 59, 52 58 L 54 53 Z'
                }
                fill={chitinDark}
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            </G>
          )}
          {/* Nimble front ant forelegs */}
          <Path
            d="M 41 74 L 33 83 L 37 90 M 59 74 L 67 83 L 63 90"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      }
    />
  );
};
