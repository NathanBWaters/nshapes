"use client";

import React from 'react';
import { Character } from '../types';

interface CharacterSelectionProps {
  characters: Character[];
  selectedCharacter: string | null;
  onSelect: (characterName: string) => void;
  onStart: () => void;
}

const CharacterSelection: React.FC<CharacterSelectionProps> = ({
  characters,
  selectedCharacter,
  onSelect,
  onStart
}) => {
  return (
    <div className="character-selection p-4">
      <h2 className="text-2xl font-bold mb-4">Choose Your Character</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {characters.map(character => (
          <div 
            key={character.name}
            className={`character-card p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedCharacter === character.name 
                ? 'border-blue-500 bg-blue-50 transform scale-105' 
                : 'border-gray-300 hover:border-blue-300'
            }`}
            onClick={() => onSelect(character.name)}
          >
            <h3 className="font-bold text-lg">{character.name}</h3>
            <p className="text-sm text-gray-600">{character.description}</p>
            <div className="mt-2">
              <p className="text-xs">Starting Weapon: {character.startingWeapon}</p>
              <p className="text-xs">
                Starting Items: {character.startingItems.length > 0 
                  ? character.startingItems.join(', ') 
                  : 'None'}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 flex justify-center">
        <button
          className={`px-6 py-3 rounded-lg font-bold ${
            selectedCharacter 
              ? 'bg-green-500 hover:bg-green-600 text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={onStart}
          disabled={!selectedCharacter}
        >
          Start Game
        </button>
      </div>
    </div>
  );
};

export default CharacterSelection; 