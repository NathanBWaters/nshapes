import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Enemy, PlayerStats, Weapon } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';
import GameMenu from './GameMenu';

interface EnemySelectionProps {
  enemies: Enemy[];
  onSelect: (enemy: Enemy) => void;
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
            {/* Enemy Icon */}
            <View style={styles.previewArea}>
              {focusedEnemy.icon ? (
                <Icon name={focusedEnemy.icon} size={48} color={COLORS.slateCharcoal} />
              ) : (
                <Text style={styles.previewLabel}>{focusedEnemy.name}</Text>
              )}
            </View>

            {/* Enemy Info */}
            <Text style={styles.detailName}>{focusedEnemy.name}</Text>
            <Text style={styles.detailDescription}>{focusedEnemy.description}</Text>

            {/* Effect & Reward */}
            <View style={styles.infoRow}>
              <View style={[styles.infoBox, styles.infoBoxEffect]}>
                <Text style={styles.infoLabelEffect}>Effect</Text>
                <Text style={styles.infoText}>{focusedEnemy.effect}</Text>
              </View>
              <View style={[styles.infoBox, styles.infoBoxReward]}>
                <Text style={styles.infoLabelReward}>Reward</Text>
                <Text style={styles.infoText}>{focusedEnemy.reward}</Text>
              </View>
            </View>
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

            return (
              <Pressable
                key={enemy.name}
                onPress={() => setFocusedIndex(index)}
                onHoverIn={() => setHoveredIndex(index)}
                onHoverOut={() => setHoveredIndex(null)}
                style={[
                  styles.optionButton,
                  isFocused && styles.optionButtonSelected,
                ]}
              >
                {enemy.icon && (
                  <Icon
                    name={enemy.icon}
                    size={32}
                    color={COLORS.slateCharcoal}
                    style={styles.optionIcon}
                  />
                )}
                <Text
                  style={[
                    styles.optionText,
                    isFocused && styles.optionTextSelected,
                  ]}
                  numberOfLines={2}
                >
                  {enemy.name}
                </Text>
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
          ]}
        >
          <Text style={styles.actionButtonText}>Fight</Text>
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
    height: 60,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailName: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 20,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailDescription: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    opacity: 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoBox: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  infoBoxEffect: {
    borderColor: COLORS.impactOrange,
  },
  infoBoxReward: {
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
  infoLabelReward: {
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
    fontSize: 12,
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
  },
  optionIcon: {
    marginBottom: 2,
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
