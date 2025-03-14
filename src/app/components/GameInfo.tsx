"use client";

import React from 'react';
import { formatTime } from '../utils/gameUtils';

interface GameInfoProps {
  score: number;
  gameStarted: boolean;
  gameEnded: boolean;
  cardsRemaining: number;
  onNewGame: () => void;
  onShowHint: () => void;
  onAddCards: () => void;
  foundCombinationsCount: number;
  hintAvailable: boolean;
  canAddCards: boolean;
  level: number;
  targetScore: number;
  remainingTime: number;
}

const GameInfo: React.FC<GameInfoProps> = ({
  score,
  gameStarted,
  gameEnded,
  cardsRemaining,
  onNewGame,
  onShowHint,
  onAddCards,
  foundCombinationsCount,
  hintAvailable,
  canAddCards,
  level,
  targetScore,
  remainingTime,
}) => {
  const displayTime = gameEnded
    ? '00:00'
    : gameStarted
      ? formatTime(remainingTime)
      : '03:00';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 w-full max-w-2xl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <div className="text-center md:text-left mb-4 md:mb-0">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Level: {level} / {9}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Score: {score} / {targetScore} needed
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Combinations Found: {foundCombinationsCount}
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-gray-800 dark:text-white">
            {displayTime}
          </div>
          <p className="text-gray-600 dark:text-gray-300">Time Remaining</p>
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