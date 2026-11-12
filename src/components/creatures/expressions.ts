import type { CreatureHealthState } from '@/utils/creatureAnimations';

/** Visibly roughed up: ruffled fur, torn feathers, chipped shell. */
export function isBattleWorn(healthState: CreatureHealthState): boolean {
  return healthState === 'battered' || healthState === 'critical' || healthState === 'knocked_out';
}

/** Teeth-bared aggression or gloating. */
export function isFierceExpression(expression: string): boolean {
  return expression === 'wicked_glee' || expression === 'enraged';
}

/** Flinching from a hit or out cold. */
export function isHurtExpression(expression: string): boolean {
  return expression === 'wince' || expression === 'ko';
}

/** Expressions drawn with an open mouth / beak / jaws. */
export function isMouthOpenExpression(expression: string): boolean {
  return (
    expression === 'enraged' ||
    expression === 'wicked_glee' ||
    expression === 'wince' ||
    expression === 'startled'
  );
}
