"use client";

import React, { useState } from 'react';
import { PlayerStats } from '../types';

interface StatsButtonProps {
  playerStats: PlayerStats;
}

const StatsButton: React.FC<StatsButtonProps> = ({ playerStats }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Group stats into categories for cleaner display
  const statCategories = {
    "Character": [
      'level', 'experienceGainPercent', 'luck',
      'maxWeapons', 'holographicPercent'
    ],
    "Resources": [
      'money', 'commerce', 'scavengingPercent', 
      'scavengeAmount', 'freeRerolls'
    ],
    "Offensive": [
      'damage', 'damagePercent', 'criticalChance', 
      'chanceOfFire', 'explosion', 'timeFreezePercent'
    ],
    "Defensive": [
      'health', 'maxHealth', 'dodgePercent', 
      'deflectPercent', 'dodgeAttackBackPercent'
    ],
    "Gameplay": [
      'fieldSize', 'timeWarpPercent', 'maxTimeIncrease',
      'matchHints', 'matchPossibilityHints', 'matchIntervalHintPercent',
      'mulligans'
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

  // Format a key from camelCase to Title Case with spaces
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
  };

  return (
    <>
      {/* Stats Button in top right corner */}
      <button 
        className="fixed top-4 right-4 z-30 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg flex items-center"
        onClick={openModal}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 3a1 1 0 000 2h14a1 1 0 100-2H3zm0 6a1 1 0 000 2h9a1 1 0 100-2H3zm0 6a1 1 0 100 2h6a1 1 0 100-2H3z" clipRule="evenodd" />
        </svg>
        Stats
      </button>

      {/* Stats Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Character Stats</h2>
                <button 
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(statCategories).map(([category, statKeys]) => (
                  <div key={category} className="stat-category bg-gray-50 p-4 rounded-lg shadow">
                    <h3 className="font-bold text-lg border-b border-gray-300 pb-2 mb-3 text-blue-600">{category}</h3>
                    <ul className="space-y-2">
                      {statKeys.map(key => (
                        <li key={key} className="flex justify-between items-center">
                          <span className="text-gray-700">{formatKey(key)}</span>
                          <span className="font-medium text-blue-700">
                            {formatStat(key, playerStats[key as keyof PlayerStats] || 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={closeModal}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StatsButton; 