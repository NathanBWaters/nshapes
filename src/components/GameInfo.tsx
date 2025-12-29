import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PlayerStats } from '@/types';
import CircularTimer from './CircularTimer';

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
    <View style={styles.container}>
      {/* Top row: All stats */}
      <View style={styles.statsRow}>
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
          <Text style={styles.hintIcon}>💡</Text>
          <Text style={[
            styles.hintCount,
            hintsAvailable > 0 ? styles.hintCountEnabled : styles.hintCountDisabled
          ]}>
            {hasActiveHint ? '✕' : hintsAvailable}
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBadge: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  heartIcon: {
    color: '#ef4444',
    fontSize: 12,
  },
  coinIcon: {
    color: '#eab308',
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  criticalValue: {
    color: '#ef4444',
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  levelText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
  },
  xpBarContainer: {
    width: 32,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 3,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  hintButtonEnabled: {
    backgroundColor: '#fef3c7',
  },
  hintButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  hintButtonActive: {
    backgroundColor: '#fcd34d',
  },
  hintIcon: {
    fontSize: 12,
  },
  hintCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  hintCountEnabled: {
    color: '#92400e',
  },
  hintCountDisabled: {
    color: '#9ca3af',
  },
  selectedBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectedBadgeFull: {
    backgroundColor: '#3b82f6',
  },
  selectedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  scoreBarComplete: {
    backgroundColor: '#22c55e',
  },
  scoreText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
});

export default GameInfo;
