import React from 'react';
import { View, Text } from 'react-native';
import { PlayerStats } from '../types';
import { formatTime } from '../utils/gameUtils';

interface GameInfoProps {
  round: number;
  score: number;
  targetScore: number;
  time: number;
  playerStats: PlayerStats;
}

const GameInfo: React.FC<GameInfoProps> = ({
  round,
  score,
  targetScore,
  time,
  playerStats
}) => {
  const timeColor = time <= 10 ? 'text-red-500' : time <= 30 ? 'text-yellow-500' : 'text-gray-700';

  return (
    <View className="flex-row justify-between items-center p-4 bg-gray-50 rounded-lg mb-4">
      <View className="items-center">
        <Text className="text-sm text-gray-500">Round</Text>
        <Text className="text-xl font-bold text-gray-900">{round}</Text>
      </View>

      <View className="items-center">
        <Text className="text-sm text-gray-500">Score</Text>
        <View className="flex-row items-baseline">
          <Text className="text-xl font-bold text-gray-900">{score}</Text>
          <Text className="text-sm text-gray-500">/{targetScore}</Text>
        </View>
      </View>

      <View className="items-center">
        <Text className="text-sm text-gray-500">Time</Text>
        <Text className={`text-xl font-bold ${timeColor}`}>{formatTime(time)}</Text>
      </View>

      <View className="items-center">
        <Text className="text-sm text-gray-500">Health</Text>
        <Text className="text-xl font-bold text-red-500">
          {playerStats.health}/{playerStats.maxHealth}
        </Text>
      </View>

      <View className="items-center">
        <Text className="text-sm text-gray-500">Money</Text>
        <Text className="text-xl font-bold text-green-600">${playerStats.money}</Text>
      </View>
    </View>
  );
};

export default GameInfo;
