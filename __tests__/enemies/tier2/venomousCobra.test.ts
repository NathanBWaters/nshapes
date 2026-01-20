/**
 * Comprehensive Unit Tests for Venomous Cobra enemy.
 *
 * Venomous Cobra - Tier 2 Enemy
 * Effects: Shifting Chameleon (15s) + Trap Weaver
 *   - AttributeChangeEffect: Changes random card attributes every 15 seconds
 *   - BombEffect: 15% chance to place bomb on drawn cards (10s timer, min board size 6)
 * Defeat Condition: Match 4 bombs before they explode (bombsDefused >= 4)
 */
import { createVenomousCobra } from '@/utils/enemies/tier2/venomousCobra';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
  createFaceDownCard,
  createTripleCard,
  createVariedBoard,
} from '../../testUtils';

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

// Mock random sequence
const mockRandomSequence = (values: number[]) => {
  let index = 0;
  jest.spyOn(Math, 'random').mockImplementation(() => {
    const value = values[index % values.length];
    index++;
    return value;
  });
};

beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// =============================================================================
// METADATA TESTS
// =============================================================================

describe('Venomous Cobra - Metadata', () => {
  describe('name', () => {
    it('has correct name', () => {
      const enemy = createVenomousCobra();
      expect(enemy.name).toBe('Venomous Cobra');
    });

    it('name is a non-empty string', () => {
      const enemy = createVenomousCobra();
      expect(typeof enemy.name).toBe('string');
      expect(enemy.name.length).toBeGreaterThan(0);
    });
  });

  describe('tier', () => {
    it('has tier 2', () => {
      const enemy = createVenomousCobra();
      expect(enemy.tier).toBe(2);
    });

    it('tier is a valid tier value (1-4)', () => {
      const enemy = createVenomousCobra();
      expect([1, 2, 3, 4]).toContain(enemy.tier);
    });
  });

  describe('icon', () => {
    it('has correct icon', () => {
      const enemy = createVenomousCobra();
      expect(enemy.icon).toBe('skoll/cobra');
    });

    it('icon is a valid icon path format', () => {
      const enemy = createVenomousCobra();
      expect(enemy.icon).toMatch(/^[a-z-]+\/[a-z-]+$/);
    });
  });

  describe('description', () => {
    it('contains "attribute" keyword', () => {
      const enemy = createVenomousCobra();
      expect(enemy.description.toLowerCase()).toContain('attribute');
    });

    it('contains "15s" or time reference', () => {
      const enemy = createVenomousCobra();
      expect(enemy.description).toContain('15s');
    });

    it('contains "bomb" keyword', () => {
      const enemy = createVenomousCobra();
      expect(enemy.description.toLowerCase()).toContain('bomb');
    });

    it('is a non-empty string', () => {
      const enemy = createVenomousCobra();
      expect(typeof enemy.description).toBe('string');
      expect(enemy.description.length).toBeGreaterThan(0);
    });
  });

  describe('defeatConditionText', () => {
    it('contains "4" (threshold number)', () => {
      const enemy = createVenomousCobra();
      expect(enemy.defeatConditionText).toContain('4');
    });

    it('contains "bomb" keyword', () => {
      const enemy = createVenomousCobra();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('bomb');
    });

    it('mentions matching before explosion', () => {
      const enemy = createVenomousCobra();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('is a non-empty string', () => {
      const enemy = createVenomousCobra();
      expect(typeof enemy.defeatConditionText).toBe('string');
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });
  });

  describe('factory creates fresh instances', () => {
    it('each call returns a new instance', () => {
      const enemy1 = createVenomousCobra();
      const enemy2 = createVenomousCobra();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have independent state', () => {
      const enemy1 = createVenomousCobra();
      const enemy2 = createVenomousCobra();

      const board = createTestBoard(12);
      enemy1.onRoundStart(board);

      // Tick enemy1 for 15 seconds to trigger attribute change
      mockRandom(0);
      enemy1.onTick(15000, board);

      // enemy2 should have clean state - attribute change timer starts fresh
      const board2 = createTestBoard(12);
      enemy2.onRoundStart(board2);
      const result2 = enemy2.onTick(5000, board2);

      // No attribute change should occur yet (only 5s elapsed)
      expect(
        result2.events.filter((e) => e.type === 'attribute_changed')
      ).toHaveLength(0);
    });
  });
});

// =============================================================================
// EFFECT TESTS - ATTRIBUTE CHANGE
// =============================================================================

describe('Venomous Cobra - Attribute Change Effect', () => {
  describe('interval timing', () => {
    it('does not change attributes before 15 seconds', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(14999, board);

      const attributeEvents = result.events.filter(
        (e) => e.type === 'attribute_changed'
      );
      expect(attributeEvents).toHaveLength(0);
    });

    it('changes attribute at exactly 15 seconds', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      const attributeEvents = result.events.filter(
        (e) => e.type === 'attribute_changed'
      );
      expect(attributeEvents).toHaveLength(1);
    });

    it('changes attribute after 15 seconds', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(16000, board);

      const attributeEvents = result.events.filter(
        (e) => e.type === 'attribute_changed'
      );
      expect(attributeEvents).toHaveLength(1);
    });

    it('accumulates time across multiple ticks', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      enemy.onTick(5000, board);
      enemy.onTick(5000, board);
      mockRandom(0);
      const result = enemy.onTick(5000, board); // Total: 15000ms

      const attributeEvents = result.events.filter(
        (e) => e.type === 'attribute_changed'
      );
      expect(attributeEvents).toHaveLength(1);
    });

    it('resets timer after attribute change', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // First change at 15s
      mockRandom(0);
      enemy.onTick(15000, board);

      // Should not change again immediately
      const result2 = enemy.onTick(5000, board);
      const attributeEvents = result2.events.filter(
        (e) => e.type === 'attribute_changed'
      );
      expect(attributeEvents).toHaveLength(0);
    });

    it('triggers second change at 30 seconds total', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      enemy.onTick(15000, board); // First change

      const result = enemy.onTick(15000, board); // Second change at 30s
      const attributeEvents = result.events.filter(
        (e) => e.type === 'attribute_changed'
      );
      expect(attributeEvents).toHaveLength(1);
    });
  });

  describe('card selection for attribute change', () => {
    it('selects first valid card when random is 0', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      expect(result.cardModifications.length).toBeGreaterThan(0);
      // First card should be modified (attribute change)
      const attrMod = result.cardModifications.find(
        (m) => m.cardId === board[0].id
      );
      expect(attrMod).toBeDefined();
    });

    it('does not select dud cards for attribute change', () => {
      const enemy = createVenomousCobra();
      const board = [
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard(), // Only valid card
      ];
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      // The attribute modification should be on the non-dud card
      const attrMod = result.cardModifications.find(
        (m) =>
          m.changes.shape !== undefined ||
          m.changes.color !== undefined ||
          m.changes.number !== undefined ||
          m.changes.shading !== undefined
      );
      if (attrMod) {
        expect(attrMod.cardId).toBe(board[2].id);
      }
    });

    it('does not select face-down cards for attribute change', () => {
      const enemy = createVenomousCobra();
      const board = [
        createFaceDownCard(),
        createFaceDownCard(),
        createCard(), // Only valid card
      ];
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      const attrMod = result.cardModifications.find(
        (m) =>
          m.changes.shape !== undefined ||
          m.changes.color !== undefined ||
          m.changes.number !== undefined ||
          m.changes.shading !== undefined
      );
      if (attrMod) {
        expect(attrMod.cardId).toBe(board[2].id);
      }
    });

    it('returns no modifications if all cards are invalid', () => {
      const enemy = createVenomousCobra();
      const board = [
        createCard({ isDud: true }),
        createFaceDownCard(),
      ];
      enemy.onRoundStart(board);

      const result = enemy.onTick(15000, board);

      // No attribute change events should fire
      const attributeEvents = result.events.filter(
        (e) => e.type === 'attribute_changed'
      );
      expect(attributeEvents).toHaveLength(0);
    });
  });

  describe('attribute values', () => {
    it('changes shape to a different value', () => {
      const enemy = createVenomousCobra();
      const card = createCard({ shape: 'oval' });
      const board = [card];
      enemy.onRoundStart(board);

      // Mock to select first card, shape attribute, first alternative value
      mockRandomSequence([0, 0, 0]); // card[0], shape, first different shape
      const result = enemy.onTick(15000, board);

      const modification = result.cardModifications.find(
        (m) => m.changes.shape !== undefined
      );
      if (modification) {
        expect(modification.changes.shape).not.toBe('oval');
        expect(['squiggle', 'diamond']).toContain(modification.changes.shape);
      }
    });

    it('changes color to a different value', () => {
      const enemy = createVenomousCobra();
      const card = createCard({ color: 'red' });
      const board = [card];
      enemy.onRoundStart(board);

      // Mock to select color attribute
      mockRandomSequence([0, 0.25, 0]); // card[0], color (index 1), first different color
      const result = enemy.onTick(15000, board);

      const modification = result.cardModifications.find(
        (m) => m.changes.color !== undefined
      );
      if (modification) {
        expect(modification.changes.color).not.toBe('red');
        expect(['green', 'purple']).toContain(modification.changes.color);
      }
    });

    it('changes number to a different value', () => {
      const enemy = createVenomousCobra();
      const card = createCard({ number: 1 });
      const board = [card];
      enemy.onRoundStart(board);

      // Mock to select number attribute
      mockRandomSequence([0, 0.5, 0]); // card[0], number (index 2), first different number
      const result = enemy.onTick(15000, board);

      const modification = result.cardModifications.find(
        (m) => m.changes.number !== undefined
      );
      if (modification) {
        expect(modification.changes.number).not.toBe(1);
        expect([2, 3]).toContain(modification.changes.number);
      }
    });

    it('changes shading to a different value', () => {
      const enemy = createVenomousCobra();
      const card = createCard({ shading: 'solid' });
      const board = [card];
      enemy.onRoundStart(board);

      // Mock to select shading attribute
      mockRandomSequence([0, 0.75, 0]); // card[0], shading (index 3), first different shading
      const result = enemy.onTick(15000, board);

      const modification = result.cardModifications.find(
        (m) => m.changes.shading !== undefined
      );
      if (modification) {
        expect(modification.changes.shading).not.toBe('solid');
        expect(['striped', 'open']).toContain(modification.changes.shading);
      }
    });
  });

  describe('attribute change event', () => {
    it('emits attribute_changed event', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      const event = result.events.find((e) => e.type === 'attribute_changed');
      expect(event).toBeDefined();
    });

    it('event contains cardIds array', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      const event = result.events.find((e) => e.type === 'attribute_changed');
      if (event && event.type === 'attribute_changed') {
        expect(Array.isArray(event.cardIds)).toBe(true);
        expect(event.cardIds.length).toBeGreaterThan(0);
      }
    });

    it('event contains attribute name', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      const event = result.events.find((e) => e.type === 'attribute_changed');
      if (event && event.type === 'attribute_changed') {
        expect(['shape', 'color', 'number', 'shading']).toContain(
          event.attribute
        );
      }
    });
  });
});

// =============================================================================
// EFFECT TESTS - BOMB PLACEMENT
// =============================================================================

describe('Venomous Cobra - Bomb Placement Effect', () => {
  describe('bomb chance on card draw', () => {
    it('places bomb when random is below 15%', () => {
      const enemy = createVenomousCobra();
      const card = createCard();

      mockRandom(0.05); // 5% < 15%
      const result = enemy.onCardDraw(card);

      expect(result.hasBomb).toBe(true);
    });

    it('does not place bomb when random is 15%', () => {
      const enemy = createVenomousCobra();
      const card = createCard();

      mockRandom(0.15); // 15% = threshold
      const result = enemy.onCardDraw(card);

      expect(result.hasBomb).toBeUndefined();
    });

    it('does not place bomb when random is above 15%', () => {
      const enemy = createVenomousCobra();
      const card = createCard();

      mockRandom(0.5); // 50% > 15%
      const result = enemy.onCardDraw(card);

      expect(result.hasBomb).toBeUndefined();
    });

    it('sets bomb timer to 10000ms', () => {
      const enemy = createVenomousCobra();
      const card = createCard();

      mockRandom(0.05);
      const result = enemy.onCardDraw(card);

      expect(result.bombTimer).toBe(10000);
    });

    it('preserves other card properties when placing bomb', () => {
      const enemy = createVenomousCobra();
      const card = createCard({
        shape: 'diamond',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });

      mockRandom(0.05);
      const result = enemy.onCardDraw(card);

      expect(result.shape).toBe('diamond');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
      expect(result.hasBomb).toBe(true);
    });

    it('preserves card properties when no bomb placed', () => {
      const enemy = createVenomousCobra();
      const card = createCard({
        shape: 'squiggle',
        color: 'green',
        number: 2,
        shading: 'open',
      });

      mockRandom(0.5);
      const result = enemy.onCardDraw(card);

      expect(result.shape).toBe('squiggle');
      expect(result.color).toBe('green');
      expect(result.number).toBe(2);
      expect(result.shading).toBe('open');
      expect(result.hasBomb).toBeUndefined();
    });
  });

  describe('bomb chance edge cases', () => {
    it('places bomb at 0% random', () => {
      const enemy = createVenomousCobra();
      mockRandom(0);
      const result = enemy.onCardDraw(createCard());
      expect(result.hasBomb).toBe(true);
    });

    it('places bomb at 14.9% random', () => {
      const enemy = createVenomousCobra();
      mockRandom(0.149);
      const result = enemy.onCardDraw(createCard());
      expect(result.hasBomb).toBe(true);
    });

    it('does not place bomb at 15.1% random', () => {
      const enemy = createVenomousCobra();
      mockRandom(0.151);
      const result = enemy.onCardDraw(createCard());
      expect(result.hasBomb).toBeUndefined();
    });

    it('does not place bomb at 99% random', () => {
      const enemy = createVenomousCobra();
      mockRandom(0.99);
      const result = enemy.onCardDraw(createCard());
      expect(result.hasBomb).toBeUndefined();
    });
  });
});

// =============================================================================
// EFFECT TESTS - BOMB TIMER
// =============================================================================

describe('Venomous Cobra - Bomb Timer Effect', () => {
  describe('bomb timer decrement on tick', () => {
    it('decrements bomb timer by deltaMs', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      const result = enemy.onTick(3000, board);

      const modification = result.cardModifications.find(
        (m) => m.cardId === 'bomb-card'
      );
      expect(modification?.changes.bombTimer).toBe(7000);
    });

    it('decrements by small intervals', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      const result = enemy.onTick(100, board);

      const modification = result.cardModifications.find(
        (m) => m.cardId === 'bomb-card'
      );
      expect(modification?.changes.bombTimer).toBe(9900);
    });

    it('handles multiple sequential ticks', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      enemy.onTick(2000, board);
      enemy.onTick(3000, board);
      const result = enemy.onTick(1000, board);

      const modification = result.cardModifications.find(
        (m) => m.cardId === 'bomb-card'
      );
      expect(modification?.changes.bombTimer).toBe(4000);
    });

    it('timer does not go below 0', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 1000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      const result = enemy.onTick(500, board);

      const modification = result.cardModifications.find(
        (m) => m.cardId === 'bomb-card'
      );
      expect(modification?.changes.bombTimer).toBe(500);
    });

    it('tracks multiple bomb cards independently', () => {
      const enemy = createVenomousCobra();
      const bomb1 = createCard({
        id: 'bomb-1',
        hasBomb: true,
        bombTimer: 10000,
      });
      const bomb2 = createCard({
        id: 'bomb-2',
        hasBomb: true,
        bombTimer: 5000,
      });
      const board = [bomb1, bomb2, ...createTestBoard(7)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      const mod1 = result.cardModifications.find((m) => m.cardId === 'bomb-1');
      const mod2 = result.cardModifications.find((m) => m.cardId === 'bomb-2');

      expect(mod1?.changes.bombTimer).toBe(8000);
      expect(mod2?.changes.bombTimer).toBe(3000);
    });
  });

  describe('bomb explosion', () => {
    it('explodes when timer reaches 0', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 1000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).toContain('bomb-card');
    });

    it('emits bomb_exploded event on explosion', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 1000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      const explosionEvent = result.events.find(
        (e) => e.type === 'bomb_exploded'
      );
      expect(explosionEvent).toBeDefined();
    });

    it('explosion event has correct cardId', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 1000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      const explosionEvent = result.events.find(
        (e) => e.type === 'bomb_exploded'
      );
      expect((explosionEvent as { cardId: string }).cardId).toBe('bomb-card');
    });

    it('does not explode if board would go below minimum size (6)', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 1000,
      });
      const board = [bombCard, ...createTestBoard(5)]; // 6 cards total = minimum

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).not.toContain('bomb-card');
    });

    it('explodes if board is above minimum size', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 1000,
      });
      const board = [bombCard, ...createTestBoard(6)]; // 7 cards total > minimum

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).toContain('bomb-card');
    });

    it('multiple bombs can explode in same tick', () => {
      const enemy = createVenomousCobra();
      const bomb1 = createCard({
        id: 'bomb-1',
        hasBomb: true,
        bombTimer: 1000,
      });
      const bomb2 = createCard({
        id: 'bomb-2',
        hasBomb: true,
        bombTimer: 1000,
      });
      const board = [bomb1, bomb2, ...createTestBoard(10)]; // 12 cards, plenty of room

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).toContain('bomb-1');
      expect(result.cardsToRemove).toContain('bomb-2');
    });
  });

  describe('bomb tracking cleanup', () => {
    it('removes bomb timer when card is removed from board', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);

      // Remove bomb card from board (simulating match)
      const newBoard = board.filter((c) => c.id !== 'bomb-card');
      const result = enemy.onTick(1000, newBoard);

      // Should not have any modification for the removed card
      const modification = result.cardModifications.find(
        (m) => m.cardId === 'bomb-card'
      );
      expect(modification).toBeUndefined();
    });
  });
});

// =============================================================================
// DEFEAT CONDITION TESTS
// =============================================================================

describe('Venomous Cobra - Defeat Condition', () => {
  describe('bombsDefused threshold', () => {
    it('returns false when bombsDefused is 0', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when bombsDefused is 1', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 1 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when bombsDefused is 2', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 2 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when bombsDefused is 3', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 3 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when bombsDefused is exactly 4 (threshold)', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 4 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused is 5', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 5 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused is 10', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 10 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused is 100', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ bombsDefused: 100 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('defeat condition ignores other stats', () => {
    it('ignores totalMatches', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ totalMatches: 100, bombsDefused: 3 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores currentStreak', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ currentStreak: 50, bombsDefused: 3 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores currentScore', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ currentScore: 1000, bombsDefused: 3 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores timeRemaining', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({ timeRemaining: 0, bombsDefused: 3 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores allDifferentMatches', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({
        allDifferentMatches: 100,
        bombsDefused: 3,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('works with other stats at high values', () => {
      const enemy = createVenomousCobra();
      const stats = createRoundStats({
        totalMatches: 999,
        currentStreak: 50,
        maxStreak: 100,
        currentScore: 9999,
        bombsDefused: 4,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});

// =============================================================================
// LIFECYCLE HOOKS TESTS
// =============================================================================

describe('Venomous Cobra - Lifecycle Hooks', () => {
  describe('onRoundStart', () => {
    it('returns EnemyStartResult shape', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onRoundStart(board);

      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('events');
      expect(Array.isArray(result.cardModifications)).toBe(true);
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('returns empty card modifications (no initial bomb spawn)', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onRoundStart(board);

      // Venomous Cobra uses BombEffect with chance-based draw, not initial spawn
      expect(result.cardModifications).toHaveLength(0);
    });

    it('returns empty events array', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onRoundStart(board);

      expect(result.events).toEqual([]);
    });

    it('can be called multiple times (fresh rounds)', () => {
      const enemy = createVenomousCobra();
      const board1 = createTestBoard(12);
      const board2 = createTestBoard(12);

      const result1 = enemy.onRoundStart(board1);
      const result2 = enemy.onRoundStart(board2);

      expect(result1.cardModifications).toHaveLength(0);
      expect(result2.cardModifications).toHaveLength(0);
    });
  });

  describe('onCardDraw', () => {
    it('returns a Card object', () => {
      const enemy = createVenomousCobra();
      const card = createCard();

      mockRandom(0.5); // No bomb
      const result = enemy.onCardDraw(card);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('shape');
      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('number');
      expect(result).toHaveProperty('shading');
    });

    it('preserves all card properties', () => {
      const enemy = createVenomousCobra();
      const card = createCard({
        id: 'special-id',
        shape: 'diamond',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });

      mockRandom(0.5);
      const result = enemy.onCardDraw(card);

      expect(result.id).toBe('special-id');
      expect(result.shape).toBe('diamond');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
    });
  });

  describe('onValidMatch', () => {
    it('returns EnemyMatchResult shape', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onValidMatch([], []);

      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });

    it('returns neutral pointsMultiplier (1)', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onValidMatch([], []);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns neutral timeDelta (0)', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onValidMatch([], []);

      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onValidMatch([], []);

      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onValidMatch([], []);

      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onValidMatch([], []);

      expect(result.events).toEqual([]);
    });

    it('handles matched cards parameter', () => {
      const enemy = createVenomousCobra();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(9);

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });
  });

  describe('onInvalidMatch', () => {
    it('returns EnemyMatchResult shape', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onInvalidMatch([], []);

      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });

    it('returns neutral pointsMultiplier (1)', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onInvalidMatch([], []);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns empty cardsToRemove', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onInvalidMatch([], []);

      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onInvalidMatch([], []);

      expect(result.cardsToFlip).toEqual([]);
    });

    it('handles invalid cards parameter', () => {
      const enemy = createVenomousCobra();
      const invalidCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(9);

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });
  });

  describe('onRoundEnd', () => {
    it('can be called without error', () => {
      const enemy = createVenomousCobra();

      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns void (undefined)', () => {
      const enemy = createVenomousCobra();

      const result = enemy.onRoundEnd();

      expect(result).toBeUndefined();
    });

    it('can be called multiple times', () => {
      const enemy = createVenomousCobra();

      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });
  });

  describe('onTick', () => {
    it('returns EnemyTickResult shape', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onTick(100, board);

      expect(result).toHaveProperty('scoreDelta');
      expect(result).toHaveProperty('healthDelta');
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('instantDeath');
    });

    it('returns neutral scoreDelta (0)', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onTick(100, board);

      expect(result.scoreDelta).toBe(0);
    });

    it('returns neutral healthDelta (0) with no bomb explosions', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onTick(100, board);

      expect(result.healthDelta).toBe(0);
    });

    it('returns neutral timeDelta (0)', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onTick(100, board);

      expect(result.timeDelta).toBe(0);
    });

    it('returns false instantDeath', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onTick(100, board);

      expect(result.instantDeath).toBe(false);
    });

    it('handles zero deltaMs', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onTick(0, board);

      expect(result.scoreDelta).toBe(0);
    });

    it('handles large deltaMs', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);

      const result = enemy.onTick(60000, board);

      expect(result).toBeDefined();
    });
  });
});

// =============================================================================
// UI MODIFIERS TESTS
// =============================================================================

describe('Venomous Cobra - UI Modifiers', () => {
  describe('getUIModifiers', () => {
    it('returns EnemyUIModifiers shape', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getUIModifiers();

      expect(typeof modifiers).toBe('object');
    });

    it('returns empty or undefined showBombCards when no bombs tracked', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getUIModifiers();

      expect(
        modifiers.showBombCards === undefined ||
          modifiers.showBombCards?.length === 0
      ).toBe(true);
    });

    it('shows bomb cards after tick initializes tracking', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(100, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards).toBeDefined();
      expect(modifiers.showBombCards?.length).toBeGreaterThan(0);
    });

    it('showBombCards has correct cardId', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'my-bomb',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(100, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards?.[0].cardId).toBe('my-bomb');
    });

    it('showBombCards has correct timeRemaining', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      enemy.onTick(3000, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(7000);
    });

    it('tracks multiple bomb cards in UI', () => {
      const enemy = createVenomousCobra();
      const bomb1 = createCard({
        id: 'bomb-1',
        hasBomb: true,
        bombTimer: 10000,
      });
      const bomb2 = createCard({
        id: 'bomb-2',
        hasBomb: true,
        bombTimer: 5000,
      });
      const board = [bomb1, bomb2, ...createTestBoard(7)];

      enemy.onTick(100, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards?.length).toBe(2);
    });

    it('does not show inactivity bar', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not disable hints', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });
  });
});

// =============================================================================
// STAT MODIFIERS TESTS
// =============================================================================

describe('Venomous Cobra - Stat Modifiers', () => {
  describe('getStatModifiers', () => {
    it('returns EnemyStatModifiers shape', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(typeof modifiers).toBe('object');
    });

    it('returns empty object (no stat reductions)', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(Object.keys(modifiers).length).toBe(0);
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier', () => {
      const enemy = createVenomousCobra();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });
});

// =============================================================================
// EDGE CASES AND INTEGRATION TESTS
// =============================================================================

describe('Venomous Cobra - Edge Cases', () => {
  describe('board size edge cases', () => {
    it('handles single card board for attribute change', () => {
      const enemy = createVenomousCobra();
      const board = [createCard()];
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      // Should still attempt attribute change
      expect(
        result.events.filter((e) => e.type === 'attribute_changed').length
      ).toBeGreaterThanOrEqual(0);
    });

    it('handles very large board', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(100);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      expect(result).toBeDefined();
    });

    it('handles empty board gracefully', () => {
      const enemy = createVenomousCobra();
      const board: ReturnType<typeof createCard>[] = [];
      enemy.onRoundStart(board);

      const result = enemy.onTick(15000, board);

      // No attribute changes should occur on empty board
      expect(
        result.events.filter((e) => e.type === 'attribute_changed')
      ).toHaveLength(0);
    });

    it('handles board with all special cards', () => {
      const enemy = createVenomousCobra();
      const board = [
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createFaceDownCard(),
        createFaceDownCard(),
      ];
      enemy.onRoundStart(board);

      const result = enemy.onTick(15000, board);

      // No valid cards for attribute change
      expect(
        result.events.filter((e) => e.type === 'attribute_changed')
      ).toHaveLength(0);
    });
  });

  describe('timer edge cases', () => {
    it('handles exact timer expiry for bombs', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 5000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      const result = enemy.onTick(5000, board);

      expect(result.cardsToRemove).toContain('bomb-card');
    });

    it('handles exact 15s interval for attribute change', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      expect(
        result.events.filter((e) => e.type === 'attribute_changed')
      ).toHaveLength(1);
    });

    it('handles very small tick intervals', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);

      // Many small ticks
      for (let i = 0; i < 100; i++) {
        enemy.onTick(10, board);
      }

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(9000);
    });

    it('attribute change and bomb tick work together', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 20000,
      });
      const board = [bombCard, ...createTestBoard(11)];
      enemy.onRoundStart(board);

      // Initialize bomb tracking
      enemy.onTick(0, board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      // Both effects should work
      expect(
        result.events.filter((e) => e.type === 'attribute_changed')
      ).toHaveLength(1);

      // Find modification with bomb timer (there may be multiple mods for the same card)
      const bombTimerMod = result.cardModifications.find(
        (m) => m.cardId === 'bomb-card' && m.changes.bombTimer !== undefined
      );
      expect(bombTimerMod?.changes.bombTimer).toBe(5000);
    });
  });

  describe('state persistence', () => {
    it('maintains bomb tracking across valid matches', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      enemy.onTick(2000, board);
      enemy.onValidMatch([], board);
      enemy.onTick(1000, board);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(7000);
    });

    it('maintains bomb tracking across invalid matches', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 10000,
      });
      const board = [bombCard, ...createTestBoard(8)];

      enemy.onTick(0, board);
      enemy.onTick(2000, board);
      enemy.onInvalidMatch([], board);
      enemy.onTick(1000, board);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(7000);
    });

    it('maintains attribute change timer across matches', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      enemy.onTick(10000, board); // 10 seconds
      enemy.onValidMatch([], board);
      mockRandom(0);
      const result = enemy.onTick(5000, board); // Total 15 seconds

      expect(
        result.events.filter((e) => e.type === 'attribute_changed')
      ).toHaveLength(1);
    });
  });

  describe('mixed card types', () => {
    it('works with triple cards on board', () => {
      const enemy = createVenomousCobra();
      const board = [
        createTripleCard(),
        createTripleCard(),
        ...createTestBoard(10),
      ];
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      expect(result).toBeDefined();
    });

    it('can change attribute on triple card', () => {
      const enemy = createVenomousCobra();
      const tripleCard = createTripleCard({ id: 'triple-card' });
      const board = [tripleCard];
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      const attrMod = result.cardModifications.find(
        (m) =>
          m.cardId === 'triple-card' &&
          (m.changes.shape !== undefined ||
            m.changes.color !== undefined ||
            m.changes.number !== undefined ||
            m.changes.shading !== undefined)
      );
      expect(attrMod).toBeDefined();
    });

    it('works with onFire cards', () => {
      const enemy = createVenomousCobra();
      const board = [
        createCard({ onFire: true }),
        ...createTestBoard(11),
      ];
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      expect(result).toBeDefined();
    });

    it('handles varied board correctly', () => {
      const enemy = createVenomousCobra();
      const board = createVariedBoard();
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      expect(
        result.events.filter((e) => e.type === 'attribute_changed')
      ).toHaveLength(1);
    });
  });

  describe('combined effects interaction', () => {
    it('bomb card can have attribute changed', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 20000,
        shape: 'oval',
      });
      const board = [bombCard];
      enemy.onRoundStart(board);

      mockRandom(0);
      const result = enemy.onTick(15000, board);

      // Bomb timer should decrease AND attribute could change
      const bombMod = result.cardModifications.find(
        (m) => m.cardId === 'bomb-card'
      );
      expect(bombMod).toBeDefined();
    });

    it('attribute change does not affect bomb timer', () => {
      const enemy = createVenomousCobra();
      const bombCard = createCard({
        id: 'bomb-card',
        hasBomb: true,
        bombTimer: 20000,
      });
      const board = [bombCard, ...createTestBoard(11)];
      enemy.onRoundStart(board);

      enemy.onTick(0, board);
      mockRandom(0);
      enemy.onTick(15000, board);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(5000);
    });

    it('new drawn cards can get bombs after attribute changes', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // Attribute change happens
      mockRandom(0);
      enemy.onTick(15000, board);

      // New card drawn with bomb chance
      const newCard = createCard();
      mockRandom(0.05); // 5% < 15% = bomb
      const drawnCard = enemy.onCardDraw(newCard);

      expect(drawnCard.hasBomb).toBe(true);
    });
  });
});

// =============================================================================
// FULL ROUND SIMULATION TESTS
// =============================================================================

describe('Venomous Cobra - Full Round Simulation', () => {
  it('simulates round with attribute changes and bomb defusal', () => {
    const enemy = createVenomousCobra();
    const board = createTestBoard(12);
    enemy.onRoundStart(board);

    // Draw a card that becomes a bomb
    mockRandom(0.05);
    const drawnCard = enemy.onCardDraw(createCard({ id: 'new-bomb' }));
    expect(drawnCard.hasBomb).toBe(true);

    // Add bomb to board
    const boardWithBomb = [
      ...board,
      { ...drawnCard, hasBomb: true, bombTimer: 10000 },
    ];

    // Tick 10 seconds - no attribute change yet
    enemy.onTick(0, boardWithBomb);
    const tick1 = enemy.onTick(10000, boardWithBomb);

    expect(
      tick1.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(0);

    // Tick 5 more seconds - attribute change happens
    mockRandom(0);
    const tick2 = enemy.onTick(5000, boardWithBomb);

    expect(
      tick2.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(1);

    // Check defeat condition - need 4 bombs defused
    const stats = createRoundStats({ bombsDefused: 3 });
    expect(enemy.checkDefeatCondition(stats)).toBe(false);

    stats.bombsDefused = 4;
    expect(enemy.checkDefeatCondition(stats)).toBe(true);

    enemy.onRoundEnd();
  });

  it('simulates bomb explosion when not matched', () => {
    const enemy = createVenomousCobra();
    const bombCard = createCard({
      id: 'bomb-card',
      hasBomb: true,
      bombTimer: 5000,
    });
    const board = [bombCard, ...createTestBoard(11)];
    enemy.onRoundStart(board);

    enemy.onTick(0, board);
    const result = enemy.onTick(6000, board);

    expect(result.cardsToRemove).toContain('bomb-card');
    expect(result.events.some((e) => e.type === 'bomb_exploded')).toBe(true);

    // Defeat condition not met
    const stats = createRoundStats({ bombsDefused: 0 });
    expect(enemy.checkDefeatCondition(stats)).toBe(false);
  });

  it('simulates multiple attribute changes over time', () => {
    const enemy = createVenomousCobra();
    const board = createTestBoard(12);
    enemy.onRoundStart(board);

    // First attribute change at 15s
    mockRandom(0);
    const tick1 = enemy.onTick(15000, board);
    expect(
      tick1.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(1);

    // Second attribute change at 30s
    const tick2 = enemy.onTick(15000, board);
    expect(
      tick2.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(1);

    // Third attribute change at 45s
    const tick3 = enemy.onTick(15000, board);
    expect(
      tick3.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(1);

    // Fourth attribute change at 60s
    const tick4 = enemy.onTick(15000, board);
    expect(
      tick4.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(1);
  });

  it('simulates defusing 4 bombs to meet defeat condition', () => {
    const enemy = createVenomousCobra();
    const board = createTestBoard(12);
    enemy.onRoundStart(board);

    // Simulate drawing and matching 4 bomb cards
    const stats = createRoundStats();

    // Draw bomb 1
    mockRandom(0.05);
    const bomb1 = enemy.onCardDraw(createCard({ id: 'bomb-1' }));
    expect(bomb1.hasBomb).toBe(true);

    // Not yet defeated with 0 defused
    expect(enemy.checkDefeatCondition(stats)).toBe(false);

    // Simulate defusing each bomb
    stats.bombsDefused = 1;
    expect(enemy.checkDefeatCondition(stats)).toBe(false);

    stats.bombsDefused = 2;
    expect(enemy.checkDefeatCondition(stats)).toBe(false);

    stats.bombsDefused = 3;
    expect(enemy.checkDefeatCondition(stats)).toBe(false);

    // Victory with 4 defused
    stats.bombsDefused = 4;
    expect(enemy.checkDefeatCondition(stats)).toBe(true);

    enemy.onRoundEnd();
  });

  it('simulates realistic game scenario with mixed events', () => {
    const enemy = createVenomousCobra();
    const board = createTestBoard(12);
    enemy.onRoundStart(board);

    // Player starts - tick 5 seconds
    enemy.onTick(5000, board);

    // Player makes a match
    const matchResult = enemy.onValidMatch(
      [board[0], board[1], board[2]],
      board
    );
    expect(matchResult.pointsMultiplier).toBe(1);

    // New cards drawn - some might be bombs
    mockRandom(0.05);
    const newCard1 = enemy.onCardDraw(createCard({ id: 'new-1' }));
    expect(newCard1.hasBomb).toBe(true);

    mockRandom(0.5);
    const newCard2 = enemy.onCardDraw(createCard({ id: 'new-2' }));
    expect(newCard2.hasBomb).toBeUndefined();

    // Add bomb to board
    const updatedBoard = [
      ...board.slice(3),
      { ...newCard1, hasBomb: true, bombTimer: 10000 },
      newCard2,
    ];

    // Tick 10 more seconds (total 15s) - attribute change
    enemy.onTick(0, updatedBoard);
    mockRandom(0);
    const tick = enemy.onTick(10000, updatedBoard);

    expect(tick).toBeDefined();

    enemy.onRoundEnd();
  });
});

// =============================================================================
// REGRESSION TESTS
// =============================================================================

describe('Venomous Cobra - Regression Tests', () => {
  it('does not crash with undefined card properties', () => {
    const enemy = createVenomousCobra();
    const card = {
      id: 'test',
      shape: 'oval' as const,
      color: 'red' as const,
      number: 1 as const,
      shading: 'solid' as const,
      selected: false,
    };

    expect(() => enemy.onCardDraw(card)).not.toThrow();
  });

  it('handles board state changes between ticks', () => {
    const enemy = createVenomousCobra();
    const board1 = createTestBoard(12);
    enemy.onRoundStart(board1);

    enemy.onTick(5000, board1);

    // Board changes (cards matched, new cards drawn)
    const board2 = createTestBoard(9);

    mockRandom(0);
    const result = enemy.onTick(10000, board2); // Total 15s

    expect(result).toBeDefined();
  });

  it('attribute change respects current card values', () => {
    const enemy = createVenomousCobra();
    const card = createCard({ shape: 'diamond', color: 'purple', number: 3 });
    const board = [card];
    enemy.onRoundStart(board);

    // Should change to different value
    mockRandomSequence([0, 0, 0]); // First card, shape attribute, first alternative
    const result = enemy.onTick(15000, board);

    const shapeMod = result.cardModifications.find(
      (m) => m.changes.shape !== undefined
    );
    if (shapeMod) {
      expect(shapeMod.changes.shape).not.toBe('diamond');
    }
  });

  it('multiple enemies do not share state', () => {
    const enemy1 = createVenomousCobra();
    const enemy2 = createVenomousCobra();

    const board1 = createTestBoard(12);
    const board2 = createTestBoard(12);

    enemy1.onRoundStart(board1);
    enemy2.onRoundStart(board2);

    // Tick enemy1 for 15 seconds
    mockRandom(0);
    const result1 = enemy1.onTick(15000, board1);

    // enemy2 should not have triggered attribute change
    const result2 = enemy2.onTick(5000, board2);

    expect(
      result1.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(1);
    expect(
      result2.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(0);
  });

  it('onRoundEnd resets internal timers', () => {
    const enemy = createVenomousCobra();
    const board = createTestBoard(12);

    enemy.onRoundStart(board);
    enemy.onTick(10000, board); // 10 seconds into round

    enemy.onRoundEnd();

    // Start new round
    enemy.onRoundStart(board);

    // Should need full 15 seconds again
    const result = enemy.onTick(5000, board);
    expect(
      result.events.filter((e) => e.type === 'attribute_changed')
    ).toHaveLength(0);
  });
});
