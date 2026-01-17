import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, Dimensions } from 'react-native';
import { Card, CardReward, GameState, Weapon, PlayerStats, AttributeName, AdventureDifficulty, Character } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { createDeck, shuffleArray, isValidCombination, findAllCombinations, generateGameBoard, formatTime, sameCardAttributes } from '@/utils/gameUtils';
import {
  CHARACTERS,
  ITEMS,
  WEAPONS,
  ROUND_REQUIREMENTS,
  initializePlayer,
  calculatePlayerTotalStats,
  DEFAULT_PLAYER_STATS,
  generateShopWeapons,
  getRandomShopWeapon,
  getEndlessRoundRequirement
} from '@/utils/gameDefinitions';
import { getActiveAttributesForRound, getBoardSizeForAttributes, ATTRIBUTE_SCALING } from '@/utils/gameConfig';
import { getAdjacentIndices, getFireSpreadCards, WeaponEffectResult } from '@/utils/weaponEffects';
import { useGameTimer } from '@/hooks/useGameTimer';
import { useParticles } from '@/hooks/useParticles';
import { useRoundStats } from '@/hooks/useRoundStats';
import { createEnemy, createDummyEnemy, applyEnemyStatModifiers, getRandomEnemies, getRandomEnemyOptions } from '@/utils/enemyFactory';
import { generateChallengeBonus } from '@/utils/rewardUtils';
import '@/utils/enemies'; // Trigger enemy self-registration
import type { EnemyInstance, EnemyOption } from '@/types/enemy';
import GameBoard from './GameBoard';
import GameInfo from './GameInfo';
import { DevModeCallbacks } from './GameMenu';
import Notification from './Notification';
import { useSocket } from '@/context/SocketContext';
import MultiplayerLobby from './MultiplayerLobby';
import MultiplayerToggle from './MultiplayerToggle';
import CharacterSelection, { GameMode, FreePlayDifficulty } from './CharacterSelection';
import ItemShop from './ItemShop';
import WeaponShop from './WeaponShop';
import LevelUp from './LevelUp';
import EnemySelection from './EnemySelection';
import RoundScoreboard from './RoundScoreboard';
import RoundSummary from './RoundSummary';
import TutorialScreen from './TutorialScreen';
import AttributeUnlockScreen from './AttributeUnlockScreen';
import VictoryScreen from './VictoryScreen';
import RoundProgressChart, { RoundScore } from './RoundProgressChart';
import CharacterUnlockScreen from './CharacterUnlockScreen';
import Icon from './Icon';
import MainMenu from './MainMenu';
import DifficultySelection from './DifficultySelection';
import OptionsMenu from './OptionsMenu';
import { useTutorial } from '@/context/TutorialContext';
import { CharacterWinsStorage, EndlessHighScoresStorage, AdventureHighRoundStorage, CharacterUnlockStorage } from '@/utils/storage';
import { playSound, playCardDealing } from '@/utils/sounds';

const INITIAL_CARD_COUNT = 12;
const MAX_BOARD_SIZE = 21;
const BASE_REROLL_COST = 5;

// Get round requirement (handles both regular and endless rounds)
const getRoundRequirement = (round: number) => {
  if (round > 10) {
    return getEndlessRoundRequirement(round);
  }
  return ROUND_REQUIREMENTS.find(r => r.round === round) ||
         { round: 1, targetScore: 3, time: 60 };
};

// Helper function to check if an option is a weapon
const isWeapon = (option: Partial<PlayerStats> | Weapon): option is Weapon => {
  return 'name' in option && 'level' in option;
};

// Calculate player level based on experience points
const calculateLevel = (experience: number): number => {
  // Simple level formula: level = floor(sqrt(experience/10))
  // Level 1 requires 10 XP, Level 2 requires 40 XP, Level 3 requires 90 XP, etc.
  return Math.floor(Math.sqrt(experience / 10));
};

// Get enemy tier based on round number
// Tier 1: Rounds 1-4
// Tier 2: Rounds 5-7
// Tier 3: Rounds 8-9
// Tier 4: Round 10+ (bosses)
const getTierForRound = (round: number): 1 | 2 | 3 | 4 => {
  if (round >= 10) return 4;
  if (round >= 8) return 3;
  if (round >= 5) return 2;
  return 1;
};

interface GameProps {
  devMode?: boolean;
  autoPlayer?: boolean;
  /** Force a specific enemy by name (skips enemy selection screen) */
  forcedEnemy?: string;
  /** Speed up animations for faster test runs */
  speedMode?: boolean;
  /** Disable round timer for deterministic testing */
  disableTimeout?: boolean;
}

const Game: React.FC<GameProps> = ({
  devMode = false,
  autoPlayer = false,
  forcedEnemy,
  speedMode = false,
  disableTimeout = false,
}) => {
  // Character selection state
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(devMode ? 'Orange Tabby' : null);
  const [gameMode, setGameMode] = useState<GameMode>('adventure');
  const [freePlayDifficulty, setFreePlayDifficulty] = useState<FreePlayDifficulty>('medium');
  const [adventureDifficulty, setAdventureDifficulty] = useState<AdventureDifficulty>('medium');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [gamePhase, setGamePhase] = useState<
    'main_menu' |
    'character_select' |
    'difficulty_select' |
    'tutorial' |
    'round' |
    'round_summary' |
    'loot' |
    'level_up' |
    'shop' |
    'attribute_unlock' |
    'character_unlock' |
    'victory' |
    'enemy_select' |
    'game_over' |
    'free_play'
  >(devMode ? 'round' : 'main_menu');

  // Track pending attribute unlock for next round
  const [pendingUnlockedAttribute, setPendingUnlockedAttribute] = useState<AttributeName | null>(null);
  const [isFinalRoundWarning, setIsFinalRoundWarning] = useState(false);

  // Track unlocked character for character unlock screen
  const [unlockedCharacter, setUnlockedCharacter] = useState<Character | null>(null);

  // Track round scores for progress chart
  const [roundHistory, setRoundHistory] = useState<Array<{ round: number; target: number; actual: number }>>([]);

  // Tutorial context
  const { state: tutorialState, startTutorial, markTutorialOffered } = useTutorial();

  const [state, setState] = useState<GameState>(() => {
    const activeAttributes = getActiveAttributesForRound(1);
    const boardSize = getBoardSizeForAttributes(activeAttributes.length);

    // In dev mode, initialize with a ready-to-play board
    if (devMode) {
      const initialBoard = generateGameBoard(boardSize, 1, 1, activeAttributes);
      const deck = shuffleArray(createDeck(activeAttributes));
      const remainingDeck = deck.filter(card =>
        !initialBoard.some(boardCard => boardCard.id === card.id)
      );

      return {
        deck: remainingDeck,
        board: initialBoard,
        selectedCards: [],
        foundCombinations: [],
        score: 0,
        gameStarted: true,
        gameEnded: false,
        startTime: Date.now(),
        endTime: null,
        hintUsed: false,
        activeAttributes,
        round: 1,
        targetScore: getRoundRequirement(1).targetScore,
        remainingTime: getRoundRequirement(1).time,
        roundCompleted: false,
        player: initializePlayer('dev', 'Dev Player', 'Orange Tabby'),
        shopItems: [],
        shopWeapons: [],
        levelUpOptions: [],
        rerollCost: BASE_REROLL_COST,
        currentEnemies: [],
        selectedEnemy: null,
        activeEnemyInstance: null,
        selectedEnemyReward: null,
        defeatedEnemies: [],
        awardedStretchGoalWeapons: [],
        lootCrates: 0,
        isCoOp: false,
        players: [],
        isEndlessMode: false
      };
    }

    // Normal mode - empty board until character selection
    return {
      deck: [],
      board: [],
      selectedCards: [],
      foundCombinations: [],
      score: 0,
      gameStarted: false,
      gameEnded: false,
      startTime: null,
      endTime: null,
      hintUsed: false,
      activeAttributes,
      round: 1,
      targetScore: getRoundRequirement(1).targetScore,
      remainingTime: getRoundRequirement(1).time,
      roundCompleted: false,
      player: initializePlayer('player1', 'Player 1', 'Orange Tabby'),
      shopItems: [],
      shopWeapons: [],
      levelUpOptions: [],
      rerollCost: BASE_REROLL_COST,
      currentEnemies: [],
      selectedEnemy: null,
      activeEnemyInstance: null,
      selectedEnemyReward: null,
      defeatedEnemies: [],
      awardedStretchGoalWeapons: [],
      lootCrates: 0,
      isCoOp: false,
      players: [],
      isEndlessMode: false
    };
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  // Particle effects for match celebrations
  const { spawnParticles, Particles } = useParticles();

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
  } = useRoundStats();

  // UI state for header stats
  const [hasActiveHint, setHasActiveHint] = useState(false);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [clearHintTrigger, setClearHintTrigger] = useState(0);

  // Menu open state - used to pause game when menu is open
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Last match timestamp for auto-hint timing (triggers 15s after last match)
  const [lastMatchTime, setLastMatchTime] = useState<number>(Date.now());

  // Game over reason
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);

  // Keyboard shortcut for hints (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || gamePhase !== 'round') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        const playerStats = calculatePlayerTotalStats(state.player);
        const hintsAvailable = playerStats.hints ?? 0;

        if (hasActiveHint) {
          // Clear active hint
          setClearHintTrigger(t => t + 1);
        } else if (hintsAvailable > 0) {
          // Use a hint
          setHintTrigger(t => t + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gamePhase, hasActiveHint, state.player]);

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
  const [defeatedEnemyTier, setDefeatedEnemyTier] = useState<1 | 2 | 3 | 4>(1);

  // Queue of pending level-ups (for multi-level-up support)
  const [pendingLevelUps, setPendingLevelUps] = useState<number[]>([]);

  // Dev mode state
  const [devTimerEnabled, setDevTimerEnabled] = useState(!devMode); // Timer disabled by default in dev mode
  const [autoPlayerEnabled, setAutoPlayerEnabled] = useState(autoPlayer); // Start with URL param value

  // Socket context for multiplayer
  const {
    isMultiplayer,
    roomId,
    isHost,
    startGame: startMultiplayerGame,
    selectCard: selectMultiplayerCard,
    combinationFound: sendCombinationFound,
    addCards: sendAddCards,
    showHint: sendShowHint
  } = useSocket();

  // Function declarations
  // Add an endGame function
  const endGame = (victory: boolean, reason?: string) => {
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

    if (victory) {
      setGameOverReason(null);
      setNotification({
        message: 'Congratulations! You completed all rounds!',
        type: 'success'
      });
    } else {
      const lossReason = reason || 'You ran out of time.';
      setGameOverReason(lossReason);
      setNotification({
        message: `Game Over! ${lossReason}`,
        type: 'error'
      });
      playSound('gameOver');
    }

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
      setDefeatedEnemyTier(state.activeEnemyInstance.tier);
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
          return {
            ...prevState,
            defeatedEnemies: [...prevState.defeatedEnemies, state.activeEnemyInstance!.name],
            awardedStretchGoalWeapons: newAwardedWeaponIds,
            player: {
              ...prevState.player,
              weapons: newWeapons,
            },
          };
        });
      }
      state.activeEnemyInstance.onRoundEnd();
    } else {
      setEnemyDefeated(false);
      setDefeatedEnemyTier(1);
    }

    // Record this round's score in history
    const roundReq = getRoundRequirement(state.round);
    setRoundHistory(prev => [
      ...prev.filter(r => r.round !== state.round), // Replace if exists
      { round: state.round, target: roundReq.targetScore, actual: state.score }
    ]);

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

    // Check if this is the final round (Round 10) - if so, check for character unlock then victory
    if (state.round >= 10) {
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
    !disableTimeout;

  // Generate a unique key based on game start time to force timer reset on new games
  const timerKey = state.startTime || 0;

  useGameTimer(isTimerActive, () => {
    setState(prev => {
      // Basic time decrement
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

        // Apply score delta (clamp to 0)
        newScore = Math.max(0, prev.score + tickResult.scoreDelta);

        // Apply health delta
        newHealth = prev.player.stats.health + tickResult.healthDelta;

        // Handle instant death
        if (tickResult.instantDeath) {
          newHealth = 0;
        }

        // Remove cards (NO replacement - board shrinks)
        if (tickResult.cardsToRemove.length > 0) {
          newBoard = prev.board.filter(card => !tickResult.cardsToRemove.includes(card.id));
        }

        // Apply card modifications
        if (tickResult.cardModifications.length > 0) {
          newBoard = newBoard.map(card => {
            const mod = tickResult.cardModifications.find(m => m.cardId === card.id);
            return mod ? { ...card, ...mod.changes } : card;
          });
        }

        // Flip cards
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
        endGame(false);
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
        // Create the enemy directly and use it
        const enemy = createEnemy(forcedEnemy);
        const option: EnemyOption = {
          enemy,
          stretchGoalReward: generateChallengeBonus(enemy.tier, state.awardedStretchGoalWeapons),
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

  // Initialize the game
  // startGame param ensures all game start state is set atomically to avoid React batching issues
  const initGame = useCallback((characterName: string, activeAttributes: AttributeName[], startGame: boolean = false) => {
    // Initialize player first to get their starting weapons and stats
    const player = initializePlayer('player1', 'Player 1', characterName);
    const totalStats = calculatePlayerTotalStats(player);

    // Calculate board size: max of player's fieldSize (with weapon bonuses) and minimum for attributes
    const baseBoardSize = getBoardSizeForAttributes(activeAttributes.length);
    const boardSize = Math.max(baseBoardSize, totalStats.fieldSize);

    // Generate initial board with modifiers based on difficulty
    const initialBoard = generateGameBoard(boardSize, 1, 1, activeAttributes);
    const deck = shuffleArray(createDeck(activeAttributes));
    const remainingDeck = deck.filter(card =>
      !initialBoard.some(boardCard => sameCardAttributes(boardCard, card))
    );

    // Get round 1 requirements
    const roundReq = getRoundRequirement(1);

    // Calculate time with starting bonus if game is starting
    // Also add bonus time for excess health (health > 3 = +3s per extra HP)
    const weaponTimeBonus = startGame ? (totalStats.startingTime || 0) : 0;
    const excessHealth = Math.max(0, totalStats.health - 3);
    const healthTimeBonus = startGame ? (excessHealth * 3) : 0; // +3 seconds per excess HP
    const timeBonus = weaponTimeBonus + healthTimeBonus;

    // Reset enemy round stats for defeat condition tracking
    resetRoundStats(roundReq.targetScore, totalStats.hints || 0, totalStats.graces || 0);

    // Don't apply enemy effects during init - that happens when player selects enemy
    const finalBoard = initialBoard;

    setState({
      // Core game
      deck: remainingDeck,
      board: finalBoard,
      selectedCards: [],
      foundCombinations: [],
      score: 0,
      gameStarted: startGame,
      gameEnded: false,
      startTime: startGame ? Date.now() : null,
      endTime: null,
      hintUsed: false,

      // Attribute scaling
      activeAttributes,

      // Roguelike properties
      round: 1,
      targetScore: roundReq.targetScore,
      remainingTime: roundReq.time + timeBonus,
      roundCompleted: false,

      // Player (already initialized above for fieldSize calculation)
      player,

      // Shop and upgrades - to be filled during gameplay
      shopItems: generateRandomShopItems(),
      shopWeapons: generateShopWeapons(4, undefined, 1),  // Round 1 rarity scaling
      levelUpOptions: [],
      rerollCost: BASE_REROLL_COST,

      // Enemy - to be selected during gameplay (with pre-determined rewards)
      currentEnemies: getRandomEnemyOptions(getTierForRound(1), 3, [], []),  // No defeated enemies or awarded weapons at start
      selectedEnemy: null,
      activeEnemyInstance: null,  // Set when player selects enemy
      selectedEnemyReward: null,
      defeatedEnemies: [],  // Track which enemies have been defeated
      awardedStretchGoalWeapons: [],  // Track which weapons have been awarded as stretch goals

      // Loot and rewards
      lootCrates: 0,

      // Co-op
      isCoOp: isMultiplayer,
      players: [],

      // Endless mode
      isEndlessMode: false
    });

    setNotification(null);
  }, [isMultiplayer, resetRoundStats]);

  // Generate 3 random enemies from the appropriate tier for the round (with pre-determined rewards)
  const generateEnemiesForRound = (
    round: number,
    defeatedEnemies: string[] = [],
    awardedWeaponIds: string[] = [],
    playerStats?: PlayerStats,
    playerWeapons?: Weapon[]
  ): EnemyOption[] => {
    const tier = getTierForRound(round);
    return getRandomEnemyOptions(tier, 3, defeatedEnemies, awardedWeaponIds, playerStats, playerWeapons);
  };

  // Generate random shop items
  const generateRandomShopItems = () => {
    const shopSize = 4 + (state?.player?.stats?.drawIncrease || 0);
    const availableItems = [...ITEMS];
    const selectedItems = [];

    const playerItems = state?.player?.items || [];
    const playerItemNames = playerItems.map(item => item.name);

    // Filter out limited items the player already has
    const filteredItems = availableItems.filter(item => {
      if (item.limit === null) return true;

      // Count how many of this item the player already has
      const count = playerItemNames.filter(name => name === item.name).length;
      return count < item.limit;
    });

    for (let i = 0; i < shopSize; i++) {
      if (filteredItems.length === 0) break;

      const randomIndex = Math.floor(Math.random() * filteredItems.length);
      selectedItems.push(filteredItems[randomIndex]);
      filteredItems.splice(randomIndex, 1);
    }

    return selectedItems;
  };

  // Generate random level up options - WEAPONS ONLY
  const generateLevelUpOptions = () => {
    const options: Weapon[] = [];
    const optionsSize = 4 + (state.player?.stats?.drawIncrease || 0);

    // Generate only weapon options
    for (let i = 0; i < optionsSize; i++) {
      // Get a random shop weapon
      const weapon = getRandomShopWeapon();
      options.push(weapon);
    }

    return options;
  };

  // Tutorial prompt modal state
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const [pendingGameStart, setPendingGameStart] = useState<{
    mode: GameMode;
  } | null>(null);

  // Start the game
  // Start Adventure Mode (called from Character Selection)
  const startAdventure = (difficulty: AdventureDifficulty) => {
    if (!selectedCharacter) {
      setNotification({
        message: 'Please select a character first',
        type: 'warning'
      });
      return;
    }

    // Check if we should show tutorial prompt for Adventure mode
    if (!tutorialState.hasCompletedTutorial && !tutorialState.hasBeenOfferedTutorial) {
      setPendingGameStart({ mode: 'adventure' });
      setAdventureDifficulty(difficulty);
      setShowTutorialPrompt(true);
      return;
    }

    setGameMode('adventure');
    setAdventureDifficulty(difficulty);

    // Adventure mode - start with round 1 attributes based on difficulty
    const activeAttributes = getActiveAttributesForRound(1, difficulty);

    // Initialize the game with the selected character and attributes
    // Don't start game yet - player needs to select enemy first
    initGame(selectedCharacter, activeAttributes, false);

    // Reset hint triggers to prevent auto-triggering on game start
    setHintTrigger(0);
    setClearHintTrigger(0);

    // Clear round history for new game
    setRoundHistory([]);

    // Go to enemy selection screen
    setGamePhase('enemy_select');
  };

  // Start Free Play Mode (called from Difficulty Selection)
  const startFreePlay = (difficulty: FreePlayDifficulty) => {
    setGameMode('free_play');
    setFreePlayDifficulty(difficulty);

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

  // Handle character selection
  const handleCharacterSelect = (characterName: string) => {
    setSelectedCharacter(characterName);
  };

  // Handle tutorial start
  const handleTutorialStart = () => {
    startTutorial();
    setGamePhase('tutorial');
  };

  // Handle tutorial complete - return to main menu
  const handleTutorialComplete = () => {
    setGamePhase('main_menu');
  };

  // Handle tutorial exit - return to main menu
  const handleTutorialExit = () => {
    setGamePhase('main_menu');
  };

  // Handle tutorial prompt - user wants to do tutorial
  const handleTutorialPromptYes = () => {
    setShowTutorialPrompt(false);
    markTutorialOffered();
    handleTutorialStart();
  };

  // Handle tutorial prompt - user wants to skip and start adventure
  const handleTutorialPromptSkip = () => {
    setShowTutorialPrompt(false);
    markTutorialOffered();
    setPendingGameStart(null);

    // Continue with adventure mode start using stored difficulty
    setGameMode('adventure');
    const activeAttributes = getActiveAttributesForRound(1, adventureDifficulty);

    // Don't start game yet - player needs to select enemy first
    initGame(selectedCharacter!, activeAttributes, false);
    setHintTrigger(0);
    setClearHintTrigger(0);

    // Go to enemy selection screen
    setGamePhase('enemy_select');
  };

  // Handle enemy selection - player has chosen which enemy to fight
  const handleEnemySelect = (enemyOption: EnemyOption) => {
    const { enemy, stretchGoalReward } = enemyOption;

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
      selectedEnemy: enemy,
      activeEnemyInstance: enemy,  // Set the active enemy instance
      selectedEnemyReward: stretchGoalReward,  // Store the pre-determined reward
      gameStarted: true,
      startTime: Date.now()
    }));

    // Start the round
    setGamePhase('round');
  };

  // Handle item purchase (legacy - kept for backwards compatibility)
  const handleItemPurchase = (itemIndex: number) => {
    const item = state.shopItems[itemIndex];
    if (!item) return;

    if (state.player.stats.money < item.price) {
      setNotification({
        message: 'Not enough money to purchase this item',
        type: 'error'
      });
      return;
    }

    // Check if item has a limit and player already has max
    if (item.limit !== null) {
      const playerItemCount = state.player.items.filter(i => i.name === item.name).length;
      if (playerItemCount >= item.limit) {
        setNotification({
          message: 'You already have the maximum number of this item',
          type: 'error'
        });
        return;
      }
    }

    // Purchase the item
    setState(prevState => ({
      ...prevState,
      player: {
        ...prevState.player,
        stats: {
          ...prevState.player.stats,
          money: prevState.player.stats.money - item.price
        },
        items: [...prevState.player.items, item]
      },
      // Mark the slot as sold (null) instead of removing to preserve layout
      shopItems: prevState.shopItems.map((shopItem, index) =>
        index === itemIndex ? null : shopItem
      )
    }));
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

    // Purchase the weapon - weapons stack, so no limit check
    setState(prevState => {
      // Calculate the new max values after adding this weapon
      const newWeapons = [...prevState.player.weapons, weapon];
      const newPlayer = { ...prevState.player, weapons: newWeapons };
      const newTotalStats = calculatePlayerTotalStats(newPlayer);

      // Grant immediate bonuses for capacity-increasing weapons
      let hintsBonus = 0;
      let gracesBonus = 0;

      // If weapon increases maxHints, grant +1 immediate hint (up to new max)
      if (weapon.effects.maxHints && typeof weapon.effects.maxHints === 'number') {
        hintsBonus = Math.min(1, newTotalStats.maxHints - prevState.player.stats.hints);
      }

      // If weapon grants graces (Second Chance), grant them immediately
      if (weapon.effects.graces && typeof weapon.effects.graces === 'number') {
        gracesBonus = weapon.effects.graces;
      }

      return {
        ...prevState,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            money: prevState.player.stats.money - weapon.price,
            hints: Math.min(prevState.player.stats.hints + hintsBonus, newTotalStats.maxHints),
            graces: Math.min(prevState.player.stats.graces + gracesBonus, newTotalStats.maxGraces),
          },
          weapons: newWeapons
        },
        // Mark the slot as sold (null) instead of removing to preserve layout
        shopWeapons: prevState.shopWeapons.map((shopWeapon, index) =>
          index === weaponIndex ? null : shopWeapon
        )
      };
    });
  };

  // Handle weapon shop reroll
  const handleWeaponShopReroll = () => {
    if (state.player.stats.money < state.rerollCost && state.player.stats.freeRerolls <= 0) {
      setNotification({
        message: 'Not enough money to reroll the shop',
        type: 'error'
      });
      return;
    }

    // Check if player has free rerolls
    if (state.player.stats.freeRerolls > 0) {
      setState(prevState => ({
        ...prevState,
        shopWeapons: generateShopWeapons(4, prevState.player.weapons, prevState.round),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            freeRerolls: prevState.player.stats.freeRerolls - 1
          }
        }
      }));
    } else {
      // Charge for the reroll
      setState(prevState => ({
        ...prevState,
        shopWeapons: generateShopWeapons(4, prevState.player.weapons, prevState.round),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            money: prevState.player.stats.money - prevState.rerollCost
          }
        },
        rerollCost: prevState.rerollCost + 2 // Increase reroll cost
      }));
    }
  };

  // Handle shop reroll
  const handleShopReroll = () => {
    if (state.player.stats.money < state.rerollCost && state.player.stats.freeRerolls <= 0) {
      setNotification({
        message: 'Not enough money to reroll the shop',
        type: 'error'
      });
      return;
    }

    // Check if player has free rerolls
    if (state.player.stats.freeRerolls > 0) {
      setState(prevState => ({
        ...prevState,
        shopItems: generateRandomShopItems(),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            freeRerolls: prevState.player.stats.freeRerolls - 1
          }
        }
      }));
    } else {
      // Charge for the reroll
      setState(prevState => ({
        ...prevState,
        shopItems: generateRandomShopItems(),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            money: prevState.player.stats.money - prevState.rerollCost
          }
        },
        rerollCost: prevState.rerollCost + 2 // Increase reroll cost
      }));
    }
  };

  // Handle level up selection - receives the selected weapon directly
  const handleLevelUpSelection = (weapon: Weapon) => {
    // Add the weapon to player's inventory (weapons stack) with immediate bonuses
    setState(prevState => {
      // Calculate the new max values after adding this weapon
      const newWeapons = [...prevState.player.weapons, weapon];
      const newPlayer = { ...prevState.player, weapons: newWeapons };
      const newTotalStats = calculatePlayerTotalStats(newPlayer);

      // Grant immediate bonuses for capacity-increasing weapons
      let hintsBonus = 0;
      let gracesBonus = 0;

      // If weapon increases maxHints, grant +1 immediate hint (up to new max)
      if (weapon.effects.maxHints && typeof weapon.effects.maxHints === 'number') {
        hintsBonus = Math.min(1, newTotalStats.maxHints - prevState.player.stats.hints);
      }

      // If weapon grants graces (Second Chance), grant them immediately
      if (weapon.effects.graces && typeof weapon.effects.graces === 'number') {
        gracesBonus = weapon.effects.graces;
      }

      return {
        ...prevState,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            hints: Math.min(prevState.player.stats.hints + hintsBonus, newTotalStats.maxHints),
            graces: Math.min(prevState.player.stats.graces + gracesBonus, newTotalStats.maxGraces),
          },
          weapons: newWeapons
        }
      };
    });

    setNotification({
      message: `Acquired ${weapon.name}!`,
      type: 'success'
    });

    // Clear enemy defeated state after receiving any slayer bonus
    setEnemyDefeated(false);

    // Remove current level from queue
    const remaining = pendingLevelUps.slice(1);
    setPendingLevelUps(remaining);

    if (remaining.length > 0) {
      // Generate new options and stay in level_up phase
      setState(prevState => ({
        ...prevState,
        levelUpOptions: generateLevelUpOptions()
      }));
      // Don't change phase - stay in 'level_up'
    } else {
      // No more level-ups, proceed to shop
      setGamePhase('shop');
    }
  };

  // Handle level up reroll
  const handleLevelUpReroll = () => {
    if (state.player.stats.money < state.rerollCost && state.player.stats.freeRerolls <= 0) {
      setNotification({
        message: 'Not enough money to reroll the level up options',
        type: 'error'
      });
      return;
    }

    // Check if player has free rerolls
    if (state.player.stats.freeRerolls > 0) {
      setState(prevState => ({
        ...prevState,
        levelUpOptions: generateLevelUpOptions(),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            freeRerolls: prevState.player.stats.freeRerolls - 1
          }
        }
      }));
    } else {
      // Charge for the reroll
      setState(prevState => ({
        ...prevState,
        levelUpOptions: generateLevelUpOptions(),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            money: prevState.player.stats.money - prevState.rerollCost
          }
        },
        rerollCost: prevState.rerollCost + 2 // Increase reroll cost
      }));
    }
  };

  // Handle card selection
  const handleCardClick = (card: Card) => {
    if (state.gameEnded || !state.gameStarted) return;

    // In multiplayer, send the selection to the server
    if (isMultiplayer) {
      selectMultiplayerCard(card.id, state.board);
      return;
    }

    // Check if card is already selected
    if (state.selectedCards.some(c => c.id === card.id)) {
      // Deselect the card
      setState(prevState => ({
        ...prevState,
        selectedCards: prevState.selectedCards.filter(c => c.id !== card.id)
      }));
      return;
    }

    // Add card to selection
    const newSelectedCards = [...state.selectedCards, card];

    // If we have 3 cards selected, check if they form a valid set
    if (newSelectedCards.length === 3) {
      if (isValidCombination(newSelectedCards, state.activeAttributes).isValid) {
        // Valid set found! (Legacy path - GameBoard normally handles rewards)
        const rewards: CardReward[] = newSelectedCards.map(card => ({
          cardId: card.id,
          points: 1,
          money: 1,
          experience: 1
        }));
        handleValidMatch(newSelectedCards, rewards);
      } else {
        // Invalid selection
        handleInvalidMatch(newSelectedCards);
      }
    } else {
      // Update selected cards
      setState(prevState => ({
        ...prevState,
        selectedCards: newSelectedCards
      }));
    }
  };

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

    // In multiplayer, send the match to the server
    if (isMultiplayer) {
      sendCombinationFound(state);
      return;
    }

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

      // Check defeat condition
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

    // Show grace used notification
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

      // Set fire on cards
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

    // Update game state with rewards
    setState(prevState => {
      // Calculate new level
      const currentExperience = prevState.player.stats.experience || 0;
      const newExperience = currentExperience + adjustedExperience;
      const currentLevel = prevState.player.stats.level || 0;
      const newLevel = calculateLevel(newExperience);
      const hasLeveledUp = newLevel > currentLevel;

      // Calculate new health (capped at max)
      const newHealth = Math.min(
        prevState.player.stats.health + totalHealing,
        prevState.player.stats.maxHealth
      );

      // Show notification only for level up (overrides trigger notification)
      if (hasLeveledUp) {
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
      const maxTime = getRoundRequirement(prevState.round).time + (calculatePlayerTotalStats(prevState.player).startingTime || 0);
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
        selectedCards: prevState.selectedCards.filter(c => !cards.some(mc => mc.id === c.id)),
        foundCombinations: [...prevState.foundCombinations, cards],
        lootCrates: prevState.lootCrates + bonusWeaponsCount,
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
              calculatePlayerTotalStats(prevState.player).maxHints
            ),
            // Cap graces at maxGraces (including weapon bonuses)
            graces: Math.min(
              prevState.player.stats.graces + graceDelta,
              calculatePlayerTotalStats(prevState.player).maxGraces
            )
          }
        }
      };
    });

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

      // Handle board growth if triggered
      if (weaponEffects && weaponEffects.boardGrowth > 0) {
        growBoard(weaponEffects.boardGrowth);
      }
    }, 1500);
  };

  // Set cards on fire
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
  const handleCardBurn = useCallback((burnedCard: Card) => {
    const FIRE_SPREAD_ON_DEATH_CHANCE = 10; // 10%
    const now = Date.now();

    setState(prevState => {
      let updatedBoard = [...prevState.board];
      const remainingDeck = [...prevState.deck];

      // Find the burned card's index
      const burnedIndex = updatedBoard.findIndex(c => c.id === burnedCard.id);
      if (burnedIndex === -1) return prevState;

      // Roll fire spread chance (10%) before replacing the card
      let fireSpreadTarget: Card | null = null;
      if (Math.random() * 100 < FIRE_SPREAD_ON_DEATH_CHANCE) {
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

      // Replace burned card with new one from deck
      if (remainingDeck.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingDeck.length);
        const newCard = { ...remainingDeck[randomIndex], selected: false };
        updatedBoard[burnedIndex] = newCard;
        remainingDeck.splice(randomIndex, 1);
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

      return {
        ...prevState,
        board: updatedBoard,
        deck: remainingDeck,
        score: prevState.score + 1, // +1 point per burned card
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            money: prevState.player.stats.money + 1 // +1 money per burned card
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

      // Generate new cards
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

    // Get current total stats to check graces
    const totalStats = calculatePlayerTotalStats(state.player);

    // Check how many attributes are invalid
    const validationResult = isValidCombination(cardsToReplace, state.activeAttributes);
    const invalidCount = validationResult.invalidAttributes.length;

    // Grace only saves when exactly 1 attribute is wrong AND player has graces
    if (invalidCount === 1 && totalStats.graces > 0) {
      // Use a grace instead of losing health
      setState(prevState => ({
        ...prevState,
        selectedCards: prevState.selectedCards.filter(c => !cardsToReplace.some(mc => mc.id === c.id)),
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
    // Get enemy damage multiplier
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
          endGame(false, 'You ran out of health from invalid matches!');
        }, 100);
      } else {
        // Show damage notification
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
        selectedCards: prevState.selectedCards.filter(c => !cardsToReplace.some(mc => mc.id === c.id)),
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            health: Math.max(0, newHealth)
          }
        }
      };
    });

    // Replace the invalid match cards with new ones from the deck
    if (cardsToReplace.length === 3) {
      replaceMatchedCards(cardsToReplace);
    }
  };

  // Handle using a hint (decrement hint count)
  const handleUseHint = () => {
    // Track hint usage for enemy defeat conditions
    recordHintUsed();

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

  // Dev mode callbacks
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
      const totalStats = calculatePlayerTotalStats(state.player);
      const boardSize = Math.max(totalStats.fieldSize, getBoardSizeForAttributes(state.activeAttributes.length));
      const newBoard = generateGameBoard(boardSize, state.round, state.round, state.activeAttributes);
      const deck = shuffleArray(createDeck(state.activeAttributes));
      const remainingDeck = deck.filter(card =>
        !newBoard.some(boardCard => boardCard.id === card.id)
      );
      setState(prevState => ({
        ...prevState,
        deck: remainingDeck,
        board: newBoard,
        selectedCards: [],
        remainingTime: getRoundRequirement(state.round).time,
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
      const totalStats = calculatePlayerTotalStats(state.player);
      const boardSize = Math.max(totalStats.fieldSize, getBoardSizeForAttributes(activeAttributes.length));
      const newBoard = generateGameBoard(boardSize, round, round, activeAttributes);
      const deck = shuffleArray(createDeck(activeAttributes));
      const remainingDeck = deck.filter(card =>
        !newBoard.some(boardCard => boardCard.id === card.id)
      );
      setState(prevState => ({
        ...prevState,
        round,
        activeAttributes,
        deck: remainingDeck,
        board: newBoard,
        selectedCards: [],
        targetScore: getRoundRequirement(round).targetScore,
        remainingTime: getRoundRequirement(round).time,
      }));
    },
    onChangeAttributes: (count: number) => {
      // Get attributes based on count (3=shape/color/number, 4=+shading, 5=+background)
      const allAttributes: AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];
      const activeAttributes = allAttributes.slice(0, count);
      const totalStats = calculatePlayerTotalStats(state.player);
      const boardSize = Math.max(totalStats.fieldSize, getBoardSizeForAttributes(count));
      const newBoard = generateGameBoard(boardSize, state.round, state.round, activeAttributes);
      const deck = shuffleArray(createDeck(activeAttributes));
      const remainingDeck = deck.filter(card =>
        !newBoard.some(boardCard => boardCard.id === card.id)
      );
      setState(prevState => ({
        ...prevState,
        activeAttributes,
        deck: remainingDeck,
        board: newBoard,
        selectedCards: [],
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

  // Replace matched cards
  const replaceMatchedCards = (matchedCards: Card[]) => {
    // Get new cards from the deck
    const newCards: Card[] = [];
    const remainingDeck = [...state.deck];

    // Get the matched card indices from the board
    const matchedIndices = matchedCards.map(matchedCard =>
      state.board.findIndex(boardCard => boardCard.id === matchedCard.id)
    );

    // Get board cards that are NOT being matched (will remain on board)
    const remainingBoardCards = state.board.filter(
      boardCard => !matchedCards.some(mc => mc.id === boardCard.id)
    );

    // Generate replacement cards
    // Note: Card modifiers (health, bombs, etc.) are applied by the enemy system via onCardDraw
    for (let i = 0; i < matchedCards.length; i++) {
      // Check if we need to refill the deck
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
        // Get a random card from the deck
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

    // Replace matched cards with new ones
    setState(prevState => {
      // Create a new board array with replaced cards
      const updatedBoard = [...prevState.board];

      // Replace each matched card with a new one
      matchedIndices.forEach((index, i) => {
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

    // In multiplayer, send the new cards to the server
    if (isMultiplayer && newCards.length > 0) {
      sendAddCards(state);
    }
  };

  // Handle proceeding from shop - check for attribute unlocks before starting next round
  const handleProceedFromShop = () => {
    // In endless mode, skip attribute unlock screens (all 5 attributes already active)
    if (state.isEndlessMode) {
      startNextRound();
      return;
    }

    const nextRound = state.round + 1;
    const newActiveAttributes = getActiveAttributesForRound(nextRound, adventureDifficulty);
    const previousAttributes = state.activeAttributes;

    // Check if a new attribute is being unlocked
    const newAttribute = newActiveAttributes.find(attr => !previousAttributes.includes(attr));

    // If a new attribute is unlocking, show the unlock screen
    if (newAttribute) {
      setPendingUnlockedAttribute(newAttribute);
      // If this is the final round AND we're unlocking a new attribute, show final round warning
      setIsFinalRoundWarning(nextRound === 10);
      setGamePhase('attribute_unlock');
      return;
    }

    // No new attribute - skip the attribute unlock screen entirely
    // This applies to: Easy (never unlocks), Hard at round 10 (already at 5)

    // No unlock needed, proceed directly to next round
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

  // Start the next round
  const startNextRound = () => {
    const nextRound = state.round + 1;
    const roundReq = getRoundRequirement(nextRound);

    // Reset hint triggers to prevent auto-triggering on round start
    setHintTrigger(0);
    setClearHintTrigger(0);

    // Get active attributes for the new round
    // In endless mode, always use all 5 attributes
    const newActiveAttributes: AttributeName[] = state.isEndlessMode
      ? ['shape', 'color', 'number', 'shading', 'background']
      : getActiveAttributesForRound(nextRound, adventureDifficulty);
    const previousAttributes = state.activeAttributes;

    // Note: Attribute unlock is now handled via the AttributeUnlockScreen before this function is called

    // Calculate board size: max of player's fieldSize (with weapon bonuses) and minimum for attributes
    const totalStats = calculatePlayerTotalStats(state.player);
    const boardSize = Math.max(
      totalStats.fieldSize,
      getBoardSizeForAttributes(newActiveAttributes.length)
    );

    // Generate a new board with the new attributes
    const newBoard = generateGameBoard(
      boardSize,
      nextRound,
      nextRound,
      newActiveAttributes
    );

    // Reset round stats for the new round
    setRoundStats({
      moneyEarned: 0,
      experienceEarned: 0,
      hintsEarned: 0,
      healingDone: 0,
      bonusWeaponsEarned: 0,
      startLevel: state.player.stats.level,
    });

    // Reset enemy round stats for defeat condition tracking
    const playerTotalStats = calculatePlayerTotalStats(state.player);
    resetRoundStats(roundReq.targetScore, playerTotalStats.hints || 0, playerTotalStats.graces || 0);

    // Don't apply enemy effects yet - that happens when player selects enemy
    const finalBoard = newBoard;

    setState(prevState => {
      // Reset health to max at the start of each round
      const playerTotalStats = calculatePlayerTotalStats(prevState.player);
      return {
        ...prevState,
        round: nextRound,
        activeAttributes: newActiveAttributes,
        targetScore: roundReq.targetScore,
        remainingTime: roundReq.time,
        score: 0,
        board: finalBoard,
        selectedCards: [],
        foundCombinations: [],
        roundCompleted: false,
        gameStarted: false,  // Not started yet - waiting for enemy selection
        currentEnemies: getRandomEnemyOptions(getTierForRound(nextRound), 3, prevState.defeatedEnemies, prevState.awardedStretchGoalWeapons, calculatePlayerTotalStats(prevState.player), prevState.player.weapons),
        shopItems: generateRandomShopItems(),  // Refill shop for next round
        shopWeapons: generateShopWeapons(4, prevState.player.weapons, nextRound),   // Refill weapon shop with round-scaled rarity
        selectedEnemy: null,
        activeEnemyInstance: null,  // Set when player selects enemy
        selectedEnemyReward: null,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            health: playerTotalStats.maxHealth,  // Reset health to max
          },
        },
      };
    });

    // Apply startingTime bonus from weapons and excess health
    // Health > 3 = +3s per extra HP
    setState(prevState => {
      const totalStats = calculatePlayerTotalStats(prevState.player);
      const weaponTimeBonus = totalStats.startingTime || 0;
      const excessHealth = Math.max(0, totalStats.health - 3);
      const healthTimeBonus = excessHealth * 3; // +3 seconds per excess HP
      const timeBonus = weaponTimeBonus + healthTimeBonus;
      return {
        ...prevState,
        remainingTime: prevState.remainingTime + timeBonus
      };
    });

    // Apply Snowball effect: guarantee at least 1 grace at round start
    setState(prevState => {
      const hasSnowball = prevState.player.weapons.some(w => w.name === 'Snowball');
      if (hasSnowball && prevState.player.stats.graces < 1) {
        return {
          ...prevState,
          player: {
            ...prevState.player,
            stats: {
              ...prevState.player.stats,
              graces: 1
            }
          }
        };
      }
      return prevState;
    });

    // Go to enemy selection screen
    setGamePhase('enemy_select');
  };

  // Render the appropriate game phase
  const renderGamePhase = () => {
    switch (gamePhase) {
      case 'main_menu':
        return (
          <>
            <MainMenu
              onSelectAdventure={() => setGamePhase('character_select')}
              onSelectFreeplay={() => setGamePhase('difficulty_select')}
              onSelectTutorial={handleTutorialStart}
              onSelectOptions={() => setShowOptionsModal(true)}
            />
            <OptionsMenu
              visible={showOptionsModal}
              onClose={() => setShowOptionsModal(false)}
            />
          </>
        );

      case 'character_select':
        return (
          <CharacterSelection
            characters={CHARACTERS}
            selectedCharacter={selectedCharacter}
            onSelect={handleCharacterSelect}
            onStart={startAdventure}
            onExitGame={() => setGamePhase('main_menu')}
          />
        );

      case 'difficulty_select':
        return (
          <DifficultySelection
            onStart={startFreePlay}
            onExitGame={() => setGamePhase('main_menu')}
          />
        );

      case 'tutorial':
        return (
          <TutorialScreen
            onComplete={handleTutorialComplete}
            onExit={handleTutorialExit}
          />
        );

      case 'enemy_select':
        return (
          <EnemySelection
            enemies={state.currentEnemies}
            onSelect={handleEnemySelect}
            round={state.round}
            playerStats={calculatePlayerTotalStats(state.player)}
            playerWeapons={state.player.weapons}
            onExitGame={() => setGamePhase('main_menu')}
          />
        );

      case 'round_summary':
        // Build roundScores from ROUND_REQUIREMENTS and roundHistory
        const summaryRoundScores: RoundScore[] = ROUND_REQUIREMENTS.map(req => {
          const historyEntry = roundHistory.find(h => h.round === req.round);
          return {
            round: req.round,
            target: req.targetScore,
            actual: historyEntry?.actual,
          };
        });

        return (
          <RoundSummary
            round={state.round}
            matchCount={state.foundCombinations.length}
            score={state.score}
            targetScore={state.targetScore}
            moneyEarned={roundStats.moneyEarned}
            experienceEarned={roundStats.experienceEarned}
            bonusWeapons={roundStats.bonusWeaponsEarned}
            hintsEarned={roundStats.hintsEarned}
            healingDone={roundStats.healingDone}
            didLevelUp={state.player.stats.level > roundStats.startLevel}
            onContinue={() => {
              // Calculate all levels gained during round
              const startLevel = roundStats.startLevel;
              const endLevel = state.player.stats.level;
              const levelsGained = endLevel - startLevel;

              // Build queue of level-ups: [startLevel+1, startLevel+2, ...]
              const levelQueue = Array.from(
                { length: levelsGained },
                (_, i) => startLevel + i + 1
              );
              setPendingLevelUps(levelQueue);
              setGamePhase('level_up');
            }}
            playerStats={calculatePlayerTotalStats(state.player)}
            playerWeapons={state.player.weapons}
            onExitGame={() => setGamePhase('main_menu')}
            roundScores={summaryRoundScores}
            enemy={state.activeEnemyInstance ?? undefined}
            difficulty={adventureDifficulty}
            enemyDefeated={enemyDefeated}
            stretchGoalReward={state.selectedEnemyReward}
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
            playerStats={calculatePlayerTotalStats(state.player)}
            playerWeapons={state.player.weapons}
            onExitGame={() => setGamePhase('main_menu')}
            targetLevel={pendingLevelUps[0] || state.player.stats.level}
            hasMoreLevelUps={pendingLevelUps.length > 1}
            enemyDefeated={enemyDefeated}
            defeatedEnemyTier={defeatedEnemyTier}
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
            playerStats={calculatePlayerTotalStats(state.player)}
            playerWeapons={state.player.weapons}
            onExitGame={() => setGamePhase('main_menu')}
          />
        );

      case 'attribute_unlock':
        return (
          <AttributeUnlockScreen
            newAttribute={pendingUnlockedAttribute || 'shading'}
            onContinue={() => {
              setPendingUnlockedAttribute(null);
              setIsFinalRoundWarning(false);
              startNextRound();
            }}
            isFinalRound={isFinalRoundWarning}
            onExitGame={() => setGamePhase('main_menu')}
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
                totalTime={getRoundRequirement(state.round).time}
                playerStats={calculatePlayerTotalStats(state.player)}
                playerWeapons={state.player.weapons}
                onHintPress={() => setHintTrigger(t => t + 1)}
                onClearHint={() => setClearHintTrigger(t => t + 1)}
                hasActiveHint={hasActiveHint}
                onExitGame={() => setGamePhase('main_menu')}
                onEndRoundEarly={completeRound}
                canEndRoundEarly={state.score >= state.targetScore}
                devMode={devMode}
                devCallbacks={devCallbacks}
                onMenuOpenChange={setIsMenuOpen}
              />
            </View>

            {/* Game board area - 90% of screen */}
            <View nativeID="round-gameboard" className="h-[90%]">
              <GameBoard
                cards={state.board}
                onMatch={handleValidMatch}
                onMatchStart={handleMatchStart}
                onInvalidSelection={handleInvalidMatch}
                playerStats={applyEnemyStatModifiers(calculatePlayerTotalStats(state.player), state.activeEnemyInstance)}
                weapons={state.player.weapons}
                isPlayerTurn={true}
                activeAttributes={state.activeAttributes}
                onHintStateChange={setHasActiveHint}
                onUseHint={handleUseHint}
                triggerHint={hintTrigger > 0 ? hintTrigger : undefined}
                triggerClearHint={clearHintTrigger > 0 ? clearHintTrigger : undefined}
                onCardBurn={handleCardBurn}
                isPaused={isMenuOpen}
                lastMatchTime={lastMatchTime}
                autoPlayer={autoPlayerEnabled}
                enemy={state.activeEnemyInstance}
                roundStats={roundStatsRef}
              />
            </View>
          </View>
        );

      case 'free_play':
        return (
          <View nativeID="free-play-screen" style={freePlayStyles.container}>
            {/* Minimal header for free play */}
            <View style={freePlayStyles.header}>
              <View style={freePlayStyles.statsRow}>
                {/* Exit button */}
                <TouchableOpacity
                  style={freePlayStyles.exitButton}
                  onPress={() => setGamePhase('main_menu')}
                >
                  <Text style={freePlayStyles.exitButtonText}>Exit</Text>
                </TouchableOpacity>

                {/* Free Play label */}
                <View style={freePlayStyles.modeBadge}>
                  <Text style={freePlayStyles.modeBadgeText}>Free Play</Text>
                </View>

                {/* Health */}
                <View style={freePlayStyles.statItem}>
                  <Text style={freePlayStyles.heartIcon}>♥</Text>
                  <Text style={freePlayStyles.statValue}>
                    {calculatePlayerTotalStats(state.player).health}/{calculatePlayerTotalStats(state.player).maxHealth}
                  </Text>
                </View>

                {/* Level */}
                <View style={freePlayStyles.statItem}>
                  <Text style={freePlayStyles.levelText}>Lv{calculatePlayerTotalStats(state.player).level}</Text>
                </View>

                {/* Hints */}
                <TouchableOpacity
                  style={[
                    freePlayStyles.hintButton,
                    calculatePlayerTotalStats(state.player).hints > 0 ? freePlayStyles.hintButtonEnabled : freePlayStyles.hintButtonDisabled,
                    hasActiveHint && freePlayStyles.hintButtonActive,
                  ]}
                  onPress={hasActiveHint ? () => setClearHintTrigger(t => t + 1) : () => setHintTrigger(t => t + 1)}
                  disabled={calculatePlayerTotalStats(state.player).hints <= 0 && !hasActiveHint}
                >
                  <Text style={freePlayStyles.hintIcon}>?</Text>
                  <Text style={freePlayStyles.hintCount}>
                    {hasActiveHint ? 'x' : calculatePlayerTotalStats(state.player).hints}
                  </Text>
                </TouchableOpacity>

                {/* Matches counter */}
                <View style={freePlayStyles.statItem}>
                  <Text style={freePlayStyles.matchLabel}>Matches</Text>
                  <Text style={freePlayStyles.statValue}>{state.foundCombinations.length}</Text>
                </View>
              </View>
            </View>

            {/* Game board area - fills remaining space */}
            <View style={freePlayStyles.boardContainer}>
              <GameBoard
                cards={state.board}
                onMatch={handleValidMatch}
                onMatchStart={handleMatchStart}
                onInvalidSelection={handleInvalidMatch}
                playerStats={calculatePlayerTotalStats(state.player)}
                weapons={state.player.weapons}
                isPlayerTurn={true}
                activeAttributes={state.activeAttributes}
                onHintStateChange={setHasActiveHint}
                onUseHint={handleUseHint}
                triggerHint={hintTrigger > 0 ? hintTrigger : undefined}
                triggerClearHint={clearHintTrigger > 0 ? clearHintTrigger : undefined}
                onCardBurn={handleCardBurn}
                isPaused={isMenuOpen}
                lastMatchTime={lastMatchTime}
                autoPlayer={autoPlayerEnabled}
              />
            </View>
          </View>
        );

      case 'victory':
        // Build roundScores from ROUND_REQUIREMENTS and roundHistory
        const victoryRoundScores: RoundScore[] = ROUND_REQUIREMENTS.map(req => {
          const historyEntry = roundHistory.find(h => h.round === req.round);
          return {
            round: req.round,
            target: req.targetScore,
            actual: historyEntry?.actual,
          };
        });

        return (
          <VictoryScreen
            player={state.player}
            finalScore={state.score}
            matchCount={state.foundCombinations.length}
            playerStats={calculatePlayerTotalStats(state.player)}
            roundScores={victoryRoundScores}
            difficulty={adventureDifficulty}
            onReturnToMenu={() => {
              setState(prev => ({ ...prev, isEndlessMode: false }));
              setGamePhase('main_menu');
            }}
            onContinueEndless={handleContinueEndless}
          />
        );

      case 'game_over':
        // Build roundScores including the current failed round
        const gameOverRoundScores: RoundScore[] = ROUND_REQUIREMENTS.map(req => {
          // Check if this round was completed in history
          const historyEntry = roundHistory.find(h => h.round === req.round);
          // If this is the current (failed) round, include the score
          if (req.round === state.round) {
            return {
              round: req.round,
              target: req.targetScore,
              actual: state.score,
            };
          }
          return {
            round: req.round,
            target: req.targetScore,
            actual: historyEntry?.actual,
          };
        });

        return (
          <View style={gameOverStyles.container}>
            {/* Eyebrow Banner */}
            <View style={gameOverStyles.eyebrow}>
              <Text style={gameOverStyles.eyebrowText}>GAME OVER</Text>
            </View>

            <View style={gameOverStyles.content}>
              {/* Game over reason */}
              {gameOverReason && (
                <View style={gameOverStyles.reasonContainer}>
                  <Text style={gameOverStyles.reasonText}>{gameOverReason}</Text>
                </View>
              )}

              {/* Enemy that defeated the player */}
              {state.activeEnemyInstance && (
                <View style={gameOverStyles.enemyContainer}>
                  <Icon
                    name={state.activeEnemyInstance.icon}
                    size={32}
                    color={COLORS.impactRed}
                  />
                  <View style={gameOverStyles.enemyInfo}>
                    <Text style={gameOverStyles.enemyLabel}>DEFEATED BY</Text>
                    <Text style={gameOverStyles.enemyName}>{state.activeEnemyInstance.name}</Text>
                  </View>
                </View>
              )}

              {/* Stats Section */}
              <View style={gameOverStyles.statsContainer}>
                <View style={gameOverStyles.statRow}>
                  <Text style={gameOverStyles.statLabel}>ROUND REACHED</Text>
                  <Text style={gameOverStyles.statValue}>{state.round}</Text>
                </View>
                <View style={gameOverStyles.statRow}>
                  <Text style={gameOverStyles.statLabel}>FINAL SCORE</Text>
                  <Text style={gameOverStyles.statValue}>{state.score}</Text>
                </View>
                <View style={gameOverStyles.statRow}>
                  <Text style={gameOverStyles.statLabel}>TARGET SCORE</Text>
                  <Text style={gameOverStyles.statValue}>{state.targetScore}</Text>
                </View>

                {!gameOverReason && state.score >= state.targetScore ? (
                  <View style={[gameOverStyles.resultBadge, gameOverStyles.successBadge]}>
                    <Text style={[gameOverStyles.resultText, gameOverStyles.successText]}>
                      TARGET ACHIEVED!
                    </Text>
                  </View>
                ) : !gameOverReason ? (
                  <View style={[gameOverStyles.resultBadge, gameOverStyles.failBadge]}>
                    <Text style={[gameOverStyles.resultText, gameOverStyles.failText]}>
                      TARGET NOT REACHED
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Round Progress Chart */}
              <View style={gameOverStyles.chartContainer}>
                <Text style={gameOverStyles.chartTitle}>ROUND PROGRESS</Text>
                <RoundProgressChart
                  roundScores={gameOverRoundScores}
                  currentRound={state.round}
                  height={140}
                />
              </View>

              {/* Play Again Button */}
              <View style={gameOverStyles.buttonContainer}>
                <TouchableOpacity
                  style={gameOverStyles.playAgainButton}
                  onPress={() => {
                    setGameOverReason(null);
                    setState(prev => ({ ...prev, isEndlessMode: false }));
                    setGamePhase('main_menu');
                  }}
                >
                  <Text style={gameOverStyles.playAgainText}>PLAY AGAIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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

      {isMultiplayer && gamePhase === 'character_select' && roomId && (
        <MultiplayerLobby
          roomId={roomId}
          isHost={isHost}
          onStartGame={() => startMultiplayerGame(state)}
        />
      )}

      {/* {gamePhase === 'character_select' && (
        <MultiplayerToggle />
      )} */}

      {renderGamePhase()}

      {/* Particle effects layer - rendered last to appear on top */}
      <Particles />

      {/* Tutorial Prompt Modal */}
      <Modal
        visible={showTutorialPrompt}
        transparent={true}
        animationType="fade"
      >
        <View style={tutorialPromptStyles.overlay}>
          <View style={tutorialPromptStyles.container}>
            <View style={tutorialPromptStyles.header}>
              <Text style={tutorialPromptStyles.headerText}>New to NShapes?</Text>
            </View>
            <View style={tutorialPromptStyles.content}>
              <Text style={tutorialPromptStyles.messageText}>
                Would you like to play through a quick tutorial to learn how the game works?
              </Text>
            </View>
            <View style={tutorialPromptStyles.buttons}>
              <TouchableOpacity
                style={tutorialPromptStyles.tutorialButton}
                onPress={handleTutorialPromptYes}
              >
                <Text style={tutorialPromptStyles.tutorialButtonText}>Yes, show me!</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tutorialPromptStyles.skipButton}
                onPress={handleTutorialPromptSkip}
                testID="skip-tutorial-button"
              >
                <Text style={tutorialPromptStyles.skipButtonText}>Skip - Start Adventure</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Tutorial Prompt Modal styles
const tutorialPromptStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 350,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.logicTeal,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerText: {
    color: COLORS.canvasWhite,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  messageText: {
    color: COLORS.slateCharcoal,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  buttons: {
    padding: 16,
    gap: 12,
  },
  tutorialButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  tutorialButtonText: {
    color: COLORS.slateCharcoal,
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: COLORS.slateCharcoal,
    fontSize: 14,
    opacity: 0.7,
  },
});

// Game Over screen styles
const gameOverStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 48,
    backgroundColor: '#CC4444', // Muted red - less harsh, more encouraging
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 3,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  reasonContainer: {
    backgroundColor: '#FEF2F2', // Soft pink-white instead of deep onyx
    borderRadius: RADIUS.module,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CC4444', // Muted red
  },
  reasonText: {
    color: '#383838', // Slate charcoal instead of bright red
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  enemyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2', // Light red/pink
    borderRadius: RADIUS.module,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.impactRed,
    gap: 12,
  },
  enemyInfo: {
    flex: 1,
  },
  enemyLabel: {
    color: COLORS.impactRed,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  enemyName: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
  },
  statsContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  statLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 18,
    fontFamily: 'monospace',
  },
  resultBadge: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  successBadge: {
    backgroundColor: COLORS.logicTeal,
  },
  failBadge: {
    backgroundColor: '#CC4444', // Muted red - encouraging, not punishing
  },
  resultText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  successText: {
    color: COLORS.canvasWhite,
  },
  failText: {
    color: COLORS.canvasWhite,
  },
  scoreboardContainer: {
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  playAgainButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    shadowColor: COLORS.deepOnyx,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  playAgainText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
});

// Free Play mode styles
const freePlayStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  header: {
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  exitButton: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.deepOnyx,
  },
  exitButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  modeBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  modeBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  heartIcon: {
    color: COLORS.impactRed,
    fontSize: 12,
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  levelText: {
    color: COLORS.logicTeal,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  matchLabel: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    fontWeight: '600',
    marginRight: 2,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  hintButtonEnabled: {
    backgroundColor: COLORS.actionYellow,
  },
  hintButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
  },
  hintButtonActive: {
    backgroundColor: COLORS.impactOrange,
  },
  hintIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  hintCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: COLORS.slateCharcoal,
  },
  boardContainer: {
    flex: 1,
  },
});

export default Game;
