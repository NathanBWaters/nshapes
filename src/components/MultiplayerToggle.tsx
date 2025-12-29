import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSocket } from '@/context/SocketContext';

const MultiplayerToggle: React.FC = () => {
  const { isMultiplayer, toggleMultiplayer } = useSocket();

  return (
    <View className="flex justify-center my-4">
      <View className="flex-row items-center bg-gray-100 rounded-lg p-1">
        <TouchableOpacity
          className={`px-4 py-2 rounded-md ${
            !isMultiplayer
              ? 'bg-blue-500'
              : ''
          }`}
          onPress={() => toggleMultiplayer(false)}
        >
          <Text className={!isMultiplayer ? 'text-white' : 'text-gray-700'}>
            Single Player
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-4 py-2 rounded-md ${
            isMultiplayer
              ? 'bg-blue-500'
              : ''
          }`}
          onPress={() => toggleMultiplayer(true)}
        >
          <Text className={isMultiplayer ? 'text-white' : 'text-gray-700'}>
            Multiplayer
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MultiplayerToggle;
