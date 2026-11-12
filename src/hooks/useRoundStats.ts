/**
 * useRoundStats Hook
 *
 * Tracks statistics during a round for enemy defeat condition checking.
 * All stats are reset at the start of each round.
 */

import { useCallback, useRef } from 'react';
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { addWeaponImpact, createInitialRoundStats, getSortedWeaponImpacts, WeaponImpactDelta } from '@/game/roundStats';

// Re-exported for existing importers; new code should import from '@/game/roundStats'.
export { createInitialRoundStats };

/**
 * Hook to track round statistics for enemy defeat conditions.
 * Returns mutable ref for performance (avoid re-renders on every stat update).
 */
export function useRoundStats() {
  const statsRef = useRef<RoundStats>(createInitialRoundStats());
  const lastMatchTimeRef = useRef<number>(Date.now());

  /**
   * Reset all stats for a new round
   */
  const resetStats = useCallback(
    (targetScore: number, hintsRemaining: number, gracesRemaining: number) => {
      statsRef.current = createInitialRoundStats(targetScore, hintsRemaining, gracesRemaining);
      lastMatchTimeRef.current = Date.now();
    },
    []
  );

  /**
   * Record a valid match
   */
  const recordValidMatch = useCallback(
    (
      matchedCards: Card[],
      options: {
        isAllDifferent?: boolean;
        isAllSameColor?: boolean;
        hasSquiggle?: boolean;
        pointsEarned?: number;
      } = {}
    ) => {
      const stats = statsRef.current;
      const now = Date.now();
      const timeSinceLastMatch = now - lastMatchTimeRef.current;

      // Match tracking
      stats.totalMatches += 1;
      stats.currentStreak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.matchTimes.push(timeSinceLastMatch);
      lastMatchTimeRef.current = now;

      // Attribute tracking
      for (const card of matchedCards) {
        stats.shapesMatched.add(card.shape);
        stats.colorsMatched.add(card.color);
        // Increment color match count
        const currentCount = stats.colorMatchCounts.get(card.color) || 0;
        stats.colorMatchCounts.set(card.color, currentCount + 1);
      }

      if (options.isAllDifferent) {
        stats.allDifferentMatches += 1;
      }
      if (options.isAllSameColor) {
        stats.allSameColorMatches += 1;
      }
      if (options.hasSquiggle) {
        stats.squiggleMatches += 1;
      }

      // Card state tracking
      const faceDownCount = matchedCards.filter((c) => c.isFaceDown).length;
      stats.faceDownCardsMatched += faceDownCount;

      const bombCount = matchedCards.filter((c) => c.hasBomb).length;
      stats.bombsDefused += bombCount;

      const countdownCount = matchedCards.filter((c) => c.hasCountdown).length;
      stats.countdownCardsMatched += countdownCount;

      // Score tracking
      if (options.pointsEarned) {
        stats.currentScore += options.pointsEarned;
      }
    },
    []
  );

  /**
   * Record an invalid match
   */
  const recordInvalidMatch = useCallback(() => {
    const stats = statsRef.current;
    stats.invalidMatches += 1;
    stats.currentStreak = 0; // Reset streak on invalid match
  }, []);

  /**
   * Record grace usage
   */
  const recordGraceUsed = useCallback(() => {
    const stats = statsRef.current;
    stats.gracesUsed += 1;
    stats.gracesRemaining = Math.max(0, stats.gracesRemaining - 1);
  }, []);

  /**
   * Record hint usage
   */
  const recordHintUsed = useCallback(() => {
    const stats = statsRef.current;
    stats.hintsUsed += 1;
    stats.hintsRemaining = Math.max(0, stats.hintsRemaining - 1);
  }, []);

  /**
   * Record damage received
   */
  const recordDamage = useCallback((amount: number) => {
    const stats = statsRef.current;
    stats.damageReceived += amount;
  }, []);

  /**
   * Record weapon effect triggered
   */
  const recordWeaponEffect = useCallback((weaponType: string) => {
    const stats = statsRef.current;
    stats.weaponEffectsTriggered.add(weaponType);
  }, []);

  /**
   * Record triple card cleared
   */
  const recordTripleCardCleared = useCallback(() => {
    const stats = statsRef.current;
    stats.tripleCardsCleared += 1;
  }, []);

  /**
   * Update time remaining
   */
  const updateTimeRemaining = useCallback((time: number) => {
    statsRef.current.timeRemaining = time;
  }, []);

  /**
   * Update cards remaining
   */
  const updateCardsRemaining = useCallback((count: number) => {
    statsRef.current.cardsRemaining = count;
  }, []);

  /**
   * Update score
   */
  const updateScore = useCallback((score: number) => {
    statsRef.current.currentScore = score;
  }, []);

  /**
   * Update hints remaining (when gained from weapon)
   */
  const updateHintsRemaining = useCallback((count: number) => {
    statsRef.current.hintsRemaining = count;
  }, []);

  /**
   * Update graces remaining (when gained from weapon)
   */
  const updateGracesRemaining = useCallback((count: number) => {
    statsRef.current.gracesRemaining = count;
  }, []);

  /**
   * Get current stats (read-only snapshot)
   */
  const getStats = useCallback((): RoundStats => {
    return { ...statsRef.current };
  }, []);

  /**
   * Record a time gain trigger (increment counter)
   */
  const recordTimeGainTrigger = useCallback(() => {
    statsRef.current.timeGainTriggersThisRound += 1;
  }, []);

  /**
   * Get current time gain triggers this round
   */
  const getTimeGainTriggers = useCallback((): number => {
    return statsRef.current.timeGainTriggersThisRound;
  }, []);

  /**
   * Add temporary bonus to time gain trigger cap (from challenge legendaries)
   */
  const addTimeGainTriggerCapBonus = useCallback((amount: number) => {
    statsRef.current.timeGainTriggerCapBonus += amount;
  }, []);

  /**
   * Get current time gain trigger cap bonus
   */
  const getTimeGainTriggerCapBonus = useCallback((): number => {
    return statsRef.current.timeGainTriggerCapBonus;
  }, []);

  /**
   * Increment consecutive invalid matches counter
   */
  const incrementConsecutiveInvalidMatches = useCallback(() => {
    statsRef.current.consecutiveInvalidMatches += 1;
  }, []);

  /**
   * Reset consecutive invalid matches counter (on valid match)
   */
  const resetConsecutiveInvalidMatches = useCallback(() => {
    statsRef.current.consecutiveInvalidMatches = 0;
  }, []);

  /**
   * Get consecutive invalid matches count
   */
  const getConsecutiveInvalidMatches = useCallback((): number => {
    return statsRef.current.consecutiveInvalidMatches;
  }, []);

  /**
   * Mark Prismatic Perfection as triggered
   */
  const markPrismaticPerfectionTriggered = useCallback(() => {
    statsRef.current.prismaticPerfectionTriggered = true;
  }, []);

  /**
   * Check if Prismatic Perfection already triggered this round
   */
  const isPrismaticPerfectionTriggered = useCallback((): boolean => {
    return statsRef.current.prismaticPerfectionTriggered;
  }, []);

  /**
   * Mark Tabula Rasa as triggered
   */
  const markTabulaRasaTriggered = useCallback(() => {
    statsRef.current.tabulaRasaTriggered = true;
  }, []);

  /**
   * Check if Tabula Rasa already triggered this round
   */
  const isTabulaRasaTriggered = useCallback((): boolean => {
    return statsRef.current.tabulaRasaTriggered;
  }, []);

  /**
   * Record a weapon impact (points, cards destroyed, etc.)
   */
  const recordWeaponImpact = useCallback(
    (
      weaponId: string,
      weaponName: string,
      weaponIcon: string,
      impact: WeaponImpactDelta
    ) => {
      addWeaponImpact(statsRef.current, weaponId, weaponName, weaponIcon, impact);
    },
    []
  );

  /**
   * Get weapon impacts sorted by total value (descending)
   */
  const getWeaponImpacts = useCallback(() => getSortedWeaponImpacts(statsRef.current), []);

  return {
    statsRef,
    resetStats,
    recordValidMatch,
    recordInvalidMatch,
    recordGraceUsed,
    recordHintUsed,
    recordDamage,
    recordWeaponEffect,
    recordTripleCardCleared,
    updateTimeRemaining,
    updateCardsRemaining,
    updateScore,
    updateHintsRemaining,
    updateGracesRemaining,
    getStats,
    recordTimeGainTrigger,
    getTimeGainTriggers,
    addTimeGainTriggerCapBonus,
    getTimeGainTriggerCapBonus,
    incrementConsecutiveInvalidMatches,
    resetConsecutiveInvalidMatches,
    getConsecutiveInvalidMatches,
    markPrismaticPerfectionTriggered,
    isPrismaticPerfectionTriggered,
    markTabulaRasaTriggered,
    isTabulaRasaTriggered,
    recordWeaponImpact,
    getWeaponImpacts,
  };
}
