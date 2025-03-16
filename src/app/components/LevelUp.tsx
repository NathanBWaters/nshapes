"use client";

import React from 'react';
import { PlayerStats, Weapon } from '../types';

interface LevelUpProps {
  options: (Partial<PlayerStats> | Weapon)[];
  onSelect: (optionIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
}

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls
}) => {
  // Helper function to check if an option is a weapon
  const isWeapon = (option: Partial<PlayerStats> | Weapon): option is Weapon => {
    return 'name' in option && 'level' in option;
  };
  
  // Format stat value for display
  const formatStatValue = (value: number | string | undefined): string => {
    if (value === undefined) return '';
    
    if (typeof value === 'number') {
      return value > 0 ? `+${value}` : `${value}`;
    }
    
    return String(value || '');
  };
  
  return (
    <div className="level-up p-4">
      <h2 className="text-2xl font-bold mb-4">Level Up!</h2>
      <p className="mb-4">Choose one upgrade to improve your character:</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {options.map((option, index) => {
          if (isWeapon(option)) {
            // Render weapon option
            return (
              <div 
                key={`weapon-${index}`}
                className="option-card p-4 border-2 border-orange-300 rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all"
                onClick={() => onSelect(index)}
              >
                <h3 className="font-bold text-orange-700">
                  {option.name} (Level {option.level})
                </h3>
                <p className="text-sm text-gray-600 mt-2">{option.description}</p>
                
                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-green-700">Effects:</h4>
                  <ul className="text-xs mt-1 space-y-1">
                    {Object.entries(option.effects).map(([key, value]) => {
                      const formattedKey = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase());
                      
                      return (
                        <li key={key} className="text-green-600">
                          {formattedKey}: {formatStatValue(value)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                
                <div className="mt-4 text-center">
                  <button
                    className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(index);
                    }}
                  >
                    Select Weapon
                  </button>
                </div>
              </div>
            );
          } else {
            // Render stat upgrade option
            return (
              <div 
                key={`stat-${index}`}
                className="option-card p-4 border-2 border-blue-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                onClick={() => onSelect(index)}
              >
                <h3 className="font-bold text-blue-700">Stat Upgrade</h3>
                
                <div className="mt-3">
                  <ul className="text-sm mt-1 space-y-2">
                    {Object.entries(option).map(([key, value]) => {
                      const formattedKey = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase());
                      
                      return (
                        <li key={key} className="text-blue-600 font-medium">
                          {formattedKey}: {formatStatValue(value)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                
                <div className="mt-4 text-center">
                  <button
                    className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(index);
                    }}
                  >
                    Select Upgrade
                  </button>
                </div>
              </div>
            );
          }
        })}
      </div>
      
      <div className="mt-6 flex justify-center">
        <button
          className={`px-6 py-2 rounded-lg ${
            (playerMoney >= rerollCost || freeRerolls > 0) 
              ? 'bg-purple-500 hover:bg-purple-600 text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={onReroll}
          disabled={playerMoney < rerollCost && freeRerolls <= 0}
        >
          {freeRerolls > 0 
            ? `Reroll Options (${freeRerolls} free)` 
            : `Reroll Options (${rerollCost} 💰)`}
        </button>
      </div>
    </div>
  );
};

export default LevelUp; 