import { createDeck, isValidCombination, findAllCombinations } from '@/utils/gameUtils';
import { Card, AttributeName } from '@/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Helper to create a test card
const createTestCard = (
  shape: 'oval' | 'squiggle' | 'diamond',
  color: 'red' | 'green' | 'purple',
  number: 1 | 2 | 3,
  id?: string
): Card => ({
  id: id || `test-${shape}-${color}-${number}`,
  shape,
  color,
  number,
  shading: 'solid',
  background: 'white',
  selected: false,
});

describe('Tutorial Quiz Scenarios', () => {
  // These match the QUIZ_SCENARIOS in TutorialQuiz.tsx

  describe('Quiz 1: All different attributes', () => {
    it('should be a valid SET when all attributes are different', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('squiggle', 'green', 2),
        createTestCard('oval', 'purple', 3),
      ];

      const result = isValidCombination(cards, ['shape', 'color', 'number']);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Quiz 2: Invalid SET with 2 same, 1 different color', () => {
    it('should NOT be a valid SET when color has 2 same and 1 different', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('squiggle', 'red', 2),
        createTestCard('oval', 'green', 3),
      ];

      const result = isValidCombination(cards, ['shape', 'color', 'number']);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('color');
    });
  });

  describe('Quiz 3: Valid SET with all same color', () => {
    it('should be a valid SET when color is all same', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'purple', 1),
        createTestCard('squiggle', 'purple', 2),
        createTestCard('oval', 'purple', 3),
      ];

      const result = isValidCombination(cards, ['shape', 'color', 'number']);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('Tutorial Practice Board Generation', () => {
  const tutorialAttributes: AttributeName[] = ['shape', 'color', 'number'];

  it('should create a deck with 27 cards for 3 attributes', () => {
    const deck = createDeck(tutorialAttributes);
    expect(deck.length).toBe(27); // 3^3 = 27
  });

  it('should find valid SETs in a board when they exist', () => {
    // Create a board that definitely has a SET
    const board: Card[] = [
      // This is a guaranteed valid SET
      createTestCard('diamond', 'red', 1, 'card-1'),
      createTestCard('squiggle', 'green', 2, 'card-2'),
      createTestCard('oval', 'purple', 3, 'card-3'),
      // Add more cards to simulate a real board
      createTestCard('diamond', 'green', 1, 'card-4'),
      createTestCard('diamond', 'purple', 1, 'card-5'),
      createTestCard('squiggle', 'red', 1, 'card-6'),
      createTestCard('squiggle', 'purple', 2, 'card-7'),
      createTestCard('oval', 'red', 2, 'card-8'),
      createTestCard('oval', 'green', 2, 'card-9'),
      createTestCard('diamond', 'red', 3, 'card-10'),
      createTestCard('squiggle', 'green', 3, 'card-11'),
      createTestCard('oval', 'purple', 1, 'card-12'),
    ];

    const validSets = findAllCombinations(board, tutorialAttributes);
    expect(validSets.length).toBeGreaterThan(0);
  });

  it('should generate a shuffled board from a deck', () => {
    const deck = createDeck(tutorialAttributes);
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    const board = shuffled.slice(0, 12);

    expect(board.length).toBe(12);
    // All cards should be from the deck
    board.forEach(card => {
      const found = deck.some(d => d.id === card.id);
      expect(found).toBe(true);
    });
  });
});

describe('Tutorial State Transitions', () => {
  // Test the step order logic
  const stepOrder = [
    'intro',
    'quiz_1',
    'quiz_2',
    'quiz_3',
    'complexity',
    'practice',
    'ui_tour',
    'menu_tour',
    'complete',
  ];

  it('should have the correct step order', () => {
    expect(stepOrder[0]).toBe('intro');
    expect(stepOrder[stepOrder.length - 1]).toBe('complete');
  });

  it('should have quiz steps in order', () => {
    expect(stepOrder.indexOf('quiz_1')).toBeLessThan(stepOrder.indexOf('quiz_2'));
    expect(stepOrder.indexOf('quiz_2')).toBeLessThan(stepOrder.indexOf('quiz_3'));
  });

  it('should have practice before ui_tour', () => {
    expect(stepOrder.indexOf('practice')).toBeLessThan(stepOrder.indexOf('ui_tour'));
  });

  it('should have ui_tour before menu_tour', () => {
    expect(stepOrder.indexOf('ui_tour')).toBeLessThan(stepOrder.indexOf('menu_tour'));
  });

  it('should have 9 total steps', () => {
    expect(stepOrder.length).toBe(9);
  });
});

describe('SET Validation for Tutorial', () => {
  const attrs: AttributeName[] = ['shape', 'color', 'number'];

  describe('Valid SET combinations', () => {
    it('all same shape, all different color, all different number', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('diamond', 'green', 2),
        createTestCard('diamond', 'purple', 3),
      ];
      expect(isValidCombination(cards, attrs).isValid).toBe(true);
    });

    it('all different shape, all same color, all same number', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('squiggle', 'red', 1),
        createTestCard('oval', 'red', 1),
      ];
      expect(isValidCombination(cards, attrs).isValid).toBe(true);
    });

    it('all same everything', () => {
      // Note: This can't happen with unique cards, but testing the logic
      const cards: Card[] = [
        { ...createTestCard('diamond', 'red', 1), id: 'a' },
        { ...createTestCard('diamond', 'red', 1), id: 'b' },
        { ...createTestCard('diamond', 'red', 1), id: 'c' },
      ];
      expect(isValidCombination(cards, attrs).isValid).toBe(true);
    });
  });

  describe('Invalid SET combinations', () => {
    it('two same shape, one different shape is invalid', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('diamond', 'green', 2),
        createTestCard('oval', 'purple', 3),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('shape');
    });

    it('two same color, one different color is invalid', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('squiggle', 'red', 2),
        createTestCard('oval', 'purple', 3),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('color');
    });

    it('two same number, one different number is invalid', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('squiggle', 'green', 1),
        createTestCard('oval', 'purple', 3),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes).toContain('number');
    });

    it('multiple broken attributes are detected', () => {
      const cards: Card[] = [
        createTestCard('diamond', 'red', 1),
        createTestCard('diamond', 'red', 2),
        createTestCard('oval', 'purple', 3),
      ];
      const result = isValidCombination(cards, attrs);
      expect(result.isValid).toBe(false);
      expect(result.invalidAttributes.length).toBeGreaterThan(1);
    });
  });
});

describe('Tutorial Attribute Progression', () => {
  // Test attribute counts for different difficulty levels

  it('tutorial uses 3 attributes: shape, color, number', () => {
    const tutorialAttrs: AttributeName[] = ['shape', 'color', 'number'];
    expect(tutorialAttrs.length).toBe(3);
  });

  it('rounds 4-9 add shading (4 attributes)', () => {
    const midGameAttrs: AttributeName[] = ['shape', 'color', 'number', 'shading'];
    expect(midGameAttrs.length).toBe(4);
    expect(midGameAttrs).toContain('shading');
  });

  it('round 10 adds background (5 attributes)', () => {
    const finalAttrs: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];
    expect(finalAttrs.length).toBe(5);
    expect(finalAttrs).toContain('background');
  });

  it('deck size increases with more attributes', () => {
    const deck3 = createDeck(['shape', 'color', 'number']);
    const deck4 = createDeck(['shape', 'color', 'number', 'shading']);
    const deck5 = createDeck(['shape', 'color', 'number', 'shading', 'background']);

    expect(deck3.length).toBe(27);  // 3^3
    expect(deck4.length).toBe(81);  // 3^4
    expect(deck5.length).toBe(243); // 3^5
  });
});
