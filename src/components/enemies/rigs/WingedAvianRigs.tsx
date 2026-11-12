import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon } from 'react-native-svg';
import { RigLayers } from '@/components/creatures/RigLayers';
import { isBattleWorn, isMouthOpenExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { EnemyEyes } from '../EnemyEyes';
import { EnemyRigProps } from './types';

/**
 * Thieving Raven (glossy midnight-indigo corvid + stolen gold stopwatch)
 * & Magpie (crisp black-and-white pied magpie + iridescent teal tail + shiny gold coin)
 */
export const CorvidRig: React.FC<EnemyRigProps<'magpie'>> = (props) => {
  const { variant, expression, healthState, gazeOffset } = props;
  const isMagpie = variant === 'magpie';
  const isRuffled = isBattleWorn(healthState);
  const openBeak = isMouthOpenExpression(expression);

  const mainCoat = isMagpie ? '#0F172A' : '#1E1B4B';
  const sheenColor = isMagpie ? '#14B8A6' : '#4338CA';
  const iris = isMagpie ? '#14B8A6' : '#F59E0B';
  const beakFill = isMagpie ? '#334155' : '#475569';

  return (
    <RigLayers
      partStyles={props}
      tail={
        isMagpie ? (
          <G>
            {/* Long graduated iridescent teal magpie tail */}
            <Polygon
              points="43,75 36,91 50,97 64,91 57,75"
              fill="#0F766E"
              stroke={STROKE}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Polygon points="46,76 42,89 50,94 58,89 54,76" fill="#14B8A6" />
            <Line x1={50} y1={76} x2={50} y2={95} stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            {/* Wedge-fanned midnight-indigo raven tail */}
            <Path
              d="M 41 75 L 33 92 L 43 94 L 50 96 L 57 94 L 67 92 L 59 75 Z"
              fill={mainCoat}
              stroke={STROKE}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Path d="M 45 78 L 41 91 M 55 78 L 59 91" stroke={sheenColor} strokeWidth={2.2} strokeLinecap="round" />
          </G>
        )
      }
      leftEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 31 50 C 19 42, 8 46, 5 59 L 13 58 L 9 64 L 16 64 L 13 71 L 30 65 Z'
                : 'M 31 50 C 18 42, 7 47, 5 60 L 13 59 L 10 68 L 19 66 L 18 72 L 30 65 Z'
            }
            fill={mainCoat}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {isMagpie ? (
            <G>
              <Path d="M 27 52 C 20 49, 13 52, 11 58 L 24 60 Z" fill="#FFFFFF" />
              <Path d="M 12 65 L 24 63" stroke="#14B8A6" strokeWidth={2.6} strokeLinecap="round" />
            </G>
          ) : (
            <Path d="M 25 52 C 18 49, 12 53, 10 58" stroke={sheenColor} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      rightEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 69 50 C 81 42, 92 46, 95 59 L 87 58 L 91 64 L 84 64 L 87 71 L 70 65 Z'
                : 'M 69 50 C 82 42, 93 47, 95 60 L 87 59 L 90 68 L 81 66 L 82 72 L 70 65 Z'
            }
            fill={mainCoat}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {isMagpie ? (
            <G>
              <Path d="M 73 52 C 80 49, 87 52, 89 58 L 76 60 Z" fill="#FFFFFF" />
              <Path d="M 88 65 L 76 63" stroke="#14B8A6" strokeWidth={2.6} strokeLinecap="round" />
            </G>
          ) : (
            <Path d="M 75 52 C 82 49, 88 53, 90 58" stroke={sheenColor} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      body={
        <G>
          <Path
            d="M 29 50 C 24 64, 27 81, 39 84 L 61 84 C 73 81, 76 64, 71 50 Z"
            fill={mainCoat}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {isMagpie ? (
            <G>
              {/* Crisp snow-white pied waistcoat belly */}
              <Ellipse cx={50} cy={70.5} rx={15.5} ry={11.5} fill="#FFFFFF" />
              <Path
                d="M 33 56 Q 50 66 67 56 L 67 50 L 33 50 Z"
                fill={mainCoat}
              />
              <Path d="M 36 58 Q 50 65 64 58" stroke="#14B8A6" strokeWidth={2.4} strokeLinecap="round" fill="none" />
            </G>
          ) : (
            <G>
              {/* Glossy midnight-indigo breast ruff */}
              <Path
                d="M 34 56 L 39 63 L 45 58 L 50 65 L 55 58 L 61 63 L 66 56"
                fill="#312E81"
                stroke={sheenColor}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <Ellipse cx={50} cy={72} rx={11} ry={7.5} fill="#312E81" opacity={0.65} />
            </G>
          )}
        </G>
      }
      head={
        <G>
          {/* Swept bandit head crest */}
          <Path
            d={
              isRuffled
                ? 'M 41 21 L 36 12 L 47 18 L 52 10 L 56 19 L 64 14 L 59 22 Z'
                : 'M 42 21 L 45 12 L 51 18 L 56 11 L 58 22 Z'
            }
            fill={mainCoat}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Ellipse
            cx={50}
            cy={36.5}
            rx={19.5}
            ry={16.5}
            fill={mainCoat}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          <Path d="M 36 27 Q 50 22 64 27" stroke={sheenColor} strokeWidth={2.4} strokeLinecap="round" fill="none" />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={39}
            rightX={61}
            y={36}
            radius={4.5}
            irisColor={iris}
            darkMask
          />

          {openBeak ? (
            <G>
              <Path
                d="M 42 42 Q 50 38 58 42 L 50 47.5 Z"
                fill={beakFill}
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              <Path
                d="M 44 46.5 L 56 46.5 L 50 54.5 Z"
                fill="#BE123C"
                stroke={STROKE}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
            </G>
          ) : (
            <G>
              <Path
                d="M 41.5 42.5 Q 50 38.5 58.5 42.5 L 50 52 Z"
                fill={beakFill}
                stroke={STROKE}
                strokeWidth={2.6}
                strokeLinejoin="round"
              />
              <Line x1={50} y1={40.5} x2={50} y2={50.5} stroke="#94A3B8" strokeWidth={1.6} strokeLinecap="round" />
            </G>
          )}
        </G>
      }
      paws={
        isMagpie ? (
          <G>
            <Path d="M 36 82 L 32 88 M 39 82 L 38 89 M 42 82 L 43 88" stroke={STROKE} strokeWidth={2.8} strokeLinecap="round" />
            {/* Shiny stolen gold coin clutched in right talon! */}
            <Circle cx={57} cy={86.5} r={8} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={2.7} />
            <Circle cx={57} cy={86.5} r={5.2} fill="#F59E0B" />
            <Line x1={57} y1={83.2} x2={57} y2={89.8} stroke={COLORS.actionYellow} strokeWidth={2.1} strokeLinecap="round" />
            <Polygon points="64,77 65.3,79.7 68,81 65.3,82.3 64,85 62.7,82.3 60,81 62.7,79.7" fill="#FFFFFF" />
            {/* Right talon toes gripping top of coin */}
            <Path d="M 53 79 L 52 83 M 57 78.5 L 57 82.5 M 61 79 L 62 83" stroke={STROKE} strokeWidth={2.7} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            <Path d="M 35 82 L 31 88 M 38.5 82 L 37.5 89 M 42 82 L 43 88" stroke={STROKE} strokeWidth={2.8} strokeLinecap="round" />
            {/* Swinging gold chain from talon */}
            <Path
              d="M 44 82 Q 48 89 53 84"
              stroke="#F59E0B"
              strokeWidth={2.4}
              strokeDasharray="2.5 2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Stolen gold stopwatch on chain! */}
            <Circle cx={58} cy={76.5} r={2.5} fill="none" stroke="#F59E0B" strokeWidth={2.1} />
            <Line x1={58} y1={78.5} x2={58} y2={80.5} stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" />
            <Circle cx={58} cy={87.5} r={8.2} fill="#F59E0B" stroke={STROKE} strokeWidth={2.7} />
            <Circle cx={58} cy={87.5} r={5.7} fill="#FFFBEB" stroke={STROKE} strokeWidth={1.6} />
            {/* Stopwatch hands */}
            <Path d="M 58 84 L 58 87.5 L 61 89" stroke="#DC2626" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* Right talon clutching watch crown */}
            <Path d="M 54 79.5 L 53 83 M 58 79 L 58 82.5 M 62 79.5 L 63 83" stroke={STROKE} strokeWidth={2.7} strokeLinecap="round" />
          </G>
        )
      }
    />
  );
};

/**
 * Night Owl: nocturnal barn/horned owl with cream heart-shaped facial disc,
 * feathered ear-tufts, scalloped brown/slate wings, and luminous amber eyes.
 */
export const NightOwlRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openBeak = isMouthOpenExpression(expression);

  const OWL_BROWN = '#6B4226';
  const OWL_SLATE = '#475569';
  const OWL_CREAM = '#FEF3C7';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          <Path
            d="M 38 77 L 34 91 L 50 94 L 66 91 L 62 77 Z"
            fill={OWL_BROWN}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M 37 86 L 63 86" stroke={OWL_CREAM} strokeWidth={2.5} strokeLinecap="round" />
        </G>
      }
      leftEar={
        <G>
          {/* Scalloped brown/slate nocturnal wing */}
          <Path
            d={
              isRuffled
                ? 'M 31 49 C 15 44, 6 54, 8 68 C 11 72, 16 70, 17 66 L 19 72 C 23 74, 28 71, 31 66 Z'
                : 'M 31 49 C 15 44, 6 54, 8 67 C 11 72, 16 71, 18 67 C 20 72, 26 73, 31 66 Z'
            }
            fill={OWL_BROWN}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 27 54 C 18 53, 12 58, 12 64" stroke={OWL_SLATE} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M 25 59 C 19 59, 15 62, 14 66" stroke={OWL_CREAM} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </G>
      }
      rightEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 69 49 C 85 44, 94 54, 92 68 C 89 72, 84 70, 83 66 L 81 72 C 77 74, 72 71, 69 66 Z'
                : 'M 69 49 C 85 44, 94 54, 92 67 C 89 72, 84 71, 82 67 C 80 72, 74 73, 69 66 Z'
            }
            fill={OWL_BROWN}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 73 54 C 82 53, 88 58, 88 64" stroke={OWL_SLATE} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M 75 59 C 81 59, 85 62, 86 66" stroke={OWL_CREAM} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </G>
      }
      body={
        <G>
          <Path
            d="M 28 50 C 23 65, 27 82, 39 86 L 61 86 C 73 82, 77 65, 72 50 Z"
            fill={OWL_BROWN}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Ellipse cx={50} cy={69.5} rx={16.5} ry={13.5} fill={OWL_CREAM} />
          {/* Nocturnal V-chevron chest speckles */}
          <Path
            d="M 41 64 L 43.5 67 L 46 64 M 54 64 L 56.5 67 L 59 64 M 47.5 70 L 50 73 L 52.5 70 M 40 73 L 42.5 76 L 45 73 M 55 73 L 57.5 76 L 60 73"
            stroke={OWL_BROWN}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      }
      head={
        <G>
          <Ellipse
            cx={50}
            cy={37.5}
            rx={23}
            ry={18.5}
            fill={OWL_BROWN}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          <Path
            d={isRuffled ? 'M 33 25 L 20 15 L 26 23 L 23 26 L 38 29 Z' : 'M 33 25 L 21 12 L 40 23 Z'}
            fill={OWL_SLATE}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Path
            d="M 67 25 L 79 12 L 60 23 Z"
            fill={OWL_SLATE}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          {/* Cream heart-shaped barn-owl facial disc */}
          <Path
            d="M 50 32 C 44 23, 29 25, 30 38.5 C 31 48, 42 52.5, 50 54 C 58 52.5, 69 48, 70 38.5 C 71 25, 56 23, 50 32 Z"
            fill="#FFFBEB"
            stroke="#92400E"
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={39.5}
            rightX={60.5}
            y={38.5}
            radius={5.1}
            irisColor="#F59E0B"
          />
          {openBeak ? (
            <G>
              <Polygon points="46,44.5 54,44.5 50,49.5" fill="#F59E0B" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
              <Polygon points="47,48.5 53,48.5 50,53.5" fill="#BE123C" stroke={STROKE} strokeWidth={2.1} strokeLinejoin="round" />
            </G>
          ) : (
            <Path
              d="M 46.5 44 Q 50 42 53.5 44 L 50 51.5 Z"
              fill="#D97706"
              stroke={STROKE}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
          )}
        </G>
      }
      paws={
        <G>
          <Ellipse cx={39} cy={85.5} rx={6.5} ry={3.8} fill={OWL_CREAM} stroke={STROKE} strokeWidth={2.5} />
          <Path d="M 35 87 L 34 91.5 M 39 87.5 L 39 92 M 43 87 L 44 91.5" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" />
          <Ellipse cx={61} cy={85.5} rx={6.5} ry={3.8} fill={OWL_CREAM} stroke={STROKE} strokeWidth={2.5} />
          <Path d="M 57 87 L 56 91.5 M 61 87.5 L 61 92 M 65 87 L 66 91.5" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" />
        </G>
      }
    />
  );
};

/**
 * Wild Goose: chaotic white goose with long S-curved neck, wide flapping wings,
 * webbed orange feet, and angry open honking orange bill!
 */
export const WildGooseRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const quietBill = expression === 'sleepy' || expression === 'ko' || expression === 'blink';

  const GOOSE_WHITE = '#FFFFFF';
  const GOOSE_SHADE = '#E2E8F0';
  const BILL_ORANGE = COLORS.impactOrange;

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          <Polygon
            points="40,78 35,90 50,94 65,90 60,78"
            fill={GOOSE_WHITE}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M 45 81 L 43 89 M 55 81 L 57 89" stroke="#CBD5E1" strokeWidth={2.2} strokeLinecap="round" />
        </G>
      }
      leftEar={
        <G>
          {/* Wide chaotic flapping white wing */}
          <Path
            d={
              isRuffled
                ? 'M 31 56 C 18 42, 9 27, 5 31 L 10 42 L 4 46 L 12 53 L 8 61 L 29 66 Z'
                : 'M 31 56 C 18 40, 8 25, 5 30 C 4 36, 9 42, 6 47 C 5 52, 11 56, 9 62 C 14 66, 22 67, 29 66 Z'
            }
            fill={GOOSE_WHITE}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 26 59 C 19 54, 14 48, 12 41" stroke={GOOSE_SHADE} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        </G>
      }
      rightEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 69 56 C 82 42, 91 27, 95 31 L 90 42 L 96 46 L 88 53 L 92 61 L 71 66 Z'
                : 'M 69 56 C 82 40, 92 25, 95 30 C 96 36, 91 42, 94 47 C 95 52, 89 56, 91 62 C 86 66, 78 67, 71 66 Z'
            }
            fill={GOOSE_WHITE}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 74 59 C 81 54, 86 48, 88 41" stroke={GOOSE_SHADE} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        </G>
      }
      body={
        <G>
          <Path
            d="M 28 57 C 23 70, 28 83, 40 85 L 60 85 C 72 83, 77 70, 72 57 Q 50 51 28 57 Z"
            fill={GOOSE_WHITE}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Path
            d="M 33 75 Q 50 83 67 75"
            stroke={GOOSE_SHADE}
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
      head={
        <G>
          {/* Long chaotic S-curved goose neck */}
          <Path
            d="M 43 60 C 37 49, 55 39, 44 27 L 56 26 C 67 38, 49 49, 57 60 Z"
            fill={GOOSE_WHITE}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Ellipse
            cx={50}
            cy={23.5}
            rx={15.5}
            ry={12}
            fill={GOOSE_WHITE}
            stroke={STROKE}
            strokeWidth={3.1}
          />
          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={41.5}
            rightX={58.5}
            y={22.5}
            radius={3.9}
            irisColor="#0F172A"
          />

          {/* Angry honking orange bill! */}
          {quietBill ? (
            <Path
              d="M 39 28.5 Q 50 25 61 28.5 Q 50 34.5 39 28.5 Z"
              fill={BILL_ORANGE}
              stroke={STROKE}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          ) : (
            <G>
              {/* Open upper honking bill */}
              <Path
                d="M 39 28 C 43 23, 57 23, 61 28 L 57 30 L 43 30 Z"
                fill={BILL_ORANGE}
                stroke={STROKE}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              {/* Open honking mouth & hissing goose tongue */}
              <Path
                d="M 42 29.5 L 58 29.5 L 55 37.5 Q 50 39.5 45 37.5 Z"
                fill="#991B1B"
                stroke={STROKE}
                strokeWidth={2.3}
                strokeLinejoin="round"
              />
              <Path d="M 46 34 Q 50 31 54 34 L 50 38 Z" fill="#FB7185" />
              <Path
                d="M 43 36.5 Q 50 41 57 36.5"
                fill={BILL_ORANGE}
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </G>
          )}
        </G>
      }
      paws={
        <G>
          {/* Webbed bright orange goose feet */}
          <Polygon
            points="39,83 28,92 34,91 38,94 42,91 46,92"
            fill={BILL_ORANGE}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Polygon
            points="61,83 54,92 58,91 62,94 66,91 72,92"
            fill={BILL_ORANGE}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        </G>
      }
    />
  );
};

/**
 * Circling Vulture: hunched scavenger vulture, fluffy white neck ruff collar,
 * crimson bald head, hooked yellow-tip beak, broad dark wings!
 */
export const CirclingVultureRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openBeak = isMouthOpenExpression(expression);

  const VULTURE_DARK = '#292524';
  const VULTURE_WING = '#44403C';
  const BALD_CRIMSON = '#E11D48';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <Path
          d="M 39 76 L 34 92 L 45 90 L 50 95 L 55 90 L 66 92 L 61 76 Z"
          fill={VULTURE_DARK}
          stroke={STROKE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      }
      leftEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 31 50 C 16 38, 6 42, 4 53 L 12 54 L 6 61 L 15 61 L 12 69 L 30 65 Z'
                : 'M 31 50 C 16 38, 5 43, 4 55 L 12 55 L 8 63 L 17 63 L 15 70 L 30 65 Z'
            }
            fill={VULTURE_DARK}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 28 53 C 20 49, 14 51, 11 56 L 26 60 Z" fill={VULTURE_WING} />
        </G>
      }
      rightEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 69 50 C 84 38, 94 42, 96 53 L 88 54 L 94 61 L 85 61 L 88 69 L 70 65 Z'
                : 'M 69 50 C 84 38, 95 43, 96 55 L 88 55 L 92 63 L 83 63 L 85 70 L 70 65 Z'
            }
            fill={VULTURE_DARK}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 72 53 C 80 49, 86 51, 89 56 L 74 60 Z" fill={VULTURE_WING} />
        </G>
      }
      body={
        <G>
          {/* Hunched dark scavenger body */}
          <Path
            d="M 29 52 C 24 66, 27 81, 39 85 L 61 85 C 73 81, 76 66, 71 52 Z"
            fill={VULTURE_DARK}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Ellipse cx={50} cy={71} rx={12.5} ry={9} fill={VULTURE_WING} />
          {/* Fluffy white neck ruff collar */}
          <Path
            d="M 27 51 C 25 45, 31 42, 36 45 C 40 41, 46 41, 50 45 C 54 41, 60 41, 64 45 C 69 42, 75 45, 73 51 C 75 57, 68 60, 62 57 C 58 61, 53 61, 50 58 C 47 61, 42 61, 38 57 C 32 60, 25 57, 27 51 Z"
            fill="#F5F5F4"
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
        </G>
      }
      head={
        <G>
          {/* Hunched wrinkled crimson bald head */}
          <Path
            d="M 42 48 L 41 38 C 33 36, 33 21, 50 21 C 67 21, 67 36, 59 38 L 58 48 Z"
            fill={BALD_CRIMSON}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Ellipse cx={50} cy={26} rx={9} ry={3.2} fill="#FB7185" opacity={0.65} />
          <Path d="M 42 26 Q 50 24 58 26" stroke="#9F1239" strokeWidth={1.8} strokeLinecap="round" fill="none" />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={40}
            rightX={60}
            y={34.5}
            radius={4.3}
            irisColor="#FACC15"
          />

          {/* Hooked scavenger beak with yellow tip */}
          {openBeak ? (
            <G>
              <Path
                d="M 43 40.5 Q 50 37 57 40.5 L 52 47.5 L 48 47.5 Z"
                fill="#FEF08A"
                stroke={STROKE}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <Polygon points="48,44 52,44 50,49.5" fill="#EAB308" />
              <Polygon points="45,47 55,47 50,53" fill="#881337" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
            </G>
          ) : (
            <G>
              <Path
                d="M 42.5 40.5 Q 50 37 57.5 40.5 L 53 49.5 L 50 53 L 47 49.5 Z"
                fill="#FEF9C3"
                stroke={STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {/* Hooked bright yellow beak tip */}
              <Polygon points="47,46.5 53,46.5 50,52.5" fill="#EAB308" />
            </G>
          )}
        </G>
      }
      paws={
        <G>
          <Path d="M 36 83 L 32 89 M 39.5 83 L 39 90 M 43 83 L 45 89" stroke="#FDA4AF" strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M 32 89 L 31 91.5 M 39 90 L 39 92.5 M 45 89 L 46 91.5" stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M 57 83 L 55 89 M 60.5 83 L 61 90 M 64 83 L 68 89" stroke="#FDA4AF" strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M 55 89 L 54 91.5 M 61 90 L 61 92.5 M 68 89 L 69 91.5" stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" />
        </G>
      }
    />
  );
};

/**
 * Diving Hawk (sleek slate-blue & rust peregrine/hawk with swept pointed wings)
 * & Hunting Eagle (majestic dark-brown raptor with snowy white head, golden brow & talons)
 */
export const RaptorRig: React.FC<EnemyRigProps<'eagle'>> = (props) => {
  const { variant, expression, healthState, gazeOffset } = props;
  const isEagle = variant === 'eagle';
  const isRuffled = isBattleWorn(healthState);
  const openBeak = isMouthOpenExpression(expression);

  const wingPrimary = isEagle ? '#3E2723' : '#334155';
  const wingTrim = isEagle ? '#6D4C41' : '#64748B';
  const bodyFill = isEagle ? '#4E342E' : '#334155';
  const iris = isEagle ? '#EAB308' : '#F59E0B';

  return (
    <RigLayers
      partStyles={props}
      tail={
        isEagle ? (
          <G>
            {/* Snowy-white fanned eagle tail */}
            <Polygon
              points="39,76 33,92 50,95 67,92 61,76"
              fill="#FFFFFF"
              stroke={STROKE}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Path d="M 45 79 L 42 91 M 55 79 L 58 91" stroke="#CBD5E1" strokeWidth={2.1} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            {/* Barred aerodynamic peregrine hawk tail */}
            <Polygon
              points="42,76 38,93 50,95 62,93 58,76"
              fill="#475569"
              stroke={STROKE}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Line x1={40} y1={84} x2={60} y2={84} stroke={STROKE} strokeWidth={2.8} />
            <Line x1={39} y1={89} x2={61} y2={89} stroke={STROKE} strokeWidth={2.8} />
          </G>
        )
      }
      leftEar={
        isEagle ? (
          <G>
            <Path
              d={
                isRuffled
                  ? 'M 31 50 C 16 37, 5 39, 4 51 L 12 52 L 6 59 L 15 60 L 12 68 L 30 65 Z'
                  : 'M 31 50 C 15 36, 4 39, 4 52 L 11 53 L 7 61 L 16 61 L 14 68 L 30 65 Z'
              }
              fill={wingPrimary}
              stroke={STROKE}
              strokeWidth={3.1}
              strokeLinejoin="round"
            />
            <Path d="M 29 52 C 20 46, 13 47, 10 52 L 26 59 Z" fill={wingTrim} />
          </G>
        ) : (
          <G>
            {/* Swept pointed supersonic diving hawk wing */}
            <Path
              d={
                isRuffled
                  ? 'M 31 50 L 5 32 L 11 45 L 7 49 L 15 58 L 30 64 Z'
                  : 'M 31 50 L 4 31 L 11 54 L 19 61 L 30 64 Z'
              }
              fill={wingPrimary}
              stroke={STROKE}
              strokeWidth={3.1}
              strokeLinejoin="round"
            />
            <Polygon points="28,52 10,39 16,53 27,59" fill={wingTrim} />
          </G>
        )
      }
      rightEar={
        isEagle ? (
          <G>
            <Path
              d={
                isRuffled
                  ? 'M 69 50 C 84 37, 95 39, 96 51 L 88 52 L 94 59 L 85 60 L 88 68 L 70 65 Z'
                  : 'M 69 50 C 85 36, 96 39, 96 52 L 89 53 L 93 61 L 84 61 L 86 68 L 70 65 Z'
              }
              fill={wingPrimary}
              stroke={STROKE}
              strokeWidth={3.1}
              strokeLinejoin="round"
            />
            <Path d="M 71 52 C 80 46, 87 47, 90 52 L 74 59 Z" fill={wingTrim} />
          </G>
        ) : (
          <G>
            <Path
              d={
                isRuffled
                  ? 'M 69 50 L 95 32 L 89 45 L 93 49 L 85 58 L 70 64 Z'
                  : 'M 69 50 L 96 31 L 89 54 L 81 61 L 70 64 Z'
              }
              fill={wingPrimary}
              stroke={STROKE}
              strokeWidth={3.1}
              strokeLinejoin="round"
            />
            <Polygon points="72,52 90,39 84,53 73,59" fill={wingTrim} />
          </G>
        )
      }
      body={
        <G>
          <Path
            d="M 28 50 C 24 65, 27 81, 39 85 L 61 85 C 73 81, 76 65, 72 50 Z"
            fill={bodyFill}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {isEagle ? (
            <G>
              {/* Sculpted dark-bronze chest armor feathers */}
              <Path
                d="M 36 62 L 50 68 L 64 62 M 38 70 L 50 76 L 62 70"
                stroke={wingTrim}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
          ) : (
            <G>
              {/* Rust-terracotta barred hawk breast */}
              <Ellipse cx={50} cy={69.5} rx={15.5} ry={12.5} fill="#FDBA74" />
              <Path d="M 36 63 Q 50 67 64 63" stroke="#C2410C" strokeWidth={3} strokeLinecap="round" fill="none" />
              <Path d="M 37 69.5 Q 50 73.5 63 69.5" stroke="#C2410C" strokeWidth={2.8} strokeLinecap="round" fill="none" />
              <Path d="M 40 76 Q 50 79 60 76" stroke="#C2410C" strokeWidth={2.6} strokeLinecap="round" fill="none" />
            </G>
          )}
        </G>
      }
      head={
        isEagle ? (
          <G>
            {/* Snowy white eagle head with jagged collar ruff */}
            <Path
              d="M 29 38 C 29 22, 38 18, 50 18 C 62 18, 71 22, 71 38 L 69 49 L 62 45 L 56 51 L 50 46 L 44 51 L 38 45 L 31 49 Z"
              fill="#FFFFFF"
              stroke={STROKE}
              strokeWidth={3.2}
              strokeLinejoin="round"
            />
            {/* Fierce golden raptor brow ridge */}
            <Path
              d="M 32 31 L 47 35.5 M 68 31 L 53 35.5"
              stroke="#F59E0B"
              strokeWidth={3.8}
              strokeLinecap="round"
            />
            <EnemyEyes
              expression={expression}
              gazeOffset={gazeOffset}
              leftX={39.5}
              rightX={60.5}
              y={36.5}
              radius={4.4}
              irisColor={iris}
            />
            {/* Heavy hooked golden eagle beak */}
            {openBeak ? (
              <G>
                <Path
                  d="M 42 41 Q 50 36.5 58 41 L 52 48.5 L 48 48.5 Z"
                  fill="#FBBF24"
                  stroke={STROKE}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
                <Polygon points="45,47.5 55,47.5 50,53.5" fill="#991B1B" stroke={STROKE} strokeWidth={2.3} strokeLinejoin="round" />
              </G>
            ) : (
              <Path
                d="M 41.5 41 Q 50 36.5 58.5 41 L 53.5 49 L 50 53.5 L 46.5 49 Z"
                fill="#FBBF24"
                stroke={STROKE}
                strokeWidth={2.6}
                strokeLinejoin="round"
              />
            )}
          </G>
        ) : (
          <G>
            {/* Sleek slate-blue peregrine helmet */}
            <Ellipse
              cx={50}
              cy={36}
              rx={20}
              ry={16.5}
              fill="#334155"
              stroke={STROKE}
              strokeWidth={3.2}
            />
            {/* Peregrine white cheek patches + dark malar teardrop stripes */}
            <Circle cx={36.5} cy={40} r={5.8} fill="#FFF7ED" />
            <Circle cx={63.5} cy={40} r={5.8} fill="#FFF7ED" />
            <Path d="M 35 39 L 33 47 M 65 39 L 67 47" stroke="#0F172A" strokeWidth={3.4} strokeLinecap="round" />

            <EnemyEyes
              expression={expression}
              gazeOffset={gazeOffset}
              leftX={39.5}
              rightX={60.5}
              y={35.5}
              radius={4.4}
              irisColor={iris}
              darkMask
            />

            {/* Sharp hooked raptor beak */}
            {openBeak ? (
              <G>
                <Path
                  d="M 43 41 Q 50 37.5 57 41 L 50 47.5 Z"
                  fill="#FACC15"
                  stroke={STROKE}
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                />
                <Polygon points="45,46.5 55,46.5 50,52.5" fill="#BE123C" stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
              </G>
            ) : (
              <G>
                <Path
                  d="M 42.5 41 Q 50 37.5 57.5 41 L 50 51.5 Z"
                  fill="#FACC15"
                  stroke={STROKE}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
                <Polygon points="47,46 53,46 50,51.5" fill="#1E293B" />
              </G>
            )}
          </G>
        )
      }
      paws={
        <G>
          {/* Fierce golden raptor talons */}
          <Path
            d="M 34 83 L 29 90 M 38.5 83 L 38 91 M 43 83 L 45 90"
            stroke="#FBBF24"
            strokeWidth={3.6}
            strokeLinecap="round"
          />
          <Path
            d="M 29 90 L 28 93 M 38 91 L 38 94 M 45 90 L 46 93"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <Path
            d="M 57 83 L 55 90 M 61.5 83 L 62 91 M 66 83 L 71 90"
            stroke="#FBBF24"
            strokeWidth={3.6}
            strokeLinecap="round"
          />
          <Path
            d="M 55 90 L 54 93 M 62 91 L 62 94 M 71 90 L 72 93"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </G>
      }
    />
  );
};

/**
 * Shadow Bat: fanged purple-black vampire bat with scalloped leathery wings & pointed radar ears!
 */
export const ShadowBatRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const BAT_DARK = '#1E1B4B';
  const BAT_MEMBRANE = '#4C1D95';
  const BAT_RIB = '#7C3AED';
  const EAR_INNER = '#DB2777';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          {/* Forked bat tail-membrane & shadow wisps */}
          <Polygon
            points="42,77 37,91 50,86 63,91 58,77"
            fill={BAT_DARK}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Path d="M 32 88 Q 27 93 23 90 M 68 88 Q 73 93 77 90" stroke={BAT_RIB} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </G>
      }
      leftEar={
        <G>
          {/* Scalloped leathery left vampire wing */}
          <Path
            d={
              isRuffled
                ? 'M 32 52 L 15 31 L 4 49 Q 10 47 12 56 L 9 52 L 16 63 Q 22 59 31 66 Z'
                : 'M 32 52 L 15 31 L 4 50 Q 11 47 14 58 Q 20 53 23 64 Q 27 60 31 66 Z'
            }
            fill={BAT_MEMBRANE}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {/* Wing thumb claw & membrane finger struts */}
          <Path d="M 15 31 L 13 25" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M 15 32 L 14 57 M 15 32 L 23 63" stroke={BAT_RIB} strokeWidth={2} strokeLinecap="round" />
        </G>
      }
      rightEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 68 52 L 85 31 L 96 49 Q 90 47 88 56 L 91 52 L 84 63 Q 78 59 69 66 Z'
                : 'M 68 52 L 85 31 L 96 50 Q 89 47 86 58 Q 80 53 77 64 Q 73 60 69 66 Z'
            }
            fill={BAT_MEMBRANE}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 85 31 L 87 25" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M 85 32 L 86 57 M 85 32 L 77 63" stroke={BAT_RIB} strokeWidth={2} strokeLinecap="round" />
        </G>
      }
      body={
        <G>
          <Ellipse
            cx={50}
            cy={66}
            rx={18}
            ry={16.5}
            fill={BAT_DARK}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          {/* Fluffy plum vampire chest ruff */}
          <Polygon
            points="36,55 43,64 47,59 50,66 53,59 57,64 64,55 50,51"
            fill="#6D28D9"
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        </G>
      }
      head={
        <G>
          {/* Huge pointed radar bat ears */}
          <Path
            d={isRuffled ? 'M 28 32 L 18 7 L 29 14 L 26 18 L 41 23 Z' : 'M 28 32 L 18 7 L 41 23 Z'}
            fill={BAT_DARK}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon points="29,28 22,13 37,23" fill={EAR_INNER} />
          <Line x1={25} y1={19} x2={33} y2={23} stroke={BAT_DARK} strokeWidth={1.6} strokeLinecap="round" />

          <Path
            d="M 72 32 L 82 7 L 59 23 Z"
            fill={BAT_DARK}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon points="71,28 78,13 63,23" fill={EAR_INNER} />
          <Line x1={75} y1={19} x2={67} y2={23} stroke={BAT_DARK} strokeWidth={1.6} strokeLinecap="round" />

          <Ellipse
            cx={50}
            cy={37.5}
            rx={20}
            ry={16}
            fill={BAT_DARK}
            stroke={STROKE}
            strokeWidth={3.2}
          />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={39}
            rightX={61}
            y={36.5}
            radius={4.5}
            irisColor="#F43F5E"
            darkMask
          />

          <Polygon
            points="46.5,42 50,37.5 53.5,42 50,44.5"
            fill={EAR_INNER}
            stroke="#FFFFFF"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />

          {openMouth ? (
            <G>
              <Path
                d="M 39 46 Q 50 55.5 61 46 Z"
                fill="#9F1239"
                stroke="#FFFFFF"
                strokeWidth={1.8}
                strokeLinejoin="round"
              />
              <Polygon points="42,46.5 45.5,46.5 43.8,52.5" fill="#FFFFFF" />
              <Polygon points="54.5,46.5 58,46.5 56.2,52.5" fill="#FFFFFF" />
            </G>
          ) : (
            <G>
              <Path d="M 40 46.5 Q 50 50.5 60 46.5" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" fill="none" />
              <Polygon points="42.5,47.2 46,47.8 44.2,53" fill="#FFFFFF" />
              <Polygon points="54,47.8 57.5,47.2 55.8,53" fill="#FFFFFF" />
            </G>
          )}
        </G>
      }
      paws={
        <G>
          {/* Hanging purple-slate bat claws */}
          <Path d="M 39 81 L 36 88 M 42 81.5 L 42 89 M 45 81 L 47 88" stroke="#6D28D9" strokeWidth={2.8} strokeLinecap="round" />
          <Path d="M 55 81 L 53 88 M 58 81.5 L 58 89 M 61 81 L 64 88" stroke="#6D28D9" strokeWidth={2.8} strokeLinecap="round" />
        </G>
      }
    />
  );
};

/**
 * Prism Moth: radiant twilight moth whose left/right wings have stained-glass
 * rainbow geometric facets (red/gold/teal/violet) + feathery antennae!
 */
export const PrismMothRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const MOTH_INDIGO = '#312E81';
  const FACET_RED = '#EF4444';
  const FACET_GOLD = '#FACC15';
  const FACET_TEAL = '#14B8A6';
  const FACET_VIOLET = '#8B5CF6';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          {/* Shimmering swallowtail prism hind-tails */}
          <Path
            d="M 44 76 C 40 85, 35 90, 38 95 C 42 95, 45 87, 48 79 Z"
            fill={FACET_VIOLET}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Path
            d="M 56 76 C 60 85, 65 90, 62 95 C 58 95, 55 87, 52 79 Z"
            fill={FACET_TEAL}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Circle cx={39} cy={92.5} r={2} fill={FACET_GOLD} />
          <Circle cx={61} cy={92.5} r={2} fill={FACET_GOLD} />
        </G>
      }
      leftEar={
        <G>
          {/* Left Stained-Glass Forewing + Hindwing */}
          <Path
            d={
              isRuffled
                ? 'M 33 49 C 19 26, 4 26, 5 44 L 11 48 L 6 54 C 8 68, 18 76, 33 68 Z'
                : 'M 33 49 C 19 25, 4 26, 5 45 C 5 55, 11 58, 9 65 C 10 74, 21 76, 33 68 Z'
            }
            fill="#1E1B4B"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {/* Rainbow geometric stained-glass facets */}
          <Polygon points="30,49 16,33 9,43 22,52" fill={FACET_RED} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="22,52 9,43 10,55 25,58" fill={FACET_GOLD} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="30,49 22,52 25,58 32,57" fill={FACET_VIOLET} stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round" />
          <Polygon points="25,58 12,59 15,70 30,66" fill={FACET_TEAL} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={17.5} cy={46} r={2.4} fill="#FFFFFF" />
        </G>
      }
      rightEar={
        <G>
          <Path
            d={
              isRuffled
                ? 'M 67 49 C 81 26, 96 26, 95 44 L 89 48 L 94 54 C 92 68, 82 76, 67 68 Z'
                : 'M 67 49 C 81 25, 96 26, 95 45 C 95 55, 89 58, 91 65 C 90 74, 79 76, 67 68 Z'
            }
            fill="#1E1B4B"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon points="70,49 84,33 91,43 78,52" fill={FACET_RED} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="78,52 91,43 90,55 75,58" fill={FACET_GOLD} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="70,49 78,52 75,58 68,57" fill={FACET_VIOLET} stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round" />
          <Polygon points="75,58 88,59 85,70 70,66" fill={FACET_TEAL} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={82.5} cy={46} r={2.4} fill="#FFFFFF" />
        </G>
      }
      body={
        <G>
          {/* Velvet striped twilight abdomen & fluffy collar */}
          <Ellipse
            cx={50}
            cy={67}
            rx={15.5}
            ry={16.5}
            fill={MOTH_INDIGO}
            stroke={STROKE}
            strokeWidth={3.1}
          />
          <Path d="M 37 66 Q 50 70 63 66 M 39 73 Q 50 77 61 73" stroke="#6366F1" strokeWidth={2.8} strokeLinecap="round" fill="none" />
          {/* Fluffy twilight neck ruff + prism chest gem */}
          <Path
            d="M 33 53 Q 41 61 50 56 Q 59 61 67 53 Q 59 46 50 49 Q 41 46 33 53 Z"
            fill="#E0E7FF"
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Polygon points="50,51.5 54,56.5 50,61.5 46,56.5" fill={FACET_GOLD} stroke={STROKE} strokeWidth={1.9} />
        </G>
      }
      head={
        <G>
          {/* Feathery golden plumose antennae */}
          <Path d="M 41 25 C 37 14, 28 9, 21 12" stroke={FACET_GOLD} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M 36 18 L 31 22 M 32 14 L 27 19 M 27 12 L 24 17" stroke={FACET_GOLD} strokeWidth={2.1} strokeLinecap="round" />
          <Path d="M 59 25 C 63 14, 72 9, 79 12" stroke={FACET_GOLD} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M 64 18 L 69 22 M 68 14 L 73 19 M 73 12 L 76 17" stroke={FACET_GOLD} strokeWidth={2.1} strokeLinecap="round" />

          <Ellipse
            cx={50}
            cy={37}
            rx={18.5}
            ry={14.5}
            fill="#1E1B4B"
            stroke={STROKE}
            strokeWidth={3.1}
          />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={39.5}
            rightX={60.5}
            y={36.5}
            radius={4.6}
            irisColor="#38BDF8"
            darkMask
          />

          {/* Curled golden proboscis / mouth */}
          {openMouth ? (
            <Path
              d="M 50 44 C 50 51, 57 52, 56 47 C 55 44, 52 46, 53 48"
              stroke={FACET_GOLD}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <Path d="M 45 45 Q 50 48.5 55 45" stroke="#E0E7FF" strokeWidth={2.2} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      paws={
        <G>
          {/* Clasped moth forelegs holding a glowing prism mote */}
          <Path d="M 39 79 L 45 85 M 61 79 L 55 85" stroke={STROKE} strokeWidth={2.8} strokeLinecap="round" />
          <Polygon points="50,80 54,85 50,90 46,85" fill={FACET_TEAL} stroke={STROKE} strokeWidth={2.1} />
          <Circle cx={50} cy={85} r={1.8} fill="#FFFFFF" />
        </G>
      }
    />
  );
};

/**
 * Swift Bee: plump fuzzy gold-and-black striped bee, translucent sky-blue wings,
 * bobbing antennae, and sharp stinger!
 */
export const SwiftBeeRig: React.FC<EnemyRigProps> = (props) => {
  const { expression, healthState, gazeOffset } = props;
  const isRuffled = isBattleWorn(healthState);
  const openMouth = isMouthOpenExpression(expression);

  const BEE_GOLD = COLORS.actionYellow;
  const BEE_BLACK = '#1E293B';
  const WING_BLUE = '#BAE6FD';

  return (
    <RigLayers
      partStyles={props}
      tail={
        <G>
          {/* Sharp venomous bee stinger */}
          <Polygon
            points="43.5,81 56.5,81 50,96"
            fill={BEE_BLACK}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Circle cx={50} cy={95} r={1.8} fill="#A3E635" />
        </G>
      }
      leftEar={
        <G opacity={0.88}>
          {/* Translucent sky-blue left bee forewing + hindwing */}
          <Path
            d={
              isRuffled
                ? 'M 33 51 C 16 32, 4 35, 7 49 L 13 50 L 9 55 C 15 61, 24 60, 32 58 Z'
                : 'M 33 51 C 16 31, 4 35, 6 49 C 8 58, 20 60, 32 58 Z'
            }
            fill={WING_BLUE}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Ellipse cx={23} cy={61} rx={9} ry={5.5} fill={WING_BLUE} stroke={STROKE} strokeWidth={2.5} />
          <Path d="M 30 52 L 13 45 M 22 49 L 16 54" stroke="#0284C7" strokeWidth={1.8} strokeLinecap="round" />
        </G>
      }
      rightEar={
        <G opacity={0.88}>
          <Path
            d={
              isRuffled
                ? 'M 67 51 C 84 32, 96 35, 93 49 L 87 50 L 91 55 C 85 61, 76 60, 68 58 Z'
                : 'M 67 51 C 84 31, 96 35, 94 49 C 92 58, 80 60, 68 58 Z'
            }
            fill={WING_BLUE}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Ellipse cx={77} cy={61} rx={9} ry={5.5} fill={WING_BLUE} stroke={STROKE} strokeWidth={2.5} />
          <Path d="M 70 52 L 87 45 M 78 49 L 84 54" stroke="#0284C7" strokeWidth={1.8} strokeLinecap="round" />
        </G>
      }
      body={
        <G>
          {/* Plump fuzzy gold-and-black striped bee abdomen */}
          <Ellipse
            cx={50}
            cy={67}
            rx={20}
            ry={17.5}
            fill={BEE_GOLD}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          {/* Bold curved black bee stripes */}
          <Path d="M 31.5 62 Q 50 67.5 68.5 62" stroke={BEE_BLACK} strokeWidth={5.5} strokeLinecap="round" fill="none" />
          <Path d="M 33 72 Q 50 77.5 67 72" stroke={BEE_BLACK} strokeWidth={5.5} strokeLinecap="round" fill="none" />
          {/* Fluffy pale-gold pollen thorax collar */}
          <Path
            d="M 31 52 C 33 46, 42 46, 45 50 C 48 46, 52 46, 55 50 C 58 46, 67 46, 69 52 C 66 58, 57 59, 50 57 C 43 59, 34 58, 31 52 Z"
            fill="#FEF08A"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
        </G>
      }
      head={
        <G>
          {/* Bobbing elbowed bee antennae */}
          <Path d="M 42 23 L 36 12 L 29 14" stroke={STROKE} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={28.5} cy={14} r={2.8} fill={BEE_BLACK} />
          <Path d="M 58 23 L 64 12 L 71 14" stroke={STROKE} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={71.5} cy={14} r={2.8} fill={BEE_BLACK} />

          {/* Expressive golden bee head */}
          <Ellipse
            cx={50}
            cy={36.5}
            rx={19}
            ry={15}
            fill={BEE_GOLD}
            stroke={STROKE}
            strokeWidth={3.2}
          />
          {/* Forehead dark crown patch */}
          <Path d="M 37 25 Q 50 31 63 25 Q 50 20 37 25 Z" fill={BEE_BLACK} />

          <EnemyEyes
            expression={expression}
            gazeOffset={gazeOffset}
            leftX={39.5}
            rightX={60.5}
            y={36.5}
            radius={4.5}
            irisColor="#B45309"
          />

          {/* Buzzing bee smirk / mandibles */}
          {openMouth ? (
            <G>
              <Path
                d="M 42 44 Q 50 52 58 44 Z"
                fill={BEE_BLACK}
                stroke={STROKE}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
              <Polygon points="44,44.5 47,44.5 45.5,48" fill="#FFFFFF" />
              <Polygon points="53,44.5 56,44.5 54.5,48" fill="#FFFFFF" />
            </G>
          ) : (
            <Path
              d="M 43 44.5 L 47 46.5 L 50 44.5 L 53 46.5 L 57 44.5"
              stroke={STROKE}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </G>
      }
      paws={
        <G>
          {/* Nimble black segmented bee legs */}
          <Path d="M 35 77 L 29 83 L 33 88" stroke={BEE_BLACK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M 42 80 L 38 86 L 41 90" stroke={BEE_BLACK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M 58 80 L 62 86 L 59 90" stroke={BEE_BLACK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M 65 77 L 71 83 L 67 88" stroke={BEE_BLACK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      }
    />
  );
};
