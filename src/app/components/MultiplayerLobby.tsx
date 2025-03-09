"use client";

import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

interface MultiplayerLobbyProps {
  onStartGame: () => void;
}

const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ onStartGame }) => {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  const {
    createRoom,
    joinRoom,
    roomId,
    isHost,
    players,
    errorMessage,
    isConnected,
    socket
  } = useSocket();

  // Track connection attempts
  useEffect(() => {
    if (!isConnected && !socket) {
      const timer = setTimeout(() => {
        setConnectionAttempts(prev => prev + 1);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, socket, connectionAttempts]);

  // Handle room creation
  const handleCreateRoom = () => {
    if (isConnected) {
      createRoom();
    }
  };

  // Handle joining a room
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnected && joinRoomId.trim()) {
      joinRoom(joinRoomId.trim());
    }
  };

  // Handle starting the game (only available to host)
  const handleStartGame = () => {
    if (isHost && players.length > 0) {
      onStartGame();
    }
  };

  // If not connected to socket.io server
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">Connecting to server...</h2>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        
        {connectionAttempts > 2 && (
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
            <p className="font-bold mb-1">Connection taking longer than expected</p>
            <p>Make sure the server is running with:</p>
            <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded mt-2 font-mono text-xs overflow-x-auto">
              npm run server
            </pre>
          </div>
        )}
        
        {errorMessage && (
          <div className="text-red-500 font-semibold mt-4 p-3 bg-red-100 dark:bg-red-900 rounded-lg">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  // If already in a room
  if (roomId) {
    return (
      <div className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-4">Game Room</h2>
        <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg w-full text-center mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-300 mb-1">Room Code:</p>
          <p className="text-2xl font-mono font-bold">{roomId}</p>
        </div>
        
        <div className="w-full mb-6">
          <h3 className="text-lg font-semibold mb-2">Players:</h3>
          <ul className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 w-full">
            {players.map((player) => (
              <li 
                key={player.id} 
                className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600 last:border-0"
              >
                <span className="font-medium">
                  {player.name} {player.id === roomId ? '(Host)' : ''}
                </span>
                <span className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 px-2 py-1 rounded-full text-xs">
                  Ready
                </span>
              </li>
            ))}
          </ul>
        </div>
        
        {isHost ? (
          <button
            className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold"
            onClick={handleStartGame}
            disabled={players.length < 1}
          >
            Start Game
          </button>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 italic">
            Waiting for host to start the game...
          </p>
        )}
      </div>
    );
  }

  // Initial lobby screen (not in a room yet)
  return (
    <div className="flex flex-col items-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Multiplayer Lobby</h2>
      
      <div className="mb-4 p-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-lg text-sm w-full text-center">
        Connected to server ✓
      </div>

      <div className="flex flex-col gap-4 w-full">
        <button
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold"
          onClick={handleCreateRoom}
        >
          Create New Room
        </button>

        <div className="relative my-4 w-full">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">OR</span>
          </div>
        </div>

        <form onSubmit={handleJoinRoom} className="w-full">
          <div className="mb-4">
            <label htmlFor="roomId" className="block text-sm font-medium mb-2">
              Join Existing Room
            </label>
            <input
              type="text"
              id="roomId"
              placeholder="Enter room code"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-bold"
          >
            Join Room
          </button>
        </form>
      </div>
      
      {errorMessage && (
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default MultiplayerLobby; 