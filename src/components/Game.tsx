import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Card, CardReward, GameState, Enemy, Weapon, PlayerStats, AttributeName } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { createDeck, shuffleArray, isValidCombination, findAllCombinations, generateGameBoard, formatTime, sameCardAttributes } from '@/utils/gameUtils';
import {
  CHARACTERS,
  ENEMIES,
  ITEMS,
  WEAPONS,
  ROUND_REQUIREMENTS,
  initializePlayer,
  calculatePlayerTotalStats,
  DEFAULT_PLAYER_STATS,
  generateShopWeapons,
  getRandomShopWeapon
} from '@/utils/gameDefinitions';
import { getActiveAttributesForRound, getBoardSizeForAttributes, ATTRIBUTE_SCALING } from '@/utils/gameConfig';
import { getAdjacentIndices, getFireSpreadCards, WeaponEffectResult } from '@/utils/weaponEffects';
import { useGameTimer } from '@/hooks/useGameTimer';
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
import MainMenu from './MainMenu';
import DifficultySelection from './DifficultySelection';
import { useTutorial } from '@/context/TutorialContext';

const INITIAL_CARD_COUNT = 12;
const MAX_BOARD_SIZE = 21;
const BASE_REROLL_COST = 5;

// Get round requirement
const getRoundRequirement = (round: number) => {
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

interface GameProps {
  devMode?: boolean;
}

const Game: React.FC<GameProps> = ({ devMode = false }) => {
  // Character selection state
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(devMode ? 'Orange Tabby' : null);
  const [gameMode, setGameMode] = useState<GameMode>('adventure');
  const [freePlayDifficulty, setFreePlayDifficulty] = useState<FreePlayDifficulty>('medium');
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
    'victory' |
    'enemy_select' |
    'game_over' |
    'free_play'
  >(devMode ? 'round' : 'main_menu');

  // Track pending attribute unlock for next round
  const [pendingUnlockedAttribute, setPendingUnlockedAttribute] = useState<AttributeName | null>(null);
  const [isFinalRoundWarning, setIsFinalRoundWarning] = useState(false);

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
        lootCrates: 0,
        isCoOp: false,
        players: []
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
      lootCrates: 0,
      isCoOp: false,
      players: []
    };
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

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

  // Per-round stats tracking (for round summary screen)
  const [roundStats, setRoundStats] = useState({
    moneyEarned: 0,
    experienceEarned: 0,
    hintsEarned: 0,
    healingDone: 0,
    lootBoxesEarned: 0,
    startLevel: 0,
  });

  // Dev mode state
  const [devTimerEnabled, setDevTimerEnabled] = useState(!devMode); // Timer disabled by default in dev mode

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
    }

    setGamePhase('game_over');
  };

  // Complete the current round
  const completeRound = () => {
    // Check if this is the final round (Round 10) - if so, go to victory
    if (state.round >= 10) {
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
  const isTimerActive = gamePhase === 'round' &&
    state.gameStarted &&
    !state.gameEnded &&
    state.remainingTime > 0 &&
    (!devMode || devTimerEnabled) &&
    !isMenuOpen;

  useGameTimer(isTimerActive, () => {
    setState(prev => ({
      ...prev,
      remainingTime: Math.max(0, prev.remainingTime - 1),
    }));
  });

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

  // Initialize the game
  const initGame = useCallback((characterName: string, activeAttributes: AttributeName[]) => {
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

    setState({
      // Core game
      deck: remainingDeck,
      board: initialBoard,
      selectedCards: [],
      foundCombinations: [],
      score: 0,
      gameStarted: false,
      gameEnded: false,
      startTime: null,
      endTime: null,
      hintUsed: false,

      // Attribute scaling
      activeAttributes,

      // Roguelike properties
      round: 1,
      targetScore: roundReq.targetScore,
      remainingTime: roundReq.time, // startingTime bonus applied after player init
      roundCompleted: false,

      // Player (already initialized above for fieldSize calculation)
      player,

      // Shop and upgrades - to be filled during gameplay
      shopItems: generateRandomShopItems(),
      shopWeapons: generateShopWeapons(4),
      levelUpOptions: [],
      rerollCost: BASE_REROLL_COST,

      // Enemy - to be selected during gameplay
      currentEnemies: generateRandomEnemies(),
      selectedEnemy: null,

      // Loot and rewards
      lootCrates: 0,

      // Co-op
      isCoOp: isMultiplayer,
      players: []
    });

    setNotification(null);
  }, [isMultiplayer]);

  // Generate 3 random enemies to choose from
  const generateRandomEnemies = (): Enemy[] => {
    const availableEnemies = [...ENEMIES];
    const selectedEnemies: Enemy[] = [];

    for (let i = 0; i < 3; i++) {
      if (availableEnemies.length === 0) break;

      const randomIndex = Math.floor(Math.random() * availableEnemies.length);
      selectedEnemies.push(availableEnemies[randomIndex]);
      availableEnemies.splice(randomIndex, 1);
    }

    return selectedEnemies;
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
  const startAdventure = () => {
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
      setShowTutorialPrompt(true);
      return;
    }

    setGameMode('adventure');

    // Adventure mode - start with round 1 attributes
    const activeAttributes = getActiveAttributesForRound(1);

    // Initialize the game with the selected character and attributes
    initGame(selectedCharacter, activeAttributes);

    // Reset hint triggers to prevent auto-triggering on game start
    setHintTrigger(0);
    setClearHintTrigger(0);

    setState(prevState => ({
      ...prevState,
      gameStarted: true,
      startTime: Date.now()
    }));

    // Adventure mode - skip enemy selection, go directly to round
    // Reset round stats for the first round
    setRoundStats({
      moneyEarned: 0,
      experienceEarned: 0,
      hintsEarned: 0,
      healingDone: 0,
      lootBoxesEarned: 0,
      startLevel: 0,
    });

    // Apply startingTime bonus from weapons
    setState(prevState => {
      const totalStats = calculatePlayerTotalStats(prevState.player);
      const timeBonus = totalStats.startingTime || 0;
      return {
        ...prevState,
        remainingTime: prevState.remainingTime + timeBonus
      };
    });

    setGamePhase('round');
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
    initGame(characterToUse, activeAttributes);

    // Reset hint triggers to prevent auto-triggering on game start
    setHintTrigger(0);
    setClearHintTrigger(0);

    setState(prevState => ({
      ...prevState,
      gameStarted: true,
      startTime: Date.now()
    }));

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

    // Continue with adventure mode start
    setGameMode('adventure');
    const activeAttributes = getActiveAttributesForRound(1);

    initGame(selectedCharacter!, activeAttributes);
    setHintTrigger(0);
    setClearHintTrigger(0);

    setState(prevState => ({
      ...prevState,
      gameStarted: true,
      startTime: Date.now()
    }));

    setRoundStats({
      moneyEarned: 0,
      experienceEarned: 0,
      hintsEarned: 0,
      healingDone: 0,
      lootBoxesEarned: 0,
      startLevel: 0,
    });

    setState(prevState => {
      const totalStats = calculatePlayerTotalStats(prevState.player);
      const timeBonus = totalStats.startingTime || 0;
      return {
        ...prevState,
        remainingTime: prevState.remainingTime + timeBonus
      };
    });

    setGamePhase('round');
  };

  // Handle enemy selection
  const handleEnemySelect = (enemy: Enemy) => {
    // Reset round stats and record starting level for round summary
    setRoundStats({
      moneyEarned: 0,
      experienceEarned: 0,
      hintsEarned: 0,
      healingDone: 0,
      lootBoxesEarned: 0,
      startLevel: state.player.stats.level,
    });

    // Reset hint triggers to prevent auto-triggering on round start
    setHintTrigger(0);
    setClearHintTrigger(0);

    setState(prevState => ({
      ...prevState,
      selectedEnemy: enemy,
      gameStarted: true, // Ensure game is started
      startTime: Date.now() // Record start time
    }));

    // Apply enemy effect to the game state
    if (enemy.applyEffect) {
      setState(prevState => enemy.applyEffect(prevState));
    }

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
    setState(prevState => ({
      ...prevState,
      player: {
        ...prevState.player,
        stats: {
          ...prevState.player.stats,
          money: prevState.player.stats.money - weapon.price
        },
        weapons: [...prevState.player.weapons, weapon]
      },
      // Mark the slot as sold (null) instead of removing to preserve layout
      shopWeapons: prevState.shopWeapons.map((shopWeapon, index) =>
        index === weaponIndex ? null : shopWeapon
      )
    }));

    setNotification({
      message: `Purchased ${weapon.name}!`,
      type: 'success'
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
        shopWeapons: generateShopWeapons(4),
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
        shopWeapons: generateShopWeapons(4),
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

  // Handle level up selection - WEAPONS ONLY
  const handleLevelUpSelection = (optionIndex: number) => {
    const option = state.levelUpOptions[optionIndex];

    // All options are now weapons
    if (isWeapon(option)) {
      // Add the weapon to player's inventory (weapons stack)
      setState(prevState => ({
        ...prevState,
        player: {
          ...prevState.player,
          weapons: [...prevState.player.weapons, option]
        }
      }));

      setNotification({
        message: `Acquired ${option.name}!`,
        type: 'success'
      });
    }

    // Continue to shop
    setGamePhase('shop');
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

    // Calculate totals from rewards (includes explosion/laser rewards from GameBoard)
    let totalPoints = 0;
    let totalMoney = 0;
    let totalExperience = 0;
    let totalHealing = 0;
    let totalHints = 0;
    let lootCratesEarned = 0;
    let holoBonus = 0;
    let graceUsed = false;

    rewards.forEach(reward => {
      // Track if this is a grace match (first reward marked as grace)
      if (reward.effectType === 'grace') {
        graceUsed = true;
        // Still award full points for grace cards!
      }

      let points = reward.points || 0;
      let money = reward.money || 0;

      // Check if this card is holographic for 2x points (only for base match rewards, not effects)
      if (!reward.effectType || reward.effectType === 'grace') {
        const matchedCard = cards.find(c => c.id === reward.cardId);
        if (matchedCard?.isHolographic) {
          points *= 2;
          holoBonus += points / 2; // Track the bonus portion
        }
      }

      totalPoints += points;
      totalMoney += money;
      totalExperience += reward.experience || 0;
      totalHealing += reward.healing || 0;
      totalHints += reward.hint || 0;
      if (reward.lootBox) lootCratesEarned++;
    });

    // === WEAPON BONUS EFFECTS (from GameBoard's processWeaponEffects) ===
    const triggerNotifications: string[] = [];

    // Show grace used notification
    if (isGraceMatch) {
      triggerNotifications.push('Grace!');
    }

    // Show holographic bonus if any
    if (holoBonus > 0) {
      triggerNotifications.push(`Holo 2x! +${holoBonus}`);
    }

    // Apply weapon effect bonuses (healing, hints, time, graces, board growth, fire)
    if (weaponEffects) {
      totalHealing += weaponEffects.bonusHealing;
      totalHints += weaponEffects.bonusHints;

      // Set fire on cards
      if (weaponEffects.fireCards.length > 0) {
        igniteCards(weaponEffects.fireCards);
      }

      // Show notifications (filter out explosion/laser since those were shown visually)
      weaponEffects.notifications.forEach(n => {
        if (!n.includes('Explosion') && !n.includes('Laser')) {
          triggerNotifications.push(n);
        }
      });
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
      lootBoxesEarned: prev.lootBoxesEarned + lootCratesEarned,
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

      return {
        ...prevState,
        score: prevState.score + totalPoints,
        selectedCards: prevState.selectedCards.filter(c => !cards.some(mc => mc.id === c.id)),
        foundCombinations: [...prevState.foundCombinations, cards],
        lootCrates: prevState.lootCrates + lootCratesEarned,
        remainingTime: prevState.remainingTime + (weaponEffects?.bonusTime || 0),
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

    // Cards to replace are already passed from GameBoard (matched + exploded + laser)
    replaceMatchedCards(cards);

    // Handle board growth if triggered
    if (weaponEffects && weaponEffects.boardGrowth > 0) {
      growBoard(weaponEffects.boardGrowth);
    }
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
    setState(prevState => {
      const newHealth = prevState.player.stats.health - 1;

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

      return {
        ...prevState,
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
    onMakeCardsHolo: (count: number) => {
      setState(prevState => ({
        ...prevState,
        board: prevState.board.map((card, i) =>
          i < count ? { ...card, isHolographic: true } : card
        )
      }));
      setNotification({ message: `First ${count} cards holographic!`, type: 'success' });
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
      const activeAttributes = getActiveAttributesForRound(round);
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
    currentRound: state.round,
    currentAttributes: state.activeAttributes.length,
  } : undefined;

  // Replace matched cards
  const replaceMatchedCards = (matchedCards: Card[]) => {
    // Get new cards from the deck
    const newCards: Card[] = [];
    const remainingDeck = [...state.deck];

    // Check if we have enough cards in the deck
    if (remainingDeck.length < matchedCards.length) {
      // Refill the deck if necessary with active attributes
      const additionalCards = createDeck(state.activeAttributes);
      for (const card of additionalCards) {
        if (!remainingDeck.some(c => sameCardAttributes(c, card)) &&
            !state.board.some(c => sameCardAttributes(c, card))) {
          remainingDeck.push(card);
        }
      }
    }

    // Get the matched card indices from the board
    const matchedIndices = matchedCards.map(matchedCard =>
      state.board.findIndex(boardCard => boardCard.id === matchedCard.id)
    );

    // Generate replacement cards
    for (let i = 0; i < matchedCards.length; i++) {
      if (remainingDeck.length > 0) {
        // Get a random card from the deck
        const randomIndex = Math.floor(Math.random() * remainingDeck.length);
        const newCard = { ...remainingDeck[randomIndex], selected: false };

        // Apply modifiers based on difficulty and round
        const modifierChance = 0.05 * state.round + 0.02 * state.round;

        if (Math.random() < modifierChance * 0.7) {
          newCard.health = Math.min(Math.floor(Math.random() * 3) + 2, 5);
        }
        if (Math.random() < modifierChance * 0.3) {
          newCard.lootBox = true;
        }
        if (Math.random() < modifierChance * 0.5) {
          newCard.bonusMoney = Math.floor(Math.random() * 5) + 1;
        }
        if (Math.random() < modifierChance * 0.5) {
          newCard.bonusPoints = Math.floor(Math.random() * 3) + 1;
        }
        if (Math.random() < modifierChance * 0.25) {
          newCard.healing = true;
        }
        if (Math.random() < modifierChance * 0.3) {
          newCard.clover = true;
        }
        if (Math.random() < modifierChance * 0.4) {
          newCard.timedReward = true;
          newCard.timedRewardAmount = Math.floor(Math.random() * 5) + 3;
        }

        // Apply holographic effect based on player's holoChance stat
        const totalStats = calculatePlayerTotalStats(state.player);
        if (totalStats.holoChance > 0 && Math.random() * 100 < totalStats.holoChance) {
          newCard.isHolographic = true;
        }

        newCards.push(newCard);

        // Remove the card from the deck
        remainingDeck.splice(randomIndex, 1);
      }
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
    const nextRound = state.round + 1;
    const newActiveAttributes = getActiveAttributesForRound(nextRound);
    const previousAttributes = state.activeAttributes;

    // Check if a new attribute is being unlocked
    const newAttribute = newActiveAttributes.find(attr => !previousAttributes.includes(attr));

    // Check if this is the final round (round 10)
    if (nextRound === 10) {
      setIsFinalRoundWarning(true);
      setPendingUnlockedAttribute(null);
      setGamePhase('attribute_unlock');
      return;
    }

    // If a new attribute is unlocking, show the unlock screen
    if (newAttribute) {
      setPendingUnlockedAttribute(newAttribute);
      setIsFinalRoundWarning(false);
      setGamePhase('attribute_unlock');
      return;
    }

    // No unlock needed, proceed directly to next round
    startNextRound();
  };

  // Start the next round
  const startNextRound = () => {
    const nextRound = state.round + 1;
    const roundReq = getRoundRequirement(nextRound);

    // Reset hint triggers to prevent auto-triggering on round start
    setHintTrigger(0);
    setClearHintTrigger(0);

    // Get active attributes for the new round
    const newActiveAttributes = getActiveAttributesForRound(nextRound);
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
      lootBoxesEarned: 0,
      startLevel: state.player.stats.level,
    });

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
        board: newBoard,
        selectedCards: [],
        foundCombinations: [],
        roundCompleted: false,
        gameStarted: true,
        currentEnemies: generateRandomEnemies(),
        shopItems: generateRandomShopItems(),  // Refill shop for next round
        shopWeapons: generateShopWeapons(4),   // Refill weapon shop for next round
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            health: playerTotalStats.maxHealth,  // Reset health to max
          },
        },
      };
    });

    // Apply startingTime bonus from weapons
    setState(prevState => {
      const totalStats = calculatePlayerTotalStats(prevState.player);
      const timeBonus = totalStats.startingTime || 0;
      return {
        ...prevState,
        remainingTime: prevState.remainingTime + timeBonus
      };
    });

    // Skip enemy selection, go directly to round
    setGamePhase('round');
  };

  // Render the appropriate game phase
  const renderGamePhase = () => {
    switch (gamePhase) {
      case 'main_menu':
        return (
          <MainMenu
            onSelectAdventure={() => setGamePhase('character_select')}
            onSelectFreeplay={() => setGamePhase('difficulty_select')}
            onSelectTutorial={handleTutorialStart}
          />
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
        return (
          <RoundSummary
            round={state.round}
            matchCount={state.foundCombinations.length}
            score={state.score}
            targetScore={state.targetScore}
            moneyEarned={roundStats.moneyEarned}
            experienceEarned={roundStats.experienceEarned}
            lootBoxes={roundStats.lootBoxesEarned}
            hintsEarned={roundStats.hintsEarned}
            healingDone={roundStats.healingDone}
            didLevelUp={state.player.stats.level > roundStats.startLevel}
            onContinue={() => setGamePhase('level_up')}
            playerStats={calculatePlayerTotalStats(state.player)}
            playerWeapons={state.player.weapons}
            onExitGame={() => setGamePhase('main_menu')}
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
              />
            </View>
          </View>
        );

      case 'victory':
        return (
          <VictoryScreen
            player={state.player}
            finalScore={state.score}
            matchCount={state.foundCombinations.length}
            playerStats={calculatePlayerTotalStats(state.player)}
            onReturnToMenu={() => setGamePhase('main_menu')}
          />
        );

      case 'game_over':
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

              {/* Round Scoreboard */}
              <View style={gameOverStyles.scoreboardContainer}>
                <RoundScoreboard
                  currentRound={state.round}
                  currentScore={state.score}
                />
              </View>

              {/* Play Again Button */}
              <View style={gameOverStyles.buttonContainer}>
                <TouchableOpacity
                  style={gameOverStyles.playAgainButton}
                  onPress={() => {
                    setGameOverReason(null);
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
    backgroundColor: COLORS.impactRed,
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
    backgroundColor: COLORS.deepOnyx,
    borderRadius: RADIUS.module,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.impactRed,
  },
  reasonText: {
    color: COLORS.impactRed,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: COLORS.impactRed,
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
