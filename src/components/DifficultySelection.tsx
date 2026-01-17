import React, { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS } from '@/utils/colors';
import { PlayerStats } from '@/types';
import { FreePlayDifficulty } from './CharacterSelection';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import Icon, { IconName } from './Icon';
import GameMenu from './GameMenu';

interface DifficultySelectionProps {
  onStart: (difficulty: FreePlayDifficulty) => void;
  onExitGame?: () => void;
}

// Difficulty labels and descriptions
const DIFFICULTY_INFO: Record<FreePlayDifficulty, { label: string; description: string; icon: IconName }> = {
  easy: { label: 'Easy', description: '2 attributes', icon: 'lorc/feather' },
  medium: { label: 'Medium', description: '3 attributes', icon: 'lorc/archery-target' },
  hard: { label: 'Hard', description: '4 attributes', icon: 'lorc/diamond-hard' },
  omega: { label: 'Omega', description: '5 attributes', icon: 'lorc/brain' },
};

const DifficultySelection: React.FC<DifficultySelectionProps> = ({ onStart, onExitGame }) => {
  const insets = useSafeAreaInsets();
  const [selectedDifficulty, setSelectedDifficulty] = useState<FreePlayDifficulty>('medium');

  return (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Free Play - Select Difficulty</Text>
        <GameMenu playerStats={DEFAULT_PLAYER_STATS as PlayerStats} onExitGame={onExitGame} />
      </View>

      {/* Main Content */}
      <View style={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Choose Difficulty</Text>
          <Text style={styles.subtitle}>Select the number of attributes to match</Text>
        </View>

        {/* Difficulty Options */}
        <View style={styles.difficultyGrid}>
          {(['easy', 'medium', 'hard', 'omega'] as FreePlayDifficulty[]).map(difficulty => {
            const info = DIFFICULTY_INFO[difficulty];
            const isSelected = selectedDifficulty === difficulty;

            return (
              <Pressable
                key={difficulty}
                onPress={() => setSelectedDifficulty(difficulty)}
                style={[
                  styles.difficultyCard,
                  isSelected && styles.difficultyCardSelected,
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
              </Pressable>
            );
          })}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Free Play has no timer or score targets. Play at your own pace and practice matching sets.
          </Text>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          onPress={() => onStart(selectedDifficulty)}
          style={styles.startButton}
        >
          <Text style={styles.startButtonText}>Start Free Play</Text>
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
    backgroundColor: COLORS.logicTeal,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
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
    padding: 24,
    justifyContent: 'space-between',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
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
    gap: 16,
    justifyContent: 'center',
    marginBottom: 24,
  },
  difficultyCard: {
    width: '45%',
    minWidth: 140,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  difficultyCardSelected: {
    backgroundColor: COLORS.logicTeal,
    borderWidth: 3,
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
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default DifficultySelection;
