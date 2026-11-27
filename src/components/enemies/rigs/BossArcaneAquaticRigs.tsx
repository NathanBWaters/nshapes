import React from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { RigLayers } from '@/components/creatures/RigLayers';
import { HalfBlinkLidEye, ShutBlinkEye } from '@/components/creatures/eyes';
import { isBattleWorn, isFierceExpression, isHurtExpression } from '@/components/creatures/expressions';
import {
  STROKE,
  StorybookToneDefs,
  SunlitRimStroke,
} from '@/components/illustration/primitives';
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
 * 10. CHAPTER BOSS: STONE SENTINEL — True 3/4 LEFT armored basalt rune-golem
 *     Beveled stone pauldrons, slotted cyan visor-helm, glowing arcane chest runes & lead fist
 * ============================================================================ */
const renderStoneSentinel = (s: SubRigState) => {
  const STONE_LIT = '#9CA3AF';
  const STONE_BASE = '#6B7280';
  const STONE_SHADOW = '#374151';
  const PLATE_LIT = '#64748B';
  const PLATE_BASE = '#475569';
  const PLATE_SHADOW = '#1E293B';
  const RUNE = '#22D3EE';
  const RUNE_GLOW = '#CFFAFE';
  const lean = s.facing === 'left' ? 'translate(-0.6, 0)' : undefined;

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      skipAutoLighting
      skipFacingOffset
      tail={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'sent-tail-stone', lit: STONE_LIT, base: STONE_BASE, shadow: STONE_SHADOW },
              { id: 'sent-tail-rune', lit: RUNE_GLOW, base: RUNE, shadow: '#0E7490' },
            ]}
          />
          {/* Rear hovering arcane rune crystal & right stone leg */}
          <Polygon
            points="72,14 78,22 73,30 67,22"
            fill="url(#sent-tail-rune)"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Path
            d="M 55 68 L 71 67 L 78 86 L 61 88 L 57 78 Z"
            fill="url(#sent-tail-stone)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Line x1={62} y1={77} x2={75} y2={76} stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" />
        </G>
      }
      body={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'sent-body', lit: STONE_LIT, base: STONE_BASE, shadow: STONE_SHADOW },
              { id: 'sent-plate', lit: PLATE_LIT, base: PLATE_BASE, shadow: PLATE_SHADOW },
              { id: 'sent-core', lit: RUNE_GLOW, base: RUNE, shadow: '#0891B2' },
            ]}
          />
          {/* Forward-left armored stone leg planted in 3/4 brawler stride */}
          <Path
            d="M 35 67 L 52 68 L 48 88 L 31 87 L 33 77 Z"
            fill="url(#sent-body)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Line x1={34} y1={78} x2={48} y2={78} stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
          {/* Heavy beveled hexagonal basalt torso angled 3/4 left */}
          <Path
            d="M 30 38 L 43 32 L 64 35 L 70 50 L 63 69 L 37 69 L 29 52 Z"
            fill="url(#sent-plate)"
            stroke={STROKE}
            strokeWidth={3.4}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 32 49 L 33 39 L 43 34" strokeWidth={2.2} opacity={0.58} />
          {/* Waist slab belt */}
          <Polygon
            points="36,62 63,62 60,70 39,70"
            fill="url(#sent-body)"
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          {/* Glowing cyan arcane chest rune circuit & hexagonal power core */}
          <Path
            d="M 36 44 L 44 48 L 41 58 M 57 45 L 50 49 L 55 58 M 46 39 L 46 61"
            stroke={RUNE}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Polygon
            points="46,42 53,48 51,57 46,60 41,57 39,48"
            fill="url(#sent-core)"
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Polygon points="46,46 49.5,50.5 46,55 42.5,50.5" fill={RUNE_GLOW} />
          {s.isRuffled && (
            <Path d="M 54 38 L 59 45 L 55 50" stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      leftEar={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'sent-pauldron-l', lit: STONE_LIT, base: STONE_BASE, shadow: STONE_SHADOW }]}
          />
          {/* Lead left beveled granite shoulder pauldron */}
          <Path
            d="M 18 44 L 24 34 L 38 35 L 36 52 L 22 53 Z"
            fill="url(#sent-pauldron-l)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 20 44 L 25 36 L 35 37" strokeWidth={2} opacity={0.62} />
          <Path d="M 24 41 L 31 44 L 27 49" stroke={RUNE} strokeWidth={2.1} strokeLinecap="round" fill="none" />
        </G>
      }
      rightEar={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'sent-pauldron-r', lit: STONE_LIT, base: STONE_BASE, shadow: STONE_SHADOW }]}
          />
          {/* Dominant rear-right massive carved stone shoulder pauldron + rune vein */}
          <Path
            d="M 59 35 L 77 32 L 85 45 L 82 60 L 63 58 Z"
            fill="url(#sent-pauldron-r)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 62 36 L 76 34 L 82 43" strokeWidth={2.1} opacity={0.52} />
          <Path d="M 73 41 L 78 48 L 72 54" stroke={RUNE} strokeWidth={2.3} strokeLinecap="round" fill="none" />
        </G>
      }
      head={
        <G transform={lean}>
          <StorybookToneDefs
            tones={[
              { id: 'sent-helm', lit: STONE_LIT, base: STONE_BASE, shadow: STONE_SHADOW },
              { id: 'sent-visor', lit: '#1E293B', base: '#0F172A', shadow: '#020617' },
            ]}
          />
          {/* Chiseled 3/4 left monolith visor-helm */}
          <Path
            d={
              s.isRuffled
                ? 'M 33 21 L 46 16 L 56 20 L 59 29 L 55 39 L 36 39 L 31 30 L 34 25 Z'
                : 'M 33 20 L 46 15 L 57 20 L 59 30 L 55 39 L 35 39 L 31 29 Z'
            }
            fill="url(#sent-helm)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 35 21 L 45 17 L 53 20" strokeWidth={2.1} opacity={0.65} />
          {/* Recessed dark T-visor faceplate */}
          <Path
            d="M 34 25 L 51 25 L 50 32 L 44 32 L 43 37 L 39 37 L 38 32 L 34 32 Z"
            fill="url(#sent-visor)"
            stroke={STROKE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Glowing cyan visor eyes */}
          <EnemyEyes
            expression={s.expression}
            blinkStage={s.blinkStage}
            gazeOffset={s.gazeOffset}
            leftX={38}
            rightX={47.5}
            y={28.5}
            radius={3.2}
            irisColor={RUNE}
            darkMask
          />
        </G>
      }
      paws={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'sent-fist', lit: STONE_LIT, base: STONE_BASE, shadow: STONE_SHADOW },
              { id: 'sent-arm', lit: PLATE_LIT, base: PLATE_BASE, shadow: PLATE_SHADOW },
            ]}
          />
          {/* Forward-left raised clenched brawler stone fist */}
          <Path
            d="M 10 58 L 22 54 L 30 61 L 27 72 L 13 71 L 8 64 Z"
            fill="url(#sent-fist)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 11 59 L 21 56" strokeWidth={2} opacity={0.6} />
          <Line x1={15} y1={63} x2={15} y2={70} stroke={STROKE} strokeWidth={2} />
          <Line x1={21} y1={63} x2={21} y2={70} stroke={STROKE} strokeWidth={2} />
          {/* Rear-right heavy rune-etched stone gauntlet */}
          <Path
            d="M 68 58 L 83 57 L 89 68 L 82 78 L 69 75 Z"
            fill="url(#sent-arm)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Path d="M 76 62 L 82 67 L 78 72" stroke={RUNE} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 11. TIER 4 BOSS: ANCIENT DRAGON — True 3/4 LEFT crimson-and-gold storybook wyrm
 *     Swept double bat-wings, twin golden curved horns, ribbed gold belly & fire snout
 * ============================================================================ */
const renderAncientDragon = (s: SubRigState) => {
  const RED_LIT = '#EF4444';
  const RED_BASE = '#B91C1C';
  const RED_SHADOW = '#7F1D1D';
  const WING_LIT = '#991B1B';
  const WING_BASE = '#7F1D1D';
  const WING_SHADOW = '#450A0A';
  const GOLD_LIT = '#FEF08A';
  const GOLD_BASE = '#F59E0B';
  const GOLD_SHADOW = '#B45309';
  const lean = s.facing === 'left' ? 'translate(-0.7, 0)' : undefined;

  return (
    <RigLayers
      partStyles={s}
      skipAutoLighting
      skipFacingOffset
      tail={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'drg-tail', lit: RED_LIT, base: RED_BASE, shadow: RED_SHADOW },
              { id: 'drg-spine', lit: GOLD_LIT, base: GOLD_BASE, shadow: GOLD_SHADOW },
            ]}
          />
          {/* Sweeping curling crimson dragon tail & dorsal spines curving right */}
          <Path
            d="M 55 75 C 74 79, 89 72, 87 58 C 85 49, 77 50, 77 58 C 77 65, 67 69, 55 66 Z"
            fill="url(#drg-tail)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          {/* Dorsal ridge spines */}
          <Polygon points="68,66 72,60 75,67" fill="url(#drg-spine)" stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round" />
          <Polygon points="79,63 85,58 84,66" fill="url(#drg-spine)" stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round" />
          <Polygon points="84,54 91,47 89,58" fill="url(#drg-spine)" stroke={STROKE} strokeWidth={2.1} strokeLinejoin="round" />
        </G>
      }
      leftEar={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'drg-wing-far', lit: WING_LIT, base: WING_BASE, shadow: WING_SHADOW }]}
          />
          {/* Far-left swept-back secondary bat wing */}
          <Path
            d="M 46 43 C 33 26, 20 15, 9 14 C 16 25, 19 36, 17 45 C 25 41, 33 43, 44 50 Z"
            fill="url(#drg-wing-far)"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 14 17 C 24 20, 34 29, 43 40" strokeWidth={2} opacity={0.5} />
          <Line x1={42} y1={43} x2={19} y2={35} stroke={STROKE} strokeWidth={1.9} strokeLinecap="round" />
        </G>
      }
      rightEar={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'drg-wing-near', lit: RED_LIT, base: WING_LIT, shadow: WING_SHADOW },
              { id: 'drg-wing-arm', lit: RED_LIT, base: RED_BASE, shadow: RED_SHADOW },
            ]}
          />
          {/* Colossal arched foreground bat-wing pinion sweeping top-right */}
          <Path
            d={
              s.isRuffled
                ? 'M 52 46 C 58 26, 65 11, 52 9 C 72 13, 88 29, 94 59 L 87 54 L 84 68 C 77 56, 70 55, 65 65 C 62 55, 57 52, 50 56 Z'
                : 'M 52 46 C 58 26, 65 11, 52 9 C 73 13, 89 30, 94 61 C 87 54, 83 56, 82 69 C 76 57, 69 56, 65 65 C 61 55, 56 52, 50 56 Z'
            }
            fill="url(#drg-wing-near)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          {/* Muscular wing leading arm & golden wing claw */}
          <Path
            d="M 50 47 C 57 29, 63 14, 52 10"
            stroke={RED_BASE}
            strokeWidth={4.2}
            strokeLinecap="round"
            fill="none"
          />
          <SunlitRimStroke d="M 55 11 C 69 16, 82 29, 89 48" strokeWidth={2.2} opacity={0.55} />
          {/* Wing membrane struts */}
          <Line x1={57} y1={22} x2={82} y2={62} stroke={STROKE} strokeWidth={2.1} strokeLinecap="round" />
          <Line x1={55} y1={32} x2={66} y2={61} stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
          <Polygon points="52,9 46,6 54,13" fill={GOLD_LIT} stroke={STROKE} strokeWidth={1.8} strokeLinejoin="round" />
        </G>
      }
      body={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'drg-body', lit: RED_LIT, base: RED_BASE, shadow: RED_SHADOW },
              { id: 'drg-belly', lit: GOLD_LIT, base: GOLD_BASE, shadow: GOLD_SHADOW },
            ]}
          />
          {/* Rear braced haunch leg */}
          <Path
            d="M 54 68 C 63 66, 68 74, 65 86 L 56 87 L 54 78 Z"
            fill="url(#drg-body)"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {/* Muscular 3/4 left dragon chest, arched neck & ribbed golden belly plastron */}
          <Path
            d="M 27 42 C 25 56, 26 74, 38 82 L 58 81 C 68 75, 68 59, 57 48 C 48 42, 41 39, 38 35 Z"
            fill="url(#drg-body)"
            stroke={STROKE}
            strokeWidth={3.4}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 29 52 C 29 61, 31 70, 37 76" strokeWidth={2.1} opacity={0.5} />
          {/* Warm gold segmented ventral armor plates */}
          <Path
            d="M 27 46 C 24 60, 27 74, 38 81 L 45 78 C 38 69, 36 58, 37 45 Z"
            fill="url(#drg-belly)"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Path
            d="M 27 54 L 37 54 M 27 62 L 38 61 M 29 70 L 40 69 M 33 76 L 42 75"
            stroke={STROKE}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </G>
      }
      head={
        <G transform={lean}>
          <StorybookToneDefs
            tones={[
              { id: 'drg-head', lit: RED_LIT, base: RED_BASE, shadow: RED_SHADOW },
              { id: 'drg-horn', lit: GOLD_LIT, base: GOLD_BASE, shadow: GOLD_SHADOW },
            ]}
          />
          {/* Twin swept golden curved horns */}
          <Path
            d="M 30 24 C 34 15, 42 11, 49 12 C 43 17, 38 22, 34 27 Z"
            fill="url(#drg-horn)"
            stroke={STROKE}
            strokeWidth={2.7}
            strokeLinejoin="round"
          />
          <Path
            d="M 25 25 C 24 17, 29 12, 35 11 C 32 16, 30 21, 29 26 Z"
            fill="url(#drg-horn)"
            stroke={STROKE}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          {/* Ferocious 3/4 left horned dragon head & projecting snout */}
          <Path
            d="M 10 34 C 11 26, 20 22, 31 23 C 40 24, 44 30, 42 38 L 36 45 L 22 44 L 11 40 Z"
            fill="url(#drg-head)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 13 29 C 19 25, 27 24, 34 25" strokeWidth={2.1} opacity={0.6} />
          {/* Cheek spikes */}
          <Polygon points="37,33 45,32 39,38" fill="url(#drg-horn)" stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          {/* Open fanged wyrm jaw */}
          <Path
            d={
              s.isFierce
                ? 'M 11 39 L 28 39 L 25 48 L 13 46 Z'
                : 'M 12 39 L 27 39 L 24 45 L 14 44 Z'
            }
            fill="#450A0A"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Polygon points="14,39 16,44 18,39" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.2} />
          <Polygon points="21,39 23,44 25,39" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.2} />
          {/* Smoking nostril */}
          <Circle cx={15} cy={33.5} r={1.6} fill={COLORS.deepOnyx} />
          {s.isRuffled && (
            <Path d="M 27 26 L 31 32" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
          )}
          {/* Blazing dragon eyes oriented 3/4 left */}
          <EnemyEyes
            expression={s.expression}
            blinkStage={s.blinkStage}
            gazeOffset={s.gazeOffset}
            leftX={20.5}
            rightX={31}
            y={30.5}
            radius={3.8}
            irisColor={GOLD_LIT}
            slitPupil
          />
        </G>
      }
      paws={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'drg-paw', lit: RED_LIT, base: RED_BASE, shadow: RED_SHADOW },
              { id: 'drg-claw', lit: GOLD_LIT, base: GOLD_BASE, shadow: GOLD_SHADOW },
            ]}
          />
          {/* Raised swipe front-left talon with deep chest shoulder anchor + grounded front-right dragon leg */}
          <Path
            d="M 38 62 L 26 70 L 17 78 L 21 86 L 31 85 L 39 74 Z"
            fill="url(#drg-paw)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Polygon points="18,85 13,89 21,87" fill="url(#drg-claw)" stroke={STROKE} strokeWidth={1.6} />
          <Polygon points="23,86 20,90 27,87" fill="url(#drg-claw)" stroke={STROKE} strokeWidth={1.6} />
          <Path
            d="M 45 71 L 40 87 L 50 88 L 54 73 Z"
            fill="url(#drg-paw)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Polygon points="40,87 36,90 43,89" fill="url(#drg-claw)" stroke={STROKE} strokeWidth={1.6} />
          <Polygon points="46,88 44,91 50,89" fill="url(#drg-claw)" stroke={STROKE} strokeWidth={1.6} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 12. TIER 4 BOSS: THE HYDRA — True 3/4 LEFT triple-headed emerald-teal serpent
 *     3 staggered 3/4-left heads (`leftEar` low-left striker, `head` towering center alpha,
 *     `rightEar` upper-right coiled back striker) with aqua crests & 3-step blinks!
 * ============================================================================ */
const renderHydraSideEye = (
  cx: number,
  cy: number,
  expression: EnemyRigProps['expression'],
  blinkStage?: EnemyRigProps['blinkStage']
) => {
  if (expression === 'ko') {
    return (
      <G stroke={STROKE} strokeWidth={2.2} strokeLinecap="round">
        <Line x1={cx - 2.4} y1={cy - 2.4} x2={cx + 2.4} y2={cy + 2.4} />
        <Line x1={cx + 2.4} y1={cy - 2.4} x2={cx - 2.4} y2={cy + 2.4} />
      </G>
    );
  }
  if (expression === 'blink' || blinkStage === 2) {
    return <ShutBlinkEye cx={cx} cy={cy} r={3} stroke={STROKE} />;
  }
  if (blinkStage === 1 && expression !== 'sleepy' && expression !== 'wince') {
    return <HalfBlinkLidEye cx={cx} cy={cy} r={3} stroke={STROKE} irisColor="#FACC15" />;
  }
  if (expression === 'sleepy') {
    return <Line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={STROKE} strokeWidth={2.3} strokeLinecap="round" />;
  }
  if (expression === 'wince') {
    return (
      <Path
        d={`M ${cx - 2.6} ${cy - 2.2} L ${cx + 2} ${cy} L ${cx - 2.6} ${cy + 2.2}`}
        stroke={STROKE}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return (
    <G>
      <Circle
        cx={cx}
        cy={cy}
        r={3.2}
        fill={expression === 'enraged' ? '#EF4444' : '#FACC15'}
        stroke={STROKE}
        strokeWidth={1.9}
      />
      <Ellipse cx={cx - 0.5} cy={cy} rx={0.95} ry={2.3} fill={COLORS.deepOnyx} />
      <Circle cx={cx - 1.1} cy={cy - 1.1} r={0.9} fill="#FFFFFF" />
    </G>
  );
};

const renderTheHydra = (s: SubRigState) => {
  const EMERALD_LIT = '#34D399';
  const EMERALD_BASE = '#059669';
  const EMERALD_SHADOW = '#064E3B';
  const FIN_LIT = '#99F6E4';
  const FIN_BASE = '#2DD4BF';
  const FIN_SHADOW = '#0F766E';
  const BELLY_LIT = '#CCFBF1';
  const BELLY_BASE = '#6EE7B7';
  const BELLY_SHADOW = '#047857';
  const lean = s.facing === 'left' ? 'translate(-0.7, 0)' : undefined;

  return (
    <RigLayers
      partStyles={s}
      skipAutoLighting
      skipFacingOffset
      tail={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'hyd-tail', lit: EMERALD_LIT, base: EMERALD_BASE, shadow: EMERALD_SHADOW },
              { id: 'hyd-fin-t', lit: FIN_LIT, base: FIN_BASE, shadow: FIN_SHADOW },
            ]}
          />
          {/* Sweeping finned hydra tail curving gracefully upward-right */}
          <Path
            d="M 66 80 C 82 81, 91 71, 86 58 C 83 51, 89 47, 94 49 C 87 44, 77 49, 77 61 C 77 70, 72 74, 63 75 Z"
            fill="url(#hyd-tail)"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Polygon
            points="84,48 96,43 91,53 96,58 83,55"
            fill="url(#hyd-fin-t)"
            stroke={STROKE}
            strokeWidth={2.3}
            strokeLinejoin="round"
          />
        </G>
      }
      leftEar={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'hyd-neck-l', lit: EMERALD_LIT, base: EMERALD_BASE, shadow: EMERALD_SHADOW },
              { id: 'hyd-fin-l', lit: FIN_LIT, base: FIN_BASE, shadow: FIN_SHADOW },
            ]}
          />
          {/* HEAD 1 (Lower-Left Striker): curved neck + 3/4-left snarling serpent jaws */}
          <Path
            d="M 37 74 C 24 68, 22 54, 27 44 L 35 48 C 32 56, 33 65, 43 70 Z"
            fill="url(#hyd-neck-l)"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {/* Aqua dorsal fin crest */}
          <Polygon
            points="21,39 27,31 31,37 36,33 35,44"
            fill="url(#hyd-fin-l)"
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {/* Lower-left serpent head facing LEFT */}
          <Path
            d="M 7 47 C 9 40, 17 37, 29 38 C 35 39, 37 44, 34 50 L 23 53 L 10 52 Z"
            fill="url(#hyd-neck-l)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 11 42 C 16 39, 23 39, 29 40" strokeWidth={1.8} opacity={0.6} />
          <Path d="M 10 49 L 24 49 L 21 55 L 12 53 Z" fill="#7F1D1D" stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="12,49 14,53 16,49" fill="#FFFFFF" />
          <Polygon points="18,49 20,53 22,49" fill="#FFFFFF" />
          {renderHydraSideEye(19, 44, s.expression, s.blinkStage)}
        </G>
      }
      rightEar={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'hyd-neck-r', lit: EMERALD_LIT, base: EMERALD_BASE, shadow: EMERALD_SHADOW },
              { id: 'hyd-fin-r', lit: FIN_LIT, base: FIN_BASE, shadow: FIN_SHADOW },
            ]}
          />
          {/* HEAD 3 (Upper-Right Coiled Striker): sweeping S-neck arcing right then facing LEFT */}
          <Path
            d="M 55 72 C 69 65, 76 50, 70 36 L 61 39 C 65 50, 60 61, 49 67 Z"
            fill="url(#hyd-neck-r)"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          {/* Aqua dorsal fin crest */}
          <Polygon
            points="64,28 73,22 72,30 79,28 73,38"
            fill="url(#hyd-fin-r)"
            stroke={STROKE}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {/* Upper-right serpent head lunging LEFT */}
          <Path
            d="M 48 33 C 51 26, 61 24, 70 28 C 75 31, 74 38, 68 41 L 56 41 L 48 38 Z"
            fill="url(#hyd-neck-r)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 52 29 C 58 26, 65 26, 69 29" strokeWidth={1.8} opacity={0.55} />
          <Path d="M 50 36 L 63 36 L 60 42 L 51 40 Z" fill="#7F1D1D" stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="52,36 54,40 56,36" fill="#FFFFFF" />
          <Polygon points="58,36 60,40 62,36" fill="#FFFFFF" />
          {renderHydraSideEye(58, 32, s.expression, s.blinkStage)}
        </G>
      }
      body={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'hyd-body', lit: EMERALD_LIT, base: EMERALD_BASE, shadow: EMERALD_SHADOW },
              { id: 'hyd-belly', lit: BELLY_LIT, base: BELLY_BASE, shadow: BELLY_SHADOW },
            ]}
          />
          {/* Thick coiled emerald serpentine base */}
          <Path
            d="M 18 76 C 17 65, 30 60, 48 61 C 66 61, 79 66, 77 77 C 76 87, 63 90, 48 90 C 31 90, 19 86, 18 76 Z"
            fill="url(#hyd-body)"
            stroke={STROKE}
            strokeWidth={3.4}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 22 71 C 28 65, 39 63, 52 64" strokeWidth={2.2} opacity={0.5} />
          {/* Sweeping central alpha neck column with pale mint ribbed belly bands */}
          <Path
            d="M 38 33 C 42 46, 37 64, 41 79 L 55 78 C 53 63, 57 46, 51 32 Z"
            fill="url(#hyd-body)"
            stroke={STROKE}
            strokeWidth={3.2}
            strokeLinejoin="round"
          />
          <Path
            d="M 39 39 C 41 51, 39 64, 42 77 L 48 77 C 46 64, 47 51, 45 38 Z"
            fill="url(#hyd-belly)"
          />
          <Path d="M 39 48 L 47 48 M 39 56 L 47 56 M 40 64 L 48 64 M 41 72 L 49 72" stroke={STROKE} strokeWidth={1.7} strokeLinecap="round" />
        </G>
      }
      head={
        <G transform={lean}>
          <StorybookToneDefs
            tones={[
              { id: 'hyd-head', lit: EMERALD_LIT, base: EMERALD_BASE, shadow: EMERALD_SHADOW },
              { id: 'hyd-fin-c', lit: FIN_LIT, base: FIN_BASE, shadow: FIN_SHADOW },
            ]}
          />
          {/* Towering central Alpha Hydra head crest facing 3/4 LEFT */}
          <Polygon
            points="39,17 44,7 51,14 58,8 59,19 65,17 57,26"
            fill="url(#hyd-fin-c)"
            stroke={STROKE}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Path
            d="M 25 24 C 27 16, 38 13, 50 15 C 58 17, 60 24, 56 32 L 43 34 L 26 30 Z"
            fill="url(#hyd-head)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 29 19 C 35 16, 43 16, 49 17" strokeWidth={2.1} opacity={0.62} />
          {s.isRuffled && (
            <Path d="M 43 18 L 46 24 L 42 27" stroke={STROKE} strokeWidth={2} strokeLinecap="round" fill="none" />
          )}
          {/* Snarling fanged alpha jaws + forked tongue */}
          <Path
            d="M 27 28 L 44 28 L 41 36 L 29 34 Z"
            fill="#7F1D1D"
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Polygon points="29,28 31.5,33 34,28" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.2} />
          <Polygon points="37,28 39.5,33 42,28" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.2} />
          <Path d="M 28 32 L 21 34 L 18 32 M 21 34 L 18 37" stroke="#EF4444" strokeWidth={2.1} strokeLinecap="round" fill="none" />
          {/* Alpha serpent slit eyes facing 3/4 left */}
          <EnemyEyes
            expression={s.expression}
            blinkStage={s.blinkStage}
            gazeOffset={s.gazeOffset}
            leftX={34.5}
            rightX={45}
            y={22}
            radius={3.7}
            irisColor="#FACC15"
            slitPupil
          />
        </G>
      }
      paws={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'hyd-coil', lit: EMERALD_LIT, base: EMERALD_BASE, shadow: EMERALD_SHADOW },
              { id: 'hyd-coil-b', lit: BELLY_LIT, base: BELLY_BASE, shadow: BELLY_SHADOW },
            ]}
          />
          {/* Foreground heavy ribbed serpent coil resting firmly on ground shadow */}
          <Path
            d="M 27 83 C 33 76, 56 76, 68 83 C 62 91, 35 91, 27 83 Z"
            fill="url(#hyd-coil)"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <Path d="M 35 84 Q 48 88 61 84" stroke="url(#hyd-coil-b)" strokeWidth={3.2} strokeLinecap="round" fill="none" />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 13. TIER 4 BOSS: KRAKEN'S GRASP — True 3/4 LEFT deep-teal abyssal kraken
 *     Tall spotted bulbous mantle, furrowed amber eyes, curling terracotta-suckered tentacles
 * ============================================================================ */
const renderKrakensGrasp = (s: SubRigState) => {
  const TEAL_LIT = '#2DD4BF';
  const TEAL_BASE = '#0F766E';
  const TEAL_SHADOW = '#134E4A';
  const MANTLE_SPOT = '#99F6E4';
  const SUCKER_LIT = '#FDBA74';
  const SUCKER_BASE = '#EA580C';
  const SUCKER_SHADOW = '#9A3412';
  const lean = s.facing === 'left' ? 'translate(-0.7, 0)' : undefined;

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      skipAutoLighting
      skipFacingOffset
      tail={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'krk-rear', lit: TEAL_BASE, base: TEAL_SHADOW, shadow: '#042F2E' }]}
          />
          {/* Towering rear curling tentacles framing the silhouette */}
          <Path
            d="M 32 64 C 16 58, 12 40, 21 31 C 25 27, 29 33, 24 37"
            stroke={STROKE}
            strokeWidth={8.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 32 64 C 16 58, 12 40, 21 31 C 25 27, 29 33, 24 37"
            stroke="url(#krk-rear)"
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 67 64 C 84 56, 90 39, 81 32 C 76 28, 73 34, 78 38"
            stroke={STROKE}
            strokeWidth={8.6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 67 64 C 84 56, 90 39, 81 32 C 76 28, 73 34, 78 38"
            stroke="url(#krk-rear)"
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      }
      body={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'krk-body', lit: TEAL_LIT, base: TEAL_BASE, shadow: TEAL_SHADOW }]}
          />
          {/* Muscular tentacle collar base anchoring the mantle */}
          <Path
            d="M 28 54 C 24 66, 26 81, 46 84 C 66 85, 74 72, 70 55 Z"
            fill="url(#krk-body)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
        </G>
      }
      leftEar={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'krk-tent-l', lit: TEAL_LIT, base: TEAL_BASE, shadow: TEAL_SHADOW },
              { id: 'krk-suck-l', lit: SUCKER_LIT, base: SUCKER_BASE, shadow: SUCKER_SHADOW },
            ]}
          />
          {/* Dramatic sweeping left curling tentacle with warm coral suckers */}
          <Path
            d="M 33 65 C 16 74, 6 66, 11 54 C 14 47, 21 51, 18 57"
            stroke={STROKE}
            strokeWidth={10.2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 33 65 C 16 74, 6 66, 11 54 C 14 47, 21 51, 18 57"
            stroke="url(#krk-tent-l)"
            strokeWidth={5.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={19} cy={70} r={2.7} fill="url(#krk-suck-l)" stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={12} cy={66} r={2.5} fill="url(#krk-suck-l)" stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={10} cy={59} r={2.2} fill="url(#krk-suck-l)" stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
      rightEar={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'krk-tent-r', lit: TEAL_LIT, base: TEAL_BASE, shadow: TEAL_SHADOW },
              { id: 'krk-suck-r', lit: SUCKER_LIT, base: SUCKER_BASE, shadow: SUCKER_SHADOW },
            ]}
          />
          {/* Dramatic curling right tentacles with coral suction cups */}
          <Path
            d="M 65 65 C 83 74, 94 64, 88 52 C 84 46, 78 51, 82 57"
            stroke={STROKE}
            strokeWidth={10.2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 65 65 C 83 74, 94 64, 88 52 C 84 46, 78 51, 82 57"
            stroke="url(#krk-tent-r)"
            strokeWidth={5.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={79} cy={70} r={2.7} fill="url(#krk-suck-r)" stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={86} cy={66} r={2.5} fill="url(#krk-suck-r)" stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={88} cy={59} r={2.2} fill="url(#krk-suck-r)" stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
      head={
        <G transform={lean}>
          <StorybookToneDefs
            tones={[{ id: 'krk-mantle', lit: TEAL_LIT, base: TEAL_BASE, shadow: TEAL_SHADOW }]}
          />
          {/* Ear-like lateral squid fins on upper mantle */}
          <Path
            d="M 38 25 C 33 17, 36 12, 41 18 Z"
            fill="url(#krk-mantle)"
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          <Path
            d="M 64 26 C 72 19, 73 14, 66 19 Z"
            fill="url(#krk-mantle)"
            stroke={STROKE}
            strokeWidth={2.8}
            strokeLinejoin="round"
          />
          {/* Tall bulbous slanted Kraken mantle leaning 3/4 left */}
          <Path
            d="M 32 54 C 28 34, 41 13, 55 9 C 68 15, 73 35, 68 54 C 58 61, 41 61, 32 54 Z"
            fill="url(#krk-mantle)"
            stroke={STROKE}
            strokeWidth={3.4}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 35 42 C 36 28, 44 17, 54 12" strokeWidth={2.3} opacity={0.58} />
          {/* Luminous oceanic mantle spots */}
          <Circle cx={54} cy={22} r={3.1} fill={MANTLE_SPOT} opacity={0.62} />
          <Circle cx={44} cy={31} r={2.4} fill={MANTLE_SPOT} opacity={0.55} />
          <Circle cx={60} cy={34} r={2.1} fill={MANTLE_SPOT} opacity={0.48} />
          {s.isRuffled && (
            <Path d="M 46 22 L 51 29 L 47 34" stroke={MANTLE_SPOT} strokeWidth={2.1} strokeLinecap="round" fill="none" />
          )}
          {/* Heavy brooding cephalopod brow ridges + glowing amber eyes facing 3/4 left */}
          <EnemyEyes
            expression={s.expression}
            blinkStage={s.blinkStage}
            gazeOffset={s.gazeOffset}
            leftX={36}
            rightX={52}
            y={46}
            radius={4.6}
            irisColor="#F97316"
            slitPupil
            darkMask
          />
        </G>
      }
      paws={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'krk-front', lit: TEAL_LIT, base: TEAL_BASE, shadow: TEAL_SHADOW },
              { id: 'krk-suck-f', lit: SUCKER_LIT, base: SUCKER_BASE, shadow: SUCKER_SHADOW },
            ]}
          />
          {/* Foreground slamming tentacles curling across the floor with terracotta suckers */}
          <Path
            d="M 42 63 C 38 78, 26 89, 17 85 C 12 83, 15 76, 21 79"
            stroke={STROKE}
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 42 63 C 38 78, 26 89, 17 85 C 12 83, 15 76, 21 79"
            stroke="url(#krk-front)"
            strokeWidth={5.4}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={33} cy={83} r={2.8} fill="url(#krk-suck-f)" stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={25} cy={86} r={2.6} fill="url(#krk-suck-f)" stroke={STROKE} strokeWidth={1.5} />

          <Path
            d="M 55 63 C 58 77, 70 88, 79 84 C 84 82, 81 76, 75 79"
            stroke={STROKE}
            strokeWidth={9.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 55 63 C 58 77, 70 88, 79 84 C 84 82, 81 76, 75 79"
            stroke="url(#krk-front)"
            strokeWidth={5.2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={63} cy={82} r={2.7} fill="url(#krk-suck-f)" stroke={STROKE} strokeWidth={1.5} />
          <Circle cx={71} cy={85} r={2.5} fill="url(#krk-suck-f)" stroke={STROKE} strokeWidth={1.5} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 14. TIER 4 BOSS: THE REAPER — True 3/4 LEFT floating spectral wraith
 *     Billowing tattered slate cloak, deep void hood with cyan eyes & overhead curved silver scythe
 * ============================================================================ */
const renderTheReaper = (s: SubRigState) => {
  const CLOAK_LIT = '#475569';
  const CLOAK_BASE = '#1E293B';
  const CLOAK_SHADOW = '#0F172A';
  const VOID = '#020617';
  const BONE_LIT = '#FFFFFF';
  const BONE_BASE = '#E2E8F0';
  const BONE_SHADOW = '#94A3B8';
  const SCYTHE_LIT = '#F8FAFC';
  const SCYTHE_BASE = '#CBD5E1';
  const SCYTHE_SHADOW = '#64748B';
  const SOUL_CYAN = '#22D3EE';
  const lean = s.facing === 'left' ? 'translate(-0.7, 0)' : undefined;

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      skipAutoLighting
      skipFacingOffset
      tail={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'rpr-wisp', lit: CLOAK_BASE, base: CLOAK_SHADOW, shadow: VOID }]}
          />
          {/* Floating tattered spectral hem billowing down-right */}
          <Path
            d="M 35 72 L 29 85 L 41 79 L 47 89 L 58 80 L 68 88 L 76 77 L 85 82 L 73 66 Z"
            fill="url(#rpr-wisp)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </G>
      }
      body={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'rpr-cloak', lit: CLOAK_LIT, base: CLOAK_BASE, shadow: CLOAK_SHADOW }]}
          />
          {/* Billowing multi-fold hooded wraith shroud angled 3/4 left */}
          <Path
            d="M 36 42 C 29 55, 29 70, 35 80 L 49 77 L 60 83 L 75 76 C 72 62, 68 48, 59 41 Z"
            fill="url(#rpr-cloak)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 37 46 C 33 56, 33 66, 36 74" strokeWidth={2.1} opacity={0.5} />
          {/* Draped cloth fold lines */}
          <Path d="M 46 47 C 44 58, 45 68, 48 76 M 58 46 C 60 58, 63 67, 68 74" stroke={VOID} strokeWidth={2.1} strokeLinecap="round" fill="none" />
          {s.isRuffled && (
            <Path d="M 50 56 L 56 62 L 51 67" stroke={SOUL_CYAN} strokeWidth={2} strokeLinecap="round" fill="none" />
          )}
        </G>
      }
      leftEar={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'rpr-sleeve-l', lit: CLOAK_LIT, base: CLOAK_BASE, shadow: CLOAK_SHADOW }]}
          />
          {/* Forward-left hanging cloak sleeve */}
          <Path
            d="M 36 44 L 22 50 L 25 68 L 34 62 L 38 52 Z"
            fill="url(#rpr-sleeve-l)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 24 51 L 34 46" strokeWidth={1.8} opacity={0.55} />
        </G>
      }
      rightEar={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'rpr-sleeve-r', lit: CLOAK_LIT, base: CLOAK_BASE, shadow: CLOAK_SHADOW }]}
          />
          {/* Rear-right draped cloak shoulder & sleeve */}
          <Path
            d="M 59 43 L 74 52 L 80 68 L 65 65 L 58 54 Z"
            fill="url(#rpr-sleeve-r)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </G>
      }
      head={
        <G transform={lean}>
          <StorybookToneDefs
            tones={[{ id: 'rpr-hood', lit: CLOAK_LIT, base: CLOAK_BASE, shadow: CLOAK_SHADOW }]}
          />
          {/* Deep peaked 3/4 left spectral cowl */}
          <Path
            d="M 34 42 C 33 27, 42 18, 53 19 L 61 23 C 62 32, 60 40, 56 45 L 36 45 Z"
            fill="url(#rpr-hood)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 36 33 C 38 24, 45 20, 53 21" strokeWidth={2.2} opacity={0.6} />
          {/* Pitch-black void face opening angled left */}
          <Path
            d="M 37 41 C 36 30, 42 24, 50 25 C 55 28, 55 37, 51 42 Z"
            fill={VOID}
            stroke={STROKE}
            strokeWidth={1.8}
          />
          {/* Twin eerie icy-cyan spectral eyes inside void hood */}
          <EnemyEyes
            expression={s.expression}
            blinkStage={s.blinkStage}
            gazeOffset={s.gazeOffset}
            leftX={40.5}
            rightX={48.5}
            y={33.5}
            radius={3.3}
            irisColor={SOUL_CYAN}
            darkMask
          />
        </G>
      }
      paws={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'rpr-blade', lit: SCYTHE_LIT, base: SCYTHE_BASE, shadow: SCYTHE_SHADOW },
              { id: 'rpr-bone', lit: BONE_LIT, base: BONE_BASE, shadow: BONE_SHADOW },
            ]}
          />
          {/* Diagonal steel-dark scythe haft swept cleanly from upper-left to lower-right */}
          <Line x1={16} y1={28} x2={72} y2={76} stroke={STROKE} strokeWidth={6.4} strokeLinecap="round" />
          <Line x1={16} y1={28} x2={72} y2={76} stroke="#64748B" strokeWidth={2.8} strokeLinecap="round" />
          {/* Colossal gleaming curved crescent scythe blade arcing high overhead */}
          <Path
            d="M 14 27 C 24 8, 60 5, 81 24 C 62 15, 36 16, 20 33 L 12 43 C 8 36, 10 30, 14 27 Z"
            fill="url(#rpr-blade)"
            stroke={STROKE}
            strokeWidth={3.1}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 18 24 C 31 11, 56 10, 74 20" strokeWidth={2.1} opacity={0.85} />
          <Path d="M 22 29 C 38 17, 59 16, 75 23" stroke={SOUL_CYAN} strokeWidth={1.7} strokeLinecap="round" fill="none" />
          {/* Skeletal bony hands gripping the scythe haft */}
          <Rect x={26} y={37} width={9} height={7} rx={2.5} fill="url(#rpr-bone)" stroke={STROKE} strokeWidth={2.3} />
          <Line x1={29} y1={37} x2={29} y2={44} stroke={STROKE} strokeWidth={1.3} />
          <Line x1={32} y1={37} x2={32} y2={44} stroke={STROKE} strokeWidth={1.3} />
          <Rect x={51} y={57} width={9} height={7} rx={2.5} fill="url(#rpr-bone)" stroke={STROKE} strokeWidth={2.3} />
          <Line x1={54} y1={57} x2={54} y2={64} stroke={STROKE} strokeWidth={1.3} />
          <Line x1={57} y1={57} x2={57} y2={64} stroke={STROKE} strokeWidth={1.3} />
        </G>
      }
    />
  );
};

/* ============================================================================
 * 15. TIER 4 BOSS: WORLD EATER — True 3/4 LEFT hunched cosmic void-beast
 *     Starry obsidian-violet hide, glowing magenta fanged maw, dorsal crystals & twin cosmic rings
 * ============================================================================ */
const renderWorldEater = (s: SubRigState) => {
  const VOID_LIT = '#4C1D95';
  const VOID_BASE = '#1E1B4B';
  const VOID_SHADOW = '#09090B';
  const RING_LIT = '#F0ABFC';
  const RING_BASE = '#9333EA';
  const RING_SHADOW = '#581C87';
  const MAW_PINK = '#EC4899';
  const STAR_GLOW = '#FDE047';
  const lean = s.facing === 'left' ? 'translate(-0.7, 0)' : undefined;

  return (
    <RigLayers
      partStyles={s}
      earsInFront
      skipAutoLighting
      skipFacingOffset
      tail={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'we-ring-b', lit: RING_LIT, base: RING_BASE, shadow: RING_SHADOW }]}
          />
          {/* Rear sweeping cosmic vortex ellipse + floating stardust shards (framed cleanly inside portrait) */}
          <Ellipse
            cx={49}
            cy={52}
            rx={36}
            ry={14}
            transform="rotate(-26, 49, 52)"
            fill="none"
            stroke="url(#we-ring-b)"
            strokeWidth={5.0}
          />
          <Ellipse
            cx={49}
            cy={52}
            rx={36}
            ry={14}
            transform="rotate(-26, 49, 52)"
            fill="none"
            stroke={RING_LIT}
            strokeWidth={1.6}
          />
          <Circle cx={17} cy={24} r={2.2} fill={RING_LIT} />
          <Circle cx={82} cy={30} r={2.4} fill={MAW_PINK} />
          <Circle cx={83} cy={65} r={2.1} fill={RING_LIT} />
        </G>
      }
      body={
        <G>
          <StorybookToneDefs
            tones={[
              { id: 'we-body', lit: VOID_LIT, base: VOID_BASE, shadow: VOID_SHADOW },
              { id: 'we-spine', lit: '#A855F7', base: '#3B0764', shadow: VOID_SHADOW },
            ]}
          />
          {/* Crystalline obsidian dorsal spines along hunched back */}
          <Polygon points="41,28 49,19 52,30" fill="url(#we-spine)" stroke={STROKE} strokeWidth={2.5} strokeLinejoin="round" />
          <Polygon points="51,31 61,23 62,36" fill="url(#we-spine)" stroke={STROKE} strokeWidth={2.5} strokeLinejoin="round" />
          <Polygon points="61,38 71,32 70,45" fill="url(#we-spine)" stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" />
          {/* Hunched muscular cosmic void-beast torso & crouched digitigrade legs */}
          <Path
            d="M 33 44 C 37 29, 55 27, 67 38 C 76 47, 74 62, 66 71 L 78 86 L 66 87 L 57 73 L 49 86 L 38 86 L 45 69 C 35 64, 31 54, 33 44 Z"
            fill="url(#we-body)"
            stroke={STROKE}
            strokeWidth={3.4}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 37 38 C 43 31, 53 30, 62 36" stroke="#E9D5FF" strokeWidth={2.1} opacity={0.55} />
          {/* Starlight nebula constellations speckled inside the obsidian hide */}
          <Circle cx={53} cy={43} r={1.8} fill="#FFFFFF" />
          <Circle cx={61} cy={49} r={1.4} fill={RING_LIT} />
          <Circle cx={47} cy={55} r={1.6} fill={MAW_PINK} />
          <Circle cx={60} cy={60} r={1.5} fill={STAR_GLOW} />
          <Circle cx={42} cy={48} r={1.2} fill={RING_LIT} />
        </G>
      }
      leftEar={
        <G>
          {/* Orbiting front-left stardust & cosmic flare crescent */}
          <Path
            d="M 11 40 C 12 22, 32 16, 48 24"
            stroke={RING_BASE}
            strokeWidth={4.2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 12 39 C 14 24, 31 19, 44 24"
            stroke={RING_LIT}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={20} cy={17} r={2} fill={RING_LIT} />
        </G>
      }
      rightEar={
        <G>
          {/* Sweeping diagonal foreground cosmic ring arcing across the beast */}
          <Path
            d="M 15 68 C 28 77, 68 60, 82 36"
            stroke={RING_BASE}
            strokeWidth={4.4}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M 17 67 C 30 74, 66 58, 80 38"
            stroke={RING_LIT}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={74} cy={54} r={2.2} fill={MAW_PINK} />
        </G>
      }
      head={
        <G transform={lean}>
          <StorybookToneDefs
            tones={[{ id: 'we-head', lit: VOID_LIT, base: VOID_BASE, shadow: VOID_SHADOW }]}
          />
          {/* Jagged lupine-draconic cosmic head & gaping fanged maw facing 3/4 LEFT */}
          <Path
            d="M 11 42 C 13 31, 25 26, 39 29 L 47 36 L 40 48 L 28 53 L 14 48 Z"
            fill="url(#we-head)"
            stroke={STROKE}
            strokeWidth={3.3}
            strokeLinejoin="round"
          />
          <SunlitRimStroke d="M 15 35 C 21 30, 29 29, 37 31" stroke="#E9D5FF" strokeWidth={2} opacity={0.62} />
          {/* Luminous magenta-pink open fanged maw */}
          <Path
            d="M 12 43 L 31 42 L 26 53 L 15 50 Z"
            fill={MAW_PINK}
            stroke={STROKE}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          <Polygon points="14,43 16.5,48.5 19,43" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.1} />
          <Polygon points="21,42.5 23.5,48 26,42.5" fill="#FFFFFF" stroke={STROKE} strokeWidth={1.1} />
          <Polygon points="17,51 19.5,47 22,52" fill="#FFFFFF" />
          {s.isRuffled && (
            <Path d="M 32 32 L 36 37" stroke={RING_LIT} strokeWidth={2} strokeLinecap="round" />
          )}
          {/* Blazing magenta-violet cosmic eyes facing 3/4 left */}
          <EnemyEyes
            expression={s.expression}
            blinkStage={s.blinkStage}
            gazeOffset={s.gazeOffset}
            leftX={20.5}
            rightX={30.5}
            y={36.5}
            radius={3.6}
            irisColor={MAW_PINK}
            slitPupil
            darkMask
          />
        </G>
      }
      paws={
        <G>
          <StorybookToneDefs
            tones={[{ id: 'we-paw', lit: VOID_LIT, base: VOID_BASE, shadow: VOID_SHADOW }]}
          />
          {/* Reaching forward-left clawed void arm + hunched right claw */}
          <Path
            d="M 36 56 L 19 66 L 11 74 L 18 73 L 14 80 L 23 75 L 22 81 L 29 73 L 40 64 Z"
            fill="url(#we-paw)"
            stroke={STROKE}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path
            d="M 54 58 L 46 70 L 42 78 L 49 75 L 48 81 L 56 73 L 61 64 Z"
            fill="url(#we-paw)"
            stroke={STROKE}
            strokeWidth={2.9}
            strokeLinejoin="round"
          />
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
