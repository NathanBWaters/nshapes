"use client";

import React from 'react';
import { useSocket } from '../context/SocketContext';

const MultiplayerToggle: React.FC = () => {
  const { isMultiplayer, toggleMultiplayer } = useSocket();
  
  return (
    <div className="multiplayer-toggle flex justify-center my-4">
      <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
        <button
          className={`px-4 py-2 rounded-md transition-colors ${
            !isMultiplayer 
              ? 'bg-blue-500 text-white' 
              : 'text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => toggleMultiplayer(false)}
        >
          Single Player
        </button>
        <button
          className={`px-4 py-2 rounded-md transition-colors ${
            isMultiplayer 
              ? 'bg-blue-500 text-white' 
              : 'text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => toggleMultiplayer(true)}
        >
          Multiplayer
        </button>
      </div>
    </div>
  );
};

export default MultiplayerToggle; 