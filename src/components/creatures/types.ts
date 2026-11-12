import { StyleProp, ViewStyle } from 'react-native';

interface JointPivot {
  /** X in 0..100 SVG space */
  x: number;
  /** Y in 0..100 SVG space */
  y: number;
}

/** Anatomical joint pivots (0..100 SVG space) that part rotations are anchored to. */
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

/** Animated styles for the five independently moving parts of any creature rig. */
export interface CreaturePartStyles {
  /** Head / primary face */
  headStyle?: StyleProp<ViewStyle>;
  /** Left ear / wing / flipper / horn / pincer */
  leftEarStyle?: StyleProp<ViewStyle>;
  /** Right ear / wing / flipper / horn / pincer */
  rightEarStyle?: StyleProp<ViewStyle>;
  /** Tail / halo / pouch / cloak / tentacles */
  tailStyle?: StyleProp<ViewStyle>;
  /** Front paws / feet / claws / held prop */
  pawStyle?: StyleProp<ViewStyle>;
}

export const DEFAULT_CREATURE_PIVOTS: CreatureJointPivots = {
  head: { x: 50, y: 50 },
  leftEar: { x: 32, y: 30 },
  rightEar: { x: 68, y: 30 },
  tail: { x: 70, y: 76 },
  paws: { x: 50, y: 78 },
};
