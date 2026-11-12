/**
 * Dealing the board for the legacy round-based run.
 */
import type { AttributeName, Card } from '@/types';
import { getBoardSizeForAttributes } from '@/utils/gameConfig';
import { createDeck, generateGameBoard, sameCardAttributes, shuffleArray } from '@/utils/gameUtils';

/** The board is at least as large as the attribute count needs, and as large as the player's field size. */
export const getBoardSize = (attributes: AttributeName[], fieldSize: number): number =>
  Math.max(getBoardSizeForAttributes(attributes.length), fieldSize);

/** Deal a fresh board. */
export const dealBoard = (attributes: AttributeName[], fieldSize: number, round: number): Card[] =>
  generateGameBoard(getBoardSize(attributes, fieldSize), round, round, attributes);

/** Deal a fresh board plus a shuffled draw deck that holds every other card. */
export const dealBoardAndDeck = (
  attributes: AttributeName[],
  fieldSize: number,
  round: number
): { board: Card[]; deck: Card[] } => {
  const board = dealBoard(attributes, fieldSize, round);
  // Card ids are unique per instance, so "not on the board" has to compare attributes.
  const deck = shuffleArray(createDeck(attributes)).filter(
    card => !board.some(boardCard => sameCardAttributes(boardCard, card))
  );
  return { board, deck };
};
