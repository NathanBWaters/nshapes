import { useCallback, useMemo, useRef, useState } from 'react';
import {
  EnemyAmbientMood,
  EnemyReactionEvent,
  EnemyReactionType,
  resolveEnemyAmbientMood,
} from '@/utils/enemyAnimations';
import { isNaturallySleepyEnemy } from '@/components/enemies/enemyRegistry';

interface UseEnemyConductorOptions {
  enemyName?: string | null;
  hp?: number;
  maxHp?: number;
  isBoss?: boolean;
  inactivityRatio?: number;
  isActiveCombat?: boolean;
}

interface EnemyConductorState {
  mood: EnemyAmbientMood;
  reaction: EnemyReactionEvent | null;
  triggerReaction: (type: EnemyReactionType) => void;
}

/**
 * Orchestrates live enemy moods, progressive low-HP battle wear, and combat reactions
 * (hit recoil on player match, wicked gloat on player mistake, fierce lunge on enemy ability).
 */
export function useEnemyConductor(options: UseEnemyConductorOptions): EnemyConductorState {
  const {
    enemyName,
    hp,
    maxHp = 100,
    isBoss = false,
    inactivityRatio = 0,
    isActiveCombat = true,
  } = options;

  const [reaction, setReaction] = useState<EnemyReactionEvent | null>(null);
  const reactionCounterRef = useRef(0);

  const naturallySleepy = isNaturallySleepyEnemy(enemyName);

  const emitReaction = useCallback((type: EnemyReactionType) => {
    reactionCounterRef.current += 1;
    setReaction({ type, id: reactionCounterRef.current });
  }, []);

  const mood = useMemo(
    () =>
      resolveEnemyAmbientMood({
        hp,
        maxHp,
        isBoss,
        inactivityRatio,
        isActiveCombat,
        naturallySleepy,
      }),
    [hp, maxHp, isBoss, inactivityRatio, isActiveCombat, naturallySleepy]
  );

  return {
    mood,
    reaction,
    triggerReaction: emitReaction,
  };
}
