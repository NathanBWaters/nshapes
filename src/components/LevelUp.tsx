import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet } from 'react-native';
import { PlayerStats, Weapon } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon, { STAT_ICONS } from './Icon';

interface LevelUpProps {
  options: (Partial<PlayerStats> | Weapon)[];
  onSelect: (optionIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
}

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Show hovered option if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;

  // Helper function to check if an option is a weapon
  const isWeapon = (option: Partial<PlayerStats> | Weapon): option is Weapon => {
    return 'name' in option && 'level' in option;
  };

  // Format stat value for display
  const formatStatValue = (value: number | string | undefined): string => {
    if (value === undefined) return '';
    if (typeof value === 'number') {
      return value > 0 ? `+${value}` : `${value}`;
    }
    return String(value || '');
  };

  // Format key from camelCase to Title Case
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  // Get option name for display
  const getOptionName = (option: Partial<PlayerStats> | Weapon, index: number): string => {
    if (isWeapon(option)) {
      return option.name;
    }
    // For stat upgrades, show the stat name
    const keys = Object.keys(option);
    if (keys.length === 1) {
      return formatKey(keys[0]);
    }
    return `Upgrade ${index + 1}`;
  };

  // Get option type label
  const getOptionType = (option: Partial<PlayerStats> | Weapon): string => {
    return isWeapon(option) ? 'Weapon' : 'Stat';
  };

  const focusedOption = options[displayedIndex];

  return (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Level Up!</Text>
      </View>

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {focusedOption ? (
          <View style={styles.detailCard}>
            {isWeapon(focusedOption) ? (
              // Weapon Details
              <>
                <View style={styles.previewArea}>
                  {focusedOption.icon ? (
                    <Icon name={focusedOption.icon} size={32} color={COLORS.slateCharcoal} />
                  ) : (
                    <Text style={styles.previewLabel}>Weapon</Text>
                  )}
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>LV {focusedOption.level}</Text>
                  </View>
                </View>

                <Text style={styles.detailName}>{focusedOption.name}</Text>
                <Text style={styles.detailDescription}>{focusedOption.description}</Text>

                <View style={styles.effectsBox}>
                  <Text style={styles.effectsLabel}>Effects</Text>
                  {Object.entries(focusedOption.effects).map(([key, value]) => (
                    <View key={key} style={styles.effectRow}>
                      <Text style={styles.effectKey}>{formatKey(key)}</Text>
                      <Text style={styles.effectValue}>{formatStatValue(value)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              // Stat Upgrade Details
              <>
                <View style={styles.previewArea}>
                  {(() => {
                    const statKey = Object.keys(focusedOption)[0];
                    const iconPath = STAT_ICONS[statKey];
                    return iconPath ? (
                      <Icon name={iconPath} size={32} color={COLORS.slateCharcoal} />
                    ) : (
                      <Text style={styles.previewLabel}>Stat Upgrade</Text>
                    );
                  })()}
                </View>

                <Text style={styles.detailName}>{getOptionName(focusedOption, displayedIndex!)}</Text>

                <View style={styles.effectsBox}>
                  <Text style={styles.effectsLabel}>Bonus</Text>
                  {Object.entries(focusedOption).map(([key, value]) => (
                    <View key={key} style={styles.effectRow}>
                      <Text style={styles.effectKey}>{formatKey(key)}</Text>
                      <Text style={[styles.effectValue, styles.effectValuePositive]}>
                        {formatStatValue(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>Select an upgrade below</Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.optionsHeader}>Choose Your Upgrade</Text>
          <TouchableOpacity
            onPress={onReroll}
            disabled={playerMoney < rerollCost && freeRerolls <= 0}
            style={[
              styles.rerollButton,
              (playerMoney < rerollCost && freeRerolls <= 0) && styles.rerollButtonDisabled,
            ]}
          >
            <Text style={styles.rerollButtonText}>
              {freeRerolls > 0 ? `Reroll (${freeRerolls})` : `Reroll $${rerollCost}`}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsGrid}
          showsVerticalScrollIndicator={false}
        >
          {options.map((option, index) => {
            const isFocused = focusedIndex === index;
            const isDisplayed = displayedIndex === index;
            const weapon = isWeapon(option);

            return (
              <Pressable
                key={`option-${index}`}
                onPress={() => setFocusedIndex(index)}
                onHoverIn={() => setHoveredIndex(index)}
                onHoverOut={() => setHoveredIndex(null)}
                style={[
                  styles.optionButton,
                  isFocused && styles.optionButtonSelected,
                  weapon && styles.optionButtonWeapon,
                  isFocused && weapon && styles.optionButtonWeaponSelected,
                ]}
              >
                {weapon && (option as Weapon).icon ? (
                  <Icon
                    name={(option as Weapon).icon!}
                    size={24}
                    color={COLORS.slateCharcoal}
                    style={styles.optionIcon}
                  />
                ) : !weapon && (() => {
                  const statKey = Object.keys(option)[0];
                  const iconPath = STAT_ICONS[statKey];
                  return iconPath ? (
                    <Icon
                      name={iconPath}
                      size={24}
                      color={COLORS.slateCharcoal}
                      style={styles.optionIcon}
                    />
                  ) : null;
                })()}
                <Text style={styles.optionType}>{getOptionType(option)}</Text>
                <Text
                  style={[
                    styles.optionText,
                    isFocused && styles.optionTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {getOptionName(option, index)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Action Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          onPress={() => onSelect(focusedIndex)}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Select Upgrade</Text>
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
    height: 50,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelBadge: {
    backgroundColor: COLORS.impactOrange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  levelBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
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
  effectsBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  effectsLabel: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  effectKey: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 13,
  },
  effectValue: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  effectValuePositive: {
    color: COLORS.logicTeal,
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
  optionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  optionsHeader: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rerollButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rerollButtonDisabled: {
    opacity: 0.4,
  },
  rerollButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  optionsScroll: {
    flex: 1,
  },
  optionsGrid: {
    flexGrow: 1,
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
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  optionIcon: {
    marginBottom: 2,
  },
  optionButtonSelected: {
    backgroundColor: COLORS.actionYellow,
    borderWidth: 2,
  },
  optionButtonWeapon: {
    borderColor: COLORS.impactOrange,
  },
  optionButtonWeaponSelected: {
    backgroundColor: COLORS.actionYellow,
    borderColor: COLORS.slateCharcoal,
  },
  optionType: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
    marginBottom: 2,
  },
  optionText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
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

export default LevelUp;
