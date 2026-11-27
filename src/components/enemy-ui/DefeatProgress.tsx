import { MONO_FONT } from '@/utils/fonts';
/**
 * DefeatProgress Component
 * Shows progress toward the enemy's defeat condition.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, RADIUS } from '@/utils/colors';
import { EASE, MS, SCALE, SPRING, STAYS } from '@/utils/motion';
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
  const reducedMotion = Boolean(useReducedMotion());

  const targetRatio = progress
    ? Math.max(0, Math.min(1, progress.current / Math.max(1, progress.goal)))
    : 0;

  const trackWidthSV = useSharedValue(0);
  const fillRatio = useSharedValue(targetRatio);
  const badgeScale = useSharedValue(1);
  const prevCurrentRef = useRef<number | null>(progress ? progress.current : null);
  const prevDefeatedRef = useRef(isDefeated);

  useEffect(() => {
    fillRatio.value = withTiming(targetRatio, {
      duration: MS.move,
      easing: EASE.enter,
      ...STAYS,
    });
  }, [targetRatio, fillRatio]);

  useEffect(() => {
    const nextCurrent = progress ? progress.current : null;
    if (nextCurrent !== null && prevCurrentRef.current !== null && nextCurrent > prevCurrentRef.current) {
      if (!reducedMotion) {
        badgeScale.value = withSequence(
          withTiming(SCALE.pop, { duration: Math.round(MS.feedback * 0.5), easing: EASE.popSoft }),
          withSpring(1, SPRING.snappy)
        );
      }
    }
    prevCurrentRef.current = nextCurrent;
  }, [progress, badgeScale, reducedMotion]);

  useEffect(() => {
    if (isDefeated && !prevDefeatedRef.current) {
      if (!reducedMotion) {
        badgeScale.value = 0.9;
        badgeScale.value = withSpring(1, SPRING.playful);
      }
    }
    prevDefeatedRef.current = isDefeated;
  }, [isDefeated, badgeScale, reducedMotion]);

  useEffect(() => {
    return () => {
      cancelAnimation(fillRatio);
      cancelAnimation(badgeScale);
    };
  }, [fillRatio, badgeScale]);

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    trackWidthSV.value = event.nativeEvent.layout.width;
  };

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const fillAnimStyle = useAnimatedStyle(() => {
    const w = trackWidthSV.value;
    const r = Math.max(0, Math.min(1, fillRatio.value));
    return {
      transform: w > 0 ? [{ translateX: -w * (1 - r) * 0.5 }, { scaleX: r }] : [{ scaleX: r }],
    };
  });

  if (isDefeated) {
    return (
      <Animated.View style={[styles.container, styles.containerDefeated, containerAnimStyle]}>
        <Icon name="lorc/flat-star" size={14} color={COLORS.logicTeal} />
        <Text style={styles.defeatedText}>Defeated!</Text>
      </Animated.View>
    );
  }

  if (!progress) {
    // Can't show progress bar, just show condition text
    return (
      <Animated.View style={[styles.container, containerAnimStyle]}>
        <Icon name="lorc/archery-target" size={14} color={COLORS.slateCharcoal} />
        <Text style={styles.conditionText} numberOfLines={1}>
          {enemy.defeatConditionText}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, containerAnimStyle]}>
      <Icon name="lorc/archery-target" size={14} color={COLORS.slateCharcoal} />
      <View style={styles.progressContainer}>
        <View style={styles.progressBar} onLayout={handleTrackLayout}>
          <Animated.View style={[styles.progressFill, fillAnimStyle]} />
        </View>
        <Text style={styles.progressText}>
          {progress.label}: {progress.current}/{progress.goal}
        </Text>
      </View>
    </Animated.View>
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
    borderBottomWidth: 2,
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
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.actionYellow,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
    color: COLORS.slateCharcoal,
    minWidth: 64,
  },
});

export default DefeatProgress;
