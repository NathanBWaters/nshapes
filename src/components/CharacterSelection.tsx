import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Character, PlayerStats, AdventureDifficulty } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { getWeaponByName, DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import { CharacterWinsStorage, CharacterWins, EndlessHighScoresStorage, EndlessHighScores, CharacterUnlockStorage } from '@/utils/storage';
import Icon from './Icon';
import GameMenu from './GameMenu';
import { ScreenTransition } from './ScreenTransition';

// IMPORTANT: This game should NOT have scrollable screens.
// All screens should fill the available height without requiring scrolling.

export type GameMode = 'adventure' | 'free_play';
export type FreePlayDifficulty = 'easy' | 'medium' | 'hard' | 'omega';

interface CharacterSelectionProps {
  characters: Character[];
  selectedCharacter: string | null;
  onSelect: (characterName: string) => void;
  onStart: (difficulty: AdventureDifficulty) => void;
  onExitGame?: () => void;
}

const CharacterSelection: React.FC<CharacterSelectionProps> = ({
  characters,
  selectedCharacter,
  onSelect,
  onStart,
  onExitGame,
}) => {
  const [hoveredCharacter, setHoveredCharacter] = React.useState<string | null>(null);
  const [characterWins, setCharacterWins] = React.useState<CharacterWins>({});
  const [endlessHighScores, setEndlessHighScores] = React.useState<EndlessHighScores>({});
  const [adventureDifficulty, setAdventureDifficulty] = React.useState<AdventureDifficulty>('medium');
  const [unlockedCharacters, setUnlockedCharacters] = React.useState<string[]>([]);

  // Load character wins, endless high scores, and unlocked characters on mount
  React.useEffect(() => {
    setCharacterWins(CharacterWinsStorage.getWins());
    setEndlessHighScores(EndlessHighScoresStorage.getHighScores());
    setUnlockedCharacters(CharacterUnlockStorage.getUnlockedCharacters());
  }, []);

  // Auto-select first unlocked character if none selected or selected is locked
  React.useEffect(() => {
    if (unlockedCharacters.length === 0) return; // Wait for unlocked characters to load

    const isCurrentSelectionLocked = selectedCharacter && !unlockedCharacters.includes(selectedCharacter);
    if ((!selectedCharacter || isCurrentSelectionLocked) && characters.length > 0) {
      // Find first unlocked character
      const firstUnlocked = characters.find(c => unlockedCharacters.includes(c.name));
      if (firstUnlocked) {
        onSelect(firstUnlocked.name);
      }
    }
  }, [characters, selectedCharacter, unlockedCharacters, onSelect]);

  // Show hovered character if hovering, otherwise show selected
  const displayedCharacter = hoveredCharacter || selectedCharacter;
  const selectedChar = characters.find(c => c.name === displayedCharacter);

  return (
    <ScreenTransition>
      <View style={styles.container}>
        {/* Eyebrow Banner */}
        <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Character Selection</Text>
        <GameMenu playerStats={DEFAULT_PLAYER_STATS as PlayerStats} character={selectedChar} onExitGame={onExitGame} />
      </View>

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {selectedChar ? (
          <View style={styles.detailCard}>
            {/* Character Header: Icon + Name/Description side by side */}
            <View style={styles.characterHeader}>
              {/* Character Icon - Square on left */}
              <View style={styles.previewArea}>
                {selectedChar.icon ? (
                  <Icon name={selectedChar.icon} size={48} color={COLORS.slateCharcoal} />
                ) : (
                  <Text style={styles.previewText}>{selectedChar.name}</Text>
                )}
              </View>

              {/* Character Info - Right of icon */}
              <View style={styles.characterInfo}>
                <Text style={styles.detailName}>{selectedChar.name}</Text>
                <Text style={styles.detailDescription}>{selectedChar.description}</Text>
              </View>
            </View>

            {/* Starting Weapons */}
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Starting Weapons</Text>
              <View style={styles.weaponsList}>
                {selectedChar.startingWeapons.map((weaponName, index) => {
                  const weapon = getWeaponByName(weaponName);
                  return (
                    <View key={index} style={styles.weaponItemRow}>
                      <View style={styles.weaponItemHeader}>
                        {weapon?.icon && (
                          <Icon name={weapon.icon} size={16} color={COLORS.slateCharcoal} />
                        )}
                        <Text style={styles.statValue}>{weaponName}</Text>
                      </View>
                      {weapon?.shortDescription && (
                        <Text style={styles.weaponShortDesc}>{weapon.shortDescription}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>Select a character below</Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid (no scrolling - fills available space) */}
      <View style={styles.optionsSection}>
        <Text style={styles.optionsHeader}>Choose Your Character</Text>
        <View style={styles.optionsGrid}>
          {characters.map(character => {
            const isSelected = selectedCharacter === character.name;
            const wins = characterWins[character.name] ?? 0;
            const endlessHighRound = endlessHighScores[character.name] ?? 0;
            const isLocked = !unlockedCharacters.includes(character.name);

            return (
              <Pressable
                key={character.name}
                onPress={() => !isLocked && onSelect(character.name)}
                onHoverIn={() => !isLocked && setHoveredCharacter(character.name)}
                onHoverOut={() => setHoveredCharacter(null)}
                style={[
                  styles.optionButton,
                  isSelected && !isLocked && styles.optionButtonSelected,
                  isLocked && styles.optionButtonLocked,
                ]}
              >
                {/* Lock overlay for locked characters - shows only lock icon */}
                {isLocked ? (
                  <View style={styles.lockOverlay}>
                    <Icon name="lorc/padlock" size={32} color={COLORS.slateCharcoal} noShadow />
                  </View>
                ) : (
                  <>
                    {wins > 0 && (
                      <View style={styles.winsBadge}>
                        <Text style={styles.winsBadgeText}>{wins}</Text>
                      </View>
                    )}
                    {endlessHighRound > 10 && (
                      <View style={styles.endlessBadge}>
                        <Text style={styles.endlessBadgeText}>R{endlessHighRound}</Text>
                      </View>
                    )}
                    <View style={styles.optionIconArea}>
                      {character.icon && (
                        <Icon
                          name={character.icon}
                          size={48}
                          color={COLORS.slateCharcoal}
                        />
                      )}
                    </View>
                    <View style={styles.optionNameArea}>
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                        ]}
                      >
                        {character.name}
                      </Text>
                    </View>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Difficulty Selector and Start Adventure Button */}
      <View style={styles.actionSection}>
        {/* Difficulty Selector */}
        <View style={styles.difficultySection}>
          <Text style={styles.difficultyLabel}>Difficulty</Text>
          <View style={styles.difficultyRow}>
            {(['easy', 'medium', 'hard'] as AdventureDifficulty[]).map((diff) => {
              const isSelected = adventureDifficulty === diff;
              const labels: Record<AdventureDifficulty, { name: string; desc: string; icon: string }> = {
                easy: { name: 'Easy', desc: '3 Attributes', icon: 'lorc/feather' },
                medium: { name: 'Medium', desc: 'Progressive', icon: 'lorc/archery-target' },
                hard: { name: 'Hard', desc: '4-5 Attributes', icon: 'lorc/diamond-hard' },
              };
              return (
                <Pressable
                  key={diff}
                  onPress={() => setAdventureDifficulty(diff)}
                  style={[
                    styles.difficultyButton,
                    isSelected && styles.difficultyButtonSelected,
                  ]}
                >
                  <Icon
                    name={labels[diff].icon}
                    size={20}
                    color={isSelected ? COLORS.slateCharcoal : COLORS.slateCharcoal}
                  />
                  <Text style={[styles.difficultyButtonText, isSelected && styles.difficultyButtonTextSelected]}>
                    {labels[diff].name}
                  </Text>
                  <Text style={[styles.difficultyButtonDesc, isSelected && styles.difficultyButtonDescSelected]}>
                    {labels[diff].desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onStart(adventureDifficulty)}
          disabled={!selectedCharacter}
          testID="start-adventure-button"
          accessibilityLabel="Start Adventure"
          style={[
            styles.actionButton,
            !selectedCharacter && styles.actionButtonDisabled,
          ]}
        >
          <Text style={styles.actionButtonText}>
            {selectedCharacter ? 'Start Adventure' : 'Select a Character'}
          </Text>
        </TouchableOpacity>
      </View>
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
    height: 40,
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
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
  characterHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  characterInfo: {
    flex: 1,
    justifyContent: 'center',
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
    opacity: 0.8,
  },
  statBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  statLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weaponsList: {
    gap: 8,
  },
  weaponItemRow: {
    gap: 2,
  },
  weaponItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weaponShortDesc: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    opacity: 0.7,
    marginLeft: 22,
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
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    alignContent: 'stretch',
  },
  optionButton: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    width: '31%',
    flexGrow: 1,
    flexBasis: '31%',
    padding: '3%',
    position: 'relative',
  },
  winsBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.actionYellow,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    zIndex: 1,
  },
  winsBadgeText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 11,
  },
  endlessBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.logicTeal,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    zIndex: 1,
  },
  endlessBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '600',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  optionIconArea: {
    flex: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  optionNameArea: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  optionButtonSelected: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
  },
  optionButtonLocked: {
    backgroundColor: COLORS.paperBeige,
  },
  lockOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
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
    gap: 12,
  },
  difficultySection: {
    gap: 8,
  },
  difficultyLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  difficultyButtonSelected: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
  },
  difficultyButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  difficultyButtonTextSelected: {
    fontWeight: '700',
  },
  difficultyButtonDesc: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 9,
    opacity: 0.7,
    marginTop: 2,
  },
  difficultyButtonDescSelected: {
    opacity: 1,
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

export default CharacterSelection;
