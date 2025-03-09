"use client";

import React from 'react';
import { useSocket } from '../context/SocketContext';

const MultiplayerToggle: React.FC = () => {
  const { isMultiplayer, setIsMultiplayer, roomId } = useSocket();

  // Prevent toggling if already in a room
  const handleToggle = () => {
    if (!roomId) {
      setIsMultiplayer(!isMultiplayer);
    }
  };

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="flex items-center justify-center space-x-4">
        <button
          className={`px-4 py-2 rounded-l-lg transition-colors ${
            !isMultiplayer 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          onClick={() => handleToggle()}
          disabled={!!roomId}
        >
          Single Player
        </button>
        <button
          className={`px-4 py-2 rounded-r-lg transition-colors ${
            isMultiplayer 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          onClick={() => handleToggle()}
          disabled={!!roomId}
        >
          Multiplayer
        </button>
      </div>
      {roomId && (
        <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Game mode cannot be changed when in a room
        </span>
      )}
    </div>
  );
};

export default MultiplayerToggle; 