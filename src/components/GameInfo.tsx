import React from 'react';
import { View, Text } from 'react-native';
import { PlayerStats } from '@/types';
import CircularTimer from './CircularTimer';

interface GameInfoProps {
  round: number;
  score: number;
  targetScore: number;
  time: number;
  totalTime: number;
  playerStats: PlayerStats;
}

const GameInfo: React.FC<GameInfoProps> = ({
  round,
  score,
  targetScore,
  time,
  totalTime,
}) => {
  // Calculate progress percentage for score
  const progressPercentage = Math.min((score / targetScore) * 100, 100);

  return (
    <View nativeID="gameinfo-container" className="flex-row items-center justify-between">
      {/* Round indicator */}
      <View nativeID="gameinfo-round" className="bg-gray-800 px-3 py-1 rounded-lg">
        <Text className="text-white font-bold text-sm">R{round}</Text>
      </View>

      {/* Score progress */}
      <View nativeID="gameinfo-score" className="flex-1 mx-3">
        <View className="flex-row justify-between mb-0.5">
          <Text className="text-xs text-gray-600">{score}/{targetScore}</Text>
        </View>
        <View nativeID="gameinfo-progressbar" className="w-full bg-gray-200 rounded-full h-2">
          <View
            nativeID="gameinfo-progressfill"
            className={`h-2 rounded-full ${progressPercentage >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </View>
      </View>

      {/* Circular Timer */}
      <CircularTimer
        currentTime={time}
        totalTime={totalTime}
        size={44}
        strokeWidth={4}
      />
    </View>
  );
};

export default GameInfo;
