/**
 * [GP-16] Kraken's Grasp - Tier 4 Boss
 *
 * Replaced blanket -50% negation on all 7 weapon types with counterable Tentacle Lock:
 * every 18s wraps 1 weapon type and marks a Kraken tentacle card on the board.
 * Clearing the marked tentacle card snaps it immediately (clearing the lock and
 * boosting that Set ×1.5)!
 */
import type { Card } from '@/types';
import type {
  EffectBehavior,
  EnemyInstance,
  EnemyMatchResult,
  EnemyStatModifiers,
  EnemyTickResult,
  EnemyUIModifiers,
  RoundStats,
} from '@/types/enemy';
import {
  PositionShuffleEffect,
  WEAPON_COUNTERS,
  composeEffects,
} from '../../enemyEffects';

const LOCKABLE_WEAPONS = ['fire', 'explosion', 'laser', 'hint', 'grace', 'time', 'healing'] as const;
type LockableWeaponType = (typeof LOCKABLE_WEAPONS)[number];

const TENTACLE_INTERVAL_MS = 18000;
const TENTACLE_TIMER_MS = 12000;
const TENTACLE_REDUCTION_PCT = 50;
const TENTACLE_SNAP_MULT = 1.5;

const nextRandom = (rng?: () => number): number => (rng ? rng() : Math.random());

const TentacleLockEffect: EffectBehavior = {
  onRoundStart: (_board, internalState) => {
    internalState.tentacleMs = 0;
    internalState.lockedWeapon = null;
    internalState.tentacleCardId = null;
    internalState.tentacleTimerMs = 0;
    return {};
  },

  onTick: (deltaMs, board, internalState, _config, rng): Partial<EnemyTickResult> => {
    const activeCardId = internalState.tentacleCardId as string | null;
    if (activeCardId) {
      const stillThere = board.find(c => c.id === activeCardId);
      if (!stillThere) {
        // Card left the board — tentacle released
        internalState.tentacleCardId = null;
        internalState.lockedWeapon = null;
        internalState.tentacleTimerMs = 0;
        return {};
      }
      const nextTimer = ((internalState.tentacleTimerMs as number) || TENTACLE_TIMER_MS) - deltaMs;
      internalState.tentacleTimerMs = nextTimer;
      if (nextTimer <= 0) {
        // Tentacle squeezes and releases after timer expires
        internalState.tentacleCardId = null;
        internalState.lockedWeapon = null;
        internalState.tentacleTimerMs = 0;
        return {
          healthDelta: -1,
          cardModifications: [{ cardId: activeCardId, changes: { hasCountdown: false, countdownTimer: undefined } }],
          events: [{ type: 'countdown_expired', cardId: activeCardId }],
        };
      }
      return {
        cardModifications: [{ cardId: activeCardId, changes: { countdownTimer: Math.max(0, nextTimer) } }],
      };
    }

    internalState.tentacleMs = ((internalState.tentacleMs as number) || 0) + deltaMs;
    if ((internalState.tentacleMs as number) >= TENTACLE_INTERVAL_MS) {
      internalState.tentacleMs = 0;
      const valid = board.filter(c => !c.isDud && !c.isFaceDown && !c.hasCountdown);
      const lockedType = LOCKABLE_WEAPONS[Math.floor(nextRandom(rng) * LOCKABLE_WEAPONS.length)];
      internalState.lockedWeapon = lockedType;
      if (valid.length > 0) {
        const target = valid[Math.floor(nextRandom(rng) * valid.length)];
        internalState.tentacleCardId = target.id;
        internalState.tentacleTimerMs = TENTACLE_TIMER_MS;
        return {
          cardModifications: [{ cardId: target.id, changes: { hasCountdown: true, countdownTimer: TENTACLE_TIMER_MS } }],
          events: [{ type: 'countdown_warning', cardId: target.id, secondsRemaining: Math.ceil(TENTACLE_TIMER_MS / 1000) }],
        };
      }
    }
    return {};
  },

  onValidMatch: (matchedCards: Card[], _board: Card[], internalState): Partial<EnemyMatchResult> => {
    const activeCardId = internalState.tentacleCardId as string | null;
    if (activeCardId && matchedCards.some(c => c.id === activeCardId)) {
      // Snapped the Kraken tentacle! Release the locked weapon and reward ×1.5 damage!
      internalState.tentacleCardId = null;
      internalState.lockedWeapon = null;
      internalState.tentacleTimerMs = 0;
      return { pointsMultiplier: TENTACLE_SNAP_MULT };
    }
    return {};
  },

  getUIModifiers: (internalState): Partial<EnemyUIModifiers> => {
    const locked = internalState.lockedWeapon as LockableWeaponType | null;
    const cardId = internalState.tentacleCardId as string | null;
    const timer = (internalState.tentacleTimerMs as number) || 0;
    const mods: Partial<EnemyUIModifiers> = {};
    if (locked) mods.weaponCounters = [{ type: locked, reduction: TENTACLE_REDUCTION_PCT }];
    if (cardId && timer > 0) mods.showCountdownCards = [{ cardId, timeRemaining: timer }];
    return mods;
  },
};

export function createKrakensGrasp(): EnemyInstance {
  const base = composeEffects(
    {
      name: "Kraken's Grasp",
      icon: 'delapouite/kraken-tentacle',
      tier: 4,
      description: 'Tentacle Lock wraps 1 weapon type every 18s (clear the marked card to snap it for ×1.5!) & shuffles every 16s.',
      defeatConditionText: 'Win with 5+ cards remaining on board',
    },
    [
      { behavior: PositionShuffleEffect, config: { intervalMs: 16000 } },
      { behavior: TentacleLockEffect, config: {} },
    ],
    (stats: RoundStats) => stats.cardsRemaining >= 5 && stats.totalMatches >= 1
  );

  // Sync live Tentacle Lock into getStatModifiers (only the single currently wrapped type, never all 7!)
  return {
    ...base,
    getStatModifiers: (): EnemyStatModifiers => {
      const mods: EnemyStatModifiers = { ...base.getStatModifiers() };
      const uiCounters = base.getUIModifiers().weaponCounters ?? [];
      for (const c of uiCounters) {
        const entry = WEAPON_COUNTERS[c.type as keyof typeof WEAPON_COUNTERS];
        if (entry) mods[entry.modifier] = c.reduction;
      }
      return mods;
    },
  };
}
