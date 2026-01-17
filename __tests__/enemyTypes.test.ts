/**
 * Unit tests for enemy type interfaces.
 * These tests verify the shape and structure of enemy-related types.
 */
import { Card, Shape, Color } from '@/types';
import type {
  EnemyInstance,
  EnemyStartResult,
  EnemyTickResult,
  EnemyMatchResult,
  EnemyUIModifiers,
  EnemyStatModifiers,
  EnemyEvent,
  RoundStats,
} from '@/types/enemy';

// Helper to create a minimal test card
const createTestCard = (id: string = 'test-card'): Card => ({
  id,
  shape: 'oval',
  color: 'red',
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
});

// Helper to create empty round stats
const createEmptyRoundStats = (): RoundStats => ({
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
  shapesMatched: new Set<Shape>(),
  colorsMatched: new Set<Color>(),
  colorMatchCounts: new Map<Color, number>(),
  allDifferentMatches: 0,
  allSameColorMatches: 0,
  squiggleMatches: 0,
  gracesUsed: 0,
  hintsUsed: 0,
  hintsRemaining: 3,
  gracesRemaining: 3,
  damageReceived: 0,
  weaponEffectsTriggered: new Set<string>(),
  currentScore: 0,
  targetScore: 100,
});

describe('EnemyInstance interface', () => {
  // Mock implementation of a dummy enemy for type testing
  const createMockEnemy = (): EnemyInstance => ({
    name: 'Test Enemy',
    icon: 'lorc/uncertainty',
    tier: 1,
    description: 'A test enemy',
    defeatConditionText: 'Test defeat condition',

    onRoundStart: (_board: Card[]): EnemyStartResult => ({
      cardModifications: [],
      events: [],
    }),

    onTick: (_deltaMs: number, _board: Card[]): EnemyTickResult => ({
      scoreDelta: 0,
      healthDelta: 0,
      timeDelta: 0,
      cardsToRemove: [],
      cardModifications: [],
      cardsToFlip: [],
      events: [],
      instantDeath: false,
    }),

    onValidMatch: (_matchedCards: Card[], _board: Card[]): EnemyMatchResult => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),

    onInvalidMatch: (_cards: Card[], _board: Card[]): EnemyMatchResult => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),

    onCardDraw: (card: Card): Card => card,

    checkDefeatCondition: (_stats: RoundStats): boolean => true,

    onRoundEnd: (): void => {},

    getUIModifiers: (): EnemyUIModifiers => ({}),

    getStatModifiers: (): EnemyStatModifiers => ({}),
  });

  it('should have correct metadata properties', () => {
    const enemy = createMockEnemy();
    expect(enemy.name).toBe('Test Enemy');
    expect(enemy.icon).toBe('lorc/uncertainty');
    expect(enemy.tier).toBe(1);
    expect(enemy.description).toBe('A test enemy');
    expect(enemy.defeatConditionText).toBe('Test defeat condition');
  });

  it('should have onRoundStart lifecycle method', () => {
    const enemy = createMockEnemy();
    const board = [createTestCard()];
    const result = enemy.onRoundStart(board);

    expect(result).toBeDefined();
    expect(Array.isArray(result.cardModifications)).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('should have onTick lifecycle method', () => {
    const enemy = createMockEnemy();
    const board = [createTestCard()];
    const result = enemy.onTick(1000, board);

    expect(result).toBeDefined();
    expect(typeof result.scoreDelta).toBe('number');
    expect(typeof result.healthDelta).toBe('number');
    expect(typeof result.timeDelta).toBe('number');
    expect(Array.isArray(result.cardsToRemove)).toBe(true);
    expect(Array.isArray(result.cardModifications)).toBe(true);
    expect(Array.isArray(result.cardsToFlip)).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
    expect(typeof result.instantDeath).toBe('boolean');
  });

  it('should have onValidMatch lifecycle method', () => {
    const enemy = createMockEnemy();
    const cards = [createTestCard('1'), createTestCard('2'), createTestCard('3')];
    const board = cards;
    const result = enemy.onValidMatch(cards, board);

    expect(result).toBeDefined();
    expect(typeof result.timeDelta).toBe('number');
    expect(typeof result.pointsMultiplier).toBe('number');
    expect(Array.isArray(result.cardsToRemove)).toBe(true);
    expect(Array.isArray(result.cardsToFlip)).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('should have onInvalidMatch lifecycle method', () => {
    const enemy = createMockEnemy();
    const cards = [createTestCard('1'), createTestCard('2'), createTestCard('3')];
    const board = cards;
    const result = enemy.onInvalidMatch(cards, board);

    expect(result).toBeDefined();
    expect(typeof result.timeDelta).toBe('number');
    expect(typeof result.pointsMultiplier).toBe('number');
    expect(Array.isArray(result.cardsToRemove)).toBe(true);
    expect(Array.isArray(result.cardsToFlip)).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('should have onCardDraw lifecycle method', () => {
    const enemy = createMockEnemy();
    const card = createTestCard();
    const result = enemy.onCardDraw(card);

    expect(result).toBeDefined();
    expect(result.id).toBe(card.id);
  });

  it('should have checkDefeatCondition method', () => {
    const enemy = createMockEnemy();
    const stats = createEmptyRoundStats();
    const result = enemy.checkDefeatCondition(stats);

    expect(typeof result).toBe('boolean');
  });

  it('should have onRoundEnd lifecycle method', () => {
    const enemy = createMockEnemy();
    expect(() => enemy.onRoundEnd()).not.toThrow();
  });

  it('should have getUIModifiers method', () => {
    const enemy = createMockEnemy();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers).toBeDefined();
    expect(typeof modifiers).toBe('object');
  });

  it('should have getStatModifiers method', () => {
    const enemy = createMockEnemy();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers).toBeDefined();
    expect(typeof modifiers).toBe('object');
  });

  it('should accept valid tier values (1-4)', () => {
    const tier1Enemy = { ...createMockEnemy(), tier: 1 as const };
    const tier2Enemy = { ...createMockEnemy(), tier: 2 as const };
    const tier3Enemy = { ...createMockEnemy(), tier: 3 as const };
    const tier4Enemy = { ...createMockEnemy(), tier: 4 as const };

    expect(tier1Enemy.tier).toBe(1);
    expect(tier2Enemy.tier).toBe(2);
    expect(tier3Enemy.tier).toBe(3);
    expect(tier4Enemy.tier).toBe(4);
  });
});

describe('EnemyTickResult interface', () => {
  it('should have correct structure with all required fields', () => {
    const result: EnemyTickResult = {
      scoreDelta: -5,
      healthDelta: -1,
      timeDelta: 0,
      cardsToRemove: ['card-1'],
      cardModifications: [{ cardId: 'card-2', changes: { isDud: true } }],
      cardsToFlip: ['card-3'],
      events: [],
      instantDeath: false,
    };

    expect(result.scoreDelta).toBe(-5);
    expect(result.healthDelta).toBe(-1);
    expect(result.timeDelta).toBe(0);
    expect(result.cardsToRemove).toContain('card-1');
    expect(result.cardModifications[0].cardId).toBe('card-2');
    expect(result.cardsToFlip).toContain('card-3');
    expect(result.instantDeath).toBe(false);
  });

  it('should support instantDeath flag for inactivity death penalty', () => {
    const result: EnemyTickResult = {
      scoreDelta: 0,
      healthDelta: 0,
      timeDelta: 0,
      cardsToRemove: [],
      cardModifications: [],
      cardsToFlip: [],
      events: [{ type: 'inactivity_penalty', penalty: 'death' }],
      instantDeath: true,
    };

    expect(result.instantDeath).toBe(true);
  });
});

describe('EnemyMatchResult interface', () => {
  it('should have correct structure with all required fields', () => {
    const result: EnemyMatchResult = {
      timeDelta: -5,
      pointsMultiplier: 2.0,
      cardsToRemove: ['extra-card'],
      cardsToFlip: ['facedown-card'],
      events: [],
    };

    expect(result.timeDelta).toBe(-5);
    expect(result.pointsMultiplier).toBe(2.0);
    expect(result.cardsToRemove).toContain('extra-card');
    expect(result.cardsToFlip).toContain('facedown-card');
  });
});

describe('EnemyUIModifiers interface', () => {
  it('should support inactivity bar with damage penalty', () => {
    const modifiers: EnemyUIModifiers = {
      showInactivityBar: {
        current: 30000,
        max: 45000,
        penalty: 'damage',
      },
    };

    expect(modifiers.showInactivityBar?.current).toBe(30000);
    expect(modifiers.showInactivityBar?.max).toBe(45000);
    expect(modifiers.showInactivityBar?.penalty).toBe('damage');
  });

  it('should support inactivity bar with death penalty', () => {
    const modifiers: EnemyUIModifiers = {
      showInactivityBar: {
        current: 25000,
        max: 30000,
        penalty: 'death',
      },
    };

    expect(modifiers.showInactivityBar?.penalty).toBe('death');
  });

  it('should support score decay indicator', () => {
    const modifiers: EnemyUIModifiers = {
      showScoreDecay: { rate: 5 },
    };

    expect(modifiers.showScoreDecay?.rate).toBe(5);
  });

  it('should support timer speed multiplier', () => {
    const modifiers: EnemyUIModifiers = {
      timerSpeedMultiplier: 1.2,
    };

    expect(modifiers.timerSpeedMultiplier).toBe(1.2);
  });

  it('should support hint disabling', () => {
    const modifiers: EnemyUIModifiers = {
      disableAutoHint: true,
      disableManualHint: false,
    };

    expect(modifiers.disableAutoHint).toBe(true);
    expect(modifiers.disableManualHint).toBe(false);
  });

  it('should support countdown cards display', () => {
    const modifiers: EnemyUIModifiers = {
      showCountdownCards: [
        { cardId: 'card-1', timeRemaining: 10 },
        { cardId: 'card-2', timeRemaining: 5 },
      ],
    };

    expect(modifiers.showCountdownCards?.length).toBe(2);
    expect(modifiers.showCountdownCards?.[0].timeRemaining).toBe(10);
  });

  it('should support bomb cards display', () => {
    const modifiers: EnemyUIModifiers = {
      showBombCards: [{ cardId: 'bomb-card', timeRemaining: 8 }],
    };

    expect(modifiers.showBombCards?.length).toBe(1);
    expect(modifiers.showBombCards?.[0].cardId).toBe('bomb-card');
  });

  it('should support weapon counters', () => {
    const modifiers: EnemyUIModifiers = {
      weaponCounters: [
        { type: 'fire', reduction: 15 },
        { type: 'explosion', reduction: 35 },
      ],
    };

    expect(modifiers.weaponCounters?.length).toBe(2);
    expect(modifiers.weaponCounters?.[0].type).toBe('fire');
    expect(modifiers.weaponCounters?.[0].reduction).toBe(15);
  });

  it('should support empty modifiers', () => {
    const modifiers: EnemyUIModifiers = {};
    expect(Object.keys(modifiers).length).toBe(0);
  });
});

describe('EnemyStatModifiers interface', () => {
  it('should support fire spread chance reduction', () => {
    const modifiers: EnemyStatModifiers = {
      fireSpreadChanceReduction: 15,
    };
    expect(modifiers.fireSpreadChanceReduction).toBe(15);
  });

  it('should support explosion chance reduction', () => {
    const modifiers: EnemyStatModifiers = {
      explosionChanceReduction: 35,
    };
    expect(modifiers.explosionChanceReduction).toBe(35);
  });

  it('should support laser chance reduction', () => {
    const modifiers: EnemyStatModifiers = {
      laserChanceReduction: 20,
    };
    expect(modifiers.laserChanceReduction).toBe(20);
  });

  it('should support hint gain chance reduction', () => {
    const modifiers: EnemyStatModifiers = {
      hintGainChanceReduction: 15,
    };
    expect(modifiers.hintGainChanceReduction).toBe(15);
  });

  it('should support grace gain chance reduction', () => {
    const modifiers: EnemyStatModifiers = {
      graceGainChanceReduction: 15,
    };
    expect(modifiers.graceGainChanceReduction).toBe(15);
  });

  it('should support time gain chance reduction', () => {
    const modifiers: EnemyStatModifiers = {
      timeGainChanceReduction: 20,
    };
    expect(modifiers.timeGainChanceReduction).toBe(20);
  });

  it('should support healing chance reduction', () => {
    const modifiers: EnemyStatModifiers = {
      healingChanceReduction: 10,
    };
    expect(modifiers.healingChanceReduction).toBe(10);
  });

  it('should support damage multiplier', () => {
    const modifiers: EnemyStatModifiers = {
      damageMultiplier: 2.0,
    };
    expect(modifiers.damageMultiplier).toBe(2.0);
  });

  it('should support points multiplier', () => {
    const modifiers: EnemyStatModifiers = {
      pointsMultiplier: 1.5,
    };
    expect(modifiers.pointsMultiplier).toBe(1.5);
  });

  it('should support multiple modifiers at once', () => {
    const modifiers: EnemyStatModifiers = {
      fireSpreadChanceReduction: 35,
      explosionChanceReduction: 35,
      damageMultiplier: 2.0,
    };
    expect(modifiers.fireSpreadChanceReduction).toBe(35);
    expect(modifiers.explosionChanceReduction).toBe(35);
    expect(modifiers.damageMultiplier).toBe(2.0);
  });

  it('should support empty modifiers', () => {
    const modifiers: EnemyStatModifiers = {};
    expect(Object.keys(modifiers).length).toBe(0);
  });
});

describe('EnemyEvent union type', () => {
  it('should support card_became_dud event', () => {
    const event: EnemyEvent = { type: 'card_became_dud', cardId: 'card-1' };
    expect(event.type).toBe('card_became_dud');
    expect(event.cardId).toBe('card-1');
  });

  it('should support card_became_facedown event', () => {
    const event: EnemyEvent = { type: 'card_became_facedown', cardId: 'card-1' };
    expect(event.type).toBe('card_became_facedown');
  });

  it('should support card_flipped event', () => {
    const event: EnemyEvent = { type: 'card_flipped', cardId: 'card-1' };
    expect(event.type).toBe('card_flipped');
  });

  it('should support attribute_changed event', () => {
    const event: EnemyEvent = {
      type: 'attribute_changed',
      cardIds: ['card-1', 'card-2'],
      attribute: 'color',
    };
    expect(event.type).toBe('attribute_changed');
    expect(event.cardIds.length).toBe(2);
    expect(event.attribute).toBe('color');
  });

  it('should support card_removed event', () => {
    const event: EnemyEvent = {
      type: 'card_removed',
      cardId: 'card-1',
      reason: 'enemy_effect',
    };
    expect(event.type).toBe('card_removed');
    expect(event.reason).toBe('enemy_effect');
  });

  it('should support positions_shuffled event', () => {
    const event: EnemyEvent = { type: 'positions_shuffled' };
    expect(event.type).toBe('positions_shuffled');
  });

  it('should support inactivity_warning event', () => {
    const event: EnemyEvent = {
      type: 'inactivity_warning',
      secondsRemaining: 5,
    };
    expect(event.type).toBe('inactivity_warning');
    expect(event.secondsRemaining).toBe(5);
  });

  it('should support inactivity_penalty event with damage', () => {
    const event: EnemyEvent = {
      type: 'inactivity_penalty',
      penalty: 'damage',
    };
    expect(event.type).toBe('inactivity_penalty');
    expect(event.penalty).toBe('damage');
  });

  it('should support inactivity_penalty event with death', () => {
    const event: EnemyEvent = {
      type: 'inactivity_penalty',
      penalty: 'death',
    };
    expect(event.penalty).toBe('death');
  });

  it('should support countdown_warning event', () => {
    const event: EnemyEvent = {
      type: 'countdown_warning',
      cardId: 'card-1',
      secondsRemaining: 3,
    };
    expect(event.type).toBe('countdown_warning');
  });

  it('should support countdown_expired event', () => {
    const event: EnemyEvent = {
      type: 'countdown_expired',
      cardId: 'card-1',
    };
    expect(event.type).toBe('countdown_expired');
  });

  it('should support bomb_placed event', () => {
    const event: EnemyEvent = {
      type: 'bomb_placed',
      cardId: 'card-1',
      timer: 10,
    };
    expect(event.type).toBe('bomb_placed');
    expect(event.timer).toBe(10);
  });

  it('should support bomb_exploded event', () => {
    const event: EnemyEvent = {
      type: 'bomb_exploded',
      cardId: 'card-1',
    };
    expect(event.type).toBe('bomb_exploded');
  });

  it('should support time_stolen event', () => {
    const event: EnemyEvent = {
      type: 'time_stolen',
      amount: 5,
    };
    expect(event.type).toBe('time_stolen');
    expect(event.amount).toBe(5);
  });
});

describe('RoundStats interface', () => {
  it('should have correct structure with all required fields', () => {
    const stats = createEmptyRoundStats();

    // Match tracking
    expect(stats.totalMatches).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(0);
    expect(stats.invalidMatches).toBe(0);

    // Timing
    expect(Array.isArray(stats.matchTimes)).toBe(true);
    expect(stats.timeRemaining).toBe(60);

    // Card tracking
    expect(stats.cardsRemaining).toBe(12);
    expect(stats.tripleCardsCleared).toBe(0);
    expect(stats.faceDownCardsMatched).toBe(0);
    expect(stats.bombsDefused).toBe(0);
    expect(stats.countdownCardsMatched).toBe(0);

    // Attribute tracking
    expect(stats.shapesMatched instanceof Set).toBe(true);
    expect(stats.colorsMatched instanceof Set).toBe(true);
    expect(stats.allDifferentMatches).toBe(0);
    expect(stats.allSameColorMatches).toBe(0);
    expect(stats.squiggleMatches).toBe(0);

    // Resource tracking
    expect(stats.gracesUsed).toBe(0);
    expect(stats.hintsUsed).toBe(0);
    expect(stats.hintsRemaining).toBe(3);
    expect(stats.gracesRemaining).toBe(3);
    expect(stats.damageReceived).toBe(0);
    expect(stats.weaponEffectsTriggered instanceof Set).toBe(true);

    // Score
    expect(stats.currentScore).toBe(0);
    expect(stats.targetScore).toBe(100);
  });

  it('should support tracking match times for defeat conditions', () => {
    const stats = createEmptyRoundStats();
    stats.matchTimes.push(3000, 4500, 2000); // 3s, 4.5s, 2s

    expect(stats.matchTimes.length).toBe(3);
    expect(stats.matchTimes[0]).toBe(3000);
  });

  it('should support tracking weapon effects triggered', () => {
    const stats = createEmptyRoundStats();
    stats.weaponEffectsTriggered.add('fire');
    stats.weaponEffectsTriggered.add('explosion');
    stats.weaponEffectsTriggered.add('laser');

    expect(stats.weaponEffectsTriggered.size).toBe(3);
    expect(stats.weaponEffectsTriggered.has('fire')).toBe(true);
  });

  it('should support tracking shapes matched', () => {
    const stats = createEmptyRoundStats();
    stats.shapesMatched.add('oval');
    stats.shapesMatched.add('diamond');

    expect(stats.shapesMatched.size).toBe(2);
    expect(stats.shapesMatched.has('squiggle')).toBe(false);
  });

  it('should support tracking colors matched', () => {
    const stats = createEmptyRoundStats();
    stats.colorsMatched.add('red');
    stats.colorsMatched.add('green');
    stats.colorsMatched.add('purple');

    expect(stats.colorsMatched.size).toBe(3);
  });
});
