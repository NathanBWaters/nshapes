import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { Card, CardReward, Weapon, AttributeName, AdventureDifficulty, Character, GameMode, FreePlayDifficulty } from '@/types';
import { COLORS } from '@/utils/colors';
import { createDeck, isValidCombination, sameCardAttributes } from '@/utils/gameUtils';
import {
  CHARACTERS,
  WEAPONS,
  initializePlayer,
  calculatePlayerTotalStats,
  generateShopWeapons,
} from '@/utils/gameDefinitions';
import {
  getActiveAttributesForRound,
  ATTRIBUTE_SCALING,
  ALL_ATTRIBUTES,
  LEGACY_RUN_LEVEL,
  getAdjustedLevelFromXP,
  getBaseRerollCostForRound,
} from '@/utils/gameConfig';
import { getAdjacentIndices, WeaponEffectResult } from '@/utils/weaponEffects';
import {
  createConnection,
  createRandomConnections,
  shouldCreateConnection,
  shouldCreateBonusConnection,
  selectPositionsToConnect,
  getLinkedDestructionPositions,
  rollRevengeLinkerConnections,
  getFireSpreadMultiplier,
} from '@/utils/connectionUtils';
import { useGameTimer } from '@/hooks/useGameTimer';
import { useParticles } from '@/hooks/useParticles';
import { useRoundStats } from '@/hooks/useRoundStats';
import { useFighterConductor } from '@/hooks/useFighterConductor';
import { createEnemy, applyEnemyStatModifiers, getRandomEnemyOptions } from '@/utils/enemyFactory';
import { generateChallengeBonus, getChallengeBonusMoney } from '@/utils/rewardUtils';
import type { EnemyOption } from '@/types/enemy';
import type { GameState } from '@/game/types';
import { createInitialGameState } from '@/game/gameState';
import { dealBoard, dealBoardAndDeck } from '@/game/board';
import { grantWeapon, generateLevelUpOptions as rollLevelUpOptions, canAffordReroll, payForReroll } from '@/game/inventory';
import {
  RoundHistoryEntry,
  buildRoundScores,
  getEnemyTierForRound,
  getLevelRoundRequirement,
  getMaxRoundTime,
  getNextRoundAttributes,
  getRoundStartTimeBonus,
  getRunRoundRequirement,
  getRunVictory,
  recordRoundInHistory,
} from '@/game/rounds';
import {
  canTriggerTabulaRasa,
  desperateMeasuresChallenge,
  getTimeGainTriggerCap,
  guaranteedRoundStartGraces,
  linksOnDamage,
  prismaticPerfectionChallenge,
  tabulaRasaChallenge,
} from '@/game/weaponRules';
import GameBoard from './GameBoard';
import GameInfo from './GameInfo';
import { DevModeCallbacks } from './GameMenu';
import Notification from './Notification';
import WeaponShop from './WeaponShop';
import LevelUp from './LevelUp';
import EnemySelection from './EnemySelection';
import RoundSummary from './RoundSummary';
import TutorialScreen from './TutorialScreen';
import VictoryScreen from './VictoryScreen';
import GameOverScreen from './GameOverScreen';
import FreePlayHeader from './FreePlayHeader';
import CharacterUnlockScreen from './CharacterUnlockScreen';
import MainMenu from './MainMenu';
import AdventureMode from '@/adventure/AdventureMode';
import DifficultySelection from './DifficultySelection';
import LevelUpModal from './LevelUpModal';
import OptionsMenu from './OptionsMenu';
import { useTutorial } from '@/context/TutorialContext';
import { CharacterWinsStorage, EndlessHighScoresStorage, AdventureHighRoundStorage, CharacterUnlockStorage, SavedGameStorage, LevelProgressStorage } from '@/utils/storage';
import { playSound, playCardDealing } from '@/utils/sounds';

const MAX_BOARD_SIZE = 21;

interface GameProps {
  devMode?: boolean;
  autoPlayer?: boolean;
  /** Force a specific enemy by name (skips enemy selection screen) */
  forcedEnemy?: string;
  /** Disable round timer for deterministic testing */
  disableTimeout?: boolean;
}

const Game: React.FC<GameProps> = ({
  devMode = false,
  autoPlayer = false,
  forcedEnemy,
  disableTimeout = false,
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(devMode ? 'Orange Tabby' : null);
  const [gameMode, setGameMode] = useState<GameMode>('adventure');
  const [adventureDifficulty, setAdventureDifficulty] = useState<AdventureDifficulty>('medium');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [gamePhase, setGamePhase] = useState<
    'main_menu' |
    'adventure' |         // Map-based adventure (src/adventure)
    'difficulty_select' |
    'tutorial' |
    'round' |
    'round_summary' |
    'level_up' |
    'shop' |
    'character_unlock' |
    'victory' |
    'enemy_select' |
    'game_over' |
    'free_play'
  >(devMode ? 'round' : 'main_menu');

  // Position of the current round within the level (1-5; keeps counting in endless mode)
  const [roundInLevel, setRoundInLevel] = useState<number>(1);

  // Track unlocked character for character unlock screen
  const [unlockedCharacter, setUnlockedCharacter] = useState<Character | null>(null);

  // Track round scores for progress chart
  const [roundHistory, setRoundHistory] = useState<RoundHistoryEntry[]>([]);

  const { startTutorial } = useTutorial();

  const [state, setState] = useState<GameState>(() => {
    const activeAttributes = getActiveAttributesForRound(1);

    // In dev mode, start on a ready-to-play board
    if (devMode) {
      const player = initializePlayer('dev', 'Dev Player', 'Orange Tabby');
      const { board, deck } = dealBoardAndDeck(activeAttributes, calculatePlayerTotalStats(player).fieldSize, 1);
      return createInitialGameState({ player, activeAttributes, board, deck, started: true });
    }

    // Normal mode - empty board until a mode is picked
    return createInitialGameState({
      player: initializePlayer('player1', 'Player 1', 'Orange Tabby'),
      activeAttributes,
    });
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  // Particle effects for match celebrations
  const { spawnParticles, Particles } = useParticles();

  // Live animated fighter conductor (tracks match joy/streaks, mistakes/pain, grace relief, low-HP grit, sleepy idle & clock panic)
  const totalStats = useMemo(() => calculatePlayerTotalStats(state.player), [state.player]);
  const fighter = useFighterConductor({
    health: totalStats.health,
    maxHealth: totalStats.maxHealth,
    remainingTime: gamePhase === 'round' ? state.remainingTime : undefined,
    score: state.score,
    targetScore: state.targetScore,
    isActiveRound: gamePhase === 'round' || gamePhase === 'free_play',
  });

  // Trigger a battle-ready fighter salute whenever a round or free play begins
  useEffect(() => {
    if (gamePhase === 'round' || gamePhase === 'free_play') {
      fighter.triggerEntrance();
    }
  }, [gamePhase, state.round]);

  // Round stats tracking for enemy defeat conditions
  const {
    statsRef: roundStatsRef,
    resetStats: resetRoundStats,
    recordValidMatch,
    recordInvalidMatch,
    recordGraceUsed,
    recordHintUsed,
    recordDamage,
    recordWeaponEffect,
    recordTripleCardCleared,
    updateTimeRemaining,
    updateCardsRemaining,
    updateScore,
    updateHintsRemaining,
    updateGracesRemaining,
    recordTimeGainTrigger,
    getTimeGainTriggers,
    addTimeGainTriggerCapBonus,
    getTimeGainTriggerCapBonus,
    incrementConsecutiveInvalidMatches,
    resetConsecutiveInvalidMatches,
    getConsecutiveInvalidMatches,
    markPrismaticPerfectionTriggered,
    isPrismaticPerfectionTriggered,
    markTabulaRasaTriggered,
    isTabulaRasaTriggered,
  } = useRoundStats();

  // UI state for header stats
  const [hasActiveHint, setHasActiveHint] = useState(false);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [clearHintTrigger, setClearHintTrigger] = useState(0);

  // Menu open state - used to pause game when menu is open
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Last match timestamp for auto-hint timing (triggers 15s after last match)
  const [lastMatchTime, setLastMatchTime] = useState<number>(Date.now());

  const [gameOverReason, setGameOverReason] = useState<string | null>(null);

  // Keyboard shortcut for hints (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || gamePhase !== 'round') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        const hintsAvailable = totalStats.hints ?? 0;

        if (hasActiveHint) {
          setClearHintTrigger(t => t + 1);
        } else if (hintsAvailable > 0) {
          setHintTrigger(t => t + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gamePhase, hasActiveHint, totalStats]);

  // Save adventure game state when entering round_summary or enemy_select (between rounds)
  // This ensures we capture state after all setState calls have been committed
  useEffect(() => {
    // Only save for adventure mode
    if (gameMode !== 'adventure' || !selectedCharacter) return;

    // Save when entering round_summary (after completing a round)
    // Skip round 10+ since that goes to victory/character_unlock
    if (gamePhase === 'round_summary' && state.round < 10) {
      SavedGameStorage.save({
        characterName: selectedCharacter,
        playerStats: state.player.stats,
        weaponIds: state.player.weapons.map(w => w.id),
        round: state.round,
        adventureDifficulty,
        defeatedEnemies: state.defeatedEnemies,
        awardedStretchGoalWeapons: state.awardedStretchGoalWeapons,
        gamePhase: 'enemy_select', // Resume to enemy selection for next round
      });
    }
  }, [gamePhase, gameMode, selectedCharacter, adventureDifficulty, state.round, state.player.stats, state.player.weapons, state.defeatedEnemies, state.awardedStretchGoalWeapons]);

  // Per-round stats tracking (for round summary screen)
  const [roundStats, setRoundStats] = useState({
    moneyEarned: 0,
    experienceEarned: 0,
    hintsEarned: 0,
    healingDone: 0,
    bonusWeaponsEarned: 0,
    startLevel: 0,
  });

  // Track if current enemy was defeated (for slayer bonus in level up)
  const [enemyDefeated, setEnemyDefeated] = useState(false);

  // In-round level-up modal state (NEW level-based system)
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [inRoundLevelUpQueue, setInRoundLevelUpQueue] = useState<number[]>([]);

  const [devTimerEnabled, setDevTimerEnabled] = useState(!devMode); // Timer disabled by default in dev mode
  const [autoPlayerEnabled, setAutoPlayerEnabled] = useState(autoPlayer); // Start with URL param value

  // Add an endGame function
  const endGame = (reason?: string) => {
    // Clear saved adventure game on game end (win or loss)
    SavedGameStorage.clear();

    // Call enemy onRoundEnd to clean up
    if (state.activeEnemyInstance) {
      state.activeEnemyInstance.onRoundEnd();
    }

    // Record endless high score if in endless mode
    if (state.isEndlessMode && selectedCharacter) {
      EndlessHighScoresStorage.recordHighScore(selectedCharacter, state.round);
    }

    setState(prevState => ({
      ...prevState,
      gameEnded: true,
      endTime: Date.now()
    }));

    const lossReason = reason || 'You ran out of time.';
    setGameOverReason(lossReason);
    setNotification({
      message: `Game Over! ${lossReason}`,
      type: 'error'
    });
    playSound('gameOver');

    setGamePhase('game_over');
  };

  // Complete the current round
  const completeRound = () => {
    // Check if enemy was defeated BEFORE calling onRoundEnd
    // Use the roundStats ref for up-to-date stats
    let wasEnemyDefeated = false;
    if (state.activeEnemyInstance) {
      wasEnemyDefeated = state.activeEnemyInstance.checkDefeatCondition(roundStatsRef.current);
      setEnemyDefeated(wasEnemyDefeated);
      // Track defeated enemy to prevent them from appearing again
      // Also add stretch goal reward directly to inventory and track awarded weapon ID
      if (wasEnemyDefeated) {
        setState(prevState => {
          const newWeapons = state.selectedEnemyReward
            ? [...prevState.player.weapons, state.selectedEnemyReward]
            : prevState.player.weapons;
          const newAwardedWeaponIds = state.selectedEnemyReward
            ? [...prevState.awardedStretchGoalWeapons, state.selectedEnemyReward.id]
            : prevState.awardedStretchGoalWeapons;
          const bonusMoney = state.selectedEnemyMoney ?? 0;
          return {
            ...prevState,
            defeatedEnemies: [...prevState.defeatedEnemies, state.activeEnemyInstance!.name],
            awardedStretchGoalWeapons: newAwardedWeaponIds,
            player: {
              ...prevState.player,
              weapons: newWeapons,
              stats: {
                ...prevState.player.stats,
                money: prevState.player.stats.money + bonusMoney,
              },
            },
          };
        });
      }
      state.activeEnemyInstance.onRoundEnd();
    } else {
      setEnemyDefeated(false);
    }

    setRoundHistory(prev => recordRoundInHistory(prev, roundInLevel, state.score));

    // Record adventure mode high round (max across all runs)
    if (!state.isEndlessMode && selectedCharacter) {
      AdventureHighRoundStorage.recordHighRound(selectedCharacter, state.round);
    }

    // In endless mode, always continue to next round
    if (state.isEndlessMode) {
      const options = generateLevelUpOptions();
      setState(prevState => ({
        ...prevState,
        roundCompleted: true,
        gameEnded: false,
        levelUpOptions: options
      }));
      setGamePhase('round_summary');
      return;
    }

    if (getRunVictory('round_completed', { round: state.round, roundInLevel, isEndlessMode: state.isEndlessMode })) {
      // Clear saved adventure game on victory
      SavedGameStorage.clear();

      // Record the win for this character
      if (selectedCharacter) {
        CharacterWinsStorage.recordWin(selectedCharacter);
      }

      // Check for character unlock
      const nextUnlock = CharacterUnlockStorage.getNextLockedCharacter();
      if (nextUnlock) {
        CharacterUnlockStorage.unlockCharacter(nextUnlock);
        const character = CHARACTERS.find(c => c.name === nextUnlock);
        if (character) {
          setUnlockedCharacter(character);
          setState(prevState => ({
            ...prevState,
            roundCompleted: true,
            gameEnded: true,
          }));
          setGamePhase('character_unlock');
          return;
        }
      }

      setState(prevState => ({
        ...prevState,
        roundCompleted: true,
        gameEnded: true,
      }));
      setGamePhase('victory');
      return;
    }

    // Generate options first, then update state
    const options = generateLevelUpOptions();

    setState(prevState => ({
      ...prevState,
      roundCompleted: true,
      gameEnded: false,
      levelUpOptions: options
    }));

    // Move to round summary phase (instead of directly to level_up)
    setGamePhase('round_summary');
  };

  // Timer - countdown when in round phase
  // Use gameMode as additional dependency to ensure timer restarts when a new game begins
  const isTimerActive = gamePhase === 'round' &&
    state.gameStarted &&
    !state.gameEnded &&
    state.remainingTime > 0 &&
    (!devMode || devTimerEnabled) &&
    !isMenuOpen &&
    !showLevelUpModal &&  // Pause timer during in-round level-up
    !disableTimeout;

  // Generate a unique key based on game start time to force timer reset on new games
  const timerKey = state.startTime || 0;

  useGameTimer(isTimerActive, () => {
    setState(prev => {
      let newTime = Math.max(0, prev.remainingTime - 1);
      let newScore = prev.score;
      let newHealth = prev.player.stats.health;
      let newBoard = prev.board;

      // Process enemy tick if enemy is active
      const enemy = prev.activeEnemyInstance;
      if (enemy) {
        // Get timer speed multiplier from enemy
        const uiMods = enemy.getUIModifiers();
        const speedMultiplier = uiMods.timerSpeedMultiplier || 1;

        // Call enemy onTick with scaled delta (1000ms * speedMultiplier)
        const scaledDelta = 1000 * speedMultiplier;
        const tickResult = enemy.onTick(scaledDelta, prev.board);

        // Apply score delta (clamp to 0, ensure integer)
        newScore = Math.max(0, Math.round(prev.score + tickResult.scoreDelta));

        newHealth = prev.player.stats.health + tickResult.healthDelta;

        if (tickResult.instantDeath) {
          newHealth = 0;
        }

        // Remove cards (NO replacement - board shrinks)
        if (tickResult.cardsToRemove.length > 0) {
          newBoard = prev.board.filter(card => !tickResult.cardsToRemove.includes(card.id));
        }

        if (tickResult.cardModifications.length > 0) {
          newBoard = newBoard.map(card => {
            const mod = tickResult.cardModifications.find(m => m.cardId === card.id);
            return mod ? { ...card, ...mod.changes } : card;
          });
        }

        if (tickResult.cardsToFlip.length > 0) {
          newBoard = newBoard.map(card =>
            tickResult.cardsToFlip.includes(card.id)
              ? { ...card, isFaceDown: false }
              : card
          );
        }
      }

      return {
        ...prev,
        remainingTime: newTime,
        score: newScore,
        board: newBoard,
        player: {
          ...prev.player,
          stats: {
            ...prev.player.stats,
            health: newHealth,
          },
        },
      };
    });
  }, timerKey);

  // Update round stats for enemy defeat conditions (time, score, cards, resources)
  useEffect(() => {
    if (gamePhase === 'round' && state.gameStarted) {
      updateTimeRemaining(state.remainingTime);
      updateScore(state.score);
      updateCardsRemaining(state.board.length);
      updateHintsRemaining(state.player.stats.hints);
      updateGracesRemaining(state.player.stats.graces);
    }
  }, [
    gamePhase,
    state.gameStarted,
    state.remainingTime,
    state.score,
    state.board.length,
    state.player.stats.hints,
    state.player.stats.graces,
    updateTimeRemaining,
    updateScore,
    updateCardsRemaining,
    updateHintsRemaining,
    updateGracesRemaining,
  ]);

  // Handle round completion when time runs out - separate from timer to avoid race conditions
  useEffect(() => {
    if (gamePhase === 'round' && state.gameStarted && !state.gameEnded && !state.roundCompleted && state.remainingTime === 0) {
      if (state.score >= state.targetScore) {
        // Success - move to next level
        completeRound();
      } else {
        // Failure - game over
        endGame();
      }
    }
  }, [gamePhase, state.gameStarted, state.gameEnded, state.roundCompleted, state.remainingTime, state.score, state.targetScore, completeRound, endGame]);

  // Auto-select forced enemy when in enemy_select phase (for testing)
  useEffect(() => {
    if (gamePhase === 'enemy_select' && forcedEnemy && state.currentEnemies.length > 0) {
      // Find the forced enemy in the current options, or create it
      const existingOption = state.currentEnemies.find(
        option => option.enemy.name === forcedEnemy
      );

      if (existingOption) {
        // Use the existing option
        handleEnemySelect(existingOption);
      } else {
        const enemy = createEnemy(forcedEnemy);
        const option: EnemyOption = {
          enemy,
          stretchGoalReward: generateChallengeBonus(enemy.tier, state.awardedStretchGoalWeapons),
          stretchGoalMoney: getChallengeBonusMoney(enemy.tier),
        };
        handleEnemySelect(option);
      }
    }
  }, [gamePhase, forcedEnemy, state.currentEnemies]);

  // Expose game state for Playwright testing in dev mode (web only)
  useEffect(() => {
    if (devMode && Platform.OS === 'web' && typeof window !== 'undefined') {
      (window as any).__gameState__ = {
        enemyDefeated,
        roundStats: roundStatsRef.current,
        playerWeapons: state.player.weapons,
        gamePhase,
        round: state.round,
        score: state.score,
        targetScore: state.targetScore,
        remainingTime: state.remainingTime,
        activeEnemy: state.activeEnemyInstance?.name ?? null,
        board: state.board,
      };
    }
    return () => {
      if (devMode && Platform.OS === 'web' && typeof window !== 'undefined') {
        delete (window as any).__gameState__;
      }
    };
  }, [
    devMode,
    enemyDefeated,
    roundStatsRef,
    state.player.weapons,
    gamePhase,
    state.round,
    state.score,
    state.targetScore,
    state.remainingTime,
    state.activeEnemyInstance,
    state.board,
  ]);

  // startGame param ensures all game start state is set atomically to avoid React batching issues
  const initGame = useCallback((characterName: string, activeAttributes: AttributeName[], startGame: boolean = false) => {
    const player = initializePlayer('player1', 'Player 1', characterName);
    const playerTotalStats = calculatePlayerTotalStats(player);
    const { board, deck } = dealBoardAndDeck(activeAttributes, playerTotalStats.fieldSize, 1);

    resetRoundStats(getRunRoundRequirement(1).targetScore, playerTotalStats.hints || 0, playerTotalStats.graces || 0);

    setState(createInitialGameState({
      player,
      activeAttributes,
      board,
      deck,
      started: startGame,
      timeBonus: startGame ? getRoundStartTimeBonus(playerTotalStats) : 0,
      overrides: {
        shopWeapons: generateShopWeapons(4, undefined, 1),
        // Enemies are picked (with pre-determined rewards) on the enemy selection screen
        currentEnemies: getRandomEnemyOptions(getEnemyTierForRound(1), 3, [], []),
      },
    }));

    setNotification(null);
  }, [resetRoundStats]);

  const generateLevelUpOptions = () => rollLevelUpOptions(state.player?.stats?.drawIncrease || 0);

  // Start Free Play Mode (called from Difficulty Selection)
  const startFreePlay = (difficulty: FreePlayDifficulty) => {
    setGameMode('free_play');

    // Free Play - use selected difficulty
    const activeAttributes = [...ATTRIBUTE_SCALING.difficultyPresets[difficulty]];

    // For free play, use a default character if none selected
    const characterToUse = selectedCharacter || 'Orange Tabby';

    // Initialize the game with the selected character and attributes
    // Pass startGame=true to set gameStarted, startTime, and time bonus atomically
    initGame(characterToUse, activeAttributes, true);

    // Reset hint triggers to prevent auto-triggering on game start
    setHintTrigger(0);
    setClearHintTrigger(0);

    // Free Play mode - go directly to the game board
    setGamePhase('free_play');
  };

  // Resume a saved adventure game
  const resumeGame = () => {
    const savedGame = SavedGameStorage.load();
    if (!savedGame) {
      setNotification({
        message: 'No saved game found',
        type: 'error'
      });
      return;
    }

    // Validate weapons - filter out any that no longer exist
    const validWeapons: Weapon[] = [];
    for (const weaponId of savedGame.weaponIds) {
      const weapon = WEAPONS.find(w => w.id === weaponId);
      if (weapon) {
        validWeapons.push(weapon);
      } else {
        console.warn(`Saved weapon ${weaponId} no longer exists, skipping`);
      }
    }

    const character = CHARACTERS.find(c => c.name === savedGame.characterName);
    if (!character) {
      setNotification({
        message: `Character ${savedGame.characterName} not found`,
        type: 'error'
      });
      SavedGameStorage.clear();
      return;
    }

    setGameMode('adventure');
    setAdventureDifficulty(savedGame.adventureDifficulty);
    setSelectedCharacter(savedGame.characterName);

    const nextRound = savedGame.round + 1;
    const activeAttributes = getActiveAttributesForRound(nextRound, savedGame.adventureDifficulty);
    const { board, deck } = dealBoardAndDeck(activeAttributes, savedGame.playerStats.fieldSize, nextRound);

    // Rebuild player with validated weapons and saved stats
    const player = {
      id: 'player1',
      username: 'Player 1',
      character,
      stats: savedGame.playerStats,
      weapons: validWeapons,
    };
    const playerTotalStats = calculatePlayerTotalStats(player);

    resetRoundStats(getRunRoundRequirement(nextRound).targetScore, playerTotalStats.hints || 0, playerTotalStats.graces || 0);
    setRoundHistory([]);
    setHintTrigger(0);
    setClearHintTrigger(0);

    setState(createInitialGameState({
      player,
      activeAttributes,
      board,
      deck,
      round: nextRound,
      timeBonus: getRoundStartTimeBonus(playerTotalStats),
      overrides: {
        shopWeapons: generateShopWeapons(4, validWeapons, nextRound, playerTotalStats.luck),
        rerollCost: getBaseRerollCostForRound(nextRound),
        currentEnemies: getRandomEnemyOptions(
          getEnemyTierForRound(nextRound),
          3,
          savedGame.defeatedEnemies,
          savedGame.awardedStretchGoalWeapons,
          playerTotalStats,
          validWeapons
        ),
        defeatedEnemies: savedGame.defeatedEnemies,
        awardedStretchGoalWeapons: savedGame.awardedStretchGoalWeapons,
      },
    }));

    // Go to enemy selection
    setGamePhase('enemy_select');

    setNotification({
      message: `Resumed game at Round ${nextRound}`,
      type: 'success'
    });
  };

  const handleTutorialStart = () => {
    startTutorial();
    setGamePhase('tutorial');
  };

  const exitToMenu = () => setGamePhase('main_menu');

  // Handle enemy selection - player has chosen which enemy to fight
  const handleEnemySelect = (enemyOption: EnemyOption) => {
    const { enemy, stretchGoalReward, stretchGoalMoney } = enemyOption;

    // Reset round stats and record starting level for round summary
    setRoundStats({
      moneyEarned: 0,
      experienceEarned: 0,
      hintsEarned: 0,
      healingDone: 0,
      bonusWeaponsEarned: 0,
      startLevel: state.player.stats.level,
    });

    // Reset hint triggers to prevent auto-triggering on round start
    setHintTrigger(0);
    setClearHintTrigger(0);

    // Call enemy's onRoundStart and apply any card modifications
    const startResult = enemy.onRoundStart(state.board);
    let finalBoard = state.board;
    if (startResult.cardModifications.length > 0) {
      finalBoard = state.board.map(card => {
        const mod = startResult.cardModifications.find(m => m.cardId === card.id);
        return mod ? { ...card, ...mod.changes } : card;
      });
    }

    setState(prevState => ({
      ...prevState,
      board: finalBoard,
      activeEnemyInstance: enemy,  // Set the active enemy instance
      selectedEnemyReward: stretchGoalReward,  // Store the pre-determined reward
      selectedEnemyMoney: stretchGoalMoney,  // Store the pre-determined bonus money
      gameStarted: true,
      startTime: Date.now()
    }));

    setGamePhase('round');
  };

  // Handle weapon purchase in the new weapon shop
  const handleWeaponPurchase = (weaponIndex: number) => {
    const weapon = state.shopWeapons[weaponIndex];
    if (!weapon) return;

    if (state.player.stats.money < weapon.price) {
      setNotification({
        message: 'Not enough money to purchase this weapon',
        type: 'error'
      });
      return;
    }

    // Weapons stack, so no limit check
    setState(prevState => {
      const player = grantWeapon(prevState.player, weapon);
      return {
        ...prevState,
        player: {
          ...player,
          stats: { ...player.stats, money: player.stats.money - weapon.price },
        },
        // Mark the slot as sold (null) instead of removing to preserve layout
        shopWeapons: prevState.shopWeapons.map((shopWeapon, index) =>
          index === weaponIndex ? null : shopWeapon
        )
      };
    });
  };

  // Pay for a reroll (free reroll first, else money) and replace what is offered.
  const reroll = (notAffordableMessage: string, rerolled: (prev: GameState) => Partial<GameState>) => {
    const { money, freeRerolls } = state.player.stats;
    if (!canAffordReroll({ money, freeRerolls, rerollCost: state.rerollCost })) {
      setNotification({ message: notAffordableMessage, type: 'error' });
      return;
    }
    setState(prevState => {
      const paid = payForReroll(
        { money: prevState.player.stats.money, freeRerolls: prevState.player.stats.freeRerolls, rerollCost: prevState.rerollCost },
        'run'
      );
      if (!paid) return prevState;
      return {
        ...prevState,
        ...rerolled(prevState),
        rerollCost: paid.rerollCost,
        player: {
          ...prevState.player,
          stats: { ...prevState.player.stats, money: paid.money, freeRerolls: paid.freeRerolls },
        },
      };
    });
  };

  const handleWeaponShopReroll = () =>
    reroll('Not enough money to reroll the shop', prev => ({
      shopWeapons: generateShopWeapons(4, prev.player.weapons, prev.round, calculatePlayerTotalStats(prev.player).luck),
    }));

  // Handle level up selection - receives the selected weapon directly
  const handleLevelUpSelection = (weapon: Weapon) => {
    setState(prevState => ({ ...prevState, player: grantWeapon(prevState.player, weapon) }));

    setNotification({
      message: `Acquired ${weapon.name}!`,
      type: 'success'
    });
    fighter.triggerPowerup();

    // Clear enemy defeated state after receiving any slayer bonus
    setEnemyDefeated(false);

    setGamePhase('shop');
  };

  // Handle in-round level-up selection (NEW level-based system)
  const handleInRoundLevelUpSelect = (weapon: Weapon) => {
    setState(prevState => ({ ...prevState, player: grantWeapon(prevState.player, weapon) }));

    // Check if there are more level-ups pending
    const remaining = inRoundLevelUpQueue.slice(1);
    setInRoundLevelUpQueue(remaining);

    if (remaining.length > 0) {
      // Generate new options for next level-up
      const options = generateLevelUpOptions();
      setState(prev => ({ ...prev, levelUpOptions: options }));
    } else {
      // All level-ups done, close modal and resume game
      setShowLevelUpModal(false);
    }
    fighter.triggerPowerup();
  };

  const handleInRoundLevelUpReroll = () =>
    reroll('Not enough money to reroll', () => ({ levelUpOptions: generateLevelUpOptions() }));

  const handleLevelUpReroll = () =>
    reroll('Not enough money to reroll the level up options', () => ({ levelUpOptions: generateLevelUpOptions() }));

  // Handle match start - called immediately when a valid match is detected (before animations)
  const handleMatchStart = useCallback(() => {
    // Spawn sparkle particles from the top bar area immediately
    const { width } = Dimensions.get('window');
    spawnParticles(50, { x: width / 2, y: 40 }, 'sparkle');
  }, [spawnParticles]);

  // Handle valid match - receives cards, rewards, and weapon effects from GameBoard after reveal
  const handleValidMatch = (cards: Card[], rewards: CardReward[], weaponEffects?: WeaponEffectResult) => {
    // Update last match time for auto-hint timing
    setLastMatchTime(Date.now());

    // Check if this is a grace match (invalid match saved by grace)
    const isGraceMatch = rewards.length > 0 && rewards[0].effectType === 'grace';

    // Track match for enemy defeat conditions
    // Get the actual matched cards (first 3 in the cards array)
    const matchedCards = cards.slice(0, 3);
    const isAllDifferent = state.activeAttributes.every(attr => {
      const values = matchedCards.map(c => c[attr as keyof Card]);
      return values.length === new Set(values).size;
    });
    const isAllSameColor = matchedCards.every(c => c.color === matchedCards[0].color);
    const hasSquiggle = matchedCards.some(c => c.shape === 'squiggle');
    recordValidMatch(matchedCards, {
      isAllDifferent,
      isAllSameColor,
      hasSquiggle,
    });

    // Reset consecutive invalid matches on valid match
    resetConsecutiveInvalidMatches();

    const prismatic = prismaticPerfectionChallenge(state.player.weapons, {
      isAllDifferent,
      alreadyTriggered: isPrismaticPerfectionTriggered(),
    });
    if (prismatic) {
      addTimeGainTriggerCapBonus(prismatic.capBonus);
      markPrismaticPerfectionTriggered();
      setNotification({ message: prismatic.message, type: 'success' });
    }

    if (canTriggerTabulaRasa(state.player.weapons, isTabulaRasaTriggered())) {
      // The board is cleared if nothing is left after the match and the weapon effects
      const cardsBeingRemoved = new Set(cards.map(c => c.id));
      if (weaponEffects) {
        weaponEffects.explosiveCards.forEach(c => cardsBeingRemoved.add(c.id));
        weaponEffects.laserCards.forEach(c => cardsBeingRemoved.add(c.id));
        weaponEffects.ricochetCards.forEach(c => cardsBeingRemoved.add(c.id));
        weaponEffects.autoMatchedSets.flat().forEach(c => cardsBeingRemoved.add(c.id));
      }
      const tabulaRasa = tabulaRasaChallenge(state.board.filter(c => !cardsBeingRemoved.has(c.id)).length);
      if (tabulaRasa) {
        addTimeGainTriggerCapBonus(tabulaRasa.capBonus);
        markTabulaRasaTriggered();
        setNotification({ message: tabulaRasa.message, type: 'success' });
      }
    }

    // Track grace usage for defeat conditions
    if (isGraceMatch) {
      recordGraceUsed();
    }

    // Call enemy onValidMatch and apply effects
    let enemyTimeDelta = 0;
    let enemyPointsMultiplier = 1;
    let enemyCardsToRemove: string[] = [];
    let enemyCardsToFlip: string[] = [];
    if (state.activeEnemyInstance) {
      const matchResult = state.activeEnemyInstance.onValidMatch(matchedCards, state.board);
      enemyTimeDelta = matchResult.timeDelta;
      enemyPointsMultiplier = matchResult.pointsMultiplier;
      enemyCardsToRemove = matchResult.cardsToRemove;
      enemyCardsToFlip = matchResult.cardsToFlip;

      const isDefeated = state.activeEnemyInstance.checkDefeatCondition(roundStatsRef.current);
      if (isDefeated) {
        // TODO: Show defeat notification and award slayer bonus
        console.log('Enemy defeated!');
      }
    }

    // Calculate totals from rewards (includes explosion/laser rewards from GameBoard)
    let totalPoints = 0;
    let totalMoney = 0;
    let totalExperience = 0;
    let totalHealing = 0;
    let totalHints = 0;
    let bonusWeaponsCount = 0;
    let graceUsed = false;

    rewards.forEach(reward => {
      // Track if this is a grace match (first reward marked as grace)
      if (reward.effectType === 'grace') {
        graceUsed = true;
        // Still award full points for grace cards!
      }

      let points = reward.points || 0;
      let money = reward.money || 0;

      totalPoints += points;
      totalMoney += money;
      totalExperience += reward.experience || 0;
      totalHealing += reward.healing || 0;
      totalHints += reward.hint || 0;
      if (reward.lootBox) bonusWeaponsCount++;
    });

    // === WEAPON BONUS EFFECTS (from GameBoard's processWeaponEffects) ===
    const triggerNotifications: string[] = [];

    if (isGraceMatch) {
      triggerNotifications.push('Grace!');
    }

    // Apply weapon effect bonuses (healing, hints, time, graces, board growth, fire, XP, coins)
    if (weaponEffects) {
      totalHealing += weaponEffects.bonusHealing;
      totalHints += weaponEffects.bonusHints;
      totalExperience += weaponEffects.bonusExperience;
      totalMoney += weaponEffects.bonusCoins;

      // Play sounds for bonus rewards (explosion/laser/ricochet sounds play immediately in GameBoard)
      if (weaponEffects.bonusHealing > 0) {
        playSound('gainHeart');
      }
      if (weaponEffects.bonusHints > 0) {
        playSound('gainHint');
      }
      if (weaponEffects.bonusGraces > 0) {
        playSound('gainGrace');
      }

      if (weaponEffects.fireCards.length > 0) {
        igniteCards(weaponEffects.fireCards);
        recordWeaponEffect('fire');
      }

      // Track weapon effects for defeat conditions
      if (weaponEffects.explosiveCards.length > 0) {
        recordWeaponEffect('explosion');
      }
      if (weaponEffects.laserCards.length > 0) {
        recordWeaponEffect('laser');
      }
      if (weaponEffects.ricochetCards.length > 0) {
        recordWeaponEffect('ricochet');
      }
    }

    // Award time bonus for linked destruction (Echo Chamber weapon)
    const connectedCardCount = rewards.filter(r => r.effectType === 'connected').length;
    if (connectedCardCount > 0) {
      const timeBonus = (totalStats.echoTimeBonusPerLink || 0) * connectedCardCount;
      if (timeBonus > 0) {
        setState(prevState => ({
          ...prevState,
          remainingTime: Math.min(
            prevState.remainingTime + timeBonus,
            getMaxRoundTime(prevState.round, calculatePlayerTotalStats(prevState.player))
          )
        }));
        setNotification({ message: `+${timeBonus}s from links!`, type: 'info' });
      }
    }

    if (weaponEffects) {
      // Show notifications (filter out explosion/laser since those were shown visually)
      weaponEffects.notifications.forEach(n => {
        if (!n.includes('Explosion') && !n.includes('Laser')) {
          triggerNotifications.push(n);
        }
      });
    }

    // Play sound for money earned
    if (totalMoney > 0) {
      playSound('gainMoney');
    }

    // Trigger joyful / mega / relief / healing fighter animation!
    const isMegaMatch =
      Boolean(
        weaponEffects &&
          (weaponEffects.explosiveCards.length > 0 ||
            weaponEffects.laserCards.length > 0 ||
            weaponEffects.ricochetCards.length > 0 ||
            weaponEffects.autoMatchedSets.length > 0)
      ) || connectedCardCount > 0;
    const didHeal =
      totalHealing > 0 &&
      state.player.stats.health < totalStats.maxHealth;
    fighter.triggerMatch({ isGraceMatch, isMegaMatch, didHeal });

    // Show notification for triggered effects
    if (triggerNotifications.length > 0) {
      setNotification({
        message: triggerNotifications.join(' | '),
        type: 'info'
      });
    }

    // Calculate experience with bonus percentage
    const experienceMultiplier = 1 + (state.player.stats.experienceGainPercent || 0) / 100;
    const adjustedExperience = Math.floor(totalExperience * experienceMultiplier);

    // Accumulate per-round stats for the round summary screen
    setRoundStats(prev => ({
      ...prev,
      moneyEarned: prev.moneyEarned + totalMoney,
      experienceEarned: prev.experienceEarned + adjustedExperience,
      hintsEarned: prev.hintsEarned + totalHints,
      healingDone: prev.healingDone + totalHealing,
      bonusWeaponsEarned: prev.bonusWeaponsEarned + bonusWeaponsCount,
    }));

    setState(prevState => {
      const currentExperience = prevState.player.stats.experience || 0;
      const newExperience = currentExperience + adjustedExperience;
      const currentLevel = prevState.player.stats.level || 0;
      const newLevel = getAdjustedLevelFromXP(newExperience);
      const hasLeveledUp = newLevel > currentLevel;

      // Calculate new health (capped at max including weapon bonuses)
      const playerTotalStats = calculatePlayerTotalStats(prevState.player);
      const newHealth = Math.min(
        prevState.player.stats.health + totalHealing,
        playerTotalStats.maxHealth
      );

      // Trigger in-round level-up modal (NEW level-based system)
      if (hasLeveledUp && gameMode === 'adventure' && !state.isEndlessMode) {
        const levelsGained = newLevel - currentLevel;
        const levelQueue = Array.from(
          { length: levelsGained },
          (_, i) => currentLevel + i + 1
        );

        // Queue up the level-ups and show modal
        setInRoundLevelUpQueue(prev => [...prev, ...levelQueue]);

        // Generate level-up options if not already showing modal
        if (!showLevelUpModal) {
          const options = generateLevelUpOptions();
          setState(prev => ({ ...prev, levelUpOptions: options }));
          setShowLevelUpModal(true);
        }

        setNotification({
          message: `LEVEL UP! Choose a reward!`,
          type: 'success'
        });
      } else if (hasLeveledUp) {
        // Old behavior for endless/free play
        setNotification({
          message: `LEVEL UP! Now Lv${newLevel}`,
          type: 'success'
        });
      }

      // Calculate grace change: if grace used, decrement; if bonus from weapon effects, add
      const graceDelta = (graceUsed ? -1 : 0) + (weaponEffects?.bonusGraces || 0);

      // Apply enemy points multiplier
      const adjustedPoints = Math.floor(totalPoints * enemyPointsMultiplier);

      // Apply enemy time delta (can be negative for time steal)
      const weaponTimeBonus = weaponEffects?.bonusTime || 0;
      const totalTimeChange = weaponTimeBonus + enemyTimeDelta;
      const maxTime = getMaxRoundTime(prevState.round, playerTotalStats);
      const newRemainingTime = Math.min(Math.max(0, prevState.remainingTime + totalTimeChange), maxTime);

      // Apply enemy card removals (NO replacement)
      let newBoard = prevState.board;
      if (enemyCardsToRemove.length > 0) {
        newBoard = newBoard.filter(card => !enemyCardsToRemove.includes(card.id));
      }

      // Apply enemy card flips
      if (enemyCardsToFlip.length > 0) {
        newBoard = newBoard.map(card =>
          enemyCardsToFlip.includes(card.id)
            ? { ...card, isFaceDown: false }
            : card
        );
      }

      return {
        ...prevState,
        score: prevState.score + adjustedPoints,
        board: newBoard,
        foundCombinations: [...prevState.foundCombinations, cards],
        remainingTime: newRemainingTime,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            experience: newExperience,
            level: newLevel,
            money: prevState.player.stats.money + totalMoney,
            health: newHealth,
            // Cap hints at maxHints (including weapon bonuses)
            hints: Math.min(
              prevState.player.stats.hints + totalHints,
              playerTotalStats.maxHints
            ),
            // Cap graces at maxGraces (including weapon bonuses)
            graces: Math.min(
              prevState.player.stats.graces + graceDelta,
              playerTotalStats.maxGraces
            )
          }
        }
      };
    });

    // === CONNECTOR WEAPON EFFECTS ===
    // Roll for connection creation on match
    if (shouldCreateConnection(totalStats)) {
      // Get positions of matched cards on the board
      const matchedPositions = matchedCards.map(card =>
        state.board.findIndex(bc => bc.id === card.id)
      ).filter(pos => pos !== -1);

      if (matchedPositions.length >= 2) {
        const positionPair = selectPositionsToConnect(matchedPositions, state.connections);
        if (positionPair) {
          const [posA, posB] = positionPair;
          const newConnection = createConnection(posA, posB);

          setState(prevState => ({
            ...prevState,
            connections: [...prevState.connections, newConnection]
          }));

          setNotification({ message: 'Link Created!', type: 'info' });

          // Check for Neural Network bonus connection
          if (shouldCreateBonusConnection(totalStats)) {
            const bonusConnections = createRandomConnections(
              state.board.length,
              1,
              [...state.connections, newConnection]
            );
            if (bonusConnections.length > 0) {
              setState(prevState => ({
                ...prevState,
                connections: [...prevState.connections, ...bonusConnections]
              }));
              setNotification({ message: 'Bonus Link!', type: 'info' });
            }
          }
        }
      }
    }

    // Delay card replacement to allow reward visualization (1.5s)
    // Score has already been updated immediately above via setState
    setTimeout(() => {
      // Separate multi-hit cards (health > 1) from cards to replace
      const cardsToDecrement = cards.filter(c => c.health !== undefined && c.health > 1);
      const cardsToReplace = cards.filter(c => c.health === undefined || c.health <= 1);

      // Decrement health for multi-hit cards instead of replacing them
      if (cardsToDecrement.length > 0) {
        setState(prevState => {
          const updatedBoard = prevState.board.map(boardCard => {
            const matchedCard = cardsToDecrement.find(c => c.id === boardCard.id);
            if (matchedCard) {
              return {
                ...boardCard,
                health: (boardCard.health || 1) - 1
              };
            }
            return boardCard;
          });
          return { ...prevState, board: updatedBoard };
        });
      }

      // Replace cards that should be removed (no health or health <= 1)
      if (cardsToReplace.length > 0) {
        // Track triple cards cleared (cards with health === 1 were multi-hit cards now fully cleared)
        const clearedTripleCards = cardsToReplace.filter(c => c.health === 1);
        clearedTripleCards.forEach(() => recordTripleCardCleared());

        replaceMatchedCards(cardsToReplace);
      }

      if (weaponEffects && weaponEffects.boardGrowth > 0) {
        growBoard(weaponEffects.boardGrowth);
      }
    }, 1500);
  };

  const igniteCards = (cardsToIgnite: Card[]) => {
    setState(prevState => {
      const updatedBoard = prevState.board.map(card => {
        if (cardsToIgnite.some(c => c.id === card.id)) {
          return {
            ...card,
            onFire: true,
            fireStartTime: Date.now()
          };
        }
        return card;
      });

      return {
        ...prevState,
        board: updatedBoard
      };
    });
  };

  // Handle individual card burn completion - called by Card component when burn timer finishes
  // This is non-blocking: immediately replaces card and rolls fire spread
  // Also triggers linked destruction for connector weapons
  const handleCardBurn = useCallback((burnedCard: Card) => {
    const FIRE_SPREAD_ON_DEATH_CHANCE = 10; // 10%
    const now = Date.now();

    setState(prevState => {
      let updatedBoard = [...prevState.board];
      let remainingDeck = [...prevState.deck];
      let updatedConnections = [...prevState.connections];

      // Find the burned card's index
      const burnedIndex = updatedBoard.findIndex(c => c.id === burnedCard.id);
      if (burnedIndex === -1) return prevState;

      // === LINKED DESTRUCTION FOR FIRE ===
      // Get all positions that should be destroyed via connections
      const linkedPositions = getLinkedDestructionPositions(
        updatedConnections,
        burnedIndex,
        new Set([burnedIndex])
      );

      // Calculate time bonus for linked destruction (Echo Chamber)
      const playerTotalStats = calculatePlayerTotalStats(prevState.player);
      const linkedTimeBonus = (playerTotalStats.echoTimeBonusPerLink || 0) * linkedPositions.length;

      // Roll fire spread chance (10%) before replacing the card
      // Apply Sympathetic Flames multiplier for connected positions
      const fireMultiplier = getFireSpreadMultiplier(
        updatedConnections,
        burnedIndex,
        playerTotalStats.linkedFireMultiplier || 1
      );
      const effectiveFireChance = FIRE_SPREAD_ON_DEATH_CHANCE * fireMultiplier;

      let fireSpreadTarget: Card | null = null;
      if (Math.random() * 100 < effectiveFireChance) {
        const adjacentIndices = getAdjacentIndices(burnedIndex, updatedBoard.length);
        const validAdjacent = adjacentIndices.filter(idx => {
          const adjCard = updatedBoard[idx];
          return adjCard && !adjCard.onFire && adjCard.id !== burnedCard.id;
        });

        if (validAdjacent.length > 0) {
          const randomAdj = validAdjacent[Math.floor(Math.random() * validAdjacent.length)];
          fireSpreadTarget = updatedBoard[randomAdj];
        }
      }

      // Collect all positions to replace (burned + linked)
      const positionsToReplace = [burnedIndex, ...linkedPositions.filter(p => p !== burnedIndex && p < updatedBoard.length)];

      // Replace burned card and linked cards with new ones from deck
      for (const posIndex of positionsToReplace) {
        if (remainingDeck.length > 0 && posIndex < updatedBoard.length) {
          const randomIndex = Math.floor(Math.random() * remainingDeck.length);
          const newCard = { ...remainingDeck[randomIndex], selected: false };
          updatedBoard[posIndex] = newCard;
          remainingDeck.splice(randomIndex, 1);
        }
      }

      // Ignite fire spread target if one was selected
      if (fireSpreadTarget) {
        updatedBoard = updatedBoard.map(card => {
          if (card.id === fireSpreadTarget!.id) {
            return { ...card, onFire: true, fireStartTime: now };
          }
          return card;
        });
      }

      // Calculate bonus points/money for linked cards
      const linkedBonus = linkedPositions.length;

      return {
        ...prevState,
        board: updatedBoard,
        deck: remainingDeck,
        connections: updatedConnections,
        score: prevState.score + 1 + linkedBonus, // +1 per card destroyed
        remainingTime: Math.min(
          prevState.remainingTime + linkedTimeBonus,
          getMaxRoundTime(prevState.round, playerTotalStats)
        ),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            money: prevState.player.stats.money + 1 + linkedBonus // +1 per card destroyed
          }
        }
      };
    });
  }, []);

  // Grow the board by adding new cards
  const growBoard = (amount: number) => {
    setState(prevState => {
      // Don't grow beyond max board size
      if (prevState.board.length >= MAX_BOARD_SIZE) {
        return prevState;
      }

      const cardsToAdd = Math.min(amount, MAX_BOARD_SIZE - prevState.board.length);
      const newCards: Card[] = [];
      const remainingDeck = [...prevState.deck];

      for (let i = 0; i < cardsToAdd; i++) {
        if (remainingDeck.length === 0) {
          // Refill deck if necessary
          const additionalCards = createDeck(prevState.activeAttributes);
          for (const card of additionalCards) {
            if (!remainingDeck.some(c => sameCardAttributes(c, card)) &&
                !prevState.board.some(c => sameCardAttributes(c, card)) &&
                !newCards.some(c => sameCardAttributes(c, card))) {
              remainingDeck.push(card);
            }
          }
        }

        if (remainingDeck.length > 0) {
          const randomIndex = Math.floor(Math.random() * remainingDeck.length);
          const newCard = { ...remainingDeck[randomIndex], selected: false };
          newCards.push(newCard);
          remainingDeck.splice(randomIndex, 1);
        }
      }

      return {
        ...prevState,
        board: [...prevState.board, ...newCards],
        deck: remainingDeck
      };
    });
  };

  // Handle invalid match - removes cards and replaces them (costs 1 health unless grace saves)
  // Grace only saves when EXACTLY 1 attribute is wrong (a "near miss")
  const handleInvalidMatch = (cardsToReplace: Card[]) => {
    // Track invalid match for enemy defeat conditions
    recordInvalidMatch();

    // Track consecutive invalid matches for Desperate Measures
    incrementConsecutiveInvalidMatches();

    const desperate = desperateMeasuresChallenge(state.player.weapons, getConsecutiveInvalidMatches());
    if (desperate) {
      addTimeGainTriggerCapBonus(desperate.capBonus);
      resetConsecutiveInvalidMatches(); // So it can trigger again
      setNotification({ message: desperate.message, type: 'success' });
    }

    // Check how many attributes are invalid
    const validationResult = isValidCombination(cardsToReplace, state.activeAttributes);
    const invalidCount = validationResult.invalidAttributes.length;

    // Grace only saves when exactly 1 attribute is wrong AND player has graces
    if (invalidCount === 1 && totalStats.graces > 0) {
      fighter.triggerMistake({ savedByGrace: true });
      // Use a grace instead of losing health
      setState(prevState => ({
        ...prevState,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            graces: prevState.player.stats.graces - 1
          }
        }
      }));

      const attrName = validationResult.invalidAttributes[0];
      setNotification({
        message: `Grace! (${attrName} was wrong)`,
        type: 'info'
      });

      // Replace the invalid match cards with new ones from the deck
      if (cardsToReplace.length === 3) {
        replaceMatchedCards(cardsToReplace);
      }
      return;
    }

    // 2+ attributes wrong OR no graces - decrease health
    fighter.triggerMistake({ savedByGrace: false });
    let damageMultiplier = 1;
    if (state.activeEnemyInstance) {
      const statMods = state.activeEnemyInstance.getStatModifiers();
      damageMultiplier = statMods.damageMultiplier || 1;
    }
    const damageAmount = Math.floor(1 * damageMultiplier);

    // Track damage for enemy defeat conditions
    recordDamage(damageAmount);

    // Call enemy onInvalidMatch and get extra cards to remove
    let enemyCardsToRemove: string[] = [];
    if (state.activeEnemyInstance) {
      const matchResult = state.activeEnemyInstance.onInvalidMatch(cardsToReplace, state.board);
      enemyCardsToRemove = matchResult.cardsToRemove;
    }

    setState(prevState => {
      const newHealth = prevState.player.stats.health - damageAmount;

      // Check for game over
      if (newHealth <= 0) {
        // Delay the game over slightly so the state update completes
        setTimeout(() => {
          endGame('You ran out of health from invalid matches!');
        }, 100);
      } else {
        setNotification({
          message: `-1 ♥`,
          type: 'error'
        });
      }

      // Apply enemy card removals (NO replacement - board shrinks)
      let newBoard = prevState.board;
      if (enemyCardsToRemove.length > 0) {
        newBoard = newBoard.filter(card => !enemyCardsToRemove.includes(card.id));
      }

      return {
        ...prevState,
        board: newBoard,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            health: Math.max(0, newHealth)
          }
        }
      };
    });

    // === REVENGE LINKER: Create connections when taking damage ===
    if (linksOnDamage(state.player.weapons) && state.board.length >= 3) {
      const revengeConnections = rollRevengeLinkerConnections(state.board.length, state.connections);
      if (revengeConnections.length > 0) {
        setState(prevState => ({
          ...prevState,
          connections: [...prevState.connections, ...revengeConnections]
        }));
        setNotification({
          message: `Revenge! ${revengeConnections.length} link${revengeConnections.length > 1 ? 's' : ''} created!`,
          type: 'info'
        });
      }
    }

    // Replace the invalid match cards with new ones from the deck
    if (cardsToReplace.length === 3) {
      replaceMatchedCards(cardsToReplace);
    }
  };

  // Handle using a hint (decrement hint count)
  const handleUseHint = () => {
    // Track hint usage for enemy defeat conditions
    recordHintUsed();
    fighter.triggerHint();

    setState(prevState => ({
      ...prevState,
      player: {
        ...prevState.player,
        stats: {
          ...prevState.player.stats,
          hints: Math.max(0, prevState.player.stats.hints - 1)
        }
      }
    }));
  };

  const devCallbacks: DevModeCallbacks | undefined = devMode ? {
    onAddWeapon: (weapon: Weapon) => {
      setState(prevState => ({
        ...prevState,
        player: {
          ...prevState.player,
          weapons: [...prevState.player.weapons, weapon]
        }
      }));
      setNotification({ message: `Added: ${weapon.name} (${weapon.rarity})`, type: 'success' });
    },
    onClearWeapons: () => {
      setState(prevState => ({
        ...prevState,
        player: {
          ...prevState.player,
          weapons: []
        }
      }));
      setNotification({ message: 'Weapons cleared!', type: 'info' });
    },
    onAddGraces: (count: number) => {
      setState(prevState => {
        const totalStats = calculatePlayerTotalStats(prevState.player);
        const newGraces = Math.min(
          prevState.player.stats.graces + count,
          totalStats.maxGraces
        );
        return {
          ...prevState,
          player: {
            ...prevState.player,
            stats: {
              ...prevState.player.stats,
              graces: newGraces
            }
          }
        };
      });
      setNotification({ message: `+${count} Graces`, type: 'success' });
    },
    onSetCardsOnFire: (count: number) => {
      const now = Date.now();
      setState(prevState => ({
        ...prevState,
        board: prevState.board.map((card, i) =>
          i < count ? { ...card, onFire: true, fireStartTime: now } : card
        )
      }));
      setNotification({ message: `First ${count} cards on fire!`, type: 'info' });
    },
    onToggleTimer: () => {
      setDevTimerEnabled(prev => !prev);
    },
    onResetBoard: () => {
      const { board, deck } = dealBoardAndDeck(state.activeAttributes, totalStats.fieldSize, state.round);
      setState(prevState => ({
        ...prevState,
        deck,
        board,
        remainingTime: getRunRoundRequirement(state.round).time,
      }));
      setNotification({ message: 'Board reset!', type: 'info' });
    },
    onAddCards: (count: number) => {
      if (state.deck.length < count) {
        setNotification({ message: 'Not enough cards in deck!', type: 'warning' });
        return;
      }
      const newCards = state.deck.slice(0, count).map(card => ({
        ...card,
        selected: false
      }));
      setState(prevState => ({
        ...prevState,
        board: [...prevState.board, ...newCards],
        deck: prevState.deck.slice(count)
      }));
      setNotification({ message: `+${count} cards added`, type: 'success' });
    },
    onChangeRound: (round: number) => {
      const activeAttributes = getActiveAttributesForRound(round, adventureDifficulty);
      const { board, deck } = dealBoardAndDeck(activeAttributes, totalStats.fieldSize, round);
      const requirement = getRunRoundRequirement(round);
      setState(prevState => ({
        ...prevState,
        round,
        activeAttributes,
        deck,
        board,
        targetScore: requirement.targetScore,
        remainingTime: requirement.time,
      }));
    },
    onChangeAttributes: (count: number) => {
      // 3 = shape/color/number, 4 = +shading, 5 = +background
      const activeAttributes = ALL_ATTRIBUTES.slice(0, count);
      const { board, deck } = dealBoardAndDeck(activeAttributes, totalStats.fieldSize, state.round);
      setState(prevState => ({
        ...prevState,
        activeAttributes,
        deck,
        board,
      }));
      setNotification({ message: `Difficulty set to ${count} attributes`, type: 'info' });
    },
    timerEnabled: devTimerEnabled,
    autoPlayerEnabled: autoPlayerEnabled,
    autoPlayerAvailable: autoPlayer, // Only show toggle if URL param was set
    onToggleAutoPlayer: () => setAutoPlayerEnabled(prev => !prev),
    currentRound: state.round,
    currentAttributes: state.activeAttributes.length,
  } : undefined;

  const replaceMatchedCards = (matchedCards: Card[]) => {
    const newCards: Card[] = [];
    const remainingDeck = [...state.deck];

    // Get the matched card indices from the board
    // Note: matchedCards now includes connected cards from GameBoard
    const matchedIndices = matchedCards.map(matchedCard =>
      state.board.findIndex(boardCard => boardCard.id === matchedCard.id)
    );

    // matchedCards already includes connected cards from GameBoard
    const allCardsToReplace = matchedCards;
    const allIndicesToReplace = matchedIndices;

    // Get board cards that are NOT being replaced (will remain on board)
    const remainingBoardCards = state.board.filter(
      boardCard => !allCardsToReplace.some(mc => mc.id === boardCard.id)
    );

    // Generate replacement cards for ALL cards being destroyed (matched + linked)
    // Note: Card modifiers (health, bombs, etc.) are applied by the enemy system via onCardDraw
    for (let i = 0; i < allCardsToReplace.length; i++) {
      if (remainingDeck.length === 0) {
        // Refill the deck with active attributes, excluding cards already on board or being added
        const additionalCards = createDeck(state.activeAttributes);
        for (const card of additionalCards) {
          if (!remainingDeck.some(c => sameCardAttributes(c, card)) &&
              !remainingBoardCards.some(c => sameCardAttributes(c, card)) &&
              !newCards.some(c => sameCardAttributes(c, card))) {
            remainingDeck.push(card);
          }
        }
      }

      if (remainingDeck.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingDeck.length);
        let newCard = { ...remainingDeck[randomIndex], selected: false };

        // Apply enemy onCardDraw modifications (may add isDud, isFaceDown, hasBomb, etc.)
        if (state.activeEnemyInstance) {
          newCard = state.activeEnemyInstance.onCardDraw(newCard);
        }

        newCards.push(newCard);

        // Remove the card from the deck
        remainingDeck.splice(randomIndex, 1);
      }
    }

    // Play card dealing sounds for new cards
    if (newCards.length > 0) {
      playCardDealing(newCards.length, 30);
    }

    // Replace matched cards AND linked cards with new ones
    setState(prevState => {
      // Create a new board array with replaced cards
      const updatedBoard = [...prevState.board];

      // Replace each destroyed card with a new one
      allIndicesToReplace.forEach((index, i) => {
        if (index !== -1 && i < newCards.length) {
          updatedBoard[index] = newCards[i];
        }
      });

      return {
        ...prevState,
        board: updatedBoard,
        deck: remainingDeck
      };
    });
  };

  // The legacy run never changes attributes between rounds (one 3-attribute level,
  // then endless with all five), so the shop always leads straight to the next round.
  const handleProceedFromShop = () => {
    startNextRound();
  };

  // Handle continuing to endless mode from victory screen
  const handleContinueEndless = () => {
    // Enable endless mode and proceed to level up
    const options = generateLevelUpOptions();
    setState(prevState => ({
      ...prevState,
      isEndlessMode: true,
      roundCompleted: false,
      gameEnded: false,
      levelUpOptions: options
    }));
    setGamePhase('level_up');
  };

  const startNextRound = () => {
    const nextRoundInLevel = roundInLevel + 1;

    if (getRunVictory('starting_next_round', { round: state.round, roundInLevel, isEndlessMode: state.isEndlessMode })) {
      LevelProgressStorage.recordCompletion(LEGACY_RUN_LEVEL.number, selectedCharacter!);
      LevelProgressStorage.unlockNextLevel(LEGACY_RUN_LEVEL.number);

      const nextLockedCharacter = CharacterUnlockStorage.getNextLockedCharacter();
      if (nextLockedCharacter) {
        CharacterUnlockStorage.unlockCharacter(nextLockedCharacter);
        setNotification({
          message: `Level ${LEGACY_RUN_LEVEL.number} Complete! Unlocked ${nextLockedCharacter}!`,
          type: 'success'
        });
      } else {
        setNotification({
          message: `Level ${LEGACY_RUN_LEVEL.number} Complete!`,
          type: 'success'
        });
      }

      setGamePhase('victory');
      return;
    }

    setRoundInLevel(nextRoundInLevel);

    const roundReq = getLevelRoundRequirement(nextRoundInLevel);
    const nextRound = state.round + 1;

    // Reset hint triggers to prevent auto-triggering on round start
    setHintTrigger(0);
    setClearHintTrigger(0);

    const newActiveAttributes = getNextRoundAttributes(state.isEndlessMode);
    // The draw deck carries over from the previous round; only the board is dealt fresh.
    const newBoard = dealBoard(newActiveAttributes, totalStats.fieldSize, nextRound);

    setRoundStats({
      moneyEarned: 0,
      experienceEarned: 0,
      hintsEarned: 0,
      healingDone: 0,
      bonusWeaponsEarned: 0,
      startLevel: state.player.stats.level,
    });

    resetRoundStats(roundReq.targetScore, totalStats.hints || 0, totalStats.graces || 0);

    setState(prevState => {
      const prevTotalStats = calculatePlayerTotalStats(prevState.player);

      // Only endless mode offers enemies (on the enemy selection screen)
      const enemies = prevState.isEndlessMode
        ? getRandomEnemyOptions(getEnemyTierForRound(nextRound), 3, prevState.defeatedEnemies, prevState.awardedStretchGoalWeapons, prevTotalStats, prevState.player.weapons)
        : [];
      const shopWeapons = generateShopWeapons(4, prevState.player.weapons, nextRound, prevTotalStats.luck);

      // Health is refilled every round; graces are topped up if a weapon guarantees some
      const guaranteedGraces = guaranteedRoundStartGraces(prevState.player.weapons);
      const player = {
        ...prevState.player,
        stats: {
          ...prevState.player.stats,
          health: prevTotalStats.maxHealth,
          graces: Math.max(prevState.player.stats.graces, guaranteedGraces),
        },
      };
      const roundStartStats = calculatePlayerTotalStats(player);

      const startingConnections = roundStartStats.startingConnections || 0;
      const connections = startingConnections > 0 && newBoard.length >= 2
        ? createRandomConnections(newBoard.length, startingConnections, [])
        : [];

      return {
        ...prevState,
        round: nextRound,
        activeAttributes: newActiveAttributes,
        targetScore: roundReq.targetScore,
        remainingTime: roundReq.time + getRoundStartTimeBonus(roundStartStats),
        score: 0,
        board: newBoard,
        foundCombinations: [],
        roundCompleted: false,
        gameStarted: !prevState.isEndlessMode,
        startTime: prevState.isEndlessMode ? prevState.startTime : Date.now(),
        currentEnemies: enemies,
        shopWeapons,
        rerollCost: getBaseRerollCostForRound(nextRound),
        activeEnemyInstance: null,
        selectedEnemyReward: null,
        selectedEnemyMoney: null,
        connections,
        player,
      };
    });

    setGamePhase(state.isEndlessMode ? 'enemy_select' : 'round');
  };

  // GameBoard props shared by the round and free play screens
  const gameBoardProps = {
    cards: state.board,
    onMatch: handleValidMatch,
    onMatchStart: handleMatchStart,
    onInvalidSelection: handleInvalidMatch,
    weapons: state.player.weapons,
    isPlayerTurn: true,
    activeAttributes: state.activeAttributes,
    onSelectedCountChange: fighter.setSelectedCount,
    onBoardIdleChange: fighter.setIsBoardIdle,
    onHintStateChange: setHasActiveHint,
    onUseHint: handleUseHint,
    triggerHint: hintTrigger > 0 ? hintTrigger : undefined,
    triggerClearHint: clearHintTrigger > 0 ? clearHintTrigger : undefined,
    onCardBurn: handleCardBurn,
    isPaused: isMenuOpen,
    lastMatchTime,
    autoPlayer: autoPlayerEnabled,
    timeGainContext: {
      triggersThisRound: getTimeGainTriggers(),
      effectiveCap: getTimeGainTriggerCap(totalStats, state.player.weapons, getTimeGainTriggerCapBonus()),
    },
    onTimeGainTriggered: recordTimeGainTrigger,
    connections: state.connections,
  };

  const renderGamePhase = () => {
    switch (gamePhase) {
      case 'main_menu':
        return (
          <>
            <MainMenu
              onSelectAdventure={() => setGamePhase('adventure')}
              onSelectFreeplay={() => setGamePhase('difficulty_select')}
              onSelectTutorial={handleTutorialStart}
              onSelectOptions={() => setShowOptionsModal(true)}
              onResumeGame={resumeGame}
            />
            <OptionsMenu
              visible={showOptionsModal}
              onClose={() => setShowOptionsModal(false)}
            />
          </>
        );

      case 'adventure':
        return <AdventureMode onExit={exitToMenu} autoPlayer={autoPlayerEnabled} />;

      case 'difficulty_select':
        return (
          <DifficultySelection
            onStart={startFreePlay}
            onExitGame={exitToMenu}
          />
        );

      case 'tutorial':
        return (
          <TutorialScreen
            onComplete={exitToMenu}
            onExit={exitToMenu}
          />
        );

      case 'enemy_select':
        return (
          <EnemySelection
            enemies={state.currentEnemies}
            onSelect={handleEnemySelect}
            round={state.round}
            playerStats={totalStats}
            playerWeapons={state.player.weapons}
            character={state.player.character}
            onExitGame={exitToMenu}
          />
        );

      case 'round_summary':
        return (
          <RoundSummary
            round={roundInLevel}
            matchCount={state.foundCombinations.length}
            score={state.score}
            moneyEarned={roundStats.moneyEarned}
            experienceEarned={roundStats.experienceEarned}
            bonusWeapons={roundStats.bonusWeaponsEarned}
            hintsEarned={roundStats.hintsEarned}
            healingDone={roundStats.healingDone}
            didLevelUp={state.player.stats.level > roundStats.startLevel}
            onContinue={() => {
              // Level ups now happen during gameplay via modal
              setGamePhase('shop');
            }}
            playerStats={totalStats}
            playerWeapons={state.player.weapons}
            character={state.player.character}
            onExitGame={exitToMenu}
            roundScores={buildRoundScores(roundHistory)}
            enemy={state.activeEnemyInstance ?? undefined}
            enemyDefeated={enemyDefeated}
            stretchGoalReward={state.selectedEnemyReward}
            stretchGoalMoney={state.selectedEnemyMoney}
          />
        );

      case 'level_up':
        return (
          <LevelUp
            options={state.levelUpOptions}
            onSelect={handleLevelUpSelection}
            onReroll={handleLevelUpReroll}
            rerollCost={state.rerollCost}
            playerMoney={state.player.stats.money}
            freeRerolls={state.player.stats.freeRerolls}
            playerStats={totalStats}
            playerWeapons={state.player.weapons}
            character={state.player.character}
            onExitGame={exitToMenu}
            targetLevel={state.player.stats.level}
          />
        );

      case 'shop':
        return (
          <WeaponShop
            weapons={state.shopWeapons}
            playerMoney={state.player.stats.money}
            onPurchase={handleWeaponPurchase}
            onReroll={handleWeaponShopReroll}
            rerollCost={state.rerollCost}
            freeRerolls={state.player.stats.freeRerolls}
            onContinue={handleProceedFromShop}
            playerStats={totalStats}
            playerWeapons={state.player.weapons}
            character={state.player.character}
            onExitGame={exitToMenu}
          />
        );

      case 'character_unlock':
        return unlockedCharacter ? (
          <CharacterUnlockScreen
            character={unlockedCharacter}
            onContinue={() => {
              setUnlockedCharacter(null);
              setGamePhase('victory');
            }}
          />
        ) : null;

      case 'round':
        return (
          <View nativeID="round-screen" className="flex-1">
            {/* Header area - 10% of screen */}
            <View nativeID="round-header" className="h-[10%] px-2 py-1">
              <GameInfo
                round={state.round}
                score={state.score}
                targetScore={state.targetScore}
                time={state.remainingTime}
                totalTime={getRunRoundRequirement(state.round).time}
                playerStats={totalStats}
                playerWeapons={state.player.weapons}
                character={state.player.character}
                fighterMood={fighter.mood}
                fighterReaction={fighter.reaction}
                fighterStreak={fighter.streak}
                onHintPress={() => setHintTrigger(t => t + 1)}
                onClearHint={() => setClearHintTrigger(t => t + 1)}
                hasActiveHint={hasActiveHint}
                onExitGame={exitToMenu}
                onEndRoundEarly={completeRound}
                canEndRoundEarly={state.score >= state.targetScore}
                devCallbacks={devCallbacks}
                onMenuOpenChange={setIsMenuOpen}
              />
            </View>

            {/* Game board area - 90% of screen */}
            <View nativeID="round-gameboard" className="h-[90%]">
              <GameBoard
                {...gameBoardProps}
                playerStats={applyEnemyStatModifiers(totalStats, state.activeEnemyInstance)}
                enemy={state.activeEnemyInstance}
                roundStats={roundStatsRef}
              />
            </View>

            {/* In-round level-up modal (NEW level-based system) */}
            <LevelUpModal
              visible={showLevelUpModal}
              options={state.levelUpOptions}
              onSelect={handleInRoundLevelUpSelect}
              onReroll={handleInRoundLevelUpReroll}
              rerollCost={state.rerollCost}
              playerMoney={state.player.stats.money}
              freeRerolls={state.player.stats.freeRerolls}
              playerStats={totalStats}
              playerWeapons={state.player.weapons}
              character={state.player.character}
              targetLevel={inRoundLevelUpQueue[0] || state.player.stats.level}
              hasMoreLevelUps={inRoundLevelUpQueue.length > 1}
            />
          </View>
        );

      case 'free_play':
        return (
          <View nativeID="free-play-screen" style={freePlayStyles.container}>
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
              onExit={exitToMenu}
            />

            {/* Game board area - fills remaining space */}
            <View style={freePlayStyles.boardContainer}>
              <GameBoard {...gameBoardProps} playerStats={totalStats} />
            </View>
          </View>
        );

      case 'victory':
        return (
          <VictoryScreen
            player={state.player}
            finalScore={state.score}
            matchCount={state.foundCombinations.length}
            playerStats={totalStats}
            roundScores={buildRoundScores(roundHistory)}
            difficulty={adventureDifficulty}
            onReturnToMenu={() => {
              setState(prev => ({ ...prev, isEndlessMode: false }));
              setGamePhase('main_menu');
            }}
            onContinueEndless={handleContinueEndless}
          />
        );

      case 'game_over':
        return (
          <GameOverScreen
            character={state.player.character}
            health={totalStats.health}
            maxHealth={totalStats.maxHealth}
            reason={gameOverReason}
            enemy={state.activeEnemyInstance}
            round={state.round}
            score={state.score}
            targetScore={state.targetScore}
            roundScores={buildRoundScores(roundHistory, { roundInLevel, score: state.score })}
            onPlayAgain={() => {
              setGameOverReason(null);
              setState(prev => ({ ...prev, isEndlessMode: false }));
              setGamePhase('main_menu');
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View className="flex-1">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {renderGamePhase()}

      {/* Particle effects layer - rendered last to appear on top */}
      <Particles />
    </View>
  );
};

// Free Play mode styles
const freePlayStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  boardContainer: {
    flex: 1,
  },
});

export default Game;
