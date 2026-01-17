/**
 * Unit tests for enemy defeat detection flow
 *
 * Tests that the game correctly tracks and displays whether an enemy was defeated,
 * ensuring the UI shows accurate completion status and rewards.
 */

import { createStingingScorpion } from '@/utils/enemies/tier1/stingingScorpion';
import { createPunishingErmine } from '@/utils/enemies/tier1/punishingErmine';
import { createSwiftBee } from '@/utils/enemies/tier1/swiftBee';
import type { RoundStats } from '@/types/enemy';

// Helper to create minimal RoundStats
const createRoundStats = (overrides: Partial<RoundStats> = {}): RoundStats => ({
  totalMatches: 0,
  currentStreak: 0,
  maxStreak: 0,
  invalidMatches: 0,
  matchTimes: [],
  timeRemaining: 60,
  cardsRemaining: 12,
  tripleCardsCleared: 0,
  faceDownCardsMatched: 0,
  bombsDefused: 0,
  countdownCardsMatched: 0,
  shapesMatched: new Set(),
  colorsMatched: new Set(),
  colorMatchCounts: new Map(),
  allDifferentMatches: 0,
  allSameColorMatches: 0,
  squiggleMatches: 0,
  gracesUsed: 0,
  hintsUsed: 0,
  hintsRemaining: 3,
  gracesRemaining: 2,
  damageReceived: 0,
  weaponEffectsTriggered: new Set(),
  currentScore: 0,
  targetScore: 100,
  ...overrides,
});

describe('Enemy Defeat Detection Flow', () => {
  describe('Stinging Scorpion (No Invalid Matches)', () => {
    it('is defeated when making perfect matches only', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({
        totalMatches: 5,
        invalidMatches: 0
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(true);
    });

    it('is NOT defeated when making even one invalid match', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({
        totalMatches: 10,
        invalidMatches: 1  // User failed - made 1 imperfect match
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(false);
    });

    it('is NOT defeated when making multiple invalid matches', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({
        totalMatches: 8,
        invalidMatches: 3
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(false);
    });

    it('is NOT defeated with zero matches', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({
        totalMatches: 0,
        invalidMatches: 0
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(false);
    });
  });

  describe('Punishing Ermine (No Invalid Matches)', () => {
    it('is defeated when making matches without invalid matches', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 8,
        invalidMatches: 0
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(true);
    });

    it('is NOT defeated when making any invalid matches', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 10,
        invalidMatches: 1  // User failed - made an invalid match
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(false);
    });

    it('is NOT defeated when making multiple invalid matches', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 5,
        invalidMatches: 3
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(false);
    });
  });

  describe('Swift Bee (Get 5-match streak)', () => {
    it('is defeated when achieving 5-match streak', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({
        totalMatches: 5,
        maxStreak: 5
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(true);
    });

    it('is NOT defeated when max streak is less than 5', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({
        totalMatches: 10,
        maxStreak: 4  // Failed - only got 4 streak
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(false);
    });

    it('is NOT defeated when no matches made', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({
        totalMatches: 0,
        maxStreak: 0
      });

      const wasDefeated = enemy.checkDefeatCondition(stats);
      expect(wasDefeated).toBe(false);
    });
  });

  describe('Defeat Detection Consistency', () => {
    it('consistently returns same result for same stats', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({ totalMatches: 5, invalidMatches: 0 });

      // Check multiple times
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('consistently returns false for failure case', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({ totalMatches: 5, invalidMatches: 1 });

      // Check multiple times
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });
});
