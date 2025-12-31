import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, CardReward, GameState, PlayerStats, AttributeName, Weapon } from '@/types';
import { createDeck, shuffleArray, generateGameBoard, formatTime } from '@/utils/gameUtils';
import {
  ROUND_REQUIREMENTS,
  initializePlayer,
  calculatePlayerTotalStats,
  SHOP_WEAPONS,
  getRandomShopWeapon,
} from '@/utils/gameDefinitions';
import { getActiveAttributesForRound } from '@/utils/gameConfig';
import GameBoard from '@/components/GameBoard';

const INITIAL_CARD_COUNT = 12;

const getRoundRequirement = (round: number) => {
  return ROUND_REQUIREMENTS.find(r => r.round === round) ||
         { round: 1, targetScore: 3, time: 60 };
};

// Weapon categories for testing
const WEAPON_CATEGORIES = {
  'Explosive': SHOP_WEAPONS.filter(w => w.specialEffect === 'explosive'),
  'Auto-Hint': SHOP_WEAPONS.filter(w => w.specialEffect === 'autoHint'),
  'Board Growth': SHOP_WEAPONS.filter(w => w.specialEffect === 'boardGrowth'),
  'Fire': SHOP_WEAPONS.filter(w => w.specialEffect === 'fire'),
  'Mulligan': SHOP_WEAPONS.filter(w => w.specialEffect === 'mulliganGain'),
  'Healing': SHOP_WEAPONS.filter(w => w.specialEffect === 'healing'),
  'Hint Gain': SHOP_WEAPONS.filter(w => w.specialEffect === 'hintGain'),
  'Holographic': SHOP_WEAPONS.filter(w => w.specialEffect === 'holographic'),
  'Time Gain': SHOP_WEAPONS.filter(w => w.specialEffect === 'timeGain'),
  'Laser': SHOP_WEAPONS.filter(w => w.specialEffect === 'laser'),
};

export default function DevTest() {
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [notification, setNotification] = useState<string | null>(null);
  const [showWeaponPanel, setShowWeaponPanel] = useState(false);

  // UI state for header stats
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasActiveHint, setHasActiveHint] = useState(false);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [clearHintTrigger, setClearHintTrigger] = useState(0);

  const [state, setState] = useState<GameState>(() => {
    const roundReq = getRoundRequirement(1);
    const activeAttributes = getActiveAttributesForRound(1);
    const initialBoard = generateGameBoard(INITIAL_CARD_COUNT, 1, 1, activeAttributes);
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
      targetScore: roundReq.targetScore,
      remainingTime: roundReq.time,
      roundCompleted: false,
      player: initializePlayer('dev', 'Dev Player', 'Orange Tabby'),
      shopItems: [],
      shopWeapons: [],
      levelUpOptions: [],
      rerollCost: 5,
      currentEnemies: [],
      selectedEnemy: null,
      lootCrates: 0,
      isCoOp: false,
      players: []
    };
  });

  // Timer effect (only runs if timer is enabled)
  useEffect(() => {
    if (!timerEnabled || state.remainingTime <= 0) return;

    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        remainingTime: Math.max(0, prev.remainingTime - 1)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEnabled, state.remainingTime]);

  const resetBoard = useCallback(() => {
    const roundReq = getRoundRequirement(currentRound);
    const activeAttributes = getActiveAttributesForRound(currentRound);
    const newBoard = generateGameBoard(INITIAL_CARD_COUNT, currentRound, currentRound, activeAttributes);
    const deck = shuffleArray(createDeck(activeAttributes));
    const remainingDeck = deck.filter(card =>
      !newBoard.some(boardCard => boardCard.id === card.id)
    );

    setState(prev => ({
      ...prev,
      deck: remainingDeck,
      board: newBoard,
      selectedCards: [],
      foundCombinations: [],
      score: 0,
      remainingTime: roundReq.time,
      round: currentRound,
      targetScore: roundReq.targetScore,
      activeAttributes,
      gameEnded: false,
    }));

    setNotification('Board reset!');
    setTimeout(() => setNotification(null), 1500);
  }, [currentRound]);

  const changeRound = (round: number) => {
    setCurrentRound(round);
    const roundReq = getRoundRequirement(round);
    const activeAttributes = getActiveAttributesForRound(round);
    const newBoard = generateGameBoard(INITIAL_CARD_COUNT, round, round, activeAttributes);
    const deck = shuffleArray(createDeck(activeAttributes));
    const remainingDeck = deck.filter(card =>
      !newBoard.some(boardCard => boardCard.id === card.id)
    );

    setState(prev => ({
      ...prev,
      deck: remainingDeck,
      board: newBoard,
      selectedCards: [],
      foundCombinations: [],
      score: 0,
      remainingTime: roundReq.time,
      round: round,
      targetScore: roundReq.targetScore,
      activeAttributes,
      gameEnded: false,
    }));
  };

  const addMoreCards = () => {
    if (state.deck.length < 3) {
      setNotification('Not enough cards in deck!');
      setTimeout(() => setNotification(null), 1500);
      return;
    }

    const newCards = state.deck.slice(0, 3).map(card => ({
      ...card,
      selected: false
    }));

    setState(prev => ({
      ...prev,
      board: [...prev.board, ...newCards],
      deck: prev.deck.slice(3)
    }));

    setNotification('+3 cards added');
    setTimeout(() => setNotification(null), 1500);
  };

  // Add weapon to player
  const addWeapon = (weapon: Weapon) => {
    setState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        weapons: [...prev.player.weapons, weapon]
      }
    }));
    setNotification(`Added: ${weapon.name} (${weapon.rarity})`);
    setTimeout(() => setNotification(null), 1500);
  };

  // Add random weapon from a category
  const addRandomFromCategory = (category: string) => {
    const weapons = WEAPON_CATEGORIES[category as keyof typeof WEAPON_CATEGORIES];
    if (weapons && weapons.length > 0) {
      const weapon = weapons[Math.floor(Math.random() * weapons.length)];
      addWeapon(weapon);
    }
  };

  // Add legendary weapon from a category
  const addLegendaryFromCategory = (category: string) => {
    const weapons = WEAPON_CATEGORIES[category as keyof typeof WEAPON_CATEGORIES];
    if (weapons && weapons.length > 0) {
      const legendary = weapons.find(w => w.rarity === 'legendary');
      if (legendary) addWeapon(legendary);
    }
  };

  // Clear all weapons
  const clearWeapons = () => {
    setState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        weapons: []
      }
    }));
    setNotification('Weapons cleared!');
    setTimeout(() => setNotification(null), 1500);
  };

  // Add mulligans
  const addMulligans = () => {
    setState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        stats: {
          ...prev.player.stats,
          mulligans: prev.player.stats.mulligans + 3
        }
      }
    }));
    setNotification('+3 Mulligans');
    setTimeout(() => setNotification(null), 1500);
  };

  // Make cards holographic
  const makeCardsHolo = () => {
    setState(prev => ({
      ...prev,
      board: prev.board.map((card, i) => i < 3 ? { ...card, isHolographic: true } : card)
    }));
    setNotification('First 3 cards are now holographic!');
    setTimeout(() => setNotification(null), 1500);
  };

  // Set cards on fire
  const setCardsOnFire = () => {
    setState(prev => ({
      ...prev,
      board: prev.board.map((card, i) => i < 3 ? { ...card, onFire: true, fireStartTime: Date.now() } : card)
    }));
    setNotification('First 3 cards are on fire! (15s burn)');
    setTimeout(() => setNotification(null), 1500);
  };

  const handleValidMatch = (cards: Card[], rewards: CardReward[]) => {
    // Calculate totals from rewards
    let totalPoints = 0;
    let totalMoney = 0;

    rewards.forEach(reward => {
      totalPoints += reward.points || 0;
      totalMoney += reward.money || 0;
    });

    setState(prev => ({
      ...prev,
      score: prev.score + totalPoints,
      selectedCards: [],
      foundCombinations: [...prev.foundCombinations, cards],
    }));

    // Replace matched cards
    replaceMatchedCards(cards);
  };

  const handleInvalidMatch = () => {
    setNotification('Not a valid match!');
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        selectedCards: []
      }));
      setNotification(null);
    }, 1000);
  };

  const replaceMatchedCards = (matchedCards: Card[]) => {
    const remainingDeck = [...state.deck];

    const matchedIndices = matchedCards.map(matchedCard =>
      state.board.findIndex(boardCard => boardCard.id === matchedCard.id)
    );

    const newCards: Card[] = [];
    for (let i = 0; i < matchedCards.length; i++) {
      if (remainingDeck.length > 0) {
        const randomIndex = Math.floor(Math.random() * remainingDeck.length);
        const newCard = remainingDeck[randomIndex];
        newCards.push({ ...newCard, selected: false });
        remainingDeck.splice(randomIndex, 1);
      }
    }

    setState(prev => {
      const updatedBoard = [...prev.board];

      matchedIndices.forEach((index, i) => {
        if (index !== -1 && i < newCards.length) {
          updatedBoard[index] = newCards[i];
        }
      });

      return {
        ...prev,
        board: updatedBoard,
        deck: remainingDeck
      };
    });
  };

  const playerStats = calculatePlayerTotalStats(state.player);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Dev Controls Header */}
      <View className="bg-yellow-100 border-b border-yellow-300 px-4 py-2">
        <Text className="text-yellow-800 font-bold text-center mb-2">DEV MODE - WEAPON TESTING</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          <Pressable
            className="px-3 py-1 bg-blue-500 rounded mr-2"
            onPress={resetBoard}
          >
            <Text className="text-white text-sm font-medium">Reset Board</Text>
          </Pressable>

          <Pressable
            className="px-3 py-1 bg-green-500 rounded mr-2"
            onPress={addMoreCards}
          >
            <Text className="text-white text-sm font-medium">+3 Cards</Text>
          </Pressable>

          <Pressable
            className={`px-3 py-1 rounded mr-2 ${timerEnabled ? 'bg-red-500' : 'bg-gray-400'}`}
            onPress={() => setTimerEnabled(!timerEnabled)}
          >
            <Text className="text-white text-sm font-medium">
              Timer: {timerEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>

          <Pressable
            className={`px-3 py-1 rounded mr-2 ${showWeaponPanel ? 'bg-purple-500' : 'bg-purple-300'}`}
            onPress={() => setShowWeaponPanel(!showWeaponPanel)}
          >
            <Text className="text-white text-sm font-medium">
              Weapons ({state.player.weapons.length})
            </Text>
          </Pressable>
        </ScrollView>

        {/* Weapon Testing Panel */}
        {showWeaponPanel && (
          <View className="mt-2 bg-white rounded-lg p-2 border border-purple-200">
            <Text className="text-purple-800 font-bold text-sm mb-2">Weapon Controls</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              <Pressable className="px-2 py-1 bg-red-400 rounded mr-1" onPress={clearWeapons}>
                <Text className="text-white text-xs">Clear All</Text>
              </Pressable>
              <Pressable className="px-2 py-1 bg-blue-400 rounded mr-1" onPress={addMulligans}>
                <Text className="text-white text-xs">+3 Mulligans</Text>
              </Pressable>
              <Pressable className="px-2 py-1 bg-purple-400 rounded mr-1" onPress={makeCardsHolo}>
                <Text className="text-white text-xs">Make Holo</Text>
              </Pressable>
              <Pressable className="px-2 py-1 bg-orange-400 rounded mr-1" onPress={setCardsOnFire}>
                <Text className="text-white text-xs">Set Fire</Text>
              </Pressable>
            </ScrollView>

            <Text className="text-gray-600 text-xs mb-1">Add Legendary Weapons:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Object.keys(WEAPON_CATEGORIES).map(category => (
                <Pressable
                  key={category}
                  className="px-2 py-1 bg-amber-500 rounded mr-1"
                  onPress={() => addLegendaryFromCategory(category)}
                >
                  <Text className="text-white text-xs">{category}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Current Weapons Display */}
            {state.player.weapons.length > 0 && (
              <View className="mt-2">
                <Text className="text-gray-600 text-xs mb-1">Current Weapons:</Text>
                <Text className="text-gray-800 text-xs">
                  {state.player.weapons.map(w => `${w.name}(${w.rarity[0].toUpperCase()})`).join(', ')}
                </Text>
              </View>
            )}

            {/* Current Stats Display */}
            <View className="mt-2">
              <Text className="text-gray-600 text-xs mb-1">Active Stats:</Text>
              <Text className="text-gray-800 text-xs">
                Explosion: {playerStats.explosionChance}% |
                Fire: {playerStats.fireSpreadChance}% |
                Laser: {playerStats.laserChance}% |
                AutoHint: {playerStats.autoHintChance}% |
                Holo: {playerStats.holoChance}%
              </Text>
              <Text className="text-gray-800 text-xs">
                Mulligans: {playerStats.mulligans} |
                Hints: {playerStats.hints} |
                Healing: {playerStats.healingChance}% |
                Time: {playerStats.timeGainChance}%
              </Text>
            </View>
          </View>
        )}

        {/* Round Selector */}
        <View className="flex-row items-center mt-2">
          <Text className="text-yellow-800 text-sm mr-2">Round:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(round => (
              <Pressable
                key={round}
                className={`w-8 h-8 rounded-full items-center justify-center mr-1 ${
                  currentRound === round ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                onPress={() => changeRound(round)}
              >
                <Text className={`text-sm font-bold ${
                  currentRound === round ? 'text-white' : 'text-gray-700'
                }`}>
                  {round}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stats (moved from footer) */}
        <Text className="text-yellow-700 text-xs text-center mt-2">
          Board: {state.board.length} | Deck: {state.deck.length} | Matches: {state.foundCombinations.length} | Score: {state.score}
        </Text>
      </View>

      {/* Notification */}
      {notification && (
        <View className="absolute top-24 left-4 right-4 z-50 bg-black/80 rounded-lg px-4 py-2">
          <Text className="text-white text-center font-medium">{notification}</Text>
        </View>
      )}

      {/* Game Board - takes all remaining space */}
      <View className="flex-1">
        <GameBoard
          cards={state.board}
          onMatch={handleValidMatch}
          onInvalidSelection={handleInvalidMatch}
          playerStats={playerStats}
          isPlayerTurn={true}
          activeAttributes={state.activeAttributes}
          onSelectedCountChange={setSelectedCount}
          onHintStateChange={setHasActiveHint}
          triggerHint={hintTrigger > 0 ? hintTrigger : undefined}
          triggerClearHint={clearHintTrigger > 0 ? clearHintTrigger : undefined}
        />
      </View>
    </SafeAreaView>
  );
}
