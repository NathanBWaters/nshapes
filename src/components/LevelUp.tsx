import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { PlayerStats, Weapon } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';

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
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);

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

  // Format key from camelCase to Title Case
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

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
          Level Up!
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
          Choose Your Upgrade
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
          Select one upgrade to improve your character
        </Text>

        {/* Option Cards */}
        <View style={{ gap: 16 }}>
          {options.map((option, index) => {
            const isHovered = hoveredOption === index;
            const weapon = isWeapon(option);

            return (
              <Pressable
                key={`option-${index}`}
                onPress={() => onSelect(index)}
                onHoverIn={() => setHoveredOption(index)}
                onHoverOut={() => setHoveredOption(null)}
                style={{
                  backgroundColor: COLORS.canvasWhite,
                  borderRadius: RADIUS.module,
                  borderWidth: 1,
                  borderColor: COLORS.slateCharcoal,
                  padding: 16,
                  transform: [{ scale: isHovered ? 1.01 : 1 }],
                  shadowColor: COLORS.deepOnyx,
                  shadowOffset: { width: 0, height: isHovered ? 4 : 2 },
                  shadowOpacity: isHovered ? 0.15 : 0.08,
                  shadowRadius: isHovered ? 8 : 4,
                  elevation: isHovered ? 4 : 2,
                }}
              >
                {weapon ? (
                  // Weapon Option
                  <>
                    {/* Weapon Preview Area */}
                    <View
                      style={{
                        backgroundColor: COLORS.paperBeige,
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: COLORS.slateCharcoal,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
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
                        Weapon
                      </Text>
                      <View
                        style={{
                          backgroundColor: COLORS.impactOrange,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: RADIUS.button,
                          borderWidth: 1,
                          borderColor: COLORS.slateCharcoal,
                        }}
                      >
                        <Text
                          style={{
                            color: COLORS.canvasWhite,
                            fontWeight: '700',
                            fontSize: 10,
                          }}
                        >
                          LV {option.level}
                        </Text>
                      </View>
                    </View>

                    {/* Weapon Name */}
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '700',
                        fontSize: 18,
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      {option.name}
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
                      {option.description}
                    </Text>

                    {/* Effects */}
                    <View
                      style={{
                        backgroundColor: COLORS.paperBeige,
                        borderRadius: 8,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: COLORS.slateCharcoal,
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: COLORS.impactOrange,
                          fontWeight: '600',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 6,
                        }}
                      >
                        Effects
                      </Text>
                      {Object.entries(option.effects).map(([key, value]) => (
                        <Text
                          key={key}
                          style={{
                            color: COLORS.slateCharcoal,
                            fontWeight: '400',
                            fontSize: 12,
                            fontFamily: 'monospace',
                          }}
                        >
                          {formatKey(key)}: {formatStatValue(value)}
                        </Text>
                      ))}
                    </View>
                  </>
                ) : (
                  // Stat Upgrade Option
                  <>
                    {/* Stat Preview Area */}
                    <View
                      style={{
                        backgroundColor: COLORS.paperBeige,
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: COLORS.slateCharcoal,
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
                        Stat Upgrade
                      </Text>
                    </View>

                    {/* Stats */}
                    <View
                      style={{
                        backgroundColor: COLORS.paperBeige,
                        borderRadius: 8,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: COLORS.slateCharcoal,
                        marginBottom: 12,
                      }}
                    >
                      {Object.entries(option).map(([key, value]) => (
                        <View
                          key={key}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              color: COLORS.slateCharcoal,
                              fontWeight: '400',
                              fontSize: 13,
                            }}
                          >
                            {formatKey(key)}
                          </Text>
                          <Text
                            style={{
                              color: COLORS.logicTeal,
                              fontWeight: '700',
                              fontSize: 14,
                              fontFamily: 'monospace',
                            }}
                          >
                            {formatStatValue(value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* Select Button - Primary CTA */}
                <TouchableOpacity
                  onPress={() => onSelect(index)}
                  style={{
                    backgroundColor: COLORS.actionYellow,
                    borderWidth: 1,
                    borderColor: COLORS.slateCharcoal,
                    borderRadius: RADIUS.button,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.slateCharcoal,
                      fontWeight: '700',
                      fontSize: 14,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {weapon ? 'Select Weapon' : 'Select Upgrade'}
                  </Text>
                </TouchableOpacity>
              </Pressable>
            );
          })}
        </View>

        {/* Reroll Button - Secondary style */}
        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 40 }}>
          <TouchableOpacity
            onPress={onReroll}
            disabled={playerMoney < rerollCost && freeRerolls <= 0}
            style={{
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderColor: COLORS.slateCharcoal,
              borderRadius: RADIUS.button,
              paddingVertical: 14,
              paddingHorizontal: 32,
              opacity: (playerMoney >= rerollCost || freeRerolls > 0) ? 1 : 0.5,
            }}
          >
            <Text
              style={{
                color: COLORS.slateCharcoal,
                fontWeight: '700',
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {freeRerolls > 0
                ? `Reroll Options (${freeRerolls} Free)`
                : `Reroll Options ($${rerollCost})`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default LevelUp;
