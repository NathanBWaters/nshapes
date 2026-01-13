import {
  createDeck,
  shuffleArray,
  generateGameBoard,
  isValidCombination,
  findAllCombinations,
  sameCardAttributes,
} from '@/utils/gameUtils';
import { Card, AttributeName } from '@/types';

// Helper to create a test card
const createTestCard = (
  shape: 'oval' | 'squiggle' | 'diamond',
  color: 'red' | 'green' | 'purple',
  number: 1 | 2 | 3,
  shading: 'solid' | 'striped' | 'open',
  background: 'white' | 'beige' | 'charcoal' = 'white'
): Card => ({
  id: `test-${shape}-${color}-${number}-${shading}-${background}`,
  shape,
  color,
  number,
  shading,
  background,
  selected: false,
});

describe('createDeck', () => {
  it('should create 81 cards for 4 attributes (3^4)', () => {
    const deck = createDeck(['shape', 'color', 'number', 'shading']);
    expect(deck.length).toBe(81);
  });

  it('should create 243 cards for 5 attributes (3^5)', () => {
    const deck = createDeck(['shape', 'color', 'number', 'shading', 'background']);
    expect(deck.length).toBe(243);
  });

  it('should create 27 cards for 3 attributes (3^3)', () => {
    const deck = createDeck(['shape', 'color', 'number']);
    expect(deck.length).toBe(27);
  });

  it('should create 9 cards for 2 attributes (3^2)', () => {
    const deck = createDeck(['shape', 'color']);
    expect(deck.length).toBe(9);
  });

  it('each card should have all required properties', () => {
    const deck = createDeck(['shape', 'color', 'number', 'shading']);
    deck.forEach(card => {
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('shape');
      expect(card).toHaveProperty('color');
      expect(card).toHaveProperty('number');
      expect(card).toHaveProperty('shading');
      expect(card).toHaveProperty('selected');
      expect(card.selected).toBe(false);
    });
  });

  it('should have all unique cards (no duplicates)', () => {
    const deck = createDeck(['shape', 'color', 'number', 'shading']);
    const uniqueCombos = new Set(
      deck.map(c => `${c.shape}-${c.color}-${c.number}-${c.shading}`)
    );
    expect(uniqueCombos.size).toBe(81);
  });
});

describe('shuffleArray', () => {
  it('should return an array of the same length', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled.length).toBe(original.length);
  });

  it('should contain all the same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled.sort()).toEqual(original.sort());
  });

  it('should not modify the original array', () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    shuffleArray(original);
    expect(original).toEqual(originalCopy);
  });

  it('should produce different orderings (probabilistic)', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let sameOrderCount = 0;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const shuffled = shuffleArray(original);
      if (shuffled.every((val, idx) => val === original[idx])) {
        sameOrderCount++;
      }
    }

    // Probability of exact same order is 1/10! = very low
    expect(sameOrderCount).toBeLessThan(iterations * 0.1);
  });
});

describe('generateGameBoard', () => {
  it('should generate the specified number of cards', () => {
    const board = generateGameBoard(12, 1, 1, ['shape', 'color', 'number', 'shading']);
    expect(board.length).toBe(12);
  });

  it('should generate valid cards', () => {
    const board = generateGameBoard(12, 1, 1, ['shape', 'color', 'number', 'shading']);
    board.forEach(card => {
      expect(['oval', 'squiggle', 'diamond']).toContain(card.shape);
      expect(['red', 'green', 'purple']).toContain(card.color);
      expect([1, 2, 3]).toContain(card.number);
      expect(['solid', 'striped', 'open']).toContain(card.shading);
    });
  });

  it('should generate cards without modifiers (modifiers are applied by enemy system)', () => {
    // generateGameBoard creates plain cards; modifiers are now applied by enemy onRoundStart/onCardDraw
    const board = generateGameBoard(12, 5, 5, ['shape', 'color', 'number', 'shading']);

    // All cards should start as plain cards without special modifiers
    board.forEach(card => {
      expect(card.isDud).toBeUndefined();
      expect(card.isFaceDown).toBeUndefined();
      expect(card.hasBomb).toBeUndefined();
      expect(card.hasCountdown).toBeUndefined();
    });
  });
});

describe('isValidCombination', () => {
  describe('with 4 attributes', () => {
    const attrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];

    it('should accept all same shape, color, number - all different shading', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'red', 1, 'striped'),
        createTestCard('oval', 'red', 1, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(true);
    });

    it('should accept all different shape, color, number, shading', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(true);
    });

    it('should reject 2 same + 1 different (shape)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'green', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('shape');
    });

    it('should reject 2 same + 1 different (color)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'red', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('color');
    });

    it('should reject 2 same + 1 different (number)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 1, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('number');
    });

    it('should reject 2 same + 1 different (shading)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'solid'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('shading');
    });

    it('should identify multiple invalid attributes', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'red', 2, 'solid'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBeGreaterThan(1);
    });

    it('should reject less than 3 cards', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'striped'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
    });

    it('should reject more than 3 cards', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
        createTestCard('oval', 'red', 1, 'solid'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
    });
  });

  describe('with 3 attributes', () => {
    const attrs: AttributeName[] = ['shape', 'color', 'number'];

    it('should ignore shading when not in active attributes', () => {
      // Shading is 2 same + 1 different, but shading is not active
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'solid'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(true);
    });
  });

  describe('with 5 attributes (including background)', () => {
    const attrs: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];

    it('should accept valid 5-attribute set', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid', 'white'),
        createTestCard('squiggle', 'green', 2, 'striped', 'beige'),
        createTestCard('diamond', 'purple', 3, 'open', 'charcoal'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid background (2 same + 1 different)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid', 'white'),
        createTestCard('squiggle', 'green', 2, 'striped', 'white'),
        createTestCard('diamond', 'purple', 3, 'open', 'charcoal'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('background');
    });
  });
});

describe('findAllCombinations', () => {
  it('should find combinations in a simple board', () => {
    const board = [
      createTestCard('oval', 'red', 1, 'solid'),
      createTestCard('oval', 'red', 1, 'striped'),
      createTestCard('oval', 'red', 1, 'open'),
      createTestCard('squiggle', 'green', 2, 'solid'),
    ];
    const attrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];
    const combinations = findAllCombinations(board, attrs);

    // First 3 cards form a valid set
    expect(combinations.length).toBeGreaterThanOrEqual(1);
  });

  it('should find no combinations when none exist', () => {
    const board = [
      createTestCard('oval', 'red', 1, 'solid'),
      createTestCard('oval', 'red', 1, 'solid'), // Duplicate, makes it impossible
      createTestCard('oval', 'green', 2, 'striped'),
      createTestCard('diamond', 'purple', 3, 'open'),
    ];
    const attrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];
    const combinations = findAllCombinations(board, attrs);

    // With this specific board, there should be no valid sets
    expect(combinations.length).toBe(0);
  });

  it('should find multiple combinations when they exist', () => {
    // Create a board with multiple valid sets
    const board = [
      // Set 1: All different everything
      createTestCard('oval', 'red', 1, 'solid'),
      createTestCard('squiggle', 'green', 2, 'striped'),
      createTestCard('diamond', 'purple', 3, 'open'),
      // Set 2: All same shape/color/number, different shading
      createTestCard('oval', 'red', 1, 'striped'),
      createTestCard('oval', 'red', 1, 'open'),
    ];
    const attrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];
    const combinations = findAllCombinations(board, attrs);

    // Should find at least 2 valid sets
    expect(combinations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Grace System - Invalid Attribute Counting', () => {
  // Grace saves player ONLY when exactly 1 attribute is wrong (near-miss)
  // If 2+ attributes are wrong, grace does NOT save

  const attrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];

  describe('should identify exactly 1 invalid attribute (grace saves)', () => {
    it('only shape is wrong (2 same, 1 different)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'green', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(1);
      expect(result.invalidAttributes).toContain('shape');
    });

    it('only color is wrong (2 same, 1 different)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'red', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(1);
      expect(result.invalidAttributes).toContain('color');
    });

    it('only number is wrong (2 same, 1 different)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 1, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(1);
      expect(result.invalidAttributes).toContain('number');
    });

    it('only shading is wrong (2 same, 1 different)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'solid'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(1);
      expect(result.invalidAttributes).toContain('shading');
    });
  });

  describe('should identify 2+ invalid attributes (grace does NOT save)', () => {
    it('shape AND color are wrong', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'red', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(2);
      expect(result.invalidAttributes).toContain('shape');
      expect(result.invalidAttributes).toContain('color');
    });

    it('shape AND number are wrong', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'green', 1, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(2);
      expect(result.invalidAttributes).toContain('shape');
      expect(result.invalidAttributes).toContain('number');
    });

    it('color AND shading are wrong', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'red', 2, 'solid'),
        createTestCard('diamond', 'purple', 3, 'striped'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(2);
      expect(result.invalidAttributes).toContain('color');
      expect(result.invalidAttributes).toContain('shading');
    });

    it('all 4 attributes are wrong', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'red', 1, 'solid'), // Duplicate
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      // 3 attributes should be wrong (shape: 2 oval 1 diamond, color: 2 red 1 purple, number: 2 1s 1 3)
      // shading: 2 solid 1 open
      expect(result.invalidAttributes.length).toBeGreaterThanOrEqual(3);
    });

    it('3 attributes are wrong', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'red', 2, 'solid'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      // shape: 2 oval 1 diamond, color: 2 red 1 purple, shading: 2 solid 1 open
      expect(result.invalidAttributes.length).toBe(3);
    });
  });

  describe('edge cases for grace logic', () => {
    it('valid set should have 0 invalid attributes', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'striped'),
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(true);
      expect(result.invalidAttributes.length).toBe(0);
    });

    it('with 3 attributes active, background errors should not count', () => {
      const threeAttrs: AttributeName[] = ['shape', 'color', 'number'];
      const cards = [
        createTestCard('oval', 'red', 1, 'solid', 'white'),
        createTestCard('squiggle', 'green', 2, 'striped', 'white'),
        createTestCard('diamond', 'purple', 3, 'open', 'charcoal'),
      ];
      // Shape, color, number are all different = valid for 3 attrs
      // Shading is 2 same 1 different, but not active
      // Background is 2 same 1 different, but not active
      const result = isValidCombination(cards, threeAttrs);
      expect(result.isValid).toBe(true);
      expect(result.invalidAttributes.length).toBe(0);
    });

    it('with 5 attributes, background errors should count', () => {
      const fiveAttrs: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];
      const cards = [
        createTestCard('oval', 'red', 1, 'solid', 'white'),
        createTestCard('squiggle', 'green', 2, 'striped', 'white'),
        createTestCard('diamond', 'purple', 3, 'open', 'charcoal'),
      ];
      // Everything is different except background (2 white, 1 charcoal)
      const result = isValidCombination(cards, fiveAttrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(1);
      expect(result.invalidAttributes).toContain('background');
    });
  });

  describe('4 attributes active - explicit grace decision tests', () => {
    // These tests simulate the exact scenario: 4 attributes (shape, color, number, shading)
    // Grace should ONLY save when EXACTLY 1 attribute is wrong
    const fourAttrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];

    // Helper to determine if grace would save
    const wouldGraceSave = (cards: Card[], graces: number): boolean => {
      const result = isValidCombination(cards, fourAttrs);
      return result.invalidAttributes.length === 1 && graces > 0;
    };

    it('2 attributes correct, 2 wrong = grace does NOT save', () => {
      // Shape: all different (valid), Color: all different (valid)
      // Number: 2 same 1 different (INVALID), Shading: 2 same 1 different (INVALID)
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),     // 1, solid
        createTestCard('squiggle', 'green', 1, 'solid'), // 1, solid (same number, same shading)
        createTestCard('diamond', 'purple', 3, 'open'),  // 3, open (different)
      ];
      const result = isValidCombination(cards, fourAttrs);

      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(2);
      expect(result.invalidAttributes).toContain('number');
      expect(result.invalidAttributes).toContain('shading');

      // Grace should NOT save because 2 attributes are wrong
      expect(wouldGraceSave(cards, 5)).toBe(false);
    });

    it('3 attributes correct, 1 wrong = grace DOES save', () => {
      // Shape: all different (valid), Color: all different (valid), Number: all different (valid)
      // Shading: 2 same 1 different (INVALID)
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'solid'),  // solid (same as first)
        createTestCard('diamond', 'purple', 3, 'open'),   // open (different)
      ];
      const result = isValidCombination(cards, fourAttrs);

      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(1);
      expect(result.invalidAttributes).toContain('shading');

      // Grace SHOULD save because exactly 1 attribute is wrong
      expect(wouldGraceSave(cards, 5)).toBe(true);
    });

    it('1 attribute correct, 3 wrong = grace does NOT save', () => {
      // Shape: all different (valid)
      // Color: 2 same 1 different (INVALID)
      // Number: 2 same 1 different (INVALID)
      // Shading: 2 same 1 different (INVALID)
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'red', 1, 'solid'),    // same color, number, shading
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, fourAttrs);

      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBe(3);

      // Grace should NOT save because 3 attributes are wrong
      expect(wouldGraceSave(cards, 5)).toBe(false);
    });

    it('grace does not save even with high grace count if 2+ attributes wrong', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('oval', 'green', 2, 'solid'),      // same shape, same shading
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, fourAttrs);

      // Shape: 2 oval, 1 diamond = INVALID
      // Shading: 2 solid, 1 open = INVALID
      expect(result.invalidAttributes.length).toBe(2);

      // Even with 99 graces, should NOT save
      expect(wouldGraceSave(cards, 99)).toBe(false);
    });

    it('grace does not save if player has 0 graces (even with 1 wrong)', () => {
      const cards = [
        createTestCard('oval', 'red', 1, 'solid'),
        createTestCard('squiggle', 'green', 2, 'solid'),  // only shading wrong
        createTestCard('diamond', 'purple', 3, 'open'),
      ];
      const result = isValidCombination(cards, fourAttrs);

      expect(result.invalidAttributes.length).toBe(1);

      // With 0 graces, should NOT save even though only 1 is wrong
      expect(wouldGraceSave(cards, 0)).toBe(false);
    });
  });
});

describe('sameCardAttributes', () => {
  it('should return true for cards with identical attributes', () => {
    const card1 = createTestCard('oval', 'red', 1, 'solid', 'white');
    const card2 = createTestCard('oval', 'red', 1, 'solid', 'white');
    expect(sameCardAttributes(card1, card2)).toBe(true);
  });

  it('should return false for different shapes', () => {
    const card1 = createTestCard('oval', 'red', 1, 'solid', 'white');
    const card2 = createTestCard('diamond', 'red', 1, 'solid', 'white');
    expect(sameCardAttributes(card1, card2)).toBe(false);
  });

  it('should return false for different colors', () => {
    const card1 = createTestCard('oval', 'red', 1, 'solid', 'white');
    const card2 = createTestCard('oval', 'green', 1, 'solid', 'white');
    expect(sameCardAttributes(card1, card2)).toBe(false);
  });

  it('should return false for different numbers', () => {
    const card1 = createTestCard('oval', 'red', 1, 'solid', 'white');
    const card2 = createTestCard('oval', 'red', 2, 'solid', 'white');
    expect(sameCardAttributes(card1, card2)).toBe(false);
  });

  it('should return false for different shadings', () => {
    const card1 = createTestCard('oval', 'red', 1, 'solid', 'white');
    const card2 = createTestCard('oval', 'red', 1, 'striped', 'white');
    expect(sameCardAttributes(card1, card2)).toBe(false);
  });

  it('should return false for different backgrounds', () => {
    const card1 = createTestCard('oval', 'red', 1, 'solid', 'white');
    const card2 = createTestCard('oval', 'red', 1, 'solid', 'charcoal');
    expect(sameCardAttributes(card1, card2)).toBe(false);
  });
});
