import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card as CardType, PlayerStats } from '../types';
import Card from './Card';

interface GameBoardProps {
  cards: CardType[];
  onMatch: (cards: CardType[]) => void;
  onInvalidSelection: () => void;
  playerStats: PlayerStats;
  isPlayerTurn: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({
  cards,
  onMatch,
  onInvalidSelection,
  playerStats,
  isPlayerTurn
}) => {
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<string[]>([]);
  const [hintCards, setHintCards] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset selected cards when the board changes
  useEffect(() => {
    setSelectedCards([]);
    setMatchedCardIds([]);
    setHintCards([]);
  }, [cards]);

  // Check if three cards form a valid set
  const isValidSet = (cards: CardType[]): boolean => {
    if (cards.length !== 3) return false;

    // For each attribute, all cards must have either all the same value or all different values
    const attributes = ['shape', 'color', 'number', 'shading'] as const;

    return attributes.every(attr => {
      const values = cards.map(card => card[attr]);
      // All same
      const allSame = values.every(v => v === values[0]);
      // All different
      const allDifferent = values.length === new Set(values).size;

      return allSame || allDifferent;
    });
  };

  // Handle card click
  const handleCardClick = (card: CardType) => {
    if (!isPlayerTurn || isProcessing) return;

    // If card is already selected, deselect it
    if (selectedCards.some(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
      return;
    }

    // If already have 3 cards selected, replace the first one
    let newSelectedCards;
    if (selectedCards.length === 3) {
      newSelectedCards = [...selectedCards.slice(1), card];
    } else {
      newSelectedCards = [...selectedCards, card];
    }

    setSelectedCards(newSelectedCards);

    // If we have 3 cards selected, check if they form a valid set
    if (newSelectedCards.length === 3) {
      setIsProcessing(true);

      // Short delay to allow the UI to update
      setTimeout(() => {
        if (isValidSet(newSelectedCards)) {
          // Valid match!
          const newMatchedIds = [...matchedCardIds, ...newSelectedCards.map(c => c.id)];
          setMatchedCardIds(newMatchedIds);

          // Notify parent component
          onMatch(newSelectedCards);

          // Clear selection after a short delay
          setTimeout(() => {
            setSelectedCards([]);
            setIsProcessing(false);
          }, 500);
        } else {
          // Invalid match
          onInvalidSelection();

          // Clear selection after showing the invalid match
          setTimeout(() => {
            setSelectedCards([]);
            setIsProcessing(false);
          }, 1000);
        }
      }, 300);
    }
  };

  // Find a hint (a valid set on the board)
  const findHint = () => {
    // Check if hints are available in playerStats
    const hintsAvailable = playerStats.hints !== undefined && playerStats.hints > 0;
    if (!hintsAvailable) return;

    // Try all possible combinations of 3 cards
    const availableCards = cards.filter(card => !matchedCardIds.includes(card.id));

    for (let i = 0; i < availableCards.length - 2; i++) {
      for (let j = i + 1; j < availableCards.length - 1; j++) {
        for (let k = j + 1; k < availableCards.length; k++) {
          const potentialSet = [availableCards[i], availableCards[j], availableCards[k]];
          if (isValidSet(potentialSet)) {
            // Found a valid set, highlight these cards
            setHintCards(potentialSet.map(c => c.id));
            return;
          }
        }
      }
    }

    // No valid sets found
    console.log("No valid sets found on the board");
  };

  // Clear hint
  const clearHint = () => {
    setHintCards([]);
  };

  // Get number of hints available
  const getHintsAvailable = () => {
    return playerStats.hints !== undefined ? playerStats.hints : 0;
  };

  // Render the game board
  return (
    <View className="flex-col items-center w-full">
      <View className="flex-row flex-wrap gap-2 p-4 bg-gray-100 rounded-lg justify-center">
        {cards.map((card, index) => {
          // Check if this card is selected
          const isSelected = selectedCards.some(c => c.id === card.id);
          // Check if this card is matched
          const isMatched = matchedCardIds.includes(card.id);
          // Check if this card is part of a hint
          const isHint = hintCards.includes(card.id);

          // Create a copy of the card with UI state
          const cardWithState = {
            ...card,
            selected: isSelected,
            isHint: isHint
          };

          return (
            <View key={`${index}-${card.id}`} className="w-[30%] aspect-[3/4]">
              <Card
                card={cardWithState}
                onClick={handleCardClick}
                disabled={isMatched || !isPlayerTurn || isProcessing}
              />
            </View>
          );
        })}
      </View>

      {/* Game controls */}
      <View className="flex-row justify-center mt-4 gap-4">
        <Pressable
          className={`px-4 py-2 rounded-lg ${
            getHintsAvailable() > 0
              ? 'bg-blue-500'
              : 'bg-gray-300'
          }`}
          onPress={findHint}
          disabled={getHintsAvailable() <= 0 || !isPlayerTurn}
        >
          <Text className={getHintsAvailable() > 0 ? 'text-white' : 'text-gray-500'}>
            Hint ({getHintsAvailable()})
          </Text>
        </Pressable>

        {hintCards.length > 0 && (
          <Pressable
            className="px-4 py-2 rounded-lg bg-gray-500"
            onPress={clearHint}
          >
            <Text className="text-white">Clear Hint</Text>
          </Pressable>
        )}
      </View>

      {/* Selected cards indicator */}
      <View className="mt-4 items-center">
        <Text>Selected: {selectedCards.length}/3</Text>
      </View>
    </View>
  );
};

export default GameBoard;
