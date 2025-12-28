import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ROUND_REQUIREMENTS } from '../utils/gameDefinitions';

interface RoundScoreboardProps {
  currentRound: number;
  currentScore: number;
}

const RoundScoreboard: React.FC<RoundScoreboardProps> = ({
  currentRound,
  currentScore
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get current round requirement
  const currentRequirement = ROUND_REQUIREMENTS.find(r => r.round === currentRound) ||
    { round: currentRound, targetScore: 3, time: 30 };

  // Calculate progress percentage
  const progressPercentage = Math.min((currentScore / currentRequirement.targetScore) * 100, 100);

  return (
    <View className="bg-gray-100 rounded-lg p-4 shadow-md mb-4">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-lg font-bold">Round Progress</Text>
        <Pressable
          className="flex-row items-center"
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text className="text-blue-600 text-sm underline">
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </Text>
          <Text className="text-blue-600 ml-1">
            {isExpanded ? '▲' : '▼'}
          </Text>
        </Pressable>
      </View>

      <View className="flex-row items-center mb-3">
        <View className="flex-1 bg-gray-200 rounded-full h-2.5 mr-2">
          <View
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </View>
        <Text className="text-sm font-medium">
          {currentScore}/{currentRequirement.targetScore}
        </Text>
      </View>

      {isExpanded && (
        <ScrollView className="border-t pt-3" horizontal>
          <View>
            {/* Header */}
            <View className="flex-row border-b pb-1 mb-1">
              <Text className="py-1 px-2 w-20 font-bold">Round</Text>
              <Text className="py-1 px-2 w-24 font-bold">Target</Text>
              <Text className="py-1 px-2 w-16 font-bold">Time</Text>
            </View>

            {/* Rows */}
            {ROUND_REQUIREMENTS.map(req => (
              <View
                key={req.round}
                className={`flex-row ${
                  req.round === currentRound ? 'bg-blue-100' : ''
                }`}
              >
                <Text className={`py-1 px-2 w-20 ${
                  req.round === currentRound ? 'font-bold' : ''
                } ${req.round < currentRound ? 'text-gray-500' : ''}`}>
                  {req.round}
                </Text>
                <Text className={`py-1 px-2 w-24 ${
                  req.round === currentRound ? 'font-bold' : ''
                } ${req.round < currentRound ? 'text-gray-500' : ''}`}>
                  {req.targetScore} points
                </Text>
                <Text className={`py-1 px-2 w-16 ${
                  req.round === currentRound ? 'font-bold' : ''
                } ${req.round < currentRound ? 'text-gray-500' : ''}`}>
                  {req.time}s
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default RoundScoreboard;
