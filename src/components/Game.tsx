import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card, CardReward, GameState, Enemy, Weapon, PlayerStats } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { createDeck, shuffleArray, isValidCombination, findAllCombinations, generateGameBoard, formatTime } from '@/utils/gameUtils';
import {
  CHARACTERS,
  ENEMIES,
  ITEMS,
  WEAPONS,
  ROUND_REQUIREMENTS,
  initializePlayer,
  calculatePlayerTotalStats,
  DEFAULT_PLAYER_STATS
} from '@/utils/gameDefinitions';
import GameBoard from './GameBoard';
import GameInfo from './GameInfo';
import Notification from './Notification';
import { useSocket } from '@/context/SocketContext';
import MultiplayerLobby from './MultiplayerLobby';
import MultiplayerToggle from './MultiplayerToggle';
import CharacterSelection from './CharacterSelection';
import ItemShop from './ItemShop';
import LevelUp from './LevelUp';
import EnemySelection from './EnemySelection';
import StatsButton from './StatsButton';
import RoundScoreboard from './RoundScoreboard';

const INITIAL_CARD_COUNT = 12;
const MAX_BOARD_SIZE = 21;
const BASE_REROLL_COST = 5;

// Get round requirement
const getRoundRequirement = (round: number) => {
  return ROUND_REQUIREMENTS.find(r => r.round === round) ||
         { round: 1, targetScore: 3, time: 30 };
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

const Game: React.FC = () => {
  // Character selection state
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<
    'character_select' |
    'round' |
    'loot' |
    'level_up' |
    'shop' |
    'enemy_select' |
    'game_over'
  >('character_select');

  const [state, setState] = useState<GameState>({
    // Core game
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

    // Roguelike properties
    round: 1,
    targetScore: getRoundRequirement(1).targetScore,
    remainingTime: getRoundRequirement(1).time,
    roundCompleted: false,

    // Player
    player: initializePlayer('player1', 'Player 1', 'Orange Tabby'),

    // Shop and upgrades
    shopItems: [],
    levelUpOptions: [],
    rerollCost: BASE_REROLL_COST,

    // Enemy
    currentEnemies: [],
    selectedEnemy: null,

    // Loot and rewards
    lootCrates: 0,

    // Co-op
    isCoOp: false,
    players: []
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  // UI state for header stats
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasActiveHint, setHasActiveHint] = useState(false);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [clearHintTrigger, setClearHintTrigger] = useState(0);

  // Game over reason
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);


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
    // Generate options first, then update state
    const options = generateLevelUpOptions();

    setState(prevState => ({
      ...prevState,
      roundCompleted: true,
      gameEnded: false,
      levelUpOptions: options
    }));

    // Move to level up phase
    setGamePhase('level_up');
  };

  // Timer effect - countdown when in round phase
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    if (gamePhase === 'round' && state.gameStarted && !state.gameEnded && state.remainingTime > 0) {
      // Start countdown timer
      timerInterval = setInterval(() => {
        setState(prevState => {
          const newRemainingTime = prevState.remainingTime - 1;

          // Check if time has run out
          if (newRemainingTime <= 0) {
            // Clear the interval
            if (timerInterval) {
              clearInterval(timerInterval);
            }

            // Just update state - round completion handled by separate effect
            return {
              ...prevState,
              remainingTime: 0
            };
          }

          // Normal time update
          return {
            ...prevState,
            remainingTime: newRemainingTime
          };
        });
      }, 1000);
    }

    // Cleanup timer on unmount or phase change
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [gamePhase, state.gameStarted, state.gameEnded]);

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
  const initGame = useCallback((characterName: string) => {
    // Generate initial board with modifiers based on difficulty
    const initialBoard = generateGameBoard(INITIAL_CARD_COUNT, 1, 1);
    const deck = shuffleArray(createDeck());
    const remainingDeck = deck.filter(card =>
      !initialBoard.some(boardCard => boardCard.id === card.id)
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

      // Roguelike properties
      round: 1,
      targetScore: roundReq.targetScore,
      remainingTime: roundReq.time,
      roundCompleted: false,

      // Player
      player: initializePlayer('player1', 'Player 1', characterName),

      // Shop and upgrades - to be filled during gameplay
      shopItems: generateRandomShopItems(),
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

  // Generate random level up options
  const generateLevelUpOptions = () => {
    const options: (Partial<PlayerStats> | Weapon)[] = [];
    const optionsSize = 4 + (state.player?.stats?.drawIncrease || 0);

    console.log('[LevelUp] Generating', optionsSize, 'options');

    // 70% chance to get stat upgrade, 30% chance to get weapon upgrade
    for (let i = 0; i < optionsSize; i++) {
      const roll = Math.random();

      if (roll < 0.7) {
        // Generate a random stat upgrade
        const statUpgrade: Partial<PlayerStats> = {};

        // Pick a random stat to upgrade
        const availableStats = [
          'damage', 'maxHealth', 'timeWarpPercent', 'fieldSize',
          'chanceOfFire', 'dodgePercent', 'criticalChance', 'luck'
        ];

        const statIndex = Math.floor(Math.random() * availableStats.length);
        const stat = availableStats[statIndex];

        // Set the upgrade amount based on the stat
        if (stat === 'damage' || stat === 'maxHealth') {
          statUpgrade[stat as keyof PlayerStats] = 1; // +1 flat increase
        } else if (stat === 'fieldSize') {
          statUpgrade[stat as keyof PlayerStats] = 2;
        } else {
          statUpgrade[stat as keyof PlayerStats] = 5; // +5% increase for percentage stats
        }

        options.push(statUpgrade);
      } else {
        // Generate a weapon upgrade or new weapon
        if (state.player.weapons.length < state.player.stats.maxWeapons) {
          // Player can have a new weapon
          const availableWeapons = WEAPONS.filter(weapon =>
            !state.player.weapons.some(w => w.name === weapon.name)
          );

          if (availableWeapons.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableWeapons.length);
            options.push(availableWeapons[randomIndex]);
          } else {
            // All weapons already owned, upgrade a random one instead
            const playerWeapons = state.player.weapons;
            const weaponToUpgrade = playerWeapons[Math.floor(Math.random() * playerWeapons.length)];

            if (weaponToUpgrade.level < 4) {
              const upgradedWeapon = {...weaponToUpgrade, level: weaponToUpgrade.level + 1};
              options.push(upgradedWeapon);
            } else {
              // If all weapons are max level, add a stat upgrade instead
              const statUpgrade: Partial<PlayerStats> = { damage: 1 };
              options.push(statUpgrade);
            }
          }
        } else {
          // Max weapons reached, can only upgrade
          const playerWeapons = state.player.weapons;
          const upgradableWeapons = playerWeapons.filter(w => w.level < 4);

          if (upgradableWeapons.length > 0) {
            const weaponToUpgrade = upgradableWeapons[Math.floor(Math.random() * upgradableWeapons.length)];
            const upgradedWeapon = {...weaponToUpgrade, level: weaponToUpgrade.level + 1};
            options.push(upgradedWeapon);
          } else {
            // If all weapons are max level, add a stat upgrade instead
            const statUpgrade: Partial<PlayerStats> = { damage: 1 };
            options.push(statUpgrade);
          }
        }
      }
    }

    return options;
  };

  // Start the game
  const startGame = () => {
    if (!selectedCharacter) {
      setNotification({
        message: 'Please select a character first',
        type: 'warning'
      });
      return;
    }

    // Initialize the game with the selected character
    initGame(selectedCharacter);

    setState(prevState => ({
      ...prevState,
      gameStarted: true,
      startTime: Date.now()
    }));

    // Start with enemy selection
    setGamePhase('enemy_select');
  };

  // Handle character selection
  const handleCharacterSelect = (characterName: string) => {
    setSelectedCharacter(characterName);
  };

  // Handle enemy selection
  const handleEnemySelect = (enemy: Enemy) => {
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

  // Handle item purchase
  const handleItemPurchase = (itemIndex: number) => {
    const item = state.shopItems[itemIndex];

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
      // Remove the item from the shop
      shopItems: prevState.shopItems.filter((_, index) => index !== itemIndex)
    }));

    setNotification({
      message: `Purchased ${item.name}!`,
      type: 'success'
    });
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

  // Handle level up selection
  const handleLevelUpSelection = (optionIndex: number) => {
    const option = state.levelUpOptions[optionIndex];

    // Check if the option is a weapon or a stat upgrade
    if (isWeapon(option)) {
      // It's a weapon
      const existingWeaponIndex = state.player.weapons.findIndex(w => w.name === option.name);

      if (existingWeaponIndex >= 0) {
        // Upgrading existing weapon
        const updatedWeapons = [...state.player.weapons];
        updatedWeapons[existingWeaponIndex] = option;

        setState(prevState => ({
          ...prevState,
          player: {
            ...prevState.player,
            weapons: updatedWeapons
          }
        }));
      } else {
        // Adding new weapon
        setState(prevState => ({
          ...prevState,
          player: {
            ...prevState.player,
            weapons: [...prevState.player.weapons, option]
          }
        }));
      }
    } else {
      // It's a stat upgrade
      setState(prevState => ({
        ...prevState,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            ...option
          }
        }
      }));
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
      selectMultiplayerCard(card.id);
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
      if (isValidCombination(newSelectedCards)) {
        // Valid set found!
        handleValidMatch(newSelectedCards);
      } else {
        // Invalid selection
        handleInvalidMatch();
      }
    } else {
      // Update selected cards
      setState(prevState => ({
        ...prevState,
        selectedCards: newSelectedCards
      }));
    }
  };

  // Handle valid match - receives cards and rewards from GameBoard after reveal
  const handleValidMatch = (cards: Card[], rewards: CardReward[]) => {
    // In multiplayer, send the match to the server
    if (isMultiplayer) {
      sendCombinationFound(cards.map(c => c.id));
      return;
    }

    // Calculate totals from rewards
    let totalPoints = 0;
    let totalMoney = 0;
    let totalExperience = 0;
    let totalHealing = 0;
    let totalHints = 0;
    let lootCratesEarned = 0;

    rewards.forEach(reward => {
      totalPoints += reward.points || 0;
      totalMoney += reward.money || 0;
      totalExperience += reward.experience || 0;
      totalHealing += reward.healing || 0;
      totalHints += reward.hint || 0;
      if (reward.lootBox) lootCratesEarned++;
    });

    // Update game state with rewards
    setState(prevState => {
      // Calculate experience with bonus percentage
      const experienceMultiplier = 1 + (prevState.player.stats.experienceGainPercent || 0) / 100;
      const adjustedExperience = Math.floor(totalExperience * experienceMultiplier);

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

      // Show notification only for level up
      if (hasLeveledUp) {
        setNotification({
          message: `LEVEL UP! Now Lv${newLevel}`,
          type: 'success'
        });
      }

      return {
        ...prevState,
        score: prevState.score + totalPoints,
        selectedCards: [],
        foundCombinations: [...prevState.foundCombinations, cards],
        lootCrates: prevState.lootCrates + lootCratesEarned,
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            experience: newExperience,
            level: newLevel,
            money: prevState.player.stats.money + totalMoney,
            health: newHealth,
            hints: prevState.player.stats.hints + totalHints
          }
        }
      };
    });

    // Replace matched cards with new ones
    replaceMatchedCards(cards);
  };

  // Handle invalid match
  const handleInvalidMatch = () => {
    // Decrease health
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
        selectedCards: [],
        player: {
          ...prevState.player,
          stats: {
            ...prevState.player.stats,
            health: Math.max(0, newHealth)
          }
        }
      };
    });
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

  // Replace matched cards
  const replaceMatchedCards = (matchedCards: Card[]) => {
    // Get new cards from the deck
    const newCards: Card[] = [];
    const remainingDeck = [...state.deck];

    // Check if we have enough cards in the deck
    if (remainingDeck.length < matchedCards.length) {
      // Refill the deck if necessary
      const additionalCards = createDeck();
      for (const card of additionalCards) {
        if (!remainingDeck.some(c => c.id === card.id) &&
            !state.board.some(c => c.id === card.id)) {
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
        const newCard = remainingDeck[randomIndex];

        // Add modifiers based on round and difficulty
        const modifiers = generateGameBoard(1, state.round, state.round)[0];

        // Create the new card with modifiers
        newCards.push({
          ...newCard,
          ...modifiers,
          selected: false
        });

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
      sendAddCards(newCards.map(c => c.id));
    }
  };

  // Start the next round
  const startNextRound = () => {
    const nextRound = state.round + 1;
    const roundReq = getRoundRequirement(nextRound);

    // Generate a new board with increased difficulty
    const newBoard = generateGameBoard(
      state.player.stats.fieldSize,
      nextRound,
      nextRound
    );

    setState(prevState => ({
      ...prevState,
      round: nextRound,
      targetScore: roundReq.targetScore,
      remainingTime: roundReq.time,
      score: 0,
      board: newBoard,
      selectedCards: [],
      foundCombinations: [],
      roundCompleted: false,
      gameStarted: true,
      currentEnemies: generateRandomEnemies()
    }));

    // Move to enemy selection for the next round
    setGamePhase('enemy_select');
  };

  // Render the appropriate game phase
  const renderGamePhase = () => {
    switch (gamePhase) {
      case 'character_select':
        return (
          <CharacterSelection
            characters={CHARACTERS}
            selectedCharacter={selectedCharacter}
            onSelect={handleCharacterSelect}
            onStart={startGame}
          />
        );

      case 'enemy_select':
        return (
          <EnemySelection
            enemies={state.currentEnemies}
            onSelect={handleEnemySelect}
            round={state.round}
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
          />
        );

      case 'shop':
        return (
          <ItemShop
            items={state.shopItems}
            playerMoney={state.player.stats.money}
            onPurchase={handleItemPurchase}
            onReroll={handleShopReroll}
            rerollCost={state.rerollCost}
            freeRerolls={state.player.stats.freeRerolls}
            onContinue={startNextRound}
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
                selectedCount={selectedCount}
                onHintPress={() => setHintTrigger(t => t + 1)}
                onClearHint={() => setClearHintTrigger(t => t + 1)}
                hasActiveHint={hasActiveHint}
              />
            </View>

            {/* Game board area - 90% of screen */}
            <View nativeID="round-gameboard" className="h-[90%]">
              <GameBoard
                cards={state.board}
                onMatch={handleValidMatch}
                onInvalidSelection={handleInvalidMatch}
                playerStats={calculatePlayerTotalStats(state.player)}
                isPlayerTurn={true}
                onSelectedCountChange={setSelectedCount}
                onHintStateChange={setHasActiveHint}
                onUseHint={handleUseHint}
                triggerHint={hintTrigger > 0 ? hintTrigger : undefined}
                triggerClearHint={clearHintTrigger > 0 ? clearHintTrigger : undefined}
              />
            </View>
          </View>
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
                    setGamePhase('character_select');
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
      {/* StatsButton - Show during gameplay phases */}
      {gamePhase !== 'character_select' && gamePhase !== 'game_over' && state && state.player && (
        <StatsButton playerStats={calculatePlayerTotalStats(state.player)} />
      )}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {isMultiplayer && gamePhase === 'character_select' && (
        <MultiplayerLobby
          roomId={roomId}
          isHost={isHost}
          onStartGame={startMultiplayerGame}
        />
      )}

      {/* {gamePhase === 'character_select' && (
        <MultiplayerToggle />
      )} */}

      {renderGamePhase()}
    </View>
  );
};

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

export default Game;
