import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { RigLayers } from '@/components/creatures/RigLayers';
import { isBattleWorn, isFierceExpression, isHurtExpression } from '@/components/creatures/expressions';
import { STROKE } from '@/components/illustration/primitives';
import { COLORS } from '@/utils/colors';
import { EnemyEyes } from '../EnemyEyes';
import { EnemyRigProps } from './types';

type SubRigState = EnemyRigProps & {
  isRuffled: boolean;
  isHurt: boolean;
  isFierce: boolean;
};

/* ============================================================================
 * 1. WET CRAB — Glossy coral-red reef crab, notched shell, big pincers, eyestalks & bubbles
 * ============================================================================ */
const renderWetCrab = (s: SubRigState) => {
  const SHELL = '#EF4444';
  const SHELL_DARK = '#B91C1C';
  const SHELL_GLOSS = '#FCA5A5';
  const BELLY = '#FDE68A';
  const BUBBLE = '#38BDF8';
  const BUBBLE_SHINE = '#E0F2FE';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          <Circle cx={60} cy={27} r={5.4} fill={BUBBLE} stroke={STROKE} strokeWidth={2.5} />
          <Path d="M 57.5 25 A 2.6 2.6 0 0 1 60.5 23.2" stroke={BUBBLE_SHINE} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <Circle cx={50} cy={16} r={4} fill={BUBBLE} stroke={STROKE} strokeWidth={2.3} />
          <Circle cx={48.6} cy={14.6} r={1.1} fill={BUBBLE_SHINE} />
          <Circle cx={67} cy={14} r={2.8} fill={BUBBLE_SHINE} stroke={STROKE} strokeWidth={2.1} />
        </G>
      }
      body={
        <G>
          {/* Back reef walking legs */}
          <Path
            d="M 28 66 L 14 70 L 9 80 M 30 71 L 16 77 L 13 86"
            stroke={STROKE}
            strokeWidth={5.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M 28 66 L 14 70 L 9 80 M 30 71 L 16 77 L 13 86"
            stroke={SHELL_DARK}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M 72 66 L 86 70 L 91 80 M 70 71 L 84 77 L 87 86"
            stroke={STROKE}
            strokeWidth={5.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M 72 66 L 86 70 L 91 80 M 70 71 L 84 77 L 87 86"
            stroke={SHELL_DARK}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Segmented crab plastron underbelly */}
          <Ellipse cx={50} cy={73} rx={21} ry={9.5} fill={BELLY} stroke={STROKE} strokeWidth={3} />
          <Line x1={35} y1={73} x2={65} y2={73} stroke={STROKE} strokeWidth={2} />
          <Line x1={50} y1={66} x2={50} y2={81} stroke={STROKE} strokeWidth={2} />
        </G>
      }
      leftEar={
        <G>
          {/* Left snapping crab pincer arm & big notched claw */}
          <Path
            d="M 29 61 L 18 52 L 22 44 L 31 54 Z"
            fill={SHELL_DARK}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 19 49 C 6 45, 5 24, 18 19 L 21 31 L 16 33 L 22 36 L 26 23 C 33 29, 31 45, 19 49 Z"
            fill={SHELL}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 11 35 C 10 29, 13 24, 16 22" stroke={SHELL_GLOSS} strokeWidth={2.3} strokeLinecap="round" fill="none" />
        </G>
      }
      rightEar={
        <G>
          {/* Right snapping crab pincer arm & big notched claw */}
          <Path
            d="M 71 61 L 82 52 L 78 44 L 69 54 Z"
            fill={SHELL_DARK}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 81 49 C 94 45, 95 24, 82 19 L 79 31 L 84 33 L 78 36 L 74 23 C 67 29, 69 45, 81 49 Z"
            fill={SHELL}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 89 35 C 90 29, 87 24, 84 22" stroke={SHELL_GLOSS} strokeWidth={2.3} strokeLinecap="round" fill="none" />
        </G>
      }
      head={
        <G>
          {/* Tall coral eyestalk stems */}
          <Path d="M 40 46 L 38 31" stroke={STROKE} strokeWidth={7.4} strokeLinecap="round" />
          <Path d="M 40 46 L 38 31" stroke={SHELL} strokeWidth={3.8} strokeLinecap="round" />
          <Path d="M 60 46 L 62 31" stroke={STROKE} strokeWidth={7.4} strokeLinecap="round" />
          <Path d="M 60 46 L 62 31" stroke={SHELL} strokeWidth={3.8} strokeLinecap="round" />

          {/* Wide notched coral carapace */}
          <Path
            d={
              s.isRuffled
                ? 'M 19 56 L 24 46 L 31 48 L 37 42 L 50 40 L 55 45 L 61 41 L 69 47 L 76 45 L 81 56 C 78 69, 65 73, 50 73 C 35 73, 22 69, 19 56 Z'
                : 'M 19 56 L 24 46 L 31 48 L 38 42 L 50 40 L 62 42 L 69 48 L 76 46 L 81 56 C 78 69, 65 73, 50 73 C 35 73, 22 69, 19 56 Z'
            }
            fill={SHELL}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* Glossy wet carapace shine */}
          <Path d="M 30 50 Q 46 44 63 48" stroke={SHELL_GLOSS} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx={28} cy={56} r={2.2} fill={SHELL_GLOSS} />

          {/* Battle shell crack when ruffled */}
          {s.isRuffled && (
            <Path
              d="M 55 44 L 52 51 L 58 55 L 54 61"
              stroke={STROKE}
              strokeWidth={2.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}

          {/* Eyestalk socket rims + expressive eyes */}
          <Circle cx={38} cy={30} r={6.4} fill={SHELL} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={62} cy={30} r={6.4} fill={SHELL} stroke={STROKE} strokeWidth={2.8} />
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={38}
            rightX={62}
            y={30}
            radius={4.3}
            irisColor="#0284C7"
          />

          {/* Snappy crustacean mandibles & frothy mouth */}
          {s.isHurt ? (
            <Path d="M 41 63 Q 45.5 59 50 63 Q 54.5 59 59 63" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          ) : (
            <G>
              <Path
                d="M 38 60 Q 50 67 62 60 Q 56 57 50 60 Q 44 57 38 60 Z"
                fill={SHELL_DARK}
                stroke={STROKE}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <Circle cx={64} cy={61} r={2.1} fill={BUBBLE_SHINE} stroke={STROKE} strokeWidth={1.6} />
            </G>
          )}
        </G>
      }
      paws={
        <G>
          {/* Front spiked crab walking legs + reef foam */}
          <Path
            d="M 36 72 L 26 81 L 23 90 M 64 72 L 74 81 L 77 90"
            stroke={STROKE}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M 36 72 L 26 81 L 23 90 M 64 72 L 74 81 L 77 90"
            stroke={SHELL}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx={35} cy={88} r={2.6} fill={BUBBLE_SHINE} stroke={STROKE} strokeWidth={1.8} />
          <Circle cx={66} cy={88} r={2.3} fill={BUBBLE} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 2. LURKING SHARK — Great white rising from wave foam, nicked dorsal fin, gills & serrated jaws
 * ============================================================================ */
const renderLurkingShark = (s: SubRigState) => {
  const SHARK_BLUE = '#475569';
  const SHARK_DARK = '#334155';
  const SHARK_BELLY = '#F1F5F9';
  const GUMS = '#BE123C';
  const WAVE = '#0284C7';
  const FOAM = '#E0F2FE';

  return (
    <RigLayers
      partStyles={s}
      tail={
        <G>
          {/* Tall iconic battle-nicked dorsal fin + rear caudal tail tip */}
          <Path
            d="M 44 26 L 54 6 L 60 14 L 56 17 L 62 26 Z"
            fill={SHARK_DARK}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path
            d="M 68 76 C 78 74, 86 67, 90 57 L 86 72 L 93 80 C 83 83, 75 83, 68 81 Z"
            fill={SHARK_BLUE}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
        </G>
      }
      leftEar={
        <Path
          d={
            s.isRuffled
              ? 'M 30 55 L 7 69 L 17 69 L 15 73 L 31 68 Z'
              : 'M 30 55 L 6 70 L 31 68 Z'
          }
          fill={SHARK_BLUE}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
      }
      rightEar={
        <Path
          d="M 70 55 L 94 70 L 69 68 Z"
          fill={SHARK_BLUE}
          stroke={STROKE}
          strokeWidth={3.1}
          strokeLinejoin="round"
        />
      }
      body={
        <G>
          {/* Muscular torpedo shark body */}
          <Path
            d="M 26 52 L 23 85 L 77 85 L 74 52 Z"
            fill={SHARK_BLUE}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Path d="M 34 55 L 32 85 L 68 85 L 66 55 Z" fill={SHARK_BELLY} />
          {/* Three dark curved gill slits per flank */}
          <G stroke={STROKE} strokeWidth={2.2} strokeLinecap="round" fill="none">
            <Path d="M 28 62 Q 31 66 28 70" />
            <Path d="M 32 63 Q 35 67 32 71" />
            <Path d="M 36 64 Q 38 68 36 72" />
            <Path d="M 72 62 Q 69 66 72 70" />
            <Path d="M 68 63 Q 65 67 68 71" />
            <Path d="M 64 64 Q 62 68 64 72" />
          </G>
        </G>
      }
      head={
        <G>
          <Path
            d="M 24 56 C 23 36, 35 19, 50 17 C 65 19, 77 36, 76 56 C 72 64, 62 66, 50 66 C 38 66, 28 64, 24 56 Z"
            fill={SHARK_BLUE}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Path
            d="M 28 48 Q 50 41 72 48 C 70 61, 61 65, 50 65 C 39 65, 30 61, 28 48 Z"
            fill={SHARK_BELLY}
          />

          {/* Battle scar across snout */}
          {s.isRuffled && (
            <G stroke={STROKE} strokeWidth={2.2} strokeLinecap="round">
              <Line x1={44} y1={24} x2={54} y2={33} />
              <Line x1={47} y1={31} x2={51} y2={25} />
            </G>
          )}

          <Circle cx={44} cy={32} r={1.4} fill={STROKE} />
          <Circle cx={56} cy={32} r={1.4} fill={STROKE} />

          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={35}
            rightX={65}
            y={38}
            radius={4.3}
            irisColor="#F59E0B"
          />

          {/* Wide cavernous serrated toothy jaws */}
          <Path
            d={
              s.isFierce
                ? 'M 32 51 Q 50 42 68 51 Q 66 64 50 64 Q 34 64 32 51 Z'
                : 'M 33 52 Q 50 44 67 52 Q 65 62 50 62 Q 35 62 33 52 Z'
            }
            fill={GUMS}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          {/* Upper & lower serrated razor teeth */}
          <Polygon
            points="35,51 39,56 43,49 47,56 50,48 53,56 57,49 61,56 65,51"
            fill={COLORS.canvasWhite}
            stroke={STROKE}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <Polygon
            points="37,60 41,55 45,61 50,55 55,61 59,55 63,60"
            fill={COLORS.canvasWhite}
            stroke={STROKE}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </G>
      }
      paws={
        <G>
          {/* Churning ocean wave & white seafoam crest */}
          <Path
            d="M 12 84 Q 24 76 36 83 Q 50 75 64 83 Q 76 76 88 84 L 88 91 L 12 91 Z"
            fill={WAVE}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 15 83 Q 25 78 35 83 Q 50 77 65 83 Q 75 78 85 83"
            stroke={FOAM}
            strokeWidth={3.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={22} cy={79} r={2.4} fill={FOAM} stroke={STROKE} strokeWidth={1.6} />
          <Circle cx={78} cy={79} r={2.2} fill={FOAM} stroke={STROKE} strokeWidth={1.6} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 3. JELLYFISH — Bioluminescent cyan-violet bell dome, glowing core & beaded ribbon tentacles
 * ============================================================================ */
const renderJellyfish = (s: SubRigState) => {
  const BELL_VIOLET = '#8B5CF6';
  const BELL_CYAN = '#22D3EE';
  const CORE_GLOW = '#ECFEFF';
  const RIBBON = '#E879F9';
  const SKIRT = '#6D28D9';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Central undulating beaded stinging filaments */}
          <Path
            d="M 45 53 C 39 64, 51 73, 43 89 M 55 53 C 61 64, 49 73, 57 89"
            stroke={BELL_CYAN}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={43} cy={67} r={2.3} fill={CORE_GLOW} stroke={STROKE} strokeWidth={1.7} />
          <Circle cx={46} cy={79} r={2.1} fill={BELL_CYAN} stroke={STROKE} strokeWidth={1.7} />
          <Circle cx={57} cy={67} r={2.3} fill={CORE_GLOW} stroke={STROKE} strokeWidth={1.7} />
          <Circle cx={54} cy={79} r={2.1} fill={BELL_CYAN} stroke={STROKE} strokeWidth={1.7} />
        </G>
      }
      body={
        <G>
          <Path
            d="M 22 48 Q 30 60 39 54 Q 50 62 61 54 Q 70 60 78 48 Z"
            fill={SKIRT}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
        </G>
      }
      leftEar={
        <G>
          {/* Left undulating ribbon & beaded tentacle */}
          <Path
            d="M 27 51 C 16 61, 30 72, 18 87"
            stroke={STROKE}
            strokeWidth={5.2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 27 51 C 16 61, 30 72, 18 87"
            stroke={RIBBON}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={22} cy={62} r={2.2} fill={BELL_CYAN} stroke={STROKE} strokeWidth={1.6} />
          <Circle cx={24} cy={75} r={2} fill={CORE_GLOW} stroke={STROKE} strokeWidth={1.6} />
        </G>
      }
      rightEar={
        <G>
          {/* Right undulating ribbon & beaded tentacle */}
          <Path
            d="M 73 51 C 84 61, 70 72, 82 87"
            stroke={STROKE}
            strokeWidth={5.2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 73 51 C 84 61, 70 72, 82 87"
            stroke={RIBBON}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={78} cy={62} r={2.2} fill={BELL_CYAN} stroke={STROKE} strokeWidth={1.6} />
          <Circle cx={76} cy={75} r={2} fill={CORE_GLOW} stroke={STROKE} strokeWidth={1.6} />
        </G>
      }
      head={
        <G>
          {/* Translucent cyan-violet bell dome */}
          <Path
            d={
              s.isRuffled
                ? 'M 17 49 C 17 22, 32 12, 50 12 C 63 12, 74 18, 79 29 L 74 33 L 82 40 L 83 49 Q 71 55 59 50 Q 50 56 41 50 Q 29 55 17 49 Z'
                : 'M 17 49 C 17 21, 33 12, 50 12 C 67 12, 83 21, 83 49 Q 71 55 59 50 Q 50 56 41 50 Q 29 55 17 49 Z'
            }
            fill={BELL_VIOLET}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* Inner bioluminescent cyan bell layer */}
          <Path
            d="M 24 46 C 25 25, 36 17, 50 17 C 64 17, 75 25, 76 46 Q 63 50 50 47 Q 37 50 24 46 Z"
            fill={BELL_CYAN}
            opacity={0.75}
          />
          {/* Glowing inner bio-nucleus core */}
          <Ellipse cx={50} cy={29} rx={13} ry={8} fill={CORE_GLOW} stroke={RIBBON} strokeWidth={2} />
          <Ellipse cx={50} cy={29} rx={6.5} ry={3.8} fill={RIBBON} />
          <Path d="M 27 32 C 29 23, 36 18, 43 17" stroke={CORE_GLOW} strokeWidth={2.8} strokeLinecap="round" fill="none" />

          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={38}
            rightX={62}
            y={40}
            radius={4.5}
            irisColor="#0891B2"
          />
        </G>
      }
      paws={
        <G>
          {/* Frilled oral ribbon arms & electric sting sparks */}
          <Path
            d="M 38 55 Q 32 65 39 74 Q 44 80 36 88"
            stroke={STROKE}
            strokeWidth={4.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 38 55 Q 32 65 39 74 Q 44 80 36 88"
            stroke={BELL_CYAN}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 62 55 Q 68 65 61 74 Q 56 80 64 88"
            stroke={STROKE}
            strokeWidth={4.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 62 55 Q 68 65 61 74 Q 56 80 64 88"
            stroke={BELL_CYAN}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon points="50,62 52,67 57,69 52,71 50,76 48,71 43,69 48,67" fill={CORE_GLOW} stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 4. ABYSSAL OCTOPUS — Deep-violet/indigo mantle, cyan bioluminescent spots & 8 suckered tentacles
 * ============================================================================ */
const renderAbyssalOctopus = (s: SubRigState) => {
  const MANTLE = '#4C1D95';
  const MANTLE_DARK = '#312E81';
  const MANTLE_LIGHT = '#7C3AED';
  const BIO_CYAN = '#22D3EE';
  const BIO_CORE = '#ECFEFF';
  const SUCKER = '#F472B6';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Tentacles #7 & #8 curling behind */}
          <Path
            d="M 34 66 C 18 68, 9 78, 17 87 C 22 91, 28 86, 24 81"
            stroke={STROKE}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 34 66 C 18 68, 9 78, 17 87 C 22 91, 28 86, 24 81"
            stroke={MANTLE_DARK}
            strokeWidth={4.2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 66 66 C 82 68, 91 78, 83 87 C 78 91, 72 86, 76 81"
            stroke={STROKE}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 66 66 C 82 68, 91 78, 83 87 C 78 91, 72 86, 76 81"
            stroke={MANTLE_DARK}
            strokeWidth={4.2}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
      body={
        <G>
          {/* Collar web & mid-flank tentacles #5 & #6 */}
          <Path
            d="M 29 54 L 71 54 L 66 74 L 34 74 Z"
            fill={MANTLE_DARK}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 31 61 C 15 60, 8 50, 15 43 M 69 61 C 85 60, 92 50, 85 43"
            stroke={STROKE}
            strokeWidth={7.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 31 61 C 15 60, 8 50, 15 43 M 69 61 C 85 60, 92 50, 85 43"
            stroke={MANTLE}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
      leftEar={
        <G>
          {/* Tentacle #1 curling high on left with suckers */}
          <Path
            d="M 29 55 C 12 50, 7 32, 18 25 C 23 22, 26 28, 21 31"
            stroke={STROKE}
            strokeWidth={8.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 29 55 C 12 50, 7 32, 18 25 C 23 22, 26 28, 21 31"
            stroke={MANTLE_LIGHT}
            strokeWidth={4.4}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={15} cy={43} r={2.2} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={13} cy={35} r={2} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
      rightEar={
        <G>
          {/* Tentacle #2 curling high on right with suckers */}
          <Path
            d="M 71 55 C 88 50, 93 32, 82 25 C 77 22, 74 28, 79 31"
            stroke={STROKE}
            strokeWidth={8.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 71 55 C 88 50, 93 32, 82 25 C 77 22, 74 28, 79 31"
            stroke={MANTLE_LIGHT}
            strokeWidth={4.4}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={85} cy={43} r={2.2} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={87} cy={35} r={2} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
      head={
        <G>
          {/* Rounded bulbous deep-violet/indigo mantle */}
          <Path
            d="M 24 45 C 21 24, 33 12, 50 12 C 67 12, 79 24, 76 45 C 75 56, 65 60, 50 60 C 35 60, 25 56, 24 45 Z"
            fill={MANTLE}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Path
            d="M 73 46 L 82 43 L 80 51 L 72 52 Z"
            fill={MANTLE_DARK}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {/* Glowing cyan bioluminescent ring spots */}
          <Circle cx={50} cy={22} r={4.2} fill={BIO_CYAN} stroke={STROKE} strokeWidth={1.8} />
          <Circle cx={50} cy={22} r={1.8} fill={BIO_CORE} />
          <Circle cx={35} cy={27} r={3.4} fill={BIO_CYAN} stroke={STROKE} strokeWidth={1.7} />
          <Circle cx={35} cy={27} r={1.4} fill={BIO_CORE} />
          <Circle cx={65} cy={27} r={3.4} fill={BIO_CYAN} stroke={STROKE} strokeWidth={1.7} />
          <Circle cx={65} cy={27} r={1.4} fill={BIO_CORE} />
          <Circle cx={29} cy={37} r={2.3} fill={BIO_CYAN} />
          <Circle cx={70} cy={37} r={2.3} fill={BIO_CYAN} />

          {/* Battle scar when ruffled */}
          {s.isRuffled && (
            <Path d="M 44 16 L 41 24 L 46 28" stroke={BIO_CORE} strokeWidth={2} strokeLinecap="round" fill="none" />
          )}

          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={38}
            rightX={62}
            y={46}
            radius={4.7}
            irisColor={BIO_CYAN}
            darkMask
          />
        </G>
      }
      paws={
        <G>
          {/* Foreground curling suckered tentacles #3 & #4 */}
          <Path
            d="M 42 62 C 40 76, 24 89, 34 90 C 40 90, 43 84, 38 81"
            stroke={STROKE}
            strokeWidth={8.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 42 62 C 40 76, 24 89, 34 90 C 40 90, 43 84, 38 81"
            stroke={MANTLE}
            strokeWidth={4.4}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={38} cy={73} r={2.1} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={33} cy={81} r={2} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />

          <Path
            d="M 58 62 C 60 76, 76 89, 66 90 C 60 90, 57 84, 62 81"
            stroke={STROKE}
            strokeWidth={8.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 58 62 C 60 76, 76 89, 66 90 C 60 90, 57 84, 62 81"
            stroke={MANTLE}
            strokeWidth={4.4}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={62} cy={73} r={2.1} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={67} cy={81} r={2} fill={SUCKER} stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 5. NIGHTMARE SQUID — Spear/arrow-finned crimson-plum mantle, writhing arms & golden hypnotic eyes
 * ============================================================================ */
const renderNightmareSquid = (s: SubRigState) => {
  const PLUM = '#881337';
  const PLUM_DARK = '#4C0519';
  const PLUM_BRIGHT = '#BE123C';
  const SUCKER = '#FDA4AF';
  const HYPNO_GOLD = '#FACC15';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Rear writhing squid arms */}
          <Path
            d="M 45 58 C 39 72, 47 82, 41 92 M 55 58 C 61 72, 53 82, 59 92"
            stroke={STROKE}
            strokeWidth={6.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 45 58 C 39 72, 47 82, 41 92 M 55 58 C 61 72, 53 82, 59 92"
            stroke={PLUM_DARK}
            strokeWidth={3.2}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
      body={
        <G>
          {/* Muscular squid collar + mid writhing arms */}
          <Polygon points="34,53 66,53 61,66 39,66" fill={PLUM_DARK} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
          <Path
            d="M 38 62 C 26 70, 34 81, 24 89 M 62 62 C 74 70, 66 81, 76 89"
            stroke={STROKE}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 38 62 C 26 70, 34 81, 24 89 M 62 62 C 74 70, 66 81, 76 89"
            stroke={PLUM}
            strokeWidth={3.4}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
      leftEar={
        <G>
          {/* Left whipping feeding tentacle & barbed spear-club */}
          <Path
            d="M 35 56 C 17 57, 10 68, 15 80"
            stroke={STROKE}
            strokeWidth={6.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 35 56 C 17 57, 10 68, 15 80"
            stroke={PLUM_BRIGHT}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon
            points="15,76 8,83 14,91 21,84"
            fill={PLUM_BRIGHT}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={14.5} cy={83.5} r={2} fill={SUCKER} />
        </G>
      }
      rightEar={
        <G>
          {/* Right whipping feeding tentacle & barbed spear-club */}
          <Path
            d="M 65 56 C 83 57, 90 68, 85 80"
            stroke={STROKE}
            strokeWidth={6.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 65 56 C 83 57, 90 68, 85 80"
            stroke={PLUM_BRIGHT}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon
            points="85,76 92,83 86,91 79,84"
            fill={PLUM_BRIGHT}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={85.5} cy={83.5} r={2} fill={SUCKER} />
        </G>
      }
      head={
        <G>
          {/* Sharp spear/arrow-finned crimson-plum mantle */}
          <Path
            d={
              s.isRuffled
                ? 'M 50 6 L 80 28 L 66 29 L 68 55 Q 50 60 32 55 L 34 29 L 26 29 L 29 24 L 20 26 Z'
                : 'M 50 6 L 80 28 L 66 29 L 68 55 Q 50 60 32 55 L 34 29 L 20 28 Z'
            }
            fill={PLUM}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* Arrowhead mantle highlight ridge */}
          <Polygon points="50,11 56,28 50,40 44,28" fill={PLUM_BRIGHT} />
          <Circle cx={50} cy={22} r={2.2} fill={HYPNO_GOLD} />

          {/* Hypnotic outer eye rings + eerie golden slit eyes */}
          <Circle cx={38.5} cy={45} r={7.4} fill={PLUM_DARK} stroke={HYPNO_GOLD} strokeWidth={1.6} />
          <Circle cx={61.5} cy={45} r={7.4} fill={PLUM_DARK} stroke={HYPNO_GOLD} strokeWidth={1.6} />
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={38.5}
            rightX={61.5}
            y={45}
            radius={4.8}
            irisColor={HYPNO_GOLD}
            slitPupil
            darkMask
          />
        </G>
      }
      paws={
        <G>
          {/* Snapping squid beak + front suckered arms */}
          <Polygon points="46,59 54,59 50,66" fill={COLORS.deepOnyx} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Path
            d="M 41 59 C 31 68, 39 79, 32 89 M 59 59 C 69 68, 61 79, 68 89"
            stroke={STROKE}
            strokeWidth={7.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 41 59 C 31 68, 39 79, 32 89 M 59 59 C 69 68, 61 79, 68 89"
            stroke={PLUM_BRIGHT}
            strokeWidth={3.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={35} cy={70} r={2} fill={SUCKER} stroke={STROKE} strokeWidth={1.4} />
          <Circle cx={35} cy={80} r={1.9} fill={SUCKER} stroke={STROKE} strokeWidth={1.4} />
          <Circle cx={65} cy={70} r={2} fill={SUCKER} stroke={STROKE} strokeWidth={1.4} />
          <Circle cx={65} cy={80} r={1.9} fill={SUCKER} stroke={STROKE} strokeWidth={1.4} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 6. GOBLIN SABOTEUR — Emerald goblin tinker, huge ears, brass goggles, wrench & sparking dynamite
 * ============================================================================ */
const renderGoblinSaboteur = (s: SubRigState) => {
  const GOBLIN = '#16A34A';
  const GOBLIN_DARK = '#15803D';
  const VEST = '#78350F';
  const BRASS = '#F59E0B';
  const LENS = '#38BDF8';
  const STEEL = '#CBD5E1';
  const DYNAMITE = '#EF4444';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Saboteur demolition pack & coiled fuse */}
          <Rect x={63} y={59} width={15} height={19} rx={3} fill={VEST} stroke={STROKE} strokeWidth={2.8} />
          <Path d="M 73 59 C 79 52, 85 55, 83 48" stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Circle cx={83} cy={47} r={2.4} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
      body={
        <G>
          {/* Sneaky goblin torso & leather tinker vest */}
          <Path
            d="M 31 58 L 27 88 L 73 88 L 69 58 Z"
            fill={VEST}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Polygon points="44,58 56,58 50,72" fill={GOBLIN_DARK} stroke={STROKE} strokeWidth={2.2} />
          {/* Bandolier strap & brass belt buckle */}
          <Line x1={33} y1={60} x2={65} y2={84} stroke={STROKE} strokeWidth={4.5} />
          <Line x1={33} y1={60} x2={65} y2={84} stroke={BRASS} strokeWidth={2} />
          <Rect x={44} y={79} width={12} height={7} rx={1.5} fill={BRASS} stroke={STROKE} strokeWidth={2.2} />
        </G>
      }
      leftEar={
        <G>
          {/* Huge pointed goblin left ear + brass ring */}
          <Path
            d="M 27 36 L 4 26 L 14 44 L 20 42 L 22 46 L 28 47 Z"
            fill={GOBLIN}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 24 39 L 11 32 L 18 42" fill={GOBLIN_DARK} />
          <Circle cx={14} cy={44} r={3.2} fill="none" stroke={BRASS} strokeWidth={2.3} />
        </G>
      }
      rightEar={
        <G>
          {/* Huge pointed goblin right ear */}
          <Path
            d="M 73 36 L 96 26 L 84 45 L 72 47 Z"
            fill={GOBLIN}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 76 39 L 89 32 L 82 42" fill={GOBLIN_DARK} />
        </G>
      }
      head={
        <G>
          {/* Angular emerald goblin head */}
          <Path
            d="M 25 38 C 25 22, 36 17, 50 17 C 64 17, 75 22, 75 38 C 75 51, 63 62, 50 62 C 37 62, 25 51, 25 38 Z"
            fill={GOBLIN}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />

          {/* Leather strap + brass welding goggles on forehead */}
          <Path d="M 25 29 Q 50 25 75 29" stroke={STROKE} strokeWidth={5.8} fill="none" />
          <Circle cx={39} cy={26} r={7.2} fill={BRASS} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={39} cy={26} r={4.4} fill={LENS} stroke={STROKE} strokeWidth={1.8} />
          <Circle cx={37.5} cy={24.5} r={1.4} fill={COLORS.canvasWhite} />

          <Circle cx={61} cy={26} r={7.2} fill={BRASS} stroke={STROKE} strokeWidth={2.8} />
          <Circle cx={61} cy={26} r={4.4} fill={LENS} stroke={STROKE} strokeWidth={1.8} />
          {s.isRuffled ? (
            <Path d="M 58 23 L 62 27 L 64 24" stroke={STROKE} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          ) : (
            <Circle cx={59.5} cy={24.5} r={1.4} fill={COLORS.canvasWhite} />
          )}

          {/* Sneaky golden goblin eyes */}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={38.5}
            rightX={61.5}
            y={42}
            radius={4.3}
            irisColor="#FACC15"
          />

          {/* Pointy hooked goblin nose */}
          <Path
            d="M 47 45 L 50 52 L 54 46"
            fill={GOBLIN_DARK}
            stroke={STROKE}
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Wide jagged toothy grin */}
          {s.isHurt ? (
            <Path d="M 39 56 Q 50 51 61 56" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          ) : (
            <G>
              <Path
                d="M 35 52 Q 50 61 65 52 Q 50 55 35 52 Z"
                fill={COLORS.canvasWhite}
                stroke={STROKE}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <Path d="M 41 53 L 43 57 L 47 54 L 50 58 L 53 54 L 57 57 L 59 53" stroke={STROKE} strokeWidth={1.7} fill="none" />
            </G>
          )}
        </G>
      }
      paws={
        <G>
          {/* Steel open-jaw wrench in left hand */}
          <Path
            d="M 24 82 L 17 61"
            stroke={STROKE}
            strokeWidth={7.2}
            strokeLinecap="round"
          />
          <Path
            d="M 24 82 L 17 61"
            stroke={STEEL}
            strokeWidth={3.8}
            strokeLinecap="round"
          />
          <Path
            d="M 11 58 C 9 51, 16 47, 22 50 L 18 55 L 21 58 L 25 53 C 27 59, 21 64, 14 62 Z"
            fill={STEEL}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Circle cx={22} cy={76} r={5} fill={GOBLIN} stroke={STROKE} strokeWidth={2.7} />

          {/* Red stick of dynamite + blazing fuse spark in right hand */}
          <G transform="rotate(14, 79, 71)">
            <Rect x={74} y={58} width={9.5} height={24} rx={2} fill={DYNAMITE} stroke={STROKE} strokeWidth={2.7} />
            <Line x1={74} y1={64} x2={83.5} y2={64} stroke={STROKE} strokeWidth={2.2} />
            <Line x1={74} y1={75} x2={83.5} y2={75} stroke={STROKE} strokeWidth={2.2} />
          </G>
          <Path d="M 81 58 Q 84 51 88 50" stroke={STROKE} strokeWidth={2.3} strokeLinecap="round" fill="none" />
          <Polygon
            points="88,42 90,47 95,49 90,51 88,56 86,51 81,49 86,47"
            fill={COLORS.actionYellow}
            stroke={COLORS.impactOrange}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <Circle cx={77} cy={76} r={5} fill={GOBLIN} stroke={STROKE} strokeWidth={2.7} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 7. WICKED IMP — Horned crimson devil imp, bat wings, arrow-spade tail & mini pitchfork
 * ============================================================================ */
const renderWickedImp = (s: SubRigState) => {
  const IMP_RED = '#DC2626';
  const IMP_DARK = '#991B1B';
  const HORN = '#1E293B';
  const WING_MEMBRANE = '#7F1D1D';
  const SILVER = '#E2E8F0';

  return (
    <RigLayers
      partStyles={s}
      tail={
        <G>
          {/* Whipping devil tail + arrow-spade tip */}
          <Path
            d="M 55 79 C 75 82, 90 70, 86 52"
            stroke={STROKE}
            strokeWidth={5.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 55 79 C 75 82, 90 70, 86 52"
            stroke={IMP_RED}
            strokeWidth={2.8}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon
            points="86,44 93,54 86,52 79,54"
            fill={HORN}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
        </G>
      }
      leftEar={
        <G>
          {/* Left leathery bat wing */}
          <Path
            d={
              s.isRuffled
                ? 'M 30 56 L 5 34 L 14 50 L 9 53 L 7 63 L 19 61 L 28 68 Z'
                : 'M 30 56 L 5 34 L 13 51 L 6 63 L 19 61 L 28 68 Z'
            }
            fill={WING_MEMBRANE}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Line x1={28} y1={56} x2={13} y2={51} stroke={STROKE} strokeWidth={2} />
        </G>
      }
      rightEar={
        <G>
          {/* Right leathery bat wing */}
          <Path
            d="M 70 56 L 95 34 L 87 51 L 94 63 L 81 61 L 72 68 Z"
            fill={WING_MEMBRANE}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Line x1={72} y1={56} x2={87} y2={51} stroke={STROKE} strokeWidth={2} />
        </G>
      }
      body={
        <G>
          {/* Imp torso & dark loin sash */}
          <Path
            d="M 34 54 L 30 86 L 45 86 L 50 76 L 55 86 L 70 86 L 66 54 Z"
            fill={IMP_RED}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 32 73 L 68 73 L 66 80 L 34 80 Z" fill={HORN} stroke={STROKE} strokeWidth={2.2} />
          <Circle cx={50} cy={76.5} r={2.8} fill={COLORS.actionYellow} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
      head={
        <G>
          {/* Curved dark devil horns */}
          <Path
            d={
              s.isRuffled
                ? 'M 36 25 C 24 21, 18 14, 22 9 L 26 13 C 26 17, 31 19, 41 21 Z'
                : 'M 36 25 C 22 21, 16 12, 23 6 C 24 14, 30 18, 42 21 Z'
            }
            fill={HORN}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Path
            d="M 64 25 C 78 21, 84 12, 77 6 C 76 14, 70 18, 58 21 Z"
            fill={HORN}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />

          <Polygon points="27,36 15,32 25,44" fill={IMP_DARK} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
          <Polygon points="73,36 85,32 75,44" fill={IMP_DARK} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />

          {/* Pointed-chin crimson devil head */}
          <Path
            d="M 27 36 C 27 22, 37 18, 50 18 C 63 18, 73 22, 73 36 C 73 48, 61 58, 50 59 C 39 58, 27 48, 27 36 Z"
            fill={IMP_RED}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />

          {/* Slit golden imp eyes */}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={39}
            rightX={61}
            y={38}
            radius={4.4}
            irisColor="#FACC15"
            slitPupil
          />

          <Path
            d="M 37 47 Q 50 55 63 47"
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon points="40,48.5 43,54 46,49.5" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="54,49.5 57,54 60,48.5" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
        </G>
      }
      paws={
        <G>
          {/* Gleaming mini 3-pronged pitchfork */}
          <Line x1={26} y1={87} x2={69} y2={58} stroke={STROKE} strokeWidth={5.2} strokeLinecap="round" />
          <Line x1={26} y1={87} x2={69} y2={58} stroke={HORN} strokeWidth={2.4} strokeLinecap="round" />
          <Path
            d="M 64 52 L 73 65 M 64 52 L 75 45 M 68.5 58.5 L 80 51 M 73 65 L 84 58"
            stroke={STROKE}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M 64 52 L 73 65 M 64 52 L 75 45 M 68.5 58.5 L 80 51 M 73 65 L 84 58"
            stroke={SILVER}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx={42} cy={76} r={4.6} fill={IMP_RED} stroke={STROKE} strokeWidth={2.6} />
          <Circle cx={56} cy={67} r={4.6} fill={IMP_RED} stroke={STROKE} strokeWidth={2.6} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 8. CREEPING SHADOW — Midnight shadow wraith, smoky tendrils, shadow claws & golden cyclops eye
 * ============================================================================ */
const renderCreepingShadow = (s: SubRigState) => {
  const SHADOW = '#18181B';
  const SHADOW_VOID = '#09090B';
  const MIST_VIOLET = '#5B21B6';
  const MIST_GLOW = '#8B5CF6';
  const EYE_GOLD = '#FACC15';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Billowing smoky shadow tendrils at base */}
          <Path
            d="M 22 76 C 10 82, 16 92, 30 89 Q 42 94 50 88 Q 58 94 70 89 C 84 92, 90 82, 78 76 Z"
            fill={MIST_VIOLET}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Circle cx={16} cy={73} r={2.8} fill={SHADOW} stroke={MIST_GLOW} strokeWidth={1.5} />
          <Circle cx={85} cy={72} r={2.4} fill={SHADOW} stroke={MIST_GLOW} strokeWidth={1.5} />
        </G>
      }
      body={
        <G>
          {/* Tapering midnight wraith shroud */}
          <Path
            d="M 27 50 C 22 65, 20 80, 26 88 L 38 83 L 50 90 L 62 83 L 74 88 C 80 80, 78 65, 73 50 Z"
            fill={SHADOW}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path
            d="M 36 56 C 34 68, 36 77, 50 83 C 64 77, 66 68, 64 56 Z"
            fill={MIST_VIOLET}
            opacity={0.55}
          />
          {s.isRuffled && (
            <Path d="M 42 62 L 48 70 L 44 77 M 58 64 L 54 73" stroke={MIST_GLOW} strokeWidth={2.1} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      leftEar={
        <Path
          d="M 27 48 C 12 44, 8 28, 18 19 C 17 28, 23 32, 30 35 Z"
          fill={SHADOW}
          stroke={MIST_GLOW}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
      }
      rightEar={
        <Path
          d="M 73 48 C 88 44, 92 28, 82 19 C 83 28, 77 32, 70 35 Z"
          fill={SHADOW}
          stroke={MIST_GLOW}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
      }
      head={
        <G>
          {/* Flame-crested midnight shadow hood */}
          <Path
            d="M 24 51 C 21 33, 33 15, 46 8 C 49 16, 55 11, 59 17 C 71 22, 79 34, 76 51 C 70 59, 60 61, 50 61 C 40 61, 30 59, 24 51 Z"
            fill={SHADOW_VOID}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Path
            d="M 28 48 C 27 34, 36 21, 47 16"
            stroke={MIST_GLOW}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />

          {/* Luminous golden aura + single Cyclops eye */}
          <Circle cx={50} cy={38} r={10.5} fill={MIST_VIOLET} opacity={0.55} />
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            variant="cyclops"
            darkMask
            slitPupil
            irisColor={EYE_GOLD}
            y={38}
            radius={4.8}
          />

          {/* Jagged glowing shadow mouth */}
          <Path
            d="M 37 52 L 42 55 L 46 51 L 50 56 L 54 51 L 58 55 L 63 52"
            stroke={EYE_GOLD}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      }
      paws={
        <G>
          {/* Jagged lunging shadow claws */}
          <Path
            d="M 29 63 L 13 66 L 21 71 L 12 76 L 23 77 L 17 83 L 31 77 Z"
            fill={SHADOW_VOID}
            stroke={MIST_GLOW}
            strokeWidth={2.3}
            strokeLinejoin="round"
          />
          <Path
            d="M 71 63 L 87 66 L 79 71 L 88 76 L 77 77 L 83 83 L 69 77 Z"
            fill={SHADOW_VOID}
            stroke={MIST_GLOW}
            strokeWidth={2.3}
            strokeLinejoin="round"
          />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 9. ONE-EYED TERROR — Hulking granite-grey Cyclops brute, bull horns, heavy brow & boar-tusks
 * ============================================================================ */
const renderOneEyedTerror = (s: SubRigState) => {
  const GRANITE = '#64748B';
  const GRANITE_DARK = '#475569';
  const GRANITE_LIGHT = '#94A3B8';
  const IVORY = '#F8FAFC';
  const PELT = '#78350F';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Iron-spiked brute club slung behind shoulder */}
          <Path
            d="M 66 64 L 84 44 L 91 51 L 73 71 Z"
            fill={PELT}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Polygon points="83,45 86,38 88,46" fill={IVORY} stroke={STROKE} strokeWidth={1.8} />
          <Polygon points="89,49 95,48 90,54" fill={IVORY} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
      body={
        <G>
          {/* Barrel-chested granite brute torso & fur harness */}
          <Path
            d="M 21 56 C 18 68, 21 86, 30 89 L 70 89 C 79 86, 82 68, 79 56 Z"
            fill={GRANITE}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <Path d="M 26 57 L 66 88 L 74 88 L 36 56 Z" fill={PELT} stroke={STROKE} strokeWidth={2.3} />
          <Rect x={25} y={80} width={50} height={7} rx={2} fill={GRANITE_DARK} stroke={STROKE} strokeWidth={2.4} />
          <Circle cx={50} cy={83.5} r={4} fill={GRANITE_LIGHT} stroke={STROKE} strokeWidth={2.2} />
        </G>
      }
      leftEar={
        <G>
          {/* Curved left bull horn */}
          <Path
            d={
              s.isRuffled
                ? 'M 30 33 C 14 31, 8 20, 15 12 L 19 16 L 17 19 C 21 23, 26 25, 34 25 Z'
                : 'M 30 33 C 13 31, 7 18, 16 9 C 19 18, 25 23, 34 25 Z'
            }
            fill={IVORY}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
        </G>
      }
      rightEar={
        <G>
          {/* Curved right bull horn */}
          <Path
            d="M 70 33 C 87 31, 93 18, 84 9 C 81 18, 75 23, 66 25 Z"
            fill={IVORY}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
        </G>
      }
      head={
        <G>
          {/* Heavy granite cranium & wide brute jaw */}
          <Path
            d="M 25 36 C 25 20, 35 16, 50 16 C 65 16, 75 20, 75 36 L 77 53 C 76 62, 64 65, 50 65 C 36 65, 24 62, 23 53 Z"
            fill={GRANITE}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {s.isRuffled && (
            <Path d="M 63 19 L 59 25 L 65 28" stroke={STROKE} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          )}

          {/* Heavy overhanging stone brow ridge */}
          <Path
            d="M 28 31 Q 50 23 72 31 L 69 36 Q 50 30 31 36 Z"
            fill={GRANITE_DARK}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />

          {/* Huge single central Cyclops eye */}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            variant="cyclops"
            irisColor="#EF4444"
            y={41}
            radius={5.2}
          />

          {/* Brute underbite scowl & jutting lower boar-tusks */}
          <Path
            d="M 33 58 Q 50 53 67 58"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon
            points="33,58 30,47 38,56"
            fill={IVORY}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Polygon
            points="67,58 70,47 62,56"
            fill={IVORY}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
        </G>
      }
      paws={
        <G>
          <Rect x={16} y={73} width={17} height={15} rx={5} fill={GRANITE_LIGHT} stroke={STROKE} strokeWidth={3} />
          <Line x1={21.5} y1={80} x2={21.5} y2={87} stroke={STROKE} strokeWidth={2} />
          <Line x1={27.5} y1={80} x2={27.5} y2={87} stroke={STROKE} strokeWidth={2} />

          <Rect x={67} y={73} width={17} height={15} rx={5} fill={GRANITE_LIGHT} stroke={STROKE} strokeWidth={3} />
          <Line x1={72.5} y1={80} x2={72.5} y2={87} stroke={STROKE} strokeWidth={2} />
          <Line x1={78.5} y1={80} x2={78.5} y2={87} stroke={STROKE} strokeWidth={2} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 10. STONE SENTINEL — Carved monolith golem, slab shoulders, cyan rune fissures & floating shields
 * ============================================================================ */
const renderStoneSentinel = (s: SubRigState) => {
  const STONE = '#57534E';
  const STONE_DARK = '#44403C';
  const STONE_BEVEL = '#78716C';
  const RUNE = '#2DD4BF';
  const RUNE_GLOW = '#CCFBF1';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Levitating arcane spire shards behind monolith */}
          <Polygon points="50,6 55,14 50,18 45,14" fill={RUNE} stroke={STROKE} strokeWidth={2.3} strokeLinejoin="round" />
          <Polygon points="28,15 33,20 30,26 25,21" fill={STONE_BEVEL} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
          <Polygon points="72,15 75,21 70,26 67,20" fill={STONE_BEVEL} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
        </G>
      }
      body={
        <G>
          {/* Carved trapezoidal monolith torso */}
          <Polygon
            points="25,53 75,53 68,89 32,89"
            fill={STONE}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Glowing teal/cyan arcane rune fissures & power core */}
          <Path
            d="M 50 56 L 50 86 M 34 62 L 45 69 L 37 82 M 66 62 L 55 69 L 63 82"
            stroke={RUNE}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Polygon points="50,62 57,70 50,78 43,70" fill={RUNE} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
          <Polygon points="50,65.5 53.5,70 50,74.5 46.5,70" fill={RUNE_GLOW} />
        </G>
      }
      leftEar={
        <G>
          {/* Left angular stone-slab shoulder pauldron */}
          <Polygon
            points="7,34 26,27 28,53 11,57"
            fill={STONE_BEVEL}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 14 36 L 21 42 L 16 50" stroke={RUNE} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      }
      rightEar={
        <G>
          {/* Right angular stone-slab shoulder pauldron */}
          <Polygon
            points="93,34 74,27 72,53 89,57"
            fill={STONE_BEVEL}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 86 36 L 79 42 L 84 50" stroke={RUNE} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      }
      head={
        <G>
          {/* Chiseled octagonal monolith helm-head */}
          <Polygon
            points={
              s.isRuffled
                ? '32,17 64,17 68,22 74,31 70,56 30,56 26,31'
                : '32,17 68,17 74,31 70,56 30,56 26,31'
            }
            fill={STONE}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Polygon points="31,36 69,36 67,47 33,47" fill={STONE_DARK} stroke={STROKE} strokeWidth={2} />

          {/* Glowing cyan brow rune fissure */}
          <Polygon points="50,21 55,27 50,33 45,27" fill={RUNE} stroke={STROKE} strokeWidth={1.8} />
          <Line x1={36} y1={27} x2={44} y2={27} stroke={RUNE} strokeWidth={2.4} strokeLinecap="round" />
          <Line x1={56} y1={27} x2={64} y2={27} stroke={RUNE} strokeWidth={2.4} strokeLinecap="round" />

          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={40}
            rightX={60}
            y={41.5}
            radius={4.1}
            irisColor={RUNE}
            darkMask
          />
        </G>
      }
      paws={
        <G>
          {/* Twin floating arcane rune shield-slabs */}
          <Polygon
            points="13,64 25,59 35,66 33,86 21,90 12,82"
            fill={STONE_DARK}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Polygon points="23,66 28,74 23,82 18,74" fill="none" stroke={RUNE} strokeWidth={2.2} />

          <Polygon
            points="87,64 75,59 65,66 67,86 79,90 88,82"
            fill={STONE_DARK}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Polygon points="77,66 82,74 77,82 72,74" fill="none" stroke={RUNE} strokeWidth={2.2} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 11. TIER 4 BOSS: ANCIENT DRAGON — Crowned crimson-and-gold wyrm, pinions, gold scales & embers
 * ============================================================================ */
const renderAncientDragon = (s: SubRigState) => {
  const WYRM_RED = '#DC2626';
  const WYRM_DARK = '#991B1B';
  const GOLD = '#F59E0B';
  const GOLD_BRIGHT = '#FDE047';
  const WING_GOLD = '#D97706';

  return (
    <RigLayers
      partStyles={s}
      tail={
        <G>
          {/* Spiked crimson-and-gold dragon tail */}
          <Path
            d="M 58 82 C 79 85, 94 73, 89 52"
            stroke={STROKE}
            strokeWidth={8.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 58 82 C 79 85, 94 73, 89 52"
            stroke={WYRM_RED}
            strokeWidth={4.6}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon points="83,75 91,78 86,82" fill={GOLD_BRIGHT} stroke={STROKE} strokeWidth={1.8} />
          <Polygon points="89,63 97,64 91,69" fill={GOLD_BRIGHT} stroke={STROKE} strokeWidth={1.8} />
          <Polygon points="89,45 95,54 89,52 83,55" fill={GOLD} stroke={STROKE} strokeWidth={2.3} strokeLinejoin="round" />
        </G>
      }
      leftEar={
        <G>
          {/* Left grand bat-winged dragon pinion */}
          <Path
            d={
              s.isRuffled
                ? 'M 30 55 L 3 20 L 18 28 L 5 41 L 16 48 L 11 54 L 8 63 L 23 62 L 31 69 Z'
                : 'M 30 55 L 3 20 L 18 28 L 4 42 L 18 49 L 7 63 L 23 62 L 31 69 Z'
            }
            fill={WYRM_DARK}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon points="9,28 27,55 10,42" fill={WING_GOLD} />
          <Polygon points="11,48 27,59 12,60" fill={WING_GOLD} />
          <Polygon points="3,20 7,13 9,22" fill={GOLD_BRIGHT} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
      rightEar={
        <G>
          {/* Right grand bat-winged dragon pinion */}
          <Path
            d="M 70 55 L 97 20 L 82 28 L 96 42 L 82 49 L 93 63 L 77 62 L 69 69 Z"
            fill={WYRM_DARK}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon points="91,28 73,55 90,42" fill={WING_GOLD} />
          <Polygon points="89,48 73,59 88,60" fill={WING_GOLD} />
          <Polygon points="97,20 93,13 91,22" fill={GOLD_BRIGHT} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
      body={
        <G>
          {/* Armored crimson wyrm chest & ribbed golden belly plastron */}
          <Path
            d="M 27 52 C 23 67, 24 85, 32 90 L 68 90 C 76 85, 77 67, 73 52 Z"
            fill={WYRM_RED}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <Path
            d="M 37 54 L 63 54 L 61 90 L 39 90 Z"
            fill={GOLD_BRIGHT}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Line x1={38} y1={63} x2={62} y2={63} stroke={STROKE} strokeWidth={2.1} />
          <Line x1={38.5} y1={72} x2={61.5} y2={72} stroke={STROKE} strokeWidth={2.1} />
          <Line x1={39} y1={81} x2={61} y2={81} stroke={STROKE} strokeWidth={2.1} />
        </G>
      }
      head={
        <G>
          {/* Swept golden horns + imperial 3-point dragon crown */}
          <Path
            d="M 35 24 C 21 20, 12 12, 15 4 C 21 12, 28 16, 40 19 Z"
            fill={GOLD}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 65 24 C 79 20, 88 12, 85 4 C 79 12, 72 16, 60 19 Z"
            fill={GOLD}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Polygon
            points="40,20 44,9 50,15 50,6 50,15 56,9 60,20"
            fill={GOLD_BRIGHT}
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />

          {/* Cheek spikes & armored crimson dragon head */}
          <Polygon points="26,38 15,41 26,47" fill={GOLD} stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
          <Polygon points="74,38 85,41 74,47" fill={GOLD} stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />

          <Path
            d="M 26 35 C 26 21, 36 17, 50 17 C 64 17, 74 21, 74 35 L 70 52 C 66 59, 59 61, 50 61 C 41 61, 34 59, 30 52 Z"
            fill={WYRM_RED}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />

          {s.isRuffled && (
            <Path d="M 34 24 L 40 31 M 63 23 L 59 29" stroke={STROKE} strokeWidth={2.2} strokeLinecap="round" />
          )}

          {/* Blazing slit dragon eyes */}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={38}
            rightX={62}
            y={35}
            radius={4.6}
            irisColor={GOLD_BRIGHT}
            slitPupil
          />

          {/* Armored snout bridge & smoking nostrils */}
          <Path
            d="M 36 45 Q 50 40 64 45 L 62 54 Q 50 57 38 54 Z"
            fill={WYRM_DARK}
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={43} cy={48} r={2} fill={COLORS.deepOnyx} />
          <Circle cx={57} cy={48} r={2} fill={COLORS.deepOnyx} />

          {/* Fierce fanged wyrm roar */}
          <Polygon points="39,54 42,60 45,55" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="55,55 58,60 61,54" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
        </G>
      }
      paws={
        <G>
          {/* Nostril smoke & glowing orange-gold fire/ember wisps */}
          <Path
            d="M 38 50 C 26 49, 20 55, 25 61 C 29 58, 33 56, 38 54 Z"
            fill={COLORS.impactOrange}
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Circle cx={21} cy={53} r={2.3} fill={GOLD_BRIGHT} stroke={STROKE} strokeWidth={1.5} />
          <Path
            d="M 62 50 C 74 49, 80 55, 75 61 C 71 58, 67 56, 62 54 Z"
            fill={COLORS.impactOrange}
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Circle cx={79} cy={53} r={2.3} fill={GOLD_BRIGHT} stroke={STROKE} strokeWidth={1.5} />

          <Polygon points="25,84 31,79 37,84 34,91 27,91" fill={WYRM_DARK} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
          <Polygon points="63,84 69,79 75,84 73,91 66,91" fill={WYRM_DARK} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 12. TIER 4 BOSS: THE HYDRA — THREE ARTICULATED SERPENT HEADS!
 *     leftEarStyle = left serpent neck & head; rightEarStyle = right serpent neck & head;
 *     headStyle = crowned central alpha head!
 * ============================================================================ */
const renderHydraSideEye = (cx: number, cy: number, expression: EnemyRigProps['expression']) => {
  if (expression === 'ko') {
    return (
      <G stroke={STROKE} strokeWidth={2.2} strokeLinecap="round">
        <Line x1={cx - 2.4} y1={cy - 2.4} x2={cx + 2.4} y2={cy + 2.4} />
        <Line x1={cx + 2.4} y1={cy - 2.4} x2={cx - 2.4} y2={cy + 2.4} />
      </G>
    );
  }
  if (expression === 'blink' || expression === 'sleepy') {
    return <Line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={STROKE} strokeWidth={2.3} strokeLinecap="round" />;
  }
  return (
    <G>
      <Circle cx={cx} cy={cy} r={3.2} fill="#FACC15" stroke={STROKE} strokeWidth={1.9} />
      <Ellipse cx={cx} cy={cy} rx={0.9} ry={2.3} fill={COLORS.deepOnyx} />
    </G>
  );
};

const renderTheHydra = (s: SubRigState) => {
  const EMERALD = '#059669';
  const DARK_TEAL = '#065F46';
  const FIN_TEAL = '#2DD4BF';
  const BELLY_GOLD = '#FDE68A';
  const TONGUE = '#EF4444';

  return (
    <RigLayers
      partStyles={s}
      tail={
        <G>
          {/* Whip-like scaled hydra tail */}
          <Path
            d="M 68 83 C 83 84, 94 76, 92 63"
            stroke={STROKE}
            strokeWidth={7.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 68 83 C 83 84, 94 76, 92 63"
            stroke={DARK_TEAL}
            strokeWidth={4.2}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon points="92,58 97,66 88,65" fill={FIN_TEAL} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
        </G>
      }
      leftEar={
        <G>
          {/* LEFT FLANKING HYDRA NECK & FANGED SERPENT HEAD */}
          <Path
            d="M 35 68 C 21 63, 14 50, 19 37"
            stroke={STROKE}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 35 68 C 21 63, 14 50, 19 37"
            stroke={EMERALD}
            strokeWidth={7.2}
            strokeLinecap="round"
            fill="none"
          />
          {/* Fin crest on left head */}
          <Polygon points="12,26 6,19 16,22 14,15 22,22" fill={FIN_TEAL} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
          {/* Left serpent head & open fanged jaws */}
          <Path
            d="M 10 35 C 9 25, 18 21, 28 25 L 33 32 L 22 35 L 31 40 L 16 42 Z"
            fill={EMERALD}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Polygon points="27,32 29,36 31,32" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.3} />
          <Path d="M 30 35 L 36 35 L 39 33 M 36 35 L 39 38" stroke={TONGUE} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          {renderHydraSideEye(20, 29, s.expression)}
        </G>
      }
      rightEar={
        <G>
          {/* RIGHT FLANKING HYDRA NECK & FANGED SERPENT HEAD */}
          <Path
            d="M 65 68 C 79 63, 86 50, 81 37"
            stroke={STROKE}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 65 68 C 79 63, 86 50, 81 37"
            stroke={EMERALD}
            strokeWidth={7.2}
            strokeLinecap="round"
            fill="none"
          />
          {/* Fin crest on right head */}
          <Polygon points="88,26 94,19 84,22 86,15 78,22" fill={FIN_TEAL} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
          {/* Right serpent head & open fanged jaws */}
          <Path
            d="M 90 35 C 91 25, 82 21, 72 25 L 67 32 L 78 35 L 69 40 L 84 42 Z"
            fill={EMERALD}
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Polygon points="73,32 71,36 69,32" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.3} />
          <Path d="M 70 35 L 64 35 L 61 33 M 64 35 L 61 38" stroke={TONGUE} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          {renderHydraSideEye(80, 29, s.expression)}
        </G>
      }
      body={
        <G>
          {/* Coiled emerald-and-dark-teal scaled body at base */}
          <Path
            d="M 20 75 C 18 63, 32 58, 50 58 C 68 58, 82 63, 80 75 C 83 86, 69 90, 50 90 C 31 90, 17 86, 20 75 Z"
            fill={DARK_TEAL}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Central neck column & ribbed belly scales */}
          <Path d="M 41 44 L 59 44 L 62 88 L 38 88 Z" fill={EMERALD} stroke={STROKE} strokeWidth={3} />
          <Path d="M 44 48 L 56 48 L 58 88 L 42 88 Z" fill={BELLY_GOLD} stroke={STROKE} strokeWidth={2} />
          <Line x1={43} y1={58} x2={57} y2={58} stroke={STROKE} strokeWidth={1.9} />
          <Line x1={43} y1={67} x2={57} y2={67} stroke={STROKE} strokeWidth={1.9} />
          <Line x1={42.5} y1={76} x2={57.5} y2={76} stroke={STROKE} strokeWidth={1.9} />
        </G>
      }
      head={
        <G>
          {/* Crowned/frilled central Alpha Hydra head */}
          <Polygon
            points="31,26 22,17 35,19 39,8 50,15 50,6 50,15 61,8 65,19 78,17 69,26"
            fill={FIN_TEAL}
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Path
            d="M 31 32 C 31 19, 39 15, 50 15 C 61 15, 69 19, 69 32 L 66 45 C 62 51, 56 52, 50 52 C 44 52, 38 51, 34 45 Z"
            fill={EMERALD}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />

          {s.isRuffled && (
            <Path d="M 44 19 L 48 25 L 43 28" stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" fill="none" />
          )}

          {/* Alpha serpent slit eyes */}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={40.5}
            rightX={59.5}
            y={32}
            radius={4.3}
            irisColor="#FACC15"
            slitPupil
          />

          {/* Fangs & forked crimson tongue */}
          <Path d="M 37 44 Q 50 49 63 44" stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          <Polygon points="39,45 42,51 45,46" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Polygon points="55,46 58,51 61,45" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} strokeLinejoin="round" />
          <Path
            d="M 50 48 L 50 58 L 45 63 M 50 58 L 55 63"
            stroke={TONGUE}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      }
      paws={
        <G>
          {/* Forefront coiled serpent ridge & swamp venom bubbles */}
          <Path
            d="M 25 85 Q 50 79 75 85 Q 65 92 50 92 Q 35 92 25 85 Z"
            fill={EMERALD}
            stroke={STROKE}
            strokeWidth={2.8}
          />
          <Circle cx={22} cy={87} r={2.8} fill={FIN_TEAL} stroke={STROKE} strokeWidth={1.8} />
          <Circle cx={79} cy={87} r={2.5} fill={FIN_TEAL} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 13. TIER 4 BOSS: KRAKEN'S GRASP — Colossal teal-midnight mantle, armored brow, parrot beak & giant tentacles
 * ============================================================================ */
const renderKrakensGrasp = (s: SubRigState) => {
  const KRAKEN_TEAL = '#0F766E';
  const KRAKEN_MIDNIGHT = '#1E293B';
  const BIO_MINT = '#2DD4BF';
  const SUCKER_AMBER = '#FB923C';
  const FOAM = '#E0F2FE';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Towering rear abyssal tentacles */}
          <Path
            d="M 33 58 C 22 42, 20 22, 29 12"
            stroke={STROKE}
            strokeWidth={7.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 33 58 C 22 42, 20 22, 29 12"
            stroke={KRAKEN_MIDNIGHT}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 67 58 C 78 42, 80 22, 71 12"
            stroke={STROKE}
            strokeWidth={7.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 67 58 C 78 42, 80 22, 71 12"
            stroke={KRAKEN_MIDNIGHT}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
      body={
        <G>
          {/* Abyssal collar & whirlpool surf */}
          <Path
            d="M 25 53 L 75 53 L 79 86 L 21 86 Z"
            fill={KRAKEN_MIDNIGHT}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
        </G>
      }
      leftEar={
        <G>
          {/* Giant left curling suckered boss tentacle */}
          <Path
            d="M 26 74 C 7 68, 5 36, 17 26 C 23 21, 27 29, 20 33"
            stroke={STROKE}
            strokeWidth={9.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 26 74 C 7 68, 5 36, 17 26 C 23 21, 27 29, 20 33"
            stroke={KRAKEN_TEAL}
            strokeWidth={5.2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={12} cy={58} r={2.5} fill={SUCKER_AMBER} stroke={STROKE} strokeWidth={1.6} />
          <Circle cx={10} cy={47} r={2.4} fill={SUCKER_AMBER} stroke={STROKE} strokeWidth={1.6} />
          <Circle cx={13} cy={36} r={2.2} fill={SUCKER_AMBER} stroke={STROKE} strokeWidth={1.6} />
        </G>
      }
      rightEar={
        <G>
          {/* Giant right curling suckered boss tentacle */}
          <Path
            d="M 74 74 C 93 68, 95 36, 83 26 C 77 21, 73 29, 80 33"
            stroke={STROKE}
            strokeWidth={9.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 74 74 C 93 68, 95 36, 83 26 C 77 21, 73 29, 80 33"
            stroke={KRAKEN_TEAL}
            strokeWidth={5.2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={88} cy={58} r={2.5} fill={SUCKER_AMBER} stroke={STROKE} strokeWidth={1.6} />
          <Circle cx={90} cy={47} r={2.4} fill={SUCKER_AMBER} stroke={STROKE} strokeWidth={1.6} />
          <Circle cx={87} cy={36} r={2.2} fill={SUCKER_AMBER} stroke={STROKE} strokeWidth={1.6} />
        </G>
      }
      head={
        <G>
          {/* Towering teal-and-midnight Kraken mantle dome */}
          <Path
            d="M 24 52 C 20 29, 31 10, 50 6 C 69 10, 80 29, 76 52 Q 50 58 24 52 Z"
            fill={KRAKEN_TEAL}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Armored chitinous crown crest & brow ridges */}
          <Polygon
            points="50,6 60,18 55,31 50,27 45,31 40,18"
            fill={KRAKEN_MIDNIGHT}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Path
            d="M 26 36 L 44 33 L 42 38 L 27 41 Z M 74 36 L 56 33 L 58 38 L 73 41 Z"
            fill={KRAKEN_MIDNIGHT}
            stroke={STROKE}
            strokeWidth={2}
          />
          {/* Bioluminescent trench markings + harpoon scars */}
          <Circle cx={50} cy={19} r={2.6} fill={BIO_MINT} />
          {s.isRuffled && (
            <Path d="M 33 22 L 38 30 M 65 20 L 61 28" stroke={BIO_MINT} strokeWidth={2.2} strokeLinecap="round" />
          )}

          {/* Blazing abyssal Kraken eyes */}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={37.5}
            rightX={62.5}
            y={43}
            radius={4.8}
            irisColor="#F97316"
            slitPupil
            darkMask
          />
        </G>
      }
      paws={
        <G>
          {/* Snapping chitinous parrot-beak maw */}
          <Circle cx={50} cy={65} r={12} fill="#7F1D1D" stroke={STROKE} strokeWidth={2.8} />
          <Path
            d="M 40 60 Q 50 52 60 60 L 50 69 Z"
            fill={COLORS.deepOnyx}
            stroke={SUCKER_AMBER}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Path
            d="M 43 68 L 50 63 L 57 68 Q 50 76 43 68 Z"
            fill={KRAKEN_MIDNIGHT}
            stroke={SUCKER_AMBER}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />

          {/* Swirling turquoise & white ocean foam at base */}
          <Path
            d="M 12 84 Q 26 76 40 84 Q 50 77 60 84 Q 74 76 88 84 L 88 92 L 12 92 Z"
            fill="#0284C7"
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
          <Path
            d="M 16 84 Q 28 79 40 84 Q 50 79 60 84 Q 72 79 84 84"
            stroke={FOAM}
            strokeWidth={3.4}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 14. TIER 4 BOSS: THE REAPER — Spectral hooded Grim Reaper, bone skull, cyan soul-fire & silver scythe
 * ============================================================================ */
const renderTheReaper = (s: SubRigState) => {
  const COWL = '#1E293B';
  const VOID = '#09090B';
  const BONE = '#F8FAFC';
  const BONE_SHADE = '#CBD5E1';
  const SOUL_CYAN = '#22D3EE';
  const SILVER = '#E2E8F0';
  const SILVER_EDGE = '#94A3B8';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Floating ghostly cloak wisps */}
          <Path
            d="M 18 76 C 10 83, 15 92, 27 89 L 38 92 L 50 87 L 62 92 L 73 89 C 85 92, 90 83, 82 76 Z"
            fill={COWL}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Path d="M 15 62 C 11 55, 16 49, 14 43" stroke={SOUL_CYAN} strokeWidth={2.6} strokeLinecap="round" fill="none" />
          <Path d="M 85 64 C 89 57, 84 51, 86 45" stroke={SOUL_CYAN} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </G>
      }
      body={
        <G>
          {/* Tattered midnight robe & pale bone ribcage */}
          <Path
            d="M 26 54 L 20 88 L 36 84 L 50 90 L 64 84 L 80 88 L 74 54 Z"
            fill={COWL}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Line x1={50} y1={59} x2={50} y2={78} stroke={BONE_SHADE} strokeWidth={3} strokeLinecap="round" />
          <Path d="M 41 64 Q 50 67 59 64 M 42 70 Q 50 73 58 70" stroke={BONE_SHADE} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <Circle cx={50} cy={60} r={3.2} fill={SOUL_CYAN} stroke={STROKE} strokeWidth={1.8} />
        </G>
      }
      leftEar={
        <Path
          d="M 27 46 L 11 54 L 18 60 L 12 67 L 27 63 Z"
          fill={COWL}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      }
      rightEar={
        <Path
          d="M 73 46 L 89 54 L 82 60 L 88 67 L 73 63 Z"
          fill={COWL}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      }
      head={
        <G>
          {/* Deep peaked tattered midnight cowl */}
          <Path
            d="M 50 6 C 69 14, 80 31, 77 56 L 65 61 L 35 61 L 23 56 C 20 31, 31 14, 50 6 Z"
            fill={COWL}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <Path d="M 50 14 C 64 21, 71 34, 69 55 L 31 55 C 29 34, 36 21, 50 14 Z" fill={VOID} />

          {/* Pale bone skull visage */}
          <Path
            d="M 34 36 C 34 24, 41 20, 50 20 C 59 20, 66 24, 66 36 C 66 43, 62 46, 59 48 L 59 56 L 41 56 L 41 48 C 38 46, 34 43, 34 36 Z"
            fill={BONE}
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          {s.isRuffled && (
            <Path d="M 44 21 L 47 27 L 43 30" stroke={STROKE} strokeWidth={2} strokeLinecap="round" fill="none" />
          )}

          {/* Eerie cyan soul-fire wisps & glowing sockets */}
          <Path d="M 37 34 Q 33 27 38 24 M 63 34 Q 67 27 62 24" stroke={SOUL_CYAN} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={41.5}
            rightX={58.5}
            y={37}
            radius={4.3}
            irisColor={SOUL_CYAN}
            darkMask
          />

          {/* Skull nasal cavity & carved teeth */}
          <Polygon points="50,42 47,47 53,47" fill={VOID} />
          <Line x1={45} y1={51} x2={45} y2={56} stroke={STROKE} strokeWidth={2} />
          <Line x1={50} y1={51} x2={50} y2={56} stroke={STROKE} strokeWidth={2} />
          <Line x1={55} y1={51} x2={55} y2={56} stroke={STROKE} strokeWidth={2} />
        </G>
      }
      paws={
        <G>
          <Line x1={20} y1={89} x2={79} y2={19} stroke={STROKE} strokeWidth={6.2} strokeLinecap="round" />
          <Line x1={20} y1={89} x2={79} y2={19} stroke="#475569" strokeWidth={3} strokeLinecap="round" />

          {/* Huge gleaming silver-and-cyan crescent scythe blade */}
          <Path
            d="M 78 21 C 54 6, 21 9, 8 29 C 27 19, 53 19, 72 30 Z"
            fill={SILVER}
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M 73 22 C 52 11, 26 13, 14 26" stroke={SOUL_CYAN} strokeWidth={2} strokeLinecap="round" fill="none" />
          <Path d="M 72 30 C 53 19, 27 19, 8 29" stroke={SILVER_EDGE} strokeWidth={1.6} fill="none" />

          {/* Skeletal bony hands gripping the shaft */}
          <Rect x={33} y={67} width={9} height={7} rx={3} fill={BONE} stroke={STROKE} strokeWidth={2.3} />
          <Rect x={57} y={39} width={9} height={7} rx={3} fill={BONE} stroke={STROKE} strokeWidth={2.3} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 15. TIER 4 BOSS: WORLD EATER — Cosmic obsidian Void Daemon skull, molten horns, crystals & jawbone
 * ============================================================================ */
const renderWorldEater = (s: SubRigState) => {
  const OBSIDIAN = '#18181B';
  const OBSIDIAN_PLATE = '#27272A';
  const MOLTEN_CRIMSON = '#E11D48';
  const VOID_VIOLET = '#9333EA';
  const VOID_CRYSTAL = '#C084FC';
  const STAR_CORE = '#FEF08A';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <G>
          {/* Orbiting void-crystal shards & cosmic singularity ring */}
          <Ellipse cx={50} cy={52} rx={44} ry={14} fill="none" stroke={VOID_VIOLET} strokeWidth={1.8} opacity={0.65} />
          <Polygon points="11,22 16,29 11,36 6,29" fill={VOID_CRYSTAL} stroke={STROKE} strokeWidth={2.3} strokeLinejoin="round" />
          <Polygon points="89,22 94,29 89,36 84,29" fill={MOLTEN_CRIMSON} stroke={STROKE} strokeWidth={2.3} strokeLinejoin="round" />
          <Polygon points="10,66 14,72 10,78 6,72" fill={MOLTEN_CRIMSON} stroke={STROKE} strokeWidth={2.1} strokeLinejoin="round" />
          <Polygon points="90,66 94,72 90,78 86,72" fill={VOID_CRYSTAL} stroke={STROKE} strokeWidth={2.1} strokeLinejoin="round" />
        </G>
      }
      body={
        <G>
          {/* Obsidian Void-Daemon armor & blazing abyssal singularity core */}
          <Polygon
            points="24,56 76,56 70,90 30,90"
            fill={OBSIDIAN}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Circle cx={50} cy={76} r={10.5} fill={VOID_VIOLET} stroke={MOLTEN_CRIMSON} strokeWidth={2.4} />
          <Circle cx={50} cy={76} r={5.5} fill={MOLTEN_CRIMSON} />
          <Polygon points="50,70 52,74 56,76 52,78 50,82 48,78 44,76 48,74" fill={STAR_CORE} />
        </G>
      }
      leftEar={
        <G>
          {/* Left molten violet-and-crimson curved daemon horn */}
          <Path
            d="M 32 30 C 12 27, 4 14, 15 4 C 18 14, 24 19, 37 22 Z"
            fill={OBSIDIAN_PLATE}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 15 8 C 16 17, 22 22, 32 25" stroke={MOLTEN_CRIMSON} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </G>
      }
      rightEar={
        <G>
          {/* Right molten violet-and-crimson curved daemon horn */}
          <Path
            d="M 68 30 C 88 27, 96 14, 85 4 C 82 14, 76 19, 63 22 Z"
            fill={OBSIDIAN_PLATE}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 85 8 C 84 17, 78 22, 68 25" stroke={VOID_CRYSTAL} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </G>
      }
      head={
        <G>
          <Polygon
            points="32,15 68,15 77,31 73,53 62,57 55,51 50,57 45,51 38,57 27,53 23,31"
            fill={OBSIDIAN_PLATE}
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Molten abyssal crown cracks & cosmic rift */}
          <Path
            d={
              s.isRuffled
                ? 'M 50 16 L 50 31 M 34 20 L 44 27 L 39 33 M 66 20 L 56 27 L 61 33'
                : 'M 50 16 L 50 29 M 37 21 L 45 26 M 63 21 L 55 26'
            }
            stroke={MOLTEN_CRIMSON}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Polygon points="50,20 54,26 50,32 46,26" fill={VOID_CRYSTAL} stroke={STROKE} strokeWidth={1.7} />

          {/* Blazing cosmic daemon eyes */}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={37.5}
            rightX={62.5}
            y={39}
            radius={4.7}
            irisColor={MOLTEN_CRIMSON}
            slitPupil
            darkMask
          />
        </G>
      }
      paws={
        <G>
          {/* Blazing maw glow + articulated jagged obsidian lower jawbone */}
          <Polygon points="32,55 68,55 62,69 38,69" fill={MOLTEN_CRIMSON} />
          <Polygon
            points="28,55 35,62 42,56 50,64 58,56 65,62 72,55 66,73 50,77 34,73"
            fill={OBSIDIAN}
            stroke={VOID_CRYSTAL}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Polygon points="15,74 25,70 28,83 18,86" fill={OBSIDIAN_PLATE} stroke={MOLTEN_CRIMSON} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="85,74 75,70 72,83 82,86" fill={OBSIDIAN_PLATE} stroke={VOID_CRYSTAL} strokeWidth={2} strokeLinejoin="round" />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 16 & 17. SPARRING FOE / DUMMY — Stitched burlap/wood training dummy, straw tufts & target shield
 * ============================================================================ */
const renderTrainingDummy = (s: SubRigState) => {
  const BURLAP = '#D6B483';
  const BURLAP_PATCH = '#B8925A';
  const TIMBER = '#78350F';
  const STRAW = '#FACC15';
  const TARGET_RED = '#EF4444';

  return (
    <RigLayers
      partStyles={s}
      tail={
        <G>
          {/* Wooden timber post & horizontal crossbar */}
          <Rect x={46} y={9} width={8} height={83} rx={2} fill={TIMBER} stroke={STROKE} strokeWidth={2.9} />
          <Rect x={14} y={55} width={72} height={7} rx={2} fill={TIMBER} stroke={STROKE} strokeWidth={2.9} />
        </G>
      }
      leftEar={
        <G>
          {/* Left straw tufts sticking out */}
          <Polygon
            points="18,55 6,49 12,57 5,61 15,61 10,67 20,61"
            fill={STRAW}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Polygon points="30,24 22,16 26,27" fill={STRAW} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
        </G>
      }
      rightEar={
        <G>
          {/* Right straw tufts sticking out */}
          <Polygon
            points="82,55 94,49 88,57 95,61 85,61 90,67 80,61"
            fill={STRAW}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Polygon points="70,24 78,16 74,27" fill={STRAW} stroke={STROKE} strokeWidth={2.2} strokeLinejoin="round" />
        </G>
      }
      body={
        <G>
          {/* Stitched burlap sack torso */}
          <Path
            d="M 31 53 L 29 82 Q 50 86 71 82 L 69 53 Z"
            fill={BURLAP}
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Rect x={35} y={63} width={11} height={11} rx={1.5} fill={BURLAP_PATCH} stroke={STROKE} strokeWidth={2} />
          <Line x1={30} y1={78} x2={70} y2={78} stroke={STROKE} strokeWidth={3.2} />
        </G>
      }
      head={
        <G>
          {/* Plump stitched burlap head + martial headband */}
          <Circle cx={50} cy={36} r={20} fill={BURLAP} stroke={STROKE} strokeWidth={3.2} />
          <Path d="M 31 29 Q 50 25 69 29 L 70 34 Q 50 30 30 34 Z" fill={TARGET_RED} stroke={STROKE} strokeWidth={2.3} />

          {/* Diagonal burlap stitch seam */}
          <Path d="M 37 19 L 45 27" stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" />
          <Line x1={37} y1={23} x2={42} y2={20} stroke={STROKE} strokeWidth={1.8} />
          <Line x1={40} y1={26} x2={45} y2={23} stroke={STROKE} strokeWidth={1.8} />

          {s.isRuffled && (
            <Polygon points="57,19 63,12 61,21 67,17 62,24" fill={STRAW} stroke={STROKE} strokeWidth={1.9} strokeLinejoin="round" />
          )}

          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={40}
            rightX={60}
            y={39}
            radius={4.2}
            irisColor={STROKE}
          />

          <Path d="M 40 48 L 60 48" stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" />
          <Line x1={44} y1={45.5} x2={44} y2={50.5} stroke={STROKE} strokeWidth={2} />
          <Line x1={50} y1={45.5} x2={50} y2={50.5} stroke={STROKE} strokeWidth={2} />
          <Line x1={56} y1={45.5} x2={56} y2={50.5} stroke={STROKE} strokeWidth={2} />
        </G>
      }
      paws={
        <G>
          {/* Painted red-and-white archery bullseye target shield */}
          <Circle cx={63} cy={71} r={14.5} fill={TARGET_RED} stroke={STROKE} strokeWidth={3} />
          <Circle cx={63} cy={71} r={10} fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={2} />
          <Circle cx={63} cy={71} r={5.6} fill={TARGET_RED} stroke={STROKE} strokeWidth={1.8} />
          <Circle cx={63} cy={71} r={2} fill={COLORS.actionYellow} />

          {s.isRuffled && (
            <G>
              <Line x1={63} y1={71} x2={79} y2={57} stroke={STROKE} strokeWidth={2.6} strokeLinecap="round" />
              <Polygon points="76,59 81,53 83,58" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.5} />
            </G>
          )}
        </G>
      }
    />
  );
};

/* ============================================================================
 * MONSTER-CREST FALLBACK — Clean heraldic monster crest if an unknown custom name is passed
 * ============================================================================ */
const renderMonsterCrestFallback = (s: SubRigState) => {
  const CREST_SLATE = '#334155';
  const CREST_RED = '#DC2626';
  const CREST_GOLD = '#F59E0B';

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      tail={
        <Polygon
          points="50,10 84,24 78,68 50,92 22,68 16,24"
          fill={CREST_GOLD}
          stroke={STROKE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
      }
      body={
        <Polygon
          points="50,16 78,28 73,65 50,86 27,65 22,28"
          fill={CREST_SLATE}
          stroke={STROKE}
          strokeWidth={2.8}
          strokeLinejoin="round"
        />
      }
      leftEar={
        <Path
          d="M 29 31 C 15 27, 10 15, 19 8 C 21 16, 26 21, 35 24 Z"
          fill={CREST_RED}
          stroke={STROKE}
          strokeWidth={2.9}
          strokeLinejoin="round"
        />
      }
      rightEar={
        <Path
          d="M 71 31 C 85 27, 90 15, 81 8 C 79 16, 74 21, 65 24 Z"
          fill={CREST_RED}
          stroke={STROKE}
          strokeWidth={2.9}
          strokeLinejoin="round"
        />
      }
      head={
        <G>
          <Path
            d="M 30 38 C 30 25, 39 21, 50 21 C 61 21, 70 25, 70 38 C 70 50, 61 58, 50 58 C 39 58, 30 50, 30 38 Z"
            fill={CREST_RED}
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {s.isRuffled && (
            <Path d="M 43 24 L 47 30 L 44 34" stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" fill="none" />
          )}
          <EnemyEyes
            expression={s.expression}
            gazeOffset={s.gazeOffset}
            leftX={40}
            rightX={60}
            y={39}
            radius={4.3}
            irisColor={CREST_GOLD}
          />
          <Polygon points="40,50 44,56 47,51" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} />
          <Polygon points="53,51 56,56 60,50" fill={COLORS.canvasWhite} stroke={STROKE} strokeWidth={1.6} />
        </G>
      }
      paws={
        <G>
          <Polygon points="26,70 37,65 39,77 28,80" fill={CREST_GOLD} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
          <Polygon points="74,70 63,65 61,77 72,80" fill={CREST_GOLD} stroke={STROKE} strokeWidth={2.6} strokeLinejoin="round" />
        </G>
      }
    />
  );
};

const bossRig =
  (render: (s: SubRigState) => React.ReactElement): React.FC<EnemyRigProps> =>
  (props) =>
    render({
      ...props,
      isRuffled: isBattleWorn(props.healthState),
      isHurt: isHurtExpression(props.expression),
      isFierce: isFierceExpression(props.expression),
    });

export const WetCrabRig = bossRig(renderWetCrab);
export const LurkingSharkRig = bossRig(renderLurkingShark);
export const JellyfishRig = bossRig(renderJellyfish);
export const AbyssalOctopusRig = bossRig(renderAbyssalOctopus);
export const NightmareSquidRig = bossRig(renderNightmareSquid);
export const GoblinSaboteurRig = bossRig(renderGoblinSaboteur);
export const WickedImpRig = bossRig(renderWickedImp);
export const CreepingShadowRig = bossRig(renderCreepingShadow);
export const OneEyedTerrorRig = bossRig(renderOneEyedTerror);
export const StoneSentinelRig = bossRig(renderStoneSentinel);
export const AncientDragonRig = bossRig(renderAncientDragon);
export const TheHydraRig = bossRig(renderTheHydra);
export const KrakensGraspRig = bossRig(renderKrakensGrasp);
export const TheReaperRig = bossRig(renderTheReaper);
export const WorldEaterRig = bossRig(renderWorldEater);
export const TrainingDummyRig = bossRig(renderTrainingDummy);
/** Heraldic crest drawn for any enemy name with no bespoke rig. */
export const MonsterCrestFallbackRig = bossRig(renderMonsterCrestFallback);
