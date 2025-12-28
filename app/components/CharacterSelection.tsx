import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
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
    <View className="flex-1">
      <Text className="text-2xl font-bold text-center mb-4 text-gray-900">Select Your Character</Text>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap justify-center gap-3 pb-4">
          {characters.map((character) => (
            <Pressable
              key={character.name}
              className={`w-40 p-4 rounded-lg border-2 ${
                selectedCharacter === character.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
              onPress={() => onSelect(character.name)}
            >
              <Text className="text-lg font-bold text-gray-900 mb-1">{character.name}</Text>
              <Text className="text-sm text-gray-600 mb-2">{character.description}</Text>
              <View className="border-t border-gray-200 pt-2">
                <Text className="text-xs text-gray-500">Starting Weapon:</Text>
                <Text className="text-sm font-medium text-gray-700">{character.startingWeapon}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View className="mt-4 items-center">
        <Pressable
          className={`px-8 py-4 rounded-lg ${
            selectedCharacter
              ? 'bg-blue-500'
              : 'bg-gray-300'
          }`}
          onPress={onStart}
          disabled={!selectedCharacter}
        >
          <Text className={`text-lg font-bold ${selectedCharacter ? 'text-white' : 'text-gray-500'}`}>
            Start Game
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default CharacterSelection;
