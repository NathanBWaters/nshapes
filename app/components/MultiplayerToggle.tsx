import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSocket } from '../context/SocketContext';

const MultiplayerToggle: React.FC = () => {
  const { isMultiplayer, setIsMultiplayer } = useSocket();

  return (
    <View className="flex-row justify-center gap-2 mb-4">
      <Pressable
        className={`px-4 py-2 rounded-lg ${!isMultiplayer ? 'bg-blue-500' : 'bg-gray-200'}`}
        onPress={() => setIsMultiplayer(false)}
      >
        <Text className={!isMultiplayer ? 'text-white font-bold' : 'text-gray-600'}>
          Single Player
        </Text>
      </Pressable>

      <Pressable
        className={`px-4 py-2 rounded-lg ${isMultiplayer ? 'bg-blue-500' : 'bg-gray-200'}`}
        onPress={() => setIsMultiplayer(true)}
      >
        <Text className={isMultiplayer ? 'text-white font-bold' : 'text-gray-600'}>
          Multiplayer
        </Text>
      </Pressable>
    </View>
  );
};

export default MultiplayerToggle;
