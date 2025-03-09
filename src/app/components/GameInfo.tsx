"use client";

import React, { useEffect, useState } from 'react';
import { formatTime } from '../utils/gameUtils';

interface GameInfoProps {
  score: number;
  startTime: number | null;
  endTime: number | null;
  gameStarted: boolean;
  gameEnded: boolean;
  cardsRemaining: number;
  onNewGame: () => void;
  onShowHint: () => void;
  onAddCards: () => void;
  foundSetsCount: number;
  hintAvailable: boolean;
  canAddCards: boolean;
}

const GameInfo: React.FC<GameInfoProps> = ({
  score,
  startTime,
  endTime,
  gameStarted,
  gameEnded,
  cardsRemaining,
  onNewGame,
  onShowHint,
  onAddCards,
  foundSetsCount,
  hintAvailable,
  canAddCards,
}) => {
  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (gameStarted && !gameEnded && startTime) {
      interval = setInterval(() => {
        setCurrentTime(Date.now() - startTime);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameStarted, gameEnded, startTime]);

  const displayTime = gameEnded && endTime && startTime
    ? formatTime(endTime - startTime)
    : gameStarted && startTime
      ? formatTime(currentTime)
      : '00:00';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 w-full max-w-2xl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <div className="text-center md:text-left mb-4 md:mb-0">
          <h2 className="text-xl font-bold">Score: {score}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sets Found: {foundSetsCount}</p>
        </div>
        
        <div className="flex flex-col items-center mb-4 md:mb-0">
          <p className="text-lg font-mono">{displayTime}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cards Remaining: {cardsRemaining}</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            onClick={onNewGame}
          >
            {gameStarted ? 'Restart Game' : 'New Game'}
          </button>
          
          <button
            className={`px-4 py-2 rounded transition-colors ${
              hintAvailable
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={onShowHint}
            disabled={!hintAvailable}
          >
            Hint
          </button>
          
          <button
            className={`px-4 py-2 rounded transition-colors ${
              canAddCards
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={onAddCards}
            disabled={!canAddCards}
          >
            Add Cards
          </button>
        </div>
      </div>
      
      {gameEnded && (
        <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg text-center">
          <h3 className="text-xl font-bold mb-2">Game Over!</h3>
          <p className="mb-2">Final Score: {score}</p>
          <p className="mb-4">Time: {displayTime}</p>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            onClick={onNewGame}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};

export default GameInfo; 