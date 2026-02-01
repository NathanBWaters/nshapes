import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { usePWASafeAreaInsets } from '@/utils/usePWASafeAreaInsets';
import { Character, LevelNumber, PlayerStats } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { LEVEL_DEFINITIONS, getLevelDefinition } from '@/utils/gameConfig';
import { LevelProgressStorage, CharacterUnlockStorage } from '@/utils/storage';
import { CHARACTERS } from '@/utils/gameDefinitions';
import Icon from './Icon';
import GameMenu from './GameMenu';
import { ScreenTransition } from './ScreenTransition';

interface LevelSelectionProps {
  selectedCharacter: Character;
  onSelectLevel: (levelNumber: LevelNumber) => void;
  onBack: () => void;
  onExitGame?: () => void;
}

const LevelSelection: React.FC<LevelSelectionProps> = ({
  selectedCharacter,
  onSelectLevel,
  onBack,
  onExitGame,
}) => {
  const insets = usePWASafeAreaInsets();
  const [highestUnlocked, setHighestUnlocked] = React.useState(1);
  const [levelCompletions, setLevelCompletions] = React.useState<Record<number, string[]>>({});
  const [unlockedCharacters, setUnlockedCharacters] = React.useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = React.useState<LevelNumber | null>(null);

  // Load level progress on mount
  React.useEffect(() => {
    setHighestUnlocked(LevelProgressStorage.getHighestUnlockedLevel());
    setUnlockedCharacters(CharacterUnlockStorage.getUnlockedCharacters());

    // Build completions map
    const completions: Record<number, string[]> = {};
    for (let i = 1; i <= 10; i++) {
      completions[i] = LevelProgressStorage.getCompletionsForLevel(i);
    }
    setLevelCompletions(completions);
  }, []);

  const handleLevelPress = (levelNumber: LevelNumber) => {
    if (levelNumber <= highestUnlocked) {
      setSelectedLevel(levelNumber);
    }
  };

  const handleStartLevel = () => {
    if (selectedLevel) {
      onSelectLevel(selectedLevel);
    }
  };

  const selectedLevelDef = selectedLevel ? getLevelDefinition(selectedLevel) : null;

  return (
    <ScreenTransition>
      <View style={styles.container}>
        {/* Eyebrow Banner */}
        <View style={styles.eyebrow}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrowText}>Select Level</Text>
          <GameMenu
            playerStats={{} as PlayerStats}
            character={selectedCharacter}
            onExitGame={onExitGame}
          />
        </View>

        {/* Character Info */}
        <View style={styles.characterBanner}>
          {selectedCharacter.icon && (
            <Icon name={selectedCharacter.icon} size={24} color={COLORS.slateCharcoal} />
          )}
          <Text style={styles.characterName}>{selectedCharacter.name}</Text>
        </View>

        {/* Level Grid */}
        <ScrollView
          style={styles.levelGrid}
          contentContainerStyle={styles.levelGridContent}
          showsVerticalScrollIndicator={false}
        >
          {LEVEL_DEFINITIONS.map((level) => {
            const isUnlocked = level.number <= highestUnlocked;
            const isSelected = selectedLevel === level.number;
            const completedBy = levelCompletions[level.number] || [];
            const hasCurrentCharacter = completedBy.includes(selectedCharacter.name);

            return (
              <TouchableOpacity
                key={level.number}
                style={[
                  styles.levelCard,
                  !isUnlocked && styles.levelCardLocked,
                  isSelected && styles.levelCardSelected,
                ]}
                onPress={() => handleLevelPress(level.number)}
                disabled={!isUnlocked}
                activeOpacity={0.8}
              >
                {/* Level Number Badge */}
                <View style={[
                  styles.levelBadge,
                  !isUnlocked && styles.levelBadgeLocked,
                  isSelected && styles.levelBadgeSelected,
                ]}>
                  <Text style={[
                    styles.levelNumber,
                    !isUnlocked && styles.levelNumberLocked,
                    isSelected && styles.levelNumberSelected,
                  ]}>
                    {isUnlocked ? level.number : '🔒'}
                  </Text>
                </View>

                {/* Level Info */}
                <View style={styles.levelInfo}>
                  <Text style={[
                    styles.levelName,
                    !isUnlocked && styles.levelNameLocked,
                  ]}>
                    {level.name}
                  </Text>

                  {/* Attribute Count */}
                  <Text style={[
                    styles.levelAttributes,
                    !isUnlocked && styles.levelAttributesLocked,
                  ]}>
                    {level.attributes.length} Attributes
                  </Text>

                  {/* Character Completion Icons */}
                  {isUnlocked && completedBy.length > 0 && (
                    <View style={styles.completionIcons}>
                      {completedBy.slice(0, 6).map((charName) => {
                        const char = CHARACTERS.find(c => c.name === charName);
                        const isCurrentChar = charName === selectedCharacter.name;
                        return (
                          <View
                            key={charName}
                            style={[
                              styles.completionIcon,
                              isCurrentChar && styles.completionIconCurrent,
                            ]}
                          >
                            {char?.icon ? (
                              <Icon
                                name={char.icon}
                                size={14}
                                color={isCurrentChar ? COLORS.actionYellow : COLORS.slateCharcoal}
                              />
                            ) : (
                              <Text style={styles.completionInitial}>
                                {charName.charAt(0)}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Current Character Checkmark */}
                {hasCurrentCharacter && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Level Details */}
        {selectedLevelDef && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>
                Level {selectedLevelDef.number}: {selectedLevelDef.name}
              </Text>
              <Text style={styles.detailDescription}>
                {selectedLevelDef.description}
              </Text>
            </View>

            <View style={styles.detailStats}>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatLabel}>Rounds</Text>
                <Text style={styles.detailStatValue}>5</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatLabel}>Attributes</Text>
                <Text style={styles.detailStatValue}>{selectedLevelDef.attributes.length}</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatLabel}>Bosses</Text>
                <Text style={styles.detailStatValue}>
                  {selectedLevelDef.miniBoss ? '2' : '0'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartLevel}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>START LEVEL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State when no level selected */}
        {!selectedLevelDef && (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>Select a level to begin</Text>
          </View>
        )}
      </View>
    </ScreenTransition>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.actionYellow,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
  },
  characterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.canvasWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  characterName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
  },
  levelGrid: {
    flex: 1,
  },
  levelGridContent: {
    padding: 16,
    gap: 12,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 12,
    gap: 12,
  },
  levelCardLocked: {
    opacity: 0.5,
    borderColor: '#888',
  },
  levelCardSelected: {
    borderColor: COLORS.actionYellow,
    borderWidth: 3,
    backgroundColor: '#FFFEF0',
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.slateCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeLocked: {
    backgroundColor: '#888',
  },
  levelBadgeSelected: {
    backgroundColor: COLORS.actionYellow,
  },
  levelNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.canvasWhite,
  },
  levelNumberLocked: {
    fontSize: 16,
  },
  levelNumberSelected: {
    color: COLORS.slateCharcoal,
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    marginBottom: 2,
  },
  levelNameLocked: {
    color: '#888',
  },
  levelAttributes: {
    fontSize: 13,
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  levelAttributesLocked: {
    color: '#888',
  },
  completionIcons: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
  },
  completionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.paperBeige,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  completionIconCurrent: {
    backgroundColor: COLORS.slateCharcoal,
    borderColor: COLORS.actionYellow,
  },
  completionInitial: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.logicTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.canvasWhite,
  },
  detailPanel: {
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 2,
    borderTopColor: COLORS.slateCharcoal,
    padding: 16,
  },
  detailHeader: {
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    marginBottom: 4,
  },
  detailDescription: {
    fontSize: 14,
    color: COLORS.slateCharcoal,
    opacity: 0.8,
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
  },
  detailStat: {
    alignItems: 'center',
  },
  detailStatLabel: {
    fontSize: 12,
    color: COLORS.slateCharcoal,
    opacity: 0.7,
    marginBottom: 2,
  },
  detailStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  startButton: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyPanel: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 2,
    borderTopColor: COLORS.slateCharcoal,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
  },
});

export default LevelSelection;
