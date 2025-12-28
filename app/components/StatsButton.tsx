import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { PlayerStats } from '../types';

interface StatsButtonProps {
  playerStats: PlayerStats;
}

// Format stat name for display
const formatStatName = (stat: string): string => {
  return stat
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('Percent', '%');
};

const StatsButton: React.FC<StatsButtonProps> = ({ playerStats }) => {
  const [showModal, setShowModal] = useState(false);

  const stats = Object.entries(playerStats).filter(([key, value]) =>
    typeof value === 'number' && value !== 0
  );

  return (
    <>
      <Pressable
        className="absolute top-4 right-4 z-40 bg-gray-800 px-3 py-2 rounded-full"
        onPress={() => setShowModal(true)}
      >
        <Text className="text-white">Stats</Text>
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 m-4 max-h-[80%] w-[90%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Player Stats</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Text className="text-2xl text-gray-500">×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {stats.map(([stat, value]) => (
                  <View
                    key={stat}
                    className="flex-row justify-between items-center py-2 border-b border-gray-100"
                  >
                    <Text className="text-gray-700">{formatStatName(stat)}</Text>
                    <Text className={`font-bold ${
                      Number(value) > 0 ? 'text-green-600' :
                      Number(value) < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {Number(value) > 0 ? '+' : ''}{value}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default StatsButton;
