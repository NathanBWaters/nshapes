import { CreaturePartStyles, GazeOffset } from '@/components/creatures/types';
import { EnemyExpression, EnemyHealthState } from '@/utils/enemyAnimations';

/**
 * Props every enemy rig draws from. `V` lists the art variants a rig shared by
 * several enemies can draw (e.g. the wolf rig's `'dire'`); the registry picks one per enemy.
 */
export interface EnemyRigProps<V extends string = never> extends CreaturePartStyles {
  /** Which of the rig's art variants to draw; omit for the rig's base look */
  variant?: V;
  /** Current resolved enemy facial expression */
  expression: EnemyExpression;
  /** Current progressive battle-wear state */
  healthState: EnemyHealthState;
  /** Eye gaze offset (-1..1) with corneal parallax */
  gazeOffset?: GazeOffset;
}
