import { Card, Shape, Color, Number, Shading } from '../types';

// Create the complete deck of 81 cards
export const createDeck = (): Card[] => {
  const shapes: Shape[] = ['oval', 'square', 'diamond'];
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

// Shuffle an array using Fisher-Yates algorithm
export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Generate a set of cards for the game board with random modifiers
export const generateGameBoard = (
  size: number = 12, 
  difficulty: number = 1, 
  round: number = 1
): Card[] => {
  // Create and shuffle the deck
  const deck = shuffleArray(createDeck());
  
  // Take the first 'size' cards for the board
  const boardCards = deck.slice(0, size);
  
  // Apply modifiers based on difficulty and round
  return boardCards.map(card => {
    const modifiedCard = { ...card };
    
    // Chance to add modifiers increases with difficulty and round
    const modifierChance = 0.05 * difficulty + 0.02 * round;
    
    // Health (multi-hit cards)
    if (Math.random() < modifierChance * 0.7) {
      modifiedCard.health = Math.min(Math.floor(Math.random() * 3) + 2, 5); // 2-5 health
    }
    
    // Loot box (gives random rewards)
    if (Math.random() < modifierChance * 0.3) {
      modifiedCard.lootBox = true;
    }
    
    // Bonus money
    if (Math.random() < modifierChance * 0.5) {
      modifiedCard.bonusMoney = Math.floor(Math.random() * 5) + 1; // 1-5 bonus money
    }
    
    // Bonus points
    if (Math.random() < modifierChance * 0.5) {
      modifiedCard.bonusPoints = Math.floor(Math.random() * 3) + 1; // 1-3 bonus points
    }
    
    // Fire starter (burns adjacent cards)
    if (Math.random() < modifierChance * 0.2) {
      modifiedCard.fireStarter = true;
    }
    
    // Bomb (explodes after a timer)
    if (Math.random() < modifierChance * 0.15 && round > 2) {
      modifiedCard.bomb = true;
      modifiedCard.bombTimer = Math.floor(Math.random() * 10) + 10; // 10-20 seconds
    }
    
    // Healing (restores player health)
    if (Math.random() < modifierChance * 0.25) {
      modifiedCard.healing = true;
    }
    
    // Spikes (damages player when matched)
    if (Math.random() < modifierChance * 0.2 && round > 3) {
      modifiedCard.spikes = true;
    }
    
    // Dud card (cannot be selected)
    if (Math.random() < modifierChance * 0.1 && round > 4) {
      modifiedCard.isDud = true;
    }
    
    // Fragile card (breaks if not matched quickly)
    if (Math.random() < modifierChance * 0.2 && round > 3) {
      modifiedCard.isFragile = true;
    }
    
    // Booby trap (negative effect when matched)
    if (Math.random() < modifierChance * 0.15 && round > 5) {
      modifiedCard.boobyTrap = true;
    }
    
    // Clover (increases luck temporarily)
    if (Math.random() < modifierChance * 0.3) {
      modifiedCard.clover = true;
    }
    
    // Card clear (removes all cards of same type)
    if (Math.random() < modifierChance * 0.1 && round > 6) {
      modifiedCard.cardClear = true;
    }
    
    // Broom (clears all modifiers from the board)
    if (Math.random() < modifierChance * 0.05 && round > 7) {
      modifiedCard.broom = true;
    }
    
    // Self healing (regenerates health over time)
    if (Math.random() < modifierChance * 0.2 && round > 4) {
      modifiedCard.selfHealing = true;
    }
    
    // Timed reward (bonus if matched quickly)
    if (Math.random() < modifierChance * 0.4) {
      modifiedCard.timedReward = true;
      modifiedCard.timedRewardAmount = Math.floor(Math.random() * 5) + 3; // 3-7 bonus
    }
    
    return modifiedCard;
  });
};

// Format time in MM:SS format
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
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