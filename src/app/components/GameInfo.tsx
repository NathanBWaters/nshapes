"use client";

import React from 'react';
import { PlayerStats } from '../types';
import { formatTime } from '../utils/gameUtils';

interface GameInfoProps {
  round: number;
  score: number;
  targetScore: number;
  time: number;
  playerStats: PlayerStats;
}

const GameInfo: React.FC<GameInfoProps> = ({ 
  round, 
  score, 
  targetScore, 
  time,
  playerStats
}) => {
  // Format the remaining time
  const timeDisplay = formatTime(time);
  
  // Calculate progress percentage for score
  const progressPercentage = Math.min((score / targetScore) * 100, 100);
  
  // Group stats into categories for cleaner display
  const statCategories = {
    "Offensive": [
      'damage', 'damagePercent', 'criticalChance', 
      'chanceOfFire', 'explosion', 'timeFreezePercent'
    ],
    "Defensive": [
      'health', 'maxHealth', 'dodgePercent', 
      'deflectPercent', 'dodgeAttackBackPercent'
    ],
    "Resources": [
      'money', 'commerce', 'scavengingPercent', 
      'scavengeAmount', 'freeRerolls'
    ],
    "Gameplay": [
      'fieldSize', 'timeWarpPercent', 'maxTimeIncrease',
      'matchHints', 'matchPossibilityHints', 'matchIntervalHintPercent',
      'mulligans'
    ],
    "Character": [
      'level', 'experienceGainPercent', 'luck',
      'maxWeapons', 'holographicPercent'
    ]
  };
  
  // Format stat for display
  const formatStat = (key: string, value: number | string) => {
    if (typeof value !== 'number') return value;
    
    // For percentage stats, add % symbol
    if (key.toLowerCase().includes('percent')) {
      return `${value}%`;
    }
    
    return value;
  };

  return (
    <div className="game-info p-4 border border-gray-300 rounded-lg mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Round {round}</h2>
        <div className="time-display text-xl font-medium flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={time < 10000 ? 'text-red-600' : ''}>{timeDisplay}</span>
        </div>
      </div>
      
      <div className="score-progress mb-4">
        <div className="flex justify-between mb-1">
          <span>Score: {score}</span>
          <span>Target: {targetScore}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>
      
      <div className="mb-4">
        <button 
          className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors mb-2"
          onClick={() => {
            // Toggle stats display
            const statsSection = document.getElementById('player-stats');
            if (statsSection) {
              statsSection.classList.toggle('hidden');
            }
          }}
        >
          Show/Hide Player Stats
        </button>
      </div>
      
      <div id="player-stats" className="hidden player-stats">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(statCategories).map(([category, statKeys]) => (
            <div key={category} className="stat-category">
              <h3 className="font-bold text-lg border-b border-gray-300 mb-2">{category}</h3>
              <ul className="text-sm">
                {statKeys.map(key => (
                  <li key={key} className="flex justify-between mb-1">
                    <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                    <span className="font-medium">{formatStat(key, playerStats[key as keyof PlayerStats] || 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameInfo; 