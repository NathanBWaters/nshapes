/**
 * Unit tests for applyEnemyStatModifiers function
 */
import { applyEnemyStatModifiers, createDummyEnemy } from '@/utils/enemyFactory';
import type { PlayerStats } from '@/types';
import type { EnemyInstance, EnemyStatModifiers } from '@/types/enemy';

// Helper to create a mock enemy with specific stat modifiers
const createMockEnemyWithModifiers = (modifiers: Partial<EnemyStatModifiers>): EnemyInstance => {
  const dummy = createDummyEnemy();
  return {
    ...dummy,
    getStatModifiers: () => modifiers as EnemyStatModifiers,
  };
};

// Helper to create base player stats
const createBaseStats = (overrides: Partial<PlayerStats> = {}): PlayerStats => ({
  level: 1,
  money: 0,
  experience: 0,
  experienceGainPercent: 0,
  luck: 0,
  maxWeapons: 3,
  commerce: 0,
  scavengingPercent: 0,
  scavengeAmount: 0,
  health: 3,
  maxHealth: 3,
  fieldSize: 12,
  freeRerolls: 0,
  drawIncrease: 0,
  drawIncreasePercent: 0,
  chanceOfFire: 0,
  explosion: 0,
  damage: 0,
  damagePercent: 0,
  holographicPercent: 0,
  maxTimeIncrease: 0,
  timeWarpPercent: 0,
  matchHints: 0,
  matchPossibilityHints: 0,
  matchIntervalHintPercent: 0,
  matchIntervalSpeed: 0,
  dodgePercent: 0,
  dodgeAttackBackPercent: 0,
  dodgeAttackBackAmount: 0,
  graces: 2,
  maxGraces: 3,
  bombTimer: 0,
  additionalPoints: 0,
  deflectPercent: 0,
  criticalChance: 0,
  timeFreezePercent: 0,
  timeFreezeAmount: 0,
  hints: 3,
  maxHints: 5,
  hintPasses: 0,
  explosionChance: 0,
  autoHintChance: 0,
  autoHintInterval: 10000,
  boardGrowthChance: 0,
  boardGrowthAmount: 0,
  fireSpreadChance: 0,
  graceGainChance: 0,
  healingChance: 0,
  hintGainChance: 0,
  xpGainChance: 0,
  coinGainChance: 0,
  timeGainChance: 0,
  timeGainAmount: 0,
  laserChance: 0,
  startingTime: 0,
  ricochetChance: 0,
  ricochetChainChance: 0,
  enhancedHintChance: 0,
  echoChance: 0,
  chainReactionChance: 0,
  ...overrides,
});

describe('applyEnemyStatModifiers', () => {
  describe('division by 3 behavior', () => {
    it('divides explosion chance by 3 when enemy has explosion reduction', () => {
      const baseStats = createBaseStats({ explosionChance: 40 });
      const enemy = createMockEnemyWithModifiers({ explosionChanceReduction: 35 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 40 / 3 ≈ 13 (rounded)
      expect(result.explosionChance).toBe(13);
    });

    it('divides fire spread chance by 3 when enemy has fire reduction', () => {
      const baseStats = createBaseStats({ fireSpreadChance: 30 });
      const enemy = createMockEnemyWithModifiers({ fireSpreadChanceReduction: 20 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 30 / 3 = 10
      expect(result.fireSpreadChance).toBe(10);
    });

    it('divides laser chance by 3 when enemy has laser reduction', () => {
      const baseStats = createBaseStats({ laserChance: 45 });
      const enemy = createMockEnemyWithModifiers({ laserChanceReduction: 25 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 45 / 3 = 15
      expect(result.laserChance).toBe(15);
    });

    it('divides hint gain chance by 3 when enemy has hint reduction', () => {
      const baseStats = createBaseStats({ hintGainChance: 60 });
      const enemy = createMockEnemyWithModifiers({ hintGainChanceReduction: 35 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 60 / 3 = 20
      expect(result.hintGainChance).toBe(20);
    });

    it('divides grace gain chance by 3 when enemy has grace reduction', () => {
      const baseStats = createBaseStats({ graceGainChance: 30 });
      const enemy = createMockEnemyWithModifiers({ graceGainChanceReduction: 20 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 30 / 3 = 10
      expect(result.graceGainChance).toBe(10);
    });

    it('divides time gain chance by 3 when enemy has time reduction', () => {
      const baseStats = createBaseStats({ timeGainChance: 24 });
      const enemy = createMockEnemyWithModifiers({ timeGainChanceReduction: 15 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 24 / 3 = 8
      expect(result.timeGainChance).toBe(8);
    });

    it('divides healing chance by 3 when enemy has healing reduction', () => {
      const baseStats = createBaseStats({ healingChance: 33 });
      const enemy = createMockEnemyWithModifiers({ healingChanceReduction: 20 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 33 / 3 = 11
      expect(result.healingChance).toBe(11);
    });
  });

  describe('retains some capability', () => {
    it('never reduces explosion chance to 0 when player has non-zero chance', () => {
      const baseStats = createBaseStats({ explosionChance: 10 });
      const enemy = createMockEnemyWithModifiers({ explosionChanceReduction: 100 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      // 10 / 3 ≈ 3 (rounded) - still > 0
      expect(result.explosionChance).toBeGreaterThan(0);
    });

    it('returns 0 only when base stat is 0', () => {
      const baseStats = createBaseStats({ explosionChance: 0 });
      const enemy = createMockEnemyWithModifiers({ explosionChanceReduction: 35 });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      expect(result.explosionChance).toBe(0);
    });
  });

  describe('no enemy', () => {
    it('returns base stats unchanged when enemy is null', () => {
      const baseStats = createBaseStats({ explosionChance: 40 });

      const result = applyEnemyStatModifiers(baseStats, null);

      expect(result.explosionChance).toBe(40);
    });

    it('returns base stats unchanged when enemy is undefined', () => {
      const baseStats = createBaseStats({ explosionChance: 40 });

      const result = applyEnemyStatModifiers(baseStats, undefined);

      expect(result.explosionChance).toBe(40);
    });
  });

  describe('no reduction', () => {
    it('does not modify stats when enemy has no reductions', () => {
      const baseStats = createBaseStats({
        explosionChance: 40,
        fireSpreadChance: 30,
        laserChance: 20,
      });
      const enemy = createMockEnemyWithModifiers({});

      const result = applyEnemyStatModifiers(baseStats, enemy);

      expect(result.explosionChance).toBe(40);
      expect(result.fireSpreadChance).toBe(30);
      expect(result.laserChance).toBe(20);
    });
  });

  describe('multiple reductions', () => {
    it('applies division independently to each stat', () => {
      const baseStats = createBaseStats({
        explosionChance: 30,
        fireSpreadChance: 60,
        healingChance: 45,
      });
      const enemy = createMockEnemyWithModifiers({
        explosionChanceReduction: 20,
        fireSpreadChanceReduction: 30,
        healingChanceReduction: 25,
      });

      const result = applyEnemyStatModifiers(baseStats, enemy);

      expect(result.explosionChance).toBe(10);  // 30 / 3
      expect(result.fireSpreadChance).toBe(20);  // 60 / 3
      expect(result.healingChance).toBe(15);  // 45 / 3
    });
  });
});
