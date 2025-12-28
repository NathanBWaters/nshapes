import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSocket } from '../context/SocketContext';

const MultiplayerToggle: React.FC = () => {
  const { isMultiplayer, toggleMultiplayer } = useSocket();

  return (
    <View className="flex justify-center my-4">
      <View className="flex-row items-center bg-gray-100 rounded-lg p-1">
        <Pressable
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
        </Pressable>
        <Pressable
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
        </Pressable>
      </View>
    </View>
  );
};

export default MultiplayerToggle;
