"use client";

import React from 'react';
import { Enemy } from '../types';

interface EnemySelectionProps {
  enemies: Enemy[];
  onSelect: (enemy: Enemy) => void;
  round: number;
}

const EnemySelection: React.FC<EnemySelectionProps> = ({
  enemies,
  onSelect,
  round
}) => {
  return (
    <div className="enemy-selection p-4">
      <h2 className="text-2xl font-bold mb-4">Choose Your Enemy - Round {round}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {enemies.map(enemy => (
          <div 
            key={enemy.name}
            className="enemy-card p-4 border-2 rounded-lg cursor-pointer hover:border-red-500 hover:bg-red-50 transition-all"
            onClick={() => onSelect(enemy)}
          >
            <h3 className="font-bold text-lg text-red-700">{enemy.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{enemy.description}</p>
            
            <div className="mt-2">
              <h4 className="font-semibold text-sm">Enemy Effect:</h4>
              <p className="text-xs mt-1">{enemy.effect}</p>
            </div>
            
            <div className="mt-2">
              <h4 className="font-semibold text-sm">Reward:</h4>
              <p className="text-xs mt-1">{enemy.reward}</p>
            </div>
            
            <button 
              className="mt-4 w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(enemy);
              }}
            >
              Fight This Enemy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnemySelection; 