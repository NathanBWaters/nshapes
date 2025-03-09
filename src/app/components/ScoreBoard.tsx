"use client";

import React from 'react';
import { useSocket } from '../context/SocketContext';

const ScoreBoard: React.FC = () => {
  const { players, playerId } = useSocket();
  
  if (players.length <= 1) {
    return null;
  }
  
  return (
    <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 w-full max-w-2xl">
      <h3 className="text-lg font-semibold mb-3">Player Scores</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {players.map((player) => (
          <div 
            key={player.id}
            className={`
              flex justify-between items-center p-3 rounded-lg
              ${player.id === playerId 
                ? 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800' 
                : 'bg-gray-50 dark:bg-gray-700'
              }
            `}
          >
            <div className="flex items-center">
              <div className={`
                w-3 h-3 rounded-full mr-2
                ${player.id === playerId ? 'bg-blue-500' : 'bg-gray-400'}
              `}></div>
              <span className="font-medium">{player.name}</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-600 px-3 py-1 rounded-full font-semibold">
              {player.score}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoreBoard; 