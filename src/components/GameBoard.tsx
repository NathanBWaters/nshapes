import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card as CardType, PlayerStats, CardReward, AttributeName, Weapon } from '@/types';
import Card from './Card';
import RewardReveal from './RewardReveal';
import { COLORS } from '@/utils/colors';
import { MATCH_REWARDS } from '@/utils/gameConfig';
import { processWeaponEffects, WeaponEffectResult } from '@/utils/weaponEffects';

// Default to 4 attributes for backward compatibility
const DEFAULT_ATTRIBUTES: AttributeName[] = ['shape', 'color', 'number', 'shading'];

interface GameBoardProps {
  cards: CardType[];
  onMatch: (cards: CardType[], rewards: CardReward[], weaponEffects?: WeaponEffectResult) => void;
  onInvalidSelection: (cards: CardType[]) => void;
  playerStats: PlayerStats;
  weapons?: Weapon[]; // For independent laser rolls
  isPlayerTurn: boolean;
  activeAttributes?: AttributeName[];
  onSelectedCountChange?: (count: number) => void;
  onHintStateChange?: (hasHint: boolean) => void;
  onUseHint?: () => void;
  triggerHint?: number;
  triggerClearHint?: number;
  pendingBurnRewards?: CardReward[]; // Rewards for cards that finished burning
  onBurnRewardsComplete?: (cardIds: string[]) => void; // Called after burn rewards are displayed
}

// Calculate rewards for a single card
const calculateCardReward = (card: CardType): CardReward => {
  const reward: CardReward = {
    cardId: card.id,
    points: MATCH_REWARDS.basePoints,
    money: MATCH_REWARDS.baseMoney,
    experience: MATCH_REWARDS.baseExperience,
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

  // Chance to get a hint
  if (Math.random() < MATCH_REWARDS.hintDropChance) {
    reward.hint = 1;
  }

  return reward;
};

const GameBoard: React.FC<GameBoardProps> = ({
  cards,
  onMatch,
  onInvalidSelection,
  playerStats,
  weapons,
  isPlayerTurn,
  activeAttributes = DEFAULT_ATTRIBUTES,
  onSelectedCountChange,
  onHintStateChange,
  onUseHint,
  triggerHint,
  triggerClearHint,
  pendingBurnRewards,
  onBurnRewardsComplete,
}) => {
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<string[]>([]);
  const [hintCards, setHintCards] = useState<string[]>([]);

  // Use ref for hints to avoid stale closure issues
  const hintsRef = useRef(playerStats.hints);
  hintsRef.current = playerStats.hints;

  // Match counter for tracking independent matches
  const matchCounterRef = useRef(0);

  // Reward reveal state - managed internally, supports multiple concurrent matches
  const [revealingRewards, setRevealingRewards] = useState<(CardReward & { matchId: number })[]>([]);

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

  // When the board changes, clear matched state and hints, but preserve valid selections
  useEffect(() => {
    const cardIds = new Set(cards.map(c => c.id));
    setSelectedCards(prev => prev.filter(c => cardIds.has(c.id)));
    setMatchedCardIds([]); // Always clear - matched cards get replaced
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

  // Handle incoming burn rewards - display them for 1.5s then notify parent
  useEffect(() => {
    if (!pendingBurnRewards || pendingBurnRewards.length === 0) return;

    // Generate a unique matchId for this batch of burn rewards
    const burnMatchId = ++matchCounterRef.current;

    // Add burn rewards to revealing rewards
    const burnRewardsWithMatchId = pendingBurnRewards.map(r => ({ ...r, matchId: burnMatchId }));
    const burnCardIds = pendingBurnRewards.map(r => r.cardId);

    // Mark burned cards as matched so they show the reward
    setMatchedCardIds(prev => [...prev, ...burnCardIds]);
    setRevealingRewards(prev => [...prev, ...burnRewardsWithMatchId]);

    // After 0.5 seconds, clear rewards and notify parent (shorter than regular matches)
    const timeout = setTimeout(() => {
      setRevealingRewards(prev => prev.filter(r => r.matchId !== burnMatchId));
      onBurnRewardsComplete?.(burnCardIds);
    }, 500);

    return () => clearTimeout(timeout);
  }, [pendingBurnRewards, onBurnRewardsComplete]);

  // Check if three cards form a valid set using active attributes
  const isValidSet = (cards: CardType[]): boolean => {
    if (cards.length !== 3) return false;

    return activeAttributes.every(attr => {
      const values = cards.map(card => card[attr as keyof CardType]);
      const allSame = values.every(v => v === values[0]);
      const allDifferent = values.length === new Set(values).size;
      return allSame || allDifferent;
    });
  };

  // Find a hint (a valid set on the board)
  const findHint = useCallback(() => {
    // Use ref to get current hints value without causing re-renders
    const hintsAvailable = hintsRef.current !== undefined && hintsRef.current > 0;
    if (!hintsAvailable) return;

    const availableCards = cards.filter(card => !matchedCardIds.includes(card.id));

    for (let i = 0; i < availableCards.length - 2; i++) {
      for (let j = i + 1; j < availableCards.length - 1; j++) {
        for (let k = j + 1; k < availableCards.length; k++) {
          const potentialSet = [availableCards[i], availableCards[j], availableCards[k]];
          if (isValidSet(potentialSet)) {
            setHintCards(potentialSet.map(c => c.id));
            // Decrement hint count when successfully showing a hint
            onUseHint?.();
            return;
          }
        }
      }
    }

    console.log("No valid sets found on the board");
  }, [cards, matchedCardIds, onUseHint]);

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

  // Auto-hint function - shows hint without consuming player hints
  const showAutoHint = useCallback(() => {
    const availableCards = cards.filter(card => !matchedCardIds.includes(card.id));

    for (let i = 0; i < availableCards.length - 2; i++) {
      for (let j = i + 1; j < availableCards.length - 1; j++) {
        for (let k = j + 1; k < availableCards.length; k++) {
          const potentialSet = [availableCards[i], availableCards[j], availableCards[k]];
          if (isValidSet(potentialSet)) {
            setHintCards(potentialSet.map(c => c.id));
            // Auto-clear after 1.5 seconds
            setTimeout(() => {
              setHintCards([]);
            }, 1500);
            return true;
          }
        }
      }
    }
    return false;
  }, [cards, matchedCardIds]);

  // Auto-hint interval effect
  useEffect(() => {
    const autoHintChance = playerStats.autoHintChance || 0;
    const autoHintInterval = playerStats.autoHintInterval || 10000;

    if (autoHintChance <= 0) return;

    const intervalId = setInterval(() => {
      // Don't show auto-hint if a hint is already showing
      if (hintCards.length > 0) return;

      // Roll auto-hint chance
      if (Math.random() * 100 < autoHintChance) {
        showAutoHint();
      }
    }, autoHintInterval);

    return () => clearInterval(intervalId);
  }, [playerStats.autoHintChance, playerStats.autoHintInterval, hintCards.length, showAutoHint]);

  // Handle card click
  const handleCardClick = (card: CardType) => {
    if (!isPlayerTurn) return;

    // Don't allow clicking on cards that are currently being revealed as rewards
    if (revealingRewards.some(r => r.cardId === card.id)) return;

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
      setTimeout(() => {
        if (isValidSet(newSelectedCards)) {
          // Generate unique match ID for this match
          const matchId = ++matchCounterRef.current;

          // Calculate rewards for matched cards
          const matchedRewards = newSelectedCards.map(c => calculateCardReward(c));

          // Process weapon effects to get additional cards to destroy
          // Pass weapons array for independent laser rolls
          const weaponEffects = processWeaponEffects(cards, newSelectedCards, playerStats, weapons);

          // Create rewards for exploded cards
          const explosionRewards: CardReward[] = weaponEffects.explosiveCards.map(c => ({
            cardId: c.id,
            points: 1,
            money: 1,
            effectType: 'explosion' as const,
          }));

          // Create rewards for laser-destroyed cards
          const laserRewards: CardReward[] = weaponEffects.laserCards.map(c => ({
            cardId: c.id,
            points: 2,
            money: 1,
            effectType: 'laser' as const,
          }));

          // Combine all rewards
          const allRewards = [...matchedRewards, ...explosionRewards, ...laserRewards];
          const rewardsWithMatchId = allRewards.map(r => ({ ...r, matchId }));

          // Collect all affected card IDs
          const allAffectedCardIds = [
            ...newSelectedCards.map(c => c.id),
            ...weaponEffects.explosiveCards.map(c => c.id),
            ...weaponEffects.laserCards.map(c => c.id),
          ];

          // Mark all affected cards as matched and add rewards
          setMatchedCardIds(prev => [...prev, ...allAffectedCardIds]);
          setSelectedCards(prev => prev.filter(c => !newSelectedCards.some(mc => mc.id === c.id)));
          setRevealingRewards(prev => [...prev, ...rewardsWithMatchId]);

          // Collect all cards to replace (matched + weapon effects)
          const allCardsToReplace = [
            ...newSelectedCards,
            ...weaponEffects.explosiveCards,
            ...weaponEffects.laserCards,
          ];

          // After 1.5 seconds, notify parent and clear only this match's rewards
          setTimeout(() => {
            setRevealingRewards(prev => prev.filter(r => r.matchId !== matchId));
            onMatch(allCardsToReplace, allRewards, weaponEffects);
          }, 1500);
        } else {
          // Invalid match - check if player has mulligans for weapon effects
          if (playerStats.mulligans > 0) {
            // Mulligan will be used - treat as a valid match with full rewards!
            const matchId = ++matchCounterRef.current;

            // Calculate full rewards for matched cards (same as valid match)
            const matchedRewards = newSelectedCards.map(c => calculateCardReward(c));

            // Process weapon effects (explosions, lasers, etc.)
            const weaponEffects = processWeaponEffects(cards, newSelectedCards, playerStats, weapons);

            // Create rewards for exploded cards
            const explosionRewards: CardReward[] = weaponEffects.explosiveCards.map(c => ({
              cardId: c.id,
              points: 1,
              money: 1,
              effectType: 'explosion' as const,
            }));

            // Create rewards for laser-destroyed cards
            const laserRewards: CardReward[] = weaponEffects.laserCards.map(c => ({
              cardId: c.id,
              points: 2,
              money: 1,
              effectType: 'laser' as const,
            }));

            // Mark the first matched reward as a mulligan so Game.tsx knows to decrement mulligans
            if (matchedRewards.length > 0) {
              matchedRewards[0].effectType = 'mulligan';
            }

            // Combine all rewards
            const allRewards = [...matchedRewards, ...explosionRewards, ...laserRewards];
            const rewardsWithMatchId = allRewards.map(r => ({ ...r, matchId }));

            // Collect all affected card IDs
            const allAffectedCardIds = [
              ...newSelectedCards.map(c => c.id),
              ...weaponEffects.explosiveCards.map(c => c.id),
              ...weaponEffects.laserCards.map(c => c.id),
            ];

            // Mark all affected cards and add rewards for visual reveal
            setMatchedCardIds(prev => [...prev, ...allAffectedCardIds]);
            setSelectedCards(prev => prev.filter(c => !newSelectedCards.some(mc => mc.id === c.id)));
            setRevealingRewards(prev => [...prev, ...rewardsWithMatchId]);

            // Collect all cards to replace
            const allCardsToReplace = [
              ...newSelectedCards,
              ...weaponEffects.explosiveCards,
              ...weaponEffects.laserCards,
            ];

            // After 1.5 seconds, notify parent with weapon effects
            setTimeout(() => {
              setRevealingRewards(prev => prev.filter(r => r.matchId !== matchId));
              // Call onInvalidSelection but pass weapon effects via onMatch-like behavior
              // We need to signal this is a mulligan match with weapon effects
              onMatch(allCardsToReplace, allRewards, weaponEffects);
            }, 1500);
          } else {
            // No mulligans - just invalid selection
            onInvalidSelection(newSelectedCards);

            setTimeout(() => {
              setSelectedCards(prev => prev.filter(c => !newSelectedCards.some(mc => mc.id === c.id)));
            }, 500);
          }
        }
      }, 200);
    }
  };

  return (
    <View nativeID="gameboard-container" style={styles.container}>
      <View nativeID="gameboard-grid" style={styles.board}>
        {rows.map((row, rowIndex) => {
          // Calculate how many empty slots we need to fill out the row
          const emptySlots = COLUMNS - row.length;

          return (
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
                        disabled={isMatched || !isPlayerTurn}
                      />
                    )}
                  </View>
                );
              })}
              {/* Add empty placeholder slots for incomplete rows */}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <View key={`empty-${rowIndex}-${i}`} style={styles.cardWrapper} />
              ))}
            </View>
          );
        })}
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
    backgroundColor: COLORS.paperBeige,
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
