import { StyleProp, ViewStyle } from 'react-native';
import { FighterExpression, FighterHealthState } from '@/utils/fighterAnimations';

export interface JointPivot {
  /** X in 0..100 SVG space */
  x: number;
  /** Y in 0..100 SVG space */
  y: number;
}

export interface CreatureJointPivots {
  head: JointPivot;
  leftEar: JointPivot;
  rightEar: JointPivot;
  tail: JointPivot;
  paws: JointPivot;
}

export interface GazeOffset {
  /** Horizontal eye look offset in `-1 .. 1` */
  x: number;
  /** Vertical eye look offset in `-1 .. 1` */
  y: number;
}

export interface CreatureRigProps {
  /** Pixel width & height of the avatar stage */
  size: number;
  /** Current resolved facial expression */
  expression: FighterExpression;
  /** Current health wear state (drives subtle posture/crown/coat details) */
  healthState: FighterHealthState;
  /** Optional micro-saccade / gaze look offset (`-1..1`) for living eye tracking */
  gazeOffset?: GazeOffset;
  /** Animated style for head/face container */
  headStyle?: StyleProp<ViewStyle>;
  /** Animated style for left ear / left flipper / left wing */
  leftEarStyle?: StyleProp<ViewStyle>;
  /** Animated style for right ear / right flipper / right wing */
  rightEarStyle?: StyleProp<ViewStyle>;
  /** Animated style for tail / oracle halo / throat pouch */
  tailStyle?: StyleProp<ViewStyle>;
  /** Animated style for front paws / feet */
  pawStyle?: StyleProp<ViewStyle>;
}

/**
 * Exact anatomical joint pivots (in 0..100 SVG coordinates) for each fighter rig.
 * Used by FighterAvatar to compute true pivot-anchored rotations in pixel space.
 */
export const CREATURE_PIVOTS: Record<string, CreatureJointPivots> = {
  'Orange Tabby': {
    head: { x: 50, y: 48 },
    leftEar: { x: 33, y: 29 },
    rightEar: { x: 67, y: 29 },
    tail: { x: 70, y: 78 },
    paws: { x: 50, y: 76 },
  },
  'Sly Fox': {
    head: { x: 50, y: 48 },
    leftEar: { x: 31, y: 28 },
    rightEar: { x: 69, y: 28 },
    tail: { x: 68, y: 78 },
    paws: { x: 50, y: 77 },
  },
  'Emperor Penguin': {
    head: { x: 50, y: 39 },
    leftEar: { x: 24, y: 54 }, // Left flipper shoulder
    rightEar: { x: 76, y: 54 }, // Right flipper shoulder
    tail: { x: 50, y: 36 }, // Mystic oracle halo center
    paws: { x: 50, y: 86 },
  },
  'Corgi': {
    head: { x: 50, y: 47 },
    leftEar: { x: 30, y: 30 },
    rightEar: { x: 70, y: 30 },
    tail: { x: 73, y: 75 }, // Corgi nub-tail rump
    paws: { x: 50, y: 80 },
  },
  'Pelican': {
    head: { x: 47, y: 35 },
    leftEar: { x: 25, y: 56 }, // Left wing shoulder
    rightEar: { x: 73, y: 56 }, // Right wing shoulder
    tail: { x: 55, y: 52 }, // Gular throat pouch hinge
    paws: { x: 48, y: 86 },
  },
  'Badger': {
    head: { x: 50, y: 48 },
    leftEar: { x: 29, y: 29 },
    rightEar: { x: 71, y: 29 },
    tail: { x: 73, y: 77 },
    paws: { x: 50, y: 76 },
  },
};

export const DEFAULT_CREATURE_PIVOTS: CreatureJointPivots = {
  head: { x: 50, y: 50 },
  leftEar: { x: 32, y: 30 },
  rightEar: { x: 68, y: 30 },
  tail: { x: 70, y: 76 },
  paws: { x: 50, y: 78 },
};
