import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card as CardType, PlayerStats } from '@/types';
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

  // Split cards into rows of 3 for flex layout
  const COLUMNS = 3;
  const rows: CardType[][] = [];
  for (let i = 0; i < cards.length; i += COLUMNS) {
    rows.push(cards.slice(i, i + COLUMNS));
  }

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
    <View nativeID="gameboard-container" style={styles.container}>
      {/* Card grid using flex rows */}
      <View nativeID="gameboard-grid" style={styles.board}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} nativeID={`card-row-${rowIndex}`} style={styles.row}>
            {row.map((card, colIndex) => {
              const isSelected = selectedCards.some(c => c.id === card.id);
              const isMatched = matchedCardIds.includes(card.id);
              const isHint = hintCards.includes(card.id);

              const cardWithState = {
                ...card,
                selected: isSelected,
                isHint: isHint
              };

              return (
                <View key={`${rowIndex}-${colIndex}-${card.id}`} nativeID={`card-slot-${rowIndex}-${colIndex}`} style={styles.cardWrapper}>
                  <Card
                    card={cardWithState}
                    onClick={handleCardClick}
                    disabled={isMatched || !isPlayerTurn || isProcessing}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Bottom bar with controls and indicator */}
      <View nativeID="gameboard-bottombar" style={styles.bottomBar}>
        <View style={styles.indicator}>
          <Text style={styles.indicatorText}>{selectedCards.length}/3</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.button,
              getHintsAvailable() > 0 ? styles.buttonEnabled : styles.buttonDisabled
            ]}
            onPress={findHint}
            disabled={getHintsAvailable() <= 0 || !isPlayerTurn}
          >
            <Text style={getHintsAvailable() > 0 ? styles.buttonTextEnabled : styles.buttonTextDisabled}>
              Hint ({getHintsAvailable()})
            </Text>
          </TouchableOpacity>

          {hintCards.length > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={clearHint}
            >
              <Text style={styles.buttonTextEnabled}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  board: {
    flex: 1,
    flexDirection: 'column',
    padding: 6,
    backgroundColor: '#f3f4f6',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  cardWrapper: {
    flex: 1,
    aspectRatio: 0.75,
    maxHeight: '100%',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e5e7eb',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonEnabled: {
    backgroundColor: '#3b82f6',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
  },
  buttonTextEnabled: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#d1d5db',
    fontSize: 14,
  },
  indicator: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  indicatorText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default GameBoard;
