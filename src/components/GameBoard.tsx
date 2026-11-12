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
import { Card as CardType, PlayerStats, CardReward, AttributeName, Weapon, Shape, Color, BoardConnection } from '@/types';
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import Card from './Card';
import RewardReveal from './RewardReveal';
import { COLORS } from '@/utils/colors';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { isValidCombination } from '@/utils/gameUtils';
import { findSet, resolveMatch } from '@/utils/matchResolution';
import { useAutoHint } from '@/hooks/useAutoHint';
import { useAutoPlayer } from '@/hooks/useAutoPlayer';
import { useScreenShake } from '@/hooks/useScreenShake';
import { useParticles } from '@/hooks/useParticles';
import { DURATION } from '@/utils/animation';
import { triggerHaptic, selectionHaptic } from '@/utils/haptics';
import { playSound } from '@/utils/sounds';
import {
  InactivityBar,
  ScoreDecayIndicator,
  TimerSpeedBadge,
  WeaponCounterBadge,
  EnemyPortrait,
  DefeatProgress,
} from './enemy-ui';
import type { EnemyReactionEvent } from '@/utils/enemyAnimations';

/** How long a matched card's reward stays on screen before the card is replaced. */
const REWARD_REVEAL_MS = 1500;

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
  onBoardIdleChange?: (isIdle: boolean) => void;
  onUseHint?: () => void;
  triggerHint?: number;
  triggerClearHint?: number;
  onCardBurn?: (card: CardType) => void; // Called when a card finishes burning (individual card lifecycle)
  isPaused?: boolean; // When true, pauses auto-hint timer and card burn timers (e.g., when menu is open)
  lastMatchTime?: number; // Timestamp of last successful match - auto-hint only triggers 15s after this
  autoPlayer?: boolean; // When true, automatically finds and selects valid SETs (for testing/review)
  enemy?: EnemyInstance | null; // Active enemy for current round
  roundStats?: React.MutableRefObject<RoundStats>; // Mutable ref to round stats (from useRoundStats)
  // Time gain trigger cap system
  timeGainContext?: {
    triggersThisRound: number;
    effectiveCap: number;
  };
  onTimeGainTriggered?: () => void; // Called when time gain triggers (for tracking)
  connections?: BoardConnection[]; // Active connections between board positions
  hideEnemyOverlay?: boolean; // Adventure mode renders its own foe HUD
  /** Cards the parent wants lit as hints (e.g. a free hint from a fighter passive) */
  glowingCardIds?: string[];
}

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
  onBoardIdleChange,
  onUseHint,
  triggerHint,
  triggerClearHint,
  onCardBurn,
  isPaused = false,
  lastMatchTime,
  autoPlayer = false,
  enemy,
  roundStats,
  timeGainContext,
  onTimeGainTriggered,
  connections = [],
  hideEnemyOverlay = false,
  glowingCardIds,
}) => {
  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<string[]>([]);
  const [hintCards, setHintCards] = useState<string[]>([]);

  // Get enemy UI modifiers early for hint disable checks
  const enemyUIModifiers = useMemo(() => {
    return enemy?.getUIModifiers() ?? {};
  }, [enemy]);

  const [enemyReaction, setEnemyReaction] = useState<EnemyReactionEvent | null>(null);
  const enemyReactionSeq = useRef(0);

  // Idle detection for the fighter's sleepy state
  const [isSleepyIdle, setIsSleepyIdle] = useState(false);
  const lastInteractionTimeRef = useRef(Date.now());

  // Trigger fighter sleepy state after 8s without interaction
  useEffect(() => {
    const checkIdle = () => {
      const timeSinceInteraction = Date.now() - lastInteractionTimeRef.current;
      setIsSleepyIdle(timeSinceInteraction >= 8000);
    };

    // Check immediately and then every second
    checkIdle();
    const interval = setInterval(checkIdle, 1000);

    return () => clearInterval(interval);
  }, []);

  // Reset idle timer on any card selection
  useEffect(() => {
    if (selectedCards.length > 0) {
      lastInteractionTimeRef.current = Date.now();
      setIsSleepyIdle(false);
    }
  }, [selectedCards]);

  // Report sleepy board-idle state to parent (for fighter drowsy animation)
  useEffect(() => {
    onBoardIdleChange?.(isSleepyIdle);
  }, [isSleepyIdle, onBoardIdleChange]);

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

  const successFlashOpacity = useSharedValue(0);
  const failureFlashOpacity = useSharedValue(0);

  const successFlashStyle = useAnimatedStyle(() => ({
    opacity: successFlashOpacity.value,
  }));

  const failureFlashStyle = useAnimatedStyle(() => ({
    opacity: failureFlashOpacity.value,
  }));

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
    }, REWARD_REVEAL_MS);
  }, []);

  // Find a hint (a valid set on the board)
  // Excludes dud cards and face-down cards from hint calculation
  const findHint = useCallback(() => {
    // Check if manual hints are disabled by enemy (e.g., Creeping Shadow)
    if (enemyUIModifiers.disableManualHint === true) return;

    // Use ref to get current hints value without causing re-renders
    const hintsAvailable = hintsRef.current !== undefined && hintsRef.current > 0;
    if (!hintsAvailable) return;

    // Exclude matched, dud, and face-down cards from hint calculation
    const availableCards = cards.filter(card =>
      !matchedCardIds.includes(card.id) &&
      !card.isDud &&
      !card.isFaceDown
    );

    const set = findSet(availableCards, activeAttributes);
    if (!set) return;
    setHintCards(set.map(c => c.id));
    onUseHint?.();
  }, [cards, matchedCardIds, onUseHint, enemyUIModifiers.disableManualHint, activeAttributes]);

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
  // Excludes dud cards and face-down cards from hint calculation
  const showAutoHint = useCallback(() => {
    const availableCards = cards.filter(card =>
      !matchedCardIds.includes(card.id) &&
      !card.isDud &&
      !card.isFaceDown
    );

    const set = findSet(availableCards, activeAttributes);
    if (!set) return false;

    // 1 card by default; Mystic Sight's enhancedHintChance can reveal 2
    const enhancedHintChance = playerStats.enhancedHintChance || 0;
    const showTwoCards = enhancedHintChance > 0 && Math.random() * 100 < enhancedHintChance;
    const shuffled = [...set].sort(() => Math.random() - 0.5);
    setHintCards(shuffled.slice(0, showTwoCards ? 2 : 1).map(c => c.id));
    setTimeout(() => {
      setHintCards([]);
    }, REWARD_REVEAL_MS);
    return true;
  }, [cards, matchedCardIds, playerStats.enhancedHintChance, activeAttributes]);

  // Auto-hint - triggers after period of inactivity
  // Auto-hint disabled by enemy (e.g., Masked Bandit)
  const autoHintDisabled = enemyUIModifiers.disableAutoHint === true;

  useAutoHint({
    autoHintChance: autoHintDisabled ? 0 : (playerStats.autoHintChance || 0),
    autoHintInterval: autoHintDisabled ? 0 : (playerStats.autoHintInterval || 0),
    isPaused,
    hasActiveHint: hintCards.length > 0,
    lastMatchTime,
    onTrigger: showAutoHint,
  });

  const handleCardClick = (card: CardType) => {
    if (!isPlayerTurn || card.isDud || card.isFaceDown) return;

    // Don't allow clicking on cards that are currently being revealed as rewards
    if (revealingRewards.some(r => r.cardId === card.id)) return;

    // If card is already selected, deselect it
    if (selectedCards.some(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
      selectionHaptic(); // Light haptic on deselect
      playSound('click');
      return;
    }

    // Haptic feedback for card selection
    selectionHaptic();
    playSound('click');

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
        // A selection that is exactly one attribute off still counts if a grace can cover it
        const validation = isValidCombination(newSelectedCards, activeAttributes);
        const graceUsed = !validation.isValid && validation.invalidAttributes.length === 1 && playerStats.graces > 0;

        if (validation.isValid || graceUsed) {
          onMatchStart?.();
          triggerSuccessFlash();
          triggerHaptic(graceUsed ? 'warning' : 'success');
          playSound(graceUsed ? 'graceUsed' : 'matchValid');

          const matchId = ++matchCounterRef.current;
          const { cards: affectedCards, rewards, weaponEffects, connectedCards } = resolveMatch({
            board: cards,
            selected: newSelectedCards,
            playerStats,
            weapons,
            activeAttributes,
            connections,
            timeGainContext,
            graceUsed,
          });

          if (weaponEffects.timeGainTriggered) onTimeGainTriggered?.();

          if (weaponEffects.explosiveCards.length > 0) {
            triggerShake(weaponEffects.explosiveCards.length);
            triggerExplosionParticles(weaponEffects.explosiveCards.length);
          }
          // A grace save is announced by its own sound, so the weapon sounds stay quiet
          if (!graceUsed) {
            if (weaponEffects.explosiveCards.length > 0) playSound('explosion');
            if (weaponEffects.laserCount > 0) playSound('laser');
            if (weaponEffects.ricochetCards.length > 0) playSound('ricochet');
          }
          if (connectedCards.length > 0) playSound('ricochet');

          // Multi-hit cards (health > 1) stay on the board with one less health
          const removedIds = affectedCards.filter(c => c.health === undefined || c.health <= 1).map(c => c.id);
          setMatchedCardIds(prev => [...prev, ...removedIds]);
          setSelectedCards(prev => prev.filter(c => !newSelectedCards.some(mc => mc.id === c.id)));
          setRevealingRewards(prev => [...prev, ...rewards.map(r => ({ ...r, matchId }))]);

          const weaponsFired =
            weaponEffects.explosiveCards.length > 0 || weaponEffects.laserCount > 0 || weaponEffects.ricochetCards.length > 0;
          enemyReactionSeq.current += 1;
          setEnemyReaction({ type: weaponsFired ? 'crit_pain' : 'pain', id: enemyReactionSeq.current });

          // Tell the parent straight away, so the score counts even if the timer runs out mid-animation
          onMatch(affectedCards, rewards, weaponEffects);

          setTimeout(() => {
            setRevealingRewards(prev => prev.filter(r => r.matchId !== matchId));
          }, REWARD_REVEAL_MS);
        } else {
          triggerFailureFlash();
          triggerHaptic('error');
          playSound('matchInvalid');

          enemyReactionSeq.current += 1;
          setEnemyReaction({ type: 'taunt', id: enemyReactionSeq.current });
          onInvalidSelection(newSelectedCards);

          setTimeout(() => {
            setSelectedCards(prev => prev.filter(c => !newSelectedCards.some(mc => mc.id === c.id)));
          }, 500);
        }
      }, 200);
    }
  };

  // Auto-player - automatically finds and selects valid SETs (for testing/review)
  useAutoPlayer({
    isActive: autoPlayer && isPlayerTurn,
    isPaused,
    cards,
    activeAttributes,
    matchedCardIds,
    graces: playerStats.graces ?? 0,
    onSelectCard: handleCardClick,
  });

  // Get current round stats for defeat progress display
  const currentRoundStats: RoundStats = roundStats?.current ?? {
    totalMatches: 0,
    currentStreak: 0,
    maxStreak: 0,
    invalidMatches: 0,
    matchTimes: [],
    timeRemaining: 0,
    cardsRemaining: cards.length,
    tripleCardsCleared: 0,
    faceDownCardsMatched: 0,
    bombsDefused: 0,
    countdownCardsMatched: 0,
    shapesMatched: new Set<Shape>(),
    colorsMatched: new Set<Color>(),
    colorMatchCounts: new Map<Color, number>(),
    allDifferentMatches: 0,
    allSameColorMatches: 0,
    squiggleMatches: 0,
    gracesUsed: 0,
    hintsUsed: 0,
    hintsRemaining: playerStats.hints ?? 0,
    gracesRemaining: playerStats.graces ?? 0,
    damageReceived: 0,
    weaponEffectsTriggered: new Set<string>(),
    currentScore: 0,
    targetScore: 0,
    timeGainTriggersThisRound: 0,
    timeGainTriggerCapBonus: 0,
    consecutiveInvalidMatches: 0,
    prismaticPerfectionTriggered: false,
    tabulaRasaTriggered: false,
  };

  return (
    <Animated.View testID="game-board" nativeID="gameboard-container" style={[styles.container, shakeStyle]}>
      <Animated.View
        style={[styles.flashOverlay, styles.successFlash, successFlashStyle]}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.flashOverlay, styles.failureFlash, failureFlashStyle]}
        pointerEvents="none"
      />
      <Particles />

      {/* Enemy UI Overlay - Shows enemy info and status effects */}
      {enemy && enemy.name !== 'Dummy' && !hideEnemyOverlay && (
        <View style={styles.enemyOverlay} pointerEvents="box-none">
          {/* Top row: Enemy portrait and defeat progress */}
          <View style={styles.enemyTopRow}>
            {(() => {
              const stretchDefeated =
                currentRoundStats && typeof enemy.checkDefeatCondition === 'function'
                  ? enemy.checkDefeatCondition(currentRoundStats)
                  : false;
              const matchWear = Math.min(3, Math.floor((currentRoundStats?.totalMatches ?? 0) / 2));
              return (
                <EnemyPortrait
                  enemy={enemy}
                  hp={stretchDefeated ? 0 : Math.max(1, 4 - matchWear)}
                  maxHp={4}
                  mood={enemy.tier >= 4 ? 'enraged' : 'menacing'}
                  reaction={enemyReaction}
                />
              );
            })()}
            <DefeatProgress enemy={enemy} stats={currentRoundStats} />
          </View>

          {/* Status effects row: Inactivity bar, score decay, timer speed, weapon counters */}
          <View style={styles.enemyStatusRow}>
            {enemyUIModifiers.showInactivityBar && (
              <InactivityBar
                current={enemyUIModifiers.showInactivityBar.current}
                max={enemyUIModifiers.showInactivityBar.max}
                penalty={enemyUIModifiers.showInactivityBar.penalty}
              />
            )}

            {enemyUIModifiers.showScoreDecay && (
              <ScoreDecayIndicator rate={enemyUIModifiers.showScoreDecay.rate} />
            )}

            {enemyUIModifiers.timerSpeedMultiplier && enemyUIModifiers.timerSpeedMultiplier !== 1 && (
              <TimerSpeedBadge multiplier={enemyUIModifiers.timerSpeedMultiplier} />
            )}

            {enemyUIModifiers.weaponCounters?.map((counter, index) => (
              <WeaponCounterBadge
                key={`${counter.type}-${index}`}
                type={counter.type}
                reduction={counter.reduction}
              />
            ))}
          </View>
        </View>
      )}

      <Animated.View nativeID="gameboard-grid" style={[styles.board, animatedBoardStyle]}>
        {rows.map((row, rowIndex) => {
          // Calculate how many empty slots we need to fill out the row
          const emptySlots = COLUMNS - row.length;

          return (
            <View key={rowIndex} nativeID={`card-row-${rowIndex}`} style={styles.row}>
              {row.map((card, colIndex) => {
                const isSelected = selectedCards.some(c => c.id === card.id);
                const isMatched = matchedCardIds.includes(card.id);
                const isHint = hintCards.includes(card.id) || (glowingCardIds?.includes(card.id) ?? false);
                const reward = rewardsByCardId.get(card.id);

                // Calculate board index for connection checking
                const boardIndex = rowIndex * COLUMNS + colIndex;
                const isConnected = connections.some(
                  conn => conn.positionA === boardIndex || conn.positionB === boardIndex
                );

                const cardWithState = {
                  ...card,
                  selected: isSelected,
                  isHint: isHint
                };

                return (
                  <View key={`${rowIndex}-${colIndex}-${card.id}`} nativeID={`card-slot-${rowIndex}-${colIndex}`} testID={`card-slot-${rowIndex}-${colIndex}`} style={styles.cardWrapper}>
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
                        isConnected={isConnected}
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
  enemyOverlay: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    zIndex: 50,
    gap: 4,
  },
  enemyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  enemyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  // Note: Connection state is now shown via small icon on card, not border glow
  // Borders/outlines are EXCLUSIVELY reserved for selection state
});

export default GameBoard;
