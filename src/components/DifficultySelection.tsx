import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../theme';
import { DURATIONS } from '../theme/animations';
import { haptics } from '../utils/haptics';
import { PlayerStats } from '@/types';
import { FreePlayDifficulty } from './CharacterSelection';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import Icon from './Icon';
import GameMenu from './GameMenu';
import { Button } from './ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DifficultySelectionProps {
  onStart: (difficulty: FreePlayDifficulty) => void;
  onExitGame?: () => void;
}

// Difficulty labels and descriptions
const DIFFICULTY_INFO: Record<FreePlayDifficulty, { label: string; description: string; icon: string }> = {
  easy: { label: 'Easy', description: '2 attributes', icon: 'lorc/feather' },
  medium: { label: 'Medium', description: '3 attributes', icon: 'lorc/flat-star' },
  hard: { label: 'Hard', description: '4 attributes', icon: 'lorc/diamond-hard' },
  omega: { label: 'Omega', description: '5 attributes', icon: 'lorc/brain' },
};

// Animated difficulty card component
function DifficultyCard({
  difficulty,
  info,
  isSelected,
  onSelect,
}: {
  difficulty: FreePlayDifficulty;
  info: { label: string; description: string; icon: string };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: DURATIONS.press });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: DURATIONS.press });
  }, [pressed]);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS === 'web') {
      hovered.value = withTiming(1, { duration: DURATIONS.hover });
    }
  }, [hovered]);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') {
      hovered.value = withTiming(0, { duration: DURATIONS.hover });
    }
  }, [hovered]);

  const handlePress = useCallback(() => {
    haptics.selection();
    onSelect();
  }, [onSelect]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.96]);
    const translateY = interpolate(hovered.value, [0, 1], [0, -4]);

    return {
      transform: [
        { scale },
        { translateY },
      ],
    };
  });

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      style={[
        styles.difficultyCard,
        isSelected && styles.difficultyCardSelected,
        animatedStyle,
        Platform.OS === 'web' && { cursor: 'pointer' as const },
      ]}
    >
      <View style={styles.difficultyIconContainer}>
        <Icon
          name={info.icon}
          size={40}
          color={isSelected ? COLORS.canvasWhite : COLORS.slateCharcoal}
        />
      </View>
      <Text
        style={[
          styles.difficultyLabel,
          isSelected && styles.difficultyLabelSelected,
        ]}
      >
        {info.label}
      </Text>
      <Text
        style={[
          styles.difficultyDescription,
          isSelected && styles.difficultyDescriptionSelected,
        ]}
      >
        {info.description}
      </Text>
    </AnimatedPressable>
  );
}

const DifficultySelection: React.FC<DifficultySelectionProps> = ({ onStart, onExitGame }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<FreePlayDifficulty>('medium');

  const handleStart = useCallback(() => {
    haptics.medium();
    onStart(selectedDifficulty);
  }, [onStart, selectedDifficulty]);

  return (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Free Play - Select Difficulty</Text>
        <GameMenu playerStats={DEFAULT_PLAYER_STATS as PlayerStats} onExitGame={onExitGame} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Choose Difficulty</Text>
          <Text style={styles.subtitle}>Select the number of attributes to match</Text>
        </View>

        {/* Difficulty Options */}
        <View style={styles.difficultyGrid}>
          {(['easy', 'medium', 'hard', 'omega'] as FreePlayDifficulty[]).map(difficulty => (
            <DifficultyCard
              key={difficulty}
              difficulty={difficulty}
              info={DIFFICULTY_INFO[difficulty]}
              isSelected={selectedDifficulty === difficulty}
              onSelect={() => setSelectedDifficulty(difficulty)}
            />
          ))}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Free Play has no timer or score targets. Play at your own pace and practice matching sets.
          </Text>
        </View>

        {/* Start Button */}
        <Button
          variant="primary"
          size="lg"
          onPress={handleStart}
          fullWidth
        >
          Start Free Play
        </Button>
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
    backgroundColor: COLORS.logicTeal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  difficultyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  difficultyCard: {
    width: '45%',
    minWidth: 140,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  difficultyCardSelected: {
    backgroundColor: COLORS.logicTeal,
    borderWidth: 3,
    ...SHADOWS.md,
  },
  difficultyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  difficultyLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  difficultyLabelSelected: {
    color: COLORS.canvasWhite,
  },
  difficultyDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  difficultyDescriptionSelected: {
    color: COLORS.canvasWhite,
    opacity: 0.9,
  },
  infoSection: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DifficultySelection;
