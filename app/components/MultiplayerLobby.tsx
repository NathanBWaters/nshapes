import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useSocket } from '../context/SocketContext';

interface MultiplayerLobbyProps {
  roomId: string | null;
  isHost: boolean;
  onStartGame: () => void;
}

const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  roomId,
  isHost,
  onStartGame
}) => {
  const [joinRoomId, setJoinRoomId] = useState('');
  const { createRoom, joinRoom, players, isConnected, errorMessage } = useSocket();

  return (
    <View className="p-4 bg-gray-100 rounded-lg mb-4">
      <Text className="text-xl font-bold text-center mb-4 text-gray-900">Multiplayer Lobby</Text>

      {errorMessage && (
        <View className="bg-red-100 p-3 rounded-lg mb-4">
          <Text className="text-red-700">{errorMessage}</Text>
        </View>
      )}

      {!isConnected && (
        <View className="bg-yellow-100 p-3 rounded-lg mb-4">
          <Text className="text-yellow-700">Connecting to server...</Text>
        </View>
      )}

      {!roomId ? (
        <View className="gap-4">
          <Pressable
            className={`px-4 py-3 rounded-lg ${isConnected ? 'bg-blue-500' : 'bg-gray-300'}`}
            onPress={createRoom}
            disabled={!isConnected}
          >
            <Text className={`text-center font-bold ${isConnected ? 'text-white' : 'text-gray-500'}`}>
              Create Room
            </Text>
          </Pressable>

          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 bg-white"
              placeholder="Enter room code"
              value={joinRoomId}
              onChangeText={setJoinRoomId}
              autoCapitalize="characters"
            />
            <Pressable
              className={`px-4 py-2 rounded-lg ${isConnected && joinRoomId ? 'bg-green-500' : 'bg-gray-300'}`}
              onPress={() => joinRoom(joinRoomId)}
              disabled={!isConnected || !joinRoomId}
            >
              <Text className={`font-bold ${isConnected && joinRoomId ? 'text-white' : 'text-gray-500'}`}>
                Join
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="gap-4">
          <View className="bg-white p-4 rounded-lg">
            <Text className="text-sm text-gray-500">Room Code:</Text>
            <Text className="text-2xl font-bold text-gray-900">{roomId}</Text>
          </View>

          <View className="bg-white p-4 rounded-lg">
            <Text className="text-sm text-gray-500 mb-2">Players ({players.length}):</Text>
            {players.map((player, index) => (
              <View key={player.id} className="flex-row items-center py-1">
                <Text className="text-gray-700">
                  {index + 1}. {player.name}
                </Text>
                {index === 0 && (
                  <View className="bg-yellow-100 px-2 py-0.5 rounded ml-2">
                    <Text className="text-yellow-700 text-xs">Host</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {isHost && (
            <Pressable
              className={`px-4 py-3 rounded-lg ${players.length >= 1 ? 'bg-green-500' : 'bg-gray-300'}`}
              onPress={onStartGame}
              disabled={players.length < 1}
            >
              <Text className={`text-center font-bold ${players.length >= 1 ? 'text-white' : 'text-gray-500'}`}>
                Start Game
              </Text>
            </Pressable>
          )}

          {!isHost && (
            <View className="bg-blue-100 p-3 rounded-lg">
              <Text className="text-blue-700 text-center">Waiting for host to start the game...</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default MultiplayerLobby;
