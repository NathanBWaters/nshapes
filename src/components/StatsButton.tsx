import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { PlayerStats } from '@/types';

interface StatsButtonProps {
  playerStats: PlayerStats;
}

const StatsButton: React.FC<StatsButtonProps> = ({ playerStats }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Group stats into categories for cleaner display
  const statCategories = {
    "Character": [
      'level', 'experienceGainPercent', 'luck',
      'maxWeapons', 'holographicPercent'
    ],
    "Resources": [
      'money', 'commerce', 'scavengingPercent',
      'scavengeAmount', 'freeRerolls'
    ],
    "Offensive": [
      'damage', 'damagePercent', 'criticalChance',
      'chanceOfFire', 'explosion', 'timeFreezePercent'
    ],
    "Defensive": [
      'health', 'maxHealth', 'dodgePercent',
      'deflectPercent', 'dodgeAttackBackPercent'
    ],
    "Gameplay": [
      'fieldSize', 'timeWarpPercent', 'maxTimeIncrease',
      'matchHints', 'matchPossibilityHints', 'matchIntervalHintPercent',
      'mulligans'
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

  // Format a key from camelCase to Title Case with spaces
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <>
      {/* Stats Button in top right corner */}
      <TouchableOpacity
        className="absolute top-4 right-4 z-30 bg-blue-500 py-2 px-4 rounded-full shadow-lg flex-row items-center"
        onPress={openModal}
      >
        <Text className="text-white font-bold">Stats</Text>
      </TouchableOpacity>

      {/* Stats Modal */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90%]">
            <ScrollView className="p-6">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold">Character Stats</Text>
                <TouchableOpacity onPress={closeModal}>
                  <Text className="text-gray-500 text-2xl">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-col gap-6">
                {Object.entries(statCategories).map(([category, statKeys]) => (
                  <View key={category} className="bg-gray-50 p-4 rounded-lg shadow">
                    <Text className="font-bold text-lg border-b border-gray-300 pb-2 mb-3 text-blue-600">
                      {category}
                    </Text>
                    <View className="gap-2">
                      {statKeys.map(key => (
                        <View key={key} className="flex-row justify-between items-center">
                          <Text className="text-gray-700">{formatKey(key)}</Text>
                          <Text className="font-medium text-blue-700">
                            {formatStat(key, playerStats[key as keyof PlayerStats] || 0)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              <View className="mt-6 items-center">
                <TouchableOpacity
                  onPress={closeModal}
                  className="bg-blue-500 py-2 px-6 rounded"
                >
                  <Text className="text-white font-bold">Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default StatsButton;
