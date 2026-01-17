/**
 * useRoundStats Hook
 *
 * Tracks statistics during a round for enemy defeat condition checking.
 * All stats are reset at the start of each round.
 */

import { useCallback, useRef } from 'react';
import type { Card, Shape, Color } from '@/types';
import type { RoundStats } from '@/types/enemy';

/**
 * Initial round stats with all values reset
 */
export function createInitialRoundStats(
  targetScore: number = 0,
  hintsRemaining: number = 0,
  gracesRemaining: number = 0
): RoundStats {
  return {
    // Match tracking
    totalMatches: 0,
    currentStreak: 0,
    maxStreak: 0,
    invalidMatches: 0,

    // Timing
    matchTimes: [],
    timeRemaining: 60,

    // Card tracking
    cardsRemaining: 12,
    tripleCardsCleared: 0,
    faceDownCardsMatched: 0,
    bombsDefused: 0,
    countdownCardsMatched: 0,

    // Attribute tracking
    shapesMatched: new Set<Shape>(),
    colorsMatched: new Set<Color>(),
    colorMatchCounts: new Map<Color, number>(),
    allDifferentMatches: 0,
    allSameColorMatches: 0,
    squiggleMatches: 0,

    // Resource tracking
    gracesUsed: 0,
    hintsUsed: 0,
    hintsRemaining,
    gracesRemaining,
    damageReceived: 0,
    weaponEffectsTriggered: new Set<string>(),

    // Score
    currentScore: 0,
    targetScore,
  };
}

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
  };
}
