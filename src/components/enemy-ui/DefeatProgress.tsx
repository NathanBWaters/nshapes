/**
 * DefeatProgress Component
 * Shows progress toward the enemy's defeat condition.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from '../Icon';
import type { EnemyInstance, RoundStats } from '@/types/enemy';

interface DefeatProgressProps {
  /** The active enemy instance */
  enemy: EnemyInstance;
  /** Current round statistics */
  stats: RoundStats;
}

/**
 * Parse defeat condition text to extract numerical requirements.
 * Returns current progress and goal if parseable.
 */
const parseDefeatProgress = (
  enemy: EnemyInstance,
  stats: RoundStats
): { current: number; goal: number; label: string } | null => {
  const text = enemy.defeatConditionText.toLowerCase();

  // Match patterns like "Get a 4-match streak"
  const streakMatch = text.match(/(\d+)[- ]match streak/);
  if (streakMatch) {
    return {
      current: stats.maxStreak,
      goal: parseInt(streakMatch[1], 10),
      label: 'Streak',
    };
  }

  // Match patterns like "Complete 5 matches"
  const matchCountMatch = text.match(/(?:complete|match|get)\s*(\d+)\s*(?:matches|times)/);
  if (matchCountMatch) {
    return {
      current: stats.totalMatches,
      goal: parseInt(matchCountMatch[1], 10),
      label: 'Matches',
    };
  }

  // Match patterns like "Match 4 face-down cards"
  const faceDownMatch = text.match(/match\s*(\d+)\s*face-down/);
  if (faceDownMatch) {
    return {
      current: stats.faceDownCardsMatched,
      goal: parseInt(faceDownMatch[1], 10),
      label: 'Face-down',
    };
  }

  // Match patterns like "Defuse 3 bombs"
  const bombMatch = text.match(/defuse\s*(\d+)\s*bombs?/);
  if (bombMatch) {
    return {
      current: stats.bombsDefused,
      goal: parseInt(bombMatch[1], 10),
      label: 'Bombs',
    };
  }

  // Match patterns like "Get 2 all-different matches"
  const allDiffMatch = text.match(/(\d+)\s*all-different/);
  if (allDiffMatch) {
    return {
      current: stats.allDifferentMatches,
      goal: parseInt(allDiffMatch[1], 10),
      label: 'All-diff',
    };
  }

  // Match patterns like "Match all 3 shapes"
  const allShapesMatch = text.match(/all\s*3\s*shapes/);
  if (allShapesMatch) {
    return {
      current: stats.shapesMatched.size,
      goal: 3,
      label: 'Shapes',
    };
  }

  // Match patterns like "Match all 3 colors"
  const allColorsMatch = text.match(/all\s*3\s*colors/);
  if (allColorsMatch) {
    return {
      current: stats.colorsMatched.size,
      goal: 3,
      label: 'Colors',
    };
  }

  // For "Make no invalid matches" - show invalid count (goal is 0)
  if (text.includes('no invalid')) {
    return {
      current: Math.max(0, 1 - stats.invalidMatches), // 1 if no invalids, 0 otherwise
      goal: 1,
      label: 'Perfect',
    };
  }

  // Default: can't parse, return null
  return null;
};

const DefeatProgress: React.FC<DefeatProgressProps> = ({ enemy, stats }) => {
  const progress = parseDefeatProgress(enemy, stats);
  const isDefeated = enemy.checkDefeatCondition(stats);

  if (isDefeated) {
    return (
      <View style={[styles.container, styles.containerDefeated]}>
        <Icon name="lorc/flat-star" size={14} color={COLORS.logicTeal} />
        <Text style={styles.defeatedText}>Defeated!</Text>
      </View>
    );
  }

  if (!progress) {
    // Can't show progress bar, just show condition text
    return (
      <View style={styles.container}>
        <Icon name="lorc/archery-target" size={14} color={COLORS.slateCharcoal} />
        <Text style={styles.conditionText} numberOfLines={1}>
          {enemy.defeatConditionText}
        </Text>
      </View>
    );
  }

  const fillPercent = Math.min(100, (progress.current / progress.goal) * 100);

  return (
    <View style={styles.container}>
      <Icon name="lorc/archery-target" size={14} color={COLORS.slateCharcoal} />
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${fillPercent}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {progress.label}: {progress.current}/{progress.goal}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  containerDefeated: {
    backgroundColor: 'rgba(22, 170, 152, 0.2)',
    borderColor: COLORS.logicTeal,
  },
  defeatedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.logicTeal,
  },
  conditionText: {
    fontSize: 11,
    color: COLORS.slateCharcoal,
    maxWidth: 150,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.actionYellow,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.slateCharcoal,
    minWidth: 60,
  },
});

export default DefeatProgress;
