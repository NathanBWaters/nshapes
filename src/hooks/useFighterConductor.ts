import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FighterAmbientMood,
  FighterReactionEvent,
  FighterReactionType,
  getFighterHealthState,
  resolveFighterAmbientMood,
} from '@/utils/fighterAnimations';

export interface UseFighterConductorOptions {
  health: number;
  maxHealth: number;
  remainingTime?: number;
  score?: number;
  targetScore?: number;
  isActiveRound?: boolean;
}

export interface TriggerMatchOptions {
  /** Match used a Grace to forgive 1 mismatched attribute */
  isGraceMatch?: boolean;
  /** Match triggered explosion, laser, ricochet, echo, or big multi-card clear */
  isMegaMatch?: boolean;
  /** Match also healed the fighter */
  didHeal?: boolean;
}

export interface TriggerMistakeOptions {
  /** Mistake damage was prevented by a Grace / Second Chance */
  savedByGrace?: boolean;
}

/**
 * Coordinates the live fighter's ambient mood, streak counter, automatic HP-delta
 * reactions (e.g. bomb/enemy tick damage or passive healing), and discrete match/mistake events.
 */
export function useFighterConductor({
  health,
  maxHealth,
  remainingTime,
  score = 0,
  targetScore = 0,
  isActiveRound = true,
}: UseFighterConductorOptions) {
  const [reaction, setReaction] = useState<FighterReactionEvent | null>(null);
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [isBoardIdle, setIsBoardIdle] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);

  const reactionCounterRef = useRef<number>(0);
  const prevHealthRef = useRef<number>(health);
  const lastManualReactionAtRef = useRef<number>(0);
  const streakRef = useRef<number>(0);

  const fireReaction = useCallback((type: FighterReactionType) => {
    reactionCounterRef.current += 1;
    lastManualReactionAtRef.current = Date.now();
    setReaction({ type, id: reactionCounterRef.current });
  }, []);

  // Automatically react to external HP changes (bomb/enemy tick damage or passive heal)
  useEffect(() => {
    const prev = prevHealthRef.current;
    prevHealthRef.current = health;

    if (!isActiveRound || health === prev) {
      return;
    }

    const elapsedSinceManual = Date.now() - lastManualReactionAtRef.current;
    if (health < prev) {
      streakRef.current = 0;
      setStreak(0);
      if (elapsedSinceManual > 120) {
        fireReaction('pain');
      }
    } else if (health > prev) {
      if (elapsedSinceManual > 120) {
        fireReaction('heal');
      }
    }
  }, [health, isActiveRound, fireReaction]);

  const triggerMatch = useCallback(
    (opts: TriggerMatchOptions = {}) => {
      const nextStreak = streakRef.current + 1;
      streakRef.current = nextStreak;
      setStreak(nextStreak);
      setIsBoardIdle(false);

      if (opts.isMegaMatch || nextStreak >= 3) {
        fireReaction('ecstatic');
      } else if (opts.didHeal) {
        fireReaction('heal');
      } else if (opts.isGraceMatch) {
        // Near-miss saved by Grace!
        fireReaction('relief');
      } else {
        fireReaction('joy');
      }
    },
    [fireReaction]
  );

  const triggerMistake = useCallback(
    (opts: TriggerMistakeOptions = {}) => {
      streakRef.current = 0;
      setStreak(0);
      setIsBoardIdle(false);

      if (opts.savedByGrace) {
        fireReaction('relief');
      } else {
        fireReaction('pain');
      }
    },
    [fireReaction]
  );

  const triggerPowerup = useCallback(() => {
    fireReaction('powerup');
  }, [fireReaction]);

  const triggerHint = useCallback(() => {
    setIsBoardIdle(false);
    fireReaction('hint');
  }, [fireReaction]);

  const triggerHeal = useCallback(() => {
    fireReaction('heal');
  }, [fireReaction]);

  const triggerEntrance = useCallback(() => {
    streakRef.current = 0;
    setStreak(0);
    setSelectedCount(0);
    setIsBoardIdle(false);
    fireReaction('entrance');
  }, [fireReaction]);

  const handleSelectedCountChange = useCallback((count: number) => {
    setSelectedCount(count);
    if (count > 0) {
      setIsBoardIdle(false);
    }
  }, []);

  const healthState = useMemo(
    () => getFighterHealthState(health, maxHealth),
    [health, maxHealth]
  );

  const mood: FighterAmbientMood = useMemo(
    () =>
      resolveFighterAmbientMood({
        health,
        remainingTime,
        score,
        targetScore,
        selectedCount,
        streak,
        isBoardIdle,
      }),
    [health, remainingTime, score, targetScore, selectedCount, streak, isBoardIdle]
  );

  return {
    reaction,
    mood,
    healthState,
    streak,
    selectedCount,
    isBoardIdle,
    setSelectedCount: handleSelectedCountChange,
    setIsBoardIdle,
    triggerReaction: fireReaction,
    triggerMatch,
    triggerMistake,
    triggerPowerup,
    triggerHint,
    triggerHeal,
    triggerEntrance,
  };
}

export default useFighterConductor;
