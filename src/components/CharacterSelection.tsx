import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Character } from '@/types';

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
    <ScrollView style={{ flex: 1 }} className="p-4">
      <Text className="text-2xl font-bold mb-4">Choose Your Character</Text>

      <View className="flex-row flex-wrap gap-4">
        {characters.map(character => (
          <TouchableOpacity
            key={character.name}
            className={`p-4 border-2 rounded-lg w-[45%] ${
              selectedCharacter === character.name
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300'
            }`}
            onPress={() => onSelect(character.name)}
          >
            <Text className="font-bold text-lg">{character.name}</Text>
            <Text className="text-sm text-gray-600">{character.description}</Text>
            <View className="mt-2">
              <Text className="text-xs">Starting Weapon: {character.startingWeapon}</Text>
              <Text className="text-xs">
                Starting Items: {character.startingItems.length > 0
                  ? character.startingItems.join(', ')
                  : 'None'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View className="mt-6 items-center">
        <TouchableOpacity
          className={`px-6 py-3 rounded-lg ${
            selectedCharacter
              ? 'bg-green-500'
              : 'bg-gray-300'
          }`}
          onPress={onStart}
          disabled={!selectedCharacter}
        >
          <Text className={`font-bold ${selectedCharacter ? 'text-white' : 'text-gray-500'}`}>
            Start Game
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default CharacterSelection;
