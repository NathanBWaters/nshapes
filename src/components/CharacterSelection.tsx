import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Character, PlayerStats } from '@/types';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../theme';
import { DURATIONS } from '../theme/animations';
import { haptics } from '../utils/haptics';
import { getWeaponByName, DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import Icon from './Icon';
import GameMenu from './GameMenu';
import { Button } from './ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// IMPORTANT: This game should NOT have scrollable screens.
// All screens should fill the available height without requiring scrolling.

export type GameMode = 'adventure' | 'free_play';
export type FreePlayDifficulty = 'easy' | 'medium' | 'hard' | 'omega';

interface CharacterSelectionProps {
  characters: Character[];
  selectedCharacter: string | null;
  onSelect: (characterName: string) => void;
  onStart: () => void;
  onExitGame?: () => void;
}

// Character option card with animations
function CharacterCard({
  character,
  isSelected,
  onSelect,
  onHoverIn,
  onHoverOut,
}: {
  character: Character;
  isSelected: boolean;
  onSelect: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
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
    onHoverIn();
  }, [hovered, onHoverIn]);

  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') {
      hovered.value = withTiming(0, { duration: DURATIONS.hover });
    }
    onHoverOut();
  }, [hovered, onHoverOut]);

  const handlePress = useCallback(() => {
    haptics.selection();
    onSelect();
  }, [onSelect]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.96]);
    const translateY = interpolate(hovered.value, [0, 1], [0, -2]);

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
        styles.optionButton,
        isSelected && styles.optionButtonSelected,
        animatedStyle,
        Platform.OS === 'web' && { cursor: 'pointer' as const },
      ]}
    >
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
    </AnimatedPressable>
  );
}

const CharacterSelection: React.FC<CharacterSelectionProps> = ({
  characters,
  selectedCharacter,
  onSelect,
  onStart,
  onExitGame,
}) => {
  const [hoveredCharacter, setHoveredCharacter] = React.useState<string | null>(null);

  // Auto-select first character if none selected
  React.useEffect(() => {
    if (!selectedCharacter && characters.length > 0) {
      onSelect(characters[0].name);
    }
  }, [characters, selectedCharacter, onSelect]);

  // Show hovered character if hovering, otherwise show selected
  const displayedCharacter = hoveredCharacter || selectedCharacter;
  const selectedChar = characters.find(c => c.name === displayedCharacter);

  const handleStart = useCallback(() => {
    haptics.medium();
    onStart();
  }, [onStart]);

  return (
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
          {characters.map(character => (
            <CharacterCard
              key={character.name}
              character={character}
              isSelected={selectedCharacter === character.name}
              onSelect={() => onSelect(character.name)}
              onHoverIn={() => setHoveredCharacter(character.name)}
              onHoverOut={() => setHoveredCharacter(null)}
            />
          ))}
        </View>
      </View>

      {/* Start Adventure Button */}
      <View style={styles.actionSection}>
        <Button
          variant="primary"
          size="lg"
          onPress={handleStart}
          disabled={!selectedCharacter}
          fullWidth
          testID="start-adventure-button"
        >
          {selectedCharacter ? 'Start Adventure' : 'Select a Character'}
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
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
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
    padding: SPACING.md,
  },
  detailCard: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  characterHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    width: 72,
    height: 72,
    borderRadius: RADIUS.sm,
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
    marginBottom: SPACING.xxs,
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
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  statLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xxs,
  },
  statValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  weaponsList: {
    gap: SPACING.sm,
  },
  weaponItemRow: {
    gap: 2,
  },
  weaponItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
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
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    padding: SPACING.xl,
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  optionsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    alignContent: 'stretch',
  },
  optionButton: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    width: '31%',
    flexGrow: 1,
    flexBasis: '31%',
    padding: '3%',
    ...SHADOWS.sm,
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
    ...SHADOWS.md,
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
    padding: SPACING.md,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
});

export default CharacterSelection;
