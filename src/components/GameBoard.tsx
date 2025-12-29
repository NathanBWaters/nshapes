import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card as CardType, PlayerStats, CardReward } from '@/types';
import Card from './Card';
import RewardReveal from './RewardReveal';

interface GameBoardProps {
  cards: CardType[];
  onMatch: (cards: CardType[], rewards: CardReward[]) => void;
  onInvalidSelection: () => void;
  playerStats: PlayerStats;
  isPlayerTurn: boolean;
  onSelectedCountChange?: (count: number) => void;
  onHintStateChange?: (hasHint: boolean) => void;
  triggerHint?: number;
  triggerClearHint?: number;
}

// Calculate rewards for a single card
const calculateCardReward = (card: CardType): CardReward => {
  const reward: CardReward = {
    cardId: card.id,
    points: 1,
    money: 1,
    experience: 1,
  };

  if (card.bonusPoints) {
    reward.points = (reward.points || 0) + card.bonusPoints;
  }
  if (card.bonusMoney) {
    reward.money = (reward.money || 0) + card.bonusMoney;
  }
  if (card.healing) {
    reward.healing = 1;
  }
  if (card.lootBox) {
    reward.lootBox = true;
  }

  return reward;
};

const GameBoard: React.FC<GameBoardProps> = ({
  cards,
  onMatch,
  onInvalidSelection,
  playerStats,
  isPlayerTurn,
  onSelectedCountChange,
  onHintStateChange,
  triggerHint,
  triggerClearHint,
}) => {
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<string[]>([]);
  const [hintCards, setHintCards] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reward reveal state - managed internally
  const [revealingRewards, setRevealingRewards] = useState<CardReward[]>([]);

  // Create a map for quick reward lookup
  const rewardsByCardId = new Map<string, CardReward>();
  revealingRewards.forEach(reward => {
    rewardsByCardId.set(reward.cardId, reward);
  });

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

  // Report selected count changes to parent
  useEffect(() => {
    onSelectedCountChange?.(selectedCards.length);
  }, [selectedCards.length, onSelectedCountChange]);

  // Report hint state changes to parent
  useEffect(() => {
    onHintStateChange?.(hintCards.length > 0);
  }, [hintCards.length, onHintStateChange]);

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

  // Find a hint (a valid set on the board)
  const findHint = useCallback(() => {
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
  }, [cards, matchedCardIds, playerStats.hints]);

  // Clear hint
  const clearHint = useCallback(() => {
    setHintCards([]);
  }, []);

  // Handle external hint trigger (fires when triggerHint increments)
  useEffect(() => {
    if (triggerHint && triggerHint > 0) {
      findHint();
    }
  }, [triggerHint]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle external clear hint trigger (fires when triggerClearHint increments)
  useEffect(() => {
    if (triggerClearHint && triggerClearHint > 0) {
      clearHint();
    }
  }, [triggerClearHint]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle card click
  const handleCardClick = (card: CardType) => {
    if (!isPlayerTurn || isProcessing || revealingRewards.length > 0) return;

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
          // Calculate rewards for each card
          const rewards = newSelectedCards.map(c => calculateCardReward(c));

          // Mark cards as matched and show rewards
          const newMatchedIds = [...matchedCardIds, ...newSelectedCards.map(c => c.id)];
          setMatchedCardIds(newMatchedIds);
          setSelectedCards([]);
          setRevealingRewards(rewards);

          // After 1.5 seconds, notify parent and clear rewards
          setTimeout(() => {
            setRevealingRewards([]);
            setIsProcessing(false);
            onMatch(newSelectedCards, rewards);
          }, 1500);
        } else {
          onInvalidSelection();

          setTimeout(() => {
            setSelectedCards([]);
            setIsProcessing(false);
          }, 500);
        }
      }, 200);
    }
  };

  return (
    <View nativeID="gameboard-container" style={styles.container}>
      <View nativeID="gameboard-grid" style={styles.board}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} nativeID={`card-row-${rowIndex}`} style={styles.row}>
            {row.map((card, colIndex) => {
              const isSelected = selectedCards.some(c => c.id === card.id);
              const isMatched = matchedCardIds.includes(card.id);
              const isHint = hintCards.includes(card.id);
              const reward = rewardsByCardId.get(card.id);

              const cardWithState = {
                ...card,
                selected: isSelected,
                isHint: isHint
              };

              return (
                <View key={`${rowIndex}-${colIndex}-${card.id}`} nativeID={`card-slot-${rowIndex}-${colIndex}`} style={styles.cardWrapper}>
                  {/* Show reward instead of card when revealing */}
                  {reward ? (
                    <RewardReveal reward={reward} />
                  ) : (
                    <Card
                      card={cardWithState}
                      onClick={handleCardClick}
                      disabled={isMatched || !isPlayerTurn || isProcessing}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
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
    position: 'relative',
  },
});

export default GameBoard;
