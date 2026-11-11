import { StyleProp, ViewStyle } from 'react-native';
import { IconName } from '@/components/Icon';
import { CreatureJointPivots, DEFAULT_CREATURE_PIVOTS, GazeOffset } from '@/components/fighters/creatures/types';
import { EnemyExpression, EnemyHealthState } from '@/utils/enemyAnimations';

export type EnemyJointPivots = CreatureJointPivots;

export interface EnemyRigProps {
  /** Enemy species or Adventure foe name (e.g. 'Junk Rat', 'The Hydra', 'Dozy Bunny') */
  enemyName: string;
  /** Optional fallback icon name */
  icon?: IconName;
  /** Enemy tier (1..4) for visual scale/trim accents */
  tier?: 1 | 2 | 3 | 4;
  /** Pixel width & height of the avatar stage */
  size: number;
  /** Current resolved enemy facial expression */
  expression: EnemyExpression;
  /** Current progressive battle-wear state */
  healthState: EnemyHealthState;
  /** Eye gaze offset (-1..1) with corneal parallax */
  gazeOffset?: GazeOffset;
  /** Animated style for head / primary face */
  headStyle?: StyleProp<ViewStyle>;
  /** Animated style for left ear / wing / horn / pincer / side-head */
  leftEarStyle?: StyleProp<ViewStyle>;
  /** Animated style for right ear / wing / horn / pincer / side-head */
  rightEarStyle?: StyleProp<ViewStyle>;
  /** Animated style for tail / back quills / cloak / tentacles */
  tailStyle?: StyleProp<ViewStyle>;
  /** Animated style for front paws / claws / fangs / weapon prop */
  pawStyle?: StyleProp<ViewStyle>;
}

const WINGED_ENEMY_PIVOTS: EnemyJointPivots = {
  head: { x: 50, y: 40 },
  leftEar: { x: 24, y: 54 },
  rightEar: { x: 76, y: 54 },
  tail: { x: 50, y: 78 },
  paws: { x: 50, y: 80 },
};

const HYDRA_PIVOTS: EnemyJointPivots = {
  head: { x: 50, y: 42 },
  leftEar: { x: 24, y: 52 },  // Left serpent neck base
  rightEar: { x: 76, y: 52 }, // Right serpent neck base
  tail: { x: 72, y: 82 },
  paws: { x: 50, y: 82 },
};

const SCORPION_CRAB_PIVOTS: EnemyJointPivots = {
  head: { x: 50, y: 56 },
  leftEar: { x: 24, y: 58 },  // Left pincer
  rightEar: { x: 76, y: 58 }, // Right pincer
  tail: { x: 56, y: 38 },     // Arched scorpion stinger / bubbles
  paws: { x: 50, y: 82 },
};

const WINGED_NAMES = new Set([
  'Thieving Raven',
  'Magpie',
  'Night Owl',
  'Wild Goose',
  'Circling Vulture',
  'Diving Hawk',
  'Hunting Eagle',
  'Shadow Bat',
  'Prism Moth',
  'Swift Bee',
  'Wicked Imp',
  'Ancient Dragon',
]);

export function getEnemyRigPivots(enemyName: string): EnemyJointPivots {
  if (enemyName === 'The Hydra') return HYDRA_PIVOTS;
  if (enemyName === 'Stinging Scorpion' || enemyName === 'Wet Crab') return SCORPION_CRAB_PIVOTS;
  if (WINGED_NAMES.has(enemyName)) return WINGED_ENEMY_PIVOTS;
  return DEFAULT_CREATURE_PIVOTS;
}
