"use client";

import React, { useState } from 'react';

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
  
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="multiplayer-lobby p-6 bg-gray-100 rounded-lg shadow-md max-w-md mx-auto my-8">
      <h2 className="text-2xl font-bold mb-4 text-center">Multiplayer Lobby</h2>
      
      <div className="mb-6">
        <p className="text-center mb-2">Room ID:</p>
        <div className="flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded-l-lg border border-gray-300 font-mono text-lg">
            {roomId}
          </div>
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-lg transition-colors"
            onClick={copyRoomId}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-center text-sm text-gray-600 mt-2">
          Share this Room ID with your friends to let them join
        </p>
      </div>
      
      <div className="text-center mb-6">
        <div className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
          {isHost ? 'You are the host' : 'Waiting for host to start the game'}
        </div>
      </div>
      
      {isHost && (
        <div className="text-center">
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold transition-colors"
            onClick={onStartGame}
          >
            Start Game
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Click to start the game when all players have joined
          </p>
        </div>
      )}
      
      {!isHost && (
        <div className="text-center">
          <div className="animate-pulse flex justify-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mx-1"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full mx-1 animation-delay-200"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full mx-1 animation-delay-400"></div>
          </div>
          <p className="text-gray-600 mt-2">Waiting for host to start the game...</p>
        </div>
      )}
    </div>
  );
};

export default MultiplayerLobby; 