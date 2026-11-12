import { CreaturePartStyles, GazeOffset } from '@/components/creatures/types';
import { FighterExpression, FighterHealthState } from '@/utils/fighterAnimations';

export interface CreatureRigProps extends CreaturePartStyles {
  /** Pixel width & height of the avatar stage */
  size: number;
  /** Current resolved facial expression */
  expression: FighterExpression;
  /** Current health wear state (drives subtle posture/crown/coat details) */
  healthState: FighterHealthState;
  /** Optional micro-saccade / gaze look offset (`-1..1`) for living eye tracking */
  gazeOffset?: GazeOffset;
}
