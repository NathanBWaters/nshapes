import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

const Tutorial: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View className="mt-4">
      <Pressable onPress={() => setIsOpen(!isOpen)}>
        <Text className="text-blue-500 underline">
          {isOpen ? 'Hide Rules' : 'Show Rules'}
        </Text>
      </Pressable>

      {isOpen && (
        <ScrollView className="mt-4 p-6 bg-white rounded-lg shadow-lg">
          <Text className="text-2xl font-bold mb-4">How to Play NShapes</Text>

          <Text className="text-xl font-semibold mb-2">Card Attributes</Text>
          <Text className="mb-4">Each card has four attributes:</Text>
          <View className="pl-6 mb-4">
            <Text className="mb-1">• Shape: Oval, Square, or Diamond</Text>
            <Text className="mb-1">• Color: Red, Green, or Purple</Text>
            <Text className="mb-1">• Number: One, Two, or Three shapes</Text>
            <Text className="mb-1">• Shading: Solid, Striped, or Open</Text>
          </View>

          <Text className="text-xl font-semibold mb-2">What Makes a Valid Combination?</Text>
          <Text className="mb-2">
            A valid combination consists of three cards where each attribute is either all the same OR all different.
          </Text>
          <Text className="mb-4">
            For example, if two cards have the same shape and the third has a different shape, that's not a valid combination.
            All three shapes must be the same, or all three must be different.
          </Text>

          <Text className="text-xl font-semibold mb-2">Examples of Valid Combinations</Text>
          <View className="pl-6 mb-4">
            <Text className="mb-1">• 3 red cards with different shapes, numbers, and shadings</Text>
            <Text className="mb-1">• 3 cards with the same shape, same number, same shading, but different colors</Text>
            <Text className="mb-1">• 3 cards where every attribute (shape, color, number, and shading) is different</Text>
          </View>

          <Text className="text-xl font-semibold mb-2">Game Play</Text>
          <View className="pl-6 mb-4">
            <Text className="mb-1">1. Click on three cards you believe form a valid combination</Text>
            <Text className="mb-1">2. If correct, the cards will be removed and replaced</Text>
            <Text className="mb-1">3. If no valid combinations exist in the visible cards, use "Add Cards" to add more</Text>
            <Text className="mb-1">4. If you're stuck, use a "Hint" to highlight a valid combination</Text>
          </View>

          <Text className="text-xl font-semibold mb-2">Scoring</Text>
          <Text className="mb-4">
            +1 point for each valid combination found. The game ends when no more valid combinations can be found or the deck is exhausted.
          </Text>

          <Pressable
            className="px-4 py-2 bg-blue-500 rounded"
            onPress={() => setIsOpen(false)}
          >
            <Text className="text-white text-center">Got it!</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
};

export default Tutorial;
