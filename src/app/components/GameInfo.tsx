import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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
  const [showStats, setShowStats] = useState(false);

  // Format the remaining time
  const timeDisplay = formatTime(time);

  // Calculate progress percentage for score
  const progressPercentage = Math.min((score / targetScore) * 100, 100);

  // Group stats into categories for cleaner display
  const statCategories = {
    "Offensive": [
      'damage', 'damagePercent', 'criticalChance',
      'chanceOfFire', 'explosion', 'timeFreezePercent'
    ],
    "Defensive": [
      'health', 'maxHealth', 'dodgePercent',
      'deflectPercent', 'dodgeAttackBackPercent'
    ],
    "Resources": [
      'money', 'commerce', 'scavengingPercent',
      'scavengeAmount', 'freeRerolls'
    ],
    "Gameplay": [
      'fieldSize', 'timeWarpPercent', 'maxTimeIncrease',
      'matchHints', 'matchPossibilityHints', 'matchIntervalHintPercent',
      'mulligans'
    ],
    "Character": [
      'level', 'experienceGainPercent', 'luck',
      'maxWeapons', 'holographicPercent'
    ]
  };

  // Format stat for display
  const formatStat = (key: string, value: number | string) => {
    if (typeof value !== 'number') return value;

    // For percentage stats, add % symbol
    if (key.toLowerCase().includes('percent')) {
      return `${value}%`;
    }

    return value;
  };

  return (
    <View className="p-4 border border-gray-300 rounded-lg mb-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold">Round {round}</Text>
        <View className="flex-row items-center gap-2">
          <Text className={`text-xl font-medium ${time < 10000 ? 'text-red-600' : ''}`}>
            {timeDisplay}
          </Text>
        </View>
      </View>

      <View className="mb-4">
        <View className="flex-row justify-between mb-1">
          <Text>Score: {score}</Text>
          <Text>Target: {targetScore}</Text>
        </View>
        <View className="w-full bg-gray-200 rounded-full h-2.5">
          <View
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </View>
      </View>

      <View className="mb-4">
        <Pressable
          className="w-full py-2 bg-blue-500 rounded-md mb-2"
          onPress={() => setShowStats(!showStats)}
        >
          <Text className="text-white text-center">
            {showStats ? 'Hide' : 'Show'} Player Stats
          </Text>
        </Pressable>
      </View>

      {showStats && (
        <View className="flex-col gap-4">
          {Object.entries(statCategories).map(([category, statKeys]) => (
            <View key={category}>
              <Text className="font-bold text-lg border-b border-gray-300 mb-2">{category}</Text>
              <View>
                {statKeys.map(key => (
                  <View key={key} className="flex-row justify-between mb-1">
                    <Text className="text-sm">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Text>
                    <Text className="font-medium text-sm">
                      {formatStat(key, playerStats[key as keyof PlayerStats] || 0)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default GameInfo;
