import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Card as CardType, PlayerStats, CardReward, AttributeName, Weapon } from '@/types';
import Card from './Card';
import RewardReveal from './RewardReveal';
import { COLORS } from '@/utils/colors';
import { MATCH_REWARDS } from '@/utils/gameConfig';
import { processWeaponEffects, WeaponEffectResult } from '@/utils/weaponEffects';
import { isValidCombination } from '@/utils/gameUtils';
import { useAutoHint } from '@/hooks/useAutoHint';
import { useScreenShake } from '@/hooks/useScreenShake';
import { useParticles } from '@/hooks/useParticles';
import { DURATION } from '@/utils/designSystem';
import { triggerHaptic, selectionHaptic } from '@/utils/haptics';

// Default to 4 attributes for backward compatibility
const DEFAULT_ATTRIBUTES: AttributeName[] = ['shape', 'color', 'number', 'shading'];

interface GameBoardProps {
  cards: CardType[];
  onMatch: (cards: CardType[], rewards: CardReward[], weaponEffects?: WeaponEffectResult) => void;
  onMatchStart?: () => void; // Called immediately when a valid match is detected (before animations)
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
  onCardBurn?: (card: CardType) => void; // Called when a card finishes burning (individual card lifecycle)
  isPaused?: boolean; // When true, pauses auto-hint timer and card burn timers (e.g., when menu is open)
  lastMatchTime?: number; // Timestamp of last successful match - auto-hint only triggers 15s after this
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
  onMatchStart,
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
  onCardBurn,
  isPaused = false,
  lastMatchTime,
}) => {
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<string[]>([]);
  const [hintCards, setHintCards] = useState<string[]>([]);

  // Idle detection for ambient breathing animations
  const [isIdle, setIsIdle] = useState(false);
  const [suggestionCardId, setSuggestionCardId] = useState<string | null>(null);
  const lastInteractionTimeRef = useRef(Date.now());

  // Check for idle state (3+ seconds since last interaction)
  // Also trigger suggestion card after 10s of idle
  useEffect(() => {
    const checkIdle = () => {
      const timeSinceInteraction = Date.now() - lastInteractionTimeRef.current;
      setIsIdle(timeSinceInteraction >= 3000);

      // After 10s of no interaction, show a suggestion card
      if (timeSinceInteraction >= 10000 && !suggestionCardId) {
        // Find a valid set and pick one random card from it
        const availableCards = cards.filter(card => !matchedCardIds.includes(card.id));
        for (let i = 0; i < availableCards.length - 2; i++) {
          for (let j = i + 1; j < availableCards.length - 1; j++) {
            for (let k = j + 1; k < availableCards.length; k++) {
              const potentialSet = [availableCards[i], availableCards[j], availableCards[k]];
              // Check if valid set using active attributes
              const isValid = activeAttributes.every(attr => {
                const values = potentialSet.map(card => card[attr as keyof CardType]);
                const allSame = values.every(v => v === values[0]);
                const allDifferent = values.length === new Set(values).size;
                return allSame || allDifferent;
              });
              if (isValid) {
                // Pick a random card from the valid set
                const randomCard = potentialSet[Math.floor(Math.random() * 3)];
                setSuggestionCardId(randomCard.id);
                return;
              }
            }
          }
        }
      }
    };

    // Check immediately and then every second
    checkIdle();
    const interval = setInterval(checkIdle, 1000);

    return () => clearInterval(interval);
  }, [cards, matchedCardIds, activeAttributes, suggestionCardId]);

  // Reset idle timer and clear suggestion on any card selection
  useEffect(() => {
    if (selectedCards.length > 0) {
      lastInteractionTimeRef.current = Date.now();
      setIsIdle(false);
      setSuggestionCardId(null);
    }
  }, [selectedCards]);

  // Screen shake for explosions and failures
  const { shakeStyle, triggerShake, shake } = useScreenShake();

  // Subtle background color animation - creates ambient life
  const backgroundProgress = useSharedValue(0);

  useEffect(() => {
    // Very slow color shift cycle (45 seconds)
    backgroundProgress.value = withRepeat(
      withTiming(1, { duration: 45000, easing: Easing.inOut(Easing.sin) }),
      -1, // infinite
      true // reverse
    );
  }, [backgroundProgress]);

  const animatedBoardStyle = useAnimatedStyle(() => {
    // Subtle shift between paper beige variants
    const backgroundColor = interpolateColor(
      backgroundProgress.value,
      [0, 0.5, 1],
      [COLORS.paperBeige, '#F5EFE6', '#FAF6F0'] // Very subtle warm/cool variants
    );

    return { backgroundColor };
  });

  // Flash overlay animations
  const successFlashOpacity = useSharedValue(0);
  const failureFlashOpacity = useSharedValue(0);

  const successFlashStyle = useAnimatedStyle(() => ({
    opacity: successFlashOpacity.value,
  }));

  const failureFlashStyle = useAnimatedStyle(() => ({
    opacity: failureFlashOpacity.value,
  }));

  // Trigger success flash
  const triggerSuccessFlash = useCallback(() => {
    successFlashOpacity.value = withSequence(
      withTiming(0.15, { duration: 50 }),
      withTiming(0, { duration: DURATION.fast })
    );
  }, [successFlashOpacity]);

  // Trigger failure flash and shake
  const triggerFailureFlash = useCallback(() => {
    failureFlashOpacity.value = withSequence(
      withTiming(0.2, { duration: 50 }),
      withTiming(0, { duration: DURATION.normal })
    );
    shake('medium');
  }, [failureFlashOpacity, shake]);

  // Particle effects for explosions
  const { spawnParticles, Particles } = useParticles();

  // Card position refs for particle spawning (we'll estimate center of board)
  const boardRef = useRef<View>(null);

  // Trigger explosion particles at estimated card positions
  const triggerExplosionParticles = useCallback((cardCount: number) => {
    // Spawn particles at center of board area (estimated)
    // In a real implementation, we'd track card positions
    const centerX = 150; // Approximate center
    const centerY = 200;

    for (let i = 0; i < cardCount; i++) {
      // Offset each explosion slightly for visual variety
      const offsetX = (Math.random() - 0.5) * 100;
      const offsetY = (Math.random() - 0.5) * 100;
      spawnParticles(15, { x: centerX + offsetX, y: centerY + offsetY }, 'explosion');
    }
  }, [spawnParticles]);

  // Use ref for hints to avoid stale closure issues
  const hintsRef = useRef(playerStats.hints);
  hintsRef.current = playerStats.hints;

  // Use ref for burn callback to avoid stale closures
  const onCardBurnRef = useRef(onCardBurn);
  onCardBurnRef.current = onCardBurn;

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

  // Handle card burn completion - called by individual Card components when they finish burning
  const handleCardBurnComplete = useCallback((card: CardType) => {
    // Generate unique ID for this burn reward
    const burnMatchId = ++matchCounterRef.current;

    // Create burn reward for this single card
    const burnReward: CardReward & { matchId: number } = {
      cardId: card.id,
      points: 1,
      money: 1,
      effectType: 'fire' as const,
      matchId: burnMatchId,
    };

    // Mark this card as matched and show its reward
    setMatchedCardIds(prev => [...prev, card.id]);
    setRevealingRewards(prev => [...prev, burnReward]);

    // Notify parent immediately (non-blocking) so card gets replaced and fire can spread
    onCardBurnRef.current?.(card);

    // Clear this card's reward after 1.5s (independent of other cards)
    setTimeout(() => {
      setRevealingRewards(prev => prev.filter(r => r.matchId !== burnMatchId));
    }, 1500);
  }, []);

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
  // By default shows only 1 card from a valid set; with Mystic Sight weapon, has a chance to show 2
  const showAutoHint = useCallback(() => {
    const availableCards = cards.filter(card => !matchedCardIds.includes(card.id));

    for (let i = 0; i < availableCards.length - 2; i++) {
      for (let j = i + 1; j < availableCards.length - 1; j++) {
        for (let k = j + 1; k < availableCards.length; k++) {
          const potentialSet = [availableCards[i], availableCards[j], availableCards[k]];
          if (isValidSet(potentialSet)) {
            // Determine how many cards to show (1 default, 2 with enhancedHintChance from Mystic Sight)
            const enhancedHintChance = playerStats.enhancedHintChance || 0;
            const showTwoCards = enhancedHintChance > 0 && Math.random() * 100 < enhancedHintChance;
            const cardsToShow = showTwoCards ? 2 : 1;

            // Randomly select which card(s) to reveal from the valid set
            const shuffled = [...potentialSet].sort(() => Math.random() - 0.5);
            const hintCardIds = shuffled.slice(0, cardsToShow).map(c => c.id);

            setHintCards(hintCardIds);
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
  }, [cards, matchedCardIds, playerStats.enhancedHintChance]);

  // Auto-hint - triggers after period of inactivity
  useAutoHint({
    autoHintChance: playerStats.autoHintChance || 0,
    autoHintInterval: playerStats.autoHintInterval || 0,
    isPaused,
    hasActiveHint: hintCards.length > 0,
    lastMatchTime,
    onTrigger: showAutoHint,
  });

  // Handle card click
  const handleCardClick = (card: CardType) => {
    if (!isPlayerTurn) return;

    // Don't allow clicking on cards that are currently being revealed as rewards
    if (revealingRewards.some(r => r.cardId === card.id)) return;

    // If card is already selected, deselect it
    if (selectedCards.some(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
      selectionHaptic(); // Light haptic on deselect
      return;
    }

    // Haptic feedback for card selection
    selectionHaptic();

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
          // Immediately notify parent that match started (for particle effects)
          onMatchStart?.();

          // Trigger success flash and haptic
          triggerSuccessFlash();
          triggerHaptic('success');

          // Generate unique match ID for this match
          const matchId = ++matchCounterRef.current;

          // Calculate rewards for matched cards
          const matchedRewards = newSelectedCards.map(c => calculateCardReward(c));

          // Process weapon effects to get additional cards to destroy
          // Pass weapons array for independent laser rolls, and activeAttributes for echo
          const weaponEffects = processWeaponEffects(cards, newSelectedCards, playerStats, weapons, activeAttributes, false);

          // Trigger screen shake and particles for explosions
          if (weaponEffects.explosiveCards.length > 0) {
            triggerShake(weaponEffects.explosiveCards.length);
            triggerExplosionParticles(weaponEffects.explosiveCards.length);
          }

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

          // Create rewards for ricocheted cards
          const ricochetRewards: CardReward[] = weaponEffects.ricochetCards.map(c => ({
            cardId: c.id,
            points: 1,
            money: 1,
            effectType: 'ricochet' as const,
          }));

          // Process auto-matched sets from Echo Stone
          const echoRewards: CardReward[] = [];
          const echoCards: CardType[] = [];

          // Track all cards already being processed to exclude from echo weapon effects
          let allProcessedCards = [
            ...newSelectedCards,
            ...weaponEffects.explosiveCards,
            ...weaponEffects.laserCards,
            ...weaponEffects.ricochetCards,
          ];

          for (const echoSet of weaponEffects.autoMatchedSets) {
            // Add rewards for the echo-matched cards
            echoSet.forEach(c => {
              echoRewards.push({
                cardId: c.id,
                points: MATCH_REWARDS.basePoints + (c.bonusPoints || 0),
                money: MATCH_REWARDS.baseMoney + (c.bonusMoney || 0),
                experience: MATCH_REWARDS.baseExperience,
              });
              echoCards.push(c);
            });

            // Process weapon effects for the echo match (but with isEchoMatch=true to prevent infinite loops)
            const echoEffects = processWeaponEffects(
              cards,
              echoSet,
              playerStats,
              weapons,
              activeAttributes,
              true // isEchoMatch - prevents more echoes
            );

            // Add explosion rewards from echo
            echoEffects.explosiveCards.forEach(c => {
              if (!allProcessedCards.some(pc => pc.id === c.id)) {
                echoRewards.push({ cardId: c.id, points: 1, money: 1, effectType: 'explosion' as const });
                echoCards.push(c);
                allProcessedCards.push(c);
              }
            });

            // Add laser rewards from echo
            echoEffects.laserCards.forEach(c => {
              if (!allProcessedCards.some(pc => pc.id === c.id)) {
                echoRewards.push({ cardId: c.id, points: 2, money: 1, effectType: 'laser' as const });
                echoCards.push(c);
                allProcessedCards.push(c);
              }
            });

            // Add ricochet rewards from echo
            echoEffects.ricochetCards.forEach(c => {
              if (!allProcessedCards.some(pc => pc.id === c.id)) {
                echoRewards.push({ cardId: c.id, points: 1, money: 1, effectType: 'ricochet' as const });
                echoCards.push(c);
                allProcessedCards.push(c);
              }
            });

            // Accumulate bonus stats from echo effects
            weaponEffects.bonusHealing += echoEffects.bonusHealing;
            weaponEffects.bonusHints += echoEffects.bonusHints;
            weaponEffects.bonusTime += echoEffects.bonusTime;
            weaponEffects.bonusGraces += echoEffects.bonusGraces;
            weaponEffects.bonusPoints += echoEffects.bonusPoints;
            weaponEffects.bonusMoney += echoEffects.bonusMoney;
            weaponEffects.boardGrowth += echoEffects.boardGrowth;
            weaponEffects.notifications.push(...echoEffects.notifications);

            // Mark the echo set as processed
            allProcessedCards.push(...echoSet);
          }

          // Combine all rewards
          const allRewards = [...matchedRewards, ...explosionRewards, ...laserRewards, ...ricochetRewards, ...echoRewards];
          const rewardsWithMatchId = allRewards.map(r => ({ ...r, matchId }));

          // Collect all affected card IDs
          const allAffectedCardIds = [
            ...newSelectedCards.map(c => c.id),
            ...weaponEffects.explosiveCards.map(c => c.id),
            ...weaponEffects.laserCards.map(c => c.id),
            ...weaponEffects.ricochetCards.map(c => c.id),
            ...echoCards.map(c => c.id),
          ];

          // Mark all affected cards as matched and add rewards
          setMatchedCardIds(prev => [...prev, ...allAffectedCardIds]);
          setSelectedCards(prev => prev.filter(c => !newSelectedCards.some(mc => mc.id === c.id)));
          setRevealingRewards(prev => [...prev, ...rewardsWithMatchId]);

          // Collect all cards to replace (matched + weapon effects + echo)
          const allCardsToReplace = [
            ...newSelectedCards,
            ...weaponEffects.explosiveCards,
            ...weaponEffects.laserCards,
            ...weaponEffects.ricochetCards,
            ...echoCards,
          ];

          // After 1.5 seconds, notify parent and clear only this match's rewards
          setTimeout(() => {
            setRevealingRewards(prev => prev.filter(r => r.matchId !== matchId));
            onMatch(allCardsToReplace, allRewards, weaponEffects);
          }, 1500);
        } else {
          // Invalid match - check if grace can save (ONLY when exactly 1 attribute is wrong)
          const validationResult = isValidCombination(newSelectedCards, activeAttributes);
          const invalidCount = validationResult.invalidAttributes.length;
          const graceCanSave = invalidCount === 1 && playerStats.graces > 0;

          if (graceCanSave) {
            // Grace saves! (exactly 1 attribute wrong) - treat as valid match with full rewards
            // Immediately notify parent that match started (for particle effects)
            onMatchStart?.();

            // Trigger success flash (grace is still a success!) with warning haptic
            triggerSuccessFlash();
            triggerHaptic('warning'); // Warning to indicate grace was used

            const matchId = ++matchCounterRef.current;

            // Calculate full rewards for matched cards (same as valid match)
            const matchedRewards = newSelectedCards.map(c => calculateCardReward(c));

            // Process weapon effects (explosions, lasers, etc.)
            const weaponEffects = processWeaponEffects(cards, newSelectedCards, playerStats, weapons, activeAttributes, false);

            // Trigger screen shake and particles for explosions
            if (weaponEffects.explosiveCards.length > 0) {
              triggerShake(weaponEffects.explosiveCards.length);
              triggerExplosionParticles(weaponEffects.explosiveCards.length);
            }

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

            // Create rewards for ricocheted cards
            const ricochetRewards: CardReward[] = weaponEffects.ricochetCards.map(c => ({
              cardId: c.id,
              points: 1,
              money: 1,
              effectType: 'ricochet' as const,
            }));

            // Process auto-matched sets from Echo Stone (grace matches can trigger echo too!)
            const echoRewards: CardReward[] = [];
            const echoCards: CardType[] = [];

            let allProcessedCards = [
              ...newSelectedCards,
              ...weaponEffects.explosiveCards,
              ...weaponEffects.laserCards,
              ...weaponEffects.ricochetCards,
            ];

            for (const echoSet of weaponEffects.autoMatchedSets) {
              echoSet.forEach(c => {
                echoRewards.push({
                  cardId: c.id,
                  points: MATCH_REWARDS.basePoints + (c.bonusPoints || 0),
                  money: MATCH_REWARDS.baseMoney + (c.bonusMoney || 0),
                  experience: MATCH_REWARDS.baseExperience,
                });
                echoCards.push(c);
              });

              const echoEffects = processWeaponEffects(
                cards,
                echoSet,
                playerStats,
                weapons,
                activeAttributes,
                true
              );

              echoEffects.explosiveCards.forEach(c => {
                if (!allProcessedCards.some(pc => pc.id === c.id)) {
                  echoRewards.push({ cardId: c.id, points: 1, money: 1, effectType: 'explosion' as const });
                  echoCards.push(c);
                  allProcessedCards.push(c);
                }
              });

              echoEffects.laserCards.forEach(c => {
                if (!allProcessedCards.some(pc => pc.id === c.id)) {
                  echoRewards.push({ cardId: c.id, points: 2, money: 1, effectType: 'laser' as const });
                  echoCards.push(c);
                  allProcessedCards.push(c);
                }
              });

              echoEffects.ricochetCards.forEach(c => {
                if (!allProcessedCards.some(pc => pc.id === c.id)) {
                  echoRewards.push({ cardId: c.id, points: 1, money: 1, effectType: 'ricochet' as const });
                  echoCards.push(c);
                  allProcessedCards.push(c);
                }
              });

              weaponEffects.bonusHealing += echoEffects.bonusHealing;
              weaponEffects.bonusHints += echoEffects.bonusHints;
              weaponEffects.bonusTime += echoEffects.bonusTime;
              weaponEffects.bonusGraces += echoEffects.bonusGraces;
              weaponEffects.bonusPoints += echoEffects.bonusPoints;
              weaponEffects.bonusMoney += echoEffects.bonusMoney;
              weaponEffects.boardGrowth += echoEffects.boardGrowth;
              weaponEffects.notifications.push(...echoEffects.notifications);

              allProcessedCards.push(...echoSet);
            }

            // Mark the first matched reward as a grace so Game.tsx knows to decrement graces
            if (matchedRewards.length > 0) {
              matchedRewards[0].effectType = 'grace';
            }

            // Combine all rewards
            const allRewards = [...matchedRewards, ...explosionRewards, ...laserRewards, ...ricochetRewards, ...echoRewards];
            const rewardsWithMatchId = allRewards.map(r => ({ ...r, matchId }));

            // Collect all affected card IDs
            const allAffectedCardIds = [
              ...newSelectedCards.map(c => c.id),
              ...weaponEffects.explosiveCards.map(c => c.id),
              ...weaponEffects.laserCards.map(c => c.id),
              ...weaponEffects.ricochetCards.map(c => c.id),
              ...echoCards.map(c => c.id),
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
              ...weaponEffects.ricochetCards,
              ...echoCards,
            ];

            // After 1.5 seconds, notify parent with weapon effects
            setTimeout(() => {
              setRevealingRewards(prev => prev.filter(r => r.matchId !== matchId));
              // Call onInvalidSelection but pass weapon effects via onMatch-like behavior
              // We need to signal this is a grace match with weapon effects
              onMatch(allCardsToReplace, allRewards, weaponEffects);
            }, 1500);
          } else {
            // 2+ attributes wrong OR no graces - full invalid match (lose health)
            // Trigger failure flash, shake, and error haptic
            triggerFailureFlash();
            triggerHaptic('error');

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
    <Animated.View nativeID="gameboard-container" style={[styles.container, shakeStyle]}>
      {/* Success flash overlay */}
      <Animated.View
        style={[styles.flashOverlay, styles.successFlash, successFlashStyle]}
        pointerEvents="none"
      />
      {/* Failure flash overlay */}
      <Animated.View
        style={[styles.flashOverlay, styles.failureFlash, failureFlashStyle]}
        pointerEvents="none"
      />
      {/* Particle effects */}
      <Particles />
      <Animated.View nativeID="gameboard-grid" style={[styles.board, animatedBoardStyle]}>
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
                        onBurnComplete={handleCardBurnComplete}
                        isPaused={isPaused}
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
      </Animated.View>
    </Animated.View>
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
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  successFlash: {
    backgroundColor: '#FFFFFF',
  },
  failureFlash: {
    backgroundColor: '#EF4444',
  },
});

export default GameBoard;
