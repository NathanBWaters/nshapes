import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import { PlayerStats, Weapon, LevelUpOption, FusionWeapon, PlayerInventory, WeaponLevel } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import { getPlayerWeaponCount } from '@/utils/gameDefinitions';
import {
  getDynamicDescription,
  getStatComparison,
  getCapIncreaseInfo,
  getRarityLabel,
} from '@/utils/weaponDisplay';
import Icon from './Icon';
import KeywordText from './KeywordText';
import { playSound } from '@/utils/sounds';

/**
 * LevelUpModal - In-round level-up popup
 *
 * Unlike the full LevelUp screen, this is a modal overlay that appears
 * during gameplay. The timer is paused while this modal is open.
 *
 * Features:
 * - 4 weapon options
 * - Reroll functionality
 * - Simplified UI for quick selection
 * - Timer pauses while open
 */

interface LevelUpModalProps {
  visible: boolean;
  options: LevelUpOption[];
  onSelect: (option: LevelUpOption) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  playerInventory?: PlayerInventory;
  targetLevel: number;
  hasMoreLevelUps: boolean;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({
  visible,
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls,
  playerStats,
  playerWeapons = [],
  playerInventory,
  targetLevel,
  hasMoreLevelUps,
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // Reset focusedIndex when options change
  useEffect(() => {
    if (focusedIndex >= options.length && options.length > 0) {
      setFocusedIndex(0);
    }
  }, [options, focusedIndex]);

  // Play sound when modal opens
  useEffect(() => {
    if (visible) {
      playSound('confirm');
    }
  }, [visible]);

  const focusedOption = options[focusedIndex];
  const focusedItem = focusedOption?.item;
  const canReroll = freeRerolls > 0 || playerMoney >= rerollCost;

  const handleSelect = () => {
    if (focusedOption) {
      onSelect(focusedOption);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>LEVEL UP!</Text>
              <Text style={styles.headerLevel}>Level {targetLevel}</Text>
            </View>
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>FREE</Text>
            </View>
          </View>

          {/* Selected Item Detail - Above selection for better visibility */}
          {focusedOption && focusedItem && (
            <View style={styles.detailPanel}>
              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                <View style={styles.detailHeader}>
                  {focusedItem.icon && (
                    <Icon
                      name={focusedItem.icon}
                      size={24}
                      color={COLORS.slateCharcoal}
                    />
                  )}
                  <Text style={[
                    styles.detailName,
                    { color: focusedOption.type === 'upgrade' ? COLORS.impactOrange : COLORS.logicTeal }
                  ]}>
                    {focusedItem.name}
                  </Text>
                  {/* NEW or UPGRADE indicator */}
                  <View style={[
                    styles.ownershipBadge,
                    { backgroundColor: focusedOption.type === 'upgrade' ? COLORS.impactOrange : COLORS.logicTeal }
                  ]}>
                    <Text style={styles.ownershipBadgeText}>
                      {focusedOption.type === 'upgrade'
                        ? `LV${Math.min(3, focusedItem.level + 1)}`
                        : 'NEW'}
                    </Text>
                  </View>
                </View>
                <KeywordText style={styles.detailDesc}>
                  {focusedItem.description}
                </KeywordText>
                {focusedItem.flavorText && (
                  <KeywordText style={styles.detailFlavor}>{focusedItem.flavorText}</KeywordText>
                )}

                {/* Level Effects Display */}
                {focusedItem.levelEffects && (() => {
                  const effectLevel = focusedOption.type === 'upgrade'
                    ? Math.min(3, focusedItem.level + 1) as WeaponLevel
                    : 1;
                  const effects = focusedItem.levelEffects[effectLevel];
                  if (!effects || Object.keys(effects).length === 0) return null;

                  return (
                    <View style={styles.effectsBox}>
                      <Text style={styles.effectsLabel}>Level {effectLevel} Effects</Text>
                      {Object.entries(effects).map(([key, value], i) => (
                        <View key={i} style={styles.effectRow}>
                          <Text style={styles.effectKey}>{key}</Text>
                          <Text style={styles.statIncrease}>
                            {typeof value === 'number' && value > 0 ? '+' : ''}{value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Item Type Badge */}
                <View style={styles.itemTypeBadge}>
                  <Text style={styles.itemTypeBadgeText}>
                    {focusedItem.type === 'weapon' ? '⚔️ WEAPON' : '🛡️ PASSIVE'}
                  </Text>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Item Options Grid */}
          <View style={styles.optionsGrid}>
            {options.map((option, index) => {
              const isUpgrade = option.type === 'upgrade';
              const rarityColor = isUpgrade ? COLORS.impactOrange : COLORS.logicTeal;
              const isSelected = index === focusedIndex;

              return (
                <Pressable
                  key={option.item.id || index}
                  onPress={() => setFocusedIndex(index)}
                  style={[
                    styles.optionCard,
                    { borderColor: rarityColor },
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  {/* NEW/UPGRADE badge */}
                  <View style={[
                    styles.typeBadge,
                    { backgroundColor: rarityColor }
                  ]}>
                    <Text style={styles.typeBadgeText}>
                      {isUpgrade ? `LV${Math.min(3, option.item.level + 1)}` : 'NEW'}
                    </Text>
                  </View>
                  {option.item.icon && (
                    <Icon
                      name={option.item.icon}
                      size={28}
                      color={isSelected ? COLORS.logicTeal : COLORS.slateCharcoal}
                    />
                  )}
                  <Text
                    style={[
                      styles.optionName,
                      isSelected && styles.optionNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {option.item.name}
                  </Text>
                  <Text style={[styles.rarityTag, { color: COLORS.slateCharcoal }]}>
                    {option.item.type === 'weapon' ? 'WEAPON' : 'PASSIVE'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Reroll Button */}
            <TouchableOpacity
              style={[
                styles.rerollButton,
                !canReroll && styles.rerollButtonDisabled,
              ]}
              onPress={onReroll}
              disabled={!canReroll}
            >
              <Text style={styles.rerollButtonText}>
                {freeRerolls > 0
                  ? `REROLL (${freeRerolls} free)`
                  : `REROLL ($${rerollCost})`}
              </Text>
            </TouchableOpacity>

            {/* Select Button */}
            <TouchableOpacity
              style={styles.selectButton}
              onPress={handleSelect}
            >
              <Text style={styles.selectButtonText}>
                {hasMoreLevelUps ? 'SELECT & CONTINUE' : 'SELECT'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* More level-ups indicator */}
          {hasMoreLevelUps && (
            <Text style={styles.moreIndicator}>
              More level-ups pending...
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    width: '100%',
    maxWidth: 400,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperBeige,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
  },
  headerLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    opacity: 0.7,
  },
  freeBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.canvasWhite,
    letterSpacing: 0.5,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  optionCard: {
    width: '48%',
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  optionCardSelected: {
    backgroundColor: COLORS.actionYellow,
  },
  optionName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
    textAlign: 'center',
  },
  optionNameSelected: {
    fontWeight: '700',
  },
  rarityTag: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailPanel: {
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    marginBottom: 16,
    maxHeight: 200,
    overflow: 'hidden',
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  detailName: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    flex: 1,
  },
  detailDesc: {
    fontSize: 12,
    color: COLORS.slateCharcoal,
    lineHeight: 18,
    marginBottom: 4,
  },
  detailFlavor: {
    fontSize: 11,
    color: COLORS.slateCharcoal,
    lineHeight: 16,
    marginBottom: 8,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  ownershipBadge: {
    backgroundColor: COLORS.logicTeal,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ownershipBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 9,
  },
  effectsBox: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.logicTeal,
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
    fontSize: 11,
    flex: 1,
    flexShrink: 1,
  },
  statComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  statBefore: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.7,
    flexShrink: 0,
  },
  statArrow: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    opacity: 0.5,
  },
  statAfter: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statIncrease: {
    color: COLORS.logicTeal,
  },
  statDecrease: {
    color: COLORS.impactRed,
  },
  statCapped: {
    color: '#EAB308',
  },
  capIndicator: {
    fontSize: 10,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
    marginLeft: 4,
    fontWeight: '500',
  },
  capIndicatorCapped: {
    color: '#EAB308',
    opacity: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  rerollButton: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rerollButtonDisabled: {
    opacity: 0.5,
  },
  rerollButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateCharcoal,
  },
  selectButton: {
    flex: 1,
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    textTransform: 'uppercase',
  },
  moreIndicator: {
    fontSize: 11,
    color: COLORS.slateCharcoal,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 8,
  },
  // Type badges for NEW/UPGRADE indicators
  typeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 1,
  },
  typeBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  // Item type badge in detail view
  itemTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.paperBeige,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  itemTypeBadgeText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});

export default LevelUpModal;
