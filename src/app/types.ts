export type Shape = 'oval' | 'squiggle' | 'diamond';
export type Color = 'red' | 'green' | 'purple';
export type Number = 1 | 2 | 3;
export type Shading = 'solid' | 'striped' | 'open';

export interface Card {
  id: string;
  shape: Shape;
  color: Color;
  number: Number;
  shading: Shading;
  selected: boolean;
  isHint?: boolean;
}

export interface GameState {
  deck: Card[];
  board: Card[];
  selectedCards: Card[];
  foundCombinations: Card[][];
  score: number;
  gameStarted: boolean;
  gameEnded: boolean;
  startTime: number | null;
  endTime: number | null;
  hintUsed: boolean;
} 