import React from 'react';
import { View, Text } from 'react-native';
import { ROUND_REQUIREMENTS } from '../utils/gameDefinitions';

interface RoundScoreboardProps {
  currentRound: number;
  currentScore: number;
}

const RoundScoreboard: React.FC<RoundScoreboardProps> = ({
  currentRound,
  currentScore
}) => {
  return (
    <View className="mb-4">
      <Text className="text-sm font-bold text-gray-700 mb-2">Round Progress</Text>
      <View className="flex-row flex-wrap gap-1">
        {ROUND_REQUIREMENTS.slice(0, 10).map((req) => {
          const isCurrentRound = req.round === currentRound;
          const isPastRound = req.round < currentRound;
          const isFutureRound = req.round > currentRound;

          let bgColor = 'bg-gray-200';
          let textColor = 'text-gray-500';

          if (isPastRound) {
            bgColor = 'bg-green-500';
            textColor = 'text-white';
          } else if (isCurrentRound) {
            bgColor = 'bg-blue-500';
            textColor = 'text-white';
          }

          return (
            <View
              key={req.round}
              className={`w-8 h-8 rounded items-center justify-center ${bgColor}`}
            >
              <Text className={`text-xs font-bold ${textColor}`}>{req.round}</Text>
            </View>
          );
        })}
      </View>

      {currentRound <= 10 && (
        <View className="mt-2">
          <Text className="text-xs text-gray-500">
            Target: {ROUND_REQUIREMENTS.find(r => r.round === currentRound)?.targetScore || 0} points
          </Text>
        </View>
      )}
    </View>
  );
};

export default RoundScoreboard;
