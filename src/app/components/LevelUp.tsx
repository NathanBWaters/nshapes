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
    <div className="level-up p-4 text-white">
      <h1 className="text-4xl font-bold mb-2 text-center">Level Up!</h1>
      <p className="mb-8 text-center text-xl">Choose one upgrade to improve your character.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {options.map((option, index) => {
          if (isWeapon(option)) {
            // Render weapon option
            return (
              <div 
                key={`weapon-${index}`}
                className="option-card p-6 rounded-xl cursor-pointer transition-all relative bg-[#1a1b26] border-2 border-orange-500/50 flex flex-col min-h-[320px]"
                style={{
                  background: 'linear-gradient(to bottom, rgba(26, 27, 38, 0.95), rgba(26, 27, 38, 0.98))',
                  boxShadow: '0 0 20px rgba(251, 146, 60, 0.1)'
                }}
                onClick={() => onSelect(index)}
              >
                <div className="flex-grow">
                  <h3 className="font-bold text-xl">
                    <span className="text-orange-400">{option.name}</span>
                    <span className="text-orange-500/70"> (Level {option.level})</span>
                  </h3>
                  <p className="text-sm text-gray-300 mt-2">{option.description}</p>
                  
                  <div className="mt-4">
                    <h4 className="text-lg font-semibold text-orange-400">Effects:</h4>
                    <ul className="text-sm mt-2 space-y-1">
                      {Object.entries(option.effects).map(([key, value]) => {
                        const formattedKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase());
                        
                        return (
                          <li key={key} className="text-gray-300">
                            {formattedKey}: {formatStatValue(value)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
                
                <div className="mt-4">
                  <button
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-lg transition-colors"
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
                className="option-card p-6 rounded-xl cursor-pointer transition-all relative bg-[#1a1b26] border-2 border-blue-500/50 flex flex-col min-h-[320px]"
                style={{
                  background: 'linear-gradient(to bottom, rgba(26, 27, 38, 0.95), rgba(26, 27, 38, 0.98))',
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.1)'
                }}
                onClick={() => onSelect(index)}
              >
                <div className="flex-grow">
                  <h3 className="font-bold text-xl text-blue-400">Stat Upgrade</h3>
                  
                  <div className="mt-4">
                    <ul className="text-sm space-y-2">
                      {Object.entries(option).map(([key, value]) => {
                        const formattedKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase());
                        
                        return (
                          <li key={key} className="text-gray-300 font-medium">
                            {formattedKey}: {formatStatValue(value)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
                
                <div className="mt-4">
                  <button
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition-colors"
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
      
      <div className="mt-8 flex justify-center">
        <button
          className={`px-8 py-3 rounded-lg text-lg font-semibold transition-colors ${
            (playerMoney >= rerollCost || freeRerolls > 0) 
              ? 'bg-[#6366f1] hover:bg-[#5558e6] text-white' 
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
          onClick={onReroll}
          disabled={playerMoney < rerollCost && freeRerolls <= 0}
        >
          {freeRerolls > 0 
            ? `Reroll Options (${freeRerolls})` 
            : `Reroll Options (${rerollCost})`}
        </button>
      </div>
    </div>
  );
};

export default LevelUp; 