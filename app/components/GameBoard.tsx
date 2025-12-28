import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
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

  // Get screen width for responsive grid
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 48) / 4; // 4 columns with padding

  // Reset selected cards when the board changes
  useEffect(() => {
    setSelectedCards([]);
    setMatchedCardIds([]);
    setHintCards([]);
  }, [cards]);

  // Check if three cards form a valid set
  const isValidSet = (cards: CardType[]): boolean => {
    if (cards.length !== 3) return false;

    const attributes = ['shape', 'color', 'number', 'shading'] as const;

    return attributes.every(attr => {
      const values = cards.map(card => card[attr]);
      const allSame = values.every(v => v === values[0]);
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

      setTimeout(() => {
        if (isValidSet(newSelectedCards)) {
          const newMatchedIds = [...matchedCardIds, ...newSelectedCards.map(c => c.id)];
          setMatchedCardIds(newMatchedIds);
          onMatch(newSelectedCards);

          setTimeout(() => {
            setSelectedCards([]);
            setIsProcessing(false);
          }, 500);
        } else {
          onInvalidSelection();

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
    const hintsAvailable = playerStats.hints !== undefined && playerStats.hints > 0;
    if (!hintsAvailable) return;

    const availableCards = cards.filter(card => !matchedCardIds.includes(card.id));

    for (let i = 0; i < availableCards.length - 2; i++) {
      for (let j = i + 1; j < availableCards.length - 1; j++) {
        for (let k = j + 1; k < availableCards.length; k++) {
          const potentialSet = [availableCards[i], availableCards[j], availableCards[k]];
          if (isValidSet(potentialSet)) {
            setHintCards(potentialSet.map(c => c.id));
            return;
          }
        }
      }
    }

    console.log("No valid sets found on the board");
  };

  const clearHint = () => {
    setHintCards([]);
  };

  const getHintsAvailable = () => {
    return playerStats.hints !== undefined ? playerStats.hints : 0;
  };

  return (
    <View className="flex-1 items-center">
      <View
        className="flex-row flex-wrap justify-center gap-2 p-2 bg-gray-100 rounded-lg"
      >
        {cards.map((card, index) => {
          const isSelected = selectedCards.some(c => c.id === card.id);
          const isMatched = matchedCardIds.includes(card.id);
          const isHint = hintCards.includes(card.id);

          const cardWithState = {
            ...card,
            selected: isSelected,
            isHint: isHint
          };

          return (
            <View key={`${index}-${card.id}`} style={{ width: cardWidth, height: cardWidth * 1.2 }}>
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
        <Text className="text-gray-700">Selected: {selectedCards.length}/3</Text>
      </View>
    </View>
  );
};

export default GameBoard;
