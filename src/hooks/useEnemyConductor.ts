import { useCallback, useMemo, useRef, useState } from 'react';
import {
  EnemyAmbientMood,
  EnemyHealthState,
  EnemyReactionEvent,
  EnemyReactionType,
  getEnemyHealthState,
  getEnemyPersonality,
  resolveEnemyAmbientMood,
} from '@/utils/enemyAnimations';

export interface UseEnemyConductorOptions {
  enemyName?: string | null;
  tier?: number;
  hp?: number;
  maxHp?: number;
  isBoss?: boolean;
  inactivityRatio?: number;
  isActiveCombat?: boolean;
}

export interface EnemyConductorState {
  healthState: EnemyHealthState;
  mood: EnemyAmbientMood;
  reaction: EnemyReactionEvent | null;
  triggerHit: (opts?: { isCritical?: boolean }) => void;
  triggerMistakeGloat: () => void;
  triggerAttack: () => void;
  triggerRegen: () => void;
  triggerEntrance: () => void;
  triggerReaction: (type: EnemyReactionType) => void;
}

/**
 * Orchestrates live enemy moods, progressive low-HP battle wear, and combat reactions
 * (hit recoil on player match, wicked gloat on player mistake, fierce lunge on enemy ability).
 */
export function useEnemyConductor(options: UseEnemyConductorOptions): EnemyConductorState {
  const {
    enemyName,
    tier,
    hp,
    maxHp = 100,
    isBoss = false,
    inactivityRatio = 0,
    isActiveCombat = true,
  } = options;

  const [reaction, setReaction] = useState<EnemyReactionEvent | null>(null);
  const reactionCounterRef = useRef(0);

  const personality = useMemo(
    () => getEnemyPersonality(enemyName, tier),
    [enemyName, tier]
  );

  const emitReaction = useCallback((type: EnemyReactionType) => {
    reactionCounterRef.current += 1;
    setReaction({ type, id: reactionCounterRef.current });
  }, []);

  const triggerHit = useCallback(
    (opts?: { isCritical?: boolean }) => {
      emitReaction(opts?.isCritical ? 'crit_pain' : 'pain');
    },
    [emitReaction]
  );

  const triggerMistakeGloat = useCallback(() => {
    emitReaction('taunt');
  }, [emitReaction]);

  const triggerAttack = useCallback(() => {
    emitReaction('attack');
  }, [emitReaction]);

  const triggerRegen = useCallback(() => {
    emitReaction('regen');
  }, [emitReaction]);

  const triggerEntrance = useCallback(() => {
    emitReaction('entrance');
  }, [emitReaction]);

  const healthState = useMemo(() => getEnemyHealthState(hp, maxHp), [hp, maxHp]);

  const mood = useMemo(
    () =>
      resolveEnemyAmbientMood({
        hp,
        maxHp,
        isBoss,
        inactivityRatio,
        isActiveCombat,
        naturallySleepy: personality.naturallySleepy,
      }),
    [hp, maxHp, isBoss, inactivityRatio, isActiveCombat, personality.naturallySleepy]
  );

  return {
    healthState,
    mood,
    reaction,
    triggerHit,
    triggerMistakeGloat,
    triggerAttack,
    triggerRegen,
    triggerEntrance,
    triggerReaction: emitReaction,
  };
}
