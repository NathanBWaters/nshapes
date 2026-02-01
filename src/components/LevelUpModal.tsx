import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import { PlayerStats, Weapon } from '@/types';
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
  options: Weapon[];
  onSelect: (weapon: Weapon) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
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

  const focusedWeapon = options[focusedIndex];
  const canReroll = freeRerolls > 0 || playerMoney >= rerollCost;

  const handleSelect = () => {
    if (focusedWeapon) {
      onSelect(focusedWeapon);
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

          {/* Selected Weapon Detail - Above selection for better visibility */}
          {focusedWeapon && (
            <View style={styles.detailPanel}>
              <ScrollView
                style={styles.detailScroll}
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                <View style={styles.detailHeader}>
                  {focusedWeapon.icon && (
                    <Icon
                      name={focusedWeapon.icon}
                      size={24}
                      color={COLORS.slateCharcoal}
                    />
                  )}
                  <Text style={[styles.detailName, { color: getRarityColor(focusedWeapon.rarity) }]}>
                    {focusedWeapon.name}
                  </Text>
                  {/* Ownership indicator for weapons with maxCount */}
                  {focusedWeapon.maxCount !== undefined && (
                    <View style={styles.ownershipBadge}>
                      <Text style={styles.ownershipBadgeText}>
                        {getPlayerWeaponCount(focusedWeapon.name, playerWeapons)}/{focusedWeapon.maxCount}
                      </Text>
                    </View>
                  )}
                </View>
                <KeywordText style={styles.detailDesc}>
                  {getDynamicDescription(focusedWeapon, playerStats)}
                </KeywordText>
                {focusedWeapon.flavorText && (
                  <KeywordText style={styles.detailFlavor}>{focusedWeapon.flavorText}</KeywordText>
                )}

                {/* Stats Preview - Before → After */}
                {Object.keys(focusedWeapon.effects).length > 0 && (
                  <View style={styles.effectsBox}>
                    <Text style={styles.effectsLabel}>Stat Changes</Text>
                    {getStatComparison(focusedWeapon, playerStats).map((stat, i) => (
                      <View key={i} style={styles.effectRow}>
                        <Text style={styles.effectKey}>{stat.key}</Text>
                        <View style={styles.statComparisonRow}>
                          {stat.isPerWeapon ? (
                            <>
                              <Text style={[
                                styles.statAfter,
                                stat.isIncrease ? styles.statIncrease : styles.statDecrease,
                              ]}>
                                {stat.after}
                              </Text>
                              <Text style={styles.capIndicator}>(per weapon)</Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.statBefore}>{stat.before}</Text>
                              <Text style={styles.statArrow}>→</Text>
                              <Text style={[
                                styles.statAfter,
                                stat.isIncrease ? styles.statIncrease : styles.statDecrease,
                                stat.isCapped && styles.statCapped,
                              ]}>
                                {stat.after}
                              </Text>
                            </>
                          )}
                          {stat.cap !== null && (
                            <Text style={[styles.capIndicator, stat.isCapped && styles.capIndicatorCapped]}>
                              (max {stat.cap}%)
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Cap Increase Info (for Mastery weapons) */}
                {focusedWeapon.capIncrease && (() => {
                  const capInfo = getCapIncreaseInfo(focusedWeapon, playerStats);
                  if (!capInfo) return null;
                  return (
                    <View style={[styles.effectsBox, { marginTop: 8 }]}>
                      <Text style={styles.effectsLabel}>Cap Increase</Text>
                      <View style={styles.effectRow}>
                        <Text style={styles.effectKey}>Current {capInfo.statName}</Text>
                        <Text style={styles.statBefore}>{capInfo.currentValue}%</Text>
                      </View>
                      <View style={styles.effectRow}>
                        <Text style={styles.effectKey}>Current Cap</Text>
                        <Text style={styles.statBefore}>{capInfo.currentCap}%</Text>
                      </View>
                      <View style={styles.effectRow}>
                        <Text style={styles.effectKey}>New Cap</Text>
                        <Text style={styles.statIncrease}>{capInfo.newCap}%</Text>
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>
            </View>
          )}

          {/* Weapon Options Grid */}
          <View style={styles.optionsGrid}>
            {options.map((weapon, index) => {
              const rarityColor = getRarityColor(weapon.rarity);
              const isSelected = index === focusedIndex;

              return (
                <Pressable
                  key={weapon.id || index}
                  onPress={() => setFocusedIndex(index)}
                  style={[
                    styles.optionCard,
                    { borderColor: rarityColor },
                    isSelected && styles.optionCardSelected,
                  ]}
                >
                  {weapon.icon && (
                    <Icon
                      name={weapon.icon}
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
                    {weapon.name}
                  </Text>
                  <Text style={[styles.rarityTag, { color: rarityColor }]}>
                    {getRarityLabel(weapon.rarity)}
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
});

export default LevelUpModal;
