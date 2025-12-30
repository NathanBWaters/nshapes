import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Character } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';

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
  const [hoveredCharacter, setHoveredCharacter] = useState<string | null>(null);

  const selectedChar = characters.find(c => c.name === selectedCharacter);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.paperBeige }}>
      {/* Eyebrow Banner */}
      <View
        style={{
          height: 40,
          backgroundColor: COLORS.actionYellow,
          justifyContent: 'center',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.slateCharcoal,
        }}
      >
        <Text
          style={{
            color: COLORS.deepOnyx,
            fontWeight: '700',
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          Character Selection
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Section Header */}
        <Text
          style={{
            color: COLORS.slateCharcoal,
            fontWeight: '700',
            fontSize: 24,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          Choose Your Character
        </Text>
        <Text
          style={{
            color: COLORS.slateCharcoal,
            fontWeight: '400',
            fontSize: 14,
            marginBottom: 20,
            opacity: 0.7,
          }}
        >
          Select a character to begin your run
        </Text>

        {/* Character Grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {characters.map(character => {
            const isSelected = selectedCharacter === character.name;
            const isHovered = hoveredCharacter === character.name;

            return (
              <Pressable
                key={character.name}
                onPress={() => onSelect(character.name)}
                onHoverIn={() => setHoveredCharacter(character.name)}
                onHoverOut={() => setHoveredCharacter(null)}
                style={{
                  width: '48%',
                  minWidth: 280,
                  maxWidth: 400,
                  backgroundColor: COLORS.canvasWhite,
                  borderRadius: RADIUS.module,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? COLORS.logicTeal : COLORS.slateCharcoal,
                  padding: 16,
                  transform: [{ scale: isHovered || isSelected ? 1.02 : 1 }],
                  shadowColor: COLORS.deepOnyx,
                  shadowOffset: { width: 0, height: isHovered ? 4 : 2 },
                  shadowOpacity: isHovered ? 0.15 : 0.08,
                  shadowRadius: isHovered ? 8 : 4,
                  elevation: isHovered ? 4 : 2,
                }}
              >
                {/* Character Preview Area */}
                <View
                  style={{
                    backgroundColor: COLORS.paperBeige,
                    height: 80,
                    borderRadius: 8,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: COLORS.slateCharcoal,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.slateCharcoal,
                      fontWeight: '700',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {character.name}
                  </Text>
                </View>

                {/* Character Name */}
                <Text
                  style={{
                    color: COLORS.slateCharcoal,
                    fontWeight: '700',
                    fontSize: 16,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  {character.name}
                </Text>

                {/* Description */}
                <Text
                  style={{
                    color: COLORS.slateCharcoal,
                    fontWeight: '400',
                    fontSize: 13,
                    lineHeight: 18,
                    marginBottom: 12,
                    opacity: 0.8,
                  }}
                >
                  {character.description}
                </Text>

                {/* Stats Section */}
                <View
                  style={{
                    backgroundColor: COLORS.paperBeige,
                    borderRadius: 8,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: COLORS.slateCharcoal,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '600',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        width: 100,
                      }}
                    >
                      Weapon:
                    </Text>
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '400',
                        fontSize: 12,
                        fontFamily: 'monospace',
                      }}
                    >
                      {character.startingWeapon}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '600',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        width: 100,
                      }}
                    >
                      Items:
                    </Text>
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '400',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        flex: 1,
                      }}
                    >
                      {character.startingItems.length > 0
                        ? character.startingItems.join(', ')
                        : 'None'}
                    </Text>
                  </View>
                </View>

                {/* Selected Indicator */}
                {isSelected && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: COLORS.logicTeal,
                      borderRadius: RADIUS.module,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.canvasWhite,
                        fontWeight: '700',
                        fontSize: 10,
                        textTransform: 'uppercase',
                      }}
                    >
                      Selected
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Selected Character Summary */}
        {selectedChar && (
          <View
            style={{
              marginTop: 24,
              backgroundColor: COLORS.deepOnyx,
              borderRadius: 12,
              padding: 16,
              borderWidth: 2,
              borderTopWidth: 4,
              borderColor: COLORS.slateCharcoal,
            }}
          >
            <Text
              style={{
                color: COLORS.canvasWhite,
                fontWeight: '700',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
                fontFamily: 'monospace',
              }}
            >
              // Selected Character
            </Text>
            <Text
              style={{
                color: COLORS.actionYellow,
                fontWeight: '700',
                fontSize: 20,
                textTransform: 'uppercase',
              }}
            >
              {selectedChar.name}
            </Text>
            <Text
              style={{
                color: COLORS.canvasWhite,
                fontWeight: '400',
                fontSize: 14,
                marginTop: 4,
                opacity: 0.9,
              }}
            >
              {selectedChar.description}
            </Text>
          </View>
        )}

        {/* Start Game Button */}
        <View style={{ marginTop: 24, marginBottom: 40, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={onStart}
            disabled={!selectedCharacter}
            style={{
              backgroundColor: selectedCharacter ? COLORS.actionYellow : COLORS.paperBeige,
              borderWidth: selectedCharacter ? 1 : 2,
              borderColor: COLORS.slateCharcoal,
              borderRadius: RADIUS.button,
              paddingHorizontal: 32,
              paddingVertical: 14,
              minWidth: 200,
              alignItems: 'center',
              opacity: selectedCharacter ? 1 : 0.5,
              shadowColor: COLORS.deepOnyx,
              shadowOffset: { width: 2, height: 2 },
              shadowOpacity: selectedCharacter ? 0.2 : 0,
              shadowRadius: 0,
              elevation: selectedCharacter ? 2 : 0,
            }}
          >
            <Text
              style={{
                color: selectedCharacter ? COLORS.slateCharcoal : COLORS.slateCharcoal,
                fontWeight: '700',
                fontSize: 16,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Start Game
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default CharacterSelection;
