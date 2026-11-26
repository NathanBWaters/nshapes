/**
 * [GP-16] & [GP-17] The Hydra - Tier 4 Phased Final Boss (3-Head Phases)
 *
 * Refactored from 5-modifier punishment soup (instantDeath + -4s/match + 40% face-down)
 * into 3 distinct, counterable Boss Heads:
 *   - Head 1: Shifting Chameleon (10s) + Countdowns (14s)
 *   - Head 2: Bombs (18%, 12s fuse) + Rapid Parry (paired via levels.ts wave 2 parry)
 *   - Head 3 (and canonical standalone `createTheHydra()`): Shifting Scales (12s) +
 *     Countdowns (12s) + telegraphed 30s Heavy Slam (−2 ♥, zero instantDeath, zero -4s steal)
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  AttributeChangeEffect,
  BombEffect,
  CountdownEffect,
  composeEffects,
} from '../../enemyEffects';
import { HeavySlamInactivityEffect } from '../heavySlamEffect';

export type HydraHeadPhase = 1 | 2 | 3;

const hydraDefeatCheck = (stats: RoundStats): boolean =>
  stats.totalMatches >= 10 && stats.invalidMatches === 0;

/** Build one of The Hydra's 3 signature boss phases (all share 'The Hydra' creature rig). */
export function createHydraHead(phase: HydraHeadPhase): EnemyInstance {
  if (phase === 1) {
    return composeEffects(
      {
        name: 'The Hydra',
        icon: 'lorc/hydra',
        tier: 4,
        description: 'Head I — Shifts a card trait every 10s & plants 14s countdowns.',
        defeatConditionText: 'Match 10 times with no invalid matches',
      },
      [
        { behavior: AttributeChangeEffect, config: { intervalMs: 10000 } },
        { behavior: CountdownEffect, config: { countdownMs: 14000 } },
      ],
      hydraDefeatCheck
    );
  }

  if (phase === 2) {
    return composeEffects(
      {
        name: 'The Hydra',
        icon: 'lorc/hydra',
        tier: 4,
        description: 'Head II — Drops 12s bombs (18% on draw) with rapid counter strikes.',
        defeatConditionText: 'Match 10 times with no invalid matches',
      },
      [
        { behavior: BombEffect, config: { bombChance: 18, bombTimerMs: 12000, minBoardSize: 6 } },
      ],
      hydraDefeatCheck
    );
  }

  // Head 3 (final head & standalone default)
  return composeEffects(
    {
      name: 'The Hydra',
      icon: 'lorc/hydra',
      tier: 4,
      description: 'Head III — Shifts traits every 12s, 12s countdowns & 30s Heavy Slam (−2 ♥).',
      defeatConditionText: 'Match 10 times with no invalid matches',
    },
    [
      { behavior: AttributeChangeEffect, config: { intervalMs: 12000 } },
      { behavior: CountdownEffect, config: { countdownMs: 12000 } },
      { behavior: HeavySlamInactivityEffect, config: { maxMs: 30000, hearts: 2 } },
    ],
    hydraDefeatCheck
  );
}

/** Canonical Tier 4 boss entry point (zero instantDeath, zero -4s/match soup). */
export function createTheHydra(): EnemyInstance {
  return createHydraHead(3);
}
