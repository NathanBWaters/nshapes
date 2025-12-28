import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface MultiplayerLobbyProps {
  roomId: string;
  isHost: boolean;
  onStartGame: () => void;
}

const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  roomId,
  isHost,
  onStartGame
}) => {
  const [copied, setCopied] = useState(false);

  const copyRoomId = async () => {
    await Clipboard.setStringAsync(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View className="p-6 bg-gray-100 rounded-lg shadow-md max-w-md mx-auto my-8">
      <Text className="text-2xl font-bold mb-4 text-center">Multiplayer Lobby</Text>

      <View className="mb-6">
        <Text className="text-center mb-2">Room ID:</Text>
        <View className="flex-row items-center justify-center">
          <View className="bg-white px-4 py-2 rounded-l-lg border border-gray-300">
            <Text className="font-mono text-lg">{roomId}</Text>
          </View>
          <Pressable
            className="bg-blue-500 px-4 py-2 rounded-r-lg"
            onPress={copyRoomId}
          >
            <Text className="text-white">{copied ? 'Copied!' : 'Copy'}</Text>
          </Pressable>
        </View>
        <Text className="text-center text-sm text-gray-600 mt-2">
          Share this Room ID with your friends to let them join
        </Text>
      </View>

      <View className="items-center mb-6">
        <View className="bg-green-100 px-3 py-1 rounded-full">
          <Text className="text-green-800 text-sm">
            {isHost ? 'You are the host' : 'Waiting for host to start the game'}
          </Text>
        </View>
      </View>

      {isHost && (
        <View className="items-center">
          <Pressable
            className="bg-green-500 px-6 py-3 rounded-lg"
            onPress={onStartGame}
          >
            <Text className="text-white font-bold">Start Game</Text>
          </Pressable>
          <Text className="text-sm text-gray-600 mt-2 text-center">
            Click to start the game when all players have joined
          </Text>
        </View>
      )}

      {!isHost && (
        <View className="items-center">
          <View className="flex-row justify-center">
            <View className="w-3 h-3 bg-blue-500 rounded-full mx-1" />
            <View className="w-3 h-3 bg-blue-500 rounded-full mx-1" />
            <View className="w-3 h-3 bg-blue-500 rounded-full mx-1" />
          </View>
          <Text className="text-gray-600 mt-2">Waiting for host to start the game...</Text>
        </View>
      )}
    </View>
  );
};

export default MultiplayerLobby;
