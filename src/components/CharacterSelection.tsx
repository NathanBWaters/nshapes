import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Character } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import { getWeaponByName } from '@/utils/gameDefinitions';
import Icon from './Icon';

// IMPORTANT: This game should NOT have scrollable screens.
// All screens should fill the available height without requiring scrolling.

interface CharacterSelectionProps {
  characters: Character[];
  selectedCharacter: string | null;
  onSelect: (characterName: string) => void;
  onStart: () => void;
}

const CharacterSelection: React.FC<CharacterSelectionProps> = ({
  characters,
  selectedCharacter,
  onSelect,
  onStart
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

  return (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Character Selection</Text>
      </View>

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {selectedChar ? (
          <View style={styles.detailCard}>
            {/* Character Icon */}
            <View style={styles.previewArea}>
              {selectedChar.icon ? (
                <Icon name={selectedChar.icon} size={64} color={COLORS.slateCharcoal} />
              ) : (
                <Text style={styles.previewText}>{selectedChar.name}</Text>
              )}
            </View>

            {/* Character Info */}
            <Text style={styles.detailName}>{selectedChar.name}</Text>
            <Text style={styles.detailDescription}>{selectedChar.description}</Text>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Weapon</Text>
                <View style={styles.statValueRow}>
                  {(() => {
                    const weapon = getWeaponByName(selectedChar.startingWeapon);
                    return weapon?.icon ? (
                      <Icon name={weapon.icon} size={16} color={COLORS.slateCharcoal} />
                    ) : null;
                  })()}
                  <Text style={styles.statValue}>{selectedChar.startingWeapon}</Text>
                </View>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Items</Text>
                <Text style={styles.statValue}>
                  {selectedChar.startingItems.length > 0
                    ? selectedChar.startingItems.join(', ')
                    : 'None'}
                </Text>
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

            return (
              <Pressable
                key={character.name}
                onPress={() => onSelect(character.name)}
                onHoverIn={() => setHoveredCharacter(character.name)}
                onHoverOut={() => setHoveredCharacter(null)}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionButtonSelected,
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
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          onPress={onStart}
          disabled={!selectedCharacter}
          style={[
            styles.actionButton,
            !selectedCharacter && styles.actionButtonDisabled,
          ]}
        >
          <Text style={styles.actionButtonText}>
            {selectedCharacter ? 'Start Game' : 'Select a Character'}
          </Text>
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
    backgroundColor: COLORS.actionYellow,
    justifyContent: 'center',
    alignItems: 'center',
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
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    height: 80,
    borderRadius: 8,
    marginBottom: 12,
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
    marginBottom: 12,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
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
