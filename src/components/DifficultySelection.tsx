import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { usePWASafeAreaInsets } from '@/hooks/usePWASafeAreaInsets';
import { COLORS, RADIUS } from '@/utils/colors';
import { FreePlayDifficultyStorage } from '@/utils/freePlayStorage';
import { triggerHaptic } from '@/utils/haptics';
import { playSound } from '@/utils/sounds';
import { FreePlayDifficulty } from '@/types';
import Icon, { IconName } from './Icon';

interface DifficultySelectionProps {
  onStart: (difficulty: FreePlayDifficulty) => void;
  onExitGame?: () => void;
}

const DIFFICULTIES: readonly FreePlayDifficulty[] = ['easy', 'medium', 'hard', 'omega'];

const DIFFICULTY_INFO: Record<
  FreePlayDifficulty,
  { label: string; description: string; traits: string; icon: IconName }
> = {
  easy: { label: 'Easy', description: '2 traits', traits: 'Shape · Color', icon: 'lorc/feather' },
  medium: { label: 'Medium', description: '3 traits', traits: 'Shape · Color · Number', icon: 'lorc/archery-target' },
  hard: { label: 'Hard', description: '4 traits', traits: '+ Shading', icon: 'lorc/diamond-hard' },
  omega: { label: 'Omega', description: '5 traits', traits: '+ Background', icon: 'lorc/brain' },
};

const DifficultySelection: React.FC<DifficultySelectionProps> = ({ onStart, onExitGame }) => {
  const insets = usePWASafeAreaInsets();
  const lastPlayed = useMemo(() => FreePlayDifficultyStorage.get(), []);
  const highlightedDifficulty = useMemo(
    () => lastPlayed ?? FreePlayDifficultyStorage.getDefault(),
    [lastPlayed]
  );

  const launchDifficulty = useCallback(
    (difficulty: FreePlayDifficulty) => {
      triggerHaptic('light');
      playSound('click');
      FreePlayDifficultyStorage.set(difficulty);
      onStart(difficulty);
    },
    [onStart]
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        launchDifficulty(highlightedDifficulty);
      } else if (e.key === 'Escape' && onExitGame) {
        e.preventDefault();
        onExitGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlightedDifficulty, launchDifficulty, onExitGame]);

  return (
    <View style={styles.container} testID="difficulty-selection">
      <View style={styles.eyebrow}>
        {onExitGame ? (
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              playSound('click');
              onExitGame();
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to Main Menu"
            testID="difficulty-back"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.cardPressed,
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <Icon name="ui/back-arrow" size={18} color={COLORS.canvasWhite} noShadow />
            <Text style={styles.backButtonText}>Menu</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={styles.eyebrowText} numberOfLines={1}>
          Free Play
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.title}>Tap to Play</Text>
          <Text style={styles.subtitle}>Pick how many card traits to match — starts right away</Text>
        </View>

        <View style={styles.difficultyGrid}>
          {DIFFICULTIES.map(difficulty => {
            const info = DIFFICULTY_INFO[difficulty];
            const isHighlighted = highlightedDifficulty === difficulty;
            const badgeLabel =
              lastPlayed === difficulty
                ? 'LAST PLAYED'
                : !lastPlayed && isHighlighted
                  ? 'RECOMMENDED'
                  : null;

            return (
              <Pressable
                key={difficulty}
                testID={`freeplay-difficulty-${difficulty}`}
                accessibilityRole="button"
                accessibilityLabel={`Start Free Play on ${info.label}: ${info.description}`}
                onPress={() => launchDifficulty(difficulty)}
                style={({ pressed }) => [
                  styles.difficultyCard,
                  isHighlighted && styles.difficultyCardHighlighted,
                  pressed && styles.cardPressed,
                  Platform.OS === 'web' && { cursor: 'pointer' as any },
                ]}
              >
                {badgeLabel && (
                  <View
                    testID={`freeplay-badge-${difficulty}`}
                    style={[
                      styles.pillBadge,
                      isHighlighted ? styles.pillBadgeHighlighted : styles.pillBadgeDefault,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBadgeText,
                        isHighlighted && styles.pillBadgeTextHighlighted,
                      ]}
                    >
                      {badgeLabel}
                    </Text>
                  </View>
                )}

                <View style={styles.difficultyIconContainer}>
                  <Icon name={info.icon} size={34} color={COLORS.slateCharcoal} />
                </View>

                <Text
                  style={[
                    styles.difficultyLabel,
                    isHighlighted && styles.difficultyLabelHighlighted,
                  ]}
                >
                  {info.label} · {info.description}
                </Text>

                <Text
                  style={[
                    styles.difficultyTraits,
                    isHighlighted && styles.difficultyTraitsHighlighted,
                  ]}
                >
                  {info.traits}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.infoSection} testID="freeplay-rule-reminder">
          <Text style={styles.infoText}>
            Find 3 cards where each trait is all the same or all different. No clock, no hearts.
          </Text>
          {Platform.OS === 'web' && (
            <Text style={styles.keyboardHint}>
              Press Enter or Space to jump straight into {DIFFICULTY_INFO[highlightedDifficulty].label}.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    minHeight: 48,
    backgroundColor: COLORS.logicTeal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.slateCharcoal,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.button,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    minHeight: 36,
  },
  backButtonText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerSpacer: {
    width: 68,
  },
  eyebrowText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
    flexShrink: 1,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 18,
    gap: 18,
    justifyContent: 'center',
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  headerSection: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    opacity: 0.78,
    textAlign: 'center',
    flexShrink: 1,
  },
  difficultyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  difficultyCard: {
    width: '47%',
    minWidth: 136,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  difficultyCardHighlighted: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pillBadgeDefault: {
    backgroundColor: COLORS.paperBeige,
  },
  pillBadgeHighlighted: {
    backgroundColor: COLORS.deepOnyx,
  },
  pillBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: COLORS.slateCharcoal,
  },
  pillBadgeTextHighlighted: {
    color: COLORS.actionYellow,
  },
  difficultyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
  },
  difficultyLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    flexShrink: 1,
  },
  difficultyLabelHighlighted: {
    color: COLORS.deepOnyx,
  },
  difficultyTraits: {
    fontSize: 11.5,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    opacity: 0.75,
    textAlign: 'center',
    flexShrink: 1,
  },
  difficultyTraitsHighlighted: {
    color: COLORS.deepOnyx,
    opacity: 0.85,
  },
  infoSection: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    padding: 14,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    lineHeight: 19,
    flexShrink: 1,
  },
  keyboardHint: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
    textAlign: 'center',
    flexShrink: 1,
  },
});

export default DifficultySelection;
