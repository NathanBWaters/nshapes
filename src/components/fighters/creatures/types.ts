import type { SharedValue } from 'react-native-reanimated';
import { BlinkStage, CreaturePartStyles, GazeOffset } from '@/components/creatures/types';
import { FighterExpression, FighterHealthState } from '@/utils/fighterAnimations';

export interface CreatureRigProps extends CreaturePartStyles {
  /** Pixel width & height of the avatar stage */
  size: number;
  /** Current resolved facial expression */
  expression: FighterExpression;
  /** Current health wear state (drives subtle posture/crown/coat details) */
  healthState: FighterHealthState;
  /** 3-step organic upper-eyelid sweep (`0` open, `1` half-lid droop, `2` full shut) */
  blinkStage?: BlinkStage;
  /** Smooth 0..1 UI-thread eyelid closure progress */
  lidClose?: SharedValue<number>;
  /** Optional micro-saccade / gaze look offset (`-1..1`) for living eye tracking */
  gazeOffset?: GazeOffset;
  /** [UI-07] Solid-black Silhouette Audit mode */
  silhouette?: boolean;
}
