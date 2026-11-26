/**
 * Hoarding Beaver - Tier 2 Enemy
 *
 * [GP-16]: Rewrote legacy Classic "Achieve minimum" defeat condition into a native Adventure challenge.
 * Effects: Greedy Squirrel (1 card per match) + Burrowing Mole (18s removal)
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { ExtraCardRemovalOnMatchEffect, CardRemovalEffect, composeEffects } from '../../enemyEffects';

export function createHoardingBeaver(): EnemyInstance {
  return composeEffects(
    {
      name: 'Hoarding Beaver',
      icon: 'delapouite/beaver',
      tier: 2,
      description: '+1 card removed per match, removes 1 card every 18s',
      defeatConditionText: 'Win with 6+ cards remaining on board',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 1, minBoardSize: 6 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 18000, minBoardSize: 6 } },
    ],
    (stats: RoundStats) => stats.totalMatches >= 1 && stats.cardsRemaining >= 6
  );
}
