import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView } from 'react-native';
import { PlayerStats, Weapon } from '@/types';
import type { EnemyInstance } from '@/types/enemy';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';
import GameMenu from './GameMenu';

// Tier colors for visual distinction
const TIER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: COLORS.logicTeal,
  2: COLORS.actionYellow,
  3: COLORS.impactOrange,
  4: COLORS.impactRed,
};

// Tier labels
const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Boss',
};

interface EnemySelectionProps {
  enemies: EnemyInstance[];
  onSelect: (enemy: EnemyInstance) => void;
  round: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onExitGame?: () => void;
}

const EnemySelection: React.FC<EnemySelectionProps> = ({
  enemies,
  onSelect,
  round,
  playerStats,
  playerWeapons = [],
  onExitGame
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Show hovered enemy if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;
  const focusedEnemy = enemies.length > 0 ? enemies[displayedIndex] : null;

  // Get tier color for focused enemy
  const tierColor = focusedEnemy ? TIER_COLORS[focusedEnemy.tier] : COLORS.slateCharcoal;
  const tierLabel = focusedEnemy ? TIER_LABELS[focusedEnemy.tier] : '';

  return (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Round {round} - Choose Enemy</Text>
        <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} onExitGame={onExitGame} />
      </View>

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {focusedEnemy ? (
          <View style={styles.detailCard}>
            {/* Enemy Icon and Tier Badge */}
            <View style={styles.previewArea}>
              <Icon name={focusedEnemy.icon} size={64} color={COLORS.slateCharcoal} />
              <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
                <Text style={styles.tierBadgeText}>Tier {focusedEnemy.tier}</Text>
              </View>
            </View>

            {/* Enemy Name */}
            <Text style={styles.detailName}>{focusedEnemy.name}</Text>
            <Text style={[styles.tierLabel, { color: tierColor }]}>{tierLabel}</Text>

            {/* Effect & Defeat Condition */}
            <ScrollView style={styles.infoScrollArea} showsVerticalScrollIndicator={false}>
              <View style={[styles.infoBox, styles.infoBoxEffect]}>
                <Text style={styles.infoLabelEffect}>Enemy Effects</Text>
                <Text style={styles.infoText}>{focusedEnemy.description}</Text>
              </View>
              <View style={[styles.infoBox, styles.infoBoxDefeat]}>
                <Text style={styles.infoLabelDefeat}>Defeat Condition</Text>
                <Text style={styles.infoText}>{focusedEnemy.defeatConditionText}</Text>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>No enemies available</Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <Text style={styles.optionsHeader}>Select Your Opponent</Text>
        <View style={styles.optionsGrid}>
          {enemies.map((enemy, index) => {
            const isFocused = focusedIndex === index;
            const enemyTierColor = TIER_COLORS[enemy.tier];

            return (
              <Pressable
                key={enemy.name}
                onPress={() => setFocusedIndex(index)}
                onHoverIn={() => setHoveredIndex(index)}
                onHoverOut={() => setHoveredIndex(null)}
                style={[
                  styles.optionButton,
                  isFocused && styles.optionButtonSelected,
                  { borderColor: isFocused ? enemyTierColor : COLORS.slateCharcoal },
                ]}
              >
                <View style={[styles.optionTierDot, { backgroundColor: enemyTierColor }]} />
                <Icon
                  name={enemy.icon}
                  size={36}
                  color={COLORS.slateCharcoal}
                  style={styles.optionIcon}
                />
                <Text
                  style={[
                    styles.optionText,
                    isFocused && styles.optionTextSelected,
                  ]}
                  numberOfLines={2}
                >
                  {enemy.name}
                </Text>
                <Text style={styles.optionTier}>Tier {enemy.tier}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          onPress={() => focusedEnemy && onSelect(focusedEnemy)}
          disabled={!focusedEnemy}
          style={[
            styles.actionButton,
            !focusedEnemy && styles.actionButtonDisabled,
            focusedEnemy && { backgroundColor: tierColor },
          ]}
        >
          <Text style={styles.actionButtonText}>Fight {focusedEnemy?.name || 'Enemy'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 40,
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  // Top Half - Detail Section
  detailSection: {
    flex: 1,
    padding: 16,
  },
  detailCard: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 16,
  },
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tierBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tierBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailName: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 22,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  tierLabel: {
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoScrollArea: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  infoBoxEffect: {
    borderColor: COLORS.impactOrange,
  },
  infoBoxDefeat: {
    borderColor: COLORS.logicTeal,
  },
  infoLabelEffect: {
    color: COLORS.impactOrange,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoLabelDefeat: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyDetail: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    opacity: 0.6,
  },
  // Bottom Half - Options Section
  optionsSection: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  optionsHeader: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  optionsGrid: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    position: 'relative',
  },
  optionTierDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionIcon: {
    marginBottom: 4,
  },
  optionButtonSelected: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
  },
  optionText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '700',
  },
  optionTier: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 10,
    opacity: 0.7,
  },
  // Action Section
  actionSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  actionButton: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
    opacity: 0.6,
  },
  actionButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default EnemySelection;
