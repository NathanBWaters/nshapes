import { useEffect, useRef, useCallback } from 'react';
import { Card, AttributeName } from '@/types';
import { findAllCombinations } from '@/utils/gameUtils';

interface UseAutoPlayerOptions {
  isActive: boolean;
  isPaused: boolean;
  cards: Card[];
  activeAttributes: AttributeName[];
  matchedCardIds: string[];
  graces: number;
  onSelectCard: (card: Card) => void;
}

const DELAY_BETWEEN_CARDS = 300;   // ms between selecting each card
const DELAY_BETWEEN_SETS = 1500;   // ms after completing a set (matches reward reveal)
const CHECK_INTERVAL = 500;        // ms between checking for sets

/**
 * Autoplayer hook that automatically finds and selects valid SETs.
 * Activated via URL param ?autoplayer=true.
 * Used for manual review and integration testing.
 */
export function useAutoPlayer({
  isActive,
  isPaused,
  cards,
  activeAttributes,
  matchedCardIds,
  graces,
  onSelectCard,
}: UseAutoPlayerOptions): void {
  // Use ref for callback to avoid stale closures
  const onSelectCardRef = useRef(onSelectCard);
  onSelectCardRef.current = onSelectCard;

  // Use ref for graces to avoid stale closures
  const gracesRef = useRef(graces);
  gracesRef.current = graces;

  // Track if currently in the process of selecting cards
  const isSelectingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Find and select a valid SET (or random cards if no valid set exists)
  const findAndSelectSet = useCallback(() => {
    if (isSelectingRef.current) return;

    // Get available cards (exclude matched ones)
    const availableCards = cards.filter(card => !matchedCardIds.includes(card.id));

    if (availableCards.length < 3) return;

    // Find valid sets
    const validSets = findAllCombinations(availableCards, activeAttributes);

    let targetSet: Card[];

    if (validSets.length > 0) {
      // Select the first valid set
      targetSet = validSets[0];
    } else {
      // No valid set available - pick 3 random cards
      // This will either use a grace (if available and only 1 attribute wrong)
      // or lose health, but either way refreshes the board
      const shuffled = [...availableCards].sort(() => Math.random() - 0.5);
      targetSet = shuffled.slice(0, 3);
    }

    isSelectingRef.current = true;

    // Select cards one at a time with delays
    const selectWithDelay = (index: number) => {
      if (index >= 3) {
        // All 3 cards selected, wait before looking for next set
        timeoutRef.current = setTimeout(() => {
          isSelectingRef.current = false;
        }, DELAY_BETWEEN_SETS);
        return;
      }

      onSelectCardRef.current(targetSet[index]);

      timeoutRef.current = setTimeout(() => {
        selectWithDelay(index + 1);
      }, DELAY_BETWEEN_CARDS);
    };

    selectWithDelay(0);
  }, [cards, activeAttributes, matchedCardIds]);

  // Main effect - check for sets periodically
  useEffect(() => {
    if (!isActive || isPaused) {
      return;
    }

    const intervalId = setInterval(() => {
      if (!isSelectingRef.current) {
        findAndSelectSet();
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isActive, isPaused, findAndSelectSet]);
}
