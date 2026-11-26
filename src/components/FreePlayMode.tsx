import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { trackFreePlayFight, type FunRating } from '@/analytics/fightEvent';
import { loadAdventureSave } from '@/adventure/save';
import { dealBoardAndDeck } from '@/game/board';
import { createInitialGameState } from '@/game/gameState';
import type { GameState } from '@/game/types';
import { useAppActive } from '@/hooks/useAppActive';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { useParticles } from '@/hooks/useParticles';
import type { AttributeName, Card, CardReward, FreePlayDifficulty } from '@/types';
import { COLORS } from '@/utils/colors';
import { ATTRIBUTE_SCALING, getAdjustedLevelFromXP } from '@/utils/gameConfig';
import { calculatePlayerTotalStats, initializePlayer } from '@/utils/gameDefinitions';
import { createDeck, isValidCombination, sameCardAttributes } from '@/utils/gameUtils';
import { playCardDealing, playSound } from '@/utils/sounds';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import DifficultySelection from './DifficultySelection';
import FreePlayHeader from './FreePlayHeader';
import GameBoard from './GameBoard';
import Notification from './Notification';

interface FreePlayModeProps {
  onExit: () => void;
  autoPlayer?: boolean;
}

const createEmptyFreePlayState = (characterName: string): GameState => {
  const activeAttributes: AttributeName[] = [...ATTRIBUTE_SCALING.difficultyPresets.easy];
  return createInitialGameState({
    player: initializePlayer('player1', 'Player 1', characterName),
    activeAttributes,
  });
};

/**
 * Self-contained Free Play mode (no timer, no score targets, no heart game-over).
 * Mounts DifficultySelection for 1-tap launch, then FreePlayHeader + GameBoard.
 */
const FreePlayMode: React.FC<FreePlayModeProps> = ({ onExit, autoPlayer = false }) => {
  const defaultCharacter = useMemo(() => {
    try {
      return loadAdventureSave().selectedFighter || 'Orange Tabby';
    } catch {
      return 'Orange Tabby';
    }
  }, []);

  const [difficulty, setDifficulty] = useState<FreePlayDifficulty | null>(null);
  const [state, setState] = useState<GameState>(() => createEmptyFreePlayState(defaultCharacter));
  const [mistakes, setMistakes] = useState(0);
  const [hasActiveHint, setHasActiveHint] = useState(false);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [clearHintTrigger, setClearHintTrigger] = useState(0);
  const [lastMatchTime, setLastMatchTime] = useState<number>(() => Date.now());
  const [funRating, setFunRating] = useState<FunRating | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const sessionRef = useRef<{ fightId: string; startedAt: number; difficulty: FreePlayDifficulty } | null>(null);
  const replaceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPendingTimers = useCallback(() => {
    replaceTimersRef.current.forEach(clearTimeout);
    replaceTimersRef.current = [];
  }, []);

  useEffect(() => clearPendingTimers, [clearPendingTimers]);

  const appActive = useAppActive();
  const { spawnParticles, Particles } = useParticles();
  const totalStats = useMemo(() => calculatePlayerTotalStats(state.player), [state.player]);
  const fighter = useFighterConductor({
    health: totalStats.health,
    maxHealth: totalStats.maxHealth,
    score: state.score,
    targetScore: state.targetScore,
    isActiveRound: difficulty !== null,
  });

  useEffect(() => {
    if (difficulty !== null) {
      fighter.triggerEntrance();
    }
  }, [difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut for hints on web
  useEffect(() => {
    if (Platform.OS !== 'web' || difficulty === null || typeof window === 'undefined') return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        if (hasActiveHint) {
          setClearHintTrigger(t => t + 1);
        } else if ((totalStats.hints ?? 0) > 0) {
          setHintTrigger(t => t + 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [difficulty, hasActiveHint, totalStats.hints]);

  const startFreePlay = useCallback(
    (chosen: FreePlayDifficulty) => {
      clearPendingTimers();
      const activeAttributes: AttributeName[] = [...ATTRIBUTE_SCALING.difficultyPresets[chosen]];
      const player = initializePlayer('player1', 'Player 1', defaultCharacter);
      const stats = calculatePlayerTotalStats(player);
      const { board, deck } = dealBoardAndDeck(activeAttributes, stats.fieldSize, 1);

      setState(
        createInitialGameState({
          player,
          activeAttributes,
          board,
          deck,
          started: true,
        })
      );
      setMistakes(0);
      setHasActiveHint(false);
      setHintTrigger(0);
      setClearHintTrigger(0);
      setLastMatchTime(Date.now());
      setFunRating(null);
      setNotification(null);
      sessionRef.current = {
        fightId: `fp-${Date.now()}`,
        startedAt: Date.now(),
        difficulty: chosen,
      };
      setDifficulty(chosen);
    },
    [clearPendingTimers, defaultCharacter]
  );

  const handleExit = useCallback(() => {
    clearPendingTimers();
    if (sessionRef.current) {
      const sets = state.foundCombinations.length;
      if (sets + mistakes > 0 || funRating !== null) {
        trackFreePlayFight({
          fightId: sessionRef.current.fightId,
          difficulty: sessionRef.current.difficulty,
          fighter: state.player.character.name,
          weapons: state.player.weapons.map(w => w.id),
          sets,
          mistakes,
          score: state.score,
          durationMs: Math.max(0, Date.now() - sessionRef.current.startedAt),
          funRating,
        });
      }
      sessionRef.current = null;
    }
    onExit();
  }, [clearPendingTimers, funRating, mistakes, onExit, state.foundCombinations.length, state.player.character.name, state.player.weapons, state.score]);

  const replaceMatchedCards = useCallback((cardsToReplace: Card[]) => {
    let dealtCount = 0;
    setState(prevState => {
      const remainingDeck = [...prevState.deck];
      const replaceIds = new Set(cardsToReplace.map(c => c.id));
      const remainingBoardCards = prevState.board.filter(c => !replaceIds.has(c.id));
      const newCards: Card[] = [];

      for (let i = 0; i < cardsToReplace.length; i++) {
        if (remainingDeck.length === 0) {
          const refill = createDeck(prevState.activeAttributes);
          for (const card of refill) {
            if (
              !remainingDeck.some(c => sameCardAttributes(c, card)) &&
              !remainingBoardCards.some(c => sameCardAttributes(c, card)) &&
              !newCards.some(c => sameCardAttributes(c, card))
            ) {
              remainingDeck.push(card);
            }
          }
        }
        if (remainingDeck.length > 0) {
          const randomIndex = Math.floor(Math.random() * remainingDeck.length);
          newCards.push({ ...remainingDeck[randomIndex], selected: false });
          remainingDeck.splice(randomIndex, 1);
        }
      }

      dealtCount = newCards.length;
      const updatedBoard = [...prevState.board];
      let nextIdx = 0;
      for (let idx = 0; idx < updatedBoard.length; idx++) {
        if (replaceIds.has(updatedBoard[idx].id) && nextIdx < newCards.length) {
          updatedBoard[idx] = newCards[nextIdx++];
        }
      }

      return {
        ...prevState,
        board: updatedBoard,
        deck: remainingDeck,
      };
    });

    if (dealtCount > 0) {
      playCardDealing(dealtCount, 30);
    }
  }, []);

  const handleMatchStart = useCallback(() => {
    const { width } = Dimensions.get('window');
    spawnParticles(50, { x: width / 2, y: 40 }, 'sparkle');
  }, [spawnParticles]);

  const handleValidMatch = useCallback(
    (cards: Card[], rewards: CardReward[], weaponEffects?: WeaponEffectResult) => {
      setLastMatchTime(Date.now());
      const isGraceMatch = rewards.length > 0 && rewards[0].effectType === 'grace';

      let totalPoints = 0;
      let totalExperience = 0;
      let totalHints = 0;
      rewards.forEach(r => {
        totalPoints += r.points || 0;
        totalExperience += r.experience || 0;
        totalHints += r.hint || 0;
      });
      if (weaponEffects) {
        totalHints += weaponEffects.bonusHints;
        totalExperience += weaponEffects.bonusExperience;
        if (weaponEffects.bonusHints > 0) playSound('gainHint');
      }

      fighter.triggerMatch({ isGraceMatch, isMegaMatch: false, didHeal: false });

      setState(prevState => {
        const playerTotalStats = calculatePlayerTotalStats(prevState.player);
        const newExperience = (prevState.player.stats.experience || 0) + totalExperience;
        const newLevel = getAdjustedLevelFromXP(newExperience);
        return {
          ...prevState,
          score: prevState.score + totalPoints,
          foundCombinations: [...prevState.foundCombinations, cards],
          player: {
            ...prevState.player,
            stats: {
              ...prevState.player.stats,
              experience: newExperience,
              level: newLevel,
              hints: Math.min(prevState.player.stats.hints + totalHints, playerTotalStats.maxHints),
            },
          },
        };
      });

      const timer = setTimeout(() => {
        replaceMatchedCards(cards);
      }, 1500);
      replaceTimersRef.current.push(timer);
    },
    [fighter, replaceMatchedCards]
  );

  const handleInvalidMatch = useCallback(
    (cardsToReplace: Card[]) => {
      setMistakes(m => m + 1);
      fighter.triggerMistake({ savedByGrace: false });
      const validation = isValidCombination(cardsToReplace, state.activeAttributes);
      const wrongAttr = validation.invalidAttributes[0];
      setNotification({
        message: wrongAttr ? `Not a Set — check ${wrongAttr}` : 'Not a valid Set',
        type: 'info',
      });
      if (cardsToReplace.length === 3) {
        replaceMatchedCards(cardsToReplace);
      }
    },
    [fighter, replaceMatchedCards, state.activeAttributes]
  );

  const handleUseHint = useCallback(() => {
    fighter.triggerHint();
    setState(prevState => ({
      ...prevState,
      player: {
        ...prevState.player,
        stats: {
          ...prevState.player.stats,
          hints: Math.max(0, prevState.player.stats.hints - 1),
        },
      },
    }));
  }, [fighter]);

  if (difficulty === null) {
    return <DifficultySelection onStart={startFreePlay} onExitGame={onExit} />;
  }

  return (
    <View nativeID="free-play-screen" style={styles.container} testID="free-play-screen">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <FreePlayHeader
        character={state.player.character}
        playerStats={totalStats}
        fighterMood={fighter.mood}
        fighterReaction={fighter.reaction}
        fighterStreak={fighter.streak}
        hasActiveHint={hasActiveHint}
        onHintPress={() => setHintTrigger(t => t + 1)}
        onClearHint={() => setClearHintTrigger(t => t + 1)}
        matchCount={state.foundCombinations.length}
        onExit={handleExit}
        funRating={funRating}
        onRateFun={setFunRating}
      />

      <View style={styles.boardContainer}>
        <GameBoard
          cards={state.board}
          onMatch={handleValidMatch}
          onMatchStart={handleMatchStart}
          onInvalidSelection={handleInvalidMatch}
          playerStats={totalStats}
          weapons={state.player.weapons}
          isPlayerTurn={true}
          activeAttributes={state.activeAttributes}
          onSelectedCountChange={fighter.setSelectedCount}
          onBoardIdleChange={fighter.setIsBoardIdle}
          onHintStateChange={setHasActiveHint}
          onUseHint={handleUseHint}
          triggerHint={hintTrigger > 0 ? hintTrigger : undefined}
          triggerClearHint={clearHintTrigger > 0 ? clearHintTrigger : undefined}
          isPaused={!appActive}
          lastMatchTime={lastMatchTime}
          autoPlayer={autoPlayer}
          connections={state.connections}
        />
      </View>

      <Particles />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  boardContainer: {
    flex: 1,
  },
});

export default FreePlayMode;
