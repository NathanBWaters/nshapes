/**
 * Goblin Saboteur - Tier 3 Enemy
 *
 * Effects: All counter effects at -50% (pick 3 random weapon types)
 * Defeat Condition: Trigger 3 different weapon effects
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

// All possible weapon types for countering
const WEAPON_TYPES = ['fire', 'explosion', 'laser', 'hint', 'grace', 'time', 'healing'] as const;

/**
 * Creates a fresh Goblin Saboteur enemy instance.
 * Randomly selects 3 weapon types to counter at -50%.
 */
export function createGoblinSaboteur(): EnemyInstance {
  // Pick 3 random weapon types
  const shuffled = [...WEAPON_TYPES].sort(() => Math.random() - 0.5);
  const selectedTypes = shuffled.slice(0, 3);

  const effects = selectedTypes.map((type) => ({
    behavior: WeaponCounterEffect,
    config: { type, reduction: 50 },
  }));

  return composeEffects(
    {
      name: 'Goblin Saboteur',
      icon: 'caro-asercion/goblin',
      tier: 3,
      description: '3 random weapon types -50% each',
      defeatConditionText: 'Trigger 3 different weapon effects',
    },
    effects,
    // Defeat condition: Trigger 3 different weapon effects
    (stats: RoundStats) => stats.weaponEffectsTriggered.size >= 3
  );
}

// Register with factory
registerEnemy('Goblin Saboteur', createGoblinSaboteur);
