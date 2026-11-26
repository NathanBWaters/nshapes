/**
 * Goblin Saboteur - Tier 2 Enemy
 *
 * Effects: All counter effects at -50% (pick 3 random weapon types)
 * Defeat Condition: Trigger 3 different weapon effects
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects, shuffleWithRng } from '../../enemyEffects';

// All possible weapon types for countering
const WEAPON_TYPES = ['fire', 'explosion', 'laser', 'hint', 'grace', 'time', 'healing'] as const;

/**
 * Creates a fresh Goblin Saboteur enemy instance.
 * Randomly selects 3 weapon types to counter at -50%.
 */
export function createGoblinSaboteur(rng?: () => number): EnemyInstance {
  // Pick 3 random weapon types via unbiased Fisher-Yates shuffle
  const shuffled = shuffleWithRng(WEAPON_TYPES, rng);
  const selectedTypes = shuffled.slice(0, 3);

  const effects = selectedTypes.map((type) => ({
    behavior: WeaponCounterEffect,
    config: { type, reduction: 50 },
  }));

  return composeEffects(
    {
      name: 'Goblin Saboteur',
      icon: 'caro-asercion/goblin',
      tier: 2,
      description: '3 random weapon types -50% each',
      defeatConditionText: 'Trigger 3 different weapon effects',
    },
    effects,
    (stats: RoundStats) => stats.weaponEffectsTriggered.size >= 3
  );
}
