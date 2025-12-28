import React from 'react';
import { View, Text } from 'react-native';
import { useSocket } from '../context/SocketContext';

const ScoreBoard: React.FC = () => {
  const { players, playerId } = useSocket();

  if (players.length <= 1) {
    return null;
  }

  return (
    <View className="mb-4 bg-white rounded-lg shadow-md p-4 w-full max-w-2xl">
      <Text className="text-lg font-semibold mb-3">Player Scores</Text>
      <View className="flex-col gap-3">
        {players.map((player) => (
          <View
            key={player.id}
            className={`flex-row justify-between items-center p-3 rounded-lg ${
              player.id === playerId
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-gray-50'
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`w-3 h-3 rounded-full mr-2 ${
                  player.id === playerId ? 'bg-blue-500' : 'bg-gray-400'
                }`}
              />
              <Text className="font-medium">{player.name}</Text>
            </View>
            <View className="bg-gray-100 px-3 py-1 rounded-full">
              <Text className="font-semibold">{player.score}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default ScoreBoard;
