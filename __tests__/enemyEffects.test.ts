/**
 * Unit tests for reusable enemy effect behaviors.
 * Tests each effect in isolation with deterministic random mocking.
 */
import type { Card } from '@/types';
import type { EnemyTickResult, EnemyMatchResult, EnemyStatModifiers, EnemyUIModifiers } from '@/types/enemy';
import {
  DudCardEffect,
  InactivityEffect,
  ScoreDecayEffect,
  FaceDownEffect,
  CardRemovalEffect,
  TimerSpeedEffect,
  WeaponCounterEffect,
  TimeStealEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  HintDisableEffect,
  PositionShuffleEffect,
  ExtraCardRemovalOnMatchEffect,
  composeEffects,
} from '@/utils/enemyEffects';

// Helper to create a minimal test card
const createTestCard = (id: string = 'test-card', overrides: Partial<Card> = {}): Card => ({
  id,
  shape: 'oval',
  color: 'red',
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
  ...overrides,
});

// Helper to mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

// Restore Math.random after each test
afterEach(() => {
  jest.restoreAllMocks();
});

describe('DudCardEffect', () => {
  it('creates dud when random < chance', () => {
    mockRandom(0.09); // 9%, below 10% threshold
    const card = createTestCard();
    const result = DudCardEffect.onCardDraw!(card, { chance: 10 });
    expect(result.isDud).toBe(true);
  });

  it('does not create dud when random >= chance', () => {
    mockRandom(0.15); // 15%, above 10% threshold
    const card = createTestCard();
    const result = DudCardEffect.onCardDraw!(card, { chance: 10 });
    expect(result.isDud).toBeUndefined();
  });

  it('works at 0% chance (never dud)', () => {
    mockRandom(0.001); // Very low, but still above 0%
    const card = createTestCard();
    const result = DudCardEffect.onCardDraw!(card, { chance: 0 });
    expect(result.isDud).toBeUndefined();
  });

  it('works at 100% chance (always dud)', () => {
    mockRandom(0.99); // High value, but still below 100%
    const card = createTestCard();
    const result = DudCardEffect.onCardDraw!(card, { chance: 100 });
    expect(result.isDud).toBe(true);
  });
});

describe('InactivityEffect', () => {
  const config = { maxMs: 10000, penalty: 'damage' as const };

  it('tracks time since match correctly', () => {
    const state: Record<string, unknown> = { timeSinceMatch: 0 };
    InactivityEffect.onTick!(5000, [], state, config);
    expect(state.timeSinceMatch).toBe(5000);
  });

  it('triggers damage penalty at threshold', () => {
    const state: Record<string, unknown> = { timeSinceMatch: 9000 };
    const result = InactivityEffect.onTick!(1500, [], state, config);
    expect(result.healthDelta).toBe(-1);
    expect(result.instantDeath).toBeFalsy();
    expect(result.events).toContainEqual({ type: 'inactivity_penalty', penalty: 'damage' });
  });

  it('triggers instant death at threshold when configured', () => {
    const deathConfig = { maxMs: 10000, penalty: 'death' as const };
    const state: Record<string, unknown> = { timeSinceMatch: 9000 };
    const result = InactivityEffect.onTick!(1500, [], state, deathConfig);
    expect(result.healthDelta).toBe(0);
    expect(result.instantDeath).toBe(true);
    expect(result.events).toContainEqual({ type: 'inactivity_penalty', penalty: 'death' });
  });

  it('resets timer after penalty is applied', () => {
    const state: Record<string, unknown> = { timeSinceMatch: 9000 };
    InactivityEffect.onTick!(1500, [], state, config);
    expect(state.timeSinceMatch).toBe(0); // Reset after penalty
  });

  it('emits warning event at 5 seconds remaining', () => {
    const state: Record<string, unknown> = { timeSinceMatch: 4500 };
    // After this tick, 5.5s elapsed, 4.5s remaining - should warn at 5s boundary
    const result = InactivityEffect.onTick!(500, [], state, config);
    expect(result.events).toContainEqual({ type: 'inactivity_warning', secondsRemaining: 5 });
  });

  it('returns correct UI modifiers for inactivity bar', () => {
    const state: Record<string, unknown> = { timeSinceMatch: 3000 };
    const modifiers = InactivityEffect.getUIModifiers!(state, config);
    expect(modifiers.showInactivityBar).toEqual({
      current: 3000,
      max: 10000,
      penalty: 'damage',
    });
  });
});

describe('ScoreDecayEffect', () => {
  const config = { ratePerSecond: 5 };

  it('decays score by correct amount per tick', () => {
    const state: Record<string, unknown> = {};
    const result = ScoreDecayEffect.onTick!(1000, [], state, config); // 1 second
    expect(result.scoreDelta).toBe(-5);
  });

  it('decays proportionally to time elapsed', () => {
    const state: Record<string, unknown> = {};
    const result = ScoreDecayEffect.onTick!(500, [], state, config); // 0.5 seconds
    expect(result.scoreDelta).toBe(-2.5);
  });

  it('returns correct UI modifiers for decay indicator', () => {
    const state: Record<string, unknown> = {};
    const modifiers = ScoreDecayEffect.getUIModifiers!(state, config);
    expect(modifiers.showScoreDecay).toEqual({ rate: 5 });
  });
});

describe('FaceDownEffect', () => {
  const config = { chance: 20, flipChance: 70 };

  it('creates face-down card when random < chance', () => {
    mockRandom(0.15); // 15%, below 20% threshold
    const card = createTestCard();
    const result = FaceDownEffect.onCardDraw!(card, config);
    expect(result.isFaceDown).toBe(true);
  });

  it('any match triggers flip roll for ALL face-down cards', () => {
    mockRandom(0.5); // 50%, below 70% flipChance
    const board = [
      createTestCard('card-1', { isFaceDown: true }),
      createTestCard('card-2', { isFaceDown: true }),
      createTestCard('card-3'), // Not face down
    ];
    const result = FaceDownEffect.onValidMatch!([], board, {}, config);
    // Both face-down cards should flip (50% < 70%)
    expect(result.cardsToFlip).toContain('card-1');
    expect(result.cardsToFlip).toContain('card-2');
    expect(result.cardsToFlip?.length).toBe(2);
  });

  it('flips card when random < flipChance', () => {
    mockRandom(0.5); // 50%, below 70% threshold
    const board = [createTestCard('card-1', { isFaceDown: true })];
    const result = FaceDownEffect.onValidMatch!([], board, {}, config);
    expect(result.cardsToFlip).toContain('card-1');
  });

  it('does not flip when random >= flipChance', () => {
    mockRandom(0.75); // 75%, above 70% threshold
    const board = [createTestCard('card-1', { isFaceDown: true })];
    const result = FaceDownEffect.onValidMatch!([], board, {}, config);
    expect(result.cardsToFlip?.length).toBe(0);
  });

  it('multiple face-down cards each get independent roll', () => {
    // First call returns 0.5 (flip), second returns 0.8 (no flip)
    let callCount = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0.5 : 0.8;
    });

    const board = [
      createTestCard('card-1', { isFaceDown: true }),
      createTestCard('card-2', { isFaceDown: true }),
    ];
    const result = FaceDownEffect.onValidMatch!([], board, {}, config);
    // First flips (0.5 < 0.7), second doesn't (0.8 >= 0.7)
    expect(result.cardsToFlip).toContain('card-1');
    expect(result.cardsToFlip).not.toContain('card-2');
  });
});

describe('CardRemovalEffect', () => {
  const config = { intervalMs: 5000, minBoardSize: 6 };

  it('removes card at interval', () => {
    mockRandom(0.5); // Pick middle card
    const state: Record<string, unknown> = { timeSinceRemoval: 4000 };
    const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
    const result = CardRemovalEffect.onTick!(1500, board, state, config);
    expect(result.cardsToRemove?.length).toBe(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'card_removed', reason: 'enemy_effect' })
    );
  });

  it('does not remove when board at minimum size (6)', () => {
    const state: Record<string, unknown> = { timeSinceRemoval: 4000 };
    const board = Array.from({ length: 6 }, (_, i) => createTestCard(`card-${i}`));
    const result = CardRemovalEffect.onTick!(1500, board, state, config);
    expect(result.cardsToRemove?.length ?? 0).toBe(0);
  });

  it('resets removal timer after removal', () => {
    mockRandom(0.5);
    const state: Record<string, unknown> = { timeSinceRemoval: 4000 };
    const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
    CardRemovalEffect.onTick!(1500, board, state, config);
    expect(state.timeSinceRemoval).toBe(0);
  });

  it('emits card_removed event', () => {
    mockRandom(0.5);
    const state: Record<string, unknown> = { timeSinceRemoval: 5000 };
    const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
    const result = CardRemovalEffect.onTick!(100, board, state, config);
    expect(result.events?.[0]?.type).toBe('card_removed');
  });
});

describe('TimerSpeedEffect', () => {
  it('returns correct timerSpeedMultiplier in UI modifiers', () => {
    const modifiers = TimerSpeedEffect.getUIModifiers!({}, { multiplier: 1.2 });
    expect(modifiers.timerSpeedMultiplier).toBe(1.2);
  });

  it('handles different multiplier values', () => {
    expect(TimerSpeedEffect.getUIModifiers!({}, { multiplier: 1.5 }).timerSpeedMultiplier).toBe(1.5);
    expect(TimerSpeedEffect.getUIModifiers!({}, { multiplier: 2.0 }).timerSpeedMultiplier).toBe(2.0);
  });
});

describe('WeaponCounterEffect', () => {
  it('returns correct stat reduction for fire', () => {
    const modifiers = WeaponCounterEffect.getStatModifiers!({ type: 'fire', reduction: 15 });
    expect(modifiers.fireSpreadChanceReduction).toBe(15);
  });

  it('returns correct stat reduction for explosion', () => {
    const modifiers = WeaponCounterEffect.getStatModifiers!({ type: 'explosion', reduction: 35 });
    expect(modifiers.explosionChanceReduction).toBe(35);
  });

  it('returns correct stat reduction for laser', () => {
    const modifiers = WeaponCounterEffect.getStatModifiers!({ type: 'laser', reduction: 20 });
    expect(modifiers.laserChanceReduction).toBe(20);
  });

  it('returns correct stat reduction for hints', () => {
    const modifiers = WeaponCounterEffect.getStatModifiers!({ type: 'hint', reduction: 15 });
    expect(modifiers.hintGainChanceReduction).toBe(15);
  });

  it('returns correct stat reduction for graces', () => {
    const modifiers = WeaponCounterEffect.getStatModifiers!({ type: 'grace', reduction: 15 });
    expect(modifiers.graceGainChanceReduction).toBe(15);
  });

  it('returns correct stat reduction for time', () => {
    const modifiers = WeaponCounterEffect.getStatModifiers!({ type: 'time', reduction: 20 });
    expect(modifiers.timeGainChanceReduction).toBe(20);
  });

  it('returns correct stat reduction for healing', () => {
    const modifiers = WeaponCounterEffect.getStatModifiers!({ type: 'healing', reduction: 10 });
    expect(modifiers.healingChanceReduction).toBe(10);
  });

  it('returns correct UI modifier with counter badge info', () => {
    const modifiers = WeaponCounterEffect.getUIModifiers!({}, { type: 'fire', reduction: 15 });
    expect(modifiers.weaponCounters).toContainEqual({ type: 'fire', reduction: 15 });
  });
});

describe('TimeStealEffect', () => {
  it('returns negative timeDelta on match', () => {
    const result = TimeStealEffect.onValidMatch!([], [], {}, { amount: 5 });
    expect(result.timeDelta).toBe(-5);
  });

  it('emits time_stolen event', () => {
    const result = TimeStealEffect.onValidMatch!([], [], {}, { amount: 5 });
    expect(result.events).toContainEqual({ type: 'time_stolen', amount: 5 });
  });
});

describe('DamageMultiplierEffect', () => {
  it('returns correct damage multiplier in stat modifiers', () => {
    const modifiers = DamageMultiplierEffect.getStatModifiers!({ multiplier: 2.0 });
    expect(modifiers.damageMultiplier).toBe(2.0);
  });
});

describe('PointsMultiplierEffect', () => {
  it('returns correct points multiplier on match', () => {
    const result = PointsMultiplierEffect.onValidMatch!([], [], {}, { multiplier: 2.0 });
    expect(result.pointsMultiplier).toBe(2.0);
  });

  it('returns correct points multiplier in stat modifiers', () => {
    const modifiers = PointsMultiplierEffect.getStatModifiers!({ multiplier: 2.0 });
    expect(modifiers.pointsMultiplier).toBe(2.0);
  });
});

describe('HintDisableEffect', () => {
  it('returns disableAutoHint in UI modifiers', () => {
    const modifiers = HintDisableEffect.getUIModifiers!({}, { disableAuto: true });
    expect(modifiers.disableAutoHint).toBe(true);
  });

  it('returns disableManualHint in UI modifiers', () => {
    const modifiers = HintDisableEffect.getUIModifiers!({}, { disableManual: true });
    expect(modifiers.disableManualHint).toBe(true);
  });

  it('can disable both hint types', () => {
    const modifiers = HintDisableEffect.getUIModifiers!({}, { disableAuto: true, disableManual: true });
    expect(modifiers.disableAutoHint).toBe(true);
    expect(modifiers.disableManualHint).toBe(true);
  });
});

describe('PositionShuffleEffect', () => {
  const config = { intervalMs: 8000 };

  it('shuffles positions at interval', () => {
    const state: Record<string, unknown> = { timeSinceShuffle: 7500 };
    const result = PositionShuffleEffect.onTick!(600, [], state, config);
    expect(result.events).toContainEqual({ type: 'positions_shuffled' });
  });

  it('emits positions_shuffled event', () => {
    const state: Record<string, unknown> = { timeSinceShuffle: 8000 };
    const result = PositionShuffleEffect.onTick!(100, [], state, config);
    expect(result.events?.[0]?.type).toBe('positions_shuffled');
  });

  it('resets timer after shuffle', () => {
    const state: Record<string, unknown> = { timeSinceShuffle: 8000 };
    PositionShuffleEffect.onTick!(100, [], state, config);
    expect(state.timeSinceShuffle).toBe(0);
  });

  it('does not shuffle before interval', () => {
    const state: Record<string, unknown> = { timeSinceShuffle: 5000 };
    const result = PositionShuffleEffect.onTick!(1000, [], state, config);
    expect(result.events?.length ?? 0).toBe(0);
  });
});

describe('ExtraCardRemovalOnMatchEffect', () => {
  const config = { count: 2, minBoardSize: 6 };

  it('removes extra cards on valid match', () => {
    mockRandom(0.5);
    const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
    const result = ExtraCardRemovalOnMatchEffect.onValidMatch!([], board, {}, config);
    expect(result.cardsToRemove?.length).toBe(2);
  });

  it('respects minimum board size', () => {
    const board = Array.from({ length: 7 }, (_, i) => createTestCard(`card-${i}`));
    const result = ExtraCardRemovalOnMatchEffect.onValidMatch!([], board, {}, config);
    // Only 1 can be removed (7 - 6 = 1)
    expect(result.cardsToRemove?.length).toBe(1);
  });

  it('does not remove if at minimum', () => {
    const board = Array.from({ length: 6 }, (_, i) => createTestCard(`card-${i}`));
    const result = ExtraCardRemovalOnMatchEffect.onValidMatch!([], board, {}, config);
    expect(result.cardsToRemove?.length ?? 0).toBe(0);
  });
});

describe('composeEffects', () => {
  it('composes multiple effects into a single enemy', () => {
    const enemy = composeEffects(
      { name: 'Test Enemy', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [
        { behavior: ScoreDecayEffect, config: { ratePerSecond: 5 } },
        { behavior: TimerSpeedEffect, config: { multiplier: 1.2 } },
      ]
    );

    expect(enemy.name).toBe('Test Enemy');
    expect(enemy.tier).toBe(1);
  });

  it('merges onTick results from multiple effects', () => {
    const enemy = composeEffects(
      { name: 'Test', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [
        { behavior: ScoreDecayEffect, config: { ratePerSecond: 5 } },
        { behavior: ScoreDecayEffect, config: { ratePerSecond: 3 } }, // Second decay
      ]
    );

    const result = enemy.onTick(1000, []);
    // Combined decay: -5 + -3 = -8
    expect(result.scoreDelta).toBe(-8);
  });

  it('merges UI modifiers from multiple effects', () => {
    const enemy = composeEffects(
      { name: 'Test', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [
        { behavior: TimerSpeedEffect, config: { multiplier: 1.2 } },
        { behavior: WeaponCounterEffect, config: { type: 'fire', reduction: 15 } },
      ]
    );

    const modifiers = enemy.getUIModifiers();
    expect(modifiers.timerSpeedMultiplier).toBe(1.2);
    expect(modifiers.weaponCounters).toContainEqual({ type: 'fire', reduction: 15 });
  });

  it('merges stat modifiers from multiple effects', () => {
    const enemy = composeEffects(
      { name: 'Test', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [
        { behavior: WeaponCounterEffect, config: { type: 'fire', reduction: 15 } },
        { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      ]
    );

    const modifiers = enemy.getStatModifiers();
    expect(modifiers.fireSpreadChanceReduction).toBe(15);
    expect(modifiers.damageMultiplier).toBe(2.0);
  });

  it('chains onCardDraw through multiple effects', () => {
    mockRandom(0.05); // Below both thresholds
    const enemy = composeEffects(
      { name: 'Test', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [
        { behavior: DudCardEffect, config: { chance: 10 } },
        { behavior: FaceDownEffect, config: { chance: 20, flipChance: 70 } },
      ]
    );

    const card = enemy.onCardDraw(createTestCard());
    // Both effects should apply (5% < 10% and 5% < 20%)
    expect(card.isDud).toBe(true);
    expect(card.isFaceDown).toBe(true);
  });

  it('resets inactivity timer on valid match', () => {
    const enemy = composeEffects(
      { name: 'Test', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [{ behavior: InactivityEffect, config: { maxMs: 10000, penalty: 'damage' } }]
    );

    // Accumulate time
    enemy.onTick(5000, []);
    let modifiers = enemy.getUIModifiers();
    expect(modifiers.showInactivityBar?.current).toBe(5000);

    // Match should reset
    enemy.onValidMatch([], []);
    modifiers = enemy.getUIModifiers();
    expect(modifiers.showInactivityBar?.current).toBe(0);
  });

  it('uses custom defeat condition when provided', () => {
    const enemy = composeEffects(
      { name: 'Test', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [],
      (stats) => stats.totalMatches >= 5
    );

    expect(enemy.checkDefeatCondition({ totalMatches: 3 } as any)).toBe(false);
    expect(enemy.checkDefeatCondition({ totalMatches: 5 } as any)).toBe(true);
  });

  it('resets internal state on onRoundStart', () => {
    const enemy = composeEffects(
      { name: 'Test', tier: 1, description: 'Test', defeatConditionText: 'Test' },
      [{ behavior: InactivityEffect, config: { maxMs: 10000, penalty: 'damage' } }]
    );

    // Accumulate time
    enemy.onTick(5000, []);
    let modifiers = enemy.getUIModifiers();
    expect(modifiers.showInactivityBar?.current).toBe(5000);

    // Round start should reset
    enemy.onRoundStart([]);
    modifiers = enemy.getUIModifiers();
    expect(modifiers.showInactivityBar?.current).toBe(0);
  });
});
