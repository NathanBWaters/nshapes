import { Card, Shape, Color, Number, Shading } from '../types';

// Create the complete deck of 81 cards
export const createDeck = (): Card[] => {
  const shapes: Shape[] = ['oval', 'squiggle', 'diamond'];
  const colors: Color[] = ['red', 'green', 'purple'];
  const numbers: Number[] = [1, 2, 3];
  const shadings: Shading[] = ['solid', 'striped', 'open'];
  
  const deck: Card[] = [];
  
  // Generate all possible combinations (3^4 = 81 cards)
  for (const shape of shapes) {
    for (const color of colors) {
      for (const number of numbers) {
        for (const shading of shadings) {
          deck.push({
            id: `${shape}-${color}-${number}-${shading}`,
            shape,
            color,
            number,
            shading,
            selected: false
          });
        }
      }
    }
  }
  
  return deck;
};

// Shuffle the deck using Fisher-Yates algorithm
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export interface NShapesValidationResult {
  isValid: boolean;
  invalidAttributes: string[];
  errorMessage: string;
}

// Check if three cards form a valid NShapes combination
export const isValidCombination = (cards: Card[]): NShapesValidationResult => {
  const result: NShapesValidationResult = {
    isValid: true,
    invalidAttributes: [],
    errorMessage: ''
  };
  
  if (cards.length !== 3) {
    return {
      isValid: false,
      invalidAttributes: ['count'],
      errorMessage: 'A valid combination must consist of exactly 3 cards.'
    };
  }
  
  // Check each attribute: must be all same or all different
  const checkAttribute = <T>(attribute: string, getAttribute: (card: Card) => T): boolean => {
    const values = cards.map(getAttribute);
    const uniqueValues = new Set(values);
    
    // Either all cards have the same value (1 unique), or all are different (3 unique)
    const isValid = uniqueValues.size === 1 || uniqueValues.size === 3;
    
    // If not valid, add this attribute to the list of invalid attributes
    if (!isValid) {
      result.isValid = false;
      result.invalidAttributes.push(attribute);
    }
    
    return isValid;
  };
  
  // Check all attributes
  checkAttribute('shape', card => card.shape);
  checkAttribute('color', card => card.color);
  checkAttribute('number', card => card.number);
  checkAttribute('shading', card => card.shading);
  
  // Generate a specific error message if not valid
  if (!result.isValid) {
    const attributeDetails = {
      shape: {
        label: 'shapes',
        values: cards.map(card => card.shape)
      },
      color: {
        label: 'colors',
        values: cards.map(card => card.color)
      },
      number: {
        label: 'numbers',
        values: cards.map(card => card.number)
      },
      shading: {
        label: 'shadings',
        values: cards.map(card => card.shading)
      }
    };
    
    // Generate detailed messages for each invalid attribute
    const errorDetails = result.invalidAttributes.map(attr => {
      const details = attributeDetails[attr as keyof typeof attributeDetails];
      
      // Count occurrences of each value
      const valueCounts: Record<string, number> = {};
      details.values.forEach(value => {
        valueCounts[String(value)] = (valueCounts[String(value)] || 0) + 1;
      });
      
      // Format the message based on the values
      const valueStr = Object.entries(valueCounts)
        .map(([value, count]) => `${count} ${value}`)
        .join(' and ');
        
      return `The ${details.label} (${valueStr}) must be all the same or all different`;
    });
    
    if (errorDetails.length === 1) {
      result.errorMessage = `Not a valid combination: ${errorDetails[0]}.`;
    } else {
      result.errorMessage = `Not a valid combination: ${errorDetails.join(', and ')}.`;
    }
  }
  
  return result;
};

// Find all valid combinations in the current board
export const findAllCombinations = (board: Card[]): Card[][] => {
  const validCombinations: Card[][] = [];
  
  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      for (let k = j + 1; k < board.length; k++) {
        const cards = [board[i], board[j], board[k]];
        if (isValidCombination(cards).isValid) {
          validCombinations.push(cards);
        }
      }
    }
  }
  
  return validCombinations;
};

// Format time in mm:ss format
export const formatTime = (timeInMs: number): string => {
  const totalSeconds = Math.floor(timeInMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}; 