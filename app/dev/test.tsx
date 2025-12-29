import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, CardReward, GameState, PlayerStats } from '@/types';
import { createDeck, shuffleArray, generateGameBoard, formatTime } from '@/utils/gameUtils';
import {
  ROUND_REQUIREMENTS,
  initializePlayer,
  calculatePlayerTotalStats,
} from '@/utils/gameDefinitions';
import GameBoard from '@/components/GameBoard';
import GameInfo from '@/components/GameInfo';

const INITIAL_CARD_COUNT = 12;

const getRoundRequirement = (round: number) => {
  return ROUND_REQUIREMENTS.find(r => r.round === round) ||
         { round: 1, targetScore: 3, time: 30 };
};

export default function DevTest() {
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [notification, setNotification] = useState<string | null>(null);

  // UI state for header stats
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasActiveHint, setHasActiveHint] = useState(false);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [clearHintTrigger, setClearHintTrigger] = useState(0);

  const [state, setState] = useState<GameState>(() => {
    const roundReq = getRoundRequirement(1);
    const initialBoard = generateGameBoard(INITIAL_CARD_COUNT, 1, 1);
    const deck = shuffleArray(createDeck());
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
      round: 1,
      targetScore: roundReq.targetScore,
      remainingTime: roundReq.time,
      roundCompleted: false,
      player: initializePlayer('dev', 'Dev Player', 'Orange Tabby'),
      shopItems: [],
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
    const newBoard = generateGameBoard(INITIAL_CARD_COUNT, currentRound, currentRound);
    const deck = shuffleArray(createDeck());
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
      gameEnded: false,
    }));

    setNotification('Board reset!');
    setTimeout(() => setNotification(null), 1500);
  }, [currentRound]);

  const changeRound = (round: number) => {
    setCurrentRound(round);
    const roundReq = getRoundRequirement(round);
    const newBoard = generateGameBoard(INITIAL_CARD_COUNT, round, round);
    const deck = shuffleArray(createDeck());
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
        <Text className="text-yellow-800 font-bold text-center mb-2">DEV MODE</Text>

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
        </ScrollView>

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
      </View>

      {/* Notification */}
      {notification && (
        <View className="absolute top-24 left-4 right-4 z-50 bg-black/80 rounded-lg px-4 py-2">
          <Text className="text-white text-center font-medium">{notification}</Text>
        </View>
      )}

      {/* Game Info */}
      <View className="h-[10%] px-2 py-1">
        <GameInfo
          round={state.round}
          score={state.score}
          targetScore={state.targetScore}
          time={state.remainingTime}
          totalTime={getRoundRequirement(state.round).time}
          playerStats={playerStats}
          selectedCount={selectedCount}
          onHintPress={() => setHintTrigger(t => t + 1)}
          onClearHint={() => setClearHintTrigger(t => t + 1)}
          hasActiveHint={hasActiveHint}
        />
      </View>

      {/* Game Board */}
      <View className="h-[90%]">
        <GameBoard
          cards={state.board}
          onMatch={handleValidMatch}
          onInvalidSelection={handleInvalidMatch}
          playerStats={playerStats}
          isPlayerTurn={true}
          onSelectedCountChange={setSelectedCount}
          onHintStateChange={setHasActiveHint}
          triggerHint={hintTrigger > 0 ? hintTrigger : undefined}
          triggerClearHint={clearHintTrigger > 0 ? clearHintTrigger : undefined}
        />
      </View>

      {/* Stats Footer */}
      <View className="bg-gray-200 px-4 py-2">
        <Text className="text-gray-600 text-xs text-center">
          Board: {state.board.length} cards | Deck: {state.deck.length} cards |
          Matches: {state.foundCombinations.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}
