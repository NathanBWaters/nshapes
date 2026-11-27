import type { StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { MassClass } from '@/utils/motion';

/** 3-step blink lid state (`0` open, `1` half-closed travel, `2` fully closed). */
export type BlinkStage = 0 | 1 | 2;

/** Physical inertia & timing weight class for creatures (`MASS_CLASS` key). */
export type CreatureMassClass = MassClass;

/** Shared blink props exposed cleanly to avatar and eye renderers. */
export interface CreatureBlinkProps {
  /** 3-step upper-eyelid sweep (`0` open, `1` half-lid droop, `2` full shut arc) */
  blinkStage?: BlinkStage;
  /** Smooth 0..1 UI-thread eyelid closure progress */
  lidClose?: SharedValue<number>;
  /** Backward-compatible boolean blink flag (treated as `blinkStage === 2`) */
  isBlinking?: boolean;
}

/**
 * Additive impulse channels that one-shot reactions and idle fidgets animate.
 * They layer on top of the continuous simulation without resetting it.
 *
 * Phase 0 extended channels (`pawTx`, `pawRotate`, `headTx`, `scaleX`, `bodySkewX`)
 * are always populated by `useCreatureMotion` and marked optional on the interface
 * for 100% backward compatibility with existing test mocks.
 */
export interface ReactionChannels {
  bodyTx: SharedValue<number>;
  bodyTy: SharedValue<number>;
  reactionScaleY: SharedValue<number>;
  bodyRotate: SharedValue<number>;
  headRotate: SharedValue<number>;
  headTy: SharedValue<number>;
  leftEarExtra: SharedValue<number>;
  rightEarExtra: SharedValue<number>;
  tailExtra: SharedValue<number>;
  pawBounce: SharedValue<number>;
  /** Horizontal paw/limb translation (px) for jabs, swipes, pincer snaps & wingbeats */
  pawTx?: SharedValue<number>;
  /** Paw/limb rotation (deg) around anatomical `pivots.paws` */
  pawRotate?: SharedValue<number>;
  /** Horizontal head translation (px) complementing 2.5D orbital turn parallax */
  headTx?: SharedValue<number>;
  /** Multiplicative horizontal scale override (default `1`) composing with volume squash */
  scaleX?: SharedValue<number>;
  /** Horizontal strike velocity shear (deg, default `0`) for 1–2f smear frames */
  bodySkewX?: SharedValue<number>;
}

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

/** Animated styles for the independently moving parts of any creature rig. */
export interface CreaturePartStyles {
  /** Optional body / torso layer transform (squash/smear override when provided) */
  bodyStyle?: StyleProp<ViewStyle>;
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
