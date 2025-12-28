import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Card, GameState, Enemy, Weapon, PlayerStats } from '../types';
import { createDeck, shuffleArray, isValidCombination, generateGameBoard, formatTime } from '../utils/gameUtils';
import {
  CHARACTERS,
  ENEMIES,
  ITEMS,
  WEAPONS,
  ROUND_REQUIREMENTS,
  initializePlayer,
  calculatePlayerTotalStats,
  DEFAULT_PLAYER_STATS
} from '../utils/gameDefinitions';
import GameBoard from './GameBoard';
import GameInfo from './GameInfo';
import Notification from './Notification';
import { useSocket } from '../context/SocketContext';
import MultiplayerLobby from './MultiplayerLobby';
import MultiplayerToggle from './MultiplayerToggle';
import CharacterSelection from './CharacterSelection';
import ItemShop from './ItemShop';
import LevelUp from './LevelUp';
import EnemySelection from './EnemySelection';
import StatsButton from './StatsButton';
import RoundScoreboard from './RoundScoreboard';

const INITIAL_CARD_COUNT = 12;
const BASE_REROLL_COST = 5;

const getRoundRequirement = (round: number) => {
  return ROUND_REQUIREMENTS.find(r => r.round === round) ||
         { round: 1, targetScore: 3, time: 30 };
};

const isWeapon = (option: Partial<PlayerStats> | Weapon): option is Weapon => {
  return 'name' in option && 'level' in option;
};

const calculateLevel = (experience: number): number => {
  return Math.floor(Math.sqrt(experience / 10));
};

const Game: React.FC = () => {
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
    round: 1,
    targetScore: getRoundRequirement(1).targetScore,
    remainingTime: getRoundRequirement(1).time,
    roundCompleted: false,
    player: initializePlayer('player1', 'Player 1', 'Orange Tabby'),
    shopItems: [],
    levelUpOptions: [],
    rerollCost: BASE_REROLL_COST,
    currentEnemies: [],
    selectedEnemy: null,
    lootCrates: 0,
    isCoOp: false,
    players: []
  });

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const {
    isMultiplayer,
    roomId,
    isHost,
    startGame: startMultiplayerGame,
    selectCard: selectMultiplayerCard,
    combinationFound: sendCombinationFound,
    addCards: sendAddCards,
  } = useSocket();

  const endGame = useCallback((victory: boolean) => {
    setState(prevState => ({
      ...prevState,
      gameEnded: true,
      endTime: Date.now()
    }));

    if (victory) {
      setNotification({
        message: 'Congratulations! You completed all rounds!',
        type: 'success'
      });
    } else {
      setNotification({
        message: 'Game Over! You ran out of time.',
        type: 'error'
      });
    }

    setGamePhase('game_over');
  }, []);

  const generateLevelUpOptions = useCallback(() => {
    const options: (Partial<PlayerStats> | Weapon)[] = [];
    const optionsSize = 4 + (state.player.stats.drawIncrease || 0);

    for (let i = 0; i < optionsSize; i++) {
      const roll = Math.random();

      if (roll < 0.7) {
        const statUpgrade: Partial<PlayerStats> = {};
        const availableStats = [
          'damage', 'maxHealth', 'timeWarpPercent', 'fieldSize',
          'chanceOfFire', 'dodgePercent', 'criticalChance', 'luck'
        ];
        const statIndex = Math.floor(Math.random() * availableStats.length);
        const stat = availableStats[statIndex];

        if (stat === 'damage' || stat === 'maxHealth') {
          (statUpgrade as any)[stat] = 1;
        } else if (stat === 'fieldSize') {
          (statUpgrade as any)[stat] = 2;
        } else {
          (statUpgrade as any)[stat] = 5;
        }

        options.push(statUpgrade);
      } else {
        if (state.player.weapons.length < state.player.stats.maxWeapons) {
          const availableWeapons = WEAPONS.filter(weapon =>
            !state.player.weapons.some(w => w.name === weapon.name)
          );

          if (availableWeapons.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableWeapons.length);
            options.push(availableWeapons[randomIndex]);
          } else {
            const statUpgrade: Partial<PlayerStats> = { damage: 1 };
            options.push(statUpgrade);
          }
        } else {
          const statUpgrade: Partial<PlayerStats> = { damage: 1 };
          options.push(statUpgrade);
        }
      }
    }

    return options;
  }, [state.player.stats.drawIncrease, state.player.stats.maxWeapons, state.player.weapons]);

  const completeRound = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      roundCompleted: true,
      gameEnded: false
    }));

    setGamePhase('level_up');

    setState(prevState => ({
      ...prevState,
      levelUpOptions: generateLevelUpOptions()
    }));
  }, [generateLevelUpOptions]);

  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;

    if (gamePhase === 'round' && state.gameStarted && !state.gameEnded && state.remainingTime > 0) {
      timerInterval = setInterval(() => {
        setState(prevState => {
          const newRemainingTime = prevState.remainingTime - 1;

          if (newRemainingTime <= 0) {
            if (prevState.score >= prevState.targetScore) {
              completeRound();
            } else {
              endGame(false);
            }

            if (timerInterval) {
              clearInterval(timerInterval);
            }

            return {
              ...prevState,
              remainingTime: 0,
              gameEnded: true
            };
          }

          return {
            ...prevState,
            remainingTime: newRemainingTime
          };
        });
      }, 1000);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [gamePhase, state.gameStarted, state.gameEnded, completeRound, endGame, state.remainingTime]);

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

  const generateRandomShopItems = useCallback(() => {
    const shopSize = 4 + (state?.player?.stats?.drawIncrease || 0);
    const availableItems = [...ITEMS];
    const selectedItems = [];

    const playerItems = state?.player?.items || [];
    const playerItemNames = playerItems.map(item => item.name);

    const filteredItems = availableItems.filter(item => {
      if (item.limit === null) return true;
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
  }, [state?.player?.items, state?.player?.stats?.drawIncrease]);

  const initGame = useCallback((characterName: string) => {
    const initialBoard = generateGameBoard(INITIAL_CARD_COUNT, 1, 1);
    const deck = shuffleArray(createDeck());
    const remainingDeck = deck.filter(card =>
      !initialBoard.some(boardCard => boardCard.id === card.id)
    );

    const roundReq = getRoundRequirement(1);

    setState({
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
      round: 1,
      targetScore: roundReq.targetScore,
      remainingTime: roundReq.time,
      roundCompleted: false,
      player: initializePlayer('player1', 'Player 1', characterName),
      shopItems: generateRandomShopItems(),
      levelUpOptions: [],
      rerollCost: BASE_REROLL_COST,
      currentEnemies: generateRandomEnemies(),
      selectedEnemy: null,
      lootCrates: 0,
      isCoOp: isMultiplayer,
      players: []
    });

    setNotification(null);
  }, [isMultiplayer, generateRandomShopItems]);

  const startGame = () => {
    if (!selectedCharacter) {
      setNotification({
        message: 'Please select a character first',
        type: 'warning'
      });
      return;
    }

    initGame(selectedCharacter);

    setState(prevState => ({
      ...prevState,
      gameStarted: true,
      startTime: Date.now()
    }));

    setGamePhase('enemy_select');
  };

  const handleCharacterSelect = (characterName: string) => {
    setSelectedCharacter(characterName);
  };

  const handleEnemySelect = (enemy: Enemy) => {
    setState(prevState => ({
      ...prevState,
      selectedEnemy: enemy,
      gameStarted: true,
      startTime: Date.now()
    }));

    if (enemy.applyEffect) {
      setState(prevState => enemy.applyEffect(prevState));
    }

    setGamePhase('round');
  };

  const handleItemPurchase = (itemIndex: number) => {
    const item = state.shopItems[itemIndex];

    if (state.player.stats.money < item.price) {
      setNotification({
        message: 'Not enough money to purchase this item',
        type: 'error'
      });
      return;
    }

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
      shopItems: prevState.shopItems.filter((_, index) => index !== itemIndex)
    }));

    setNotification({
      message: `Purchased ${item.name}!`,
      type: 'success'
    });
  };

  const handleShopReroll = () => {
    if (state.player.stats.money < state.rerollCost && state.player.stats.freeRerolls <= 0) {
      setNotification({
        message: 'Not enough money to reroll the shop',
        type: 'error'
      });
      return;
    }

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
        rerollCost: prevState.rerollCost + 2
      }));
    }
  };

  const handleLevelUpSelection = (optionIndex: number) => {
    const option = state.levelUpOptions[optionIndex];

    if (isWeapon(option)) {
      const existingWeaponIndex = state.player.weapons.findIndex(w => w.name === option.name);

      if (existingWeaponIndex >= 0) {
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
        setState(prevState => ({
          ...prevState,
          player: {
            ...prevState.player,
            weapons: [...prevState.player.weapons, option]
          }
        }));
      }
    } else {
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

    setGamePhase('shop');
  };

  const handleLevelUpReroll = () => {
    if (state.player.stats.money < state.rerollCost && state.player.stats.freeRerolls <= 0) {
      setNotification({
        message: 'Not enough money to reroll the level up options',
        type: 'error'
      });
      return;
    }

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
        rerollCost: prevState.rerollCost + 2
      }));
    }
  };

  const handleValidMatch = (cards: Card[]) => {
    if (isMultiplayer) {
      sendCombinationFound(cards.map(c => c.id) as any);
      return;
    }

    let pointsEarned = cards.length;
    const experienceEarned = 1;
    let moneyEarned = cards.length;

    cards.forEach(card => {
      if (card.bonusPoints) {
        pointsEarned += card.bonusPoints;
      }
      if (card.lootBox) {
        setState(prevState => ({
          ...prevState,
          lootCrates: prevState.lootCrates + 1
        }));
      }
      if (card.bonusMoney) {
        moneyEarned += card.bonusMoney;
      }
      if (card.healing) {
        setState(prevState => ({
          ...prevState,
          player: {
            ...prevState.player,
            stats: {
              ...prevState.player.stats,
              health: Math.min(
                prevState.player.stats.health + 1,
                prevState.player.stats.maxHealth
              )
            }
          }
        }));
      }
    });

    setState(prevState => {
      const experienceMultiplier = 1 + (prevState.player.stats.experienceGainPercent || 0) / 100;
      const totalExperienceGained = Math.floor(experienceEarned * experienceMultiplier);

      const currentExperience = prevState.player.stats.experience || 0;
      const newExperience = currentExperience + totalExperienceGained;
      const currentLevel = prevState.player.stats.level || 0;
      const newLevel = calculateLevel(newExperience);

      const hasLeveledUp = newLevel > currentLevel;

      const updatedStats = {
        ...prevState.player.stats,
        experience: newExperience,
        level: newLevel,
        money: prevState.player.stats.money + moneyEarned
      };

      if (hasLeveledUp) {
        setNotification({
          message: `Match! +${pointsEarned} pts, +${totalExperienceGained} XP. LEVEL UP!`,
          type: 'success'
        });
      } else {
        setNotification({
          message: `Match! +${pointsEarned} pts, +${totalExperienceGained} XP, +$${moneyEarned}`,
          type: 'success'
        });
      }

      return {
        ...prevState,
        score: prevState.score + pointsEarned,
        selectedCards: [],
        foundCombinations: [...prevState.foundCombinations, cards],
        player: {
          ...prevState.player,
          stats: updatedStats
        }
      };
    });

    replaceMatchedCards(cards);
  };

  const handleInvalidMatch = () => {
    setNotification({
      message: 'Not a valid match!',
      type: 'error'
    });

    setTimeout(() => {
      setState(prevState => ({
        ...prevState,
        selectedCards: []
      }));
    }, 1000);
  };

  const replaceMatchedCards = (matchedCards: Card[]) => {
    const newCards: Card[] = [];
    const remainingDeck = [...state.deck];

    if (remainingDeck.length < matchedCards.length) {
      const additionalCards = createDeck();
      for (const card of additionalCards) {
        if (!remainingDeck.some(c => c.id === card.id) &&
            !state.board.some(c => c.id === card.id)) {
          remainingDeck.push(card);
        }
      }
    }

    const matchedIndices = matchedCards.map(matchedCard =>
      state.board.findIndex(boardCard => boardCard.id === matchedCard.id)
    );

    for (let i = 0; i < matchedCards.length; i++) {
      if (remainingDeck.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingDeck.length);
        const newCard = remainingDeck[randomIndex];

        const modifiers = generateGameBoard(1, state.round, state.round)[0];

        newCards.push({
          ...newCard,
          ...modifiers,
          selected: false
        });

        remainingDeck.splice(randomIndex, 1);
      }
    }

    setState(prevState => {
      const updatedBoard = [...prevState.board];

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

    if (isMultiplayer && newCards.length > 0) {
      sendAddCards(newCards.map(c => c.id) as any);
    }
  };

  const startNextRound = () => {
    const nextRound = state.round + 1;
    const roundReq = getRoundRequirement(nextRound);

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

    setGamePhase('enemy_select');
  };

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
          <View className="flex-1">
            <GameInfo
              round={state.round}
              score={state.score}
              targetScore={state.targetScore}
              time={state.remainingTime}
              playerStats={calculatePlayerTotalStats(state.player)}
            />

            <RoundScoreboard
              currentRound={state.round}
              currentScore={state.score}
            />

            <GameBoard
              cards={state.board}
              onMatch={handleValidMatch}
              onInvalidSelection={handleInvalidMatch}
              playerStats={calculatePlayerTotalStats(state.player)}
              isPlayerTurn={true}
            />
          </View>
        );

      case 'game_over':
        return (
          <View className="flex-1 justify-center p-6 bg-gray-100 rounded-lg">
            <Text className="text-2xl font-bold mb-4 text-center text-gray-900">Game Over</Text>

            <View className="mb-4 items-center">
              <Text className="text-lg text-gray-700">You reached round {state.round}</Text>
              <Text className="text-lg font-medium text-gray-900">Final Score: {state.score}</Text>
              <Text className="text-lg text-gray-700">Target Score: {state.targetScore}</Text>

              {state.score >= state.targetScore ? (
                <Text className="mt-2 text-green-600 font-bold">You beat the target score!</Text>
              ) : (
                <Text className="mt-2 text-red-600 font-bold">You did not reach the target score</Text>
              )}
            </View>

            <RoundScoreboard
              currentRound={state.round}
              currentScore={state.score}
            />

            <View className="items-center mt-4">
              <Pressable
                className="px-6 py-3 bg-blue-500 rounded-lg"
                onPress={() => setGamePhase('character_select')}
              >
                <Text className="text-white font-bold">Play Again</Text>
              </Pressable>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View className="flex-1">
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

      {gamePhase === 'character_select' && (
        <MultiplayerToggle />
      )}

      {renderGamePhase()}
    </View>
  );
};

export default Game;
