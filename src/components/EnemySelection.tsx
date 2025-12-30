import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Enemy } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';

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
  const [hoveredEnemy, setHoveredEnemy] = useState<string | null>(null);

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
          Round {round} - Enemy Selection
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
          Choose Your Enemy
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
          Select an enemy to face this round. Each enemy has unique effects and rewards.
        </Text>

        {/* Enemy Cards */}
        <View style={{ gap: 16 }}>
          {enemies.map(enemy => {
            const isHovered = hoveredEnemy === enemy.name;

            return (
              <Pressable
                key={enemy.name}
                onHoverIn={() => setHoveredEnemy(enemy.name)}
                onHoverOut={() => setHoveredEnemy(null)}
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
                {/* Enemy Preview Area - Data Module style */}
                <View
                  style={{
                    backgroundColor: COLORS.paperBeige,
                    height: 60,
                    borderRadius: 8,
                    marginBottom: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: COLORS.slateCharcoal,
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
                    {enemy.name}
                  </Text>
                </View>

                {/* Enemy Name Header */}
                <Text
                  style={{
                    color: COLORS.slateCharcoal,
                    fontWeight: '700',
                    fontSize: 18,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  {enemy.name}
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
                  {enemy.description}
                </Text>

                {/* Effect and Reward in a row */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {/* Effect Section */}
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: COLORS.paperBeige,
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: COLORS.slateCharcoal,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.impactOrange,
                        fontWeight: '600',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Effect
                    </Text>
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '400',
                        fontSize: 12,
                      }}
                    >
                      {enemy.effect}
                    </Text>
                  </View>

                  {/* Reward Section */}
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: COLORS.paperBeige,
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: COLORS.slateCharcoal,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.logicTeal,
                        fontWeight: '600',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Reward
                    </Text>
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '400',
                        fontSize: 12,
                      }}
                    >
                      {enemy.reward}
                    </Text>
                  </View>
                </View>

                {/* Fight Button - Primary CTA style */}
                <TouchableOpacity
                  onPress={() => onSelect(enemy)}
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
                    Fight This Enemy
                  </Text>
                </TouchableOpacity>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default EnemySelection;
