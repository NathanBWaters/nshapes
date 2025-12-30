import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { PlayerStats } from '@/types';
import CircularTimer from './CircularTimer';
import { COLORS, RADIUS } from '@/utils/colors';

interface GameInfoProps {
  round: number;
  score: number;
  targetScore: number;
  time: number;
  totalTime: number;
  playerStats: PlayerStats;
  selectedCount: number;
  onHintPress?: () => void;
  onClearHint?: () => void;
  hasActiveHint?: boolean;
}

// Calculate XP thresholds for level progression
const getXPForLevel = (level: number): number => {
  return level * level * 10; // Level 1 = 10, Level 2 = 40, Level 3 = 90, etc.
};

// Group stats into categories for cleaner display
const statCategories = {
  "Character": [
    'level', 'experienceGainPercent', 'luck',
    'maxWeapons', 'holographicPercent'
  ],
  "Resources": [
    'money', 'commerce', 'scavengingPercent',
    'scavengeAmount', 'freeRerolls'
  ],
  "Offensive": [
    'damage', 'damagePercent', 'criticalChance',
    'chanceOfFire', 'explosion', 'timeFreezePercent'
  ],
  "Defensive": [
    'health', 'maxHealth', 'dodgePercent',
    'deflectPercent', 'dodgeAttackBackPercent'
  ],
  "Gameplay": [
    'fieldSize', 'timeWarpPercent', 'maxTimeIncrease',
    'matchHints', 'matchPossibilityHints', 'matchIntervalHintPercent',
    'mulligans'
  ]
};

// Format stat for display
const formatStat = (key: string, value: number | string) => {
  if (typeof value !== 'number') return value;
  if (key.toLowerCase().includes('percent')) {
    return `${value}%`;
  }
  return value;
};

// Format a key from camelCase to Title Case with spaces
const formatKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
};

const GameInfo: React.FC<GameInfoProps> = ({
  round,
  score,
  targetScore,
  time,
  totalTime,
  playerStats,
  selectedCount,
  onHintPress,
  onClearHint,
  hasActiveHint = false,
}) => {
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  // Calculate score progress percentage
  const scoreProgress = Math.min((score / targetScore) * 100, 100);

  // Calculate XP progress to next level
  const currentLevelXP = getXPForLevel(playerStats.level);
  const nextLevelXP = getXPForLevel(playerStats.level + 1);
  const xpInCurrentLevel = playerStats.experience - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
  const xpProgress = Math.min((xpInCurrentLevel / xpNeededForNextLevel) * 100, 100);

  const hintsAvailable = playerStats.hints ?? 0;

  return (
    <>
      <View style={styles.container}>
        {/* Top row: All stats */}
        <View style={styles.statsRow}>
          {/* Left section - gameplay stats */}
          <View style={styles.leftSection}>
            {/* Round */}
            <View style={styles.statBadge}>
              <Text style={styles.statLabel}>R{round}</Text>
            </View>

            {/* Health */}
            <View style={styles.statItem}>
              <Text style={styles.heartIcon}>♥</Text>
              <Text style={[styles.statValue, playerStats.health <= 1 && styles.criticalValue]}>
                {playerStats.health}/{playerStats.maxHealth}
              </Text>
            </View>

            {/* Money */}
            <View style={styles.statItem}>
              <Text style={styles.coinIcon}>$</Text>
              <Text style={styles.statValue}>{playerStats.money}</Text>
            </View>

            {/* Level + XP Progress */}
            <View style={styles.levelContainer}>
              <Text style={styles.levelText}>Lv{playerStats.level}</Text>
              <View style={styles.xpBarContainer}>
                <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
              </View>
            </View>

            {/* Hints */}
            <TouchableOpacity
              style={[
                styles.hintButton,
                hintsAvailable > 0 ? styles.hintButtonEnabled : styles.hintButtonDisabled,
                hasActiveHint && styles.hintButtonActive,
              ]}
              onPress={hasActiveHint ? onClearHint : onHintPress}
              disabled={hintsAvailable <= 0 && !hasActiveHint}
            >
              <Text style={styles.hintIcon}>?</Text>
              <Text style={[
                styles.hintCount,
                hintsAvailable > 0 ? styles.hintCountEnabled : styles.hintCountDisabled
              ]}>
                {hasActiveHint ? 'x' : hintsAvailable}
              </Text>
            </TouchableOpacity>

            {/* Selected count */}
            <View style={[styles.selectedBadge, selectedCount === 3 && styles.selectedBadgeFull]}>
              <Text style={styles.selectedText}>{selectedCount}/3</Text>
            </View>

            {/* Timer */}
            <CircularTimer
              currentTime={time}
              totalTime={totalTime}
              size={40}
              strokeWidth={3}
            />
          </View>

          {/* Right section - Stats button */}
          <TouchableOpacity
            style={styles.statsButton}
            onPress={() => setIsStatsModalOpen(true)}
          >
            <Text style={styles.statsButtonText}>STATS</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom row: Score progress bar */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreBarContainer}>
            <View
              style={[
                styles.scoreBarFill,
                { width: `${scoreProgress}%` },
                scoreProgress >= 100 && styles.scoreBarComplete,
              ]}
            />
          </View>
          <Text style={styles.scoreText}>{score}/{targetScore}</Text>
        </View>
      </View>

      {/* Stats Modal */}
      <Modal
        visible={isStatsModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsStatsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Character Stats</Text>
              <TouchableOpacity onPress={() => setIsStatsModalOpen(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {Object.entries(statCategories).map(([category, statKeys]) => (
                <View key={category} style={styles.categoryContainer}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
                  </View>
                  <View style={styles.statsGrid}>
                    {statKeys.map(key => (
                      <View key={key} style={styles.statRowModal}>
                        <Text style={styles.statKey}>{formatKey(key)}</Text>
                        <Text style={styles.statValueModal}>
                          {formatStat(key, playerStats[key as keyof PlayerStats] || 0)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity onPress={() => setIsStatsModalOpen(false)} style={styles.closeModalButton}>
              <Text style={styles.closeModalButtonText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 4,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statsButton: {
    backgroundColor: COLORS.actionYellow,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginLeft: 8,
  },
  statsButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  statBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  statLabel: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  heartIcon: {
    color: COLORS.impactRed,
    fontSize: 12,
  },
  coinIcon: {
    color: COLORS.actionYellow,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  criticalValue: {
    color: COLORS.impactRed,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  levelText: {
    color: COLORS.logicTeal,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  xpBarContainer: {
    width: 32,
    height: 6,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
    borderRadius: 3,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  hintButtonEnabled: {
    backgroundColor: COLORS.actionYellow,
  },
  hintButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
  },
  hintButtonActive: {
    backgroundColor: COLORS.impactOrange,
  },
  hintIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  hintCount: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  hintCountEnabled: {
    color: COLORS.slateCharcoal,
  },
  hintCountDisabled: {
    color: COLORS.slateCharcoal,
    opacity: 0.5,
  },
  selectedBadge: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.deepOnyx,
  },
  selectedBadgeFull: {
    backgroundColor: COLORS.logicTeal,
  },
  selectedText: {
    color: COLORS.canvasWhite,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  scoreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: COLORS.logicTeal,
    borderRadius: RADIUS.button,
  },
  scoreBarComplete: {
    backgroundColor: COLORS.actionYellow,
  },
  scoreText: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  modalTitle: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.deepOnyx,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  modalContent: {
    padding: 16,
  },
  categoryContainer: {
    marginBottom: 16,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    overflow: 'hidden',
  },
  categoryHeader: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryTitle: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  statsGrid: {
    padding: 12,
    gap: 8,
  },
  statRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statKey: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 13,
  },
  statValueModal: {
    color: COLORS.logicTeal,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  closeModalButton: {
    backgroundColor: COLORS.actionYellow,
    margin: 16,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
});

export default GameInfo;
